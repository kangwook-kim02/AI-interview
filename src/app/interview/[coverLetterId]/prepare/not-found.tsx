import Link from "next/link";
import { AUTH_REDIRECT_PATH } from "@/config/auth";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-bold">지원 카드를 찾을 수 없어요</h1>
      <p className="mt-4 text-muted">카드가 삭제되었거나 접근할 수 없는 주소예요.</p>
      <Link href={AUTH_REDIRECT_PATH} className="mt-6 inline-block font-semibold text-accent hover:underline">대시보드로 돌아가기</Link>
    </main>
  );
}
