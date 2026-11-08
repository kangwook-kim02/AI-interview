const messages = {
  NOT_CONFIGURED: "AI 설정을 확인하세요. docs/SETUP.md §C 참고.",
  UNSUPPORTED_PROVIDER: "지원하지 않는 AI provider입니다. docs/SETUP.md §C 참고.",
  INVALID_INPUT: "질문 생성 입력을 확인하세요.",
  EMPTY_RESPONSE: "AI가 빈 응답을 반환했습니다.",
  INVALID_RESPONSE: "AI 응답 형식이 올바르지 않습니다.",
  PROVIDER_FAILURE: "AI 서비스 요청에 실패했습니다.",
  TIMEOUT: "AI 서비스 응답 시간이 초과되었습니다.",
} as const;

export type QuestionGenerationErrorCode = keyof typeof messages;

export class QuestionGenerationError extends Error {
  constructor(public readonly code: QuestionGenerationErrorCode) {
    super(messages[code]);
    this.name = "QuestionGenerationError";
  }
}
