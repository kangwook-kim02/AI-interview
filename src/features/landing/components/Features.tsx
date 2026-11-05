import type { ReactNode } from "react";

type Tone = "primary" | "accent";

type Feature = {
  title: string;
  description: string;
  tone: Tone;
  icon: ReactNode;
};

const svgProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.9,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className: "h-6 w-6",
};

const toneStyles: Record<Tone, string> = {
  primary: "bg-primary-soft text-primary",
  accent: "bg-accent-soft text-accent",
};

const FEATURES: Feature[] = [
  {
    title: "자소서 기반 맞춤 질문",
    description:
      "내가 쓴 자기소개서와 경험을 읽고, 나에게 꼭 맞는 질문을 만들어요. 일반적인 예상 질문이 아니라 나의 이야기에서 출발해요.",
    tone: "primary",
    icon: (
      <svg {...svgProps}>
        <rect x="5.5" y="3.5" width="13" height="17" rx="3" />
        <path d="M9 9h6M9 12.5h6M9 16h3.5" />
      </svg>
    ),
  },
  {
    title: "실시간 음성 면접",
    description:
      "질문을 음성으로 듣고, 소리 내어 답해요. 실제 면접처럼 말하는 연습을 하며 나의 답변이 글로 정리돼요.",
    tone: "accent",
    icon: (
      <svg {...svgProps}>
        <rect x="9" y="3" width="6" height="10.5" rx="3" />
        <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5M8.5 20.5h7" />
      </svg>
    ),
  },
  {
    title: "자연스러운 꼬리질문",
    description:
      "내 답변을 바탕으로 한 걸음 더 들어간 꼬리질문이 이어져요. 깊이 있게 생각하고 답하는 힘을 길러요.",
    tone: "primary",
    icon: (
      <svg {...svgProps}>
        <path d="M4 7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3h-6l-4 3v-3H7a3 3 0 0 1-3-3Z" />
        <path d="M9 9.5h0M12.5 9.5h0M16 9.5h0" />
      </svg>
    ),
  },
  {
    title: "한눈에 보는 진행 상황",
    description:
      "지금 몇 번째 질문인지, 얼마나 왔는지 차분하게 보여줘요. 압박 없이 나의 속도로 끝까지 연습해요.",
    tone: "accent",
    icon: (
      <svg {...svgProps}>
        <path d="M10 6.5h8.5M10 12h8.5M10 17.5h8.5" />
        <path d="M4.5 6.5l1.2 1.2 2-2.4M4.5 12l1.2 1.2 2-2.4" />
        <circle cx="5.7" cy="17.5" r="1.3" />
      </svg>
    ),
  },
];

export function Features() {
  return (
    <section className="mx-auto w-full max-w-5xl px-6 py-16 sm:py-20">
      <div className="max-w-xl">
        <h2 className="break-keep text-3xl font-bold tracking-tight sm:text-4xl">
          혼자서도, 든든하게.
        </h2>
        <p className="mt-4 break-keep text-base leading-relaxed text-muted sm:text-lg">
          면접 준비에 꼭 필요한 것만 담았어요. 복잡한 설정 없이 바로 연습을 시작해요.
        </p>
      </div>

      <div className="mt-12 grid gap-5 sm:grid-cols-2">
        {FEATURES.map((feature) => (
          <div
            key={feature.title}
            className="rounded-lg border border-line bg-surface p-7 shadow-sm"
          >
            <span
              className={`flex h-12 w-12 items-center justify-center rounded-pill ${toneStyles[feature.tone]}`}
            >
              {feature.icon}
            </span>
            <h3 className="mt-5 break-keep text-lg font-bold tracking-tight">
              {feature.title}
            </h3>
            <p className="mt-2 break-keep text-base leading-relaxed text-muted">
              {feature.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
