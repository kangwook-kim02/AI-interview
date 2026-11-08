import "server-only";
import { getCurrentUser } from "@/lib/supabase/session";
import { listInterviewQuestions } from "@/lib/supabase/interview-questions";
import { InterviewRequestError } from "@/lib/supabase/interview-errors";
import { interviewIdSchema } from "@/types/interview";

export async function questionListHandler(_request: Request, { params }: { params: Promise<{ interviewId: string }> }) {
  const json = (body: unknown, status = 200) => Response.json(body, {
    status, headers: { "Cache-Control": "private, no-store" },
  });
  try {
    const user = await getCurrentUser();
    if (!user) return json({ error: "로그인이 필요해요." }, 401);
    const parsed = interviewIdSchema.safeParse((await params).interviewId);
    if (!parsed.success) return json({ error: "면접 주소를 확인해 주세요." }, 400);
    return json(await listInterviewQuestions(parsed.data, user.id));
  } catch (error) {
    if (error instanceof InterviewRequestError && error.code === "NOT_FOUND") {
      return json({ error: "면접을 찾을 수 없어요." }, 404);
    }
    return json({ error: "질문 정보를 불러오지 못했어요. 다시 시도해 주세요." }, 500);
  }
}
