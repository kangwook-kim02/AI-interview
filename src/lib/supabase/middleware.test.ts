import { createServerClient } from "@supabase/ssr";
import { AuthApiError, AuthRetryableFetchError } from "@supabase/supabase-js";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { config } from "@/middleware";
import { updateSupabaseSession } from "./middleware";

const { getClaims } = vi.hoisted(() => ({ getClaims: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({ auth: { getClaims } })),
}));

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  getClaims.mockResolvedValue({ data: null, error: null });
});

describe("세션 갱신", () => {
  it("여러 쿠키 갱신 후에도 요청·응답·옵션과 캐시 방지 헤더를 보존한다", async () => {
    const request = new NextRequest("https://app.test/dashboard", {
      headers: { cookie: "auth=old" },
    });
    getClaims.mockImplementationOnce(async () => {
      const adapter = vi.mocked(createServerClient).mock.calls[0][2].cookies;
      expect(await adapter.getAll()).toContainEqual({ name: "auth", value: "old" });
      await adapter.setAll!(
        [{ name: "auth", value: "refreshed", options: { path: "/", secure: true, sameSite: "lax" } }],
        { "Cache-Control": "private, no-store", Expires: "0", Pragma: "no-cache" },
      );
      await adapter.setAll!(
        [{ name: "auth.1", value: "", options: { path: "/", maxAge: 0 } }],
        {},
      );
      return { data: null, error: null };
    });

    const response = await updateSupabaseSession(request);

    expect(request.cookies.get("auth")?.value).toBe("refreshed");
    expect(response.cookies.get("auth")).toMatchObject({
      value: "refreshed", secure: true, sameSite: "lax", path: "/",
    });
    expect(response.cookies.get("auth.1")).toMatchObject({ value: "", maxAge: 0 });
    expect(response.headers.get("x-middleware-request-cookie")).toContain("auth=refreshed");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("expires")).toBe("0");
    expect(response.headers.get("pragma")).toBe("no-cache");
    expect(getClaims).toHaveBeenCalledOnce();
  });

  it("무효 인증은 로그인으로 신뢰하지 않으며 로그인 가드는 추가하지 않는다", async () => {
    getClaims.mockResolvedValueOnce({ data: null, error: new AuthApiError("Invalid JWT", 401, undefined) });
    const response = await updateSupabaseSession(new NextRequest("https://app.test/dashboard"));
    expect(response.headers.get("location")).toBeNull();
    expect(response.status).toBe(200);
  });

  it("서비스 장애를 조용히 비로그인으로 처리하지 않는다", async () => {
    const error = new AuthRetryableFetchError("Auth unavailable", 503);
    getClaims.mockResolvedValueOnce({ data: null, error });
    await expect(
      updateSupabaseSession(new NextRequest("https://app.test/dashboard")),
    ).rejects.toBe(error);
  });
});

describe("middleware 범위", () => {
  it.each(["/", "/_next/static/app.js", "/_next/image?url=test", "/fonts/font.woff2"])(
    "공개 루트와 정적 자원은 제외한다 (%s)",
    (url) => {
      expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url })).toBe(false);
    },
  );

  it.each(["/login", "/dashboard/cover-letters/new", "/interview/123/prepare", "/api/interview/questions"])(
    "인증을 사용할 경로에는 갱신을 적용한다 (%s)",
    (url) => {
      expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url })).toBe(true);
    },
  );
});
