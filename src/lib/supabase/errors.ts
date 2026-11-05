import {
  isAuthApiError,
  isAuthError,
  isAuthSessionMissingError,
  type AuthError,
} from "@supabase/supabase-js";

export function isUnauthenticatedError(error: AuthError) {
  return (
    isAuthSessionMissingError(error) ||
    (isAuthApiError(error) &&
      (error.status === 400 || error.status === 401 || error.status === 403))
  );
}

/**
 * 인증 오류에서 분류에 필요한 code/status만 추출한다.
 * 인증 오류가 아니면 null. (SDK 의존을 어댑터 안에 가둔다.)
 */
export function getAuthErrorInfo(
  error: unknown,
): { code?: string; status?: number } | null {
  if (!isAuthError(error)) return null;
  return { code: error.code, status: error.status };
}
