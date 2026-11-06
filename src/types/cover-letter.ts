import { z } from "zod";
import type { Tables } from "@/types/database";
import {
  COMPANY_NAME_MAX_LENGTH,
  JOB_TITLE_MAX_LENGTH,
  ESSAY_QUESTION_MAX_LENGTH,
  ESSAY_ANSWER_MAX_LENGTH,
  EXPERIENCE_MAX_LENGTH,
  MIN_ESSAY_ITEMS,
  MAX_ESSAY_ITEMS,
  MAX_EXPERIENCES,
} from "@/config/cover-letter";

const requiredText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `${label}을 입력해 주세요.`)
    .max(max, `${label}은 ${max.toLocaleString("ko-KR")}자까지 입력할 수 있어요.`);

export const coverLetterSchema = z.object({
  companyName: requiredText("회사명", COMPANY_NAME_MAX_LENGTH),
  jobTitle: requiredText("지원 직무", JOB_TITLE_MAX_LENGTH),
  essays: z
    .array(
      z.object({
        question: requiredText("질문", ESSAY_QUESTION_MAX_LENGTH),
        answer: requiredText("답변", ESSAY_ANSWER_MAX_LENGTH),
      }),
    )
    .min(MIN_ESSAY_ITEMS, "자소서 문항을 최소 1개 추가해 주세요.")
    .max(MAX_ESSAY_ITEMS, `문항은 ${MAX_ESSAY_ITEMS}개까지 추가할 수 있어요.`),
  experiences: z
    .array(
      z.object({
        content: requiredText("경험 내용", EXPERIENCE_MAX_LENGTH),
      }),
    )
    .max(MAX_EXPERIENCES, `경험은 ${MAX_EXPERIENCES}개까지 추가할 수 있어요.`),
});

export type CoverLetterInput = z.infer<typeof coverLetterSchema>;
export const coverLetterIdSchema = z.uuid();
export type CoverLetterDetail = Pick<Tables<"cover_letters">, "id"> & CoverLetterInput;
export type CoverLetterSummary = Pick<
  Tables<"cover_letters">,
  "id" | "company_name" | "job_title" | "created_at"
> & { essayCount: number };

export type CoverLetterFeedback = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

export const coverLetterApiErrorSchema = z.object({
  error: z.string(),
  fieldErrors: z.record(z.string(), z.string()).optional(),
});
export const coverLetterMutationSchema = z.object({ id: coverLetterIdSchema });

export function coverLetterValidationState(error: z.ZodError): CoverLetterFeedback {
  return {
    error: "입력 내용을 확인해 주세요. 작성한 내용은 그대로 남아 있어요.",
    fieldErrors: Object.fromEntries(
      error.issues.map((issue) => [issue.path.join("."), issue.message]),
    ),
  };
}
