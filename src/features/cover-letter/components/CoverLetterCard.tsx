import Link from "next/link";
import { Card } from "@/components/ui/card";
import {
  COVER_LETTER_DATE_LOCALE,
  COVER_LETTER_DATE_TIME_ZONE,
} from "@/config/cover-letter";
import { getInterviewPreparePath } from "@/config/interview";
import type { CoverLetterSummary } from "@/types/cover-letter";

const dateFormatter = new Intl.DateTimeFormat(COVER_LETTER_DATE_LOCALE, {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: COVER_LETTER_DATE_TIME_ZONE,
});

export function CoverLetterCard({ coverLetter }: { coverLetter: CoverLetterSummary }) {
  return (
    <Card className="flex h-full flex-col">
      <h2 className="text-xl font-bold">{coverLetter.company_name}</h2>
      <p className="mt-2 text-muted">{coverLetter.job_title}</p>
      <dl className="mb-6 mt-8 space-y-2 text-sm">
        <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
          <dt className="text-muted">자소서 문항</dt>
          <dd className="tabular-nums">{coverLetter.essayCount}개</dd>
        </div>
        <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
          <dt className="text-muted">생성일</dt>
          <dd>
            <time dateTime={coverLetter.created_at}>
              {dateFormatter.format(new Date(coverLetter.created_at))}
            </time>
          </dd>
        </div>
      </dl>
      <Link
        href={getInterviewPreparePath(coverLetter.id)}
        aria-label={`${coverLetter.company_name} ${coverLetter.job_title} 면접 보기`}
        className="mt-auto inline-flex min-h-12 items-center justify-center rounded-pill bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-sm transition-colors duration-ui hover:bg-primary-hover motion-reduce:transition-none"
      >
        면접 보기
      </Link>
    </Card>
  );
}
