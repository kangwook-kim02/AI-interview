"use client";

import Link from "next/link";
import { useActionState, useId } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PASSWORD_MIN_LENGTH } from "@/config/auth";
import { signIn, signUp, type AuthActionState } from "../actions";

type Mode = "login" | "signup";

const COPY = {
  login: {
    title: "다시 만나서 반가워요",
    subtitle: "이메일로 로그인하고 연습을 이어가요.",
    submit: "로그인",
    pending: "로그인 중…",
    passwordAutoComplete: "current-password",
    switchPrompt: "아직 계정이 없나요?",
    switchHref: "/signup",
    switchLabel: "회원가입",
  },
  signup: {
    title: "면접 연습을 시작해요",
    subtitle: "이메일만 있으면 바로 시작할 수 있어요.",
    submit: "회원가입",
    pending: "가입 중…",
    passwordAutoComplete: "new-password",
    switchPrompt: "이미 계정이 있나요?",
    switchHref: "/login",
    switchLabel: "로그인",
  },
} as const;

const INITIAL_STATE: AuthActionState = {};

export function AuthForm({ mode }: { mode: Mode }) {
  const copy = COPY[mode];
  const action = mode === "login" ? signIn : signUp;
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);

  const emailId = useId();
  const passwordId = useId();
  const feedbackId = useId();
  const hasError = Boolean(state.error);

  return (
    <div className="w-full">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{copy.title}</h1>
        <p className="mt-2 text-base leading-relaxed text-muted">{copy.subtitle}</p>
      </div>

      <form action={formAction} noValidate className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <label htmlFor={emailId} className="text-sm font-semibold">
            이메일
          </label>
          <Input
            id={emailId}
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            required
            aria-invalid={hasError}
            aria-describedby={state.error || state.notice ? feedbackId : undefined}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor={passwordId} className="text-sm font-semibold">
            비밀번호
          </label>
          <Input
            id={passwordId}
            name="password"
            type="password"
            autoComplete={copy.passwordAutoComplete}
            placeholder="••••••••"
            required
            aria-invalid={hasError}
          />
          {mode === "signup" && (
            <p className="text-sm text-muted">{PASSWORD_MIN_LENGTH}자 이상 입력해 주세요.</p>
          )}
        </div>

        {state.error && (
          <p id={feedbackId} role="alert" className="text-sm font-medium text-danger">
            {state.error}
          </p>
        )}
        {state.notice && (
          <p id={feedbackId} role="status" className="text-sm font-medium text-accent">
            {state.notice}
          </p>
        )}

        <Button type="submit" disabled={pending} className="mt-1 w-full">
          {pending ? copy.pending : copy.submit}
        </Button>
      </form>

      <p className="mt-6 text-sm text-muted">
        {copy.switchPrompt}{" "}
        <Link
          href={copy.switchHref}
          className="font-semibold text-accent underline-offset-4 hover:underline"
        >
          {copy.switchLabel}
        </Link>
      </p>
    </div>
  );
}
