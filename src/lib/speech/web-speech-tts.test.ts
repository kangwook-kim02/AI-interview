import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SPEECH_LANG, TTS_SAFETY_TIMEOUT_MS } from "@/config/interview";
import { createTTS, type TTSPort } from "./index";

class FakeUtterance {
  lang = "";
  onend: (() => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  constructor(readonly text: string) {}
}

const synthesis = {
  paused: false,
  speak: vi.fn<(utterance: FakeUtterance) => void>(),
  cancel: vi.fn(),
  resume: vi.fn(),
};
let browser: EventTarget & {
  speechSynthesis: typeof synthesis;
  SpeechSynthesisUtterance: typeof FakeUtterance;
};
let tts: TTSPort;
let other: TTSPort;

function utterance() {
  return synthesis.speak.mock.lastCall![0];
}

function expectReleased(item: FakeUtterance) {
  expect(item.onend).toBeNull();
  expect(item.onerror).toBeNull();
  expect(vi.getTimerCount()).toBe(0);
  expect(browser.removeEventListener).toHaveBeenCalledWith("pagehide", expect.any(Function));
}

beforeEach(() => {
  vi.useFakeTimers();
  synthesis.paused = false;
  synthesis.speak.mockReset();
  synthesis.cancel.mockReset();
  synthesis.resume.mockReset();
  browser = Object.assign(new EventTarget(), {
    speechSynthesis: synthesis,
    SpeechSynthesisUtterance: FakeUtterance,
  });
  vi.spyOn(browser, "addEventListener");
  vi.spyOn(browser, "removeEventListener");
  vi.stubGlobal("window", browser);
  tts = createTTS();
  other = createTTS();
});

afterEach(() => {
  tts.cancel();
  other.cancel();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("TTS 지원과 재생 계약", () => {
  it("생성·지원 확인은 재생·타이머·이벤트 등록을 하지 않는다", () => {
    expect(tts.isSupported()).toBe(true);
    expect(synthesis.speak).not.toHaveBeenCalled();
    expect(synthesis.cancel).not.toHaveBeenCalled();
    expect(browser.addEventListener).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    tts.cancel();
    expect(synthesis.cancel).not.toHaveBeenCalled();
  });

  it("SSR에서 생성·지원 확인·cancel은 안전하고 speak는 미지원 오류다", async () => {
    vi.stubGlobal("window", undefined);
    const serverTTS = createTTS();
    expect(serverTTS.isSupported()).toBe(false);
    expect(() => serverTTS.cancel()).not.toThrow();
    await expect(serverTTS.speak("지원 동기는 무엇인가요?"))
      .rejects.toMatchObject({ name: "NotSupportedError" });
  });

  it.each(["speechSynthesis", "SpeechSynthesisUtterance"])("%s 없는 환경을 거부한다", async (key) => {
    Object.assign(browser, { [key]: undefined });
    expect(tts.isSupported()).toBe(false);
    await expect(tts.speak("질문")).rejects.toMatchObject({ name: "NotSupportedError" });
    expect(synthesis.speak).not.toHaveBeenCalled();
  });

  it("기본 한국어로 원문을 전달하고 end까지 기다린다", async () => {
    const completed = vi.fn();
    const pending = tts.speak("협업 경험을 설명해 주세요.").then(completed);
    const item = utterance();
    expect(item.text).toBe("협업 경험을 설명해 주세요.");
    expect(item.lang).toBe(SPEECH_LANG);
    await Promise.resolve();
    expect(completed).not.toHaveBeenCalled();
    item.onend!();
    await pending;
    expect(completed).toHaveBeenCalledOnce();
    expectReleased(item);
    browser.dispatchEvent(new Event("pagehide"));
    tts.cancel();
    expect(synthesis.cancel).not.toHaveBeenCalled();
  });

  it("명시한 언어를 사용한다", async () => {
    const pending = tts.speak("Hello", { lang: "en-US" });
    expect(utterance().lang).toBe("en-US");
    utterance().onend!();
    await pending;
  });

  it.each(["", " \n "])("빈 질문(%j)은 재생하지 않는다", async (text) => {
    await expect(tts.speak(text)).rejects.toBeInstanceOf(TypeError);
    expect(synthesis.speak).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("이전 pause 상태가 남아 있어도 재생을 재개한다", async () => {
    synthesis.paused = true;
    const pending = tts.speak("질문");
    expect(synthesis.resume).toHaveBeenCalledOnce();
    utterance().onend!();
    await pending;
  });
});

describe("종료·안전 타임아웃 경합", () => {
  it("시작/종료 이벤트가 없어도 설정 시간에 음성을 중단한 뒤 완료한다", async () => {
    const completed = vi.fn(() => expect(synthesis.cancel).toHaveBeenCalledOnce());
    const pending = tts.speak("질문").then(completed);
    const item = utterance();
    await vi.advanceTimersByTimeAsync(TTS_SAFETY_TIMEOUT_MS - 1);
    expect(completed).not.toHaveBeenCalled();
    expect(synthesis.cancel).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(completed).toHaveBeenCalledOnce();
    expectReleased(item);
  });

  it.each(["end", "timeout"])("%s가 먼저 완료돼도 지연 이벤트는 중복 완료하지 않는다", async (first) => {
    const completed = vi.fn();
    const failed = vi.fn();
    const pending = tts.speak("질문").then(completed, failed);
    const item = utterance();
    const end = item.onend!;
    const error = item.onerror!;
    if (first === "end") {
      await vi.advanceTimersByTimeAsync(TTS_SAFETY_TIMEOUT_MS - 1);
      end();
      await vi.advanceTimersByTimeAsync(1);
    } else {
      await vi.advanceTimersByTimeAsync(TTS_SAFETY_TIMEOUT_MS);
    }
    end();
    error({ error: "synthesis-failed" });
    await pending;
    expect(completed).toHaveBeenCalledOnce();
    expect(failed).not.toHaveBeenCalled();
    expect(synthesis.cancel).toHaveBeenCalledTimes(first === "end" ? 0 : 1);
    expectReleased(item);
  });

  it("브라우저가 speak 안에서 즉시 end를 보내도 정리한다", async () => {
    synthesis.speak.mockImplementationOnce((item) => item.onend!());
    await expect(tts.speak("질문")).resolves.toBeUndefined();
    expectReleased(utterance());
  });
});

describe("취소·오류·페이지 이탈 정리", () => {
  it.each(["cancel", "pagehide"])("%s는 이벤트를 기다리지 않고 AbortError로 끝낸다", async (action) => {
    const pending = tts.speak("질문").catch((error: unknown) => error);
    const item = utterance();
    if (action === "cancel") tts.cancel();
    else browser.dispatchEvent(new Event("pagehide"));
    expect(await pending).toMatchObject({ name: "AbortError" });
    expectReleased(item);
    tts.cancel();
    browser.dispatchEvent(new Event("pagehide"));
    await vi.advanceTimersByTimeAsync(TTS_SAFETY_TIMEOUT_MS);
    expect(synthesis.cancel).toHaveBeenCalledOnce();
    const retry = tts.speak("다음 질문");
    utterance().onend!();
    await expect(retry).resolves.toBeUndefined();
  });

  it.each(["synthesis-failed", "not-allowed", "canceled", "interrupted"])("%s 오류는 성공으로 처리하지 않는다", async (error) => {
    const pending = tts.speak("질문");
    const item = utterance();
    item.onerror!({ error });
    await expect(pending).rejects.toMatchObject({
      name: ["canceled", "interrupted"].includes(error) ? "AbortError" : "OperationError",
    });
    expectReleased(item);
    expect(synthesis.cancel).toHaveBeenCalledOnce();
  });

  it.each(["speak", "resume"] as const)("%s의 동기 예외도 대기·음성을 정리한다", async (method) => {
    synthesis.paused = true;
    const error = new Error("browser failure");
    synthesis[method].mockImplementationOnce(() => { throw error; });
    await expect(tts.speak("질문")).rejects.toBe(error);
    expectReleased(utterance());
    expect(synthesis.cancel).toHaveBeenCalledOnce();
  });

  it("utterance 생성 실패는 타이머·리스너를 남기지 않는다", async () => {
    Object.assign(browser, { SpeechSynthesisUtterance: class {
      constructor() { throw new Error("constructor failure"); }
    } });
    await expect(tts.speak("질문")).rejects.toThrow("constructor failure");
    expect(vi.getTimerCount()).toBe(0);
    expect(browser.addEventListener).not.toHaveBeenCalled();
  });

  it("브라우저 cancel이 동기적으로 이전 이벤트를 보내도 취소를 성공으로 바꾸지 않는다", async () => {
    const pending = tts.speak("질문");
    const item = utterance();
    const end = item.onend!;
    const error = item.onerror!;
    synthesis.cancel.mockImplementationOnce(() => {
      end();
      error({ error: "interrupted" });
    });
    tts.cancel();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expectReleased(item);
    expect(synthesis.cancel).toHaveBeenCalledOnce();
  });

  it("브라우저 cancel이 예외를 던져도 대기는 거부되고 내부 자원은 정리된다", async () => {
    const pending = tts.speak("질문");
    const item = utterance();
    synthesis.cancel.mockImplementationOnce(() => { throw new Error("cancel failure"); });
    expect(() => tts.cancel()).not.toThrow();
    await expect(pending).rejects.toThrow("cancel failure");
    expectReleased(item);
  });
});

describe("재생 교체와 공유 음성 큐", () => {
  it.each(["same", "different"])("%s 인스턴스의 새 질문이 이전 대기를 취소한다", async (instance) => {
    const first = tts.speak("이전 질문").catch((error: unknown) => error);
    const old = utterance();
    const oldEnd = old.onend!;
    const oldError = old.onerror!;
    const next = instance === "same" ? tts : other;
    const completed = vi.fn();
    const second = next.speak("새 질문").then(completed);
    const current = utterance();
    expect(await first).toMatchObject({ name: "AbortError" });
    expect(old.onend).toBeNull();
    expect(old.onerror).toBeNull();
    expect(synthesis.cancel).toHaveBeenCalledOnce();
    // 이전 질문의 지연 콜백과 이전 인스턴스의 늦은 cleanup은 새 질문을 건드리지 않는다.
    oldEnd();
    oldError({ error: "interrupted" });
    if (instance === "different") tts.cancel();
    await Promise.resolve();
    expect(completed).not.toHaveBeenCalled();
    expect(synthesis.cancel).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(1);
    current.onend!();
    await second;
    expect(completed).toHaveBeenCalledOnce();
    expectReleased(current);
  });

  it("잘못된 새 요청은 진행 중인 정상 재생을 끊지 않는다", async () => {
    const pending = tts.speak("유효한 질문");
    const current = utterance();
    await expect(other.speak(" ")).rejects.toBeInstanceOf(TypeError);
    expect(synthesis.cancel).not.toHaveBeenCalled();
    current.onend!();
    await pending;
  });
});
