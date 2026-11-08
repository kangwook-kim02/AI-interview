import { z } from "zod";
import { coverLetterSchema } from "@/types/cover-letter";
import { QuestionGenerationError } from "./errors";

const questionSchema = z.string().trim().min(1);
export const questionCountSchema = z.number().int().positive();
export const interviewContextSchema = coverLetterSchema;
export const followUpInputSchema = z.object({
  ctx: interviewContextSchema,
  question: questionSchema,
  answerTranscript: z.string().trim(),
  previousFollowUps: z.array(questionSchema),
});

export const mainQuestionsSchema = z.strictObject({
  questions: z.array(questionSchema),
});
export const followUpSchema = z.strictObject({
  followUp: questionSchema.nullable(),
});

export function validateInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new QuestionGenerationError("INVALID_INPUT");
  return result.data;
}

export function validateResponse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new QuestionGenerationError("INVALID_RESPONSE");
  return result.data;
}
