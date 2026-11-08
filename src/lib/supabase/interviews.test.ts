import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAIN_QUESTION_COUNT } from "@/config/interview";
import { createInterview } from "./interviews";
import { CoverLetterNotFoundError } from "./cover-letter-errors";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./server", () => ({ createServerSupabaseClient: vi.fn(async () => ({ rpc })) }));
const coverLetterId = "c0120000-0000-4000-8000-000000000001";
const interviewId = "c0120000-0000-4000-8000-000000000002";
const userId = "c0120000-0000-4000-8000-000000000003";
const questions = Array.from({ length: MAIN_QUESTION_COUNT }, (_, i) => `질문 ${i + 1}?`);

beforeEach(() => rpc.mockReset().mockResolvedValue({ data: interviewId, error: null }));
describe("면접 원자적 저장 어댑터", () => {
  it("세션과 질문을 검증된 사용자로 단일 RPC에 전달한다", async () => {
    expect(await createInterview(coverLetterId, questions, userId)).toBe(interviewId);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("create_interview", {
      target_cover_letter_id: coverLetterId, expected_user_id: userId, questions,
    });
  });
  it("잘못된 카드 ID와 질문은 RPC 전에 거부한다", async () => {
    await expect(createInterview("bad-id", questions, userId)).rejects.toThrow();
    await expect(createInterview(coverLetterId, [], userId)).rejects.toThrow();
    await expect(createInterview(coverLetterId, [" ", ...questions.slice(1)], userId)).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });
  it("질문의 양끝 공백을 제거하고 순서는 유지한다", async () => {
    await createInterview(coverLetterId, questions.map((q) => ` ${q} `), userId);
    expect(rpc.mock.calls[0][1].questions).toEqual(questions);
  });
  it("동시 삭제/소유권 오류와 일반 저장 오류를 구분한다", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: "P0002" } });
    await expect(createInterview(coverLetterId, questions, userId)).rejects.toBeInstanceOf(CoverLetterNotFoundError);
    const error = { code: "23514", message: "child insert failure" };
    rpc.mockResolvedValueOnce({ data: null, error });
    await expect(createInterview(coverLetterId, questions, userId)).rejects.toEqual(error);
  });
  it.each([null, "", "not-a-uuid"])("잘못된 반환 ID %s를 성공으로 처리하지 않는다", async (data) => {
    rpc.mockResolvedValueOnce({ data, error: null });
    await expect(createInterview(coverLetterId, questions, userId)).rejects.toThrow();
  });
});
