# Plan — Issue #9: 저장한 지원 카드의 내용을 수정하고 삭제한다

- 이슈: #9
- 브랜치: feat/9-cover-letter-edit-delete
- 상태: 완료
- 작성일: 2026-11-06

## 목표

본인 지원 카드의 회사명·직무·문항·경험을 수정하고 확인 후 삭제한다. 생성과 동일한 검증을 적용하고 수정 실패 시 기존 데이터를 전체 유지한다. 비로그인·타인·없는 카드 요청을 안전하게 처리한다.

## 단계별 계획

1. 편집 경로·UUID 검증과 인증된 상세 조회를 추가한다. 잘못된 ID·타인·없는 카드는 동일한 not-found, DB 장애는 재시도 안내로 처리한다.
2. Supabase 어댑터에 상세 조회·수정·삭제를 추가한다. 사용자 필터와 반환 행 소유권을 확인하고 문항·경험을 position 순으로 반환한다. 변경 전 서버에서 소유권을 확인하고 삭제 영향 행도 확인한다.
3. SECURITY INVOKER 수정 RPC에서 세션/소유권을 검증하고 부모 행을 잠근 뒤 부모·문항·경험을 한 트랜잭션으로 교체한다. 자식 실패 시 전체 롤백한다.
4. 생성 폼을 초기값·편집 ID로 재사용하고 공용 Zod 검증·정렬·추가·삭제·오류 시 입력 유지를 제공한다.
5. 대시보드에 보조 수정 링크, 편집 화면에 삭제 확인/취소/진행/오류 동선을 추가한다. 취소 시 요청하지 않으며 저장·삭제 성공 시 대시보드를 갱신한다.
6. 단위·DB·UI 검증 후 reviewer 서브에이전트 리뷰를 반영한다.

## 건드릴 파일 (경로 / 레이어)

- config/types: `src/config/cover-letter.ts`, `src/types/cover-letter.ts`, `src/types/database.ts`
- lib: `src/lib/supabase/cover-letters.ts`, `cover-letters.test.ts`
- features: `src/features/cover-letter/actions.ts`, `actions.test.ts`, `queries.ts`, `queries.test.ts`, `components/CoverLetterForm.tsx`, `CoverLetterCard.tsx`, `DeleteCoverLetterButton.tsx`, `CoverLetterEditor.tsx`, `CoverLetterNotFound.tsx`
- app: `src/app/dashboard/cover-letters/[id]/edit/page.tsx`, `not-found.tsx`
- DB: `supabase/migrations/20261106010000_update_cover_letter_rpc.sql`, `supabase/tests/cover-letter-edit-delete.sql`
- 문서: 이 계획, `docs/SETUP.md`

## 외부 의존·어댑터 / 스키마 변경

기존 사용자 세션·Publishable key의 Supabase 어댑터만 사용한다. 수정 RPC만 추가하며 테이블·RLS·FK는 유지한다. 문항/경험 ID를 참조하는 테이블이 없어 자식 배열 교체가 가능하다. 삭제는 기존 cascade(문항·경험·면접·면접 질문)를 따르며 Storage 파일 처리는 범위 밖이다. 생성/수정은 동일한 Zod 스키마를 사용하고 RPC는 기존 생성 함수 수준의 입력 검증을 수행한다.

## 리스크 · 열린 질문 · 승인 필요 지점

- 삭제 확인에 연결된 면접 기록 삭제도 명시한다. 키보드 취소·포커스 복귀를 지원한다.
- 부모 행 잠금으로 동시 수정을 직렬화한다. 버전 충돌 UI는 범위 밖이다.
- 원격 DB 적용 및 커밋·푸시·PR 생성은 구현·검증 후 사용자 승인 단계로 보류한다. 승인 후 계획만 첫 커밋에 보존한다.
- planner 서브에이전트 계획을 반영했으며 추가 설계 질문은 없다.

## 검증 계획

- lint, typecheck, test, build.
- 단위: 공용 검증, 인증, ID/소유권, 정렬, DB 장애, 변경 성공 시에만 갱신·redirect.
- 일회용 PostgreSQL: 수정·순서·경험 0개, 자식 insert 실패 시 원본/updated_at 전체 롤백, 익명·주체 없음·위조·타인·없는 카드 거부, 삭제 cascade와 타 계정 유지.
- UI: 초기값·재정렬·추가·삭제·오류 입력 유지, 삭제 취소/확인/실패, 데스크톱·모바일·키보드·접근성, 생성 폼 회귀.

## (구현 후) 변경 메모 / 리뷰 반영

- 구현 완료. 기존 생성 폼을 편집에 재사용하고 대시보드 수정 링크, 상세 조회·수정·삭제 어댑터/액션, 한국어 not-found·조회 장애 재시도, 네이티브 dialog 삭제 확인을 추가했다.
- 문항·경험은 position(동률이면 ID) 순으로 읽고, 수정 RPC는 부모 행 잠금 후 자식 목록을 교체한다. 서버에서 사용자 필터와 반환 행 소유권을 확인하고 RPC에서도 세션·소유권을 재검증한다. 삭제는 사용자 필터와 영향 행까지 확인한다.
- 일회용 PostgreSQL 18.6에 전체 migration을 적용하고 `ownership.sql`, `cover-letter-create.sql`, `cover-letter-edit-delete.sql` 통과. 자식 INSERT 오류를 주입해 부모/updated_at/기존 자식 전체 유지, 타인/익명 거부와 삭제 cascade를 확인했다.
- 적용한 로컬 DB에서 `@supabase/postgres-meta@0.100.0`으로 DB 타입 재생성(PostgREST 14.18, one-to-one 탐지), 신규 RPC 타입만 변경됐다.
- 최종 lint, typecheck, test 105개, build 통과.
- 임시 로컬 QA 경로에서 Edge/Playwright로 초기값, 문항/경험 추가·삭제·재정렬, 공용 검증, 삭제 취소 시 POST 없음, Escape/포커스 복귀, 인증·통신 실패 시 입력 유지, 진행 중 경쟁 조작 차단, 신규 생성 폼 회귀를 확인했다. 실제 편집 경로 비로그인 요청은 307 로그인 이동을 확인했다.
- 1280·375·320px 폼/모달의 axe 위반 0건과 가로 넘침 없음을 확인하고 캡처를 직접 검토했다. 임시 QA 라우트는 제거했다.
- reviewer must-fix 1건(미정의 Tailwind 색상)을 `foreground` 토큰으로 수정했다. 조회 장애 재시도는 일반 링크로 재요청하며 삭제 설명의 긴 회사명 줄바꿈을 보강했다. 재리뷰 잔여 지적 없음.
- 원격 dry-run 최초 실행은 프로젝트 미연결(`ProjectRefNotLinkedError`)로 실패했다. `.env.local`의 Supabase URL에서 프로젝트 ref를 얻어 명시한 뒤 성공했으며 `interview-AI` production에 신규 수정 RPC migration 1개만 미적용임을 확인했다. 실제 DB 적용은 하지 않았다.
- 실제 Supabase 로그인 상태의 수정 저장/재진입·삭제 통합 확인은 미실행이다. 커밋·푸시·PR 생성과 원격 migration 적용은 사용자 승인 대기다. 승인 후 계획을 첫 커밋으로 보존한다.

### 사용자 후속 요청: 원격 적용과 REST 전환

- 사용자가 수정 RPC의 원격 적용과 REST 방식 전환을 명시 승인했다. 기존 계획은 보존하고 전송 경계를 변경한다.
- planner 재계획: `/api/cover-letters` GET/POST 및 `/api/cover-letters/{id}` GET/PATCH/DELETE를 제공한다. app은 재수출만, 인증·검증·HTTP 응답은 feature 핸들러, DB 작업은 기존 어댑터/RPC에서 처리한다.
- POST/PATCH는 동일한 편집 문서 JSON을 받고 배열 순서까지 교체한다. DELETE는 본문 없이 확인창에서만 호출한다. 상태 코드는 200/201/204, 입력 400, 인증 401, Origin 403, 없는/타인 카드 404, 서버 장애 500이다. 모든 응답은 private/no-store로 처리한다.
- 자소서 Server Actions를 제거하고 API 클라이언트를 추가한다. 폼/삭제 확인창은 fetch 후 성공 시 router 이동·갱신, 오류 시 입력 유지로 전환한다. 서버 렌더링의 초기 조회는 어댑터 직접 호출을 유지한다.
- 추가 파일: `src/features/cover-letter/handlers.ts`, `handlers.test.ts`, `api-client.ts`, `api-client.test.ts`, `src/app/api/cover-letters/route.ts`, `[id]/route.ts`, `src/lib/supabase/cover-letter-errors.ts`, `docs/API.md`. `actions.ts`/`actions.test.ts`를 제거한다.
- 원격 `interview-AI` production에 `20261106010000_update_cover_letter_rpc.sql` 1개를 적용했다. 원격 적용 승인은 완료됐으며 커밋·푸시·PR 승인은 별도로 남아 있다.
- 원격 함수의 SECURITY INVOKER·빈 search_path·authenticated 실행 허용·anon 실행 금지 및 migration 이력을 확인했다. 후속 dry-run은 미적용 migration 0개다.
- REST 전환 후 단위 테스트 116개·lint·typecheck 통과. reviewer 재검토 잔여 지적 없음.
- localhost:3000의 실제 페이지와 Supabase 임시 로그인 계정 두 개로 통합 검증했다. 생성 POST 201, 상세 GET 200, 수정 PATCH 200 후 대시보드 즉시 갱신과 재진입 시 회사 정보·문항 순서·경험 유지, 문항/경험 삭제 저장을 확인했다. 삭제 DELETE 204 후 빈 대시보드와 연결 면접/질문 cascade도 확인했다.
- 같은 통합 검증에서 타인 GET/PATCH/DELETE 404, 비로그인 401, 외부 Origin 403, 잘못된 입력 400과 private/no-store를 확인했다. 삭제 취소는 요청하지 않으며 통신 실패 시 입력 유지·진행 중 조작 차단도 통과했다.
- 실제 편집 화면 1280·375·320px에서 폼/모달 axe 위반 0건, 가로 넘침 없음 및 캡처를 확인했다. 임시 사용자·세션·소속 데이터는 검증 후 모두 삭제했다. 사용자 기존 카드는 수정하지 않았다.
- 실행 중인 사용자 개발 서버의 `.next`에 영향을 주지 않도록 동일 소스를 임시 디렉터리에 복사해 프로덕션 빌드를 별도로 실행했으며 통과했다.
- 사용자가 PR 생성을 승인했다. 계획을 첫 커밋에 보존하고 구현·문서·검증 결과를 다음 커밋으로 묶어 브랜치 푸시와 PR 생성을 진행한다.
