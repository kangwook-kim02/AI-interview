"use client";

import { InterviewNotCreatedError, type InterviewSessionIO } from "@/lib/interview-session/types";
import { STTError, type STTPort, type TTSPort } from "@/lib/speech";
import { finishInterviewResponseSchema, followUpResponseSchema, startInterviewResponseSchema, type StartInterviewResponse } from "@/types/interview";
import type { InterviewEvent, InterviewSnapshot } from "./machine";
import { createInterviewStore } from "./store";

export interface InterviewSessionDependencies {
  io: InterviewSessionIO;
  tts: TTSPort;
  stt: STTPort;
}

/** Owns one session and all its pending work. Construction does not start devices or IO. */
export function createInterviewSession({ io, tts, stt }: InterviewSessionDependencies) {
  const store = createInterviewStore();
  let disposed = false;
  let request: AbortController | null = null;
  let recognitionId: number | null = null;
  let starting: Promise<StartInterviewResponse> | null = null;

  function send(event: InterviewEvent) {
    if (!disposed) store.send(event);
  }

  function cancelSpeech() {
    recognitionId = null; // Invalidate callbacks before cancel (which can synchronously call onError).
    tts.cancel();
    stt.cancel();
  }

  function fail(snapshot: InterviewSnapshot, error: unknown) {
    send({
      type: "FAILED", operationId: snapshot.operationId,
      message: error instanceof STTError ? "답변을 알아듣지 못했어요. 같은 질문에 다시 답해 주세요."
        : snapshot.phase === "generating_questions" ? "면접 질문을 준비하지 못했어요. 다시 시도해 주세요."
          : snapshot.phase === "asking" ? "질문을 재생하지 못했어요. 다시 시도해 주세요."
            : snapshot.phase === "finishing" ? store.getState().interviewId
              ? "면접 기록을 저장하지 못했어요. 이 화면에서 다시 시도해 주세요."
              : "면접 생성 결과를 확인하지 못했어요. 연결을 확인한 뒤 대시보드에서 다시 시작해 주세요."
              : snapshot.phase === "evaluating" ? "답변을 저장하거나 다음 질문을 준비하지 못했어요. 다시 시도해 주세요."
              : "음성 답변을 마치지 못했어요. 같은 질문에 다시 답해 주세요.",
      ...(error instanceof STTError ? { code: error.code, partialTranscript: error.partialTranscript } : {}),
    });
  }

  async function run(snapshot: InterviewSnapshot) {
    const operationId = snapshot.operationId;
    try {
      switch (snapshot.phase) {
        case "generating_questions": {
          const controller = new AbortController();
          request = controller;
          starting = io.start(snapshot.coverLetterId!, controller.signal).then((result) => startInterviewResponseSchema.parse(result));
          const result = await starting;
          send({ type: "QUESTIONS_READY", operationId, result });
          break;
        }
        case "asking":
          await tts.speak(snapshot.question!);
          send({ type: "TTS_END", operationId });
          break;
        case "recording":
          recognitionId = operationId;
          stt.start({
            onInterim: (text) => send({ type: "DRAFT", operationId, text }),
            // Only stop()'s resolved result is allowed to finalize an answer.
            onFinal: () => {},
            onError: (error) => {
              const current = store.getState();
              if (recognitionId === operationId && (current.phase === "recording" || current.phase === "transcribing")) {
                fail(current, error);
              }
            },
          });
          break;
        case "transcribing": {
          const result = await stt.stop();
          if (store.getState().operationId === operationId) recognitionId = null;
          send({ type: "TRANSCRIPT_FINAL", operationId, text: result.transcript });
          break;
        }
        case "evaluating": {
          const controller = new AbortController();
          request = controller;
          // Always send the final answer, including the second follow-up, for persistence by IO.
          const result = followUpResponseSchema.parse(await io.followUp({
            interviewId: snapshot.interviewId!, mainQuestionIndex: snapshot.mainQuestionIndex,
            followUpIndex: snapshot.followUpIndex, answerTranscript: snapshot.answerTranscript!,
          }, controller.signal));
          send({ type: "FOLLOW_UP_RESULT", operationId, followUp: result.followUp });
          break;
        }
        case "error":
          cancelSpeech();
          break;
        case "finishing": {
          cancelSpeech();
          let interviewId = snapshot.interviewId;
          // A canceled fetch cannot cancel server creation. Recover its ID before ending.
          if (!interviewId && starting) {
            try {
              interviewId = (await starting).interviewId;
              send({ type: "SESSION_IDENTIFIED", operationId, interviewId });
            } catch (error) {
              if (!(error instanceof InterviewNotCreatedError)) throw error;
              // Explicit pre-creation rejection: nothing was created or needs saving.
            }
          }
          if (interviewId) {
            const controller = new AbortController();
            request = controller;
            const result = finishInterviewResponseSchema.parse(await io.finish({
              interviewId, status: snapshot.endReason!, answers: snapshot.answers,
            }, controller.signal));
            if (result.interviewId !== interviewId || result.status !== snapshot.endReason) {
              throw new Error("Interview finish result mismatch");
            }
          }
          send({ type: "FINISHED", operationId });
          break;
        }
      }
    } catch (error) {
      fail(snapshot, error);
    }
  }

  const unsubscribe = store.subscribe((snapshot, previous) => {
    if (snapshot.operationId === previous.operationId) return;
    // Keep an in-flight start alive when explicitly ending so its new ID can be recovered.
    if (!(previous.phase === "generating_questions" && snapshot.phase === "finishing")) request?.abort();
    request = null;
    void run(snapshot);
  });

  return {
    // Read-only Zustand API: consumers cannot bypass the machine with setState.
    store: { getState: store.getState, getInitialState: store.getInitialState, subscribe: store.subscribe },
    start(coverLetterId: string) { send({ type: "START", coverLetterId }); },
    answerDone(operationId: number) { send({ type: "ANSWER_DONE", operationId }); },
    retry(operationId: number) { send({ type: "RETRY", operationId }); },
    interrupt(message: string) {
      send({ type: "FAILED", operationId: store.getState().operationId, message });
    },
    abort() { send({ type: "ABORT" }); },
    dispose() {
      if (disposed) return;
      send({ type: "ABORT" });
      disposed = true;
      unsubscribe();
    },
  };
}
