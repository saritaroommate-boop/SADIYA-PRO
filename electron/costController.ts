import type { SadiyaStore } from "./store.js";
import type { CostUsage } from "./types.js";

export interface CostRecordInput {
  provider: CostUsage["provider"];
  model: string;
  prompt: string;
  output: string;
  fallbackUsed: boolean;
}

export class CostController {
  private readonly freeDailyTokenBudget = 120_000;

  constructor(private readonly store: SadiyaStore) {}

  canUseGemini(prompt: string): boolean {
    const today = new Date().toISOString().slice(0, 10);
    const usedToday = this.store
      .getState()
      .costUsage.filter((entry) => entry.createdAt.startsWith(today))
      .reduce(
        (sum, entry) => sum + entry.estimatedInputTokens + entry.estimatedOutputTokens,
        0,
      );
    return usedToday + this.estimateTokens(prompt) < this.freeDailyTokenBudget;
  }

  async record(input: CostRecordInput): Promise<void> {
    await this.store.addCostUsage({
      id: crypto.randomUUID(),
      provider: input.provider,
      model: input.model,
      estimatedInputTokens: this.estimateTokens(input.prompt),
      estimatedOutputTokens: this.estimateTokens(input.output),
      fallbackUsed: input.fallbackUsed,
      createdAt: new Date().toISOString(),
    });
  }

  estimateTokens(text: string): number {
    return Math.max(1, Math.ceil(text.length / 4));
  }
}
