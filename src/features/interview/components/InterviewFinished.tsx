import Link from "next/link";
import { AUTH_REDIRECT_PATH } from "@/config/auth";
import { getSavedInterview } from "../queries";

/** Minimal destination for confirmed saves; the full history UI belongs to #19. */
export async function InterviewFinished({ coverLetterId, interviewId }: { coverLetterId: string; interviewId: string }) {
  const result = await getSavedInterview(coverLetterId, interviewId);
  return <main className="mx-auto max-w-2xl px-6 py-16 sm:py-24">
    <p className="font-semibold text-accent">면접 연습</p>
    <h1 className="mt-4 text-3xl font-bold">{result.status === "success" ? "연습 기록을 저장했어요" : "기록을 불러오지 못했어요"}</h1>
    <p className="mt-6 leading-relaxed text-muted">{result.status === "success"
      ? `${result.record.status === "completed" ? "모든 질문을 마쳤어요." : "중간에 마친 연습도 기록했어요."} 소요시간은 ${result.record.durationSeconds}초예요.`
      : "잠시 후 이 화면을 새로고침해 주세요."}</p>
    <Link href={AUTH_REDIRECT_PATH} className="mt-8 inline-block rounded-pill bg-accent-soft px-6 py-3 font-semibold text-accent hover:underline">대시보드로 돌아가기</Link>
  </main>;
}
