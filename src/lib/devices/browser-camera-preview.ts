"use client";

import type { CameraPreviewPort, CameraPreviewSnapshot } from "./types";

/** Owns only video. Speech recognition manages its own microphone. */
export class BrowserCameraPreview implements CameraPreviewPort {
  private generation = 0;
  private stream: MediaStream | null = null;
  private removeListeners: (() => void)[] = [];

  constructor(private readonly onChange: (snapshot: CameraPreviewSnapshot) => void) {}

  stop() {
    this.generation++;
    this.removeListeners.forEach((remove) => remove());
    this.removeListeners = [];
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.onChange({ status: "idle", stream: null, error: null });
  }

  async start() {
    this.stop();
    const generation = this.generation;
    this.onChange({ status: "requesting", stream: null, error: null });
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error("Unsupported camera");
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      if (generation !== this.generation) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      this.stream = stream;
      const tracks = stream.getVideoTracks();
      if (!tracks.length || tracks.some((track) => track.readyState !== "live")) throw new Error("Missing camera");
      const fail = () => {
        if (generation !== this.generation) return;
        this.stop();
        this.onChange({ status: "error", stream: null, error: "카메라 연결이 끊겼어요. 장비와 권한을 확인한 뒤 다시 연결해 주세요." });
      };
      for (const track of tracks) {
        for (const event of ["ended", "mute"]) {
          track.addEventListener(event, fail);
          this.removeListeners.push(() => track.removeEventListener(event, fail));
        }
      }
      this.onChange({ status: "active", stream, error: null });
    } catch {
      if (generation !== this.generation) return;
      this.stop();
      this.onChange({ status: "error", stream: null, error: "카메라를 켜지 못했어요. 브라우저 권한과 장비 연결을 확인한 뒤 다시 연결해 주세요." });
    }
  }
}
