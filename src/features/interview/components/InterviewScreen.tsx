import Link from "next/link";
import { AUTH_REDIRECT_PATH } from "@/config/auth";
import { getInterviewPreparePath } from "@/config/interview";
import { getInterviewPreparation } from "../queries";
import { InterviewSessionView } from "./InterviewSessionView";

export async function InterviewScreen({ id, autoStart }: { id: string; autoStart: boolean }) {
  const result = await getInterviewPreparation(id);
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      {result.status === "success" ? (
        <InterviewSessionView id={id} companyName={result.companyName} jobTitle={result.jobTitle} autoStart={autoStart} />
      ) : (
        <div className="mx-auto max-w-2xl">
          <h1 className="text-2xl font-bold">지원 카드를 불러오지 못했어요</h1>
          <p className="mt-4 text-muted">잠시 후 준비 화면에서 다시 시도해 주세요.</p>
          <div className="mt-6 flex flex-wrap gap-6 font-semibold text-accent">
            <Link href={getInterviewPreparePath(id)}>준비 화면으로</Link>
            <Link href={AUTH_REDIRECT_PATH}>대시보드로</Link>
          </div>
        </div>
      )}
    </main>
  );
}
