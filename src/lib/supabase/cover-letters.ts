import "server-only";

import type { CoverLetterInput, CoverLetterSummary } from "@/types/cover-letter";
import { createServerSupabaseClient } from "./server";

export async function listCoverLetters(userId: string): Promise<CoverLetterSummary[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("cover_letters")
    .select("id, user_id, company_name, job_title, created_at, essay_items(count)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  if (error) throw error;
  // 조회 필터에 더해 반환된 행도 확인하고, 소유권 불일치 시 전체 조회를 실패시킨다.
  if (data.some((row) => row.user_id !== userId)) {
    throw new Error("자소서 소유권을 확인하지 못했습니다.");
  }
  return data.map(({ id, company_name, job_title, created_at, essay_items }) => ({
    id,
    company_name,
    job_title,
    created_at,
    essayCount: essay_items[0]?.count ?? 0,
  }));
}

export async function saveCoverLetter(input: CoverLetterInput, userId: string) {
  const supabase = await createServerSupabaseClient();
  // 서버에서 검증한 계정과 RPC를 실행하는 세션이 같은지 DB에서도 확인한다.
  const { data, error } = await supabase.rpc("create_cover_letter", {
    expected_user_id: userId,
    company_name: input.companyName,
    job_title: input.jobTitle,
    essays: input.essays,
    experiences: input.experiences,
  });
  if (error) throw error;
  return data;
}
