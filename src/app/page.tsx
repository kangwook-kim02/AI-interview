import { redirect } from "next/navigation";
import { AUTH_REDIRECT_PATH } from "@/config/auth";
import { Features } from "@/features/landing/components/Features";
import { Hero } from "@/features/landing/components/Hero";
import { HowItWorks } from "@/features/landing/components/HowItWorks";
import { LandingHeader } from "@/features/landing/components/LandingHeader";
import { getCurrentUser } from "@/lib/supabase/session";

export default async function HomePage() {
  // 이미 로그인한 사용자는 랜딩 대신 대시보드로 보낸다. (FR-LAND-6)
  const user = await getCurrentUser();
  if (user) redirect(AUTH_REDIRECT_PATH);

  return (
    <div className="flex min-h-svh flex-col">
      <LandingHeader />
      <main className="flex-1">
        <Hero />
        <Features />
        <HowItWorks />
      </main>
      <footer className="border-t border-line">
        <div className="mx-auto w-full max-w-5xl px-6 py-8">
          <p className="text-sm text-muted">AI 면접 — 혼자서도 든든한 면접 연습.</p>
        </div>
      </footer>
    </div>
  );
}
