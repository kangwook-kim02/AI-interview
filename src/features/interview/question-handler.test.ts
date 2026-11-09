import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/interview/[interviewId]/questions/route";
import { InterviewRequestError } from "@/lib/supabase/interview-errors";

const { getCurrentUser, listInterviewQuestions } = vi.hoisted(() => ({ getCurrentUser: vi.fn(), listInterviewQuestions: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/session", () => ({ getCurrentUser }));
vi.mock("@/lib/supabase/interview-questions", () => ({ listInterviewQuestions }));
const id = "c0170000-0000-4000-8000-000000000001";
const get = (interviewId = id) => GET(new Request(`http://localhost/api/interview/${interviewId}/questions`), { params: Promise.resolve({ interviewId }) });
beforeEach(() => {
  getCurrentUser.mockReset().mockResolvedValue({ id: "verified-user" });
  listInterviewQuestions.mockReset().mockResolvedValue({ questions: [] });
});
describe("면접 질문 위치 조회 API", () => {
  it("검증된 사용자로 조회하고 캐시를 막는다", async () => {
    const response = await get();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ questions: [] });
    expect(listInterviewQuestions).toHaveBeenCalledExactlyOnceWith(id, "verified-user");
  });
  it("비로그인과 잘못된 UUID는 조회하지 않는다", async () => {
    getCurrentUser.mockResolvedValueOnce(null);
    expect((await get()).status).toBe(401);
    expect((await get("invalid")).status).toBe(400);
    expect(listInterviewQuestions).not.toHaveBeenCalled();
  });
  it("없는/타인 면접은 동일한 404이고 내부 오류를 숨긴다", async () => {
    listInterviewQuestions.mockRejectedValueOnce(new InterviewRequestError("NOT_FOUND"));
    expect((await get()).status).toBe(404);
    listInterviewQuestions.mockRejectedValueOnce(new Error("private detail"));
    const response = await get();
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("private detail");
    getCurrentUser.mockRejectedValueOnce(new Error("auth detail"));
    expect((await get()).status).toBe(500);
  });
});
