import { describe, expect, it } from "vitest";
import { MAIN_QUESTION_COUNT, MAX_FOLLOW_UPS } from "@/config/interview";
import { initialInterviewSnapshot, transition, type InterviewEvent, type InterviewSnapshot } from "./machine";

const result = {
  interviewId: "c0160000-0000-4000-8000-000000000001",
  questions: Array.from({ length: MAIN_QUESTION_COUNT }, (_, i) => `메인 ${i + 1}`),
};
function step(state: InterviewSnapshot, event: Omit<Extract<InterviewEvent, { operationId: number }>, "operationId">) {
  return transition(state, { ...event, operationId: state.operationId } as InterviewEvent);
}
function asking() {
  const state = transition(initialInterviewSnapshot(), { type: "START", coverLetterId: "card" });
  return transition(state, { type: "QUESTIONS_READY", operationId: state.operationId, result });
}
function evaluate(state: InterviewSnapshot) {
  state = step(state, { type: "TTS_END" });
  state = step(state, { type: "ANSWER_DONE" });
  return transition(state, { type: "TRANSCRIPT_FINAL", operationId: state.operationId, text: " 확정 답변 " });
}
function followUp(state: InterviewSnapshot, text: string | null) {
  return transition(state, { type: "FOLLOW_UP_RESULT", operationId: state.operationId, followUp: text });
}

describe("면접 상태머신", () => {
  it.each([0, 1, MAX_FOLLOW_UPS])("메인마다 꼬리 %i개를 진행하고 4문항 뒤 종료한다", (count) => {
    let state = asking();
    for (let main = 0; main < MAIN_QUESTION_COUNT; main++) {
      expect(state).toMatchObject({ phase: "asking", mainQuestionIndex: main, followUpIndex: 0, question: result.questions[main] });
      for (let follow = 0; follow <= count; follow++) {
        expect(state.followUpIndex).toBe(follow);
        state = evaluate(state);
        state = followUp(state, follow < count ? `꼬리 ${follow + 1}` : null);
      }
    }
    expect(state).toMatchObject({ phase: "finishing", endReason: "completed" });
    expect(state.answers).toHaveLength(MAIN_QUESTION_COUNT * (count + 1));
    expect(state.answers.at(-1)).toMatchObject({ mainQuestionIndex: 3, followUpIndex: count, answerTranscript: "확정 답변" });
    state = step(state, { type: "FINISHED" });
    expect(state.phase).toBe("done");
    expect(transition(state, { type: "ABORT" })).toBe(state);
    expect(transition(state, { type: "START", coverLetterId: "another" })).toBe(state);
  });

  it("상한에서 IO가 계속 꼬리질문을 반환해도 세 번째 꼬리를 만들지 않는다", () => {
    let state = asking();
    for (let i = 0; i <= MAX_FOLLOW_UPS; i++) state = followUp(evaluate(state), "계속 질문");
    expect(state).toMatchObject({ phase: "asking", mainQuestionIndex: 1, followUpIndex: 0, question: result.questions[1] });
    expect(state.answers).toHaveLength(MAX_FOLLOW_UPS + 1);
  });

  it("현재 단계에 맞지 않는 이벤트와 중복 완료·전사·판단을 무시한다", () => {
    let state = asking();
    expect(step(state, { type: "ANSWER_DONE" })).toBe(state);
    expect(transition(state, { type: "TRANSCRIPT_FINAL", operationId: state.operationId, text: "성급한 전사" })).toBe(state);
    state = step(state, { type: "TTS_END" });
    const recordingId = state.operationId;
    state = step(state, { type: "ANSWER_DONE" });
    expect(transition(state, { type: "ANSWER_DONE", operationId: recordingId })).toBe(state);
    const transcribingId = state.operationId;
    state = transition(state, { type: "TRANSCRIPT_FINAL", operationId: transcribingId, text: "답변" });
    expect(transition(state, { type: "TRANSCRIPT_FINAL", operationId: transcribingId, text: "중복" })).toBe(state);
    const evaluatingId = state.operationId;
    state = followUp(state, "꼬리");
    expect(transition(state, { type: "FOLLOW_UP_RESULT", operationId: evaluatingId, followUp: "늦은 꼬리" })).toBe(state);
    expect(state.answers).toHaveLength(1);
  });

  it("모든 진행 단계와 오류에서 중도 종료하고 이후 늦은 이벤트를 무시한다", () => {
    const idle = initialInterviewSnapshot();
    const generating = transition(idle, { type: "START", coverLetterId: "card" });
    const ask = asking();
    const recording = step(ask, { type: "TTS_END" });
    const transcribing = step(recording, { type: "ANSWER_DONE" });
    const evaluating = evaluate(ask);
    const error = transition(recording, { type: "FAILED", operationId: recording.operationId, message: "오류" });
    for (const state of [idle, generating, ask, recording, transcribing, evaluating, error]) {
      const finishing = transition(state, { type: "ABORT" });
      expect(finishing).toMatchObject({ phase: "finishing", endReason: "aborted", error: null });
      expect(transition(finishing, { type: "ABORT" })).toBe(finishing);
      expect(transition(finishing, { type: "TTS_END", operationId: state.operationId })).toBe(finishing);
      const done = step(finishing, { type: "FINISHED" });
      expect(step(done, { type: "RETRY" })).toBe(done);
      expect(step(done, { type: "TTS_END" })).toBe(done);
    }
  });

  it("오류 재시도는 작업을 새로 식별하고 판단 재시도는 확정 답변을 유지한다", () => {
    let state = evaluate(asking());
    const previousId = state.operationId;
    state = transition(state, { type: "FAILED", operationId: previousId, message: "판단 실패" });
    expect(state.error?.stage).toBe("evaluating");
    state = step(state, { type: "RETRY" });
    expect(state).toMatchObject({ phase: "evaluating", answerTranscript: "확정 답변", error: null });
    expect(state.answers).toHaveLength(1);
    expect(transition(state, { type: "FOLLOW_UP_RESULT", operationId: previousId, followUp: "오래된 판단" })).toBe(state);
  });

  it.each(["recording", "transcribing"] as const)("%s 오류는 부분 전사를 확정하지 않고 같은 질문을 다시 받는다", (phase) => {
    let state = step(asking(), { type: "TTS_END" });
    state = transition(state, { type: "DRAFT", operationId: state.operationId, text: "초안" });
    if (phase === "transcribing") state = step(state, { type: "ANSWER_DONE" });
    state = transition(state, { type: "FAILED", operationId: state.operationId, message: "음성 오류", partialTranscript: "부분" });
    expect(state.error?.partialTranscript).toBe("부분");
    expect(state.answers).toEqual([]);
    state = step(state, { type: "RETRY" });
    expect(state).toMatchObject({ phase: "asking", question: result.questions[0], draft: "", answerTranscript: null });
  });

  it("4개가 아닌 생성 결과는 오류가 되고 재시도할 수 있다", () => {
    let state = transition(initialInterviewSnapshot(), { type: "START", coverLetterId: "card" });
    state = transition(state, { type: "QUESTIONS_READY", operationId: state.operationId, result: { ...result, questions: ["하나"] } });
    expect(state).toMatchObject({ phase: "error", error: { stage: "generating_questions" } });
    expect(step(state, { type: "RETRY" }).phase).toBe("generating_questions");
  });
});
