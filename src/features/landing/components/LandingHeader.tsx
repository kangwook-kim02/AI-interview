import Link from "next/link";
import { LOGIN_PATH, SIGNUP_PATH } from "@/config/auth";
import { CtaLink } from "./CtaLink";

export function LandingHeader() {
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="font-display text-lg font-bold tracking-tight">
          AI 면접
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          <CtaLink
            variant="ghost"
            href={LOGIN_PATH}
            className="min-h-10 px-4 py-2 text-sm"
          >
            로그인
          </CtaLink>
          <CtaLink href={SIGNUP_PATH} className="min-h-10 px-5 py-2 text-sm">
            시작하기
          </CtaLink>
        </nav>
      </div>
    </header>
  );
}
