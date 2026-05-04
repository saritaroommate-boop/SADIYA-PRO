export type Role = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  createdAt: string;
}

export type TaskStatus =
  | "queued"
  | "running"
  | "retrying"
  | "completed"
  | "failed"
  | "cancelled";

export interface TaskLog {
  id: string;
  taskId: string;
  level: "info" | "warn" | "error";
  message: string;
  createdAt: string;
}

export interface SadiyaTask {
  id: string;
  title: string;
  agent: string;
  status: TaskStatus;
  attempts: number;
  maxRetries: number;
  createdAt: string;
  updatedAt: string;
  result?: string;
  error?: string;
  cancellationRequested?: boolean;
}

export interface MemoryItem {
  id: string;
  key: string;
  value: string;
  createdAt: string;
}

export interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  status: "idle" | "working" | "offline";
  currentTaskId?: string;
}

export interface PluginDefinition {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  enabled: boolean;
}

export interface AgentEvent {
  id: string;
  fromAgent: string;
  toAgent: string;
  topic: string;
  message: string;
  createdAt: string;
}

export interface SharedContextEntry {
  id: string;
  agentId: string;
  key: string;
  value: string;
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  capabilityId: string;
  agentId: string;
  riskLevel: "safe" | "confirm" | "dangerous";
  status: "allowed" | "blocked" | "failed";
  summary: string;
  createdAt: string;
}

export interface CostUsage {
  id: string;
  provider: "gemini" | "mock";
  model: string;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  fallbackUsed: boolean;
  createdAt: string;
}

export interface RecoveryEvent {
  id: string;
  taskId?: string;
  source: string;
  strategy: "retry" | "fallback" | "fail";
  message: string;
  createdAt: string;
}

export interface AssistantResponse {
  message: string;
  tasks: SadiyaTask[];
  memories: MemoryItem[];
  agentEvents: AgentEvent[];
  costUsage: CostUsage[];
  recoveryEvents: RecoveryEvent[];
}

export interface ScreenContext {
  imageDataUrl?: string;
  summary: string;
  capturedAt: string;
}

export interface AssistantRequest {
  content: string;
  screen?: ScreenContext;
}

export interface ApiStatus {
  provider: "gemini";
  model: string;
  configured: boolean;
  mode: "live" | "mock";
  source: string;
}

export interface AppState {
  messages: ChatMessage[];
  tasks: SadiyaTask[];
  taskLogs: TaskLog[];
  memories: MemoryItem[];
  agents: AgentDefinition[];
  plugins: PluginDefinition[];
  agentEvents: AgentEvent[];
  sharedContext: SharedContextEntry[];
  audit: AuditEntry[];
  costUsage: CostUsage[];
  recoveryEvents: RecoveryEvent[];
}

export interface SadiyaApi {
  getState: () => Promise<AppState>;
  sendMessage: (request: AssistantRequest) => Promise<AssistantResponse>;
  cancelTask: (taskId: string) => Promise<{ cancelled: boolean; tasks: SadiyaTask[] }>;
  captureScreen: () => Promise<ScreenContext>;
  getApiStatus: () => Promise<ApiStatus>;
  setApiKey: (apiKey: string) => Promise<{ configured: boolean; mode: "live" | "mock" }>;
  testApi: () => Promise<{ ok: boolean; message: string }>;
}
