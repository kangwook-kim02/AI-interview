export const MAIN_QUESTION_COUNT = 4;
export const MAX_FOLLOW_UPS = 2;
export const SPEECH_LANG = "ko-KR";
export const TTS_SAFETY_TIMEOUT_MS = 30_000;
export const RECORDING_MIME = "video/webm";

export function getInterviewPreparePath(coverLetterId: string) {
  return `/interview/${encodeURIComponent(coverLetterId)}/prepare`;
}
