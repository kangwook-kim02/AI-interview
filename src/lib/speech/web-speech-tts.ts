"use client";

import { SPEECH_LANG, TTS_SAFETY_TIMEOUT_MS } from "@/config/interview";
import type { TTSPort } from "./types";

// Web Speech 큐는 전역이다. 인스턴스가 달라도 질문은 하나만 재생한다.
let cancelActivePlayback: (() => void) | null = null;

export class WebSpeechTTS implements TTSPort {
  private cancelPlayback: (() => void) | null = null;

  isSupported() {
    return typeof window !== "undefined" &&
      typeof window.SpeechSynthesisUtterance === "function" &&
      typeof window.speechSynthesis?.speak === "function" &&
      typeof window.speechSynthesis?.cancel === "function" &&
      typeof window.speechSynthesis?.resume === "function";
  }

  cancel() {
    this.cancelPlayback?.();
  }

  async speak(text: string, opts?: { lang?: string }): Promise<void> {
    if (!this.isSupported()) {
      throw new DOMException("이 브라우저는 음성 재생을 지원하지 않아요.", "NotSupportedError");
    }
    if (!text.trim()) throw new TypeError("재생할 질문이 비어 있어요.");

    const utterance = new window.SpeechSynthesisUtterance(text);
    utterance.lang = opts?.lang ?? SPEECH_LANG;
    const synthesis = window.speechSynthesis;
    cancelActivePlayback?.();

    return new Promise<void>((resolve, reject) => {
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | undefined;

      const finish = (error?: unknown, stop = false) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        utterance.onend = null;
        utterance.onerror = null;
        window.removeEventListener("pagehide", cancel);
        this.cancelPlayback = null;
        if (cancelActivePlayback === cancel) cancelActivePlayback = null;
        // cancel이 동기적으로 이벤트를 발생시켜도 정리/완료를 반복하지 않는다.
        if (stop) {
          try {
            synthesis.cancel();
          } catch (cancelError) {
            reject(cancelError);
            return;
          }
        }
        if (error !== undefined) reject(error);
        else resolve();
      };
      const cancel = () => finish(new DOMException("음성 재생을 취소했어요.", "AbortError"), true);
      this.cancelPlayback = cancel;
      cancelActivePlayback = cancel;
      utterance.onend = () => finish();
      utterance.onerror = (event) => {
        const aborted = event.error === "canceled" || event.error === "interrupted";
        finish(new DOMException("질문을 음성으로 재생하지 못했어요.", aborted ? "AbortError" : "OperationError"), true);
      };

      try {
        window.addEventListener("pagehide", cancel);
        timer = setTimeout(() => finish(undefined, true), TTS_SAFETY_TIMEOUT_MS);
        // 시작 이벤트도 누락될 수 있어 요청 시점부터 안전 상한을 적용한다.
        synthesis.speak(utterance);
        if (!settled && synthesis.paused) synthesis.resume();
      } catch (error) {
        finish(error, true);
      }
    });
  }
}
