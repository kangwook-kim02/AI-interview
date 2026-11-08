# Plan — Issue #12: 본인 자소서로 세션을 만들고 메인 질문 4개를 제공한다

- 이슈: #12
- 브랜치: feat/12-start-interview
- 상태: 완료
- 작성일: 2026-11-08

## 목표

인증된 사용자가 본인 coverLetterId로 POST /api/interview/questions를 요청하면
저장된 회사명·직무·문항/답변·경험으로 메인 질문 4개를 생성하고 독립된 면접 세션과
질문을 원자적으로 저장한다. 성공 시 `{ interviewId, questions: string[] }`를 반환한다.
재면접은 기존 기록을 덮어쓰지 않으며 인증·소유권·입출력을 검증한다.

범위 밖: UI 연결, TTS/STT, 상태머신, 꼬리질문 API, 녹화, 재전송의 exactly-once 보장.

## 단계별 계획

1. coverLetterId 요청과 UUID interviewId/정확히 4개 비공백 질문 응답의 Zod 계약을 정의한다.
2. SECURITY INVOKER·빈 search_path의 create_interview RPC를 작성한다.
   auth.uid와 검증된 expected_user_id의 일치, 본인 카드 존재·소유권을 재확인하고
   카드를 잠근 뒤 세션과 질문을 한 트랜잭션에 저장한다. 순서는 0..3이다.
3. 서버 전용 Supabase 어댑터로 RPC를 호출하고 반환 UUID를 검증한다.
4. feature 핸들러에서 Origin·인증·JSON·UUID·소유권을 검사한다.
   저장된 맥락만 AI 팩토리에 전달하고 결과를 검증한 후에만 DB에 저장한다.
   저장 성공 후 201 응답을 반환한다. 오류 원문은 노출하지 않고 모든 응답은 no-store다.
5. app route는 POST 핸들러만 재수출한다. API의 미인증 응답은 JSON 401이어야 하므로
   페이지용 로그인 리다이렉트 목록에서 API를 제외하고 세션 갱신 matcher는 유지한다.
6. 격리된 로컬 DB에서 SQL을 검증하고 공식 생성기로 DB 타입을 재생성한다.
7. 핸들러·어댑터·SQL 테스트, lint·typecheck·전체 test·build 및 reviewer 검토를 완료한다.

## 건드릴 파일 (경로 / 레이어)

- `src/app/api/interview/questions/route.ts` — app 재수출
- `src/features/interview/handlers.ts`, `handlers.test.ts` — feature 요청 조립
- `src/lib/supabase/interviews.ts`, `interviews.test.ts` — DB 어댑터
- `src/types/interview.ts`, `src/config/interview.ts` — Zod 계약·정책
- `src/config/auth.ts`, `src/features/auth/guard.test.ts` — API 로그인 redirect 방지
- `supabase/migrations/20261108000000_create_interview_rpc.sql` — 원자적 생성 함수
- `supabase/tests/interview-create.sql` — 실제 DB 통합 검사
- `src/types/database.ts` — 공식 도구로 재생성
- `docs/API.md`, `docs/SETUP.md`, 이 계획 — 계약·적용·검증 안내

## 외부 의존·어댑터 / 스키마 변경

기존 getCurrentUser, findCoverLetter, getQuestionGenerator를 재사용한다.
사용자 세션·Publishable key의 단일 RPC를 사용하며 Secret key는 사용하지 않는다.
테이블·RLS 변경 없이 함수와 권한을 추가한다. PUBLIC/anon 실행 권한을 회수하고
authenticated에만 허용한다. 생성 타입은 수동 편집하지 않는다.

## 리스크 · 열린 질문 · 승인 필요 지점

- AI 생성 성공 → 결과 검증 → 원자적 DB 저장 순서를 지켜 빈 세션을 먼저 만들지 않는다.
- AI 생성 중 카드가 삭제될 수 있어 RPC에서 소유권·존재를 재확인하고 잠근다.
- 맥락은 서버 조회 시점의 값이다. AI 호출 동안 편집 잠금/버전 스냅샷은 범위 밖이다.
- DB 응답 유실 시 완전한 세션의 커밋 여부가 불명확할 수 있다. 부분 세션은 막지만
  모든 네트워크 실패에서 행 0개를 보장하지 않으며 재요청은 새 세션을 만들 수 있다.
- SQL의 고정 질문 개수 4와 TypeScript MAIN_QUESTION_COUNT 정책을 일치시킨다.
- 원격 migration·실제 자소서 외부 전송·유료 AI 호출은 별도 승인 없이 실행하지 않는다.
- 구현·검증·리뷰와 PR 초안을 먼저 준비하고 승인 후 계획을 첫 커밋으로 추가한다.

## 검증 계획

- 핸들러: 정상 요청의 저장된 전체 맥락/서버 사용자 전달, 클라이언트 위조 거부,
  인증/Origin/JSON/UUID/소유권/AI/DB 오류, 응답 검증 및 no-store.
- 어댑터: 단일 RPC 전달·반환값 검증·동시 카드 삭제 식별·DB 오류 전파.
- SQL: 익명·JWT 없음·소유자 위조·타인/없는 카드 거부, 잘못된 질문 거부,
  owner/status/순서/유형/부모 null, 재면접 독립성, 질문 INSERT 실패 시 전체 롤백,
  두 계정 격리 및 기존 SQL 회귀 검사.
- 프로젝트: lint·typecheck·전체 test·build 및 reviewer must-fix 반영.

## (구현 후) 변경 메모 / 리뷰 반영

- planner 계획을 보존했다. API 401 처리를 위한 로그인 redirect 경계 수정을 포함한다.
- 구현 완료: POST는 저장된 자소서를 조회하고 AI 결과를 검증한 뒤 단일 RPC로 저장한다.
  같은 자소서의 재면접은 새 UUID를 생성한다. 성공 응답은 201이다.
- PostgreSQL 18.6 격리 인스턴스에 전체 migration을 적용하고 기존 SQL 테스트 3개와
  `interview-create.sql`을 통과했다. owner/status/순서/유형·재면접 보존·계정 격리와
  질문 INSERT 오류를 주입한 세션/질문 전체 롤백을 확인했다.
- 적용 DB에서 공식 `@supabase/postgres-meta@0.100.0` 및 `oxfmt@0.66.0`으로 타입을
  재생성했다. PostgREST 14.18/one-to-one 탐지 설정을 유지해 신규 RPC 타입만 변경됐다.
- lint·typecheck·전체 테스트 234개·production build 통과.
- production 서버에서 실제 HTTP로 API 미로그인 401 JSON·private/no-store·리다이렉트 없음,
  외부 Origin 403·GET 405 및 면접 페이지의 기존 로그인 307을 확인했다.
- reviewer 검토: 이상 없음. must-fix 및 추가 개선 지적 없음.
- 원격 migration 적용과 실제 인증·AI·DB 전체 통합 호출은 미실행이다.
  실제 사용자 자소서를 외부로 전송하지 않았다. 신규 함수의 원격 적용이 필요하다.
- 커밋·푸시·PR 생성 및 원격 migration은 구현·검증 결과와 초안을 준비한 뒤 승인 대기다.

### 사용자 후속 요청: 원격 적용 및 전체 통합 확인

- 사용자가 원격 적용 후 실제 로그인·AI·DB 통합 확인을 승인했다.
- `.env.local`과 일치하는 `interview-AI` production을 대상으로 dry-run해 신규 migration
  1개만 확인하고 `20261108000000_create_interview_rpc.sql`을 적용했다.
  이후 dry-run은 미적용 migration 0개다.
- 같은 원격 DB에서 `interview-create.sql`도 오류 없이 실행 후 ROLLBACK했다.
- 로컬 production 서버와 실제 Supabase 세션 쿠키로 임시 계정 A/B를 로그인시켜
  가상 자소서 생성 → 질문 생성 → 세션/질문 저장 → 재면접을 확인했다.
  면접 시작과 재면접 모두 201이며 실제 AI 호출은 2회다. 첫 요청 약 3.7초, 재면접 약 3.9초였다.
- 두 세션은 서로 다른 ID이며 각각 질문 4개를 순서/type/parent/null 초기값과 함께 저장했다.
  재면접 후 첫 세션과 질문 레코드가 그대로임을 확인했다.
- 타인/없는 카드 404 동일 응답, 비로그인 401, 잘못된 ID 400, 외부 Origin 403,
  private/no-store 및 RLS의 타 계정 세션/질문 숨김도 확인했다. 거부 요청은 추가 세션을 만들지 않았다.
- 생성 질문은 가상 자소서의 React 성능 분석·코드 분할·이미지 최적화·디자이너 협업과
  키보드 접근성 맥락을 반영한 한국어 질문이었다.
- 관리자 키는 임시 계정 생성·정리 및 정리 결과 확인에만 사용했고 실제 기능 검증은
  Publishable key와 사용자 세션으로 진행했다. 키·쿠키·토큰은 출력하지 않았다.
- 해당 실행의 UUID·이메일·metadata를 대조한 뒤 임시 계정을 삭제했다. 사용자 조회 404 및
  해당 계정/자소서/면접 ID로 필터한 도메인·질문 조회 0건으로 정리를 확인했다.
- 원격 적용과 통합 검증은 완료됐다. 사용자에게 커밋·푸시·PR 생성 승인을 받았으며
  계획을 브랜치 첫 커밋으로 추가하고 구현·검증 결과를 이어서 커밋한다.
