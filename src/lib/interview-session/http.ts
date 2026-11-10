"use client";

import { getInterviewQuestionListPath, INTERVIEW_FINISH_API_PATH, INTERVIEW_FOLLOW_UP_API_PATH, INTERVIEW_NOT_CREATED_HEADER, INTERVIEW_QUESTIONS_API_PATH } from "@/config/interview";
import { finishInterviewResponseSchema, followUpResponseSchema, interviewQuestionListSchema, startInterviewResponseSchema } from "@/types/interview";
import { InterviewNotCreatedError, type InterviewQuestionPosition, type InterviewSessionIO } from "./types";

class InterviewHTTPError extends Error {
  constructor(readonly notCreated: boolean) { super("Interview request failed"); }
}

function resolveQuestion(questions: { id: string; mainQuestionIndex: number; followUpIndex: number }[], position: InterviewQuestionPosition) {
  const matches = questions.filter((question) => question.mainQuestionIndex === position.mainQuestionIndex
    && question.followUpIndex === position.followUpIndex);
  if (matches.length !== 1) throw new Error("Interview question position mismatch");
  return matches[0].id;
}

async function read(path: string, signal: AbortSignal, body?: unknown) {
  const response = await fetch(path, {
    method: body === undefined ? "GET" : "POST", signal, cache: "no-store", credentials: "same-origin",
    ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  });
  if (!response.ok) throw new InterviewHTTPError(response.headers.get(INTERVIEW_NOT_CREATED_HEADER) === "true");
  return response.json();
}

export const interviewSessionIO: InterviewSessionIO = {
  async start(coverLetterId, signal) {
    try {
      return startInterviewResponseSchema.parse(await read(INTERVIEW_QUESTIONS_API_PATH, signal, { coverLetterId }));
    } catch (error) {
      if (error instanceof InterviewHTTPError && error.notCreated) {
        throw new InterviewNotCreatedError();
      }
      throw error; // Network/500/malformed success may have lost an already-created session ID.
    }
  },
  async followUp({ interviewId, mainQuestionIndex, followUpIndex, answerTranscript }, signal) {
    const result = interviewQuestionListSchema.parse(await read(getInterviewQuestionListPath(interviewId), signal));
    const questionId = resolveQuestion(result.questions, { mainQuestionIndex, followUpIndex });
    // Lookup and decision share cancellation, including a cancellation between the two requests.
    signal.throwIfAborted();
    return followUpResponseSchema.parse(await read(INTERVIEW_FOLLOW_UP_API_PATH, signal, {
      interviewId, questionId, answerTranscript,
    }));
  },
  async finish({ interviewId, status, answers }, signal) {
    const result = answers.length
      ? interviewQuestionListSchema.parse(await read(getInterviewQuestionListPath(interviewId), signal))
      : { questions: [] };
    const storedAnswers = answers.map((answer) => ({
      questionId: resolveQuestion(result.questions, answer), answerTranscript: answer.answerTranscript,
    }));
    signal.throwIfAborted();
    const saved = finishInterviewResponseSchema.parse(await read(INTERVIEW_FINISH_API_PATH, signal, {
      interviewId, status, answers: storedAnswers,
    }));
    if (saved.interviewId !== interviewId || saved.status !== status) throw new Error("Interview finish result mismatch");
    return saved;
  },
};
