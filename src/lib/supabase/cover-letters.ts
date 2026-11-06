import "server-only";

import type { CoverLetterDetail, CoverLetterInput, CoverLetterSummary } from "@/types/cover-letter";
import { createServerSupabaseClient } from "./server";
import { CoverLetterNotFoundError } from "./cover-letter-errors";

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

export async function findCoverLetter(
  id: string,
  userId: string,
): Promise<CoverLetterDetail | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("cover_letters")
    .select(
      "id, user_id, company_name, job_title, essay_items(id, position, question, answer), experiences(id, position, content)",
    )
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  if (data.user_id !== userId) throw new Error("자소서 소유권을 확인하지 못했습니다.");
  const byPosition = (a: { position: number; id: string }, b: { position: number; id: string }) =>
    a.position - b.position || a.id.localeCompare(b.id);
  return {
    id: data.id,
    companyName: data.company_name,
    jobTitle: data.job_title,
    essays: data.essay_items.sort(byPosition).map(({ question, answer }) => ({ question, answer })),
    experiences: data.experiences.sort(byPosition).map(({ content }) => ({ content })),
  };
}

export async function updateOwnedCoverLetter(id: string, input: CoverLetterInput, userId: string) {
  if (!(await findCoverLetter(id, userId))) throw new CoverLetterNotFoundError();
  const supabase = await createServerSupabaseClient();
  // 조회 이후의 동시 삭제/소유권 변경도 RPC 안에서 다시 검사한다.
  const { data, error } = await supabase.rpc("update_cover_letter", {
    target_cover_letter_id: id,
    expected_user_id: userId,
    company_name: input.companyName,
    job_title: input.jobTitle,
    essays: input.essays,
    experiences: input.experiences,
  });
  if (error?.code === "P0002") throw new CoverLetterNotFoundError();
  if (error) throw error;
  return data;
}

export async function deleteOwnedCoverLetter(id: string, userId: string) {
  if (!(await findCoverLetter(id, userId))) throw new CoverLetterNotFoundError();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("cover_letters")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new CoverLetterNotFoundError();
}
