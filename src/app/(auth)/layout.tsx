import Link from "next/link";

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 inline-block text-sm font-semibold text-muted">
          ← AI 면접
        </Link>
        <div className="rounded-lg border border-line bg-surface p-8 shadow-md sm:p-10">
          {children}
        </div>
      </div>
    </main>
  );
}
