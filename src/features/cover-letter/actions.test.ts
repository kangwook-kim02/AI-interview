import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCoverLetter } from "./actions";

const { getCurrentUser, saveCoverLetter, redirect, revalidatePath } = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  saveCoverLetter: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/supabase/session", () => ({ getCurrentUser }));
vi.mock("@/lib/supabase/cover-letters", () => ({ saveCoverLetter }));

const input = {
  companyName: " 회사 ",
  jobTitle: "개발자",
  essays: [
    { question: "질문2", answer: "답변2" },
    { question: "질문1", answer: "답변1" },
  ],
  experiences: [{ content: "경험" }],
  userId: "attacker",
};
function form(value: unknown = input) {
  const data = new FormData();
  data.set("payload", JSON.stringify(value));
  return data;
}
beforeEach(() => {
  getCurrentUser.mockReset().mockResolvedValue({ id: "verified-user" });
  saveCoverLetter.mockReset().mockResolvedValue("created-id");
});

describe("createCoverLetter", () => {
  it("잘못된 입력은 필드 안내를 반환하고 저장하지 않는다", async () => {
    const result = await createCoverLetter({}, form({ ...input, essays: [] }));
    expect(result.fieldErrors?.essays).toBeTruthy();
    expect(saveCoverLetter).not.toHaveBeenCalled();
  });
  it("깨진 JSON과 누락 payload를 거부한다", async () => {
    const data = new FormData();
    expect((await createCoverLetter({}, data)).error).toBeTruthy();
    data.set("payload", "{");
    expect((await createCoverLetter({}, data)).error).toBeTruthy();
    expect(saveCoverLetter).not.toHaveBeenCalled();
  });
  it("비로그인 요청을 저장하지 않는다", async () => {
    getCurrentUser.mockResolvedValueOnce(null);
    expect((await createCoverLetter({}, form())).error).toContain("로그인");
    expect(saveCoverLetter).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });
  it("인증 조회 장애와 저장 실패를 안내하며 리다이렉트하지 않는다", async () => {
    getCurrentUser.mockRejectedValueOnce(new Error("private details"));
    expect((await createCoverLetter({}, form())).error).toContain("저장하지 못했어요");
    saveCoverLetter.mockRejectedValueOnce(new Error("private DB details"));
    const result = await createCoverLetter({}, form());
    expect(result.error).toContain("작성한 내용은 그대로");
    expect(result.error).not.toContain("private");
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });
  it("검증한 사용자와 정제한 입력을 저장하고 성공 시에만 대시보드로 보낸다", async () => {
    await expect(createCoverLetter({}, form())).rejects.toThrow("REDIRECT:/dashboard");
    expect(saveCoverLetter).toHaveBeenCalledWith(
      {
        companyName: "회사",
        jobTitle: "개발자",
        essays: input.essays,
        experiences: input.experiences,
      },
      "verified-user",
    );
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
  });
});
