import "server-only";

import { notFound, redirect } from "next/navigation";
import { LOGIN_PATH } from "@/config/auth";
import { findCoverLetter, listCoverLetters } from "@/lib/supabase/cover-letters";
import { getCurrentUser } from "@/lib/supabase/session";
import {
  coverLetterIdSchema,
  type CoverLetterDetail,
  type CoverLetterSummary,
} from "@/types/cover-letter";

export type CoverLetterDashboardResult =
  | { status: "success"; coverLetters: CoverLetterSummary[] }
  | { status: "error" };

export async function getCoverLetterDashboard(): Promise<CoverLetterDashboardResult> {
  // 레이아웃과 페이지는 독립적으로 실행되므로 조회 경계에서도 인증한다.
  const user = await getCurrentUser();
  if (!user) redirect(LOGIN_PATH);

  try {
    return { status: "success", coverLetters: await listCoverLetters(user.id) };
  } catch {
    return { status: "error" };
  }
}

export async function getCoverLetterForEdit(
  id: string,
): Promise<{ status: "success"; coverLetter: CoverLetterDetail } | { status: "error" }> {
  const user = await getCurrentUser();
  if (!user) redirect(LOGIN_PATH);
  if (!coverLetterIdSchema.safeParse(id).success) notFound();
  let coverLetter: CoverLetterDetail | null;
  try {
    coverLetter = await findCoverLetter(id, user.id);
  } catch {
    return { status: "error" };
  }
  if (!coverLetter) notFound();
  return { status: "success", coverLetter };
}
