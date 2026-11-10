import { describe, expect, it, vi } from "vitest";
import { MAIN_QUESTION_COUNT, MAX_FOLLOW_UPS } from "@/config/interview";
import type { InterviewSessionIO } from "@/lib/interview-session/types";
import { InterviewNotCreatedError } from "@/lib/interview-session/types";
import { STTError, type STTHandlers, type STTPort, type STTResult, type TTSPort } from "@/lib/speech";
import type { FollowUpResponse, StartInterviewResponse } from "@/types/interview";
import { createInterviewSession } from "./session";

function deferred<T>() {
  let resolve!: (result: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
const prepared: StartInterviewResponse = {
  interviewId: "c0160000-0000-4000-8000-000000000001",
  questions: Array.from({ length: MAIN_QUESTION_COUNT }, (_, i) => `메인 ${i + 1}`),
};
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

function fixture() {
  const starts: ReturnType<typeof deferred<StartInterviewResponse>>[] = [];
  const speaks: ReturnType<typeof deferred<void>>[] = [];
  const stops: ReturnType<typeof deferred<STTResult>>[] = [];
  const decisions: ReturnType<typeof deferred<FollowUpResponse>>[] = [];
  const handlers: STTHandlers[] = [];
  const io = {
    finish: vi.fn<InterviewSessionIO["finish"]>(async ({ interviewId, status }) => ({
      interviewId, status, endedAt: "2026-11-10T12:00:00Z", durationSeconds: 60,
    })),
    start: vi.fn<InterviewSessionIO["start"]>(() => {
      const task = deferred<StartInterviewResponse>(); starts.push(task); return task.promise;
    }),
    followUp: vi.fn<InterviewSessionIO["followUp"]>(() => {
      const task = deferred<FollowUpResponse>(); decisions.push(task); return task.promise;
    }),
  };
  const tts = {
    speak: vi.fn<TTSPort["speak"]>(() => { const task = deferred<void>(); speaks.push(task); return task.promise; }),
    cancel: vi.fn(), isSupported: () => true,
  };
  const stt = {
    start: vi.fn<STTPort["start"]>((callbacks) => { handlers.push(callbacks); }),
    stop: vi.fn<STTPort["stop"]>(() => { const task = deferred<STTResult>(); stops.push(task); return task.promise; }),
    cancel: vi.fn(), isSupported: () => true,
  };
  const session = createInterviewSession({ io, tts, stt });
  const state = session.store.getState;
  const answerDone = () => session.answerDone(state().operationId);
  const retry = () => session.retry(state().operationId);
  async function asking() {
    session.start("c0160000-0000-4000-8000-000000000002");
    starts.at(-1)!.resolve(prepared);
    await flush();
  }
  async function recording() { await asking(); speaks.at(-1)!.resolve(); await flush(); }
  async function evaluating(text = "최종 답변") {
    await recording(); answerDone(); stops.at(-1)!.resolve({ transcript: text, empty: !text }); await flush();
  }
  return { session, state, io, tts, stt, starts, speaks, stops, decisions, handlers, answerDone, retry, asking, recording, evaluating };
}

describe("면접 세션 controller", () => {
  it("시작 전 종료와 명확한 생성 거절 후 종료는 기록 없는 취소로 끝난다", async () => {
    const idle = fixture(); idle.session.abort();
    expect(idle.state()).toMatchObject({ phase: "done", interviewId: null });
    expect(idle.io.finish).not.toHaveBeenCalled();
    const f = fixture();
    f.session.start("card"); f.starts[0].reject(new InterviewNotCreatedError()); await flush();
    expect(f.state().phase).toBe("error");
    f.session.abort(); await flush();
    expect(f.state()).toMatchObject({ phase: "done", interviewId: null });
    expect(f.io.finish).not.toHaveBeenCalled();
  });
  it("생성 중 종료 후 명확한 생성 거절도 취소로 처리한다", async () => {
    const f = fixture(); f.session.start("card"); f.session.abort();
    f.starts[0].reject(new InterviewNotCreatedError()); await flush();
    expect(f.state()).toMatchObject({ phase: "done", interviewId: null });
    expect(f.io.finish).not.toHaveBeenCalled();
  });
  it("면접 ID가 유실됐을 수 있는 시작 실패는 저장 완료로 처리하지 않는다", async () => {
    const f = fixture(); f.session.start("card"); f.session.abort();
    f.starts[0].reject(new Error("network response lost")); await flush();
    expect(f.state()).toMatchObject({ phase: "error", interviewId: null, error: { stage: "finishing" } });
    expect(f.io.finish).not.toHaveBeenCalled();
  });
  it("종료 저장 실패는 완료 처리하지 않고 같은 답변과 사유로 재시도한다", async () => {
    const f = fixture();
    await f.evaluating();
    const task = deferred<Awaited<ReturnType<InterviewSessionIO["finish"]>>>();
    f.io.finish.mockReturnValueOnce(task.promise);
    f.session.abort();
    expect(f.state()).toMatchObject({ phase: "finishing", endReason: "aborted" });
    expect(f.io.finish.mock.calls[0][0]).toMatchObject({ answers: [{ answerTranscript: "최종 답변" }] });
    task.reject(new Error("private database detail")); await flush();
    expect(f.state()).toMatchObject({ phase: "error", error: { stage: "finishing" } });
    expect(f.state().error?.message).not.toContain("private");
    const input = f.io.finish.mock.calls[0][0];
    f.session.abort();
    expect(f.io.finish).toHaveBeenCalledOnce();
    f.retry(); await flush();
    expect(f.io.finish.mock.calls[1][0]).toEqual(input);
    expect(f.state()).toMatchObject({ phase: "done", endReason: "aborted" });
    f.decisions[0].resolve({ followUp: "늦은 질문" }); await flush();
    expect(f.tts.speak).toHaveBeenCalledOnce();
  });

  it("종료 응답 유실 후 재시도에서도 completed를 aborted로 바꾸지 않는다", async () => {
    const f = fixture();
    f.io.finish.mockRejectedValueOnce(new Error("response lost"));
    await f.asking();
    for (let i = 0; i < MAIN_QUESTION_COUNT; i++) {
      f.speaks.at(-1)!.resolve(); await flush();
      f.answerDone(); f.stops.at(-1)!.resolve({ transcript: "답변", empty: false }); await flush();
      f.decisions.at(-1)!.resolve({ followUp: null }); await flush();
    }
    expect(f.state()).toMatchObject({ phase: "error", endReason: "completed", error: { stage: "finishing" } });
    f.session.abort(); f.retry(); await flush();
    expect(f.io.finish.mock.calls.map(([input]) => input.status)).toEqual(["completed", "completed"]);
    expect(f.state().phase).toBe("done");
  });

  it("면접 ID 회수 뒤 종료 실패를 재시도할 때 새 면접을 만들지 않는다", async () => {
    const f = fixture();
    f.io.finish.mockRejectedValueOnce(new Error("offline"));
    f.session.start("card"); f.session.abort();
    f.starts[0].resolve(prepared); await flush();
    expect(f.state()).toMatchObject({ phase: "error", interviewId: prepared.interviewId, endReason: "aborted" });
    f.retry(); await flush();
    expect(f.state().phase).toBe("done");
    expect(f.io.start).toHaveBeenCalledOnce(); expect(f.io.finish).toHaveBeenCalledTimes(2);
    expect(f.tts.speak).not.toHaveBeenCalled();
  });
  it("카메라 장애 시 음성과 요청을 중단하고 같은 질문으로 재시도한다", async () => {
    const f = fixture();
    await f.recording();
    f.session.interrupt("카메라를 다시 연결해 주세요.");
    expect(f.state()).toMatchObject({ phase: "error", error: { stage: "recording", message: "카메라를 다시 연결해 주세요." } });
    expect(f.stt.cancel).toHaveBeenCalledOnce();
    f.retry();
    expect(f.state()).toMatchObject({ phase: "asking", question: prepared.questions[0] });
    f.speaks.at(-1)!.resolve(); await flush();
    expect(f.state().phase).toBe("recording");
    f.session.dispose();
  });
  it("생성·TTS·STT 최종 확정 순서를 지키고 중복 완료와 onFinal을 중복 처리하지 않는다", async () => {
    const f = fixture();
    expect(f.io.start).not.toHaveBeenCalled();
    f.session.start("card"); f.session.start("card");
    expect(f.io.start).toHaveBeenCalledTimes(1);
    expect(f.tts.speak).not.toHaveBeenCalled();
    f.starts[0].resolve(prepared); await flush();
    expect(f.state().phase).toBe("asking");
    expect(f.stt.start).not.toHaveBeenCalled();
    f.answerDone();
    expect(f.stt.stop).not.toHaveBeenCalled();
    f.speaks[0].resolve(); await flush();
    expect(f.stt.start).toHaveBeenCalledTimes(1);
    f.handlers[0].onInterim?.("수정 전 초안"); f.handlers[0].onInterim?.("수정 후 초안");
    expect(f.state().draft).toBe("수정 후 초안");
    f.answerDone(); f.answerDone();
    expect(f.stt.stop).toHaveBeenCalledTimes(1);
    f.handlers[0].onFinal("콜백 결과");
    expect(f.io.followUp).not.toHaveBeenCalled();
    f.stops[0].resolve({ transcript: " 확정 결과 ", empty: false }); await flush();
    expect(f.io.followUp).toHaveBeenCalledExactlyOnceWith({
      interviewId: prepared.interviewId, mainQuestionIndex: 0, followUpIndex: 0, answerTranscript: "확정 결과",
    }, expect.any(AbortSignal));
    expect(f.state().answers).toHaveLength(1);
    f.decisions[0].resolve({ followUp: "꼬리 질문" }); await flush();
    expect(f.state()).toMatchObject({ phase: "asking", question: "꼬리 질문", followUpIndex: 1 });
    f.session.dispose();
  });

  it("4문항과 메인별 2개 꼬리를 마치고 자동 종료하며 마지막 답변도 IO에 전달한다", async () => {
    const f = fixture();
    await f.asking();
    for (let main = 0; main < MAIN_QUESTION_COUNT; main++) {
      for (let follow = 0; follow <= MAX_FOLLOW_UPS; follow++) {
        expect(f.state()).toMatchObject({ mainQuestionIndex: main, followUpIndex: follow, phase: "asking" });
        f.speaks.at(-1)!.resolve(); await flush();
        f.answerDone(); f.stops.at(-1)!.resolve({ transcript: `답 ${main}-${follow}`, empty: false }); await flush();
        // A faulty port keeps asking; the machine must still cap follow-ups.
        f.decisions.at(-1)!.resolve({ followUp: "추가 질문" }); await flush();
      }
    }
    expect(f.state()).toMatchObject({ phase: "done", endReason: "completed" });
    expect(f.state().answers).toHaveLength(12);
    expect(f.io.followUp).toHaveBeenCalledTimes(12);
    expect(f.tts.speak).toHaveBeenCalledTimes(12);
    expect(f.tts.cancel).toHaveBeenCalledOnce();
    expect(f.stt.cancel).toHaveBeenCalledOnce();
    f.answerDone(); f.retry(); f.session.start("another");
    expect(f.state().phase).toBe("done");
  });

  it("빈 확정 답변도 판단 IO에 보내고 초안을 답변으로 쓰지 않는다", async () => {
    const f = fixture();
    await f.recording();
    f.handlers[0].onInterim?.("중간 결과");
    f.answerDone(); f.stops[0].resolve({ transcript: "", empty: true }); await flush();
    expect(f.io.followUp.mock.calls[0][0].answerTranscript).toBe("");
    f.decisions[0].resolve({ followUp: null }); await flush();
    expect(f.state()).toMatchObject({ mainQuestionIndex: 1, followUpIndex: 0, question: prepared.questions[1] });
    f.session.dispose();
  });

  it.each(["generating_questions", "asking", "recording", "transcribing", "evaluating", "error"] as const)(
    "%s에서 중도 종료는 자원을 취소하고 늦은 응답을 무시한다", async (phase) => {
      const f = fixture();
      f.session.start("card");
      if (phase !== "generating_questions") { f.starts[0].resolve(prepared); await flush(); }
      if (["recording", "transcribing", "evaluating", "error"].includes(phase)) { f.speaks[0].resolve(); await flush(); }
      if (["transcribing", "evaluating"].includes(phase)) f.answerDone();
      if (phase === "evaluating") { f.stops[0].resolve({ transcript: "답변", empty: false }); await flush(); }
      if (phase === "error") f.handlers[0].onError?.(new STTError("network", "private", "부분"));
      expect(f.state().phase).toBe(phase);
      const signal = phase === "evaluating" ? f.io.followUp.mock.calls[0][1] : f.io.start.mock.calls[0][1];
      f.session.abort();
      if (phase === "generating_questions") {
        expect(f.state().phase).toBe("finishing");
        expect(signal.aborted).toBe(false);
        expect(f.io.finish).not.toHaveBeenCalled();
        f.starts[0].resolve(prepared);
      }
      await flush();
      const finished = f.state();
      expect(finished).toMatchObject({ phase: "done", endReason: "aborted" });
      if (phase !== "generating_questions") expect(signal.aborted).toBe(true);
      expect(f.io.finish).toHaveBeenCalledOnce();
      expect(f.tts.cancel).toHaveBeenCalled(); expect(f.stt.cancel).toHaveBeenCalled();
      f.starts[0].resolve(prepared); f.speaks[0]?.resolve();
      f.stops[0]?.resolve({ transcript: "늦은 전사", empty: false });
      f.decisions[0]?.resolve({ followUp: "늦은 질문" });
      f.handlers[0]?.onInterim?.("늦은 초안");
      f.handlers[0]?.onError?.(new STTError("network", "private", ""));
      await flush();
      expect(f.state()).toBe(finished);
      f.session.dispose();
    },
  );

  it("질문 생성 실패·잘못된 응답을 재시도하고 오래된 실패를 무시한다", async () => {
    const f = fixture();
    f.session.start("card"); f.starts[0].reject(new Error("private")); await flush();
    expect(f.state()).toMatchObject({ phase: "error", error: { stage: "generating_questions" } });
    expect(f.state().error?.message).not.toContain("private");
    f.retry(); f.starts[1].resolve({ ...prepared, questions: ["하나"] }); await flush();
    expect(f.state().phase).toBe("error");
    f.retry(); f.starts[2].resolve(prepared); await flush();
    expect(f.state().phase).toBe("asking"); expect(f.tts.speak).toHaveBeenCalledOnce();
    f.session.dispose();
  });

  it("TTS 실패를 같은 질문으로 재시도하고 이전 UI 완료 동작을 다음 답변에서 무시한다", async () => {
    const f = fixture();
    await f.asking(); f.speaks[0].reject(new Error("TTS")); await flush();
    expect(f.state().error?.stage).toBe("asking");
    f.retry(); expect(f.tts.speak.mock.calls[1][0]).toBe(prepared.questions[0]);
    f.speaks[1].resolve(); await flush();
    const oldRecordingId = f.state().operationId;
    f.answerDone(); f.stops[0].resolve({ transcript: "첫 답변", empty: false }); await flush();
    f.decisions[0].resolve({ followUp: "꼬리" }); await flush();
    f.speaks[2].resolve(); await flush();
    f.session.answerDone(oldRecordingId);
    f.handlers[0].onInterim?.("이전 녹음 초안");
    f.handlers[0].onError?.(new STTError("network", "이전 오류", ""));
    expect(f.state()).toMatchObject({ phase: "recording", draft: "", followUpIndex: 1 });
    expect(f.stt.stop).toHaveBeenCalledOnce();
    f.session.dispose();
  });

  it.each(["start", "recognition", "stop", "stop-callback"])("STT %s 오류 후 같은 질문을 다시 받고 부분 전사를 판단하지 않는다", async (kind) => {
    const f = fixture();
    if (kind === "start") f.stt.start.mockImplementationOnce(() => { throw new Error("시작 실패"); });
    await f.recording();
    const error = new STTError("network", "private", "부분 전사");
    if (kind === "recognition") f.handlers[0].onError?.(error);
    if (kind === "stop" || kind === "stop-callback") {
      f.answerDone();
      if (kind === "stop-callback") f.handlers[0].onError?.(error);
      f.stops[0].reject(error); await flush();
    }
    expect(f.state().phase).toBe("error");
    expect(f.io.followUp).not.toHaveBeenCalled(); expect(f.state().answers).toEqual([]);
    f.retry(); expect(f.state()).toMatchObject({ phase: "asking", question: prepared.questions[0], draft: "" });
    f.speaks.at(-1)!.resolve(); await flush();
    expect(f.state().phase).toBe("recording");
    f.session.dispose();
  });

  it("판단 오류 재시도는 같은 확정 답변만 보내고 이전 stop/인식 이벤트를 무시한다", async () => {
    const f = fixture();
    await f.evaluating();
    f.decisions[0].reject(new Error("판단 실패")); await flush();
    expect(f.state().error?.stage).toBe("evaluating");
    const firstInput = f.io.followUp.mock.calls[0][0];
    const errorId = f.state().operationId;
    f.retry(); f.session.retry(errorId);
    expect(f.io.followUp).toHaveBeenCalledTimes(2);
    expect(f.io.followUp.mock.calls[1][0]).toEqual(firstInput);
    f.handlers[0].onFinal("늦은 결과"); f.handlers[0].onError?.(new STTError("network", "늦은 오류", ""));
    f.decisions[1].resolve({ followUp: null }); await flush();
    expect(f.state()).toMatchObject({ phase: "asking", mainQuestionIndex: 1 });
    expect(f.state().answers).toHaveLength(1);
    f.session.dispose();
  });

  it("재시도 후 같은 transcribing 상태에 도착해도 이전 stop 결과는 수락하지 않는다", async () => {
    const f = fixture();
    await f.recording();
    f.answerDone();
    // A recognition error may arrive before the old stop Promise settles.
    f.handlers[0].onError?.(new STTError("network", "실패", "이전 부분 답변"));
    f.retry(); f.speaks[1].resolve(); await flush();
    f.answerDone();
    expect(f.state().phase).toBe("transcribing");
    f.stops[0].resolve({ transcript: "이전 세션 확정", empty: false });
    f.handlers[0].onError?.(new STTError("network", "이전 오류", ""));
    await flush();
    expect(f.state().phase).toBe("transcribing");
    expect(f.io.followUp).not.toHaveBeenCalled();
    f.stops[1].resolve({ transcript: "새 답변", empty: false }); await flush();
    expect(f.io.followUp.mock.calls[0][0].answerTranscript).toBe("새 답변");
    expect(f.state().answers).toHaveLength(1);
    f.session.dispose();
  });

  it("cancel이 동기 오류 콜백을 호출해도 종료를 방해하지 않는다", async () => {
    const f = fixture();
    await f.recording();
    f.stt.cancel.mockImplementation(() => f.handlers[0].onError?.(new STTError("canceled", "취소", "")));
    f.session.abort();
    await flush();
    expect(f.state()).toMatchObject({ phase: "done", endReason: "aborted", error: null });
  });

  it("dispose는 응답이 취소를 무시해도 새 음성 실행을 막고 다른 세션에 영향을 주지 않는다", async () => {
    const f = fixture(); const another = fixture();
    f.session.start("card"); f.session.dispose(); f.session.dispose();
    f.starts[0].resolve(prepared); await flush();
    f.session.start("again"); f.retry();
    expect(f.tts.speak).not.toHaveBeenCalled(); expect(f.io.start).toHaveBeenCalledOnce();
    expect(f.tts.cancel).toHaveBeenCalledOnce(); expect(f.stt.cancel).toHaveBeenCalledOnce();
    expect(another.state().phase).toBe("idle");
    await another.recording(); expect(another.state().phase).toBe("recording"); another.session.dispose();
  });
});
