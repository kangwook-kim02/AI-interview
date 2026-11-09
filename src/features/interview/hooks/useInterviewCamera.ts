"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createCameraPreview } from "@/lib/devices";
import type { CameraPreviewPort, CameraPreviewSnapshot } from "@/lib/devices/types";

export function useInterviewCamera(enabled: boolean) {
  const camera = useRef<CameraPreviewPort | null>(null);
  const [snapshot, setSnapshot] = useState<CameraPreviewSnapshot>({ status: "idle", stream: null, error: null });
  const [loadedStream, setLoadedStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    let active = true;
    const current = createCameraPreview((next) => { if (active) setSnapshot(next); });
    camera.current = current;
    const stop = () => current.stop();
    window.addEventListener("pagehide", stop);
    if (enabled) void current.start();
    else current.stop();
    return () => {
      active = false;
      current.stop();
      camera.current = null;
      window.removeEventListener("pagehide", stop);
    };
  }, [enabled]);

  return {
    ...snapshot,
    ready: snapshot.status === "active" && snapshot.stream !== null && loadedStream === snapshot.stream,
    markReady: () => setLoadedStream(snapshot.stream),
    retry: () => { setLoadedStream(null); void camera.current?.start(); },
    fail: () => {
      camera.current?.stop();
      setSnapshot({ status: "error", stream: null, error: "카메라 영상을 표시하지 못했어요. 다시 연결해 주세요." });
    },
    stop: useCallback(() => camera.current?.stop(), []),
  };
}
