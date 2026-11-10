import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/interview/finish/route";
import { InterviewRequestError } from "@/lib/supabase/interview-errors";

const { getCurrentUser, finishInterview } = vi.hoisted(() => ({ getCurrentUser: vi.fn(), finishInterview: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/session", () => ({ getCurrentUser }));
vi.mock("@/lib/supabase/interview-records", () => ({ finishInterview }));
const interviewId = "c0180000-0000-4000-8000-000000000001";
const questionId = "c0180000-0000-4000-8000-000000000002";
const input = { interviewId, status: "aborted", answers: [{ questionId, answerTranscript: "확정 답변" }] };
const result = { interviewId, status: "aborted", endedAt: "2026-11-10T12:00:00Z", durationSeconds: 12 };
function request(body: unknown = input, origin: string | null = "http://localhost", contentType = "application/json") {
  return new Request("http://localhost/api/interview/finish", { method: "POST",
    headers: { ...(origin === null ? {} : { Origin: origin }), "Content-Type": contentType }, body: JSON.stringify(body),
  });
}
beforeEach(() => {
  getCurrentUser.mockReset().mockResolvedValue({ id: "server-user" });
  finishInterview.mockReset().mockResolvedValue(result);
});
describe("면접 종료 API", () => {
  it("정규화된 확정 답변과 서버 사용자로 종료하며 캐시를 막는다", async () => {
    const response = await POST(request({ ...input, answers: [{ questionId, answerTranscript: " 확정 답변 " }] }));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual(result);
    expect(finishInterview).toHaveBeenCalledExactlyOnceWith(input, "server-user");
  });
  it.each([null, "null", "https://evil.example"])("Origin %s를 인증 전에 거부한다", async (origin) => {
    expect((await POST(request(input, origin))).status).toBe(403);
    expect(getCurrentUser).not.toHaveBeenCalled();
  });
  it("미인증은 JSON 401이다", async () => {
    getCurrentUser.mockResolvedValue(null);
    expect((await POST(request())).status).toBe(401);
    expect(finishInterview).not.toHaveBeenCalled();
  });
  it.each([null, {}, { ...input, interviewId: "bad" }, { ...input, status: "in_progress" },
    { ...input, endedAt: "2026-11-10T00:00:00Z" }, { ...input, durationSeconds: 1 }, { ...input, userId: "forged" },
    { ...input, answers: [...input.answers, ...input.answers] },
    { ...input, answers: [{ questionId: "bad", answerTranscript: "답변" }] },
    { ...input, answers: [{ questionId, answerTranscript: "a".repeat(20001) }] },
  ])("잘못된 입력을 저장하지 않는다 (%j)", async (body) => {
    expect((await POST(request(body))).status).toBe(400);
    expect(finishInterview).not.toHaveBeenCalled();
  });
  it("JSON과 Content-Type 오류는 400이다", async () => {
    expect((await POST(request(input, "http://localhost", "text/plain"))).status).toBe(400);
    expect((await POST(new Request("http://localhost/api/interview/finish", { method: "POST",
      headers: { Origin: "http://localhost", "Content-Type": "application/json" }, body: "{",
    }))).status).toBe(400);
  });
  it.each([["NOT_FOUND", 404], ["CLOSED", 409], ["CONFLICT", 409]] as const)("%s는 %s다", async (code, status) => {
    finishInterview.mockRejectedValue(new InterviewRequestError(code));
    expect((await POST(request())).status).toBe(status);
  });
  it("DB 실패 시 완료를 응답하지 않고 내부 정보를 숨긴다", async () => {
    finishInterview.mockRejectedValue(new Error("private-secret"));
    const response = await POST(request());
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("private-secret");
  });
});
