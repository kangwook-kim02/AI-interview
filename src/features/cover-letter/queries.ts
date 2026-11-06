import "server-only";

import { redirect } from "next/navigation";
import { LOGIN_PATH } from "@/config/auth";
import { listCoverLetters } from "@/lib/supabase/cover-letters";
import { getCurrentUser } from "@/lib/supabase/session";
import type { CoverLetterSummary } from "@/types/cover-letter";

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
