"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AUTH_REDIRECT_PATH, LOGIN_PATH } from "@/config/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { authErrorToMessage, DUPLICATE_EMAIL_MESSAGE } from "./messages";
import { loginSchema, signupSchema } from "./schema";

/** useActionState가 주고받는 폼 상태. error=오류, notice=안내(예: 확인 메일). */
export type AuthActionState = { error?: string; notice?: string };

function readCredentials(formData: FormData) {
  return {
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  };
}

export async function signIn(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse(readCredentials(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { error: authErrorToMessage(error) };
  }

  revalidatePath("/", "layout");
  redirect(AUTH_REDIRECT_PATH);
}

export async function signUp(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = signupSchema.safeParse(readCredentials(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signUp(parsed.data);
  if (error) {
    return { error: authErrorToMessage(error) };
  }

  // 이메일 확인이 켜진 프로젝트에서 이미 가입된 주소는
  // 열거 방지를 위해 identities가 빈 가짜 사용자로 반환된다.
  if (data.user && data.user.identities?.length === 0) {
    return { error: DUPLICATE_EMAIL_MESSAGE };
  }

  // 세션이 바로 생기면(확인 불필요) 로그인 상태로 대시보드 이동,
  // 없으면(확인 필요) 안내 메시지를 보여준다.
  if (data.session) {
    revalidatePath("/", "layout");
    redirect(AUTH_REDIRECT_PATH);
  }

  return { notice: "확인 메일을 보냈어요. 메일함에서 인증을 완료해 주세요." };
}

export async function signOut(): Promise<void> {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect(LOGIN_PATH);
}
