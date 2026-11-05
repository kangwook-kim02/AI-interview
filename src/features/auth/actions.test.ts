import { AuthApiError } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { signIn, signOut, signUp } from "./actions";

const { signInWithPassword, signUpFn, signOutFn, redirect, revalidatePath } = vi.hoisted(
  () => ({
    signInWithPassword: vi.fn(),
    signUpFn: vi.fn(),
    signOutFn: vi.fn(),
    redirect: vi.fn((path: string) => {
      // Next의 redirect는 throw로 흐름을 멈춘다. 테스트에서도 동일하게 모사한다.
      throw new Error(`REDIRECT:${path}`);
    }),
    revalidatePath: vi.fn(),
  }),
);

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: {
      signInWithPassword,
      signUp: signUpFn,
      signOut: signOutFn,
    },
  })),
}));

function form(email: string, password: string) {
  const fd = new FormData();
  fd.set("email", email);
  fd.set("password", password);
  return fd;
}

describe("signIn", () => {
  it("형식 오류는 네트워크 호출 없이 메시지를 반환한다", async () => {
    const result = await signIn({}, form("not-an-email", ""));
    expect(result.error).toBeTruthy();
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("인증 실패는 한국어 메시지로 바꿔 반환한다", async () => {
    signInWithPassword.mockResolvedValueOnce({
      error: new AuthApiError("Invalid login", 400, "invalid_credentials"),
    });
    const result = await signIn({}, form("a@b.com", "password123"));
    expect(result.error).toBe("이메일 또는 비밀번호가 올바르지 않아요.");
    expect(redirect).not.toHaveBeenCalled();
  });

  it("성공하면 대시보드로 리다이렉트한다", async () => {
    signInWithPassword.mockResolvedValueOnce({ error: null });
    await expect(signIn({}, form("a@b.com", "password123"))).rejects.toThrow(
      "REDIRECT:/dashboard",
    );
    expect(revalidatePath).toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith("/dashboard");
  });
});

describe("signUp", () => {
  it("짧은 비밀번호는 호출 없이 거른다", async () => {
    const result = await signUp({}, form("a@b.com", "short"));
    expect(result.error).toBeTruthy();
    expect(signUpFn).not.toHaveBeenCalled();
  });

  it("세션이 바로 생기면(확인 불필요) 대시보드로 보낸다", async () => {
    signUpFn.mockResolvedValueOnce({
      data: { user: { identities: [{ id: "x" }] }, session: { access_token: "t" } },
      error: null,
    });
    await expect(signUp({}, form("a@b.com", "password123"))).rejects.toThrow(
      "REDIRECT:/dashboard",
    );
  });

  it("세션이 없으면(확인 필요) 안내 메시지를 반환한다", async () => {
    signUpFn.mockResolvedValueOnce({
      data: { user: { identities: [{ id: "x" }] }, session: null },
      error: null,
    });
    const result = await signUp({}, form("a@b.com", "password123"));
    expect(result.notice).toContain("확인 메일");
    expect(redirect).not.toHaveBeenCalled();
  });

  it("빈 identities는 이미 가입된 이메일로 안내한다", async () => {
    signUpFn.mockResolvedValueOnce({
      data: { user: { identities: [] }, session: null },
      error: null,
    });
    const result = await signUp({}, form("a@b.com", "password123"));
    expect(result.error).toBe("이미 가입된 이메일이에요. 로그인해 주세요.");
  });
});

describe("signOut", () => {
  it("세션을 종료하고 로그인으로 보낸다", async () => {
    signOutFn.mockResolvedValueOnce({ error: null });
    await expect(signOut()).rejects.toThrow("REDIRECT:/login");
    expect(signOutFn).toHaveBeenCalledOnce();
  });
});
