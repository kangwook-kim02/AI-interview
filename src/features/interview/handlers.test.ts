import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/interview/questions/route";
import { MAIN_QUESTION_COUNT, INTERVIEW_NOT_CREATED_HEADER, INTERVIEW_QUESTIONS_API_PATH } from "@/config/interview";
import { QuestionGenerationError } from "@/lib/ai/errors";
import { CoverLetterNotFoundError } from "@/lib/supabase/cover-letter-errors";

const { getCurrentUser, findCoverLetter, createInterview, getQuestionGenerator, generateMainQuestions } = vi.hoisted(() => ({
  getCurrentUser: vi.fn(), findCoverLetter: vi.fn(), createInterview: vi.fn(),
  getQuestionGenerator: vi.fn(), generateMainQuestions: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/session", () => ({ getCurrentUser }));
vi.mock("@/lib/supabase/cover-letters", () => ({ findCoverLetter }));
vi.mock("@/lib/supabase/interviews", () => ({ createInterview }));
vi.mock("@/lib/ai", async () => ({
  ...await import("@/lib/ai/errors"), getQuestionGenerator,
}));

const coverLetterId = "c0120000-0000-4000-8000-000000000001";
const interviewId = "c0120000-0000-4000-8000-000000000002";
const userId = "c0120000-0000-4000-8000-000000000003";
const context = {
  companyName: "저장된 회사", jobTitle: "저장된 직무",
  essays: [{ question: "저장된 문항", answer: "저장된 답변" }],
  experiences: [{ content: "저장된 경험" }],
};
const questions = Array.from({ length: MAIN_QUESTION_COUNT }, (_, i) => `질문 ${i + 1}?`);
const origin = "http://localhost:3000";
function request(value: unknown = { coverLetterId }, requestOrigin: string | null = origin, contentType = "application/json") {
  const headers: Record<string, string> = { "Content-Type": contentType };
  if (requestOrigin !== null) headers.Origin = requestOrigin;
  return new Request(`${origin}${INTERVIEW_QUESTIONS_API_PATH}`, { method: "POST", headers, body: JSON.stringify(value) });
}
async function expectError(response: Response, status: number) {
  expect(response.status).toBe(status);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.has("location")).toBe(false);
  const body = await response.json();
  expect(body.error).toBeTruthy();
  expect(body.interviewId).toBeUndefined();
  expect(JSON.stringify(body)).not.toMatch(/private-detail|secret-key|저장된 답변/);
}
beforeEach(() => {
  getCurrentUser.mockReset().mockResolvedValue({ id: userId });
  findCoverLetter.mockReset().mockResolvedValue({ id: coverLetterId, ...context });
  createInterview.mockReset().mockResolvedValue(interviewId);
  generateMainQuestions.mockReset().mockResolvedValue(questions);
  getQuestionGenerator.mockReset().mockReturnValue({ generateMainQuestions });
});

describe("면접 시작 API", () => {
  it("저장된 맥락과 고정 질문 수로 생성하고 저장 후 201을 반환한다", async () => {
    const response = await POST(request());
    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ interviewId, questions });
    expect(findCoverLetter).toHaveBeenCalledExactlyOnceWith(coverLetterId, userId);
    expect(getQuestionGenerator).toHaveBeenCalledOnce();
    expect(generateMainQuestions).toHaveBeenCalledExactlyOnceWith(context, MAIN_QUESTION_COUNT);
    expect(createInterview).toHaveBeenCalledExactlyOnceWith(coverLetterId, questions, userId);
    expect(generateMainQuestions.mock.invocationCallOrder[0]).toBeLessThan(createInterview.mock.invocationCallOrder[0]);
  });

  it("AI가 끝나기 전에는 세션을 저장하지 않는다", async () => {
    let resolveQuestions!: (value: string[]) => void;
    generateMainQuestions.mockReturnValue(new Promise<string[]>((resolve) => { resolveQuestions = resolve; }));
    const pending = POST(request());
    await vi.waitFor(() => expect(generateMainQuestions).toHaveBeenCalledOnce());
    expect(createInterview).not.toHaveBeenCalled();
    resolveQuestions(questions);
    expect((await pending).status).toBe(201);
  });

  it("경험이 없는 카드도 생성하고 질문 공백은 정규화해 저장한다", async () => {
    findCoverLetter.mockResolvedValue({ id: coverLetterId, ...context, experiences: [] });
    generateMainQuestions.mockResolvedValue(questions.map((q) => ` ${q}\n`));
    expect((await POST(request(undefined, origin, "application/json; charset=utf-8"))).status).toBe(201);
    expect(generateMainQuestions).toHaveBeenCalledWith({ ...context, experiences: [] }, MAIN_QUESTION_COUNT);
    expect(createInterview).toHaveBeenCalledWith(coverLetterId, questions, userId);
  });

  it("같은 자소서로 재요청하면 새 생성 호출을 하며 기존 ID를 덮어쓰지 않는다", async () => {
    const secondId = "c0120000-0000-4000-8000-000000000004";
    createInterview.mockResolvedValueOnce(interviewId).mockResolvedValueOnce(secondId);
    expect((await (await POST(request())).json()).interviewId).toBe(interviewId);
    expect((await (await POST(request())).json()).interviewId).toBe(secondId);
    expect(createInterview).toHaveBeenCalledTimes(2);
    expect(generateMainQuestions).toHaveBeenCalledTimes(2);
  });

  it.each([null, "null", "https://evil.example", "http://localhost:3001"])("누락/외부 Origin %s은 인증·조회·AI 전에 거부한다", async (requestOrigin) => {
    await expectError(await POST(request({ coverLetterId }, requestOrigin)), 403);
    expect(getCurrentUser).not.toHaveBeenCalled();
    expect(findCoverLetter).not.toHaveBeenCalled();
    expect(getQuestionGenerator).not.toHaveBeenCalled();
    expect(createInterview).not.toHaveBeenCalled();
  });

  it("비로그인은 JSON 401이며 인증 장애는 500이다", async () => {
    getCurrentUser.mockResolvedValueOnce(null);
    await expectError(await POST(request()), 401);
    getCurrentUser.mockRejectedValueOnce(new Error("private-detail secret-key"));
    await expectError(await POST(request()), 500);
    expect(findCoverLetter).not.toHaveBeenCalled();
    expect(getQuestionGenerator).not.toHaveBeenCalled();
  });

  it.each([
    {}, null, [], { coverLetterId: "bad" }, { coverLetterId: "" },
    { coverLetterId, userId: "attacker" }, { coverLetterId, count: 1 },
    { coverLetterId, companyName: "위조된 회사" },
  ])("잘못된 입력과 요청 위조를 거부한다(%j)", async (input) => {
    await expectError(await POST(request(input)), 400);
    expect(findCoverLetter).not.toHaveBeenCalled();
    expect(getQuestionGenerator).not.toHaveBeenCalled();
    expect(createInterview).not.toHaveBeenCalled();
  });

  it("JSON이 아닌 Content-Type과 깨진 JSON을 거부한다", async () => {
    await expectError(await POST(request({ coverLetterId }, origin, "text/plain")), 400);
    await expectError(await POST(new Request(`${origin}${INTERVIEW_QUESTIONS_API_PATH}`, {
      method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: "{",
    })), 400);
    expect(findCoverLetter).not.toHaveBeenCalled();
  });

  it("타인/없는 카드는 같은 404이며 AI 및 저장을 호출하지 않는다", async () => {
    findCoverLetter.mockResolvedValue(null);
    await expectError(await POST(request()), 404);
    expect(getQuestionGenerator).not.toHaveBeenCalled();
    expect(createInterview).not.toHaveBeenCalled();
  });

  it("조회 장애와 저장된 맥락 오류는 외부 생성 전에 실패한다", async () => {
    findCoverLetter.mockRejectedValueOnce(new Error("private-detail"));
    await expectError(await POST(request()), 500);
    findCoverLetter.mockResolvedValueOnce({ ...context, essays: [] });
    await expectError(await POST(request()), 500);
    expect(getQuestionGenerator).not.toHaveBeenCalled();
    expect(createInterview).not.toHaveBeenCalled();
  });

  it.each([
    ["NOT_CONFIGURED", 503], ["UNSUPPORTED_PROVIDER", 503], ["TIMEOUT", 504],
    ["PROVIDER_FAILURE", 502], ["EMPTY_RESPONSE", 502], ["INVALID_RESPONSE", 502],
  ] as const)("AI 오류 %s를 %s로 반환하고 세션을 저장하지 않는다", async (code, status) => {
    generateMainQuestions.mockRejectedValue(new QuestionGenerationError(code));
    const response = await POST(request());
    expect(response.headers.get(INTERVIEW_NOT_CREATED_HEADER)).toBe("true");
    await expectError(response, status);
    expect(createInterview).not.toHaveBeenCalled();
  });

  it("팩토리 실패와 알 수 없는 AI 오류도 저장하지 않는다", async () => {
    getQuestionGenerator.mockImplementationOnce(() => { throw new Error("private-detail secret-key"); });
    await expectError(await POST(request()), 502);
    generateMainQuestions.mockRejectedValueOnce(new Error("private-detail secret-key"));
    await expectError(await POST(request()), 502);
    expect(createInterview).not.toHaveBeenCalled();
  });

  it.each([[], questions.slice(1), [...questions, "추가"], [" ", ...questions.slice(1)], null, "bad"].map((generated) => [generated]))("형식이 잘못된 생성 결과를 저장하지 않는다(%j)", async (generated) => {
    generateMainQuestions.mockResolvedValue(generated);
    await expectError(await POST(request()), 502);
    expect(createInterview).not.toHaveBeenCalled();
  });

  it("저장 실패/결과 유실은 성공으로 응답하지 않고 재저장도 하지 않는다", async () => {
    createInterview.mockRejectedValueOnce(new Error("private-detail secret-key"));
    const response = await POST(request());
    expect(response.headers.has(INTERVIEW_NOT_CREATED_HEADER)).toBe(false);
    await expectError(response, 500);
    expect(createInterview).toHaveBeenCalledOnce();
  });

  it.each([null, "bad-id"])("잘못된 저장 결과 %s는 성공으로 응답하지 않는다", async (result) => {
    createInterview.mockResolvedValue(result);
    await expectError(await POST(request()), 500);
  });

  it("AI 생성 도중 삭제된 카드는 404를 반환한다", async () => {
    createInterview.mockRejectedValue(new CoverLetterNotFoundError());
    await expectError(await POST(request()), 404);
  });
});
