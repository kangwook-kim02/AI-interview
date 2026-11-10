import "server-only";

import { notFound, redirect } from "next/navigation";
import { LOGIN_PATH } from "@/config/auth";
import { findCoverLetter } from "@/lib/supabase/cover-letters";
import { getCurrentUser } from "@/lib/supabase/session";
import { coverLetterIdSchema } from "@/types/cover-letter";
import { interviewIdSchema } from "@/types/interview";
import { findSavedInterview } from "@/lib/supabase/interview-records";

export async function getInterviewPreparation(id: string) {
  const user = await getCurrentUser();
  if (!user) redirect(LOGIN_PATH);
  if (!coverLetterIdSchema.safeParse(id).success) notFound();
  let coverLetter;
  try {
    coverLetter = await findCoverLetter(id, user.id);
  } catch {
    return { status: "error" } as const;
  }
  if (!coverLetter) notFound();
  return {
    status: "success",
    companyName: coverLetter.companyName,
    jobTitle: coverLetter.jobTitle,
  } as const;
}

export async function getSavedInterview(coverLetterId: string, interviewId: string) {
  const user = await getCurrentUser();
  if (!user) redirect(LOGIN_PATH);
  if (!coverLetterIdSchema.safeParse(coverLetterId).success || !interviewIdSchema.safeParse(interviewId).success) notFound();
  let record;
  try { record = await findSavedInterview(coverLetterId, interviewId, user.id); }
  catch { return { status: "error" } as const; }
  if (!record) notFound();
  return { status: "success", record } as const;
}
