import { getAuthErrorInfo } from "@/lib/supabase/errors";

/**
 * Supabase 인증 오류를 사용자용 한국어 메시지로 바꾼다.
 * 내부 코드/상태를 그대로 노출하지 않고, 이해 가능한 안내로 폴백한다.
 * SDK 타입 의존은 lib/supabase/errors 어댑터 뒤에 숨긴다.
 */

const FALLBACK = "문제가 발생했어요. 잠시 후 다시 시도해 주세요.";

/** 이미 가입된 이메일 안내(여러 곳에서 공유하는 단일 출처). */
export const DUPLICATE_EMAIL_MESSAGE = "이미 가입된 이메일이에요. 로그인해 주세요.";

/** Supabase AuthError의 `code`(v2) 기준 매핑. */
const BY_CODE: Record<string, string> = {
  invalid_credentials: "이메일 또는 비밀번호가 올바르지 않아요.",
  email_not_confirmed: "이메일 인증이 아직 완료되지 않았어요. 메일함을 확인해 주세요.",
  user_already_exists: DUPLICATE_EMAIL_MESSAGE,
  email_exists: DUPLICATE_EMAIL_MESSAGE,
  weak_password: "비밀번호가 너무 약해요. 조금 더 길게 입력해 주세요.",
  over_request_rate_limit: "요청이 많아요. 잠시 후 다시 시도해 주세요.",
  over_email_send_rate_limit: "메일 전송이 많아요. 잠시 후 다시 시도해 주세요.",
  validation_failed: "입력한 내용을 다시 확인해 주세요.",
};

export function authErrorToMessage(error: unknown): string {
  const info = getAuthErrorInfo(error);
  if (!info) return FALLBACK;

  if (info.code && BY_CODE[info.code]) {
    return BY_CODE[info.code];
  }

  // code가 없거나 미매핑이면 상태값으로 폴백 판단한다.
  if (info.status === 429) {
    return "요청이 많아요. 잠시 후 다시 시도해 주세요.";
  }
  if (info.status === 400 || info.status === 401) {
    return "이메일 또는 비밀번호가 올바르지 않아요.";
  }

  return FALLBACK;
}
