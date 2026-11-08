# Plan — Issue #15: 답변 맥락으로 꼬리질문 여부를 판단하는 API를 제공한다

- 이슈: #15
- 브랜치: feat/15-follow-up-api
- 상태: 완료
- 작성일: 2026-11-08

## 목표

본인 진행 중 면접의 질문과 확정 답변으로 한국어 꼬리질문 하나 또는 null을 반환한다.
저장된 자소서·직무·직전 질문/답변·이전 꼬리질문을 반영하며 중복/동시 요청에도
메인 질문당 최대 2개를 보장한다. 클라이언트 상태머신·공통 답변/종료 저장·채점은 범위 밖이다.

## 단계별 계획

1. 요청/응답 Zod 계약과 답변 길이 제한·API 경로를 정의한다.
2. 소스 질문을 PK로 하는 판단 테이블에 답변과 결과(null 포함)를 저장한다.
   RLS와 FK로 소유권/면접 관계를 유지한다.
3. 서버 전용 DB 어댑터가 본인 세션·질문 소속·진행 상태와 메인 부모 및 이전 꼬리를 확인한다.
   동일 질문/답변은 결과를 재사용하고 다른 답변은 409로 거부한다.
4. AI 호출은 락 밖에서 수행한다. 저장 RPC에서 세션 행을 잠근 뒤 소유권·상태·최신 질문·
   기존 판단·상한을 재검사하고 질문/판단을 원자적으로 저장한다.
   부모별 순서 UNIQUE와 0..1 CHECK로 동시 저장에도 상한을 유지한다.
5. feature 핸들러와 route 재수출을 추가한다. Origin/인증/JSON/입출력을 검증하고 오류를 구분한다.
6. 실제 로컬 PostgreSQL에서 마이그레이션과 SQL/동시성 검사를 실행하고 DB 타입을 재생성한다.
7. 단위 테스트·lint·typecheck·build와 reviewer 검토를 진행하고 API/설정 문서를 갱신한다.

## 건드릴 파일 (경로 / 레이어)

- app: `src/app/api/interview/follow-up/route.ts`
- features: `src/features/interview/follow-up-handler.ts` 및 테스트
- lib: `src/lib/supabase/interview-follow-ups.ts`, 오류 및 테스트 (기존 AI 팩토리 재사용)
- types/config: `src/types/interview.ts`, `src/types/database.ts`, `src/config/interview.ts`
- DB: `supabase/migrations/20261108010000_interview_follow_up.sql`, `supabase/tests/interview-follow-up.sql`
- docs: `docs/API.md`, `docs/SETUP.md`, 이 계획

## 외부 의존·어댑터 / 스키마 변경

기존 getCurrentUser/findCoverLetter/getQuestionGenerator를 재사용한다. DB는 사용자 세션과
Publishable key만 사용한다. 판단 테이블, 부모/순서 제약 및 SECURITY INVOKER RPC를 추가한다.
PUBLIC/anon 권한 회수와 authenticated 권한을 명시한다. DB row 타입은 공식 생성기로 재생성한다.

## 리스크 · 열린 질문 · 승인 필요 지점

- AI 동시 호출 자체는 중복될 수 있지만 첫 저장 결과만 채택한다. 실패 결과는 판단으로 저장하지 않는다.
- 같은 소스에 다른 답변은 덮어쓰지 않는다. null 결과도 재시도에서 다시 생성하지 않는다.
- AI 도중 종료/삭제되는 세션은 저장 시 재검사한다. 자소서 내용은 조회 시점 기준이다.
- SQL의 상한 2와 MAX_FOLLOW_UPS를 일치시킨다. 기존 데이터가 제약을 위반하면 migration은 실패한다.
- 시작 API는 질문 텍스트만 반환하므로 질문 ID를 사용하는 화면 연결은 후속 작업이다.
- 원격 migration/유료 AI 호출은 실행하지 않는다. 구현·검증·리뷰·PR 초안을 준비하고
  승인 후 계획을 첫 커밋으로 추가한 뒤 구현 커밋·푸시·PR 생성을 진행한다.

## 검증 계획

- API: 정상/불필요/null/상한, 정확한 맥락, 인증/Origin/JSON/UUID/입력 위조/소유권/종료,
  AI 실패/형식 오류/DB 장애와 no-store 응답.
- DB: 소유권·상태 재검사, 부모/순서/상한, 동일 질문 replay/다른 답변 충돌,
  null 멱등성, 부분 저장 롤백, 독립 연결의 동시 요청 및 기존 SQL 회귀.
- 전체 test·lint·typecheck·production build와 reviewer must-fix 반영.

## (구현 후) 변경 메모 / 리뷰 반영

- planner 서브에이전트와 협의한 계획을 보존했다.
- 빈 확정 전사는 기존 AI 계약에 맞춰 AI 호출 없이 null로 확정한다.
- 구현 완료: route는 feature 핸들러를 재수출하고 사용자 세션/소유권/질문 소속/진행 상태를
  검증한다. 저장된 전체 맥락을 기존 AI 팩토리에 전달하고 결과 검증 후 RPC에서 확정한다.
- 별도 판단 테이블에 정규화한 답변과 결과 문자열/null을 보존한다. 생성 질문 ID를 추가로
  보존하지 않고 API 계약에 필요한 결과 자체를 재사용한다. 공통 답변 기록은 변경하지 않는다.
- 질문/판단 저장은 세션 행 잠금 아래 한 트랜잭션이다. UNIQUE는 면접/메인 부모/순서 기준으로
  두어 기존 소유권/FK 공격 검사의 오류 우선순위도 유지했다. 부모별 0·1 슬롯 상한은 DB 제약이다.
- PostgreSQL 18.6 일회용 인스턴스에 전체 migration을 적용했다. 기존 SQL 4개와 신규
  `interview-follow-up.sql`이 모두 통과했다. 판단 INSERT 실패를 주입하여 질문도 롤백됨을 확인했다.
- `interview-follow-up-concurrency.mjs`에서 실제 두 연결의 Lock 대기를 확인하고
  동일 답변 동시 저장의 결과 일치, 다른 답변 충돌, 두 슬롯과 상한/null 재사용,
  종료 트랜잭션과 판단 재요청의 경합을 검증했다. 해당 임시 계정과 자소서는 정리했다.
- 적용 DB에서 공식 `@supabase/postgres-meta@0.100.0` 및 `oxfmt@0.66.0`으로 DB 타입을
  재생성했다. 기존 PostgREST 14.18/one-to-one 탐지 설정을 유지했다.
- lint·typecheck·전체 테스트 350개·production build 통과. 신규 API/DB 어댑터 단위 테스트는 51개다.
- production HTTP에서 비로그인 401 JSON·private/no-store·리다이렉트 없음,
  외부/누락 Origin 403, GET 405를 확인했다.
- reviewer 검토: 이상 없음. must-fix 및 별도 개선 지적 없음.
- 원격 migration 적용, 실제 로그인·AI·DB 통합 호출과 생성 한국어 품질의 실서비스 검증은
  미실행이다. 실제 사용자 자소서를 외부로 전송하지 않았다. 원격 적용이 필요하다.
- PR 본문 초안 작성 후 사용자가 커밋·푸시·PR 생성을 승인했다.
  계획을 브랜치 첫 커밋으로 추가하고 구현·검증 결과를 이어서 커밋한다.
