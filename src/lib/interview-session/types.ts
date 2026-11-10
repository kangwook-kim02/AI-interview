import type { FinishInterviewResponse, FollowUpResponse, StartInterviewResponse } from "@/types/interview";

/** Only explicit server rejections before creation may be treated as a canceled start. */
export class InterviewNotCreatedError extends Error {
  constructor() { super("Interview was not created"); this.name = "InterviewNotCreatedError"; }
}

export interface InterviewQuestionPosition {
  /** 0-based main question index. */
  mainQuestionIndex: number;
  /** 0 for a main question; 1..MAX_FOLLOW_UPS for its follow-ups. */
  followUpIndex: number;
}

/**
 * Session IO boundary. Implementations call the server, never an LLM from the browser.
 * Resolve positions to stored question UUIDs before calling the follow-up REST API.
 * The HTTP implementation resolves positions through the authenticated question-list API.
 */
export interface InterviewSessionIO {
  start(coverLetterId: string, signal: AbortSignal): Promise<StartInterviewResponse>;
  followUp(
    input: InterviewQuestionPosition & { interviewId: string; answerTranscript: string },
    signal: AbortSignal,
  ): Promise<FollowUpResponse>;
  finish(input: {
    interviewId: string;
    status: "completed" | "aborted";
    answers: (InterviewQuestionPosition & { answerTranscript: string })[];
  }, signal: AbortSignal): Promise<FinishInterviewResponse>;
}
