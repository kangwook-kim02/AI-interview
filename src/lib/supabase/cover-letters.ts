import "server-only";

import type { CoverLetterInput } from "@/types/cover-letter";
import { createServerSupabaseClient } from "./server";

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
