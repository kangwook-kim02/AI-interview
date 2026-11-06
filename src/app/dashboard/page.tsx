import Link from "next/link";
import { NEW_COVER_LETTER_PATH } from "@/config/cover-letter";

export default function DashboardPage() {
  // 레이아웃 가드가 세션을 보장하므로 여기서는 추가 조회 없이 표시만 한다.
  return (
    <section>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">반가워요 👋</h1>
      <p className="mt-3 text-base leading-relaxed text-muted">
        로그인되었어요.
        <br />
        자기소개서를 등록하면 면접 연습을 시작할 수 있어요.
      </p>
      <Link
        href={NEW_COVER_LETTER_PATH}
        className="mt-6 inline-flex min-h-12 items-center justify-center rounded-pill bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-sm transition-colors duration-ui hover:bg-primary-hover motion-reduce:transition-none"
      >
        자소서 등록하기
      </Link>
    </section>
  );
}
