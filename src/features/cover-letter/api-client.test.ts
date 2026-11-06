import { afterEach, describe, expect, it, vi } from "vitest";
import { persistCoverLetter, removeCoverLetter } from "./api-client";

const id = "c0090000-0000-4000-8000-000000000011";
const input = {
  companyName: "회사",
  jobTitle: "직무",
  essays: [{ question: "질문", answer: "답변" }],
  experiences: [],
};
afterEach(() => vi.unstubAllGlobals());
describe("자소서 REST 클라이언트", () => {
  it("생성·수정은 JSON POST/PATCH, 삭제는 DELETE를 보낸다", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ id }, { status: 201 }))
      .mockResolvedValueOnce(Response.json({ id }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetcher);
    expect(await persistCoverLetter(input)).toEqual({ ok: true });
    expect(await persistCoverLetter(input, id)).toEqual({ ok: true });
    expect(await removeCoverLetter(id)).toEqual({ ok: true });
    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      "/api/cover-letters",
      expect.objectContaining({
        method: "POST",
        credentials: "same-origin",
        body: JSON.stringify(input),
      }),
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      `/api/cover-letters/${id}`,
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      3,
      `/api/cover-letters/${id}`,
      expect.objectContaining({ method: "DELETE", body: undefined }),
    );
  });
  it("서버 필드 오류와 인증 오류를 폼에 반환한다", async () => {
    const feedback = { error: "입력을 확인해 주세요", fieldErrors: { companyName: "필수" } };
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(Response.json(feedback, { status: 400 }))
        .mockResolvedValueOnce(Response.json({ error: "로그인이 필요해요" }, { status: 401 })),
    );
    expect(await persistCoverLetter(input, id)).toEqual({ ok: false, feedback });
    expect(await removeCoverLetter(id)).toEqual({
      ok: false,
      feedback: { error: "로그인이 필요해요" },
    });
  });
  it.each([
    new Response("HTML error", { status: 502 }),
    Response.json({ wrong: true }, { status: 500 }),
    Response.json({ wrong: true }),
  ])("잘못된 응답을 성공으로 처리하지 않는다", async (response) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
    expect(await persistCoverLetter(input, id)).toEqual({
      ok: false,
      feedback: { error: expect.stringContaining("서버 응답") },
    });
  });
  it("통신 실패는 삭제에서도 재시도 가능한 오류로 반환한다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network failed")));
    expect(await removeCoverLetter(id)).toEqual({
      ok: false,
      feedback: { error: expect.stringContaining("서버 응답") },
    });
  });
});
