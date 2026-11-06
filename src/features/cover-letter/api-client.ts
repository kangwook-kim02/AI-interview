import { COVER_LETTERS_API_PATH, getCoverLetterApiPath } from "@/config/cover-letter";
import {
  coverLetterApiErrorSchema,
  coverLetterMutationSchema,
  type CoverLetterFeedback,
  type CoverLetterInput,
} from "@/types/cover-letter";

type MutationResult = { ok: true } | { ok: false; feedback: CoverLetterFeedback };

async function mutate(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  input?: CoverLetterInput,
): Promise<MutationResult> {
  try {
    const response = await fetch(url, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      headers: input ? { "Content-Type": "application/json" } : undefined,
      body: input ? JSON.stringify(input) : undefined,
    });
    if (response.ok) {
      if (method !== "DELETE") coverLetterMutationSchema.parse(await response.json());
      return { ok: true };
    }
    const parsed = coverLetterApiErrorSchema.safeParse(await response.json());
    if (parsed.success) return { ok: false, feedback: parsed.data };
  } catch {
    // 연결 실패나 잘못된 응답도 폼 안에서 안내해 입력을 유지한다.
  }
  return {
    ok: false,
    feedback: {
      error: "서버 응답을 받지 못했어요. 작성한 내용은 그대로예요. 연결을 확인해 주세요.",
    },
  };
}

export function persistCoverLetter(input: CoverLetterInput, id?: string) {
  return mutate(
    id ? getCoverLetterApiPath(id) : COVER_LETTERS_API_PATH,
    id ? "PATCH" : "POST",
    input,
  );
}
export function removeCoverLetter(id: string) {
  return mutate(getCoverLetterApiPath(id), "DELETE");
}
