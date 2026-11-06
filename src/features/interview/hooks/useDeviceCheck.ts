"use client";

import { useEffect, useRef, useState } from "react";
import { createDeviceCheck } from "@/lib/devices";
import { initialDeviceCheck, type DeviceCheckPort, type DeviceSupport } from "@/lib/devices/types";

export function useDeviceCheck() {
  const device = useRef<DeviceCheckPort | null>(null);
  const [snapshot, setSnapshot] = useState(initialDeviceCheck);
  const [support, setSupport] = useState<DeviceSupport | null>(null);
  const [consented, setConsented] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [previewError, setPreviewError] = useState(false);

  useEffect(() => {
    let active = true;
    const check = createDeviceCheck((next) => {
      if (!active) return;
      setSnapshot(next);
      if (next.status !== "active") setCameraReady(false);
    });
    device.current = check;
    setSupport(check.getSupport());
    const stop = () => check.stop();
    window.addEventListener("pagehide", stop);
    return () => {
      active = false;
      window.removeEventListener("pagehide", stop);
      check.stop();
      device.current = null;
    };
  }, []);

  const ready = Boolean(consented && support?.media && support.tts && support.stt &&
    snapshot.status === "active" && cameraReady && snapshot.microphoneDetected);

  function stop() {
    device.current?.stop();
    setCameraReady(false);
  }

  return {
    snapshot, support, consented, cameraReady, completed, previewError, ready,
    setConsent(value: boolean) {
      setConsented(value);
      setCompleted(false);
      if (!value) stop();
    },
    start() {
      if (!consented || !support?.media || !support.tts || !support.stt) return;
      setCompleted(false);
      setPreviewError(false);
      setCameraReady(false);
      void device.current?.start();
    },
    stop,
    markCameraReady() { setCameraReady(true); },
    failPreview() {
      stop();
      setPreviewError(true);
    },
    complete() {
      if (!ready) return;
      stop();
      setCompleted(true);
    },
  };
}
