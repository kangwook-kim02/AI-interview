import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCoverLetterDashboard, getCoverLetterForEdit } from "./queries";

const { getCurrentUser, listCoverLetters, findCoverLetter, notFound, redirect } = vi.hoisted(
  () => ({
    getCurrentUser: vi.fn(),
    listCoverLetters: vi.fn(),
    findCoverLetter: vi.fn(),
    notFound: vi.fn(() => {
      throw new Error("NOT_FOUND");
    }),
    redirect: vi.fn((path: string) => {
      throw new Error(`REDIRECT:${path}`);
    }),
  }),
);
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect, notFound }));
vi.mock("@/lib/supabase/session", () => ({ getCurrentUser }));
vi.mock("@/lib/supabase/cover-letters", () => ({ listCoverLetters, findCoverLetter }));

beforeEach(() => {
  getCurrentUser.mockReset().mockResolvedValue({ id: "verified-user" });
  listCoverLetters.mockReset().mockResolvedValue([]);
  findCoverLetter.mockReset().mockResolvedValue(null);
});

describe("getCoverLetterForEdit", () => {
  const id = "c0090000-0000-4000-8000-000000000001";
  it("비로그인 요청은 상세 조회 없이 로그인으로 보낸다", async () => {
    getCurrentUser.mockResolvedValueOnce(null);
    await expect(getCoverLetterForEdit(id)).rejects.toThrow("REDIRECT:/login");
    expect(findCoverLetter).not.toHaveBeenCalled();
  });
  it("잘못된 ID·없는 카드·타인 카드는 같은 not-found 처리한다", async () => {
    await expect(getCoverLetterForEdit("bad-id")).rejects.toThrow("NOT_FOUND");
    expect(findCoverLetter).not.toHaveBeenCalled();
    await expect(getCoverLetterForEdit(id)).rejects.toThrow("NOT_FOUND");
    expect(findCoverLetter).toHaveBeenCalledWith(id, "verified-user");
  });
  it("본인 상세를 반환하고 조회 오류는 not-found와 구별한다", async () => {
    const detail = { id, companyName: "회사", jobTitle: "직무", essays: [], experiences: [] };
    findCoverLetter.mockResolvedValueOnce(detail);
    expect(await getCoverLetterForEdit(id)).toEqual({ status: "success", coverLetter: detail });
    findCoverLetter.mockRejectedValueOnce(new Error("private DB error"));
    expect(await getCoverLetterForEdit(id)).toEqual({ status: "error" });
    expect(notFound).not.toHaveBeenCalled();
  });
});

describe("getCoverLetterDashboard", () => {
  it("미인증 요청은 데이터를 조회하지 않고 로그인으로 보낸다", async () => {
    getCurrentUser.mockResolvedValueOnce(null);
    await expect(getCoverLetterDashboard()).rejects.toThrow("REDIRECT:/login");
    expect(listCoverLetters).not.toHaveBeenCalled();
  });
  it("서버에서 확인한 사용자의 카드를 반환한다", async () => {
    const cards = [{ id: "my-cover" }];
    listCoverLetters.mockResolvedValueOnce(cards);
    expect(await getCoverLetterDashboard()).toEqual({ status: "success", coverLetters: cards });
    expect(listCoverLetters).toHaveBeenCalledExactlyOnceWith("verified-user");
  });
  it("빈 목록은 성공 상태로 반환한다", async () => {
    expect(await getCoverLetterDashboard()).toEqual({ status: "success", coverLetters: [] });
  });
  it("조회 실패는 카드와 내부 오류 없이 반환한다", async () => {
    listCoverLetters.mockRejectedValueOnce(new Error("private DB details"));
    expect(await getCoverLetterDashboard()).toEqual({ status: "error" });
    expect(redirect).not.toHaveBeenCalled();
  });
  it("인증 확인 실패 시 목록을 조회하지 않는다", async () => {
    getCurrentUser.mockRejectedValueOnce(new Error("auth unavailable"));
    await expect(getCoverLetterDashboard()).rejects.toThrow("auth unavailable");
    expect(listCoverLetters).not.toHaveBeenCalled();
  });
});
