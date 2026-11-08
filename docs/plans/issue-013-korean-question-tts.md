# Plan — Issue #13: 한국어 질문 음성 재생과 종료 감지를 제공한다

- 이슈: #13
- 브랜치: feat/13-korean-question-tts
- 상태: 완료
- 작성일: 2026-11-08

## 목표

교체 가능한 TTSPort로 한국어 질문을 재생한다. 정상 종료 또는 설정된 안전
타임아웃에 Promise가 한 번만 완료되며, 오류·취소·페이지 이탈 시
타이머·이벤트·브라우저 음성을 정리한다.

범위 밖: 상태머신/UI 연결, STT 구현, 추가 음성 provider, 영상 저장.

## 단계별 계획

1. TTSPort에 speak(text, opts?): Promise<void>, cancel, isSupported 계약을 정의한다.
   정상 종료·안전 타임아웃은 resolve, 취소·pagehide는 AbortError reject,
   미지원·재생 오류는 reject로 구분한다.
2. 클라이언트 전용 팩토리에서 TTSPort를 반환한다. 생성/지원 확인은 부작용이 없다.
3. Web Speech 구현은 SPEECH_LANG을 기본으로 사용하고 선택적 opts.lang을 지원한다.
4. 새 speak는 이전 요청을 취소하고 이전 Promise도 reject한다.
   요청별 종료 가드로 이전 콜백이 새 재생에 영향을 주지 못하게 한다.
5. end/error와 TTS_SAFETY_TIMEOUT_MS를 단일 종료 함수에 연결한다.
   타이머는 요청 시 시작하며 timeout은 실제 음성도 중단한 뒤 resolve한다.
6. 종료 가드 → 타이머·리스너·활성 참조 정리 → 필요 시 음성 cancel → 완료 순서로
   동기 cancel 이벤트 및 지연 end/error의 재진입을 방지한다.
7. 재생 중에만 pagehide 리스너를 등록한다. SPA 이탈은 향후 호출부의 cleanup에서
   cancel을 호출하도록 계약을 명시하고 이번 이슈에서 라우팅에는 연결하지 않는다.
8. 경쟁 조건·자원 정리 테스트, 프로젝트 검사, reviewer 검토를 완료한다.

## 건드릴 파일 (경로 / 레이어)

- src/lib/speech/types.ts — lib: TTSPort 계약
- src/lib/speech/index.ts — lib: 클라이언트 전용 팩토리
- src/lib/speech/web-speech-tts.ts — lib: 브라우저 구현
- src/lib/speech/web-speech-tts.test.ts — lib: 격리 테스트
- docs/SETUP.md — docs: 호출·정리 계약과 수동 확인 방법
- docs/plans/issue-013-korean-question-tts.md — docs: 계획과 검증·리뷰 기록

## 외부 의존·어댑터 / 스키마 변경

Web Speech 접근은 lib/speech 구현으로 제한한다. 기존 src/config/interview.ts의
SPEECH_LANG과 TTS_SAFETY_TIMEOUT_MS를 재사용한다. 패키지·키·DB·스키마 변경은 없다.
STTPort는 필요할 때 후속 이슈에서 추가한다.

## 리스크 · 열린 질문 · 승인 필요 지점

- 취소를 성공으로 취급해 녹음을 시작하지 않도록 AbortError로 구분한다.
- 정상 종료/timeout 경합, 이전 질문의 지연 이벤트, 동기 cancel 이벤트를 방어한다.
- 전역 음성 큐를 공유하므로 앱의 TTS 재생은 하나만 허용한다.
- 30초는 요청 시점부터의 안전 상한이다. 긴 질문은 중단될 수 있다.
- API 지원과 실제 한국어 음성 제공 여부는 다르므로 실제 청취 여부를 별도 보고한다.
- 커밋·푸시·PR은 구현·검증·리뷰·초안을 준비한 뒤 승인받는다.
  승인 후 계획을 브랜치 첫 커밋으로 추가한다.

## 검증 계획

외부 호출 없는 fake utterance·speechSynthesis·EventTarget 및 fake timer로 검증한다.
SSR/미지원·무부작용 지원 확인, ko-KR/언어 전달, 정상 end 대기 및 정리,
설정 시간 timeout, end/timeout 경합·지연 이벤트, error·동기 예외,
cancel·반복 cancel·재시도, 재생 교체, pagehide, 동기 cancel 이벤트를 확인한다.
lint·typecheck·전체 test·build 및 reviewer 검토를 수행한다.
실제 브라우저 확인 여부와 미확인 항목은 사실대로 기록한다.

## (구현 후) 변경 메모 / 리뷰 반영

- planner 계획을 보존했다. 단일 컨트롤러 권장안 대신 인스턴스별 취소 소유권과
  모듈 수준 활성 요청 하나를 사용한다. 새 재생이 이전 재생을 취소하되 이전
  인스턴스의 늦은 cleanup이 새 인스턴스의 음성을 중단하지 않도록 한다.
- 구현 완료: createTTS가 TTSPort를 반환하며 기본 ko-KR, 요청부터 30초 제한,
  정상 end/timeout 단일 완료 및 모든 종료 경로의 내부 자원 정리를 제공한다.
  pause 상태가 남아 있으면 resume하며 빈 입력은 재생 전에 거부한다.
- 호출부가 AbortError와 재생 오류를 처리하고 SPA cleanup에서 cancel하도록
  타입 주석과 docs/SETUP.md에 계약 및 수동 청취 확인 방법을 기록했다.
- targeted 27개 및 전체 261개 테스트 통과. lint·typecheck·production build 통과.
- reviewer 검토: 이상 없음. must-fix 및 nice-to-have 지적 없음.
- 실제 브라우저의 한국어 음성 재생·청취는 미확인이다. 테스트는 브라우저 대역과
  fake timer를 사용하며 실제 음성 엔진·설치된 한국어 음성 품질을 보장하지 않는다.
- 로컬 구현·검증·리뷰 및 PR 초안 준비 완료. 커밋·푸시·PR 생성은 승인 대기다.
  승인 후 이 계획을 첫 커밋으로 추가하고 구현과 문서 변경을 이어서 커밋한다.
- 사용자가 PR 생성을 승인했다. 계획을 브랜치 첫 커밋으로 추가하고 구현·문서 변경을
  이어서 커밋한 뒤 브랜치를 푸시하고 main 대상 PR을 생성한다.
