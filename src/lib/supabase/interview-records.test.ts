import { beforeEach, describe, expect, it, vi } from "vitest";
import { findSavedInterview, finishInterview, saveInterviewAnswer } from "./interview-records";

const { rpc, from } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./server", () => ({ createServerSupabaseClient: async () => ({ rpc, from }) }));
const interviewId = "c0180000-0000-4000-8000-000000000001";
const questionId = "c0180000-0000-4000-8000-000000000002";
const input = { interviewId, status: "aborted" as const, answers: [{ questionId, answerTranscript: "확정 답변" }] };
const result = { interviewId, status: "aborted", endedAt: "2026-11-10T12:00:00+00:00", durationSeconds: 12 };
beforeEach(() => { rpc.mockReset().mockResolvedValue({ data: result, error: null }); from.mockReset(); });
describe("면접 기록 DB 어댑터", () => {
  it("시각을 보내지 않고 소유권 검증용 서버 사용자와 단일 종료 RPC를 호출한다", async () => {
    expect(await finishInterview(input, "server-user")).toEqual(result);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("finish_interview", {
      target_interview_id: interviewId, expected_user_id: "server-user", end_status: "aborted", answers: input.answers,
    });
  });
  it("정규화된 답변만 질문 UUID에 저장한다", async () => {
    await saveInterviewAnswer({ interviewId, questionId, answerTranscript: " 답변 " }, "server-user");
    expect(rpc).toHaveBeenCalledWith("save_interview_answer", {
      target_interview_id: interviewId, source_question_id: questionId, expected_user_id: "server-user", answer: "답변",
    });
  });
  it.each([["P0002", "NOT_FOUND"], ["P0010", "CLOSED"], ["P0011", "CONFLICT"]])("RPC %s를 %s로 변환한다", async (code, expected) => {
    rpc.mockResolvedValue({ data: null, error: { code } });
    await expect(finishInterview(input, "user")).rejects.toMatchObject({ code: expected });
    await expect(saveInterviewAnswer({ interviewId, questionId, answerTranscript: "" }, "user")).rejects.toMatchObject({ code: expected });
  });
  it.each([{}, { ...result, interviewId: questionId }, { ...result, status: "completed" },
    { ...result, durationSeconds: -1 }, { ...result, endedAt: null }])("잘못된 저장 응답은 성공이 아니다", async (data) => {
    rpc.mockResolvedValue({ data, error: null });
    await expect(finishInterview(input, "user")).rejects.toThrow();
  });
  it("RPC 오류와 잘못된 입력을 성공 처리하지 않는다", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "23514" } });
    await expect(finishInterview(input, "user")).rejects.toEqual({ code: "23514" });
    rpc.mockClear();
    await expect(finishInterview({ ...input, interviewId: "bad" }, "user")).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });
  it("결과 조회는 사용자와 카드 경로를 함께 검사한다", async () => {
    const row = { id: interviewId, cover_letter_id: questionId, user_id: "user", status: result.status,
      ended_at: result.endedAt, duration_seconds: 12 };
    const builder = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }) };
    builder.select.mockReturnValue(builder); builder.eq.mockReturnValue(builder); from.mockReturnValue(builder);
    expect(await findSavedInterview(questionId, interviewId, "user")).toEqual(result);
    expect(builder.eq.mock.calls).toEqual([["id", interviewId], ["cover_letter_id", questionId], ["user_id", "user"]]);
    builder.maybeSingle.mockResolvedValue({ data: { ...row, user_id: "peer" }, error: null });
    await expect(findSavedInterview(questionId, interviewId, "user")).rejects.toThrow("mismatch");
    builder.maybeSingle.mockResolvedValue({ data: { ...row, status: "in_progress" }, error: null });
    expect(await findSavedInterview(questionId, interviewId, "user")).toBeNull();
  });
});
