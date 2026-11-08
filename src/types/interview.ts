import { z } from "zod";
import { ANSWER_TRANSCRIPT_MAX_LENGTH, MAIN_QUESTION_COUNT } from "@/config/interview";

export const startInterviewRequestSchema = z.strictObject({ coverLetterId: z.uuid() });
export const interviewIdSchema = z.uuid();
export const interviewMainQuestionsSchema = z.array(z.string().trim().min(1)).length(MAIN_QUESTION_COUNT);
export const startInterviewResponseSchema = z.strictObject({
  interviewId: interviewIdSchema,
  questions: interviewMainQuestionsSchema,
});

export type StartInterviewRequest = z.infer<typeof startInterviewRequestSchema>;
export type StartInterviewResponse = z.infer<typeof startInterviewResponseSchema>;

export const followUpRequestSchema = z.strictObject({
  interviewId: z.uuid(),
  questionId: z.uuid(),
  answerTranscript: z.string().trim().max(ANSWER_TRANSCRIPT_MAX_LENGTH),
});
export const followUpResponseSchema = z.strictObject({
  followUp: z.string().trim().min(1).nullable(),
});
export type FollowUpRequest = z.infer<typeof followUpRequestSchema>;
export type FollowUpResponse = z.infer<typeof followUpResponseSchema>;
