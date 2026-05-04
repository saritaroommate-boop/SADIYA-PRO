import type { SadiyaStore } from "./store.js";
import type { ExecutionResult, Intent } from "./executionEngine.js";
import type { SadiyaTask } from "./types.js";
import type { AgentBus } from "./agentBus.js";

export class TaskQueue {
  private readonly activeAgentTaskIds = new Map<string, string>();

  constructor(
    private readonly store: SadiyaStore,
    private readonly agentBus: AgentBus,
  ) {}

  async run(intent: Intent, executor: () => Promise<ExecutionResult>): Promise<ExecutionResult> {
    const maxRetries = intent.type === "open_app" || intent.type === "screenshot" ? 0 : 1;
    const task: SadiyaTask = {
      id: crypto.randomUUID(),
      title: this.titleForIntent(intent),
      agent: this.agentForIntent(intent),
      status: "queued",
      attempts: 0,
      maxRetries,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      cancellationRequested: false,
    };

    await this.store.upsertTask(task);
    await this.store.addTaskLog({
      id: crypto.randomUUID(),
      taskId: task.id,
      level: "info",
      message: "Queued task",
      createdAt: new Date().toISOString(),
    });

    await this.agentBus.publish("planner", task.agent, "task.assigned", task.title);

    let lastError = "Unknown failure";
    for (let attempt = 1; attempt <= maxRetries + 1; attempt += 1) {
      if (this.isCancellationRequested(task.id)) {
        await this.markCancelled(task, "Cancelled before execution");
        throw new Error("Task cancelled");
      }

      const runningTask: SadiyaTask = {
        ...task,
        attempts: attempt,
        status: attempt > 1 ? "retrying" : "running",
        updatedAt: new Date().toISOString(),
      };
      const agentId = this.agentIdForIntent(intent);
      const activeTaskId = this.activeAgentTaskIds.get(agentId);
      if (activeTaskId && activeTaskId !== task.id) {
        lastError = `${this.agentForIntent(intent)} is already running task ${activeTaskId}`;
        await this.store.addTaskLog({
          id: crypto.randomUUID(),
          taskId: task.id,
          level: "error",
          message: lastError,
          createdAt: new Date().toISOString(),
        });
        break;
      }

      this.activeAgentTaskIds.set(agentId, task.id);
      await this.store.updateAgentStatus(agentId, "working", task.id);
      await this.store.upsertTask(runningTask);
      await this.store.addTaskLog({
        id: crypto.randomUUID(),
        taskId: task.id,
        level: attempt > 1 ? "warn" : "info",
        message: `${attempt > 1 ? "Retrying" : "Running"} with ${task.agent}`,
        createdAt: new Date().toISOString(),
      });

      try {
        const result = await executor();
        if (this.isCancellationRequested(task.id)) {
          await this.markCancelled(runningTask, "Cancelled after execution");
          this.activeAgentTaskIds.delete(agentId);
          await this.store.updateAgentStatus(agentId, "idle");
          return {
            title: runningTask.title,
            agent: runningTask.agent,
            output: "Task cancelled",
          };
        }
        await this.store.upsertTask({
          ...runningTask,
          status: "completed",
          result: result.output,
          updatedAt: new Date().toISOString(),
        });
        await this.store.addTaskLog({
          id: crypto.randomUUID(),
          taskId: task.id,
          level: "info",
          message: "Completed task",
          createdAt: new Date().toISOString(),
        });
        this.activeAgentTaskIds.delete(agentId);
        await this.store.updateAgentStatus(agentId, "idle");
        await this.agentBus.publish(task.agent, "planner", "task.completed", result.output.slice(0, 200));
        return result;
      } catch (error) {
        this.activeAgentTaskIds.delete(agentId);
        await this.store.updateAgentStatus(agentId, "idle");
        lastError = error instanceof Error ? error.message : "Unknown failure";
        if (lastError === "Task cancelled") {
          break;
        }
        const willRetry = attempt <= maxRetries;
        await this.store.addTaskLog({
          id: crypto.randomUUID(),
          taskId: task.id,
          level: willRetry ? "warn" : "error",
          message: willRetry ? `${lastError}. Retry scheduled.` : lastError,
          createdAt: new Date().toISOString(),
        });
        await this.store.addRecoveryEvent({
          id: crypto.randomUUID(),
          taskId: task.id,
          source: task.agent,
          strategy: willRetry ? "retry" : "fail",
          message: lastError,
          createdAt: new Date().toISOString(),
        });
      }
    }

    this.activeAgentTaskIds.delete(this.agentIdForIntent(intent));
    await this.store.updateAgentStatus(this.agentIdForIntent(intent), "idle");
    await this.store.upsertTask({
      ...task,
      attempts: maxRetries + 1,
      status: "failed",
      result: lastError,
      error: lastError,
      updatedAt: new Date().toISOString(),
    });
    await this.agentBus.publish(task.agent, "planner", "task.failed", lastError);
    throw new Error(lastError);
  }

  async cancel(taskId: string): Promise<boolean> {
    return this.store.requestTaskCancellation(taskId);
  }

  private titleForIntent(intent: Intent): string {
    switch (intent.type) {
      case "open_app":
        return `Open ${intent.app}`;
      case "web_search":
        return `Web search: ${intent.query}`;
      case "file_search":
        return `File search: ${intent.query}`;
      case "screenshot":
        return "Take screenshot";
      case "system_info":
        return "Read system info";
      case "save_memory":
        return "Save memory";
      case "recall_memory":
        return "Recall memory";
      case "clarify":
        return "Clarify request";
      case "ui_info":
        return `${intent.topic} info`;
      case "chat":
        return "AI chat";
    }
  }

  private agentForIntent(intent: Intent): string {
    switch (intent.type) {
      case "open_app":
      case "screenshot":
      case "system_info":
        return "System Agent";
      case "web_search":
        return "Web Agent";
      case "file_search":
        return "File Agent";
      case "save_memory":
      case "recall_memory":
        return "Memory Agent";
      case "clarify":
      case "ui_info":
        return "Planner Agent";
      case "chat":
        return "Planner Agent";
    }
  }

  private agentIdForIntent(intent: Intent): string {
    switch (intent.type) {
      case "open_app":
      case "screenshot":
      case "system_info":
        return "system";
      case "web_search":
        return "web";
      case "file_search":
        return "file";
      case "save_memory":
      case "recall_memory":
        return "memory";
      case "clarify":
      case "ui_info":
        return "planner";
      case "chat":
        return "planner";
    }
  }

  private isCancellationRequested(taskId: string): boolean {
    return this.store.getState().tasks.some(
      (task) => task.id === taskId && task.cancellationRequested,
    );
  }

  private async markCancelled(task: SadiyaTask, message: string): Promise<void> {
    await this.store.upsertTask({
      ...task,
      status: "cancelled",
      result: message,
      updatedAt: new Date().toISOString(),
    });
    await this.store.addTaskLog({
      id: crypto.randomUUID(),
      taskId: task.id,
      level: "warn",
      message,
      createdAt: new Date().toISOString(),
    });
    await this.store.addRecoveryEvent({
      id: crypto.randomUUID(),
      taskId: task.id,
      source: task.agent,
      strategy: "fail",
      message,
      createdAt: new Date().toISOString(),
    });
  }
}
