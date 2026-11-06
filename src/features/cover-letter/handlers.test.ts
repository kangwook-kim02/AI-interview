import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createCoverLetterHandler,
  deleteCoverLetterHandler,
  getCoverLetterHandler,
  listCoverLettersHandler,
  updateCoverLetterHandler,
} from "./handlers";
import { CoverLetterNotFoundError } from "@/lib/supabase/cover-letter-errors";

const {
  getCurrentUser,
  listCoverLetters,
  findCoverLetter,
  saveCoverLetter,
  updateOwnedCoverLetter,
  deleteOwnedCoverLetter,
  revalidatePath,
} = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  listCoverLetters: vi.fn(),
  findCoverLetter: vi.fn(),
  saveCoverLetter: vi.fn(),
  updateOwnedCoverLetter: vi.fn(),
  deleteOwnedCoverLetter: vi.fn(),
  revalidatePath: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/supabase/session", () => ({ getCurrentUser }));
vi.mock("@/lib/supabase/cover-letters", () => ({
  listCoverLetters,
  findCoverLetter,
  saveCoverLetter,
  updateOwnedCoverLetter,
  deleteOwnedCoverLetter,
}));

const id = "c0090000-0000-4000-8000-000000000011";
const origin = "http://localhost:3000";
const input = {
  companyName: " 회사 ",
  jobTitle: "직무",
  essays: [
    { question: "질문2", answer: "답변2" },
    { question: "질문1", answer: "답변1" },
  ],
  experiences: [],
  userId: "attacker",
};
const context = (cardId = id) => ({ params: Promise.resolve({ id: cardId }) });
function request(method: string, value: unknown = input, requestOrigin: string | null = origin) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (requestOrigin !== null) headers.Origin = requestOrigin;
  return new Request(`${origin}/api/cover-letters/${id}`, {
    method,
    headers,
    body: ["GET", "DELETE"].includes(method) ? undefined : JSON.stringify(value),
  });
}
async function expectError(response: Response, status: number) {
  expect(response.status).toBe(status);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  const data = await response.json();
  expect(data.error).toBeTruthy();
  expect(JSON.stringify(data)).not.toContain("private details");
  return data;
}
beforeEach(() => {
  getCurrentUser.mockReset().mockResolvedValue({ id: "verified-user" });
  listCoverLetters.mockReset().mockResolvedValue([]);
  findCoverLetter.mockReset().mockResolvedValue({ id });
  saveCoverLetter.mockReset().mockResolvedValue(id);
  updateOwnedCoverLetter.mockReset().mockResolvedValue(id);
  deleteOwnedCoverLetter.mockReset().mockResolvedValue(undefined);
});

describe("자소서 REST 조회", () => {
  it("목록·상세에 서버 사용자만 사용하고 캐시하지 않는다", async () => {
    const list = await listCoverLettersHandler();
    expect(list.status).toBe(200);
    expect(await list.json()).toEqual({ coverLetters: [] });
    expect(listCoverLetters).toHaveBeenCalledExactlyOnceWith("verified-user");
    const detail = await getCoverLetterHandler(request("GET"), context());
    expect(await detail.json()).toEqual({ coverLetter: { id } });
    expect(findCoverLetter).toHaveBeenCalledExactlyOnceWith(id, "verified-user");
    expect(detail.headers.get("cache-control")).toBe("private, no-store");
  });
  it("비로그인은 리다이렉트 대신 401 JSON을 받는다", async () => {
    getCurrentUser.mockResolvedValue(null);
    await expectError(await listCoverLettersHandler(), 401);
    await expectError(await getCoverLetterHandler(request("GET"), context()), 401);
    expect(listCoverLetters).not.toHaveBeenCalled();
    expect(findCoverLetter).not.toHaveBeenCalled();
  });
  it("잘못된 ID는 400, 타인/없는 카드는 404, 조회 장애는 500이다", async () => {
    await expectError(await getCoverLetterHandler(request("GET"), context("bad")), 400);
    expect(findCoverLetter).not.toHaveBeenCalled();
    findCoverLetter.mockResolvedValueOnce(null);
    await expectError(await getCoverLetterHandler(request("GET"), context()), 404);
    listCoverLetters.mockRejectedValueOnce(new Error("private details"));
    await expectError(await listCoverLettersHandler(), 500);
  });
});

describe("자소서 REST 변경", () => {
  it.each([
    "https://evil.example",
    "http://localhost:3001",
    "https://localhost:3000",
    "http://localhost:3000.evil.example",
    "null",
    "garbage",
    null,
  ])("다른/누락 origin %s를 인증과 저장 전에 거부한다", async (requestOrigin) => {
    await expectError(await createCoverLetterHandler(request("POST", input, requestOrigin)), 403);
    await expectError(
      await updateCoverLetterHandler(request("PATCH", input, requestOrigin), context()),
      403,
    );
    await expectError(
      await deleteCoverLetterHandler(request("DELETE", undefined, requestOrigin), context()),
      403,
    );
    expect(getCurrentUser).not.toHaveBeenCalled();
    expect(saveCoverLetter).not.toHaveBeenCalled();
    expect(updateOwnedCoverLetter).not.toHaveBeenCalled();
    expect(deleteOwnedCoverLetter).not.toHaveBeenCalled();
  });
  it("모든 변경 메서드에서 인증을 확인하고 장애와 미인증을 구분한다", async () => {
    getCurrentUser.mockResolvedValue(null);
    await expectError(await createCoverLetterHandler(request("POST")), 401);
    await expectError(await updateCoverLetterHandler(request("PATCH"), context()), 401);
    await expectError(await deleteCoverLetterHandler(request("DELETE"), context()), 401);
    expect(saveCoverLetter).not.toHaveBeenCalled();
    getCurrentUser.mockRejectedValueOnce(new Error("private details"));
    await expectError(await createCoverLetterHandler(request("POST")), 500);
  });
  it.each([
    { ...input, companyName: " " },
    { ...input, essays: [] },
    { ...input, jobTitle: "x".repeat(101) },
    { ...input, experiences: [{ content: "" }] },
  ])("POST와 PATCH는 동일한 검증을 적용한다: %j", async (value) => {
    for (const response of [
      await createCoverLetterHandler(request("POST", value)),
      await updateCoverLetterHandler(request("PATCH", value), context()),
    ]) {
      expect((await expectError(response, 400)).fieldErrors).toBeTruthy();
    }
    expect(saveCoverLetter).not.toHaveBeenCalled();
    expect(updateOwnedCoverLetter).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
  it("깨진 JSON·지원하지 않는 본문·잘못된 ID는 쓰기 전에 거부한다", async () => {
    await expectError(
      await createCoverLetterHandler(
        new Request(`${origin}/api/cover-letters`, {
          method: "POST",
          headers: { Origin: origin, "Content-Type": "application/json" },
          body: "{",
        }),
      ),
      400,
    );
    await expectError(
      await createCoverLetterHandler(
        new Request(`${origin}/api/cover-letters`, {
          method: "POST",
          headers: { Origin: origin },
          body: "bad",
        }),
      ),
      400,
    );
    await expectError(await updateCoverLetterHandler(request("PATCH"), context("bad")), 400);
    await expectError(await deleteCoverLetterHandler(request("DELETE"), context("bad")), 400);
    expect(saveCoverLetter).not.toHaveBeenCalled();
    expect(updateOwnedCoverLetter).not.toHaveBeenCalled();
    expect(deleteOwnedCoverLetter).not.toHaveBeenCalled();
  });
  it("POST 201·PATCH 200은 정제된 입력과 서버 사용자를 전달하고 목록을 갱신한다", async () => {
    const created = await createCoverLetterHandler(request("POST"));
    expect(created.status).toBe(201);
    expect(created.headers.get("location")).toBe(`/api/cover-letters/${id}`);
    expect(await created.json()).toEqual({ id });
    const updated = await updateCoverLetterHandler(request("PATCH"), context());
    expect(updated.status).toBe(200);
    expect(await updated.json()).toEqual({ id });
    const sanitized = {
      companyName: "회사",
      jobTitle: input.jobTitle,
      essays: input.essays,
      experiences: [],
    };
    expect(saveCoverLetter).toHaveBeenCalledExactlyOnceWith(sanitized, "verified-user");
    expect(updateOwnedCoverLetter).toHaveBeenCalledExactlyOnceWith(id, sanitized, "verified-user");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(revalidatePath).toHaveBeenCalledWith(`/dashboard/cover-letters/${id}/edit`);
  });
  it("없는 카드와 저장 실패는 404/500이고 경로를 갱신하지 않는다", async () => {
    updateOwnedCoverLetter.mockRejectedValueOnce(new CoverLetterNotFoundError());
    await expectError(await updateCoverLetterHandler(request("PATCH"), context()), 404);
    deleteOwnedCoverLetter.mockRejectedValueOnce(new CoverLetterNotFoundError());
    await expectError(await deleteCoverLetterHandler(request("DELETE"), context()), 404);
    saveCoverLetter.mockRejectedValueOnce(new Error("private details"));
    await expectError(await createCoverLetterHandler(request("POST")), 500);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
  it("DELETE는 성공 시 본문 없는 204를 반환한다", async () => {
    const response = await deleteCoverLetterHandler(request("DELETE"), context());
    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(deleteOwnedCoverLetter).toHaveBeenCalledExactlyOnceWith(id, "verified-user");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
  });
});
