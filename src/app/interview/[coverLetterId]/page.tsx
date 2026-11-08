import type { Metadata } from "next";
import { InterviewScreen } from "@/features/interview/components/InterviewScreen";

export const metadata: Metadata = { title: "면접 연습 | AI 면접" };

export default async function InterviewPage({ params, searchParams }: {
  params: Promise<{ coverLetterId: string }>;
  searchParams: Promise<{ start?: string }>;
}) {
  const { coverLetterId } = await params;
  const { start } = await searchParams;
  return <InterviewScreen id={coverLetterId} autoStart={start === "1"} />;
}
