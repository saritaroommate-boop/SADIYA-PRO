import type { CoreEngine, CapabilityResult } from "./coreEngine.js";
import type { MemoryItem } from "./types.js";

export type Intent =
  | { type: "open_app"; app: "browser" | "terminal" | "files" }
  | { type: "web_search"; query: string }
  | { type: "file_search"; query: string }
  | { type: "screenshot" }
  | { type: "system_info" }
  | { type: "save_memory"; key: string; value: string }
  | { type: "recall_memory" }
  | { type: "clarify"; prompt: string }
  | { type: "ui_info"; topic: "agents" | "plugins" | "settings" }
  | { type: "chat"; prompt: string };

export type ExecutionResult = CapabilityResult;

export class ExecutionEngine {
  constructor(private readonly coreEngine: CoreEngine) {}

  detectIntent(input: string): Intent {
    return this.detectIntents(input)[0];
  }

  detectIntents(input: string): Intent[] {
    const normalized = input.trim();

    const parts = normalized
      .split(/\s+(?:aur saath me|aur sath me|and also|and)\s+/i)
      .map((part) => part.trim())
      .filter(Boolean);

    if (parts.length > 1) {
      return parts.map((part) => this.detectSingleIntent(part));
    }

    return [this.detectSingleIntent(normalized)];
  }

  private detectSingleIntent(normalized: string): Intent {
    const lower = normalized.toLowerCase();

    if (
      lower === "kuch kaam kar do" ||
      lower === "kuch karo" ||
      lower === "do something" ||
      lower === "help me"
    ) {
      return { type: "clarify", prompt: normalized };
    }

    if (
      lower.includes("open chrome") ||
      lower.includes("open browser") ||
      lower.includes("google open") ||
      lower.includes("open google") ||
      lower.includes("browser kholo")
    ) {
      return { type: "open_app", app: "browser" };
    }

    if (lower.includes("open terminal") || lower.includes("terminal kholo")) {
      return { type: "open_app", app: "terminal" };
    }

    if (
      lower.includes("open files") ||
      lower.includes("file manager") ||
      lower.includes("files kholo")
    ) {
      return { type: "open_app", app: "files" };
    }

    if (
      lower.includes("find file") ||
      lower.includes("file search") ||
      lower.includes("file dhoondo") ||
      lower.includes("file dhundo")
    ) {
      return {
        type: "file_search",
        query: normalized.replace(/find file|file search|file dhoondo|file dhundo/gi, "").trim(),
      };
    }

    if (
      lower.includes("take screenshot") ||
      lower.includes("screen shot") ||
      lower.includes("screenshot lo") ||
      lower.includes("screen capture")
    ) {
      return { type: "screenshot" };
    }

    if (lower.startsWith("search ") || lower.includes("web search") || lower.includes("google karo")) {
      return {
        type: "web_search",
        query: normalized.replace(/web search|search|google karo/gi, "").trim() || normalized,
      };
    }

    if (lower.includes("system info") || lower.includes("pc info")) {
      return { type: "system_info" };
    }

    if (lower.startsWith("remember ") || lower.startsWith("yaad rakho ")) {
      const value = normalized.replace(/^remember\s+|^yaad rakho\s+/i, "").trim();
      return {
        type: "save_memory",
        key: `memory-${Date.now()}`,
        value,
      };
    }

    if (lower.includes("what do you remember") || lower.includes("kya yaad hai")) {
      return { type: "recall_memory" };
    }

    if (lower.includes("agents status") || lower === "agents") {
      return { type: "ui_info", topic: "agents" };
    }

    if (lower.includes("plugin status") || lower === "plugins") {
      return { type: "ui_info", topic: "plugins" };
    }

    if (lower === "settings" || lower.includes("setting")) {
      return { type: "ui_info", topic: "settings" };
    }

    return { type: "chat", prompt: normalized };
  }

  async execute(intent: Intent, _memories: MemoryItem[]): Promise<ExecutionResult> {
    switch (intent.type) {
      case "open_app":
        return this.coreEngine.execute("system.open_app", {
          agentId: "system",
          input: { app: intent.app },
        });
      case "web_search":
        return this.coreEngine.execute("web.search", {
          agentId: "web",
          input: { query: intent.query },
        });
      case "file_search":
        return this.coreEngine.execute("file.search", {
          agentId: "file",
          input: { query: intent.query },
        });
      case "screenshot":
        return this.coreEngine.execute("screen.screenshot", {
          agentId: "system",
          input: {},
        });
      case "system_info":
        return this.coreEngine.execute("system.info", {
          agentId: "system",
          input: {},
        });
      case "save_memory":
        return this.coreEngine.execute("memory.save", {
          agentId: "memory",
          input: { key: intent.key, value: intent.value },
        });
      case "recall_memory":
        return this.coreEngine.execute("memory.recall", {
          agentId: "memory",
          input: {},
        });
      case "clarify":
        return {
          title: "Clarify request",
          agent: "planner",
          output:
            "Aap exactly kya karwana chahte hain? Example: `system info`, `search AI news`, `file search report`, ya `open browser`.",
        };
      case "ui_info":
        return this.uiInfo(intent.topic);
      case "chat":
        return {
          title: "General chat",
          agent: "planner",
          output: "",
        };
    }
  }

  private uiInfo(topic: "agents" | "plugins" | "settings"): ExecutionResult {
    const outputs = {
      agents: "Agents panel active hai: Planner, System, File, Web, Memory. Running task ke hisaab se status live update hota hai.",
      plugins: "Plugin manager ready hai: Desktop Control, Web Research, Memory Core enabled hain.",
      settings: "Settings ready: Gemini key env var `SADIYA_GEMINI_API_KEY`, voice toggle, screen-share vision mode, startup disabled.",
    };

    return {
      title: `${topic} info`,
      agent: "planner",
      output: outputs[topic],
    };
  }
}
