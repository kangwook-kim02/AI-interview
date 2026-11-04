import {
  AuthApiError,
  AuthRetryableFetchError,
  AuthSessionMissingError,
} from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { getCurrentUser } from "./session";

const { getUser } = vi.hoisted(() => ({ getUser: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("./server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({ auth: { getUser } })),
}));

describe("검증된 현재 사용자 조회", () => {
  it("Auth 서버에서 확인한 사용자만 반환한다", async () => {
    const verifiedUser = { id: "verified-user" };
    getUser.mockResolvedValueOnce({ data: { user: verifiedUser }, error: null });
    expect(await getCurrentUser()).toBe(verifiedUser);
    expect(getUser).toHaveBeenCalledOnce();
  });

  it("로그인 세션이 없으면 null을 반환한다", async () => {
    getUser.mockResolvedValueOnce({
      data: { user: null },
      error: new AuthSessionMissingError(),
    });
    expect(await getCurrentUser()).toBeNull();
  });

  it.each([400, 401, 403])("거부된 인증은 사용자를 반환하지 않는다 (%s)", async (status) => {
    getUser.mockResolvedValueOnce({
      data: { user: { id: "untrusted-user" } },
      error: new AuthApiError("Invalid auth", status, undefined),
    });
    expect(await getCurrentUser()).toBeNull();
  });

  it("통신 장애를 비로그인으로 숨기지 않는다", async () => {
    const error = new AuthRetryableFetchError("Auth unavailable", 503);
    getUser.mockResolvedValueOnce({ data: { user: null }, error });
    await expect(getCurrentUser()).rejects.toBe(error);
  });

  it("요청 제한을 비로그인으로 숨기지 않는다", async () => {
    const error = new AuthApiError("Too many requests", 429, undefined);
    getUser.mockResolvedValueOnce({ data: { user: null }, error });
    await expect(getCurrentUser()).rejects.toBe(error);
  });
});
