"use client";

import { useEffect, useRef, useState } from "react";
import { INTERVIEW_TIMER_INTERVAL_MS, MILLISECONDS_PER_SECOND, SECONDS_PER_MINUTE } from "@/config/interview";

export function useInterviewTimer(started: boolean, finished: boolean) {
  const startedAt = useRef<number | null>(null);
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!started) return;
    startedAt.current ??= Date.now();
    const update = () => setSeconds(Math.floor((Date.now() - startedAt.current!) / MILLISECONDS_PER_SECOND));
    update();
    if (finished) return;
    const timer = window.setInterval(update, INTERVIEW_TIMER_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [started, finished]);
  return `${String(Math.floor(seconds / SECONDS_PER_MINUTE)).padStart(2, "0")}:${String(seconds % SECONDS_PER_MINUTE).padStart(2, "0")}`;
}
