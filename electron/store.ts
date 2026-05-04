import { app } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import type {
  AgentDefinition,
  AgentEvent,
  AppState,
  AuditEntry,
  ChatMessage,
  CostUsage,
  MemoryItem,
  PluginDefinition,
  RecoveryEvent,
  SadiyaTask,
  SharedContextEntry,
  TaskLog,
} from "./types.js";

const defaultAgents: AgentDefinition[] = [
  {
    id: "planner",
    name: "Planner Agent",
    description: "Breaks goals into safe executable steps.",
    status: "idle",
  },
  {
    id: "system",
    name: "System Agent",
    description: "Handles safe desktop and system commands.",
    status: "idle",
  },
  {
    id: "file",
    name: "File Agent",
    description: "Searches files inside approved user folders.",
    status: "idle",
  },
  {
    id: "web",
    name: "Web Agent",
    description: "Opens searches and prepares browser automation tasks.",
    status: "idle",
  },
  {
    id: "memory",
    name: "Memory Agent",
    description: "Stores and retrieves long-term preferences.",
    status: "idle",
  },
];

const defaultPlugins: PluginDefinition[] = [
  {
    id: "desktop-control",
    name: "Desktop Control",
    description: "Open apps, show system info, and route safe commands.",
    permissions: ["apps.open", "system.read"],
    enabled: true,
  },
  {
    id: "web-research",
    name: "Web Research",
    description: "Search web and prepare browser automation flows.",
    permissions: ["browser.open", "web.search"],
    enabled: true,
  },
  {
    id: "memory-core",
    name: "Memory Core",
    description: "Save and recall user preferences locally.",
    permissions: ["memory.read", "memory.write"],
    enabled: true,
  },
];

const initialMessages: ChatMessage[] = [
  {
    id: "welcome",
    role: "assistant",
    content:
      "Assalamualaikum, main SADIYA hoon. Aap bolkar ya type karke command de sakte hain.",
    createdAt: new Date().toISOString(),
  },
];

const createDefaultState = (): AppState => ({
  messages: initialMessages,
  tasks: [],
  taskLogs: [],
  memories: [],
  agents: defaultAgents,
  plugins: defaultPlugins,
  agentEvents: [],
  sharedContext: [],
  audit: [],
  costUsage: [],
  recoveryEvents: [],
});

export class SadiyaStore {
  private state: AppState = createDefaultState();
  private readonly filePath: string;

  constructor() {
    this.filePath = path.join(app.getPath("userData"), "sadiya-state.json");
  }

  async load(): Promise<AppState> {
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<AppState>;
      this.state = {
        ...createDefaultState(),
        ...parsed,
        tasks: (parsed.tasks ?? []).map((task) => ({
          ...task,
          attempts: task.attempts ?? 0,
          maxRetries: task.maxRetries ?? 0,
          cancellationRequested: task.cancellationRequested ?? false,
        })),
        taskLogs: (parsed.taskLogs ?? []).map((log) => ({
          ...log,
          level: log.level ?? "info",
        })),
        agents: parsed.agents?.length ? parsed.agents : defaultAgents,
        plugins: parsed.plugins?.length ? parsed.plugins : defaultPlugins,
        agentEvents: parsed.agentEvents ?? [],
        sharedContext: parsed.sharedContext ?? [],
        audit: parsed.audit ?? [],
        costUsage: parsed.costUsage ?? [],
        recoveryEvents: parsed.recoveryEvents ?? [],
      };
    } catch {
      this.state = createDefaultState();
      await this.persist();
    }

    return this.state;
  }

  getState(): AppState {
    return this.state;
  }

  async addMessage(message: ChatMessage): Promise<void> {
    this.state.messages = [...this.state.messages, message];
    await this.persist();
  }

  async addMemory(memory: MemoryItem): Promise<void> {
    const existing = this.state.memories.filter((item) => item.key !== memory.key);
    this.state.memories = [memory, ...existing];
    await this.persist();
  }

  async upsertTask(task: SadiyaTask): Promise<void> {
    const index = this.state.tasks.findIndex((item) => item.id === task.id);
    if (index >= 0) {
      this.state.tasks[index] = task;
    } else {
      this.state.tasks = [task, ...this.state.tasks];
    }
    await this.persist();
  }

  async requestTaskCancellation(taskId: string): Promise<boolean> {
    let found = false;
    this.state.tasks = this.state.tasks.map((task) => {
      if (task.id !== taskId || task.status === "completed" || task.status === "failed") {
        return task;
      }
      found = true;
      return {
        ...task,
        cancellationRequested: true,
        updatedAt: new Date().toISOString(),
      };
    });
    if (found) {
      await this.persist();
    }
    return found;
  }

  async addTaskLog(log: TaskLog): Promise<void> {
    this.state.taskLogs = [log, ...this.state.taskLogs].slice(0, 200);
    await this.persist();
  }

  async addAgentEvent(event: AgentEvent): Promise<void> {
    this.state.agentEvents = [event, ...this.state.agentEvents].slice(0, 200);
    await this.persist();
  }

  async addSharedContext(entry: SharedContextEntry): Promise<void> {
    const rest = this.state.sharedContext.filter(
      (item) => !(item.agentId === entry.agentId && item.key === entry.key),
    );
    this.state.sharedContext = [entry, ...rest].slice(0, 100);
    await this.persist();
  }

  async addAudit(entry: AuditEntry): Promise<void> {
    this.state.audit = [entry, ...this.state.audit].slice(0, 200);
    await this.persist();
  }

  async addCostUsage(entry: CostUsage): Promise<void> {
    this.state.costUsage = [entry, ...this.state.costUsage].slice(0, 200);
    await this.persist();
  }

  async addRecoveryEvent(entry: RecoveryEvent): Promise<void> {
    this.state.recoveryEvents = [entry, ...this.state.recoveryEvents].slice(0, 200);
    await this.persist();
  }

  async updateAgentStatus(
    agentId: string,
    status: AgentDefinition["status"],
    currentTaskId?: string,
  ): Promise<void> {
    this.state.agents = this.state.agents.map((agent) =>
      agent.id === agentId ? { ...agent, status, currentTaskId } : agent,
    );
    await this.persist();
  }

  private async persist(): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(this.state, null, 2));
  }
}
