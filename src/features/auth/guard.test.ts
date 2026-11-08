import { describe, expect, it } from "vitest";
import { isProtectedPath, resolveAuthRedirect } from "./guard";

describe("보호 경로 판단", () => {
  it.each([
    "/dashboard",
    "/dashboard/cover-letters/new",
    "/interview/123/prepare",
    "/interview/123/abc/result",
  ])("보호 경로를 인식한다 (%s)", (path) => {
    expect(isProtectedPath(path)).toBe(true);
  });

  it.each(["/", "/login", "/signup", "/dashboards", "/interviewing"])(
    "공개·유사 경로는 보호하지 않는다 (%s)",
    (path) => {
      expect(isProtectedPath(path)).toBe(false);
    },
  );
});

describe("미인증 리다이렉트 결정", () => {
  it("보호 경로 + 미인증이면 로그인으로 보낸다", () => {
    expect(resolveAuthRedirect("/dashboard", false)).toBe("/login");
  });

  it("보호 경로라도 인증되면 통과시킨다", () => {
    expect(resolveAuthRedirect("/dashboard", true)).toBeNull();
  });

  it("공개 경로는 미인증이어도 통과시킨다", () => {
    expect(resolveAuthRedirect("/login", false)).toBeNull();
  });

  it("면접 API는 JSON 401 처리를 위해 로그인 페이지로 이동시키지 않는다", () => {
    expect(resolveAuthRedirect("/api/interview/questions", false)).toBeNull();
  });
});
