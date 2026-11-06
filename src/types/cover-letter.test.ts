import { describe, expect, it } from "vitest";
import { COMPANY_NAME_MAX_LENGTH, MAX_ESSAY_ITEMS } from "@/config/cover-letter";
import { coverLetterSchema } from "./cover-letter";

const valid = {
  companyName: " 함께컴퍼니 ",
  jobTitle: " 개발자 ",
  essays: [{ question: " 지원 동기 ", answer: " 함께 성장하고 싶어요. " }],
  experiences: [],
};

describe("coverLetterSchema", () => {
  it("필수값 공백을 제거하고 경험 0개를 허용한다", () => {
    expect(coverLetterSchema.parse(valid)).toEqual({
      companyName: "함께컴퍼니",
      jobTitle: "개발자",
      essays: [{ question: "지원 동기", answer: "함께 성장하고 싶어요." }],
      experiences: [],
    });
  });
  it.each([
    { companyName: " \n " },
    { jobTitle: "\t" },
    { essays: [] },
    { essays: [{ question: " ", answer: "답변" }] },
    { essays: [{ question: "질문", answer: "\n" }] },
    { experiences: [{ content: " " }] },
    { companyName: "가".repeat(COMPANY_NAME_MAX_LENGTH + 1) },
    { essays: Array.from({ length: MAX_ESSAY_ITEMS + 1 }, () => valid.essays[0]) },
  ])("필수 조건과 상한을 서버에서도 검증한다: %j", (invalid) => {
    expect(coverLetterSchema.safeParse({ ...valid, ...invalid }).success).toBe(false);
  });
  it("전달한 문항과 경험 순서를 유지하며 소유자 입력은 받지 않는다", () => {
    const input = {
      ...valid,
      userId: "spoofed",
      essays: [
        { question: "두 번째", answer: "답변2" },
        { question: "첫 번째", answer: "답변1" },
      ],
      experiences: [{ content: "경험2" }, { content: "경험1" }],
    };
    const parsed = coverLetterSchema.parse(input);
    expect(parsed.essays).toEqual(input.essays);
    expect(parsed.experiences).toEqual(input.experiences);
    expect(parsed).not.toHaveProperty("userId");
  });
});
