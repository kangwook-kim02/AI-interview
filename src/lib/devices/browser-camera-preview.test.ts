import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BrowserCameraPreview } from "./browser-camera-preview";

function streamFixture() {
  const track = Object.assign(new EventTarget(), { stop: vi.fn(), readyState: "live" });
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] } as unknown as MediaStream;
  return { track, stream };
}
const media = vi.fn();
beforeEach(() => {
  media.mockReset();
  vi.stubGlobal("window", { isSecureContext: true });
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: media } });
});
afterEach(() => vi.unstubAllGlobals());
describe("면접 카메라 미리보기", () => {
  it("영상만 요청하고 종료 시 track과 연결 이벤트를 정리한다", async () => {
    const { track, stream } = streamFixture();
    media.mockResolvedValue(stream);
    const changed = vi.fn();
    const camera = new BrowserCameraPreview(changed);
    await camera.start();
    expect(media).toHaveBeenCalledWith({ video: true, audio: false });
    expect(changed).toHaveBeenLastCalledWith({ status: "active", stream, error: null });
    camera.stop();
    expect(track.stop).toHaveBeenCalledOnce();
    changed.mockClear();
    track.dispatchEvent(new Event("ended"));
    expect(changed).not.toHaveBeenCalled();
  });
  it("취소·새 시작 후 늦게 도착한 스트림을 활성화하지 않고 즉시 정리한다", async () => {
    let resolve!: (stream: MediaStream) => void;
    const first = streamFixture(); const second = streamFixture();
    media.mockReturnValueOnce(new Promise<MediaStream>((done) => { resolve = done; })).mockResolvedValueOnce(second.stream);
    const changed = vi.fn(); const camera = new BrowserCameraPreview(changed);
    const pending = camera.start();
    camera.stop();
    await camera.start();
    resolve(first.stream); await pending;
    expect(first.track.stop).toHaveBeenCalledOnce();
    expect(changed).toHaveBeenLastCalledWith({ status: "active", stream: second.stream, error: null });
    camera.stop();
  });
  it("권한 거절과 연결 끊김을 복구 가능한 오류로 알린다", async () => {
    const changed = vi.fn(); const camera = new BrowserCameraPreview(changed);
    media.mockRejectedValueOnce(new Error("private device detail"));
    await camera.start();
    expect(changed.mock.calls.at(-1)?.[0]).toMatchObject({ status: "error", stream: null });
    expect(changed.mock.calls.at(-1)?.[0].error).not.toContain("private");
    const { track, stream } = streamFixture(); media.mockResolvedValueOnce(stream);
    await camera.start(); track.dispatchEvent(new Event("ended"));
    expect(track.stop).toHaveBeenCalledOnce();
    expect(changed.mock.calls.at(-1)?.[0]).toMatchObject({ status: "error", stream: null });
  });
});
