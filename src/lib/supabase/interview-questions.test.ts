import { beforeEach, describe, expect, it, vi } from "vitest";
import { listInterviewQuestions } from "./interview-questions";

const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./server", () => ({ createServerSupabaseClient: async () => ({ from }) }));
const id = "c0170000-0000-4000-8000-000000000001";
const questions = Array.from({ length: 4 }, (_, index) => ({
  id: `c0170000-0000-4000-8000-${String(index + 2).padStart(12, "0")}`,
  interview_id: id, type: "main", parent_question_id: null, order_index: index,
}));
const session = { id, user_id: "owner", interview_questions: questions };
function query(data: unknown, error: unknown = null) {
  const builder = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(async () => ({ data, error })) };
  builder.select.mockReturnValue(builder); builder.eq.mockReturnValue(builder);
  from.mockReturnValue(builder);
  return builder;
}
beforeEach(() => { from.mockReset(); query(session); });
describe("면접 질문 위치 DB 어댑터", () => {
  it("소유권 필터를 걸고 메인 부모와 꼬리 순서를 변환한다", async () => {
    const child = { ...questions[0], id: "c0170000-0000-4000-8000-000000000008", type: "follow_up", parent_question_id: questions[0].id, order_index: 1 };
    const builder = query({ ...session, interview_questions: [child, ...questions] });
    const result = await listInterviewQuestions(id, "owner");
    expect(builder.eq.mock.calls).toEqual([["id", id], ["user_id", "owner"]]);
    expect(result.questions[0]).toEqual({ id: child.id, mainQuestionIndex: 0, followUpIndex: 2 });
    expect(result.questions[4]).toEqual({ id: questions[3].id, mainQuestionIndex: 3, followUpIndex: 0 });
  });
  it("없는 면접과 반환 소유권 불일치도 거부한다", async () => {
    query(null);
    await expect(listInterviewQuestions(id, "owner")).rejects.toMatchObject({ code: "NOT_FOUND" });
    query({ ...session, user_id: "other" });
    await expect(listInterviewQuestions(id, "owner")).rejects.toThrow("owner mismatch");
  });
  it("DB 장애·면접이 다른 질문·부모가 없는 꼬리를 성공 처리하지 않는다", async () => {
    query(null, new Error("DB failure"));
    await expect(listInterviewQuestions(id, "owner")).rejects.toThrow("DB failure");
    query({ ...session, interview_questions: questions.map((q) => ({ ...q, interview_id: "other" })) });
    await expect(listInterviewQuestions(id, "owner")).rejects.toThrow("question mismatch");
    query({ ...session, interview_questions: [...questions, { ...questions[0], type: "follow_up", parent_question_id: "missing" }] });
    await expect(listInterviewQuestions(id, "owner")).rejects.toThrow("Missing main");
  });
});
