# Plan — Issue #14: 음성 답변의 실시간 전사와 최종 확정을 제공한다

- 이슈: #14
- 브랜치: feat/14-korean-answer-stt
- 상태: 구현중
- 작성일: 2026-11-08

## 목표

교체 가능한 STTPort로 한국어 음성을 인식한다. 답변 중 전체 초안을 전달하고,
대답 완료 후 늦게 도착하는 결과까지 수집하여 확정 전사를 한 번 전달한다.
무응답·빈 전사·오류·취소를 구분하고 인식과 이벤트를 정리한다.

범위 밖: 면접 UI·상태머신 연결, 추가 provider, 음성·영상 파일 저장.

## 단계별 계획

1. STTPort, handlers, 결과, 구조화된 오류 계약을 정의한다.
2. createSTT 진입점과 표준/접두사 SpeechRecognition 어댑터를 구현한다.
3. 전체 결과 목록에서 final/interim 조각을 순서대로 재구성한다.
4. stop 이후 result를 수집하고 end에서만 확정한다. 반복 stop은 같은 Promise다.
5. 오류·예상치 않은 end·확정 timeout·cancel·pagehide와 지연 이벤트를 처리한다.
6. 단위 테스트, 사용 계약, Chrome 실장비 검증 절차를 작성한다.
7. lint·typecheck·전체 test·build와 reviewer 리뷰를 수행한다.

## 건드릴 파일 (경로 / 레이어)

- src/lib/speech/types.ts — STT 계약 / lib
- src/lib/speech/index.ts — createSTT와 타입 공개 / lib
- src/lib/speech/web-speech-stt.ts — 브라우저 구현 / lib
- src/lib/speech/web-speech-stt.test.ts — 생명주기·누적·경합 테스트 / lib
- src/config/interview.ts — stop 확정 대기 상한 / config
- docs/ARCHITECTURE.md — 실제 STT 계약 참조 / docs
- docs/SETUP.md — 사용법·수동 검증 절차 / docs
- docs/plans/issue-014-korean-answer-stt.md — 계획 보존 / docs

## 외부 의존·어댑터 / 스키마 변경

STTPort 뒤에 Web Speech를 숨기고 createSTT를 통해 생성한다.
SPEECH_LANG을 재사용하며 continuous/interimResults를 활성화한다.
네이티브 타입은 구현 내부의 최소 구조 타입으로 선언한다.
STT 자체 마이크를 사용하며 기존 카메라·마이크 스트림은 소유하거나 종료하지 않는다.
DB·환경변수·패키지·스키마 변경은 없다.

## 리스크 · 열린 질문 · 승인 필요 지점

- start는 void이며 미지원·중복 시작·동기 시작 실패는 throw한다.
- onInterim은 확정 조각+현재 interim의 전체 초안이다. 호출부는 표시를 교체한다.
- onFinal은 정상 stop/end 뒤 한 번만 호출한다. 빈 문자열도 전달한다.
- stop은 최종 transcript와 empty를 반환한다. interim을 final로 승격하지 않는다.
- no-speech는 오류로, 정상 stop의 빈 전사는 empty=true로 구분한다.
- 예상치 않은 end는 interrupted 오류다. 자동 재시작하지 않는다.
- 런타임 오류는 code/message/partialTranscript와 stop rejection으로 전달한다.
  stop 전 오류의 unhandled rejection은 내부에서 방지한다.
- 종료 가드·리스너·타이머를 먼저 정리하여 콜백의 재진입과 지연 이벤트를 격리한다.
- SPA 화면 이탈은 호출부 cancel이 필요하며 pagehide는 자동 취소한다.
- 실제 Chrome의 한국어 인식·카메라 동시 사용은 mock으로 검증할 수 없다.
  실장비 접근이 없으면 미검증으로 기록하고 완료 조건을 달성했다고 보고하지 않는다.
- 커밋·푸시·PR은 구현·검증·리뷰·초안 준비 후 승인받는다.
  승인 후 이 계획을 브랜치 첫 커밋으로 추가한다.

## 검증 계획

외부 호출 없는 fake recognition/EventTarget/timer로 SSR·지원 탐지·한국어 설정,
결과 순서·누적·interim 수정/축소·중복 이벤트, stop 뒤 최종 결과·빈 전사,
반복 stop, 권한/네트워크/no-speech/장치 오류, 동기 예외, 예상치 않은 end,
timeout·cancel·pagehide 경합, 정리·지연 이벤트·재시도 격리를 검증한다.
기존 TTS 회귀를 포함한 전체 test와 lint·typecheck·build를 수행한다.
Chrome에서 카메라 미리보기+한국어 발화·중지·무응답·이탈 후 마이크 해제를 별도 확인한다.

## (구현 후) 변경 메모 / 리뷰 반영

- planner 서브에이전트의 계획을 보존했다. 전체 결과 목록 재구성, stop/end 최종 확정,
  구조화된 오류, 취소·pagehide·확정 timeout, 지연 이벤트 격리를 구현했다.
- 실제 포트 계약에 맞춰 ARCHITECTURE와 SETUP의 사용법·수동 검증 절차를 갱신했다.
- STT 테스트 38개, 전체 테스트 299개 통과. lint·typecheck·production build 통과.
  첫 typecheck의 테스트 mock 타입 오류를 수정한 뒤 다시 통과했다.
- reviewer 리뷰: 이상 없음. must-fix와 nice-to-have 지적 없음.
- computer-use의 브라우저/앱 inventory가 빈 배열이다. 실제 Chrome에서 카메라와
  한국어 발화를 동시에 검증하지 못했다. 이 완료 조건은 남아 있으며 전체 완료로 표시하지 않는다.
- 사용자가 실장비 검증을 후속 이슈에서 진행하는 흐름에 동의하고 PR 생성을 승인했다.
  실제 화면이 연결되는 #17에서 전사·완료·이탈 정리를 확인하고, #20에서 Chrome의
  음성·카메라 동시 동작과 예외를 통합 검증한다. 현재 실장비 검증은 미실행으로 유지한다.
- 계획을 브랜치 첫 커밋으로, 구현·테스트·문서를 다음 커밋으로 추가한 뒤 푸시하고 draft PR을 생성한다.
