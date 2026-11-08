import "server-only";
import { DEFAULT_OPENAI_MODEL } from "@/config/ai";
import { QuestionGenerationError } from "./errors";
import { OpenAIQuestionGenerator } from "./providers/openai";
import type { QuestionGenerator } from "./types";

export type { FollowUpInput, InterviewContext, QuestionGenerator } from "./types";
export { QuestionGenerationError } from "./errors";
export type { QuestionGenerationErrorCode } from "./errors";

export function getQuestionGenerator(): QuestionGenerator {
  const provider = process.env.LLM_PROVIDER?.trim();
  if (!provider) throw new QuestionGenerationError("NOT_CONFIGURED");
  if (provider !== "openai") {
    throw new QuestionGenerationError("UNSUPPORTED_PROVIDER");
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new QuestionGenerationError("NOT_CONFIGURED");

  return new OpenAIQuestionGenerator(
    apiKey,
    process.env.LLM_MODEL?.trim() || DEFAULT_OPENAI_MODEL,
  );
}
