import { beforeEach, describe, expect, it, vi } from "vitest";
import { CoverLetterNotFoundError } from "./cover-letter-errors";
import {
  deleteOwnedCoverLetter,
  findCoverLetter,
  listCoverLetters,
  saveCoverLetter,
  updateOwnedCoverLetter,
} from "./cover-letters";

const { rpc, from, select, eq, order, maybeSingle, remove } = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  order: vi.fn(),
  maybeSingle: vi.fn(),
  remove: vi.fn(),
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

describe("본인 카드 상세·수정·삭제", () => {
  const detail = {
    ...row,
    essay_items: [
      { id: "e2", position: 1, question: "두 번째", answer: "답변2" },
      { id: "e1", position: 0, question: "첫 번째", answer: "답변1" },
    ],
    experiences: [
      { id: "x2", position: 1, content: "경험2" },
      { id: "x1", position: 0, content: "경험1" },
    ],
  };
  beforeEach(() => {
    const chain = { select, eq, maybeSingle, delete: remove };
    from.mockReturnValue(chain);
    select.mockReturnValue(chain);
    eq.mockReturnValue(chain);
    remove.mockReturnValue(chain);
    maybeSingle.mockReset().mockResolvedValue({ data: structuredClone(detail), error: null });
    rpc.mockReset().mockResolvedValue({ data: detail.id, error: null });
  });
  it("ID와 사용자 필터를 적용하고 본인 문항·경험을 순서대로 반환한다", async () => {
    const result = await findCoverLetter(detail.id, "verified-user");
    expect(eq).toHaveBeenCalledWith("id", detail.id);
    expect(eq).toHaveBeenCalledWith("user_id", "verified-user");
    expect(result).toEqual({
      id: detail.id,
      companyName: detail.company_name,
      jobTitle: detail.job_title,
      essays: [
        { question: "첫 번째", answer: "답변1" },
        { question: "두 번째", answer: "답변2" },
      ],
      experiences: [{ content: "경험1" }, { content: "경험2" }],
    });
  });
  it("없는 카드는 null, 조회 실패와 반환 행 소유권 불일치는 오류로 처리한다", async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    expect(await findCoverLetter(detail.id, "verified-user")).toBeNull();
    maybeSingle.mockResolvedValueOnce({ data: null, error: { code: "failure" } });
    await expect(findCoverLetter(detail.id, "verified-user")).rejects.toEqual({ code: "failure" });
    await expect(findCoverLetter(detail.id, "other-user")).rejects.toThrow("소유권");
  });
  it("소유권 확인이 실패하면 수정 RPC와 삭제를 실행하지 않는다", async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    await expect(updateOwnedCoverLetter(detail.id, input, "verified-user")).rejects.toThrow(
      "찾을 수",
    );
    await expect(deleteOwnedCoverLetter(detail.id, "other-user")).rejects.toThrow("소유권");
    expect(rpc).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });
  it("확인된 소유자와 순서를 원자적 수정 RPC에 전달한다", async () => {
    expect(await updateOwnedCoverLetter(detail.id, input, "verified-user")).toBe(detail.id);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("update_cover_letter", {
      target_cover_letter_id: detail.id,
      expected_user_id: "verified-user",
      company_name: input.companyName,
      job_title: input.jobTitle,
      essays: input.essays,
      experiences: [],
    });
    rpc.mockResolvedValueOnce({ data: null, error: { code: "23514" } });
    await expect(updateOwnedCoverLetter(detail.id, input, "verified-user")).rejects.toEqual({
      code: "23514",
    });
  });
  it("조회 이후 동시 삭제된 카드도 식별 가능한 없는 카드 오류로 반환한다", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: "P0002" } });
    await expect(updateOwnedCoverLetter(detail.id, input, "verified-user")).rejects.toBeInstanceOf(
      CoverLetterNotFoundError,
    );
    maybeSingle
      .mockResolvedValueOnce({ data: detail, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    await expect(deleteOwnedCoverLetter(detail.id, "verified-user")).rejects.toBeInstanceOf(
      CoverLetterNotFoundError,
    );
  });
  it("삭제에도 ID·소유자 필터를 적용하고 영향 행이 없으면 실패한다", async () => {
    maybeSingle
      .mockResolvedValueOnce({ data: detail, error: null })
      .mockResolvedValueOnce({ data: { id: detail.id }, error: null });
    await deleteOwnedCoverLetter(detail.id, "verified-user");
    expect(remove).toHaveBeenCalledOnce();
    expect(eq).toHaveBeenNthCalledWith(3, "id", detail.id);
    expect(eq).toHaveBeenNthCalledWith(4, "user_id", "verified-user");
    maybeSingle
      .mockResolvedValueOnce({ data: detail, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    await expect(deleteOwnedCoverLetter(detail.id, "verified-user")).rejects.toThrow("찾을 수");
    maybeSingle
      .mockResolvedValueOnce({ data: detail, error: null })
      .mockResolvedValueOnce({ data: null, error: { code: "failure" } });
    await expect(deleteOwnedCoverLetter(detail.id, "verified-user")).rejects.toEqual({
      code: "failure",
    });
  });
});
