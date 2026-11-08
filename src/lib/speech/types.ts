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

export interface STTResult {
  transcript: string;
  empty: boolean;
}

/** 브라우저 이벤트 대신 오류 코드와 확정된 부분 전사를 전달한다. */
export class STTError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly partialTranscript: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "STTError";
  }
}

export interface STTHandlers {
  /** 확정 조각과 현재 중간 결과를 합친 전체 초안. 이전 표시를 교체한다. */
  onInterim?: (text: string) => void;
  /** 정상 stop/end에서 전체 확정 전사를 한 번 전달한다. 빈 문자열도 가능하다. */
  onFinal: (text: string) => void;
  /** 런타임 오류·취소. stop도 같은 오류로 reject하며 최종 전사는 전달하지 않는다. */
  onError?: (error: STTError) => void;
}

export interface STTPort {
  /** 미지원·중복 시작·동기 시작 실패는 throw한다. 생성/지원 확인은 마이크를 켜지 않는다. */
  start(handlers: STTHandlers): void;
  /** 마지막 결과와 end를 기다린다. 반복 호출은 마지막 세션의 같은 Promise를 반환한다. */
  stop(): Promise<STTResult>;
  /** 인식을 취소한다. SPA 화면 이탈/effect cleanup에서 호출한다. pagehide는 자동 처리한다. */
  cancel(): void;
  isSupported(): boolean;
}
