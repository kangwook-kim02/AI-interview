import "server-only";
import { finishInterview } from "@/lib/supabase/interview-records";
import { InterviewRequestError } from "@/lib/supabase/interview-errors";
import { getCurrentUser } from "@/lib/supabase/session";
import { finishInterviewRequestSchema } from "@/types/interview";

const json = (body: unknown, status = 200) => Response.json(body, {
  status, headers: { "Cache-Control": "private, no-store" },
});

export async function finishInterviewHandler(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return json({ error: "허용되지 않은 요청이에요." }, 403);
  }
  try {
    const user = await getCurrentUser();
    if (!user) return json({ error: "로그인이 필요해요." }, 401);
    if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
      return json({ error: "JSON 형식으로 요청해 주세요." }, 400);
    }
    let body: unknown;
    try { body = await request.json(); }
    catch { return json({ error: "요청 내용을 읽지 못했어요." }, 400); }
    const parsed = finishInterviewRequestSchema.safeParse(body);
    if (!parsed.success) return json({ error: "면접 주소와 종료할 답변을 확인해 주세요." }, 400);
    return json(await finishInterview(parsed.data, user.id));
  } catch (error) {
    if (error instanceof InterviewRequestError) {
      if (error.code === "NOT_FOUND") return json({ error: "면접 또는 질문을 찾을 수 없어요." }, 404);
      return json({ error: "저장된 답변이나 종료 상태를 확인해 주세요." }, 409);
    }
    return json({ error: "면접 기록을 저장하지 못했어요. 다시 시도해 주세요." }, 500);
  }
}
