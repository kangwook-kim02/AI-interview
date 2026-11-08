import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { SPEECH_LANG, STT_FINAL_TIMEOUT_MS } from "@/config/interview";
import { createSTT, STTError, type STTPort } from "./index";

interface Result { isFinal: boolean; 0: { transcript: string } }

const instances: FakeRecognition[] = [];
class FakeRecognition {
  lang = "";
  continuous = false;
  interimResults = false;
  onresult: ((event: { results: Result[]; resultIndex: number }) => void) | null = null;
  onerror: ((event: { error: string; message?: string }) => void) | null = null;
  onend: (() => void) | null = null;
  onnomatch: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn();
  abort = vi.fn();
  constructor() { instances.push(this); }

  result(parts: [string, boolean][], resultIndex = 0) {
    this.onresult?.({ results: parts.map(([transcript, isFinal]) => ({ 0: { transcript }, isFinal })), resultIndex });
  }
}

let browser: EventTarget & { SpeechRecognition?: typeof FakeRecognition; webkitSpeechRecognition?: typeof FakeRecognition };
let stt: STTPort;
let handlers: {
  onInterim: Mock<(text: string) => void>;
  onFinal: Mock<(text: string) => void>;
  onError: Mock<(error: STTError) => void>;
};
function current() { return instances.at(-1)!; }
function start() { stt.start(handlers); return current(); }
function expectReleased(item: FakeRecognition) {
  expect(item.onresult).toBeNull();
  expect(item.onerror).toBeNull();
  expect(item.onend).toBeNull();
  expect(item.onnomatch).toBeNull();
  expect(vi.getTimerCount()).toBe(0);
  expect(browser.removeEventListener).toHaveBeenCalledWith("pagehide", expect.any(Function));
}

beforeEach(() => {
  vi.useFakeTimers();
  instances.length = 0;
  browser = Object.assign(new EventTarget(), { SpeechRecognition: FakeRecognition });
  vi.spyOn(browser, "addEventListener");
  vi.spyOn(browser, "removeEventListener");
  vi.stubGlobal("window", browser);
  stt = createSTT();
  handlers = { onInterim: vi.fn(), onFinal: vi.fn(), onError: vi.fn() };
});

afterEach(() => {
  stt.cancel();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("STT 지원·시작 경계", () => {
  it("생성·지원 확인·유휴 취소는 마이크와 이벤트를 시작하지 않는다", () => {
    expect(stt.isSupported()).toBe(true);
    stt.cancel();
    expect(instances).toHaveLength(0);
    expect(browser.addEventListener).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("SSR에서 생성·지원 확인·취소는 안전하고 start는 미지원 오류다", () => {
    vi.stubGlobal("window", undefined);
    expect(createSTT().isSupported()).toBe(false);
    expect(() => stt.cancel()).not.toThrow();
    expect(() => stt.start(handlers)).toThrow(expect.objectContaining({ name: "NotSupportedError" }));
  });

  it("Chrome 접두사 생성자를 지원하고 한국어·연속·중간 인식을 활성화한다", () => {
    browser.SpeechRecognition = undefined;
    browser.webkitSpeechRecognition = FakeRecognition;
    expect(stt.isSupported()).toBe(true);
    const item = start();
    expect(item.lang).toBe(SPEECH_LANG);
    expect(item.continuous).toBe(true);
    expect(item.interimResults).toBe(true);
    expect(item.start).toHaveBeenCalledOnce();
  });

  it("표준 생성자를 우선 사용한다", () => {
    const prefixed = vi.fn();
    Object.assign(browser, { webkitSpeechRecognition: prefixed });
    start();
    expect(prefixed).not.toHaveBeenCalled();
  });

  it("미지원이면 인식을 시작하지 않는다", () => {
    browser.SpeechRecognition = undefined;
    expect(stt.isSupported()).toBe(false);
    expect(() => start()).toThrow(expect.objectContaining({ name: "NotSupportedError" }));
    expect(instances).toHaveLength(0);
  });

  it("중복 start는 기존 답변을 유지하고 stop 전 재시작도 거부한다", async () => {
    const item = start();
    expect(() => start()).toThrow(expect.objectContaining({ name: "InvalidStateError" }));
    const pending = stt.stop();
    expect(() => start()).toThrow(expect.objectContaining({ name: "InvalidStateError" }));
    expect(instances).toHaveLength(1);
    expect(item.abort).not.toHaveBeenCalled();
    item.onend!();
    await pending;
  });

  it("start 전 stop은 상태 오류로 거부한다", async () => {
    await expect(stt.stop()).rejects.toMatchObject({ name: "InvalidStateError" });
  });

  it("생성자 예외는 이벤트를 남기지 않는다", () => {
    Object.assign(browser, { SpeechRecognition: class { constructor() { throw new Error("constructor failed"); } } });
    expect(() => start()).toThrow("constructor failed");
    expect(browser.addEventListener).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("동기 start 예외는 정리 후 throw하고 마지막 세션의 stop도 거부한다", async () => {
    class Broken extends FakeRecognition {
      start = vi.fn(() => { throw new Error("start failed"); });
    }
    browser.SpeechRecognition = Broken;
    expect(() => start()).toThrow(expect.objectContaining({ code: "start-failed" }));
    await expect(stt.stop()).rejects.toMatchObject({ code: "start-failed", cause: expect.any(Error) });
    expect(handlers.onError).not.toHaveBeenCalled();
    expectReleased(current());
    expect(current().abort).toHaveBeenCalledOnce();
  });
});

describe("결과 순서·전체 초안·최종 확정", () => {
  it("수정/삭제되는 interim과 여러 final 조각을 중복 없이 순서대로 전달한다", async () => {
    const item = start();
    item.result([[" 협업 경험 ", true], ["있", false]]);
    item.result([[" 협업 경험 ", true], ["있습니다", false]], 1);
    item.result([[" 협업 경험 ", true], ["있습니다", true], [" 팀에서 ", false]], 1);
    // 수정 없이 같은 목록이 다시 오거나 interim이 제거되어도 append하지 않는다.
    item.result([[" 협업 경험 ", true], ["있습니다", true], [" 팀에서 ", false]], 3);
    item.result([[" 협업 경험 ", true], ["있습니다", true]], 2);
    expect(handlers.onInterim.mock.calls.map(([text]) => text)).toEqual([
      "협업 경험 있", "협업 경험 있습니다", "협업 경험 있습니다 팀에서",
      "협업 경험 있습니다 팀에서", "협업 경험 있습니다",
    ]);
    expect(handlers.onFinal).not.toHaveBeenCalled();
    const pending = stt.stop();
    item.onend!();
    await expect(pending).resolves.toEqual({ transcript: "협업 경험 있습니다", empty: false });
    expect(handlers.onFinal).toHaveBeenCalledExactlyOnceWith("협업 경험 있습니다");
    expectReleased(item);
    expect(item.abort).not.toHaveBeenCalled();
  });

  it("stop 후 도착한 마지막 결과까지 기다리고 같은 Promise를 반환한다", async () => {
    const item = start();
    item.result([["문제를", true], ["해결", false]]);
    const pending = stt.stop();
    expect(stt.stop()).toBe(pending);
    expect(item.stop).toHaveBeenCalledOnce();
    const complete = vi.fn();
    void pending.then(complete);
    item.result([["문제를", true], ["해결했습니다", true]], 1);
    await Promise.resolve();
    expect(complete).not.toHaveBeenCalled();
    expect(handlers.onFinal).not.toHaveBeenCalled();
    item.onend!();
    await expect(pending).resolves.toEqual({ transcript: "문제를 해결했습니다", empty: false });
    expect(stt.stop()).toBe(pending);
    expect(handlers.onFinal).toHaveBeenCalledExactlyOnceWith("문제를 해결했습니다");
    expectReleased(item);
  });

  it.each(["no-results", "interim-only", "whitespace"])("%s는 빈 최종 전사로 식별하며 interim을 확정하지 않는다", async (kind) => {
    const item = start();
    if (kind === "interim-only") item.result([["아직 미확정", false]]);
    if (kind === "whitespace") item.result([["  ", true]]);
    const pending = stt.stop();
    item.onend!();
    await expect(pending).resolves.toEqual({ transcript: "", empty: true });
    expect(handlers.onFinal).toHaveBeenCalledExactlyOnceWith("");
  });

  it("interim 전체 목록이 비워지면 빈 초안으로 이전 표시를 지운다", () => {
    const item = start();
    item.result([["임시", false]]);
    item.result([], 0);
    expect(handlers.onInterim).toHaveBeenLastCalledWith("");
  });

  it("필수 onFinal만 있어도 동작한다", async () => {
    stt.start({ onFinal: handlers.onFinal });
    const pending = stt.stop();
    current().onend!();
    await expect(pending).resolves.toMatchObject({ empty: true });
  });
});

describe("오류·중단·정리", () => {
  it.each(["not-allowed", "service-not-allowed", "network", "no-speech", "audio-capture", "aborted", "language-not-supported"])("%s 오류는 부분 확정 전사와 함께 전달하고 stop도 거부한다", async (code) => {
    const item = start();
    item.result([["앞 문장", true], ["미확정", false]]);
    item.onerror!({ error: code, message: "engine failure" });
    const error = handlers.onError.mock.calls[0][0];
    expect(error).toBeInstanceOf(STTError);
    expect(error).toMatchObject({ code, message: "engine failure", partialTranscript: "앞 문장" });
    await expect(stt.stop()).rejects.toBe(error);
    expect(handlers.onError).toHaveBeenCalledOnce();
    expect(handlers.onFinal).not.toHaveBeenCalled();
    expect(item.abort).toHaveBeenCalledOnce();
    expectReleased(item);
  });

  it("사용자 stop 없이 end가 오면 부분 답변을 자동 제출하지 않는다", async () => {
    const item = start();
    item.result([["부분 답변", true]]);
    item.onend!();
    await expect(stt.stop()).rejects.toMatchObject({ code: "interrupted", partialTranscript: "부분 답변" });
    expect(handlers.onError).toHaveBeenCalledOnce();
    expect(handlers.onFinal).not.toHaveBeenCalled();
    expectReleased(item);
  });

  it("nomatch는 빈 답변 성공과 구분한다", async () => {
    const item = start();
    item.onnomatch!();
    await expect(stt.stop()).rejects.toMatchObject({ code: "no-match" });
    expect(handlers.onFinal).not.toHaveBeenCalled();
    expectReleased(item);
  });

  it("stop 동기 예외도 abort하고 같은 오류를 전달한다", async () => {
    const item = start();
    item.stop.mockImplementationOnce(() => { throw new Error("stop failed"); });
    const pending = stt.stop();
    await expect(pending).rejects.toBe(handlers.onError.mock.calls[0][0]);
    expect(handlers.onError).toHaveBeenCalledWith(expect.objectContaining({ code: "stop-failed" }));
    expect(item.abort).toHaveBeenCalledOnce();
    expectReleased(item);
  });

  it("abort 동기 예외는 정리 실패를 숨기지 않는다", async () => {
    const item = start();
    item.abort.mockImplementationOnce(() => { throw new Error("abort failed"); });
    stt.cancel();
    await expect(stt.stop()).rejects.toMatchObject({ code: "abort-failed" });
    expectReleased(item);
  });

  it.each(["cancel", "pagehide"])("%s는 인식과 확정 대기를 즉시 취소한다", async (action) => {
    const item = start();
    const pending = stt.stop();
    if (action === "cancel") stt.cancel();
    else browser.dispatchEvent(new Event("pagehide"));
    await expect(pending).rejects.toMatchObject({ code: "canceled" });
    expect(item.abort).toHaveBeenCalledOnce();
    expect(handlers.onFinal).not.toHaveBeenCalled();
    expectReleased(item);
    stt.cancel();
    browser.dispatchEvent(new Event("pagehide"));
    expect(item.abort).toHaveBeenCalledOnce();
    expect(handlers.onError).toHaveBeenCalledOnce();
  });

  it("stop 전 취소도 마이크를 중단하고 새 답변을 시작할 수 있다", async () => {
    const old = start();
    stt.cancel();
    await expect(stt.stop()).rejects.toMatchObject({ code: "canceled" });
    expect(old.abort).toHaveBeenCalledOnce();
    const next = start();
    const pending = stt.stop();
    next.onend!();
    await expect(pending).resolves.toMatchObject({ empty: true });
  });
});

describe("종료 시점 경합과 세션 격리", () => {
  it("최종 이벤트가 누락되면 timeout 오류와 abort로 정리한다", async () => {
    const item = start();
    const pending = stt.stop();
    await vi.advanceTimersByTimeAsync(STT_FINAL_TIMEOUT_MS - 1);
    expect(handlers.onError).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).rejects.toMatchObject({ code: "timeout" });
    expect(item.abort).toHaveBeenCalledOnce();
    expect(handlers.onFinal).not.toHaveBeenCalled();
    expectReleased(item);
  });

  it.each(["end", "error", "timeout", "cancel"])("%s가 먼저 끝내면 이전 이벤트는 결과를 바꾸거나 새 세션을 정리하지 않는다", async (first) => {
    const old = start();
    const end = old.onend!;
    const error = old.onerror!;
    const result = old.onresult!;
    const pending = stt.stop();
    if (first === "end") end();
    if (first === "error") error({ error: "network" });
    if (first === "timeout") await vi.advanceTimersByTimeAsync(STT_FINAL_TIMEOUT_MS);
    if (first === "cancel") stt.cancel();
    await pending.catch(() => {});
    const finalCount = handlers.onFinal.mock.calls.length;
    const errorCount = handlers.onError.mock.calls.length;
    const next = start();
    const nextPending = stt.stop();
    end();
    error({ error: "aborted" });
    result({ results: [{ isFinal: true, 0: { transcript: "이전 세션" } }], resultIndex: 0 });
    expect(next.abort).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(1);
    expect(handlers.onFinal).toHaveBeenCalledTimes(finalCount);
    expect(handlers.onError).toHaveBeenCalledTimes(errorCount);
    next.onend!();
    await expect(nextPending).resolves.toEqual({ transcript: "", empty: true });
  });

  it("abort가 동기적으로 옛 이벤트를 보내도 성공으로 바꾸지 않는다", async () => {
    const item = start();
    const end = item.onend!;
    const error = item.onerror!;
    item.abort.mockImplementationOnce(() => { end(); error({ error: "aborted" }); });
    const pending = stt.stop();
    stt.cancel();
    await expect(pending).rejects.toMatchObject({ code: "canceled" });
    expect(handlers.onError).toHaveBeenCalledOnce();
    expect(handlers.onFinal).not.toHaveBeenCalled();
    expectReleased(item);
  });

  it("stop 안의 동기 end와 콜백의 새 start가 원래 stop 결과를 바꾸지 않는다", async () => {
    const item = start();
    item.result([["첫 답변", true]]);
    handlers.onFinal.mockImplementationOnce(() => stt.start(handlers));
    item.stop.mockImplementationOnce(() => item.onend!());
    await expect(stt.stop()).resolves.toEqual({ transcript: "첫 답변", empty: false });
    const next = current();
    expect(next).not.toBe(item);
    next.result([["둘째 답변", true]]);
    const pending = stt.stop();
    next.onend!();
    await expect(pending).resolves.toEqual({ transcript: "둘째 답변", empty: false });
  });

  it("onError에서 재시작해도 원래 세션 정리가 새 인식을 중단하지 않는다", async () => {
    const old = start();
    handlers.onError.mockImplementationOnce(() => stt.start(handlers));
    const pending = stt.stop();
    old.onerror!({ error: "network" });
    await expect(pending).rejects.toMatchObject({ code: "network" });
    const next = current();
    expect(next.abort).not.toHaveBeenCalled();
    const nextPending = stt.stop();
    next.onend!();
    await nextPending;
  });
});
