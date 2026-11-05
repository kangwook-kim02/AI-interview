/** 인증 관련 상수. 하드코딩 금지 원칙에 따라 여기 모은다. */

/** 비밀번호 최소 길이. Supabase 기본 정책(6)과 맞춘다. */
export const PASSWORD_MIN_LENGTH = 8;

/** 이메일 최대 길이(비정상 입력 방어용 상한). */
export const EMAIL_MAX_LENGTH = 254;

/** 로그인 후 이동할 기본 경로. */
export const AUTH_REDIRECT_PATH = "/dashboard";

/** 미인증 사용자를 보낼 로그인 경로. */
export const LOGIN_PATH = "/login";

/** 회원가입 경로. 랜딩 CTA 등에서 공유한다. */
export const SIGNUP_PATH = "/signup";

/** 미인증 시 로그인을 요구하는 보호 경로 접두사. */
export const PROTECTED_PATH_PREFIXES = [
  "/dashboard",
  "/interview",
  "/api/interview",
] as const;
