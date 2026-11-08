import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/interview/follow-up/route";
import { ANSWER_TRANSCRIPT_MAX_LENGTH, INTERVIEW_FOLLOW_UP_API_PATH } from "@/config/interview";
import { QuestionGenerationError } from "@/lib/ai/errors";
import { InterviewRequestError } from "@/lib/supabase/interview-errors";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(), loadFollowUpState: vi.fn(), saveFollowUp: vi.fn(),
  findCoverLetter: vi.fn(), getQuestionGenerator: vi.fn(), generateFollowUp: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/session", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/supabase/cover-letters", () => ({ findCoverLetter: mocks.findCoverLetter }));
vi.mock("@/lib/supabase/interview-follow-ups", () => mocks);
vi.mock("@/lib/ai", async () => ({ ...await import("@/lib/ai/errors"), ...mocks }));

const userId = "c0150000-0000-4000-8000-000000000001";
const interviewId = "c0150000-0000-4000-8000-000000000002";
const questionId = "c0150000-0000-4000-8000-000000000003";
const coverLetterId = "c0150000-0000-4000-8000-000000000004";
const input = { interviewId, questionId, answerTranscript: "확정한 답변" };
const context = { companyName: "회사", jobTitle: "개발자", essays: [{ question: "지원 동기", answer: "협업 경험" }], experiences: [] };
const state = { coverLetterId, question: "직전 질문?", previousFollowUps: ["이미 한 꼬리질문?"], atLimit: false, decision: null };
const origin = "http://localhost:3000";
function request(body: unknown = input, from: string | null = origin, contentType = "application/json") {
  return new Request(`${origin}${INTERVIEW_FOLLOW_UP_API_PATH}`, {
    method: "POST", headers: { ...(from === null ? {} : { Origin: from }), "Content-Type": contentType },
    body: JSON.stringify(body),
  });
}
async function expectError(response: Response, status: number) {
  expect(response.status).toBe(status);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(await response.json()).toEqual({ error: expect.any(String) });
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.getCurrentUser.mockResolvedValue({ id: userId });
  mocks.loadFollowUpState.mockResolvedValue(state);
  mocks.findCoverLetter.mockResolvedValue({ id: coverLetterId, ...context });
  mocks.getQuestionGenerator.mockReturnValue({ generateFollowUp: mocks.generateFollowUp });
  mocks.generateFollowUp.mockResolvedValue("새 꼬리질문?");
  mocks.saveFollowUp.mockImplementation(async (_input, result) => result);
});

describe("꼬리질문 API", () => {
  it("저장된 전체 맥락과 확정 답변을 생성기에 전달하고 실제 저장 결과를 응답한다", async () => {
    mocks.saveFollowUp.mockResolvedValue({ followUp: "동시 요청이 먼저 저장한 질문?" });
    const response = await POST(request({ ...input, answerTranscript: " 확정한 답변\n" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ followUp: "동시 요청이 먼저 저장한 질문?" });
    expect(mocks.loadFollowUpState).toHaveBeenCalledWith(input, userId);
    expect(mocks.findCoverLetter).toHaveBeenCalledWith(coverLetterId, userId);
    expect(mocks.generateFollowUp).toHaveBeenCalledWith({
      ctx: context, question: state.question, answerTranscript: input.answerTranscript,
      previousFollowUps: state.previousFollowUps,
    });
    expect(mocks.saveFollowUp).toHaveBeenCalledWith(input, { followUp: "새 꼬리질문?" }, userId);
  });
  it("불필요한 꼬리질문의 null도 저장한다", async () => {
    mocks.generateFollowUp.mockResolvedValue(null);
    expect(await (await POST(request())).json()).toEqual({ followUp: null });
    expect(mocks.saveFollowUp).toHaveBeenCalledWith(input, { followUp: null }, userId);
  });
  it.each([null, "저장된 질문?"])("기존 결과 %s는 AI 없이 저장 시 상태를 재확인한다", async (followUp) => {
    mocks.loadFollowUpState.mockResolvedValue({ ...state, decision: { followUp } });
    expect(await (await POST(request())).json()).toEqual({ followUp });
    expect(mocks.saveFollowUp).toHaveBeenCalledWith(input, { followUp }, userId);
    expect(mocks.getQuestionGenerator).not.toHaveBeenCalled();
    expect(mocks.findCoverLetter).not.toHaveBeenCalled();
  });
  it("상한 도달과 빈 전사는 AI 없이 null로 확정한다", async () => {
    mocks.loadFollowUpState.mockResolvedValueOnce({ ...state, atLimit: true });
    expect(await (await POST(request())).json()).toEqual({ followUp: null });
    expect(await (await POST(request({ ...input, answerTranscript: " \n" }))).json()).toEqual({ followUp: null });
    expect(mocks.getQuestionGenerator).not.toHaveBeenCalled();
    expect(mocks.saveFollowUp).toHaveBeenLastCalledWith({ ...input, answerTranscript: "" }, { followUp: null }, userId);
  });
  it.each([null, "null", "https://evil.example"])("잘못된 Origin %s를 인증 전에 거부한다", async (from) => {
    await expectError(await POST(request(input, from)), 403);
    expect(mocks.getCurrentUser).not.toHaveBeenCalled();
  });
  it("비로그인은 JSON 401이며 조회하지 않는다", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    await expectError(await POST(request()), 401);
    expect(mocks.loadFollowUpState).not.toHaveBeenCalled();
  });
  it.each([null, {}, { ...input, questionId: "bad" }, { ...input, interviewId: "bad" },
    { ...input, answerTranscript: null }, { ...input, userId }, { ...input, previousFollowUps: [] },
    { ...input, answerTranscript: "a".repeat(ANSWER_TRANSCRIPT_MAX_LENGTH + 1) },
  ])("잘못된 입력/위조를 거부한다 (%j)", async (body) => {
    await expectError(await POST(request(body)), 400);
    expect(mocks.loadFollowUpState).not.toHaveBeenCalled();
  });
  it("잘못된 Content-Type과 JSON을 거부한다", async () => {
    await expectError(await POST(request(input, origin, "text/plain")), 400);
    await expectError(await POST(new Request(`${origin}${INTERVIEW_FOLLOW_UP_API_PATH}`, {
      method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: "{",
    })), 400);
  });
  it.each([["NOT_FOUND", 404], ["CLOSED", 409], ["CONFLICT", 409]] as const)("조회/저장 시 %s를 %s로 구분한다", async (code, status) => {
    mocks.loadFollowUpState.mockRejectedValueOnce(new InterviewRequestError(code));
    await expectError(await POST(request()), status);
    expect(mocks.getQuestionGenerator).not.toHaveBeenCalled();
    mocks.saveFollowUp.mockRejectedValueOnce(new InterviewRequestError(code));
    await expectError(await POST(request()), status);
  });
  it.each([["TIMEOUT", 504], ["NOT_CONFIGURED", 503], ["UNSUPPORTED_PROVIDER", 503],
    ["PROVIDER_FAILURE", 502], ["INVALID_RESPONSE", 502], ["EMPTY_RESPONSE", 502]] as const)("AI %s 실패를 %s로 구분하며 저장하지 않는다", async (code, status) => {
    mocks.generateFollowUp.mockRejectedValue(new QuestionGenerationError(code));
    await expectError(await POST(request()), status);
    expect(mocks.saveFollowUp).not.toHaveBeenCalled();
  });
  it.each([undefined, " ", [], {}])("잘못된 AI 결과 %j는 502다", async (value) => {
    mocks.generateFollowUp.mockResolvedValue(value);
    await expectError(await POST(request()), 502);
    expect(mocks.saveFollowUp).not.toHaveBeenCalled();
  });
  it("공백을 제거해 저장하고 경험이 없는 자소서도 허용한다", async () => {
    mocks.generateFollowUp.mockResolvedValue(" 새 질문?\n");
    expect(await (await POST(request())).json()).toEqual({ followUp: "새 질문?" });
  });
  it("삭제된 자소서와 DB/인증 장애를 구분하며 내부 정보를 숨긴다", async () => {
    mocks.findCoverLetter.mockResolvedValueOnce(null);
    await expectError(await POST(request()), 404);
    mocks.getCurrentUser.mockRejectedValueOnce(new Error("secret-key private-detail"));
    await expectError(await POST(request()), 500);
    mocks.saveFollowUp.mockRejectedValueOnce(new Error("secret-key private-detail"));
    await expectError(await POST(request()), 500);
  });
  it("생성 중에는 아직 저장하지 않는다", async () => {
    let resolve!: (result: string) => void;
    mocks.generateFollowUp.mockReturnValue(new Promise<string>((r) => { resolve = r; }));
    const pending = POST(request());
    await vi.waitFor(() => expect(mocks.generateFollowUp).toHaveBeenCalledOnce());
    expect(mocks.saveFollowUp).not.toHaveBeenCalled();
    resolve("완료된 질문?");
    expect((await pending).status).toBe(200);
  });
});
