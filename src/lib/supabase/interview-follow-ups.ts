import "server-only";
import { MAX_FOLLOW_UPS } from "@/config/interview";
import type { FollowUpRequest, FollowUpResponse } from "@/types/interview";
import { followUpRequestSchema, followUpResponseSchema } from "@/types/interview";
import { InterviewRequestError } from "./interview-errors";
import { createServerSupabaseClient } from "./server";

export async function loadFollowUpState(input: FollowUpRequest, userId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: session, error } = await supabase.from("interviews")
    .select("id, user_id, cover_letter_id, status, interview_questions(*)")
    .eq("id", input.interviewId).eq("user_id", userId).maybeSingle();
  if (error) throw error;
  if (!session) throw new InterviewRequestError("NOT_FOUND");
  if (session.user_id !== userId) throw new Error("Interview owner mismatch");
  if (session.status !== "in_progress") throw new InterviewRequestError("CLOSED");
  const question = session.interview_questions.find((q) => q.id === input.questionId && q.interview_id === input.interviewId);
  if (!question) throw new InterviewRequestError("NOT_FOUND");
  const { data: decision, error: decisionError } = await supabase.from("interview_follow_up_decisions")
    .select("question_id, interview_id, answer_transcript, follow_up")
    .eq("question_id", input.questionId).eq("interview_id", input.interviewId).maybeSingle();
  if (decisionError) throw decisionError;
  if (decision && decision.answer_transcript !== input.answerTranscript) throw new InterviewRequestError("CONFLICT");
  const root = session.interview_questions.find((q) =>
    q.id === (question.parent_question_id ?? question.id) && q.type === "main" && q.interview_id === session.id);
  if (!root) throw new InterviewRequestError("CONFLICT");
  const children = session.interview_questions.filter((q) =>
    q.parent_question_id === root.id && q.type === "follow_up" && q.interview_id === session.id)
    .sort((a, b) => a.order_index - b.order_index);
  if (!decision && ((question.type === "main" && children.length !== 0)
    || (question.type === "follow_up" && children.at(-1)?.id !== question.id))) {
    throw new InterviewRequestError("CONFLICT");
  }
  return {
    coverLetterId: session.cover_letter_id,
    question: question.question_text,
    previousFollowUps: children.map((q) => q.question_text),
    atLimit: children.length >= MAX_FOLLOW_UPS,
    decision: decision ? followUpResponseSchema.parse({ followUp: decision.follow_up }) : null,
  };
}

export async function saveFollowUp(input: FollowUpRequest, result: FollowUpResponse, userId: string) {
  const validated = followUpRequestSchema.parse(input);
  const generated = followUpResponseSchema.parse(result);
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("save_interview_follow_up", {
    target_interview_id: validated.interviewId, source_question_id: validated.questionId,
    expected_user_id: userId, answer: validated.answerTranscript, generated_follow_up: generated.followUp ?? undefined,
  });
  if (error?.code === "P0002") throw new InterviewRequestError("NOT_FOUND");
  if (error?.code === "P0010") throw new InterviewRequestError("CLOSED");
  if (error?.code === "P0011") throw new InterviewRequestError("CONFLICT");
  if (error) throw error;
  return followUpResponseSchema.parse(data);
}
