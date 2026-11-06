import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BrowserDeviceCheck, getDeviceErrorMessage } from "./browser-device-check";
import type { DeviceCheckSnapshot } from "./types";

function makeTrack() {
  const target = new EventTarget();
  return Object.assign(target, { readyState: "live", muted: false, stop: vi.fn() });
}

const video = makeTrack();
const audio = makeTrack();
const stream = {
  getTracks: () => [video, audio],
  getVideoTracks: () => [video],
  getAudioTracks: () => [audio],
} as unknown as MediaStream;
let amplitude = 0;
let latest: DeviceCheckSnapshot;
let check: BrowserDeviceCheck;
let sampleNext: FrameRequestCallback;
const getUserMedia = vi.fn();
const close = vi.fn();
const disconnect = vi.fn();
const cancelAnimationFrame = vi.fn();

class FakeAudioContext {
  state = "running";
  resume() { return Promise.resolve(); }
  close() { close(); return Promise.resolve(); }
  createMediaStreamSource() { return { connect: vi.fn(), disconnect }; }
  createAnalyser() {
    return {
      fftSize: 1024,
      getFloatTimeDomainData: (data: Float32Array) => data.fill(amplitude),
      disconnect,
    };
  }
}

beforeEach(() => {
  amplitude = 0;
  video.readyState = audio.readyState = "live";
  video.muted = audio.muted = false;
  getUserMedia.mockReset().mockResolvedValue(stream);
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
  vi.stubGlobal("AudioContext", FakeAudioContext);
  vi.stubGlobal("window", {
    isSecureContext: true,
    AudioContext: FakeAudioContext,
    speechSynthesis: {},
    SpeechSynthesisUtterance: class {},
    webkitSpeechRecognition: class {},
    requestAnimationFrame: (callback: FrameRequestCallback) => { sampleNext = callback; return 1; },
    cancelAnimationFrame,
  });
  check = new BrowserDeviceCheck((value) => { latest = value; });
});
afterEach(() => { check.stop(); vi.unstubAllGlobals(); });

describe("브라우저 장비 점검", () => {
  it("생성/지원 확인만으로 권한을 요청하지 않고 표준·접두사 음성을 탐지한다", () => {
    expect(check.getSupport()).toEqual({ media: true, tts: true, stt: true });
    expect(getUserMedia).not.toHaveBeenCalled();
    Object.assign(window, { webkitSpeechRecognition: undefined });
    expect(check.getSupport().stt).toBe(false);
    Object.assign(window, { SpeechRecognition: class {} });
    expect(check.getSupport().stt).toBe(true);
    Object.assign(window, { SpeechSynthesisUtterance: undefined });
    expect(check.getSupport().tts).toBe(false);
  });

  it("비보안 환경에서는 권한 요청을 하지 않는다", async () => {
    Object.assign(window, { isSecureContext: false });
    await check.start();
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(latest.status).toBe("error");
    expect(latest.error).toContain("HTTPS");
  });

  it("실제 입력을 감지하고 중단 시 모든 자원을 해제한다", async () => {
    await check.start();
    expect(getUserMedia).toHaveBeenCalledWith({ video: true, audio: true });
    expect(latest.status).toBe("active");
    expect(latest.microphoneDetected).toBe(false);
    amplitude = 0.05;
    sampleNext(0);
    expect(latest.microphoneDetected).toBe(true);
    check.stop();
    expect(video.stop).toHaveBeenCalled();
    expect(audio.stop).toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalled();
    expect(cancelAnimationFrame).toHaveBeenCalled();
    expect(latest.microphoneDetected).toBe(false);
    expect(latest.stream).toBeNull();
  });

  it("취소 뒤 허용된 스트림도 즉시 중지한다", async () => {
    let resolve!: (value: MediaStream) => void;
    getUserMedia.mockReturnValueOnce(new Promise<MediaStream>((done) => { resolve = done; }));
    const pending = check.start();
    expect(latest.status).toBe("requesting");
    check.stop();
    resolve(stream);
    await pending;
    expect(video.stop).toHaveBeenCalled();
    expect(audio.stop).toHaveBeenCalled();
    expect(latest.status).toBe("idle");
  });

  it("재시도 뒤 이전 요청이 돌아와도 새 스트림을 바꾸지 않는다", async () => {
    const oldVideo = makeTrack();
    const oldStream = { getTracks: () => [oldVideo] } as unknown as MediaStream;
    let resolve!: (value: MediaStream) => void;
    getUserMedia.mockReturnValueOnce(new Promise<MediaStream>((done) => { resolve = done; }));
    const pending = check.start();
    await check.start();
    resolve(oldStream);
    await pending;
    expect(oldVideo.stop).toHaveBeenCalled();
    expect(latest.stream).toBe(stream);
    expect(video.stop).not.toHaveBeenCalled();
  });

  it.each(["ended", "mute"])("점검 중 트랙 %s 시 준비 상태를 취소한다", async (event) => {
    amplitude = 0.05;
    await check.start();
    expect(latest.microphoneDetected).toBe(true);
    audio.dispatchEvent(new Event(event));
    expect(latest.status).toBe("error");
    expect(latest.microphoneDetected).toBe(false);
    expect(video.stop).toHaveBeenCalled();
  });

  it("권한 거부 시 분석 자원을 해제하고 재시도할 수 있다", async () => {
    getUserMedia.mockRejectedValueOnce({ name: "NotAllowedError" });
    await check.start();
    expect(latest.status).toBe("error");
    expect(latest.error).toContain("사이트 설정");
    expect(close).toHaveBeenCalled();
    await check.start();
    expect(latest.status).toBe("active");
  });

  it.each([
    ["NotAllowedError", "사이트 설정"],
    ["NotFoundError", "연결"],
    ["NotReadableError", "다른 앱"],
    ["AbortError", "다른 앱"],
    ["UnknownError", "다시 점검"],
  ])("%s에 맞는 한국어 해결 안내를 반환한다", (name, message) => {
    expect(getDeviceErrorMessage({ name })).toContain(message);
  });
});
