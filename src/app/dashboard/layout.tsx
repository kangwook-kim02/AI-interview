import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LOGIN_PATH } from "@/config/auth";
import { signOut } from "@/features/auth/actions";
import { getCurrentUser } from "@/lib/supabase/session";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // middleware 리다이렉트에 더해 서버에서 검증된 세션을 한 번 더 확정한다.
  const user = await getCurrentUser();
  if (!user) redirect(LOGIN_PATH);

  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b border-line">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <p className="font-display text-lg font-bold tracking-tight">AI 면접</p>
          <form action={signOut}>
            <Button type="submit" variant="secondary" className="min-h-10 px-4 py-2 text-sm">
              로그아웃
            </Button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">{children}</main>
    </div>
  );
}
