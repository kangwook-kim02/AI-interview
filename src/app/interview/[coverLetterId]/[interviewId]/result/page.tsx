import { InterviewFinished } from "@/features/interview/components/InterviewFinished";

export default async function InterviewResultPage({ params }: {
  params: Promise<{ coverLetterId: string; interviewId: string }>;
}) {
  return <InterviewFinished {...await params} />;
}
