import "server-only";

import { revalidatePath } from "next/cache";
import { AUTH_REDIRECT_PATH } from "@/config/auth";
import { getCoverLetterApiPath, getCoverLetterEditPath } from "@/config/cover-letter";
import { CoverLetterNotFoundError } from "@/lib/supabase/cover-letter-errors";
import {
  deleteOwnedCoverLetter,
  findCoverLetter,
  listCoverLetters,
  saveCoverLetter,
  updateOwnedCoverLetter,
} from "@/lib/supabase/cover-letters";
import { getCurrentUser } from "@/lib/supabase/session";
import {
  coverLetterIdSchema,
  coverLetterSchema,
  coverLetterValidationState,
} from "@/types/cover-letter";

type ItemContext = { params: Promise<{ id: string }> };
const privateHeaders = { "Cache-Control": "private, no-store" };

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { ...privateHeaders, ...headers } });
}
function notFound() {
  return json({ error: "지원 카드를 찾을 수 없어요." }, 404);
}
function failure(error: unknown) {
  if (error instanceof CoverLetterNotFoundError) return notFound();
  return json(
    { error: "요청을 처리하지 못했어요. 작성한 내용은 그대로예요. 잠시 후 다시 시도해 주세요." },
    500,
  );
}
function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return origin !== null && origin === new URL(request.url).origin;
}
function invalidate(id?: string) {
  revalidatePath(AUTH_REDIRECT_PATH);
  if (id) revalidatePath(getCoverLetterEditPath(id));
}

export async function listCoverLettersHandler() {
  try {
    const user = await getCurrentUser();
    if (!user) return json({ error: "로그인이 필요해요." }, 401);
    return json({ coverLetters: await listCoverLetters(user.id) });
  } catch (error) {
    return failure(error);
  }
}

export async function getCoverLetterHandler(_request: Request, context: ItemContext) {
  try {
    const user = await getCurrentUser();
    if (!user) return json({ error: "로그인이 필요해요." }, 401);
    const { id } = await context.params;
    if (!coverLetterIdSchema.safeParse(id).success)
      return json({ error: "지원 카드 주소를 확인해 주세요." }, 400);
    const coverLetter = await findCoverLetter(id, user.id);
    return coverLetter ? json({ coverLetter }) : notFound();
  } catch (error) {
    return failure(error);
  }
}

export async function createCoverLetterHandler(request: Request) {
  return persist(request);
}
export async function updateCoverLetterHandler(request: Request, context: ItemContext) {
  const { id } = await context.params;
  return persist(request, id);
}
async function persist(request: Request, id?: string) {
  if (!isSameOrigin(request)) return json({ error: "허용되지 않은 요청이에요." }, 403);
  try {
    const user = await getCurrentUser();
    if (!user) return json({ error: "로그인이 필요해요. 다시 로그인한 뒤 저장해 주세요." }, 401);
    if (id !== undefined && !coverLetterIdSchema.safeParse(id).success) {
      return json({ error: "지원 카드 주소를 확인해 주세요." }, 400);
    }
    if (
      request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json"
    ) {
      return json({ error: "JSON 형식으로 요청해 주세요." }, 400);
    }
    let input: unknown;
    try {
      input = await request.json();
    } catch {
      return json({ error: "입력 내용을 읽지 못했어요. 다시 저장해 주세요." }, 400);
    }
    const parsed = coverLetterSchema.safeParse(input);
    if (!parsed.success) return json(coverLetterValidationState(parsed.error), 400);
    const savedId = id
      ? await updateOwnedCoverLetter(id, parsed.data, user.id)
      : await saveCoverLetter(parsed.data, user.id);
    invalidate(id);
    return json(
      { id: savedId },
      id ? 200 : 201,
      id ? {} : { Location: getCoverLetterApiPath(savedId) },
    );
  } catch (error) {
    return failure(error);
  }
}

export async function deleteCoverLetterHandler(request: Request, context: ItemContext) {
  if (!isSameOrigin(request)) return json({ error: "허용되지 않은 요청이에요." }, 403);
  try {
    const user = await getCurrentUser();
    if (!user) return json({ error: "로그인이 필요해요. 다시 로그인한 뒤 삭제해 주세요." }, 401);
    const { id } = await context.params;
    if (!coverLetterIdSchema.safeParse(id).success)
      return json({ error: "지원 카드 주소를 확인해 주세요." }, 400);
    await deleteOwnedCoverLetter(id, user.id);
    invalidate(id);
    return new Response(null, { status: 204, headers: privateHeaders });
  } catch (error) {
    return failure(error);
  }
}
