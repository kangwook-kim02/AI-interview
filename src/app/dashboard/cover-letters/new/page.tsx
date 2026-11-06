import type { Metadata } from "next";
import { CoverLetterForm } from "@/features/cover-letter/components/CoverLetterForm";

export const metadata: Metadata = { title: "자소서 등록 | AI 면접" };

export default function NewCoverLetterPage() {
  return <CoverLetterForm />;
}
