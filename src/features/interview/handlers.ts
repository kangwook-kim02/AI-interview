import "server-only";
import { INTERVIEW_NOT_CREATED_HEADER, MAIN_QUESTION_COUNT } from "@/config/interview";
import { getQuestionGenerator, QuestionGenerationError } from "@/lib/ai";
import { findCoverLetter } from "@/lib/supabase/cover-letters";
import { CoverLetterNotFoundError } from "@/lib/supabase/cover-letter-errors";
import { createInterview } from "@/lib/supabase/interviews";
import { getCurrentUser } from "@/lib/supabase/session";
import { coverLetterSchema } from "@/types/cover-letter";
import {
  interviewMainQuestionsSchema,
  startInterviewRequestSchema,
  startInterviewResponseSchema,
} from "@/types/interview";

function json(body: unknown, status: number, notCreated = false) {
  return Response.json(body, { status, headers: {
    "Cache-Control": "private, no-store", ...(notCreated ? { [INTERVIEW_NOT_CREATED_HEADER]: "true" } : {}),
  } });
}
function notFound() {
  return json({ error: "지원 카드를 찾을 수 없어요." }, 404, true);
}

export async function startInterviewHandler(request: Request) {
  const reject = (body: unknown, status: number) => json(body, status, true);
  let creationAttempted = false;
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return reject({ error: "허용되지 않은 요청이에요." }, 403);
  }
  try {
    const user = await getCurrentUser();
    if (!user) return reject({ error: "로그인이 필요해요." }, 401);
    if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
      return reject({ error: "JSON 형식으로 요청해 주세요." }, 400);
    }
    let input: unknown;
    try {
      input = await request.json();
    } catch {
      return reject({ error: "요청 내용을 읽지 못했어요." }, 400);
    }
    const parsed = startInterviewRequestSchema.safeParse(input);
    if (!parsed.success) return reject({ error: "지원 카드 주소를 확인해 주세요." }, 400);

    const coverLetter = await findCoverLetter(parsed.data.coverLetterId, user.id);
    if (!coverLetter) return notFound();
    const context = coverLetterSchema.parse(coverLetter);
    let generated: unknown;
    try {
      generated = await getQuestionGenerator().generateMainQuestions(context, MAIN_QUESTION_COUNT);
    } catch (error) {
      const status = error instanceof QuestionGenerationError
        ? error.code === "TIMEOUT" ? 504
          : ["NOT_CONFIGURED", "UNSUPPORTED_PROVIDER"].includes(error.code) ? 503 : 502
        : 502;
      return reject({ error: "면접 질문을 준비하지 못했어요. 잠시 후 다시 시도해 주세요." }, status);
    }
    const questions = interviewMainQuestionsSchema.safeParse(generated);
    if (!questions.success) {
      return reject({ error: "올바른 면접 질문을 준비하지 못했어요. 다시 시도해 주세요." }, 502);
    }
    creationAttempted = true;
    const interviewId = await createInterview(parsed.data.coverLetterId, questions.data, user.id);
    const result = startInterviewResponseSchema.parse({ interviewId, questions: questions.data });
    return json(result, 201);
  } catch (error) {
    if (error instanceof CoverLetterNotFoundError) return notFound();
    return json({ error: "면접을 시작하지 못했어요. 잠시 후 다시 시도해 주세요." }, 500, !creationAttempted);
  }
}
