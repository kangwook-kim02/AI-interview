export const MAIN_QUESTION_COUNT = 4;
export const INTERVIEW_QUESTIONS_API_PATH = "/api/interview/questions";
export const INTERVIEW_FOLLOW_UP_API_PATH = "/api/interview/follow-up";
export const INTERVIEW_FINISH_API_PATH = "/api/interview/finish";
export const INTERVIEW_NOT_CREATED_HEADER = "X-Interview-Not-Created";
export const ANSWER_TRANSCRIPT_MAX_LENGTH = 20_000;
export const MAX_FOLLOW_UPS = 2;
export const SPEECH_LANG = "ko-KR";
export const TTS_SAFETY_TIMEOUT_MS = 30_000;
export const STT_FINAL_TIMEOUT_MS = 5_000;
export const RECORDING_MIME = "video/webm";

export const MIC_FFT_SIZE = 1024;
export const MIC_SIGNAL_THRESHOLD = 0.015;
export const MIC_LEVEL_SCALE = 5;
export const INTERVIEW_TIMER_INTERVAL_MS = 1_000;
export const MILLISECONDS_PER_SECOND = 1_000;
export const SECONDS_PER_MINUTE = 60;

export function getInterviewPath(coverLetterId: string) {
  return `/interview/${encodeURIComponent(coverLetterId)}`;
}

export function getInterviewQuestionListPath(interviewId: string) {
  return `/api/interview/${encodeURIComponent(interviewId)}/questions`;
}

export function getInterviewPreparePath(coverLetterId: string) {
  return `/interview/${encodeURIComponent(coverLetterId)}/prepare`;
}

export function getInterviewResultPath(coverLetterId: string, interviewId: string) {
  return `/interview/${encodeURIComponent(coverLetterId)}/${encodeURIComponent(interviewId)}/result`;
}
