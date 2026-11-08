import "server-only";
import { startInterviewRequestSchema, interviewIdSchema, interviewMainQuestionsSchema } from "@/types/interview";
import { CoverLetterNotFoundError } from "./cover-letter-errors";
import { createServerSupabaseClient } from "./server";

export async function createInterview(coverLetterId: string, questions: string[], userId: string) {
  const input = startInterviewRequestSchema.parse({ coverLetterId });
  const validatedQuestions = interviewMainQuestionsSchema.parse(questions);
  const supabase = await createServerSupabaseClient();
  // 본인 카드의 존재와 검증된 사용자·DB 세션의 일치를 RPC에서도 확인한다.
  const { data, error } = await supabase.rpc("create_interview", {
    target_cover_letter_id: input.coverLetterId,
    expected_user_id: userId,
    questions: validatedQuestions,
  });
  if (error?.code === "P0002") throw new CoverLetterNotFoundError();
  if (error) throw error;
  return interviewIdSchema.parse(data);
}
