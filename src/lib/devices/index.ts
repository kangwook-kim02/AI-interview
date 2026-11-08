"use client";

import { BrowserDeviceCheck } from "./browser-device-check";
import { BrowserCameraPreview } from "./browser-camera-preview";
import type { CameraPreviewPort, CameraPreviewSnapshot, DeviceCheckPort, DeviceCheckSnapshot } from "./types";

export function createCameraPreview(onChange: (snapshot: CameraPreviewSnapshot) => void): CameraPreviewPort {
  return new BrowserCameraPreview(onChange);
}

export function createDeviceCheck(
  onChange: (snapshot: DeviceCheckSnapshot) => void,
): DeviceCheckPort {
  return new BrowserDeviceCheck(onChange);
}
