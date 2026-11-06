import type { Metadata } from "next";
import { InterviewPreparation } from "@/features/interview/components/InterviewPreparation";

export const metadata: Metadata = { title: "면접 장비 점검 | AI 면접" };

export default async function PreparePage({ params }: { params: Promise<{ coverLetterId: string }> }) {
  const { coverLetterId } = await params;
  return <InterviewPreparation id={coverLetterId} />;
}
