import type { Metadata } from "next";
import { CoverLetterEditor } from "@/features/cover-letter/components/CoverLetterEditor";

export const metadata: Metadata = { title: "지원 카드 수정 | AI 면접" };

export default async function EditCoverLetterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CoverLetterEditor id={id} />;
}
