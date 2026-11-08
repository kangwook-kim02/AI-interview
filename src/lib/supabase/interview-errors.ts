export class InterviewRequestError extends Error {
  constructor(public readonly code: "NOT_FOUND" | "CLOSED" | "CONFLICT") {
    super(code);
    this.name = "InterviewRequestError";
  }
}
