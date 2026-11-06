export type DeviceSupport = { media: boolean; tts: boolean; stt: boolean };

export type DeviceCheckStatus = "idle" | "requesting" | "active" | "error";

export type DeviceCheckSnapshot = {
  status: DeviceCheckStatus;
  stream: MediaStream | null;
  microphoneDetected: boolean;
  microphoneLevel: number;
  error: string | null;
};

export interface DeviceCheckPort {
  getSupport(): DeviceSupport;
  start(): Promise<void>;
  stop(): void;
}

export const initialDeviceCheck: DeviceCheckSnapshot = {
  status: "idle",
  stream: null,
  microphoneDetected: false,
  microphoneLevel: 0,
  error: null,
};
