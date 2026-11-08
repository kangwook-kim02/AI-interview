# Plan — Issue #16: 질문과 답변 및 종료를 명시적 상태머신으로 제어한다

- 이슈: #16
- 브랜치: feat/16-interview-state-machine
- 상태: planning
- 작성일: 2026-11-08

## 목표

메인 4문항과 각 메인 직후 최대 2개 꼬리질문을 명시적 상태머신으로 진행한다.
TTS 종료 후 답변을 자동 시작하고 최종 전사를 기다린 뒤 판단한다.
중복 입력·늦은 응답을 무시하고 모든 진행 단계에서 중도 종료 및 오류 재시도를 제공한다.

## 단계별 계획

1. 순수 transition 함수에 상태·허용 이벤트·질문 위치·전사·오류·종료 이유를 정의한다.
2. idle → generating_questions → asking → recording → transcribing → evaluating
   → asking/finishing → done과 error를 구현한다. 질문 수·꼬리질문 상한은 config를 따른다.
3. 세션별 Zustand store를 만들고 모든 변경을 transition으로 처리한다.
4. controller가 주입된 질문 IO와 TTSPort/STTPort를 실행한다.
   작업 식별자와 취소로 재시도·중도 종료·dispose 이전 응답을 무효화한다.
5. 대답 완료를 수락하면 즉시 transcribing으로 이동하고 stop Promise만 최종 전사 입력으로 쓴다.
6. 질문 생성·TTS·STT·판단 오류를 보존하고 같은 작업을 재시도하거나 종료한다.
   STT 오류 재시도는 같은 질문을 다시 재생하고 답변을 새로 받는다.
7. useInterviewSession에서 세션 생성·구독·cleanup 및 사용자 동작을 제공한다.
8. 순수 전이와 fake IO/음성 포트 통합 검증을 추가하고 reviewer 지적을 반영한다.

## 건드릴 파일 (경로 / 레이어)

- src/features/interview/machine.ts — 상태·이벤트·전이 (features)
- src/features/interview/store.ts — 세션별 Zustand store (features)
- src/features/interview/session.ts — 비동기 controller (features)
- src/features/interview/hooks/useInterviewSession.ts — 생명주기·구독 (features)
- src/features/interview/machine.test.ts, session.test.ts — 전이·경쟁·오류 검증
- src/lib/interview-session/types.ts — 주입할 세션 IO 포트 (lib)
- package.json / package-lock.json — Zustand 의존성
- docs/INTERVIEW_SESSION.md — 포트 사용법·전이표·재시도·범위 설명

## 외부 의존·어댑터 / 스키마 변경

TTS/STT는 기존 lib/speech 포트와 팩토리를 사용한다. TTS 안전 타임아웃은 기존 구현이 담당한다.
IO 포트의 시작·판단 결과는 기존 StartInterviewResponse/FollowUpResponse를 사용한다.
판단 입력에는 interviewId, 메인 질문 위치, 꼬리질문 위치, 확정 전사를 전달한다.
위치는 DB UUID가 아니다. 기존 API는 UUID를 응답하지 않으므로 UUID 조회와 HTTP 연결은
#17 화면 연결 단계에서 구현한다. 이번에는 포트 구현을 주입받아 실행·검증한다.
LLM·DB 구현을 클라이언트에 import하지 않으며 스키마·마이그레이션 변경은 없다.

## 리스크 · 열린 질문 · 승인 필요 지점

- 질문 생성 재시도는 서버에 새 세션을 만들 수 있다. 로컬 abort는 서버 세션을 종료하지 않는다.
- 판단 재시도는 동일한 확정 전사를 유지한다. 부분 전사는 확정 답변으로 승격하지 않는다.
- 상한에서도 마지막 전사를 판단 IO에 전달한다. 서버의 답변/판단 저장과 결합할 수 있도록 하되
  반환된 추가 꼬리질문은 상태머신이 강제로 무시한다.
- finishing/done은 로컬 자원 정리 완료다. DB 종료 저장·녹화·업로드는 범위 밖이다.
- frontend-design 스킬 확인 완료. 화면·스타일 변경은 없다.
- 검증·리뷰를 마친 결과를 제시한 뒤 커밋·푸시·PR 생성 승인을 받는다.
  승인 후 계획 원본을 브랜치 첫 커밋으로 보존한다.

## 검증 계획

- 메인 4개, 꼬리 0~2개, 메인별 카운터 초기화와 상한 강제를 검증한다.
- TTS 완료 전 STT 시작 금지, stop 확정 전 판단 금지를 검증한다.
- 중복 완료·과거 음성/API 응답·재시도 이전 응답·종료 후 이벤트를 검증한다.
- 모든 단계의 abort, 생성·TTS·STT·판단 오류 재시도 및 dispose 취소를 검증한다.
- npm run test / lint / typecheck / build를 실행한다.
- 실제 브라우저 음성·HTTP 연결 수동 통합 검증은 #17에서 수행한다.

## (구현 후) 변경 메모 / 리뷰 반영

구현 및 reviewer 리뷰 후 추가한다.
