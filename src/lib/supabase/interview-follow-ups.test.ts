import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadFollowUpState, saveFollowUp } from "./interview-follow-ups";
import { InterviewRequestError } from "./interview-errors";

const { from, rpc } = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./server", () => ({ createServerSupabaseClient: vi.fn(async () => ({ from, rpc })) }));
const userId = "c0150000-0000-4000-8000-000000000001";
const interviewId = "c0150000-0000-4000-8000-000000000002";
const questionId = "c0150000-0000-4000-8000-000000000003";
const childId = "c0150000-0000-4000-8000-000000000004";
const input = { interviewId, questionId, answerTranscript: "확정 답변" };
const main = { id: questionId, interview_id: interviewId, parent_question_id: null, type: "main", order_index: 0, question_text: "메인 질문?" };
const child = { ...main, id: childId, parent_question_id: questionId, type: "follow_up", question_text: "첫 꼬리질문?" };
const session = { id: interviewId, user_id: userId, cover_letter_id: "card", status: "in_progress", interview_questions: [main] };
function query(data: unknown, error: unknown = null) {
  const builder = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(async () => ({ data, error })) };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  return builder;
}
let sessionQuery: ReturnType<typeof query>;
let decisionQuery: ReturnType<typeof query>;
beforeEach(() => {
  from.mockReset(); rpc.mockReset().mockResolvedValue({ data: { followUp: "확정 질문?" }, error: null });
  sessionQuery = query(session); decisionQuery = query(null);
  from.mockImplementation((table) => table === "interviews" ? sessionQuery : decisionQuery);
});
describe("꼬리질문 DB 어댑터", () => {
  it("서버 소유권 필터와 질문 소속을 검증하고 저장된 맥락을 반환한다", async () => {
    expect(await loadFollowUpState(input, userId)).toEqual({
      coverLetterId: "card", question: "메인 질문?", previousFollowUps: [], atLimit: false, decision: null,
    });
    expect(sessionQuery.eq.mock.calls).toEqual([["id", interviewId], ["user_id", userId]]);
    expect(decisionQuery.eq.mock.calls).toEqual([["question_id", questionId], ["interview_id", interviewId]]);
  });
  it("꼬리질문을 메인 부모 기준 순서로 읽고 상한을 인식한다", async () => {
    const second = { ...child, id: "second", order_index: 1, question_text: "두 번째?" };
    sessionQuery = query({ ...session, interview_questions: [second, main, child] });
    const result = await loadFollowUpState({ ...input, questionId: "second" }, userId);
    expect(result.previousFollowUps).toEqual(["첫 꼬리질문?", "두 번째?"]);
    expect(result.question).toBe("두 번째?"); expect(result.atLimit).toBe(true);
  });
  it.each(["질문?", null])("저장된 %s 결과를 재사용하고 다른 답변은 거부한다", async (follow_up) => {
    decisionQuery = query({ question_id: questionId, interview_id: interviewId, answer_transcript: input.answerTranscript, follow_up });
    expect((await loadFollowUpState(input, userId)).decision).toEqual({ followUp: follow_up });
    await expect(loadFollowUpState({ ...input, answerTranscript: "다른 답변" }, userId)).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it.each([
    [null, "NOT_FOUND"], [{ ...session, status: "completed" }, "CLOSED"],
    [{ ...session, status: "aborted" }, "CLOSED"],
    [{ ...session, interview_questions: [] }, "NOT_FOUND"],
    [{ ...session, interview_questions: [{ ...main, interview_id: "other" }] }, "NOT_FOUND"],
  ])("없는/종료/다른 면접 질문을 거부한다", async (data, code) => {
    sessionQuery = query(data);
    await expect(loadFollowUpState(input, userId)).rejects.toMatchObject({ code });
  });
  it("반환 소유자가 서버 계정과 달라도 거부한다", async () => {
    sessionQuery = query({ ...session, user_id: "attacker" });
    await expect(loadFollowUpState(input, userId)).rejects.toThrow("owner mismatch");
  });
  it("기존 판단이 없는 과거 질문과 잘못된 부모를 거부한다", async () => {
    sessionQuery = query({ ...session, interview_questions: [main, child] });
    await expect(loadFollowUpState(input, userId)).rejects.toMatchObject({ code: "CONFLICT" });
    sessionQuery = query({ ...session, interview_questions: [child] });
    await expect(loadFollowUpState({ ...input, questionId: childId }, userId)).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("조회 오류를 성공/404로 감추지 않는다", async () => {
    sessionQuery = query(null, new Error("DB failure"));
    await expect(loadFollowUpState(input, userId)).rejects.toThrow("DB failure");
    sessionQuery = query(session); decisionQuery = query(null, new Error("decision failure"));
    await expect(loadFollowUpState(input, userId)).rejects.toThrow("decision failure");
  });
  it("정규화된 입력과 서버 계정으로 단일 RPC를 호출하고 확정된 결과를 반환한다", async () => {
    expect(await saveFollowUp({ ...input, answerTranscript: " 확정 답변 " }, { followUp: " 생성 질문? " }, userId))
      .toEqual({ followUp: "확정 질문?" });
    expect(rpc).toHaveBeenCalledWith("save_interview_follow_up", {
      target_interview_id: interviewId, source_question_id: questionId, expected_user_id: userId,
      answer: input.answerTranscript, generated_follow_up: "생성 질문?",
    });
    rpc.mockResolvedValue({ data: { followUp: null }, error: null });
    expect(await saveFollowUp(input, { followUp: null }, userId)).toEqual({ followUp: null });
    expect(rpc.mock.calls.at(-1)?.[1].generated_follow_up).toBeUndefined();
  });
  it.each([["P0002", "NOT_FOUND"], ["P0010", "CLOSED"], ["P0011", "CONFLICT"]])("RPC %s를 %s로 매핑한다", async (code, expected) => {
    rpc.mockResolvedValue({ data: null, error: { code } });
    await expect(saveFollowUp(input, { followUp: null }, userId)).rejects.toBeInstanceOf(InterviewRequestError);
    await expect(saveFollowUp(input, { followUp: null }, userId)).rejects.toMatchObject({ code: expected });
  });
  it("일반 RPC 실패와 잘못된 반환값을 성공 처리하지 않는다", async () => {
    const error = { code: "23514" };
    rpc.mockResolvedValueOnce({ data: null, error });
    await expect(saveFollowUp(input, { followUp: null }, userId)).rejects.toEqual(error);
    rpc.mockResolvedValueOnce({ data: {}, error: null });
    await expect(saveFollowUp(input, { followUp: null }, userId)).rejects.toThrow();
    await expect(saveFollowUp({ ...input, questionId: "bad" }, { followUp: null }, userId)).rejects.toThrow();
    expect(rpc).toHaveBeenCalledTimes(2);
  });
});
