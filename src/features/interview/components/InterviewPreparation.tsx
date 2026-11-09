import Link from "next/link";
import { AUTH_REDIRECT_PATH } from "@/config/auth";
import { getInterviewPreparePath } from "@/config/interview";
import { getInterviewPreparation } from "../queries";
import { DeviceCheck } from "./DeviceCheck";

export async function InterviewPreparation({ id }: { id: string }) {
  const result = await getInterviewPreparation(id);
  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-12">
      {result.status === "success" ? (
        <DeviceCheck id={id} companyName={result.companyName} jobTitle={result.jobTitle} />
      ) : (
        <div className="mx-auto max-w-2xl">
          <h1 className="text-2xl font-bold">지원 카드를 불러오지 못했어요</h1>
          <p className="mt-4 text-muted">잠시 후 다시 시도해 주세요.</p>
          <div className="mt-6 flex flex-wrap gap-6 font-semibold text-accent">
            <a href={getInterviewPreparePath(id)} className="hover:underline">다시 시도하기</a>
            <Link href={AUTH_REDIRECT_PATH} className="hover:underline">대시보드로 돌아가기</Link>
          </div>
        </div>
      )}
    </main>
  );
}
