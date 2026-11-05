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
    </section>
  );
}
