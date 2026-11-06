export class CoverLetterNotFoundError extends Error {
  constructor() {
    super("자소서를 찾을 수 없습니다.");
    this.name = "CoverLetterNotFoundError";
  }
}
