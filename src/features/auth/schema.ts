import { z } from "zod";
import { EMAIL_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/config/auth";

/** 로그인·회원가입이 공유하는 입력 검증. 네트워크 호출 전에 형식 오류를 걸러낸다. */

const email = z
  .email({ message: "올바른 이메일 주소를 입력해 주세요." })
  .max(EMAIL_MAX_LENGTH, { message: "이메일이 너무 길어요." });

export const loginSchema = z.object({
  email,
  password: z.string().min(1, { message: "비밀번호를 입력해 주세요." }),
});

export const signupSchema = z.object({
  email,
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, {
      message: `비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상으로 입력해 주세요.`,
    }),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
