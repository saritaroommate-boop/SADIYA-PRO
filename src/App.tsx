import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { AgentDefinition, ApiStatus, AppState, ChatMessage, MemoryItem, SadiyaTask, ScreenContext } from "./types";

const fallbackState: AppState = {
  messages: [
    {
      id: "web-fallback",
      role: "assistant",
      content: "Hello! How can I assist you today?",
      createdAt: new Date().toISOString(),
    },
  ],
  tasks: [],
  taskLogs: [],
  memories: [],
  agents: [],
  plugins: [],
  agentEvents: [],
  sharedContext: [],
  audit: [],
  costUsage: [],
  recoveryEvents: [],
};

const navItems = ["Console", "Tasks", "Agents", "Memory", "Files", "Browser", "Plugins", "System", "Settings"];
const waveformBars = Array.from({ length: 52 }, (_, index) => index);
const particles = Array.from({ length: 42 }, (_, index) => index);

interface LiveMetrics {
  battery: number;
  cpu: number;
  disk: number;
  gpu: number;
  net: number;
  ram: number;
  temp: number;
}

const initialMetrics: LiveMetrics = {
  battery: 100,
  cpu: 24,
  disk: 62,
  gpu: 21,
  net: 120,
  ram: 48,
  temp: 48,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

const defaultAgents: AgentDefinition[] = [
  { id: "planner", name: "Planner Agent", description: "Breaking down your goal...", status: "working" },
  { id: "research", name: "Research Agent", description: "Collecting latest AI news...", status: "working" },
  { id: "browser", name: "Browser Agent", description: "Navigating and extracting...", status: "working" },
  { id: "memory", name: "Memory Agent", description: "Storing important context...", status: "idle" },
  { id: "system", name: "System Agent", description: "Monitoring system health...", status: "working" },
];

const defaultMemories = [
  "You prefer responses in Hinglish",
  "Working on SADIYA AI OS Layer",
  "You are a developer and builder",
  "Favorite tools: VS Code, Terminal, Chrome",
  "Project: Build next-gen AI OS",
];

const fallbackApiStatus: ApiStatus = {
  provider: "gemini",
  model: "gemini-1.5-flash",
  configured: false,
  mode: "mock",
  source: "none",
};

function App() {
  const [state, setState] = useState<AppState>(fallbackState);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [screenContext, setScreenContext] = useState<ScreenContext | null>(null);
  const [screenPreview, setScreenPreview] = useState<string | null>(null);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [apiStatus, setApiStatus] = useState<ApiStatus>(fallbackApiStatus);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [apiTestMessage, setApiTestMessage] = useState("Gemini key not configured");
  const [viewport, setViewport] = useState({ width: 1500, height: 900 });
  const [activeNav, setActiveNav] = useState("Console");
  const [metrics, setMetrics] = useState<LiveMetrics>(initialMetrics);
  const messagesRef = useRef<HTMLDivElement>(null);

  const displayAgents = useMemo(() => (state.agents.length >= 5 ? state.agents : defaultAgents), [state.agents]);
  const displayTasks = useMemo(() => state.tasks.slice(0, 5), [state.tasks]);

  useEffect(() => {
    void refreshState();
  }, []);

  useEffect(() => {
    const updateViewport = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };
    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [state.messages]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setMetrics((current) => ({
        battery: clamp(current.battery + (Math.random() < 0.84 ? 0 : -1), 5, 100),
        cpu: Math.round(clamp(current.cpu + (Math.random() - 0.44) * 7, 9, 88)),
        disk: current.disk,
        gpu: Math.round(clamp(current.gpu + (Math.random() - 0.5) * 6, 8, 78)),
        net: Math.round(clamp(current.net + (Math.random() - 0.5) * 24, 40, 260)),
        ram: Math.round(clamp(current.ram + (Math.random() - 0.48) * 4, 24, 86)),
        temp: Math.round(clamp(current.temp + (Math.random() - 0.48) * 2, 42, 72)),
      }));
    }, 3000);

    return () => window.clearInterval(timer);
  }, []);

  const refreshState = async () => {
    if (!window.sadiya) {
      return;
    }
    setState(await window.sadiya.getState());
    if (window.sadiya.getApiStatus) {
      const status = await window.sadiya.getApiStatus();
      setApiStatus(status);
      setApiTestMessage(status.configured ? `Gemini ${status.mode} via ${status.source}` : "Mock fallback active");
    }
  };

  const saveApiKey = async () => {
    if (!window.sadiya?.setApiKey) {
      setApiTestMessage("API bridge unavailable");
      return;
    }
    const result = await window.sadiya.setApiKey(apiKeyInput);
    const status = await window.sadiya.getApiStatus();
    setApiStatus(status);
    setApiKeyInput("");
    setApiTestMessage(result.configured ? "Gemini key loaded for this session" : "Gemini key cleared; mock fallback active");
  };

  const testApi = async () => {
    if (!window.sadiya?.testApi) {
      setApiTestMessage("API bridge unavailable");
      return;
    }
    setApiTestMessage("Testing Gemini...");
    const result = await window.sadiya.testApi();
    setApiTestMessage(result.message);
    setApiStatus(await window.sadiya.getApiStatus());
  };

  const speak = (text: string) => {
    if (!voiceEnabled || !("speechSynthesis" in window)) {
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "hi-IN";
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  };

  const sendMessage = async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed || isSending) {
      return;
    }

    setIsSending(true);
    setInput("");

    if (!window.sadiya) {
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: trimmed,
        createdAt: new Date().toISOString(),
      };
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: screenContext
          ? `Desktop bridge unavailable. Screen context attached: ${screenContext.summary}`
          : "Desktop bridge unavailable.",
        createdAt: new Date().toISOString(),
      };
      setState((current) => ({ ...current, messages: [...current.messages, userMessage, assistantMessage] }));
      speak(assistantMessage.content);
      setIsSending(false);
      return;
    }

    try {
      const response = await window.sadiya.sendMessage({
        content: trimmed,
        screen: screenContext ?? undefined,
      });
      setState(await window.sadiya.getState());
      speak(response.message);
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendMessage(input);
  };

  const startListening = () => {
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) {
      setInput("Voice not supported");
      return;
    }

    const recognition = new Recognition();
    recognition.lang = "hi-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      void sendMessage(transcript);
    };
    recognition.onerror = (event) => {
      setInput(`Voice error: ${event.error}`);
      setIsListening(false);
    };
    recognition.onend = () => setIsListening(false);
    setIsListening(true);
    recognition.start();
  };

  const cancelTask = async (taskId: string) => {
    if (!window.sadiya) {
      return;
    }
    await window.sadiya.cancelTask(taskId);
    await refreshState();
  };

  const shareScreen = async () => {
    if (isSharingScreen) {
      setScreenContext(null);
      setScreenPreview(null);
      setIsSharingScreen(false);
      return;
    }

    try {
      const captured = window.sadiya?.captureScreen
        ? await window.sadiya.captureScreen()
        : await captureBrowserScreen();
      setScreenContext(captured);
      setScreenPreview(captured.imageDataUrl ?? null);
      setIsSharingScreen(true);
      setInput("Screen shared. Ab bolo: is screen me kya dekhna hai?");
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      setInput(`Screen share cancelled: ${message}`);
      setIsSharingScreen(false);
    }
  };

  const chromeOffset = 118;
  const scale = Math.min(viewport.width / 1600, (viewport.height - chromeOffset) / 920, 1);

  return (
    <main className="h-screen overflow-hidden bg-[#030713] text-slate-100">
      <CyberBackground />
      <div
        className="absolute left-1/2 grid h-[920px] w-[1600px] grid-cols-[255px_minmax(860px,1fr)_385px] grid-rows-[64px_minmax(0,1fr)_112px] gap-4 p-5"
        style={{
          top: `${Math.max(4, (viewport.height - chromeOffset - 920 * scale) / 2)}px`,
          transform: `translateX(-50%) scale(${scale})`,
          transformOrigin: "top center",
        }}
      >
        <TopChrome />
        <LeftRail
          isListening={isListening}
          isSharingScreen={isSharingScreen}
          voiceEnabled={voiceEnabled}
          activeNav={activeNav}
          onListen={startListening}
          onNavChange={setActiveNav}
          onShareScreen={shareScreen}
          onToggleVoice={() => setVoiceEnabled((enabled) => !enabled)}
          onQuickCommand={sendMessage}
          metrics={metrics}
        />
        <main className="col-start-2 row-start-2 grid min-h-0 grid-rows-[140px_320px_175px] gap-3">
          <HeroPanel onQuickCommand={sendMessage} />
          <AICoreStage isSharingScreen={isSharingScreen} screenPreview={screenPreview} />
          <div className="grid min-h-0 grid-cols-[0.9fr_1fr] gap-4">
            <ConsolePanel messages={state.messages} messagesRef={messagesRef} />
            <TaskTimeline tasks={displayTasks} onCancelTask={cancelTask} />
          </div>
        </main>
        <RightStack
          agents={displayAgents}
          apiKeyInput={apiKeyInput}
          apiStatus={apiStatus}
          apiTestMessage={apiTestMessage}
          memories={state.memories}
          onApiKeyChange={setApiKeyInput}
          onSaveApiKey={saveApiKey}
          onTestApi={testApi}
          metrics={metrics}
        />
        <CommandDock
          input={input}
          isSending={isSending}
          onInputChange={setInput}
          onQuickCommand={sendMessage}
          onShareScreen={shareScreen}
          onSubmit={handleSubmit}
          screenShared={isSharingScreen}
        />
      </div>
    </main>
  );
}

function CyberBackground() {
  return (
    <>
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_48%_35%,rgba(0,112,255,0.20),transparent_24rem),radial-gradient(circle_at_18%_72%,rgba(122,92,255,0.22),transparent_28rem),linear-gradient(135deg,#040713,#06101f_48%,#02040c)]" />
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(0,234,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(0,106,255,0.035)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(circle_at_center,black,transparent_80%)]" />
      {particles.map((particle) => (
        <motion.span
          animate={{ opacity: [0.08, 0.75, 0.08], x: [0, (particle % 5) * 8 - 18, 0] }}
          className="pointer-events-none fixed h-0.5 w-0.5 rounded-full bg-[#00eaff] shadow-[0_0_12px_#00eaff]"
          key={particle}
          style={{ left: `${4 + ((particle * 23) % 92)}%`, top: `${5 + ((particle * 31) % 88)}%` }}
          transition={{ duration: 5 + (particle % 7), repeat: Infinity, delay: particle * 0.12 }}
        />
      ))}
    </>
  );
}

async function captureBrowserScreen(): Promise<ScreenContext> {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    throw new Error("Not supported");
  }

  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: true,
    audio: false,
  });
  const track = stream.getVideoTracks()[0];
  const video = document.createElement("video");
  video.srcObject = stream;
  video.muted = true;
  await video.play();
  await new Promise<void>((resolve) => {
    if (video.readyState >= 2) {
      resolve();
      return;
    }
    video.onloadeddata = () => resolve();
  });

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth || 1280;
  canvas.height = video.videoHeight || 720;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas unavailable");
  }
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  video.pause();
  video.srcObject = null;
  track.stop();

  return {
    imageDataUrl: canvas.toDataURL("image/png"),
    summary: `Screen shared from ${track.label || "desktop"}`,
    capturedAt: new Date().toISOString(),
  };
}

function TopChrome() {
  return (
    <header className="col-start-1 col-end-4 row-start-1 grid grid-cols-[235px_1fr_320px] items-center gap-4">
      <div className="flex items-center gap-3 pl-2">
        <motion.div
          animate={{ rotate: 360, boxShadow: ["0 0 18px #00eaff", "0 0 34px #7a5cff", "0 0 18px #00eaff"] }}
          className="grid h-12 w-12 place-items-center rounded-full border border-[#00eaff]/45 bg-[conic-gradient(from_90deg,#00eaff,#7a5cff,#00eaff)] text-lg font-black text-[#04101d]"
          transition={{ rotate: { duration: 15, ease: "linear", repeat: Infinity }, boxShadow: { duration: 2.4, repeat: Infinity } }}
        >
          ◈
        </motion.div>
        <div>
          <h1 className="text-lg font-black uppercase tracking-[0.1em]">SADIYA</h1>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-200">AI OS Layer</p>
        </div>
      </div>
      <div className="relative text-center">
        <div className="mx-auto h-px w-[72%] bg-gradient-to-r from-transparent via-[#00eaff] to-transparent" />
        <p className="mt-1.5 text-[11px] font-black uppercase tracking-[0.42em] text-blue-300">SADIYA AI OS LAYER</p>
      </div>
      <div className="flex items-center justify-end gap-5 pr-2">
        <div className="cyber-pill flex items-center gap-3 px-5 py-2 text-[11px] text-blue-200">
          <span>⌁</span>
          <span>🛡</span>
          <span className="flex items-center gap-2 text-emerald-300"><span className="h-2 w-2 rounded-full bg-emerald-300" />Online</span>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black tracking-tight">11:47 PM</div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-blue-300/70">May 1, 2026</div>
        </div>
      </div>
    </header>
  );
}

function LeftRail({
  activeNav,
  isListening,
  isSharingScreen,
  metrics,
  voiceEnabled,
  onListen,
  onNavChange,
  onShareScreen,
  onToggleVoice,
  onQuickCommand,
}: {
  activeNav: string;
  isListening: boolean;
  isSharingScreen: boolean;
  metrics: LiveMetrics;
  voiceEnabled: boolean;
  onListen: () => void;
  onNavChange: (item: string) => void;
  onShareScreen: () => Promise<void>;
  onToggleVoice: () => void;
  onQuickCommand: (content: string) => Promise<void>;
}) {
  return (
    <aside className="col-start-1 row-start-2 grid min-h-0 grid-rows-[82px_minmax(0,1fr)_300px_72px] gap-4">
      <Panel className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <motion.div
            animate={{ scale: [1, 1.08, 1] }}
            className="grid h-12 w-12 place-items-center rounded-full border border-[#00eaff]/45 bg-[#00eaff]/10 text-xl text-[#00eaff] shadow-[0_0_24px_rgba(0,234,255,0.35)]"
            transition={{ duration: 2.2, repeat: Infinity }}
          >
            ◌
          </motion.div>
          <div>
            <h2 className="text-base font-black uppercase tracking-[0.08em]">SADIYA</h2>
            <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />Online</p>
          </div>
        </div>
        <span className="text-2xl text-blue-300">›</span>
      </Panel>
      <Panel className="overflow-hidden p-0">
        {navItems.map((item) => (
          <motion.button
            className={`nav-row flex w-full items-center gap-3 border-b border-blue-400/10 px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.16em] transition ${activeNav === item ? "nav-row-active text-white" : "text-slate-400 hover:bg-cyan-300/6 hover:text-cyan-100"}`}
            key={item}
            onClick={() => {
              onNavChange(item);
              if (item === "Console") void onQuickCommand("kuch kaam kar do");
              if (item === "Tasks") void onQuickCommand("system info");
              if (item === "Agents") void onQuickCommand("agents status");
              if (item === "Memory") void onQuickCommand("kya yaad hai");
              if (item === "Files") void onQuickCommand("file dhundo");
              if (item === "Browser") void onQuickCommand("open browser");
              if (item === "Plugins") void onQuickCommand("plugin status");
              if (item === "System") void onQuickCommand("system info");
              if (item === "Settings") void onQuickCommand("settings");
            }}
            type="button"
            whileHover={{ x: 4 }}
          >
            <span className="text-[#00eaff]">{navIcon(item)}</span>
            {item}
          </motion.button>
        ))}
      </Panel>
      <Panel className="grid place-items-center p-3 text-center">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-[#00eaff]">Voice Active</p>
        <Waveform active={isListening} className="mt-3 h-7" />
        <button className="relative my-4 grid h-30 w-30 place-items-center rounded-full" onClick={onListen} type="button">
          <motion.span animate={{ rotate: 360 }} className="absolute inset-0 rounded-full border border-[#00eaff]/35" transition={{ duration: 8, ease: "linear", repeat: Infinity }} />
          <motion.span animate={{ rotate: -360 }} className="absolute inset-4 rounded-full border border-[#7a5cff]/40" transition={{ duration: 6, ease: "linear", repeat: Infinity }} />
          <motion.span animate={{ scale: [1, 1.08, 1] }} className="grid h-20 w-20 place-items-center rounded-full bg-[radial-gradient(circle,#ffe7ff_0_8%,#b06cff_12%,#083779_72%)] text-4xl shadow-[0_0_44px_rgba(122,92,255,0.65)]" transition={{ duration: 1.6, repeat: Infinity }}>
            ♬
          </motion.span>
        </button>
        <button className="text-xs text-slate-400" onClick={onToggleVoice} type="button">
          {voiceEnabled ? (isListening ? "Listening..." : "Tap to speak") : "Voice muted"}
        </button>
        <button className={`cyber-chip mt-3 ${isSharingScreen ? "active" : ""}`} onClick={() => void onShareScreen()} type="button">
          {isSharingScreen ? "Screen Shared" : "Share Screen"}
        </button>
      </Panel>
      <div className="grid grid-cols-[0.7fr_1.35fr_0.8fr] gap-3">
        <MiniStat label="Temp" value={`${metrics.temp}°C`} />
        <MiniStat label="Net" value={`${metrics.net} Mbps`} accent />
        <MiniStat label="Battery" value={`${metrics.battery}%`} />
      </div>
    </aside>
  );
}

function HeroPanel({ onQuickCommand }: { onQuickCommand: (content: string) => Promise<void> }) {
  return (
    <Panel className="grid place-items-center px-8 py-4 text-center">
      <Waveform active className="mb-2 h-6 w-52" />
      <h2 className="text-2xl font-black tracking-tight text-white">
        Good Evening, I&apos;m <span className="text-[#a855f7] drop-shadow-[0_0_18px_rgba(168,85,247,0.9)]">SADIYA</span>
      </h2>
      <p className="mt-1 text-xs text-blue-200/70">AI OS companion — automate, see, execute.</p>
      <div className="mt-3 flex justify-center gap-2">
        {[
          ["What&apos;s on my schedule?", "kya yaad hai"],
          ["Analyze this for me", "kuch kaam kar do"],
          ["Open research mode", "search latest AI news"],
          ["System status", "system info"],
        ].map(([label, command]) => (
          <button className="cyber-chip" key={command} onClick={() => void onQuickCommand(command)} type="button">
            ◈ {label}
          </button>
        ))}
      </div>
    </Panel>
  );
}

function AICoreStage({ isSharingScreen, screenPreview }: { isSharingScreen: boolean; screenPreview: string | null }) {
  return (
    <section className="relative grid place-items-center overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,234,255,0.18),transparent_18rem)]" />
      <div className="relative h-[320px] w-[860px]">
        <div className="absolute inset-x-[170px] top-4 h-px bg-gradient-to-r from-transparent via-[#00eaff] to-transparent opacity-70" />
        <div className="absolute inset-x-[210px] bottom-4 h-px bg-gradient-to-r from-transparent via-[#7a5cff] to-transparent opacity-70" />
        {[0, 1, 2, 3].map((ring) => (
          <motion.div
            animate={{ rotate: ring % 2 ? -360 : 360 }}
            className="absolute rounded-full border border-[#00eaff]/20 shadow-[0_0_34px_rgba(0,234,255,0.12)]"
            key={ring}
            style={{ inset: `${18 + ring * 24}px ${270 + ring * 24}px` }}
            transition={{ duration: 22 - ring * 4, ease: "linear", repeat: Infinity }}
          >
            <span className="absolute left-1/2 top-[-4px] h-2 w-2 rounded-full bg-[#00eaff] shadow-[0_0_18px_#00eaff]" />
          </motion.div>
        ))}
        {[0, 1].map((ring) => (
          <motion.div
            animate={{ rotate: ring ? -360 : 360, opacity: [0.25, 0.55, 0.25] }}
            className="absolute rounded-full border border-dashed border-blue-300/25"
            key={`dash-${ring}`}
            style={{ inset: `${70 + ring * 30}px ${314 + ring * 30}px` }}
            transition={{ duration: 10 + ring * 4, ease: "linear", repeat: Infinity }}
          />
        ))}
        <EnergyCore isSharingScreen={isSharingScreen} screenPreview={screenPreview} />
        <CoreNode label="Think" icon="◉" side="left" top="92px" />
        <CoreNode label="Search" icon="⌕" side="left" top="190px" />
        <CoreNode label="Execute" icon="▷" side="right" top="92px" />
        <CoreNode label="Vision" icon="◈" side="right" top="190px" />
      </div>
    </section>
  );
}

function CoreNode({ label, icon, side, top }: { label: string; icon: string; side: "left" | "right"; top: string }) {
  return (
    <motion.div
      className={`absolute flex items-center gap-3 ${side === "left" ? "left-8 flex-row-reverse" : "right-8"}`}
      style={{ top }}
      whileHover={{ scale: 1.06 }}
    >
      <span className="h-px w-20 bg-gradient-to-r from-[#00eaff] to-transparent" />
      <span className="grid h-10 w-10 place-items-center rounded-full border border-[#00eaff]/38 bg-blue-500/14 text-lg text-cyan-100 shadow-[0_0_24px_rgba(0,234,255,0.22)]">{icon}</span>
      <span className="rounded-full border border-blue-400/14 bg-black/24 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-200 backdrop-blur-xl">{label}</span>
    </motion.div>
  );
}

function EnergyCore({ isSharingScreen, screenPreview }: { isSharingScreen: boolean; screenPreview: string | null }) {
  return (
    <motion.div
      animate={{
        scale: [1, 1.035, 1],
        filter: ["brightness(1)", "brightness(1.32)", "brightness(1)"],
      }}
      className="absolute left-1/2 top-1 h-[318px] w-[318px] -translate-x-1/2"
      transition={{ duration: 3.1, repeat: Infinity }}
    >
      <motion.div
        animate={{ opacity: [0.22, 0.62, 0.22], scale: [0.9, 1.18, 0.9] }}
        className="absolute -inset-20 rounded-full bg-[radial-gradient(circle,rgba(0,234,255,0.23),rgba(122,92,255,0.12)_36%,transparent_67%)] blur-xl"
        transition={{ duration: 3.8, repeat: Infinity }}
      />
      <motion.div
        animate={{ rotate: 360 }}
        className="absolute inset-0 rounded-full border border-[#00eaff]/32 bg-[conic-gradient(from_90deg,transparent,#00eaff35,transparent,#7a5cff50,transparent)] shadow-[0_0_100px_rgba(0,234,255,0.28)]"
        transition={{ duration: 18, ease: "linear", repeat: Infinity }}
      />
      <motion.div
        animate={{ rotate: -360 }}
        className="absolute inset-7 rounded-full border border-dashed border-purple-300/28"
        transition={{ duration: 12, ease: "linear", repeat: Infinity }}
      />
      <motion.div
        animate={{ opacity: [0.36, 0.86, 0.36], scale: [0.92, 1.05, 0.92] }}
        className="absolute inset-[74px] rounded-full bg-[radial-gradient(circle,#f8ffff_0_3%,#00eaff_8%,#1266ff_34%,#7a5cff55_58%,transparent_72%)] shadow-[0_0_100px_rgba(0,234,255,0.82),0_0_150px_rgba(122,92,255,0.38)]"
        transition={{ duration: 2.8, repeat: Infinity }}
      />
      <div className="absolute left-1/2 top-1/2 h-[360px] w-px -translate-x-1/2 -translate-y-1/2 bg-gradient-to-b from-transparent via-[#00eaff]/55 to-transparent shadow-[0_0_18px_#00eaff]" />
      <div className="absolute left-1/2 top-1/2 h-px w-[430px] -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-transparent via-[#00eaff]/45 to-transparent" />
      <motion.div
        animate={{ rotateX: [58, 64, 58], rotateZ: 360 }}
        className="absolute left-1/2 top-1/2 h-24 w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border border-[#00eaff]/28"
        transition={{ rotateZ: { duration: 16, ease: "linear", repeat: Infinity }, rotateX: { duration: 3, repeat: Infinity } }}
      />
      {Array.from({ length: 18 }, (_, index) => (
        <motion.span
          animate={{
            rotate: 360,
            opacity: [0.2, 0.95, 0.2],
          }}
          className="absolute left-1/2 top-1/2 h-2 w-2 rounded-full bg-[#00eaff] shadow-[0_0_18px_#00eaff]"
          key={index}
          style={{ transformOrigin: `${88 + (index % 5) * 18}px ${82 + (index % 4) * 15}px` }}
          transition={{ duration: 6 + index * 0.55, ease: "linear", repeat: Infinity, delay: index * 0.08 }}
        />
      ))}
      {screenPreview ? (
        <div className="absolute bottom-8 left-1/2 w-44 -translate-x-1/2 overflow-hidden rounded-2xl border border-emerald-300/45 bg-black/50 p-1 shadow-[0_0_28px_rgba(34,255,156,0.25)] backdrop-blur-xl">
          <img alt="Shared screen preview" className="h-16 w-full rounded-xl object-cover opacity-80" src={screenPreview} />
          <p className="py-1 text-center text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">Screen linked</p>
        </div>
      ) : null}
      <div className="absolute bottom-[-14px] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-[#00eaff]/25 bg-black/32 px-6 py-1.5 text-[9px] font-black uppercase tracking-[0.28em] text-[#00eaff] backdrop-blur-xl">
        {isSharingScreen ? "VISION MODE ACTIVE" : "SADIYA CORE ACTIVE"}
      </div>
    </motion.div>
  );
}

function ConsolePanel({ messages, messagesRef }: { messages: ChatMessage[]; messagesRef: React.RefObject<HTMLDivElement | null> }) {
  const displayMessages = messages.length > 1 ? messages.slice(-4) : [
    messages[0],
    { id: "mock-user", role: "user" as const, content: "Open Chrome and search latest AI news", createdAt: new Date().toISOString() },
    { id: "mock-task", role: "assistant" as const, content: "Opening Chrome and searching for latest AI news...", createdAt: new Date().toISOString() },
  ];
  return (
    <Panel className="flex min-h-0 flex-col p-4">
      <PanelTitle title="Console" />
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1" ref={messagesRef}>
        {displayMessages.map((message, index) => (
          <article className="rounded-2xl border border-blue-400/10 bg-blue-950/22 p-3" key={message.id}>
            <div className="mb-1 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.14em]">
              <span className={message.role === "assistant" ? "text-[#a855f7]" : "text-[#00eaff]"}>{message.role === "assistant" ? "SADIYA" : "YOU"}</span>
              <span className="text-slate-500">11:{45 + index} PM</span>
            </div>
            <p className="line-clamp-2 text-xs leading-5 text-slate-300">{message.content}</p>
          </article>
        ))}
      </div>
      <Waveform active className="mt-3 h-7" />
    </Panel>
  );
}

function TaskTimeline({ tasks, onCancelTask }: { tasks: SadiyaTask[]; onCancelTask: (taskId: string) => Promise<void> }) {
  const defaults: SadiyaTask[] = [
    { id: "research", title: "Research latest AI news", agent: "Research", status: "running", attempts: 1, maxRetries: 1, createdAt: "", updatedAt: "" },
    { id: "chrome", title: "Open Chrome Browser", agent: "Browser", status: "completed", attempts: 1, maxRetries: 1, createdAt: "", updatedAt: "" },
    { id: "system", title: "System Information", agent: "System", status: "completed", attempts: 1, maxRetries: 1, createdAt: "", updatedAt: "" },
    { id: "files", title: "Search PDF files in Home", agent: "Files", status: "completed", attempts: 1, maxRetries: 1, createdAt: "", updatedAt: "" },
    { id: "memory", title: "Memory Recall", agent: "Memory", status: "completed", attempts: 1, maxRetries: 1, createdAt: "", updatedAt: "" },
  ];
  const display = tasks.length ? tasks : defaults;
  return (
    <Panel className="min-h-0 p-4">
      <div className="flex items-center justify-between">
        <PanelTitle title="Task Timeline" />
        <span className="flex items-center gap-2 text-xs text-emerald-300"><span className="h-2 w-2 rounded-full bg-emerald-300" />Live</span>
      </div>
      <div className="space-y-3">
        {display.slice(0, 5).map((task, index) => {
          const canCancel = tasks.length > 0 && ["queued", "running", "retrying"].includes(task.status);
          const progress = task.status === "completed" ? 100 : task.status === "failed" ? 100 : 80;
          return (
            <article className="grid grid-cols-[48px_34px_1fr_auto] items-center gap-3" key={task.id}>
              <span className="text-xs text-slate-400">11:{47 - index}</span>
              <span className="grid h-8 w-8 place-items-center rounded-xl border border-[#00eaff]/22 bg-cyan-400/10 text-[#00eaff]">⌕</span>
              <div>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="truncate text-slate-200">{task.title}</span>
                  <span className="ml-2 text-xs text-slate-400">{task.status === "running" ? `${progress}%` : ""}</span>
                </div>
                <div className="h-0.5 overflow-hidden rounded-full bg-white/10">
                  <motion.div animate={{ width: `${progress}%` }} className="h-full bg-gradient-to-r from-[#00eaff] to-[#7a5cff] shadow-[0_0_12px_#00eaff]" />
                </div>
              </div>
              <button className={task.status === "completed" ? "text-xs font-bold text-emerald-300" : "text-xs font-bold text-[#00eaff]"} disabled={!canCancel} onClick={() => canCancel && void onCancelTask(task.id)} type="button">
                {canCancel ? "Cancel" : task.status === "completed" ? "✓ Completed" : task.status}
              </button>
            </article>
          );
        })}
      </div>
    </Panel>
  );
}

function RightStack({
  agents,
  apiKeyInput,
  apiStatus,
  apiTestMessage,
  metrics,
  memories,
  onApiKeyChange,
  onSaveApiKey,
  onTestApi,
}: {
  agents: AgentDefinition[];
  apiKeyInput: string;
  apiStatus: ApiStatus;
  apiTestMessage: string;
  metrics: LiveMetrics;
  memories: MemoryItem[];
  onApiKeyChange: (value: string) => void;
  onSaveApiKey: () => Promise<void>;
  onTestApi: () => Promise<void>;
}) {
  return (
    <aside className="col-start-3 row-start-2 grid min-h-0 grid-rows-[168px_190px_235px_minmax(0,1fr)] gap-4">
      <SystemOverview metrics={metrics} />
      <ApiPanel
        apiKeyInput={apiKeyInput}
        apiStatus={apiStatus}
        apiTestMessage={apiTestMessage}
        onApiKeyChange={onApiKeyChange}
        onSaveApiKey={onSaveApiKey}
        onTestApi={onTestApi}
      />
      <ActiveAgents agents={agents} />
      <MemorySnapshot memories={memories} />
    </aside>
  );
}

function ApiPanel({
  apiKeyInput,
  apiStatus,
  apiTestMessage,
  onApiKeyChange,
  onSaveApiKey,
  onTestApi,
}: {
  apiKeyInput: string;
  apiStatus: ApiStatus;
  apiTestMessage: string;
  onApiKeyChange: (value: string) => void;
  onSaveApiKey: () => Promise<void>;
  onTestApi: () => Promise<void>;
}) {
  return (
    <Panel className="p-3">
      <div className="flex items-center justify-between">
        <PanelTitle title="API System" />
        <span className={apiStatus.configured ? "status-badge active" : "status-badge"}>
          {apiStatus.mode}
        </span>
      </div>
      <div className="rounded-2xl border border-[#00eaff]/18 bg-[radial-gradient(circle_at_top_left,rgba(0,234,255,0.12),transparent_9rem),rgba(0,0,0,0.28)] p-3 shadow-[inset_0_0_28px_rgba(0,234,255,0.06)]">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="flex items-center gap-2 font-black uppercase tracking-[0.16em] text-[#00eaff]">
            <span className={`h-2 w-2 rounded-full ${apiStatus.configured ? "bg-emerald-300 shadow-[0_0_14px_#22ff9c]" : "bg-amber-300 shadow-[0_0_14px_#fbbf24]"}`} />
            Gemini API
          </span>
          <span className="rounded-full border border-blue-300/15 bg-blue-300/8 px-2 py-0.5 text-[10px] text-blue-100/75">{apiStatus.provider}</span>
        </div>
        <div className="mb-2 flex items-center justify-between rounded-xl border border-blue-300/10 bg-blue-950/18 px-3 py-2 text-[10px]">
          <span className="text-slate-400">Model</span>
          <span className="font-bold text-blue-100">{apiStatus.model}</span>
        </div>
        <div className="flex gap-1.5">
          <input
            className="min-w-0 flex-1 rounded-full border border-blue-400/20 bg-blue-950/25 px-3 py-2 text-xs text-white outline-none placeholder:text-slate-600 focus:border-[#00eaff]/70"
            onChange={(event) => onApiKeyChange(event.target.value)}
            placeholder="Gemini API key"
            type="password"
            value={apiKeyInput}
          />
          <button className="cyber-chip px-3" onClick={() => void onSaveApiKey()} type="button">Save</button>
          <button className="cyber-chip px-3" onClick={() => void onTestApi()} type="button">Test</button>
        </div>
        <p className="mt-2 line-clamp-2 text-[11px] leading-4 text-blue-100/70">{apiTestMessage}</p>
      </div>
    </Panel>
  );
}

function SystemOverview({ metrics }: { metrics: LiveMetrics }) {
  const systemStats = [
    { label: "CPU", value: metrics.cpu, sub: "Live load", color: "#00eaff" },
    { label: "RAM", value: metrics.ram, sub: "Memory", color: "#7a5cff" },
    { label: "DISK", value: metrics.disk, sub: "Storage", color: "#87e65a" },
    { label: "GPU", value: metrics.gpu, sub: "Graphics", color: "#3487ff" },
  ];

  return (
    <Panel className="p-3">
      <PanelTitle title="System Overview" />
      <div className="mt-2 grid grid-cols-4 gap-2">
        {systemStats.map((stat) => (
          <div className="text-center" key={stat.label}>
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{stat.label}</p>
            <div className="relative mx-auto grid h-12 w-12 place-items-center rounded-full border-[5px] border-blue-950/90" style={{ boxShadow: `0 0 18px ${stat.color}33` }}>
              <div className="absolute inset-[-6px] rounded-full" style={{ background: `conic-gradient(${stat.color} ${stat.value}%, rgba(15,23,42,0.25) 0)` }} />
              <div className="absolute inset-[3px] rounded-full bg-[#071124]" />
              <strong className="relative text-sm">{stat.value}%</strong>
            </div>
            <p className="mt-1 truncate text-[9px] text-blue-200/70">{stat.sub}</p>
          </div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 border-t border-blue-400/12 pt-2 text-[9px] text-slate-300">
        <span>OS: Ubuntu 24.04 LTS</span>
        <span>Uptime: 3h 42m</span>
        <span className="text-emerald-300">Status: Optimal</span>
      </div>
    </Panel>
  );
}

function ActiveAgents({ agents }: { agents: AgentDefinition[] }) {
  const activeCount = agents.filter((agent) => agent.status === "working").length;

  return (
    <Panel className="p-3">
      <div className="flex items-center justify-between">
        <PanelTitle title="Active Agents" />
        <span className="rounded-full border border-blue-400/20 bg-blue-400/10 px-2 py-0.5 text-xs text-blue-200">{activeCount}/{agents.length}</span>
      </div>
      <div className="space-y-2">
        {agents.slice(0, 5).map((agent) => (
          <article className="grid grid-cols-[38px_1fr_auto] items-center gap-2 border-b border-blue-400/10 py-1.5" key={agent.id}>
            <span className="grid h-9 w-9 place-items-center rounded-xl border border-[#00eaff]/25 bg-cyan-300/10 text-[#00eaff]">✣</span>
            <div className="min-w-0">
              <strong className="block truncate text-xs">{agent.name}</strong>
              <p className="truncate text-[10px] text-blue-200/60">{agent.description}</p>
            </div>
            <span className={agent.status === "working" ? "status-badge active" : "status-badge"}>{agent.status === "working" ? "active" : "idle"}</span>
          </article>
        ))}
      </div>
    </Panel>
  );
}

function MemorySnapshot({ memories }: { memories: MemoryItem[] }) {
  const display = memories.length ? memories.map((memory) => memory.value) : defaultMemories;
  return (
    <Panel className="p-3">
      <div className="flex items-center justify-between">
        <PanelTitle title="Memory Snapshot" />
        <button className="text-[10px] text-blue-300" type="button">View All</button>
      </div>
      <div className="space-y-1">
        {display.slice(0, 5).map((memory, index) => (
          <div className="grid grid-cols-[30px_1fr_auto] items-center gap-2 border-b border-blue-400/10 py-1.5 text-xs" key={`${memory}-${index}`}>
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-blue-400/10 text-blue-200">⌘</span>
            <span className="truncate text-slate-200">{memory}</span>
            <span className="text-[10px] text-slate-500">{index < 2 ? "Today" : index < 4 ? "Yesterday" : "2d"}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function CommandDock({
  input,
  isSending,
  onInputChange,
  onQuickCommand,
  onShareScreen,
  onSubmit,
  screenShared,
}: {
  input: string;
  isSending: boolean;
  onInputChange: (value: string) => void;
  onQuickCommand: (content: string) => Promise<void>;
  onShareScreen: () => Promise<void>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  screenShared: boolean;
}) {
  return (
    <section className="col-start-2 row-start-3 self-end px-[14%] pb-2">
      <Panel className="p-3 shadow-[0_0_38px_rgba(122,92,255,0.35)]">
        <form className="flex gap-3" onSubmit={onSubmit}>
          <input className="min-w-0 flex-1 rounded-full border border-purple-400/35 bg-black/30 px-6 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-[#00eaff]/70" onChange={(event) => onInputChange(event.target.value)} placeholder="Type a command or ask anything..." value={input} />
          <button className="grid h-14 w-14 place-items-center rounded-full border border-[#00eaff]/50 bg-blue-600 text-xl shadow-[0_0_28px_rgba(0,106,255,0.55)]" disabled={isSending} type="submit">{isSending ? "…" : "➤"}</button>
        </form>
        <div className="mt-2 flex justify-center gap-2">
          {[
            ["Open Terminal", "open terminal"],
            ["System Info", "system info"],
            ["Search Files", "file dhundo"],
            ["Take Screenshot", "take screenshot"],
            ["New Task", "kuch kaam kar do"],
          ].map(([label, command]) => (
            <button className="cyber-chip" key={command} onClick={() => void onQuickCommand(command)} type="button">▣ {label}</button>
          ))}
          <button className={`cyber-chip ${screenShared ? "active" : ""}`} onClick={() => void onShareScreen()} type="button">
            ◉ {screenShared ? "Stop Share" : "Share Screen"}
          </button>
        </div>
      </Panel>
    </section>
  );
}

function Waveform({ active, className = "" }: { active: boolean; className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-0.5 ${className}`}>
      {waveformBars.map((bar) => (
        <motion.span
          animate={{ height: active ? [3, 8 + (bar % 9) * 2, 3] : [3, 5, 3], opacity: [0.35, 1, 0.35] }}
          className="w-0.5 rounded-full bg-[#00eaff] shadow-[0_0_8px_#00eaff]"
          key={bar}
          transition={{ duration: 0.75 + (bar % 5) * 0.04, repeat: Infinity, delay: bar * 0.015 }}
        />
      ))}
    </div>
  );
}

function PanelTitle({ title }: { title: string }) {
  return <h3 className="mb-3 text-base font-black uppercase tracking-[0.08em] text-white drop-shadow-[0_0_10px_rgba(122,92,255,0.45)]">{title}</h3>;
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.section
      className={`cyber-panel ${className}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      whileHover={{ boxShadow: "0 0 44px rgba(0,234,255,0.16), 0 0 22px rgba(122,92,255,0.16)" }}
    >
      {children}
    </motion.section>
  );
}

function MiniStat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <Panel className="px-3 py-2">
      <span className="block text-[10px] font-black uppercase tracking-[0.16em] text-blue-300">{label}</span>
      <strong className="text-sm text-white">{value}</strong>
      {accent ? <Waveform active className="absolute bottom-2 right-3 h-4 w-20 opacity-70" /> : null}
    </Panel>
  );
}

function navIcon(item: string) {
  const icons: Record<string, string> = {
    Console: "⌘",
    Tasks: "▣",
    Agents: "♙",
    Memory: "▤",
    Files: "□",
    Browser: "✥",
    Plugins: "✣",
    System: "⚙",
    Settings: "⚙",
  };
  return icons[item] ?? "•";
}

export default App;
