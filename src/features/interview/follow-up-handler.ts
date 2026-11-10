import "server-only";
import { getQuestionGenerator, QuestionGenerationError } from "@/lib/ai";
import { findCoverLetter } from "@/lib/supabase/cover-letters";
import { loadFollowUpState, saveFollowUp } from "@/lib/supabase/interview-follow-ups";
import { saveInterviewAnswer } from "@/lib/supabase/interview-records";
import { InterviewRequestError } from "@/lib/supabase/interview-errors";
import { getCurrentUser } from "@/lib/supabase/session";
import { coverLetterSchema } from "@/types/cover-letter";
import { followUpRequestSchema, followUpResponseSchema } from "@/types/interview";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function followUpHandler(request: Request) {
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
    const parsed = followUpRequestSchema.safeParse(body);
    if (!parsed.success) return json({ error: "면접·질문 주소와 확정 답변을 확인해 주세요." }, 400);
    const input = parsed.data;
    const state = await loadFollowUpState(input, user.id);
    // Persist the final transcript even when AI generation fails or is interrupted.
    await saveInterviewAnswer(input, user.id);
    // Revalidate even a cached result: the session may have ended since the read.
    if (state.decision) return json(await saveFollowUp(input, state.decision, user.id));
    let result = { followUp: null as string | null };
    if (!state.atLimit && input.answerTranscript) {
      const coverLetter = await findCoverLetter(state.coverLetterId, user.id);
      if (!coverLetter) throw new InterviewRequestError("NOT_FOUND");
      const ctx = coverLetterSchema.parse(coverLetter);
      try {
        const followUp = await getQuestionGenerator().generateFollowUp({
          ctx, question: state.question, answerTranscript: input.answerTranscript,
          previousFollowUps: state.previousFollowUps,
        });
        const validated = followUpResponseSchema.safeParse({ followUp });
        if (!validated.success) throw new QuestionGenerationError("INVALID_RESPONSE");
        result = validated.data;
      } catch (error) {
        const status = error instanceof QuestionGenerationError
          ? error.code === "TIMEOUT" ? 504
            : ["NOT_CONFIGURED", "UNSUPPORTED_PROVIDER"].includes(error.code) ? 503 : 502
          : 502;
        return json({ error: "꼬리질문을 준비하지 못했어요. 잠시 후 다시 시도해 주세요." }, status);
      }
    }
    return json(await saveFollowUp(input, result, user.id));
  } catch (error) {
    if (error instanceof InterviewRequestError) {
      if (error.code === "NOT_FOUND") return json({ error: "면접 또는 질문을 찾을 수 없어요." }, 404);
      if (error.code === "CLOSED") return json({ error: "이미 종료된 면접이에요." }, 409);
      return json({ error: "이미 처리된 답변이거나 질문 순서가 달라요." }, 409);
    }
    return json({ error: "꼬리질문을 처리하지 못했어요. 잠시 후 다시 시도해 주세요." }, 500);
  }
}
