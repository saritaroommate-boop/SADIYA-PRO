import electron from "electron";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { SadiyaStore } from "./store.js";
import type { MemoryItem, SystemInfo } from "./types.js";

const execFileAsync = promisify(execFile);
const { shell } = electron;

export type RiskLevel = "safe" | "confirm" | "dangerous";
export type CapabilityStatus = "allowed" | "blocked" | "failed";

export interface CapabilityRequest {
  agentId: string;
  input: Record<string, string>;
}

export interface CapabilityResult {
  title: string;
  agent: string;
  output: string;
  memory?: MemoryItem;
}

export interface Capability {
  id: string;
  description: string;
  permissions: string[];
  riskLevel: RiskLevel;
  timeoutMs: number;
  handler: (request: CapabilityRequest) => Promise<CapabilityResult>;
}

export class CoreEngine {
  private readonly capabilities = new Map<string, Capability>();

  constructor(private readonly store: SadiyaStore) {
    this.registerDefaults();
  }

  listCapabilities(): Capability[] {
    return [...this.capabilities.values()];
  }

  async execute(
    capabilityId: string,
    request: CapabilityRequest,
  ): Promise<CapabilityResult> {
    const capability = this.capabilities.get(capabilityId);
    if (!capability) {
      throw new Error(`Unknown capability: ${capabilityId}`);
    }

    const allowed = this.isAllowed(capability, request);
    if (!allowed) {
      await this.audit(capability, request.agentId, "blocked", "Blocked by policy");
      throw new Error(`Policy blocked capability: ${capabilityId}`);
    }

    await this.audit(capability, request.agentId, "allowed", "Capability execution allowed");

    try {
      const result = await this.withTimeout(
        capability.handler(request),
        capability.timeoutMs,
        capability.id,
      );
      await this.store.addSharedContext({
        id: crypto.randomUUID(),
        agentId: request.agentId,
        key: `last:${capability.id}`,
        value: result.output.slice(0, 500),
        createdAt: new Date().toISOString(),
      });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown capability failure";
      await this.audit(capability, request.agentId, "failed", message);
      throw error;
    }
  }

  private registerDefaults(): void {
    this.register({
      id: "system.open_app",
      description: "Open approved local applications.",
      permissions: ["apps.open"],
      riskLevel: "safe",
      timeoutMs: 8000,
      handler: ({ input }) => this.openApp(input.app ?? "browser"),
    });

    this.register({
      id: "web.search",
      description: "Open a browser web search.",
      permissions: ["web.search", "browser.open"],
      riskLevel: "safe",
      timeoutMs: 8000,
      handler: ({ input }) => this.webSearch(input.query ?? ""),
    });

    this.register({
      id: "file.search",
      description: "Search approved folders in home directory.",
      permissions: ["files.read"],
      riskLevel: "safe",
      timeoutMs: 12000,
      handler: ({ input }) => this.fileSearch(input.query ?? ""),
    });

    this.register({
      id: "system.info",
      description: "Read basic system telemetry.",
      permissions: ["system.read"],
      riskLevel: "safe",
      timeoutMs: 5000,
      handler: () => this.systemInfo(),
    });

    this.register({
      id: "screen.screenshot",
      description: "Capture the current desktop screen.",
      permissions: ["screen.capture"],
      riskLevel: "safe",
      timeoutMs: 8000,
      handler: () => this.captureScreenshot(),
    });

    this.register({
      id: "memory.save",
      description: "Save user-approved memory.",
      permissions: ["memory.write"],
      riskLevel: "safe",
      timeoutMs: 3000,
      handler: async ({ input }) =>
        this.saveMemory(input.key ?? `memory-${Date.now()}`, input.value ?? ""),
    });

    this.register({
      id: "memory.recall",
      description: "Recall local memories.",
      permissions: ["memory.read"],
      riskLevel: "safe",
      timeoutMs: 3000,
      handler: async () => this.recallMemory(this.store.getState().memories),
    });
  }

  private register(capability: Capability): void {
    this.capabilities.set(capability.id, capability);
  }

  private isAllowed(capability: Capability, request: CapabilityRequest): boolean {
    if (capability.riskLevel === "dangerous") {
      return false;
    }

    if (capability.riskLevel === "confirm") {
      return request.input.confirmed === "true";
    }

    return true;
  }

  private async audit(
    capability: Capability,
    agentId: string,
    status: CapabilityStatus,
    summary: string,
  ): Promise<void> {
    await this.store.addAudit({
      id: crypto.randomUUID(),
      capabilityId: capability.id,
      agentId,
      riskLevel: capability.riskLevel,
      status,
      summary,
      createdAt: new Date().toISOString(),
    });
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
    let timeout: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }

  private async openApp(appName: string): Promise<CapabilityResult> {
    const safeApp = appName.toLowerCase();
    const commandMap = {
      browser: ["google-chrome", []],
      terminal: ["x-terminal-emulator", []],
      files: ["xdg-open", [os.homedir()]],
    } satisfies Record<string, [string, string[]]>;

    const commandEntry = commandMap[safeApp as keyof typeof commandMap];
    if (!commandEntry) {
      throw new Error(`App not approved: ${appName}`);
    }

    const [command, args] = commandEntry;
    await execFileAsync(command, args);

    return {
      title: `Open ${safeApp}`,
      agent: "system",
      output: `Opened ${safeApp}.`,
    };
  }

  private async webSearch(query: string): Promise<CapabilityResult> {
    if (!query.trim()) {
      throw new Error("Search query is empty");
    }
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    await shell.openExternal(url);
    return {
      title: `Web search: ${query}`,
      agent: "web",
      output: `Web search open kar diya: ${query}`,
    };
  }

  private async fileSearch(query: string): Promise<CapabilityResult> {
    if (!query.trim()) {
      throw new Error("File search query is empty");
    }
    const roots = [
      os.homedir(),
      path.join(os.homedir(), "Documents"),
      path.join(os.homedir(), "Downloads"),
      path.join(os.homedir(), "Desktop"),
    ];
    const matches: string[] = [];

    for (const root of roots) {
      await this.walkFiles(root, query.toLowerCase(), matches);
      if (matches.length >= 10) {
        break;
      }
    }

    return {
      title: `File search: ${query}`,
      agent: "file",
      output: matches.length
        ? `Files mile:\n${matches.slice(0, 10).join("\n")}`
        : `"${query}" ke matching files approved folders me nahi mile.`,
    };
  }

  private async systemInfo(): Promise<CapabilityResult> {
    const info: SystemInfo = {
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
      cpus: os.cpus().length,
      totalMemoryGb: Math.round((os.totalmem() / 1024 ** 3) * 10) / 10,
      freeMemoryGb: Math.round((os.freemem() / 1024 ** 3) * 10) / 10,
      homeDir: os.homedir(),
    };

    return {
      title: "System info",
      agent: "system",
      output: [
        `Platform: ${info.platform} ${info.release}`,
        `Architecture: ${info.arch}`,
        `CPU cores: ${info.cpus}`,
        `Memory: ${info.freeMemoryGb} GB free / ${info.totalMemoryGb} GB total`,
        `Home: ${info.homeDir}`,
      ].join("\n"),
    };
  }

  private async captureScreenshot(): Promise<CapabilityResult> {
    const screenshotsDir = path.join(os.homedir(), "Pictures", "SADIYA");
    await fs.mkdir(screenshotsDir, { recursive: true });
    const filePath = path.join(screenshotsDir, `sadiya-screen-${Date.now()}.png`);
    await execFileAsync("gnome-screenshot", ["-f", filePath]);

    return {
      title: "Take screenshot",
      agent: "system",
      output: `Screenshot saved: ${filePath}`,
    };
  }

  private saveMemory(key: string, value: string): CapabilityResult {
    if (!value.trim()) {
      throw new Error("Memory value is empty");
    }
    const memory: MemoryItem = {
      id: key,
      key,
      value,
      createdAt: new Date().toISOString(),
    };

    return {
      title: "Save memory",
      agent: "memory",
      output: `Yaad rakh liya: ${value}`,
      memory,
    };
  }

  private recallMemory(memories: MemoryItem[]): CapabilityResult {
    return {
      title: "Recall memory",
      agent: "memory",
      output: memories.length
        ? `Mujhe ye yaad hai:\n${memories.map((item) => `- ${item.value}`).join("\n")}`
        : "Abhi memory empty hai. Aap 'remember ...' ya 'yaad rakho ...' bol sakte hain.",
    };
  }

  private async walkFiles(root: string, query: string, matches: string[]): Promise<void> {
    if (!query || matches.length >= 10) {
      return;
    }

    let entries;
    try {
      entries = await fs.readdir(root, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (matches.length >= 10 || entry.name.startsWith(".")) {
        continue;
      }

      const fullPath = path.join(root, entry.name);
      if (entry.name.toLowerCase().includes(query)) {
        matches.push(fullPath);
      }

      if (entry.isDirectory()) {
        await this.walkFiles(fullPath, query, matches);
      }
    }
  }
}
