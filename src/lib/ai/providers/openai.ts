import "server-only";
import { z } from "zod";
import {
  AI_MAX_OUTPUT_TOKENS,
  AI_REQUEST_TIMEOUT_MS,
  OPENAI_RESPONSES_URL,
} from "@/config/ai";
import { QuestionGenerationError } from "../errors";
import { followUpPrompt, mainQuestionsPrompt } from "../prompts";
import {
  followUpInputSchema,
  followUpSchema,
  interviewContextSchema,
  mainQuestionsSchema,
  questionCountSchema,
  validateInput,
  validateResponse,
} from "../schemas";
import type { FollowUpInput, InterviewContext, QuestionGenerator } from "../types";

// Provider의 메타데이터는 무시하고 실제로 사용하는 응답 필드만 검증한다.
const responseSchema = z.object({
  status: z.string(),
  output: z.array(z.object({
    type: z.string(),
    content: z.array(z.discriminatedUnion("type", [
      z.object({ type: z.literal("output_text"), text: z.string() }),
      z.object({ type: z.literal("refusal"), refusal: z.string() }),
    ])).optional(),
  })),
});

const mainOutputFormat = {
  type: "object",
  properties: { questions: { type: "array", items: { type: "string" } } },
  required: ["questions"],
  additionalProperties: false,
};
const followUpOutputFormat = {
  type: "object",
  properties: { followUp: { type: ["string", "null"] } },
  required: ["followUp"],
  additionalProperties: false,
};

export class OpenAIQuestionGenerator implements QuestionGenerator {
  constructor(private readonly apiKey: string, private readonly model: string) {}

  async generateMainQuestions(ctx: InterviewContext, count: number): Promise<string[]> {
    const context = validateInput(interviewContextSchema, ctx);
    const requestedCount = validateInput(questionCountSchema, count);
    const result = await this.request(
      mainQuestionsPrompt(context, requestedCount),
      "main_questions",
      mainOutputFormat,
    );
    return validateResponse(
      mainQuestionsSchema.extend({
        questions: mainQuestionsSchema.shape.questions.length(requestedCount),
      }),
      result,
    ).questions;
  }

  async generateFollowUp(input: FollowUpInput): Promise<string | null> {
    const validated = validateInput(followUpInputSchema, input);
    const result = await this.request(followUpPrompt(validated), "follow_up", followUpOutputFormat);
    return validateResponse(followUpSchema, result).followUp;
  }

  private async request(
    prompt: { instructions: string; input: string },
    name: string,
    schema: Record<string, unknown>,
  ): Promise<unknown> {
    const signal = AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS);
    let raw: string;
    try {
      const response = await fetch(OPENAI_RESPONSES_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          ...prompt,
          max_output_tokens: AI_MAX_OUTPUT_TOKENS,
          store: false,
          text: { format: { type: "json_schema", name, strict: true, schema } },
        }),
        cache: "no-store",
        signal,
        redirect: "error",
      });
      if (!response.ok) throw new QuestionGenerationError("PROVIDER_FAILURE");
      raw = await response.text();
    } catch (error) {
      if (signal.aborted) throw new QuestionGenerationError("TIMEOUT");
      if (error instanceof QuestionGenerationError) throw error;
      // 외부 오류 원문에는 키나 지원자 데이터가 포함될 수 있어 전달하지 않는다.
      throw new QuestionGenerationError("PROVIDER_FAILURE");
    }

    if (!raw.trim()) throw new QuestionGenerationError("EMPTY_RESPONSE");
    let envelope: unknown;
    try {
      envelope = JSON.parse(raw);
    } catch {
      throw new QuestionGenerationError("INVALID_RESPONSE");
    }
    const response = validateResponse(responseSchema, envelope);
    if (response.status === "failed") throw new QuestionGenerationError("PROVIDER_FAILURE");
    if (response.status !== "completed") throw new QuestionGenerationError("INVALID_RESPONSE");
    const content = response.output
      .filter((item) => item.type === "message")
      .flatMap((item) => item.content ?? []);
    if (content.some((part) => part.type === "refusal")) {
      throw new QuestionGenerationError("INVALID_RESPONSE");
    }
    const text = content
      .filter((part) => part.type === "output_text")
      .map((part) => part.text)
      .join("");
    if (!text.trim()) throw new QuestionGenerationError("EMPTY_RESPONSE");
    try {
      return JSON.parse(text);
    } catch {
      throw new QuestionGenerationError("INVALID_RESPONSE");
    }
  }
}
