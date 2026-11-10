import { MAIN_QUESTION_COUNT, MAX_FOLLOW_UPS } from "@/config/interview";
import type { InterviewQuestionPosition } from "@/lib/interview-session/types";
import { interviewMainQuestionsSchema, type StartInterviewResponse } from "@/types/interview";

export type InterviewPhase =
  | "idle" | "generating_questions" | "asking" | "recording" | "transcribing"
  | "evaluating" | "error" | "finishing" | "done";
export type InterviewWorkPhase = Extract<InterviewPhase,
  "generating_questions" | "asking" | "recording" | "transcribing" | "evaluating" | "finishing">;

export interface InterviewFailure {
  stage: InterviewWorkPhase;
  message: string;
  code?: string;
  partialTranscript?: string;
}

export interface InterviewAnswer extends InterviewQuestionPosition {
  question: string;
  answerTranscript: string;
}

export interface InterviewSnapshot extends InterviewQuestionPosition {
  phase: InterviewPhase;
  /** Changes on every phase entry, including retry. Async events must echo it. */
  operationId: number;
  coverLetterId: string | null;
  interviewId: string | null;
  mainQuestions: string[];
  question: string | null;
  draft: string;
  answerTranscript: string | null;
  answers: InterviewAnswer[];
  error: InterviewFailure | null;
  endReason: "completed" | "aborted" | null;
}

export type InterviewEvent =
  | { type: "START"; coverLetterId: string }
  | { type: "QUESTIONS_READY"; operationId: number; result: StartInterviewResponse }
  | { type: "TTS_END"; operationId: number }
  | { type: "DRAFT"; operationId: number; text: string }
  | { type: "ANSWER_DONE"; operationId: number }
  | { type: "TRANSCRIPT_FINAL"; operationId: number; text: string }
  | { type: "FOLLOW_UP_RESULT"; operationId: number; followUp: string | null }
  | { type: "FAILED"; operationId: number; message: string; code?: string; partialTranscript?: string }
  | { type: "RETRY"; operationId: number }
  | { type: "ABORT" }
  | { type: "SESSION_IDENTIFIED"; operationId: number; interviewId: string }
  | { type: "FINISHED"; operationId: number };

export function initialInterviewSnapshot(): InterviewSnapshot {
  return {
    phase: "idle", operationId: 0, coverLetterId: null, interviewId: null,
    mainQuestions: [], mainQuestionIndex: 0, followUpIndex: 0, question: null,
    draft: "", answerTranscript: null, answers: [], error: null, endReason: null,
  };
}

function enter(state: InterviewSnapshot, phase: InterviewPhase, patch: Partial<InterviewSnapshot> = {}): InterviewSnapshot {
  return { ...state, ...patch, phase, operationId: state.operationId + 1 };
}

function nextMain(state: InterviewSnapshot): InterviewSnapshot {
  const next = state.mainQuestionIndex + 1;
  if (next === MAIN_QUESTION_COUNT) return enter(state, "finishing", { endReason: "completed" });
  return enter(state, "asking", {
    mainQuestionIndex: next, followUpIndex: 0, question: state.mainQuestions[next],
    draft: "", answerTranscript: null,
  });
}

/** Invalid, duplicate, stale and terminal events are no-ops (same reference). */
export function transition(state: InterviewSnapshot, event: InterviewEvent): InterviewSnapshot {
  if (state.phase === "done") return state;
  if (event.type === "ABORT") {
    return state.endReason !== null ? state : enter(state, "finishing", { endReason: "aborted", error: null });
  }
  if (event.type === "START") {
    return state.phase === "idle" ? enter(state, "generating_questions", { coverLetterId: event.coverLetterId }) : state;
  }
  if (event.operationId !== state.operationId) return state;

  switch (event.type) {
    case "SESSION_IDENTIFIED":
      return state.phase === "finishing" ? { ...state, interviewId: event.interviewId } : state;
    case "QUESTIONS_READY": {
      if (state.phase !== "generating_questions") return state;
      const questions = interviewMainQuestionsSchema.safeParse(event.result.questions);
      if (!questions.success) return enter(state, "error", {
        error: { stage: "generating_questions", message: "면접 질문을 다시 준비해 주세요." },
      });
      return enter(state, "asking", {
        interviewId: event.result.interviewId, mainQuestions: questions.data, question: questions.data[0],
      });
    }
    case "TTS_END":
      return state.phase === "asking" ? enter(state, "recording") : state;
    case "DRAFT":
      return state.phase === "recording" ? { ...state, draft: event.text } : state;
    case "ANSWER_DONE":
      return state.phase === "recording" ? enter(state, "transcribing") : state;
    case "TRANSCRIPT_FINAL": {
      if (state.phase !== "transcribing") return state;
      const text = event.text.trim();
      return enter(state, "evaluating", {
        draft: text, answerTranscript: text,
        answers: [...state.answers, {
          mainQuestionIndex: state.mainQuestionIndex, followUpIndex: state.followUpIndex,
          question: state.question!, answerTranscript: text,
        }],
      });
    }
    case "FOLLOW_UP_RESULT": {
      if (state.phase !== "evaluating") return state;
      // Enforce locally even if an IO implementation returns another follow-up at the cap.
      if (event.followUp === null || state.followUpIndex >= MAX_FOLLOW_UPS) return nextMain(state);
      if (!event.followUp.trim()) return enter(state, "error", {
        error: { stage: "evaluating", message: "꼬리질문을 다시 준비해 주세요." },
      });
      return enter(state, "asking", {
        followUpIndex: state.followUpIndex + 1, question: event.followUp.trim(), draft: "", answerTranscript: null,
      });
    }
    case "FAILED":
      if (!["generating_questions", "asking", "recording", "transcribing", "evaluating", "finishing"].includes(state.phase)) return state;
      return enter(state, "error", { error: {
        stage: state.phase as InterviewWorkPhase, message: event.message,
        code: event.code, partialTranscript: event.partialTranscript,
      } });
    case "RETRY": {
      if (state.phase !== "error" || !state.error) return state;
      const stage = state.error.stage;
      const retry = stage === "recording" || stage === "transcribing" ? "asking" : stage;
      return enter(state, retry, {
        error: null,
        ...(retry === "asking" ? { draft: "", answerTranscript: null } : {}),
      });
    }
    case "FINISHED":
      return state.phase === "finishing" ? enter(state, "done") : state;
  }
}
