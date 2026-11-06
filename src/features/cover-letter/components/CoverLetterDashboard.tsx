import Link from "next/link";
import { Card } from "@/components/ui/card";
import { AUTH_REDIRECT_PATH } from "@/config/auth";
import { NEW_COVER_LETTER_PATH } from "@/config/cover-letter";
import { getCoverLetterDashboard } from "../queries";
import { CoverLetterCard } from "./CoverLetterCard";

export async function CoverLetterDashboard() {
  const result = await getCoverLetterDashboard();
  const hasCoverLetters = result.status === "success" && result.coverLetters.length > 0;

  return (
    <section aria-labelledby="cover-letter-heading">
      <header className="mb-8 flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
        <div>
          <h1 id="cover-letter-heading" className="text-2xl font-bold sm:text-3xl">
            내 지원 자소서
          </h1>
          <p className="mt-3 text-muted">내가 쓴 이야기로, 면접을 한 번 더 연습해 봐요.</p>
        </div>
        {hasCoverLetters && (
          <Link
            href={NEW_COVER_LETTER_PATH}
            className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-pill bg-accent-soft px-6 py-3 font-semibold text-accent transition-colors duration-ui hover:bg-accent-soft/60 motion-reduce:transition-none"
          >
            새 자소서 등록
          </Link>
        )}
      </header>
      {result.status === "error" ? (
        <Card role="alert" className="py-12 text-center">
          <h2 className="text-xl font-bold">자소서를 불러오지 못했어요.</h2>
          <p className="mt-3 text-muted">잠시 후 다시 불러와 주세요.</p>
          <a
            href={AUTH_REDIRECT_PATH}
            className="mt-6 inline-flex min-h-12 items-center justify-center rounded-pill bg-accent-soft px-6 py-3 font-semibold text-accent transition-colors duration-ui hover:bg-accent-soft/60 motion-reduce:transition-none"
          >
            다시 불러오기
          </a>
        </Card>
      ) : hasCoverLetters ? (
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {result.coverLetters.map((coverLetter) => (
            <li key={coverLetter.id} className="min-w-0">
              <CoverLetterCard coverLetter={coverLetter} />
            </li>
          ))}
        </ul>
      ) : (
        <Card className="px-6 py-12 text-center sm:py-16">
          <svg
            viewBox="0 0 160 128"
            fill="none"
            aria-hidden="true"
            className="mx-auto mb-6 h-32 w-40"
          >
            <ellipse cx="80" cy="68" rx="72" ry="56" className="fill-accent-soft" />
            <g strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M51 18 114 24 107 110 44 104Z" className="fill-surface stroke-accent" />
              <path d="m64 44 32 3M62 60l32 3M61 76l19 2" className="stroke-accent" />
              <path d="m100 88 8 8 17-21" className="stroke-primary" />
            </g>
          </svg>
          <h2 className="text-xl font-bold sm:text-2xl">첫 자소서부터 함께 준비해요.</h2>
          <p className="mx-auto mt-3 max-w-sm text-muted">
            지원하는 회사와 자소서를 등록해 주세요.
            <br className="hidden sm:block" /> 나만의 면접 연습을 준비할 수 있어요.
          </p>
          <Link
            href={NEW_COVER_LETTER_PATH}
            className="mt-8 inline-flex min-h-12 items-center justify-center rounded-pill bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-sm transition-colors duration-ui hover:bg-primary-hover motion-reduce:transition-none"
          >
            자소서 등록하기
          </Link>
        </Card>
      )}
    </section>
  );
}
