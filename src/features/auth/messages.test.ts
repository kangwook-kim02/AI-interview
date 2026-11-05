import { AuthApiError, AuthRetryableFetchError } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { authErrorToMessage } from "./messages";

describe("인증 오류 한국어 메시지 매핑", () => {
  it.each([
    ["invalid_credentials", "이메일 또는 비밀번호가 올바르지 않아요."],
    ["user_already_exists", "이미 가입된 이메일이에요. 로그인해 주세요."],
    ["email_exists", "이미 가입된 이메일이에요. 로그인해 주세요."],
    ["weak_password", "비밀번호가 너무 약해요. 조금 더 길게 입력해 주세요."],
    ["over_email_send_rate_limit", "메일 전송이 많아요. 잠시 후 다시 시도해 주세요."],
  ])("code %s 를 안내 문구로 바꾼다", (code, expected) => {
    expect(authErrorToMessage(new AuthApiError("raw", 400, code))).toBe(expected);
  });

  it("code가 없으면 상태값으로 폴백한다 (429)", () => {
    expect(authErrorToMessage(new AuthApiError("too many", 429, undefined))).toBe(
      "요청이 많아요. 잠시 후 다시 시도해 주세요.",
    );
  });

  it("미매핑 code는 일반 안내로 폴백한다", () => {
    expect(authErrorToMessage(new AuthApiError("weird", 500, "unknown_code"))).toBe(
      "문제가 발생했어요. 잠시 후 다시 시도해 주세요.",
    );
  });

  it("인증 오류가 아니면 내부 메시지를 노출하지 않는다", () => {
    expect(authErrorToMessage(new Error("DB exploded"))).toBe(
      "문제가 발생했어요. 잠시 후 다시 시도해 주세요.",
    );
    expect(authErrorToMessage(null)).toBe("문제가 발생했어요. 잠시 후 다시 시도해 주세요.");
  });

  it("통신 장애도 안전한 일반 안내로 바꾼다", () => {
    expect(authErrorToMessage(new AuthRetryableFetchError("down", 503))).toBe(
      "문제가 발생했어요. 잠시 후 다시 시도해 주세요.",
    );
  });
});
