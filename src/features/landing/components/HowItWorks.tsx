const STEPS = [
  {
    title: "자소서 등록",
    description: "지원하는 회사·직무와 자기소개서, 경험을 적어요.",
  },
  {
    title: "AI 질문 생성",
    description: "등록한 내용을 바탕으로 AI가 맞춤 질문을 준비해요.",
  },
  {
    title: "음성 면접",
    description: "질문을 듣고 소리 내어 답하면 꼬리질문이 이어져요.",
  },
  {
    title: "진행 확인",
    description: "지금까지의 질문과 답변, 진행 상황을 차분히 확인해요.",
  },
];

export function HowItWorks() {
  return (
    <section className="bg-surface">
      <div className="mx-auto w-full max-w-5xl px-6 py-16 sm:py-20">
        <div className="max-w-xl">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">작동 방식</h2>
          <p className="mt-4 text-base leading-relaxed text-muted sm:text-lg">
            네 단계면 충분해요. 처음이어도 헤매지 않게 안내할게요.
          </p>
        </div>

        <ol className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {STEPS.map((step, index) => (
            <li key={step.title} className="relative">
              <span className="flex h-11 w-11 items-center justify-center rounded-pill bg-primary font-display text-lg font-bold text-primary-foreground">
                {index + 1}
              </span>
              <h3 className="mt-5 text-lg font-bold tracking-tight">{step.title}</h3>
              <p className="mt-2 text-base leading-relaxed text-muted">
                {step.description}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
