"use client";

import type { TTSPort } from "./types";
import { WebSpeechTTS } from "./web-speech-tts";

export type { TTSPort } from "./types";

export function createTTS(): TTSPort {
  return new WebSpeechTTS();
}
