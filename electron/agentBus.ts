import type { SadiyaStore } from "./store.js";

export class AgentBus {
  constructor(private readonly store: SadiyaStore) {}

  async publish(
    fromAgent: string,
    toAgent: string,
    topic: string,
    message: string,
  ): Promise<void> {
    await this.store.addAgentEvent({
      id: crypto.randomUUID(),
      fromAgent,
      toAgent,
      topic,
      message,
      createdAt: new Date().toISOString(),
    });
  }
}
