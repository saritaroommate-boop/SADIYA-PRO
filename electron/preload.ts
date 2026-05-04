import { contextBridge, ipcRenderer } from "electron";
import type { ApiStatus, AppState, AssistantRequest, AssistantResponse, SadiyaTask, ScreenContext } from "./types.js";

const api = {
  getState: (): Promise<AppState> => ipcRenderer.invoke("sadiya:get-state"),
  sendMessage: (request: AssistantRequest): Promise<AssistantResponse> =>
    ipcRenderer.invoke("sadiya:send-message", request),
  cancelTask: (taskId: string): Promise<{ cancelled: boolean; tasks: SadiyaTask[] }> =>
    ipcRenderer.invoke("sadiya:cancel-task", taskId),
  captureScreen: (): Promise<ScreenContext> => ipcRenderer.invoke("sadiya:capture-screen"),
  getApiStatus: (): Promise<ApiStatus> => ipcRenderer.invoke("sadiya:get-api-status"),
  setApiKey: (apiKey: string): Promise<{ configured: boolean; mode: "live" | "mock" }> =>
    ipcRenderer.invoke("sadiya:set-api-key", apiKey),
  testApi: (): Promise<{ ok: boolean; message: string }> => ipcRenderer.invoke("sadiya:test-api"),
};

contextBridge.exposeInMainWorld("sadiya", api);

export type SadiyaApi = typeof api;
