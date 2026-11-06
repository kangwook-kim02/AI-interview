import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCoverLetterDashboard } from "./queries";

const { getCurrentUser, listCoverLetters, redirect } = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  listCoverLetters: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/supabase/session", () => ({ getCurrentUser }));
vi.mock("@/lib/supabase/cover-letters", () => ({ listCoverLetters }));

beforeEach(() => {
  getCurrentUser.mockReset().mockResolvedValue({ id: "verified-user" });
  listCoverLetters.mockReset().mockResolvedValue([]);
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
