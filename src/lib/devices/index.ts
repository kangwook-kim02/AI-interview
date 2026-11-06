"use client";

import { BrowserDeviceCheck } from "./browser-device-check";
import type { DeviceCheckPort, DeviceCheckSnapshot } from "./types";

export function createDeviceCheck(
  onChange: (snapshot: DeviceCheckSnapshot) => void,
): DeviceCheckPort {
  return new BrowserDeviceCheck(onChange);
}
