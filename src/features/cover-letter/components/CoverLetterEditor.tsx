import Link from "next/link";
import { AUTH_REDIRECT_PATH } from "@/config/auth";
import { getCoverLetterEditPath } from "@/config/cover-letter";
import { getCoverLetterForEdit } from "../queries";
import { CoverLetterForm } from "./CoverLetterForm";

export async function CoverLetterEditor({ id }: { id: string }) {
  const result = await getCoverLetterForEdit(id);
  if (result.status === "error") {
    return (
      <div className="mx-auto max-w-2xl py-12">
        <h1 className="text-2xl font-bold">지원 카드를 불러오지 못했어요</h1>
        <p className="mt-4 text-muted">잠시 후 다시 시도해 주세요. 저장된 내용은 그대로예요.</p>
        <div className="mt-6 flex flex-wrap gap-6 text-sm font-semibold text-accent">
          <a href={getCoverLetterEditPath(id)} className="hover:underline">
            다시 시도하기
          </a>
          <Link href={AUTH_REDIRECT_PATH} className="hover:underline">
            대시보드로 돌아가기
          </Link>
        </div>
      </div>
    );
  }
  return <CoverLetterForm key={result.coverLetter.id} initialValue={result.coverLetter} />;
}
