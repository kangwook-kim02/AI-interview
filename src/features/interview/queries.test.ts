import { beforeEach, describe, expect, it, vi } from "vitest";
import { getInterviewPreparation } from "./queries";

const { getCurrentUser, findCoverLetter } = vi.hoisted(() => ({
  getCurrentUser: vi.fn(), findCoverLetter: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); },
  notFound: () => { throw new Error("NOT_FOUND"); },
}));
vi.mock("@/lib/supabase/session", () => ({ getCurrentUser }));
vi.mock("@/lib/supabase/cover-letters", () => ({ findCoverLetter }));

const id = "c0100000-0000-4000-8000-000000000001";
beforeEach(() => {
  getCurrentUser.mockReset().mockResolvedValue({ id: "verified-user" });
  findCoverLetter.mockReset().mockResolvedValue(null);
});

describe("면접 준비 조회", () => {
  it("미인증은 데이터를 조회하지 않고 로그인으로 보낸다", async () => {
    getCurrentUser.mockResolvedValue(null);
    await expect(getInterviewPreparation(id)).rejects.toThrow("REDIRECT:/login");
    expect(findCoverLetter).not.toHaveBeenCalled();
  });

  it("잘못된 ID와 없는/타인 카드를 동일하게 숨긴다", async () => {
    await expect(getInterviewPreparation("invalid")).rejects.toThrow("NOT_FOUND");
    expect(findCoverLetter).not.toHaveBeenCalled();
    await expect(getInterviewPreparation(id)).rejects.toThrow("NOT_FOUND");
    expect(findCoverLetter).toHaveBeenCalledWith(id, "verified-user");
  });

  it("본인 카드의 표시 정보만 클라이언트로 전달한다", async () => {
    findCoverLetter.mockResolvedValue({ id, companyName: "우리회사", jobTitle: "개발자", essays: ["private"] });
    expect(await getInterviewPreparation(id)).toEqual({ status: "success", companyName: "우리회사", jobTitle: "개발자" });
  });

  it("조회 오류는 내부 정보 없는 오류 상태를 반환한다", async () => {
    findCoverLetter.mockRejectedValue(new Error("private DB detail"));
    expect(await getInterviewPreparation(id)).toEqual({ status: "error" });
  });
});
