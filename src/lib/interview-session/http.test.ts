import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getInterviewQuestionListPath, INTERVIEW_FINISH_API_PATH, INTERVIEW_FOLLOW_UP_API_PATH, INTERVIEW_NOT_CREATED_HEADER, INTERVIEW_QUESTIONS_API_PATH } from "@/config/interview";
import { interviewSessionIO } from "./http";
import { InterviewNotCreatedError } from "./types";

const interviewId = "c0170000-0000-4000-8000-000000000001";
const ids = Array.from({ length: 6 }, (_, i) => `c0170000-0000-4000-8000-${String(i + 2).padStart(12, "0")}`);
const questions = ids.map((id, i) => ({ id, mainQuestionIndex: i < 4 ? i : 0, followUpIndex: i < 4 ? 0 : i - 3 }));
const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => vi.unstubAllGlobals());
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const input = { interviewId, mainQuestionIndex: 0, followUpIndex: 0, answerTranscript: "확정 답변" };

describe("면접 HTTP IO", () => {
  it.each([400, 401, 403, 404, 500, 502, 503, 504])("서버가 명시한 생성 전 거절 %s는 기록 없는 취소로 구별한다", async (status) => {
    fetchMock.mockResolvedValue(new Response("{}", { status, headers: { [INTERVIEW_NOT_CREATED_HEADER]: "true" } }));
    await expect(interviewSessionIO.start(ids[0], new AbortController().signal)).rejects.toBeInstanceOf(InterviewNotCreatedError);
  });
  it.each([502, 503, 504])("게이트웨이 %s만으로는 생성 실패를 확정하지 않는다", async (status) => {
    fetchMock.mockResolvedValue(response({}, status));
    const error = await interviewSessionIO.start(ids[0], new AbortController().signal).catch((error: unknown) => error);
    expect(error).not.toBeInstanceOf(InterviewNotCreatedError);
    expect(error).toBeInstanceOf(Error);
  });
  it("시작 DB/네트워크 실패는 생성되지 않았다고 단정하지 않는다", async () => {
    fetchMock.mockResolvedValueOnce(response({}, 500)).mockRejectedValueOnce(new TypeError("network"));
    for (let i = 0; i < 2; i++) {
      const error = await interviewSessionIO.start(ids[0], new AbortController().signal).catch((error: unknown) => error);
      expect(error).not.toBeInstanceOf(InterviewNotCreatedError);
      expect(error).toBeInstanceOf(Error);
    }
  });
  const finished = { interviewId, status: "aborted", endedAt: "2026-11-10T12:00:00Z", durationSeconds: 42 };
  it("종료는 확정 답변의 UUID만 보내고 서버 종료 결과를 확인한다", async () => {
    fetchMock.mockResolvedValueOnce(response({ questions })).mockResolvedValueOnce(response(finished));
    const signal = new AbortController().signal;
    expect(await interviewSessionIO.finish({ interviewId, status: "aborted", answers: [
      { mainQuestionIndex: 0, followUpIndex: 2, answerTranscript: "확정 꼬리 답변" },
    ] }, signal)).toEqual(finished);
    expect(fetchMock.mock.calls[1]).toEqual([INTERVIEW_FINISH_API_PATH, expect.objectContaining({ signal,
      body: JSON.stringify({ interviewId, status: "aborted", answers: [{ questionId: ids[5], answerTranscript: "확정 꼬리 답변" }] }),
    })]);
  });
  it("확정 답변이 없는 중도 종료는 질문 조회 없이 저장한다", async () => {
    fetchMock.mockResolvedValue(response(finished));
    await interviewSessionIO.finish({ interviewId, status: "aborted", answers: [] }, new AbortController().signal);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe(INTERVIEW_FINISH_API_PATH);
  });
  it.each([{ ...finished, status: "completed" }, { ...finished, interviewId: ids[0] },
    { ...finished, durationSeconds: null }, {}])("종료 결과 불일치/누락은 성공이 아니다", async (body) => {
    fetchMock.mockResolvedValue(response(body));
    await expect(interviewSessionIO.finish({ interviewId, status: "aborted", answers: [] }, new AbortController().signal)).rejects.toThrow();
  });
  it("카드 ID만 시작 API에 전송하고 응답을 검증한다", async () => {
    const result = { interviewId, questions: ["하나", "둘", "셋", "넷"] };
    fetchMock.mockResolvedValueOnce(response(result));
    const signal = new AbortController().signal;
    expect(await interviewSessionIO.start(ids[0], signal)).toEqual(result);
    expect(fetchMock).toHaveBeenCalledWith(INTERVIEW_QUESTIONS_API_PATH, expect.objectContaining({
      method: "POST", signal, body: JSON.stringify({ coverLetterId: ids[0] }), cache: "no-store", credentials: "same-origin",
    }));
  });
  it.each([[0, 0, 0], [3, 0, 3], [0, 1, 4], [0, 2, 5]])("메인 %s 꼬리 %s를 UUID로 변환한다", async (mainQuestionIndex, followUpIndex, index) => {
    fetchMock.mockResolvedValueOnce(response({ questions })).mockResolvedValueOnce(response({ followUp: null }));
    const signal = new AbortController().signal;
    expect(await interviewSessionIO.followUp({ ...input, mainQuestionIndex, followUpIndex }, signal)).toEqual({ followUp: null });
    expect(fetchMock.mock.calls[0]).toEqual([getInterviewQuestionListPath(interviewId), expect.objectContaining({ signal, method: "GET" })]);
    expect(fetchMock.mock.calls[1]).toEqual([INTERVIEW_FOLLOW_UP_API_PATH, expect.objectContaining({
      signal, body: JSON.stringify({ interviewId, questionId: ids[index], answerTranscript: input.answerTranscript }),
    })]);
  });
  it("평가 재시도에서도 같은 UUID와 답변을 보내고 최신 목록을 조회한다", async () => {
    fetchMock.mockResolvedValueOnce(response({ questions })).mockResolvedValueOnce(response({}, 502))
      .mockResolvedValueOnce(response({ questions })).mockResolvedValueOnce(response({ followUp: "추가 질문" }));
    const signal = new AbortController().signal;
    await expect(interviewSessionIO.followUp(input, signal)).rejects.toThrow();
    await expect(interviewSessionIO.followUp(input, signal)).resolves.toEqual({ followUp: "추가 질문" });
    expect(fetchMock.mock.calls[1][1]?.body).toBe(fetchMock.mock.calls[3][1]?.body);
  });
  it.each([401, 404, 500])("조회 %s 실패 후 판단 POST를 보내지 않는다", async (status) => {
    fetchMock.mockResolvedValue(response({ error: "private detail" }, status));
    await expect(interviewSessionIO.followUp(input, new AbortController().signal)).rejects.toThrow("Interview request failed");
    expect(fetchMock).toHaveBeenCalledOnce();
  });
  it.each([
    { questions: [] }, { questions: questions.slice(1) },
    { questions: [...questions, questions[0]] }, { questions: [{ id: "bad" }] },
  ])("잘못되거나 없는/중복 위치에는 답변을 전송하지 않는다", async (body) => {
    fetchMock.mockResolvedValue(response(body));
    await expect(interviewSessionIO.followUp(input, new AbortController().signal)).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledOnce();
  });
  it("조회 직후 취소되어도 판단 요청을 시작하지 않는다", async () => {
    const controller = new AbortController();
    fetchMock.mockImplementation(async () => { controller.abort(); return response({ questions }); });
    await expect(interviewSessionIO.followUp(input, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
  it("잘못된 시작/판단 응답을 성공으로 처리하지 않는다", async () => {
    fetchMock.mockResolvedValueOnce(response({ interviewId, questions: [] }));
    await expect(interviewSessionIO.start(ids[0], new AbortController().signal)).rejects.toThrow();
    fetchMock.mockResolvedValueOnce(response({ questions })).mockResolvedValueOnce(response({ followUp: " " }));
    await expect(interviewSessionIO.followUp(input, new AbortController().signal)).rejects.toThrow();
  });
});
