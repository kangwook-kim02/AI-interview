import { LOGIN_PATH, PROTECTED_PATH_PREFIXES } from "@/config/auth";

/** 경로가 로그인을 요구하는 보호 경로인지 판단한다. */
export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * 미인증 사용자가 보호 경로에 접근하면 보낼 로그인 경로를 반환한다.
 * 리다이렉트가 필요 없으면 null. (순수 함수 — middleware에서 테스트 분리)
 */
export function resolveAuthRedirect(
  pathname: string,
  isAuthenticated: boolean,
): string | null {
  if (isAuthenticated) return null;
  return isProtectedPath(pathname) ? LOGIN_PATH : null;
}
