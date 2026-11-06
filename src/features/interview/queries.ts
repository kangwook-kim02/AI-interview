import "server-only";

import { notFound, redirect } from "next/navigation";
import { LOGIN_PATH } from "@/config/auth";
import { findCoverLetter } from "@/lib/supabase/cover-letters";
import { getCurrentUser } from "@/lib/supabase/session";
import { coverLetterIdSchema } from "@/types/cover-letter";

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
