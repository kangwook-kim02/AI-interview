import "server-only";
import { interviewIdSchema, interviewQuestionListSchema } from "@/types/interview";
import { InterviewRequestError } from "./interview-errors";
import { createServerSupabaseClient } from "./server";

export async function listInterviewQuestions(interviewId: string, userId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: session, error } = await supabase.from("interviews")
    .select("id, user_id, interview_questions(id, interview_id, type, parent_question_id, order_index)")
    .eq("id", interviewIdSchema.parse(interviewId)).eq("user_id", userId).maybeSingle();
  if (error) throw error;
  if (!session) throw new InterviewRequestError("NOT_FOUND");
  if (session.user_id !== userId) throw new Error("Interview owner mismatch");
  const questions = session.interview_questions;
  return interviewQuestionListSchema.parse({ questions: questions.map((question) => {
    if (question.interview_id !== session.id) throw new Error("Interview question mismatch");
    const main = question.type === "main" ? question : questions.find((root) =>
      root.type === "main" && root.id === question.parent_question_id);
    if (!main) throw new Error("Missing main question");
    return {
      id: question.id, mainQuestionIndex: main.order_index,
      followUpIndex: question.type === "main" ? 0 : question.order_index + 1,
    };
  }) });
}
