import Link from "next/link";
import type { ComponentProps } from "react";

export type CtaLinkProps = ComponentProps<typeof Link> & {
  variant?: "primary" | "ghost";
};

const variants = {
  // 랜딩의 단일 핵심 액션. Button 프리미티브와 같은 코랄 pill 톤을 Link에 적용한다.
  primary:
    "bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover hover:-translate-y-0.5",
  // 보조 링크(로그인 등): 파인 그린 톤, 배경 없이 가볍게.
  ghost: "text-accent hover:bg-accent-soft",
};

export function CtaLink({ variant = "primary", className = "", ...props }: CtaLinkProps) {
  return (
    <Link
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-pill px-6 py-3 text-base font-semibold transition duration-ui ease-ui motion-reduce:transform-none motion-reduce:transition-none ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
