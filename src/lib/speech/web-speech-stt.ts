"use client";

import { SPEECH_LANG, STT_FINAL_TIMEOUT_MS } from "@/config/interview";
import { STTError, type STTHandlers, type STTPort, type STTResult } from "./types";

// TypeScript DOM에 없는 인식 컨트롤러의 최소 타입. 브라우저 타입은 포트 밖으로 노출하지 않는다.
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<{ isFinal: boolean; [index: number]: { transcript: string } }> }) => void) | null;
  onerror: ((event: { error: string; message?: string }) => void) | null;
  onend: (() => void) | null;
  onnomatch: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

function getRecognition(): (new () => Recognition) | undefined {
  if (typeof window === "undefined") return undefined;
  const browser = window as Window & {
    SpeechRecognition?: new () => Recognition;
    webkitSpeechRecognition?: new () => Recognition;
  };
  if (typeof browser.SpeechRecognition === "function") return browser.SpeechRecognition;
  if (typeof browser.webkitSpeechRecognition === "function") return browser.webkitSpeechRecognition;
}

export class WebSpeechSTT implements STTPort {
  private active: { stop: () => void; cancel: () => void } | null = null;
  private completion: Promise<STTResult> | null = null;

  isSupported() {
    return getRecognition() !== undefined;
  }

  stop(): Promise<STTResult> {
    // onFinal/onError가 새 세션을 시작하더라도 이 호출은 원래 세션을 기다린다.
    const completion = this.completion;
    if (!completion) return Promise.reject(new DOMException("시작한 음성 인식이 없어요.", "InvalidStateError"));
    this.active?.stop();
    return completion;
  }

  cancel() {
    this.active?.cancel();
  }

  start(handlers: STTHandlers): void {
    if (this.active) throw new DOMException("이미 답변을 인식하고 있어요.", "InvalidStateError");
    const Constructor = getRecognition();
    if (!Constructor) throw new DOMException("이 브라우저는 음성 인식을 지원하지 않아요.", "NotSupportedError");

    const recognition = new Constructor();
    recognition.lang = SPEECH_LANG;
    recognition.continuous = true;
    recognition.interimResults = true;

    let resolve!: (result: STTResult) => void;
    let reject!: (error: STTError) => void;
    const completion = new Promise<STTResult>((done, fail) => { resolve = done; reject = fail; });
    // 오류가 stop 전에 발생해도 unhandled rejection을 만들지 않는다. stop의 rejection은 유지한다.
    void completion.catch(() => {});
    this.completion = completion;

    let settled = false;
    let stopping = false;
    let transcript = "";
    let timer: ReturnType<typeof setTimeout> | undefined;
    const failure = (code: string, message: string, cause?: unknown) =>
      new STTError(code, message, transcript, { cause });

    const finish = (error?: STTError, abort = false, notify = true) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.onnomatch = null;
      window.removeEventListener("pagehide", cancel);
      this.active = null;
      if (abort) {
        try {
          recognition.abort();
        } catch (cause) {
          error = failure("abort-failed", "음성 인식을 중단하지 못했어요.", cause);
        }
      }
      if (error) {
        reject(error);
        if (notify) handlers.onError?.(error);
      } else {
        resolve({ transcript, empty: transcript.length === 0 });
        handlers.onFinal(transcript);
      }
    };
    const cancel = () => finish(failure("canceled", "음성 인식을 취소했어요."), true);
    this.active = {
      cancel,
      stop: () => {
        if (settled || stopping) return;
        stopping = true;
        timer = setTimeout(() => finish(failure("timeout", "답변의 최종 전사를 기다리는 시간이 초과되었어요."), true), STT_FINAL_TIMEOUT_MS);
        try {
          recognition.stop();
        } catch (cause) {
          finish(failure("stop-failed", "음성 인식을 마치지 못했어요.", cause), true);
        }
      },
    };
    recognition.onresult = ({ results }) => {
      if (settled) return;
      // results는 현재 세션 전체다. append하면 interim 수정/삭제와 반복 이벤트가 중복된다.
      const final: string[] = [];
      const interim: string[] = [];
      for (let index = 0; index < results.length; index++) {
        const result = results[index];
        const text = result[0]?.transcript.trim();
        if (text) (result.isFinal ? final : interim).push(text);
      }
      transcript = final.join(" ");
      handlers.onInterim?.([...final, ...interim].join(" "));
    };
    recognition.onerror = (event) => {
      finish(failure(event.error, event.message || "음성 인식 중 오류가 발생했어요."), true);
    };
    recognition.onnomatch = () => finish(failure("no-match", "답변을 알아듣지 못했어요."), true);
    recognition.onend = () => {
      if (stopping) finish();
      else finish(failure("interrupted", "대답 완료 전에 음성 인식이 종료되었어요."));
    };
    window.addEventListener("pagehide", cancel);
    try {
      recognition.start();
    } catch (cause) {
      const error = failure("start-failed", "음성 인식을 시작하지 못했어요.", cause);
      finish(error, true, false);
      throw error;
    }
  }
}
