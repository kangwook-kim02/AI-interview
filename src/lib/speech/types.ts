export interface TTSPort {
  /**
   * 정상 종료 또는 안전 타임아웃에 완료된다. 새 speak는 이전 재생을 취소한다.
   * 취소·pagehide는 AbortError, 미지원·재생 오류는 rejection으로 전달한다.
   * 호출부는 rejection을 처리하고 SPA 화면 이탈/effect cleanup에서 cancel한다.
   */
  speak(text: string, opts?: { lang?: string }): Promise<void>;
  /** 이 인스턴스의 재생과 대기를 정리한다. 재생 중이 아니면 아무 일도 하지 않는다. */
  cancel(): void;
  isSupported(): boolean;
}
