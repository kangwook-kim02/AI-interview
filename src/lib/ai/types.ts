import type { z } from "zod";
import type { CoverLetterInput } from "@/types/cover-letter";
import type { followUpInputSchema } from "./schemas";

export type InterviewContext = CoverLetterInput;
export type FollowUpInput = z.infer<typeof followUpInputSchema>;

export interface QuestionGenerator {
  generateMainQuestions(ctx: InterviewContext, count: number): Promise<string[]>;
  generateFollowUp(input: FollowUpInput): Promise<string | null>;
}
