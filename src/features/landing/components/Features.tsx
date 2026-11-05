import type { ReactNode } from "react";

type Feature = {
  title: string;
  description: string;
  icon: ReactNode;
};

const iconClass = "h-6 w-6 text-accent";

const svgProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const FEATURES: Feature[] = [
  {
    title: "자소서 기반 맞춤 질문",
    description:
      "내가 쓴 자기소개서와 경험을 읽고, 나에게 꼭 맞는 질문을 만들어요. 일반적인 예상 질문이 아니라 나의 이야기에서 출발해요.",
    icon: (
      <svg {...svgProps} className={iconClass}>
        <path d="M7 3h7l4 4v14H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
        <path d="M13 3v5h5M9.5 13h5M9.5 16.5h3" />
      </svg>
    ),
  },
  {
    title: "실시간 음성 면접",
    description:
      "질문을 음성으로 듣고, 소리 내어 답해요. 실제 면접처럼 말하는 연습을 하며 나의 답변이 글로 정리돼요.",
    icon: (
      <svg {...svgProps} className={iconClass}>
        <rect x="9" y="2.5" width="6" height="11" rx="3" />
        <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" />
      </svg>
    ),
  },
  {
    title: "자연스러운 꼬리질문",
    description:
      "내 답변을 바탕으로 한 걸음 더 들어간 꼬리질문이 이어져요. 깊이 있게 생각하고 답하는 힘을 길러요.",
    icon: (
      <svg {...svgProps} className={iconClass}>
        <path d="M4 5h11a3 3 0 0 1 3 3v0a3 3 0 0 1-3 3H8l-3 2.5V11H4Z" />
        <path d="M11 16.5h6a3 3 0 0 1 3 3V21l-2.5-1.5H11Z" />
      </svg>
    ),
  },
  {
    title: "한눈에 보는 진행 상황",
    description:
      "지금 몇 번째 질문인지, 얼마나 왔는지 차분하게 보여줘요. 압박 없이 나의 속도로 끝까지 연습해요.",
    icon: (
      <svg {...svgProps} className={iconClass}>
        <path d="M3.5 18.5h17M6.5 18.5v-5M11 18.5V8M15.5 18.5v-8M20 18.5V5" />
      </svg>
    ),
  },
];

export function Features() {
  return (
    <section className="mx-auto w-full max-w-5xl px-6 py-16 sm:py-20">
      <div className="max-w-xl">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          혼자서도, 든든하게.
        </h2>
        <p className="mt-4 text-base leading-relaxed text-muted sm:text-lg">
          면접 준비에 꼭 필요한 것만 담았어요. 복잡한 설정 없이 바로 연습을 시작해요.
        </p>
      </div>

      <div className="mt-12 grid gap-5 sm:grid-cols-2">
        {FEATURES.map((feature) => (
          <div
            key={feature.title}
            className="rounded-md border border-line bg-surface p-7 shadow-sm"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-md bg-accent-soft">
              {feature.icon}
            </span>
            <h3 className="mt-5 text-lg font-bold tracking-tight">{feature.title}</h3>
            <p className="mt-2 text-base leading-relaxed text-muted">
              {feature.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
