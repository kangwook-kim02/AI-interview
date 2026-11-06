"use client";

import { MIC_FFT_SIZE, MIC_LEVEL_SCALE, MIC_SIGNAL_THRESHOLD } from "@/config/interview";
import { initialDeviceCheck, type DeviceCheckPort, type DeviceCheckSnapshot } from "./types";

export function getDeviceErrorMessage(error: unknown): string {
  const name = error && typeof error === "object" && "name" in error ? error.name : "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "카메라·마이크 사용이 차단되었어요. 주소창의 사이트 설정에서 두 권한을 허용한 뒤 다시 점검해 주세요.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "카메라나 마이크를 찾지 못했어요. 두 장비를 연결하고 운영체제의 입력 장치를 확인한 뒤 다시 점검해 주세요.";
    case "NotReadableError":
    case "AbortError":
      return "장비를 사용할 수 없어요. 화상회의 등 장비를 사용하는 다른 앱을 닫고 운영체제 권한을 확인한 뒤 다시 점검해 주세요.";
    default:
      return "장비 점검을 마치지 못했어요. 장비 연결과 브라우저 권한을 확인한 뒤 다시 점검해 주세요.";
  }
}

/** 캡처·입력 분석만 수행한다. 녹화·음성 인식·업로드를 시작하지 않는다. */
export class BrowserDeviceCheck implements DeviceCheckPort {
  private generation = 0;
  private snapshot = initialDeviceCheck;
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private frame: number | null = null;
  private removeListeners: (() => void)[] = [];

  constructor(private readonly onChange: (snapshot: DeviceCheckSnapshot) => void) {}

  getSupport() {
    return {
      media: window.isSecureContext && typeof navigator.mediaDevices?.getUserMedia === "function" &&
        typeof window.AudioContext === "function",
      tts: "speechSynthesis" in window && typeof window.SpeechSynthesisUtterance === "function",
      stt: typeof (window as Window & { SpeechRecognition?: unknown }).SpeechRecognition === "function" ||
        typeof (window as Window & { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition === "function",
    };
  }

  private publish(change: Partial<DeviceCheckSnapshot>) {
    this.snapshot = { ...this.snapshot, ...change };
    this.onChange(this.snapshot);
  }

  private release() {
    this.removeListeners.forEach((remove) => remove());
    this.removeListeners = [];
    if (this.frame !== null) window.cancelAnimationFrame(this.frame);
    this.frame = null;
    this.source?.disconnect();
    this.analyser?.disconnect();
    this.source = null;
    this.analyser = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    if (this.context) void this.context.close().catch(() => {});
    this.context = null;
  }

  stop() {
    this.generation++;
    this.release();
    this.snapshot = initialDeviceCheck;
    this.onChange(this.snapshot);
  }

  async start() {
    this.stop();
    const generation = this.generation;
    if (!this.getSupport().media) {
      this.publish({ status: "error", error: "이 환경에서는 장비를 점검할 수 없어요. HTTPS 주소에서 데스크톱 Chrome 최신 버전으로 다시 열어 주세요." });
      return;
    }
    this.publish({ status: "requesting" });
    try {
      // 사용자 클릭 안에서 생성/재개해 브라우저 오디오 자동 재생 제한을 피한다.
      const context = new AudioContext();
      this.context = context;
      const resumed = context.resume();
      void resumed.catch(() => {});
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      // 권한 창에는 취소 API가 없다. 늦게 도착한 스트림도 반드시 중단한다.
      if (generation !== this.generation) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      this.stream = stream;
      await resumed;
      if (generation !== this.generation) return;
      const tracks = [...stream.getVideoTracks(), ...stream.getAudioTracks()];
      if (!stream.getVideoTracks().length || !stream.getAudioTracks().length ||
        tracks.some((track) => track.readyState !== "live")) {
        throw { name: "NotFoundError" };
      }
      const fail = () => {
        if (generation !== this.generation) return;
        this.generation++;
        this.release();
        this.publish({ ...initialDeviceCheck, status: "error", error: "장비 연결이나 입력이 중단되었어요. 카메라·마이크 연결과 음소거 상태를 확인한 뒤 다시 점검해 주세요." });
      };
      for (const track of tracks) {
        for (const event of ["ended", "mute"]) {
          track.addEventListener(event, fail);
          this.removeListeners.push(() => track.removeEventListener(event, fail));
        }
      }
      const source = context.createMediaStreamSource(stream);
      this.source = source;
      const analyser = context.createAnalyser();
      this.analyser = analyser;
      analyser.fftSize = MIC_FFT_SIZE;
      source.connect(analyser);
      // destination에 연결하지 않으므로 자기 목소리가 스피커로 재생되지 않는다.
      const samples = new Float32Array(analyser.fftSize);
      this.publish({ status: "active", stream });
      const sample = () => {
        if (generation !== this.generation) return;
        if (context.state !== "running" || tracks.some((track) => track.muted || track.readyState !== "live")) {
          fail();
          return;
        }
        analyser.getFloatTimeDomainData(samples);
        const rms = Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length);
        this.publish({
          microphoneLevel: Math.min(1, rms * MIC_LEVEL_SCALE),
          microphoneDetected: this.snapshot.microphoneDetected || rms >= MIC_SIGNAL_THRESHOLD,
        });
        this.frame = window.requestAnimationFrame(sample);
      };
      sample();
    } catch (error) {
      if (generation !== this.generation) return;
      this.release();
      this.publish({ ...initialDeviceCheck, status: "error", error: getDeviceErrorMessage(error) });
    }
  }
}
