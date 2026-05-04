import type { ChatMessage, MemoryItem, ScreenContext } from "./types.js";
import type { CostController } from "./costController.js";

export interface AiRouteRequest {
  prompt: string;
  messages: ChatMessage[];
  memories: MemoryItem[];
  screen?: ScreenContext;
}

export class AiRouter {
  private runtimeApiKey = process.env.SADIYA_GEMINI_API_KEY ?? process.env.GEMINI_API_KEY ?? "";

  constructor(private readonly costController: CostController) {}

  getStatus(): { provider: "gemini"; model: string; configured: boolean; mode: "live" | "mock"; source: string } {
    const envConfigured = Boolean(process.env.SADIYA_GEMINI_API_KEY ?? process.env.GEMINI_API_KEY);
    return {
      provider: "gemini",
      model: "gemini-1.5-flash",
      configured: Boolean(this.runtimeApiKey),
      mode: this.runtimeApiKey ? "live" : "mock",
      source: envConfigured ? "environment" : this.runtimeApiKey ? "session" : "none",
    };
  }

  setApiKey(apiKey: string): { configured: boolean; mode: "live" | "mock" } {
    this.runtimeApiKey = apiKey.trim();
    return {
      configured: Boolean(this.runtimeApiKey),
      mode: this.runtimeApiKey ? "live" : "mock",
    };
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    if (!this.runtimeApiKey) {
      return { ok: false, message: "Gemini API key missing. Abhi mock fallback active hai." };
    }

    try {
      const output = await this.callGemini({
        prompt: "Reply only: SADIYA Gemini live",
        messages: [],
        memories: [],
      });
      return { ok: true, message: output };
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      return { ok: false, message: `Gemini test failed: ${message}` };
    }
  }

  async respond(request: AiRouteRequest): Promise<string> {
    if (!this.runtimeApiKey || !this.costController.canUseGemini(request.prompt)) {
      const output = this.mockResponse(request.prompt, request.memories);
      await this.costController.record({
        provider: "mock",
        model: "mock-hinglish-fallback",
        prompt: request.prompt,
        output,
        fallbackUsed: true,
      });
      return output;
    }

    try {
      const output = await this.callGemini(request);
      await this.costController.record({
        provider: "gemini",
        model: "gemini-1.5-flash",
        prompt: request.prompt,
        output,
        fallbackUsed: false,
      });
      return output;
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      const fallback = this.mockResponse(request.prompt, request.memories);
      const output = `Gemini se connect nahi ho paaya (${message}). Fallback active: ${fallback}`;
      await this.costController.record({
        provider: "mock",
        model: "mock-hinglish-fallback",
        prompt: request.prompt,
        output,
        fallbackUsed: true,
      });
      return output;
    }
  }

  private async callGemini(request: AiRouteRequest): Promise<string> {
    const endpoint =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";
    const context = [
      "You are SADIYA, a powerful Hinglish desktop AI OS assistant.",
      "Be concise, helpful, and action-oriented.",
      "Never claim a local action was done unless the execution engine did it.",
      request.screen
        ? `Screen is shared. Current visible context: ${request.screen.summary}. Use it when answering the user's screen-related command.`
        : "Screen is not currently shared.",
      request.memories.length
        ? `Known memories:\n${request.memories.map((item) => `- ${item.value}`).join("\n")}`
        : "No saved memories yet.",
    ].join("\n");

    const recent = request.messages.slice(-8).map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    }));

    const response = await fetch(`${endpoint}?key=${this.runtimeApiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: context }],
        },
        contents: [...recent, { role: "user", parts: this.createGeminiParts(request) }],
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;

    return text?.trim() || "Gemini ne empty response diya.";
  }

  private mockResponse(prompt: string, memories: MemoryItem[]): string {
    const lower = prompt.toLowerCase();

    if (lower.includes("hello") || lower.includes("hi") || lower.includes("sadiya")) {
      return "Main SADIYA hoon — aapki AI OS assistant. Main chat, voice, memory, web search, file search aur safe PC commands handle kar sakti hoon.";
    }

    if (lower.includes("agent") || lower.includes("architecture")) {
      return "SADIYA ka core multi-agent architecture hai: Planner, System, File, Web, Memory agents; task queue; execution engine; Gemini router; plugin skeleton.";
    }

    if (memories.length && (lower.includes("remember") || lower.includes("yaad"))) {
      return `Mere paas ${memories.length} saved memories hain. Aap 'kya yaad hai' bolkar dekh sakte hain.`;
    }

    return "Mock brain active hai kyunki Gemini API key abhi set nahi hai. Phir bhi main safe commands, memory, file search, system info, web search aur task routing chala sakti hoon.";
  }

  private createGeminiParts(request: AiRouteRequest): Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> {
    const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [
      {
        text: request.screen
          ? `${request.prompt}\n\nScreen context: ${request.screen.summary}`
          : request.prompt,
      },
    ];

    if (request.screen?.imageDataUrl) {
      const match = request.screen.imageDataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
      if (match) {
        parts.push({
          inlineData: {
            mimeType: match[1],
            data: match[2],
          },
        });
      }
    }

    return parts;
  }
}
