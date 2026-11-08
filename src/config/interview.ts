export const MAIN_QUESTION_COUNT = 4;
export const INTERVIEW_QUESTIONS_API_PATH = "/api/interview/questions";
export const MAX_FOLLOW_UPS = 2;
export const SPEECH_LANG = "ko-KR";
export const TTS_SAFETY_TIMEOUT_MS = 30_000;
export const RECORDING_MIME = "video/webm";

export const MIC_FFT_SIZE = 1024;
export const MIC_SIGNAL_THRESHOLD = 0.015;
export const MIC_LEVEL_SCALE = 5;

export function getInterviewPreparePath(coverLetterId: string) {
  return `/interview/${encodeURIComponent(coverLetterId)}/prepare`;
}
