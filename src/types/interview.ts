import { z } from "zod";
import { MAIN_QUESTION_COUNT } from "@/config/interview";

export const startInterviewRequestSchema = z.strictObject({ coverLetterId: z.uuid() });
export const interviewIdSchema = z.uuid();
export const interviewMainQuestionsSchema = z.array(z.string().trim().min(1)).length(MAIN_QUESTION_COUNT);
export const startInterviewResponseSchema = z.strictObject({
  interviewId: interviewIdSchema,
  questions: interviewMainQuestionsSchema,
});

export type StartInterviewRequest = z.infer<typeof startInterviewRequestSchema>;
export type StartInterviewResponse = z.infer<typeof startInterviewResponseSchema>;
