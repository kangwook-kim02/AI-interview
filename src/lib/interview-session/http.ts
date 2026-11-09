"use client";

import { getInterviewQuestionListPath, INTERVIEW_FOLLOW_UP_API_PATH, INTERVIEW_QUESTIONS_API_PATH } from "@/config/interview";
import { followUpResponseSchema, interviewQuestionListSchema, startInterviewResponseSchema } from "@/types/interview";
import type { InterviewSessionIO } from "./types";

async function read(path: string, signal: AbortSignal, body?: unknown) {
  const response = await fetch(path, {
    method: body === undefined ? "GET" : "POST", signal, cache: "no-store", credentials: "same-origin",
    ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  });
  if (!response.ok) throw new Error("Interview request failed");
  return response.json();
}

export const interviewSessionIO: InterviewSessionIO = {
  async start(coverLetterId, signal) {
    return startInterviewResponseSchema.parse(await read(INTERVIEW_QUESTIONS_API_PATH, signal, { coverLetterId }));
  },
  async followUp({ interviewId, mainQuestionIndex, followUpIndex, answerTranscript }, signal) {
    const result = interviewQuestionListSchema.parse(await read(getInterviewQuestionListPath(interviewId), signal));
    const matches = result.questions.filter((question) =>
      question.mainQuestionIndex === mainQuestionIndex && question.followUpIndex === followUpIndex);
    if (matches.length !== 1) throw new Error("Interview question position mismatch");
    // Lookup and decision share cancellation, including a cancellation between the two requests.
    signal.throwIfAborted();
    return followUpResponseSchema.parse(await read(INTERVIEW_FOLLOW_UP_API_PATH, signal, {
      interviewId, questionId: matches[0].id, answerTranscript,
    }));
  },
};
