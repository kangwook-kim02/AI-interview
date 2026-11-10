# Plan — Issue #18: 답변 전사와 정상 종료 및 중도 종료 기록을 저장한다

- 이슈: #18
- 브랜치: feat/18-interview-records
- 상태: 완료
- 작성일: 2026-11-10

## 목표

확정된 메인·꼬리 답변을 실제 질문 행에 저장하고, 정상 완료·중도 종료와 서버 기준 종료 시각·소요시간을 확정한다. 같은 요청 재시도에도 기록을 유지하고 저장 성공 후에만 결과 경로로 이동한다. 영상·음성 파일 저장, 새로고침 후 재개, 전체 결과 조회 UI는 범위 밖이다.

## 단계별 계획

1. 종료 입력·응답을 Zod로 정의한다. 클라이언트는 시각·소요시간·사용자 ID를 지정하지 않는다.
2. 면접 행을 잠그는 답변 저장·종료 RPC를 추가한다. 소유권·질문 소속·부모 관계를 검증하고 같은 답변만 재시도한다. 종료는 답변 보완 저장과 원자적으로 처리하며 completed는 모든 질문의 답변과 판단 완료를 확인한다.
3. 기존 꼬리질문 핸들러에서 AI 호출 전에 확정 답변을 저장한다. AI 실패에도 답변은 남기고, 기존 판단 RPC도 같은 답변 계약을 지킨다.
4. 종료 IO를 추가한다. 질문 위치를 저장된 UUID로 해석하고 확정 답변 목록과 종료 사유를 전송한다.
5. finishing의 실패·재시도를 지원한다. 종료 사유·답변은 고정하며 카메라를 다시 연결하지 않아도 재시도한다.
6. 평가 도중 종료는 확정 답변 목록을 보완 저장한다. 생성 중 명시 종료는 생성 응답에서 ID를 회수하고 aborted로 저장한다. 늦은 음성·평가 이벤트는 무시한다.
7. 저장 성공 후에만 소유권을 확인하는 최소 결과 확인 경로로 이동한다. 전체 기록 조회 화면은 #19에서 구현한다.
8. DB·서버·세션 경계 테스트와 문서를 보강하고 reviewer 검토를 반영한다.

## 건드릴 파일 (경로 / 레이어)

- `src/types/interview.ts`, `src/types/database.ts`, `src/config/interview.ts`: 공유 계약·RPC 타입·경로.
- `src/lib/supabase/interview-records.ts`, `interview-follow-ups.ts`: DB 어댑터.
- `src/features/interview/finish-handler.ts`, `follow-up-handler.ts`: 서버 인증·검증·저장 조정.
- `src/app/api/interview/finish/route.ts`: 핸들러 재수출.
- `src/lib/interview-session/{types,http}.ts`: 종료 IO와 위치 해석.
- `src/features/interview/{machine,session}.ts`: 저장 대기·실패·재시도·생성/종료 경쟁.
- `src/features/interview/components/InterviewSessionView.tsx`: 저장 대기·실패 안내·성공 이동.
- `src/features/interview/queries.ts`, 최소 결과 컴포넌트 및 `src/app/interview/[coverLetterId]/[interviewId]/result/page.tsx`: 인증된 최소 결과 확인.
- `supabase/migrations/20261110000000_interview_records.sql`: RPC와 기존 판단의 답변 저장 일관성.
- 관련 `*.test.ts`, `supabase/tests/interview-records.sql`: 계약 검증.
- `docs/API.md`, `docs/SETUP.md`: 계약·검증 안내.

## 외부 의존·어댑터 / 스키마 변경

새 서비스·패키지 없이 기존 DB 컬럼을 사용한다. DB는 lib/supabase, 브라우저 IO는 InterviewSessionIO 경계를 유지한다. SQL 함수는 사용자 세션·auth.uid()·명시적인 소유권 검사와 RLS를 사용한다. LLM은 기존 팩토리 경유다.

## 리스크 · 열린 질문 · 승인 필요 지점

- 초안은 저장하지 않는다. NULL은 미저장, 빈 문자열은 확정 빈 답변이다.
- 종료와 늦은 AI 저장은 같은 면접 잠금으로 직렬화한다.
- 강제 탭 종료 또는 생성 응답 유실에서 저장 성공을 보장할 수 없다. 시작 요청의 멱등성·새로고침 복원은 별도 범위다.
- 원격 DB 적용·커밋·푸시·PR은 로컬 구현과 검증을 마친 뒤 사용자 승인 범위를 확인한다. 플랜 첫 커밋 규칙은 승인 후 플랜만 먼저 커밋하여 지킨다.

## 검증 계획

- DB: 소유권·질문 소속·부모·순서·빈 답변, 재시도와 답변 충돌, 정상/중도 종료, 서버 시각, 원자성, 종료 재시도 불변, 늦은 판단 거부.
- API: Origin·인증·JSON·Zod·서버 사용자·상태별 오류·캐시 방지·내부 오류 비노출.
- 세션: 정상 종료 저장 대기, 종료 실패와 같은 payload 재시도, 평가 중 종료의 답변 보존, 생성 중 종료 ID 회수, 늦은 이벤트 무시·자원 정리.
- lint / typecheck / test / build. 실제 DB·음성·레이아웃 검증 여부는 사실대로 기록한다.

## (구현 후) 변경 메모 / 리뷰 반영

- planner 계획을 바탕으로 답변 저장은 별도 공개 API 대신 기존 follow-up 핸들러 내부에서 AI 전에 수행한다. 종료 API는 기존 질문/꼬리질문 API와 같은 `/api/interview/finish` 경로 패턴을 사용한다.
- reviewer 지적 반영: rejected start Promise로 종료 재시도가 반복 실패하던 경로와 시작 전 취소를 구별했다. 앱이 `X-Interview-Not-Created`로 미생성을 명시한 거절만 기록 없는 취소로 안내하고, 네트워크/게이트웨이 응답 유실은 성공으로 안내하지 않는다.
- reviewer의 직접 테이블 쓰기 경계 확인을 반영해 DB trigger로 시작/종료 서버 시각, 답변·종료 메타데이터 불변과 종료 후 질문 쓰기를 보호했다. 본인 기록 삭제는 유지한다. 기존 소유권/꼬리질문 테스트의 부분 면접 fixture는 completed 대신 aborted를 사용한다.
- 종료 성공의 최소 결과 확인 경로만 추가했다. 전체 Q&A 조회·목록은 #19 범위다.
- 로컬 DB에서 생성한 Supabase 타입의 신규 RPC 정의를 기존 파일 스타일로 반영했다.
- 최종 reviewer 재검토: 남은 must-fix 없음. lint/typecheck, 29개 파일 463개 테스트, 새 로컬 PostgreSQL 전체 SQL 검증 6개와 동시성 검증 2개 통과.
- 1280px/375px 모의 음성·카메라 UI 검증에서 저장 실패 안내·확정 답변 보존·동일 payload 재시도·카메라 종료·성공 응답 전 결과 이동 방지·가로 넘침 없음을 확인했다. 임시 QA 라우트는 제거했다. 실제 발화·물리 장비와 원격 DB 적용은 미검증이다.
- 2026-11-10 사용자 테스트의 저장 실패를 조사해 연결된 Supabase에서 신규 RPC 두 개가 `PGRST202`로 응답함을 확인했다. 사용자 승인 후 `20261110000000_interview_records.sql` 한 개만 원격 적용했다. 마이그레이션 이력·두 RPC·authenticated 실행 권한·DB trigger 3개를 확인했으며 REST에서 함수 미등록 오류가 사라지고 미인증 호출을 정상 거부했다.
- 사용자 확인: 정상 완료·중도 종료·재시도 버튼 표시를 확인했다. 원격 DB 조회로 정상/중도 종료 상태·소요시간·확정 전사의 실제 저장도 확인했다. 사용자 승인으로 커밋·푸시·PR 생성 단계로 진행한다.
