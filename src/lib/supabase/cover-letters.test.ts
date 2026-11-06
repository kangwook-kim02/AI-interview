import { describe, expect, it, vi } from "vitest";
import { listCoverLetters, saveCoverLetter } from "./cover-letters";

const { rpc, from, select, eq, order } = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  order: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("./server", () => ({ createServerSupabaseClient: vi.fn(async () => ({ rpc, from })) }));

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

function mockListResult(data: unknown, error: unknown = null) {
  from.mockReturnValue({ select });
  select.mockReturnValue({ eq });
  eq.mockReturnValue({ order });
  order.mockReturnValueOnce({ order }).mockResolvedValueOnce({ data, error });
}

const row = {
  id: "cover-id",
  user_id: "verified-user",
  company_name: "회사",
  job_title: "개발자",
  created_at: "2026-11-06T00:00:00Z",
  essay_items: [{ count: 3 }],
};

describe("listCoverLetters", () => {
  it("소유권 필터와 집계만 조회하고, 소유자 ID와 본문을 반환하지 않는다", async () => {
    mockListResult([row]);
    expect(await listCoverLetters("verified-user")).toEqual([
      {
        id: row.id,
        company_name: row.company_name,
        job_title: row.job_title,
        created_at: row.created_at,
        essayCount: 3,
      },
    ]);
    expect(from).toHaveBeenCalledWith("cover_letters");
    expect(select).toHaveBeenCalledExactlyOnceWith(
      "id, user_id, company_name, job_title, created_at, essay_items(count)",
    );
    expect(eq).toHaveBeenCalledExactlyOnceWith("user_id", "verified-user");
    expect(order).toHaveBeenNthCalledWith(1, "created_at", { ascending: false });
    expect(order).toHaveBeenNthCalledWith(2, "id", { ascending: false });
  });
  it("자소서가 없으면 빈 배열을 반환한다", async () => {
    mockListResult([]);
    expect(await listCoverLetters("verified-user")).toEqual([]);
  });
  it("문항이 없는 카드도 목록에서 제외하지 않는다", async () => {
    mockListResult([{ ...row, essay_items: [{ count: 0 }] }]);
    expect((await listCoverLetters("verified-user"))[0].essayCount).toBe(0);
  });
  it("DB 실패를 빈 목록으로 숨기지 않는다", async () => {
    const error = { code: "42501", message: "private DB details" };
    mockListResult(null, error);
    await expect(listCoverLetters("verified-user")).rejects.toEqual(error);
  });
  it("다른 사용자의 행이 섞이면 어떤 카드도 반환하지 않는다", async () => {
    mockListResult([row, { ...row, id: "other-cover", user_id: "other-user" }]);
    await expect(listCoverLetters("verified-user")).rejects.toThrow("소유권");
  });
});
