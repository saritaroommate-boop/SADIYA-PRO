import type { SadiyaApi } from "./types";

declare global {
  interface Window {
    sadiya?: SadiyaApi;
    SpeechRecognition?: typeof SpeechRecognition;
    webkitSpeechRecognition?: typeof SpeechRecognition;
  }

  interface SpeechRecognitionEvent extends Event {
    results: SpeechRecognitionResultList;
  }

  interface SpeechRecognitionErrorEvent extends Event {
    error: string;
  }

  interface SpeechRecognition extends EventTarget {
    lang: string;
    interimResults: boolean;
    maxAlternatives: number;
    start: () => void;
    stop: () => void;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
    onend: (() => void) | null;
  }

  interface SpeechRecognitionConstructor {
    new (): SpeechRecognition;
  }

  const SpeechRecognition: SpeechRecognitionConstructor;
}

export {};
