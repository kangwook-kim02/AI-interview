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
        {/* 한글이 단어 중간에서 끊기지 않도록 keep-all. 의도한 2줄(…시작하는 / 면접 연습)로 읽힌다. */}
        <h1 className="mt-6 break-keep text-4xl font-bold leading-tight tracking-tight [overflow-wrap:normal] sm:text-5xl">
          나의 이야기로 시작하는 면접 연습.
        </h1>
        <p className="mt-6 max-w-lg break-keep text-base leading-relaxed text-muted sm:text-lg">
          자기소개서를 바탕으로 한 {MAIN_QUESTION_COUNT}개의 질문에 소리 내어 답하며, 나의 경험을
          차분하게 말하는 연습을 해요. 긴장은 줄이고, 든든하게.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <CtaLink href={SIGNUP_PATH}>같이 시작하기</CtaLink>
          <CtaLink variant="outline" href={LOGIN_PATH}>
            로그인
          </CtaLink>
        </div>
      </div>

      <HeroArt />
    </section>
  );
}

/** 실제 면접 화면(좌 카메라 · 우 AI Q&A)을 축소해 보여주는 따뜻한 미리보기. 장식이라 접근성 트리에서 숨긴다. */
function HeroArt() {
  return (
    <div className="relative mx-auto w-full max-w-md" aria-hidden="true">
      <div className="rounded-lg border border-line bg-surface p-5 shadow-md sm:p-6">
        {/* 진행 상황: 라벨 + 4칸 중 2칸 = 질문 2/4 */}
        <div className="flex items-center gap-3">
          <span className="shrink-0 text-xs font-semibold text-muted">질문 2 / 4</span>
          <div className="flex flex-1 items-center gap-1.5">
            <span className="h-1.5 flex-1 rounded-pill bg-primary" />
            <span className="h-1.5 flex-1 rounded-pill bg-primary" />
            <span className="h-1.5 flex-1 rounded-pill bg-line" />
            <span className="h-1.5 flex-1 rounded-pill bg-line" />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-5 gap-3">
          {/* 왼쪽: 내 카메라 */}
          <div className="col-span-2 flex min-h-[132px] flex-col items-center justify-center gap-2 rounded-md bg-accent-soft/60 p-3">
            <svg viewBox="0 0 24 24" className="h-11 w-11 text-accent/70" fill="currentColor">
              <circle cx="12" cy="8.5" r="3.6" />
              <path d="M5 20a7 7 0 0 1 14 0Z" />
            </svg>
            <span className="rounded-pill bg-surface/90 px-2 py-0.5 text-[11px] font-medium text-muted">
              내 카메라
            </span>
          </div>

          {/* 오른쪽: AI 질문 · 내 답변 */}
          <div className="col-span-3 flex flex-col gap-2.5">
            <div className="rounded-md rounded-tl-sm bg-primary-soft px-3 py-2">
              <span className="text-[11px] font-bold text-primary">AI</span>
              <p className="mt-0.5 break-keep text-xs leading-relaxed text-foreground">
                협업하면서 가장 어려웠던 순간은 언제였나요?
              </p>
            </div>
            <div className="max-w-[92%] self-end rounded-md rounded-br-sm bg-accent-soft px-3 py-2">
              <span className="text-[11px] font-bold text-accent">나</span>
              <p className="mt-0.5 break-keep text-xs leading-relaxed text-foreground">
                의견이 부딪혔을 때, 먼저 상대의 입장을 정리해 봤어요.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
