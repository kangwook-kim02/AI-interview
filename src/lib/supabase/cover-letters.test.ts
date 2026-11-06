import { describe, expect, it, vi } from "vitest";
import { saveCoverLetter } from "./cover-letters";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./server", () => ({ createServerSupabaseClient: vi.fn(async () => ({ rpc })) }));

const input = {
  companyName: "회사",
  jobTitle: "개발자",
  essays: [
    { question: "두 번째", answer: "답변2" },
    { question: "첫 번째", answer: "답변1" },
  ],
  experiences: [],
};

describe("saveCoverLetter", () => {
  it("검증된 소유자와 입력 순서를 단일 RPC에 전달한다", async () => {
    rpc.mockResolvedValueOnce({ data: "created-id", error: null });
    expect(await saveCoverLetter(input, "verified-user")).toBe("created-id");
    expect(rpc).toHaveBeenCalledExactlyOnceWith("create_cover_letter", {
      expected_user_id: "verified-user",
      company_name: "회사",
      job_title: "개발자",
      essays: input.essays,
      experiences: [],
    });
  });
  it("DB 실패를 액션으로 전달하며 성공값을 반환하지 않는다", async () => {
    const error = { code: "23514", message: "child write failed" };
    rpc.mockResolvedValueOnce({ data: null, error });
    await expect(saveCoverLetter(input, "verified-user")).rejects.toEqual(error);
  });
});
