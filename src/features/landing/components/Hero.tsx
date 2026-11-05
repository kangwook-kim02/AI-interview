import { LOGIN_PATH, SIGNUP_PATH } from "@/config/auth";
import { MAIN_QUESTION_COUNT } from "@/config/interview";
import { CtaLink } from "./CtaLink";

export function Hero() {
  return (
    <section className="mx-auto grid w-full max-w-5xl items-center gap-12 px-6 py-16 sm:py-20 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:py-24">
      <div>
        <span className="inline-flex items-center rounded-pill bg-primary-soft px-4 py-1.5 text-sm font-semibold text-primary">
          자기소개서 기반 AI 음성 면접
        </span>
        <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
          나의 이야기로 시작하는
          <br />
          면접 연습.
        </h1>
        <p className="mt-6 max-w-lg text-base leading-relaxed text-muted sm:text-lg">
          자기소개서를 바탕으로 한 {MAIN_QUESTION_COUNT}개의 질문에 소리 내어 답하며,
          <br className="hidden sm:block" />
          나의 경험을 차분하게 말하는 연습을 해요. 긴장은 줄이고, 든든하게.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <CtaLink href={SIGNUP_PATH}>같이 시작하기</CtaLink>
          <CtaLink variant="ghost" href={LOGIN_PATH} className="px-4">
            로그인
          </CtaLink>
        </div>
      </div>

      <HeroArt />
    </section>
  );
}

/** 음성 면접(질문↔답변)을 떠올리게 하는 따뜻하고 둥근 장식. 의미 전달용이 아니므로 접근성 트리에서 숨긴다. */
function HeroArt() {
  return (
    <div className="relative mx-auto w-full max-w-md" aria-hidden="true">
      <div className="rounded-lg border border-line bg-surface p-7 shadow-md sm:p-9">
        {/* AI 질문 말풍선 */}
        <div className="flex items-start gap-3">
          <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-primary-soft text-sm font-bold text-primary">
            AI
          </span>
          <div className="rounded-lg rounded-tl-sm bg-primary-soft px-4 py-3">
            <span className="block h-2.5 w-36 rounded-pill bg-primary/40" />
            <span className="mt-2 block h-2.5 w-24 rounded-pill bg-primary/25" />
          </div>
        </div>

        {/* 내 음성 답변 — 소리 파형 */}
        <div className="mt-6 flex items-end justify-end gap-3">
          <div className="flex items-end gap-1.5 rounded-lg rounded-br-sm bg-accent-soft px-4 py-4">
            {[14, 26, 20, 34, 24, 40, 28, 18].map((h, i) => (
              <span
                key={i}
                className="w-1.5 rounded-pill bg-accent/70"
                style={{ height: `${h}px` }}
              />
            ))}
          </div>
          <span className="mb-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-accent-soft">
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-accent" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M6 11a6 6 0 0 0 12 0M12 17v4" />
            </svg>
          </span>
        </div>

        {/* 진행 상황 */}
        <div className="mt-7 flex items-center gap-2">
          <span className="h-1.5 flex-1 rounded-pill bg-primary" />
          <span className="h-1.5 flex-1 rounded-pill bg-primary" />
          <span className="h-1.5 flex-1 rounded-pill bg-line" />
          <span className="h-1.5 flex-1 rounded-pill bg-line" />
        </div>
      </div>
    </div>
  );
}
