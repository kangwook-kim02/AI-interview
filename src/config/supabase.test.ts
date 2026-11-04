import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSupabaseConfig } from "./supabase";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
});

describe("Supabase 공개 설정", () => {
  it("공개 설정만 사용하며 Secret key가 없어도 동작한다", () => {
    vi.stubEnv("SUPABASE_SECRET_KEY", undefined);
    expect(getSupabaseConfig()).toEqual({
      url: "https://example.supabase.co",
      publishableKey: "sb_publishable_test",
    });
  });

  it.each([undefined, "", "  ", "ftp://example.test"])(
    "URL이 유효하지 않으면 변수명과 설정 문서를 안내한다 (%s)",
    (value) => {
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", value);
      expect(getSupabaseConfig).toThrow(/NEXT_PUBLIC_SUPABASE_URL.*docs\/SETUP.md/);
    },
  );

  it("Publishable key가 없을 때 Secret key를 대신 사용하지 않는다", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", undefined);
    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_private");
    expect(getSupabaseConfig).toThrow("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  });

  it("공개 변수의 Secret key를 거부하며 오류에 실제 값을 포함하지 않는다", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_secret_private");
    let message = "";
    try {
      getSupabaseConfig();
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    expect(message).not.toContain("sb_secret_private");
  });
});
