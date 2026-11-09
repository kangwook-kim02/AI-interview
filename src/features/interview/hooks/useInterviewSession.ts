"use client";

import { useCallback, useEffect, useState } from "react";
import { useStore } from "zustand";
import type { InterviewSessionIO } from "@/lib/interview-session/types";
import { createSTT, createTTS } from "@/lib/speech";
import { createInterviewSession } from "../session";
import { createInterviewStore } from "../store";

/** Keep io stable (module instance/useMemo). A changed IO starts a fresh idle session. */
export function useInterviewSession(io: InterviewSessionIO) {
  const [idleStore] = useState(createInterviewStore);
  const [session, setSession] = useState<ReturnType<typeof createInterviewSession> | null>(null);
  const snapshot = useStore(session?.store ?? idleStore);

  useEffect(() => {
    // Construct in the effect so Strict Mode cleanup/re-setup receives a fresh session.
    const current = createInterviewSession({ io, tts: createTTS(), stt: createSTT() });
    setSession(current);
    const abort = () => current.abort();
    window.addEventListener("pagehide", abort);
    return () => {
      window.removeEventListener("pagehide", abort);
      current.dispose();
    };
  }, [io]);

  return {
    snapshot,
    ready: session !== null,
    start: useCallback((coverLetterId: string) => session?.start(coverLetterId), [session]),
    answerDone: () => session?.answerDone(snapshot.operationId),
    retry: () => session?.retry(snapshot.operationId),
    abort: () => session?.abort(),
    interrupt: useCallback((message: string) => session?.interrupt(message), [session]),
  };
}
