import { MAIN_QUESTION_COUNT } from "@/config/interview";

export default function HomePage() {
  return (
    <main className="flex min-h-svh items-center px-6 py-16 sm:px-10">
      <div className="mx-auto w-full max-w-2xl">
        <p className="mb-6 text-sm font-semibold">AI 면접</p>
        <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          나의 이야기로 시작하는
          <br />
          면접 연습.
        </h1>
        <p className="mt-6 max-w-lg text-base leading-relaxed text-muted sm:text-lg">
          자기소개서를 바탕으로 한 {MAIN_QUESTION_COUNT}개의 질문으로,
          <br className="hidden sm:block" />
          나의 경험을 차분하게 말하는 연습을 해요.
        </p>
      </div>
    </main>
  );
}
