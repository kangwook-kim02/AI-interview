import "server-only";
import { finishInterviewRequestSchema, finishInterviewResponseSchema, followUpRequestSchema,
  interviewIdSchema, type FinishInterviewRequest, type FollowUpRequest } from "@/types/interview";
import { InterviewRequestError } from "./interview-errors";
import { createServerSupabaseClient } from "./server";

function checkError(error: { code?: string } | null) {
  if (error?.code === "P0002") throw new InterviewRequestError("NOT_FOUND");
  if (error?.code === "P0010") throw new InterviewRequestError("CLOSED");
  if (error?.code === "P0011") throw new InterviewRequestError("CONFLICT");
  if (error) throw error;
}

export async function saveInterviewAnswer(input: FollowUpRequest, userId: string) {
  const parsed = followUpRequestSchema.parse(input);
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("save_interview_answer", {
    target_interview_id: parsed.interviewId, source_question_id: parsed.questionId,
    expected_user_id: userId, answer: parsed.answerTranscript,
  });
  checkError(error);
}

export async function finishInterview(input: FinishInterviewRequest, userId: string) {
  const parsed = finishInterviewRequestSchema.parse(input);
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("finish_interview", {
    target_interview_id: parsed.interviewId, expected_user_id: userId,
    end_status: parsed.status, answers: parsed.answers,
  });
  checkError(error);
  const result = finishInterviewResponseSchema.parse(data);
  if (result.interviewId !== parsed.interviewId || result.status !== parsed.status) {
    throw new Error("Interview finish result mismatch");
  }
  return result;
}

export async function findSavedInterview(coverLetterId: string, interviewId: string, userId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("interviews")
    .select("id, cover_letter_id, user_id, status, ended_at, duration_seconds")
    .eq("id", interviewIdSchema.parse(interviewId)).eq("cover_letter_id", interviewIdSchema.parse(coverLetterId))
    .eq("user_id", userId).maybeSingle();
  if (error) throw error;
  if (!data || data.status === "in_progress") return null;
  if (data.user_id !== userId || data.cover_letter_id !== coverLetterId || data.id !== interviewId) {
    throw new Error("Interview owner or address mismatch");
  }
  return finishInterviewResponseSchema.parse({
    interviewId: data.id, status: data.status, endedAt: data.ended_at, durationSeconds: data.duration_seconds,
  });
}
