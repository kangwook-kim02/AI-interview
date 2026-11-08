"use client";

import type { STTPort, TTSPort } from "./types";
import { WebSpeechSTT } from "./web-speech-stt";
import { WebSpeechTTS } from "./web-speech-tts";

export type { STTHandlers, STTPort, STTResult, TTSPort } from "./types";
export { STTError } from "./types";

export function createTTS(): TTSPort {
  return new WebSpeechTTS();
}

export function createSTT(): STTPort {
  return new WebSpeechSTT();
}
