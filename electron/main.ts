import { app, BrowserWindow, desktopCapturer, ipcMain } from "electron";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AgentBus } from "./agentBus.js";
import { AiRouter } from "./aiRouter.js";
import { CoreEngine } from "./coreEngine.js";
import { CostController } from "./costController.js";
import { ExecutionEngine } from "./executionEngine.js";
import { SadiyaStore } from "./store.js";
import { TaskQueue } from "./taskQueue.js";
import type { AssistantRequest, AssistantResponse, ChatMessage } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const devServerUrl = process.env.SADIYA_DEV_SERVER_URL;

const store = new SadiyaStore();
const agentBus = new AgentBus(store);
const coreEngine = new CoreEngine(store);
const executionEngine = new ExecutionEngine(coreEngine);
const costController = new CostController(store);
const aiRouter = new AiRouter(costController);
const taskQueue = new TaskQueue(store, agentBus);

async function createWindow(): Promise<void> {
  const window = new BrowserWindow({
    width: 1024,
    height: 768,
    minWidth: 1000,
    minHeight: 720,
    title: "SADIYA",
    backgroundColor: "#050816",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  window.webContents.on("preload-error", (_event, preloadPath, error) => {
    console.error(`Preload failed at ${preloadPath}: ${error.message}`);
  });

  if (devServerUrl) {
    await window.loadURL(devServerUrl);
  } else {
    const packagedIndex = path.resolve(__dirname, "../dist/index.html");
    const localIndex = path.join(process.cwd(), "dist/index.html");
    const indexPath = fs.existsSync(packagedIndex) ? packagedIndex : localIndex;
    await window.loadURL(`file://${indexPath}`);
  }
}

app.whenReady().then(async () => {
  await store.load();
  await createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

ipcMain.handle("sadiya:get-state", () => store.getState());

ipcMain.handle("sadiya:cancel-task", async (_event, taskId: string) => {
  const cancelled = await taskQueue.cancel(taskId);
  return { cancelled, tasks: store.getState().tasks };
});

ipcMain.handle("sadiya:capture-screen", async () => {
  const sources = await desktopCapturer.getSources({
    types: ["screen"],
    thumbnailSize: { width: 1280, height: 720 },
  });
  const source = sources[0];
  if (!source) {
    throw new Error("No screen source available");
  }

  return {
    imageDataUrl: source.thumbnail.toDataURL(),
    summary: `Desktop screen shared: ${source.name}`,
    capturedAt: new Date().toISOString(),
  };
});

ipcMain.handle("sadiya:get-api-status", () => aiRouter.getStatus());

ipcMain.handle("sadiya:set-api-key", (_event, apiKey: string) => aiRouter.setApiKey(apiKey));

ipcMain.handle("sadiya:test-api", () => aiRouter.testConnection());

ipcMain.handle("sadiya:send-message", async (_event, request: AssistantRequest): Promise<AssistantResponse> => {
  const content = request.content;
  const effectiveContent = request.screen
    ? `${content}\n\n[Screen shared: ${request.screen.summary}]`
    : content;
  const userMessage: ChatMessage = {
    id: crypto.randomUUID(),
    role: "user",
    content: effectiveContent,
    createdAt: new Date().toISOString(),
  };
  await store.addMessage(userMessage);

  const intents = executionEngine.detectIntents(content);
  let responseText = "";

  const outputs: string[] = [];
  for (const intent of intents) {
    if (intent.type === "chat") {
      const result = await taskQueue.run(intent, async () => {
      const output = await aiRouter.respond({
        prompt: content,
        messages: store.getState().messages,
        memories: store.getState().memories,
        screen: request.screen,
      });
      const fallbackUsed = store.getState().costUsage[0]?.fallbackUsed ?? false;
      if (fallbackUsed) {
        await store.addRecoveryEvent({
          id: crypto.randomUUID(),
          source: "AI Router",
          strategy: "fallback",
          message: "Gemini unavailable or budget-protected; mock fallback used.",
          createdAt: new Date().toISOString(),
        });
      }
      return {
        title: "AI chat",
        agent: "planner",
        output,
      };
      });
      outputs.push(result.output);
    } else {
      const result = await taskQueue.run(intent, () =>
        executionEngine.execute(intent, store.getState().memories),
      );
      if (result.memory) {
        await store.addMemory(result.memory);
      }
      outputs.push(result.output);
    }
  }
  responseText = outputs.join("\n\n");

  const assistantMessage: ChatMessage = {
    id: crypto.randomUUID(),
    role: "assistant",
    content: responseText,
    createdAt: new Date().toISOString(),
  };
  await store.addMessage(assistantMessage);

  return {
    message: responseText,
    tasks: store.getState().tasks,
    memories: store.getState().memories,
    agentEvents: store.getState().agentEvents,
    costUsage: store.getState().costUsage,
    recoveryEvents: store.getState().recoveryEvents,
  };
});
