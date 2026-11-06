"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AUTH_REDIRECT_PATH } from "@/config/auth";
import { saveCoverLetter } from "@/lib/supabase/cover-letters";
import { getCurrentUser } from "@/lib/supabase/session";
import {
  coverLetterSchema,
  coverLetterValidationState,
  type CoverLetterActionState,
} from "@/types/cover-letter";

export async function createCoverLetter(
  _previous: CoverLetterActionState,
  formData: FormData,
): Promise<CoverLetterActionState> {
  let input: unknown;
  try {
    input = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return { error: "입력 내용을 읽지 못했어요. 다시 저장해 주세요." };
  }
  const parsed = coverLetterSchema.safeParse(input);
  if (!parsed.success) return coverLetterValidationState(parsed.error);

  try {
    const user = await getCurrentUser();
    if (!user) return { error: "로그인이 필요해요. 다시 로그인한 뒤 저장해 주세요." };
    await saveCoverLetter(parsed.data, user.id);
  } catch {
    return { error: "저장하지 못했어요. 작성한 내용은 그대로예요. 잠시 후 다시 저장해 주세요." };
  }

  revalidatePath(AUTH_REDIRECT_PATH);
  redirect(AUTH_REDIRECT_PATH);
}
