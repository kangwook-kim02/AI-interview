import { createBrowserClient, createServerClient } from "@supabase/ssr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBrowserSupabaseClient } from "./client";
import { createServerSupabaseClient } from "./server";

const { requestCookies } = vi.hoisted(() => ({ requestCookies: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: requestCookies }));
vi.mock("@supabase/ssr", () => ({
  createBrowserClient: vi.fn(() => ({ source: "browser" })),
  createServerClient: vi.fn(() => ({ source: "server" })),
}));

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_never_use");
});

describe("Supabase 클라이언트 경계", () => {
  it("브라우저 팩토리는 공개 키만 SDK에 전달한다", () => {
    createBrowserSupabaseClient();
    expect(createBrowserClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "sb_publishable_test",
    );
  });

  it("요청마다 새 서버 클라이언트를 만들고 쿠키를 공유하지 않는다", async () => {
    const firstCookies = [{ name: "auth", value: "first-user" }];
    const secondCookies = [{ name: "auth", value: "second-user" }];
    requestCookies
      .mockResolvedValueOnce({ getAll: () => firstCookies, set: vi.fn() })
      .mockResolvedValueOnce({ getAll: () => secondCookies, set: vi.fn() });

    const first = await createServerSupabaseClient();
    const second = await createServerSupabaseClient();
    const calls = vi.mocked(createServerClient).mock.calls;

    expect(first).not.toBe(second);
    expect(calls).toHaveLength(2);
    expect(calls[0].slice(0, 2)).toEqual([
      "https://example.supabase.co",
      "sb_publishable_test",
    ]);
    expect(await calls[0][2].cookies.getAll()).toEqual(firstCookies);
    expect(await calls[1][2].cookies.getAll()).toEqual(secondCookies);
  });

  it("쓰기 가능한 요청에서는 갱신 쿠키의 옵션도 전달한다", async () => {
    const set = vi.fn();
    requestCookies.mockResolvedValueOnce({ getAll: () => [], set });
    await createServerSupabaseClient();
    const adapter = vi.mocked(createServerClient).mock.calls[0][2].cookies;
    const options = { path: "/", sameSite: "lax" as const, secure: true };

    await adapter.setAll!([{ name: "auth", value: "new", options }], {});
    expect(set).toHaveBeenCalledWith("auth", "new", options);
  });

  it("읽기 전용 Server Component에서는 쿠키 쓰기 제한을 허용한다", async () => {
    requestCookies.mockResolvedValueOnce({
      getAll: () => [],
      set: () => {
        throw new Error("Cookies can only be modified in a Server Action or Route Handler");
      },
    });
    await createServerSupabaseClient();
    const adapter = vi.mocked(createServerClient).mock.calls[0][2].cookies;

    await expect(
      Promise.resolve().then(() =>
        adapter.setAll!([{ name: "auth", value: "new", options: {} }], {}),
      ),
    ).resolves.toBeUndefined();
  });
});
