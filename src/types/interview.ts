import { z } from "zod";
import { ANSWER_TRANSCRIPT_MAX_LENGTH, MAIN_QUESTION_COUNT, MAX_FOLLOW_UPS } from "@/config/interview";

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

export const finishInterviewRequestSchema = z.strictObject({
  interviewId: interviewIdSchema,
  status: z.enum(["completed", "aborted"]),
  answers: z.array(followUpRequestSchema.omit({ interviewId: true }))
    .max(MAIN_QUESTION_COUNT * (MAX_FOLLOW_UPS + 1))
    .refine((answers) => new Set(answers.map((answer) => answer.questionId)).size === answers.length),
});
export const finishInterviewResponseSchema = z.strictObject({
  interviewId: interviewIdSchema,
  status: z.enum(["completed", "aborted"]),
  endedAt: z.iso.datetime({ offset: true }),
  durationSeconds: z.number().int().nonnegative(),
});
export type FinishInterviewRequest = z.infer<typeof finishInterviewRequestSchema>;
export type FinishInterviewResponse = z.infer<typeof finishInterviewResponseSchema>;

export const interviewQuestionListSchema = z.strictObject({
  questions: z.array(z.strictObject({
    id: z.uuid(),
    mainQuestionIndex: z.number().int().min(0).max(MAIN_QUESTION_COUNT - 1),
    followUpIndex: z.number().int().min(0).max(MAX_FOLLOW_UPS),
  })).min(MAIN_QUESTION_COUNT).max(MAIN_QUESTION_COUNT * (MAX_FOLLOW_UPS + 1)),
});
