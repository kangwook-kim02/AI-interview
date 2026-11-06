# Plan — Issue #7: 회사 정보와 문항 및 경험을 입력해 저장한다

- 이슈: #7
- 브랜치: feat/7-cover-letter-create
- 상태: 완료
- 작성일: 2026-11-06

## 목표

로그인한 사용자가 회사명·직무, 최소 1개의 질문/답변과 선택적인 경험을 입력해 저장한다. 문항 추가·삭제·재정렬과 경험 추가·삭제를 지원하고 순서를 보존한다. 검증·저장 실패 시 입력을 유지하고 성공하면 대시보드로 이동한다. 목록·수정·삭제·면접은 범위 밖이다.

## 단계별 계획

1. config에 입력 상한·작성 경로, types에 공유 Zod 스키마와 파생 DTO를 정의한다.
2. SECURITY INVOKER RPC로 회사·문항·경험을 한 트랜잭션에서 저장한다. auth.uid()로 소유자를 결정하고 배열 순서를 position에 저장한다.
3. 서버 전용 DB 어댑터와 인증·검증·저장·리다이렉트를 담당하는 Server Action을 구현한다.
4. 기존 디자인 토큰·Input·Button을 재사용한 단일 열 폼을 만든다. 제어된 입력과 안정적인 key를 사용하고 문항 위/아래 이동을 지원한다. 저장 중 수정·중복 제출을 막는다.
5. 일회용 PostgreSQL에서 SQL·RLS·롤백을 검증하고 DB 타입을 재생성한다. 정적 검사·폼 동작 확인 후 reviewer 리뷰를 반영한다.

## 건드릴 파일 (경로 / 레이어)

- config: `src/config/cover-letter.ts`
- types: `src/types/cover-letter.ts`, `src/types/cover-letter.test.ts`, 생성 파일 `src/types/database.ts`
- lib: `src/lib/supabase/cover-letters.ts`
- features: `src/features/cover-letter/actions.ts`, `actions.test.ts`, `components/CoverLetterForm.tsx`
- 공통 UI: `src/components/ui/textarea.tsx`
- app: `src/app/dashboard/cover-letters/new/page.tsx`, `src/app/dashboard/page.tsx`
- DB: `supabase/migrations/20261106000000_create_cover_letter_rpc.sql`, `supabase/tests/cover-letter-create.sql`
- 문서: 이 계획, `docs/SETUP.md`

## 외부 의존·어댑터 / 스키마 변경

Supabase만 사용한다. 사용자 세션·Publishable key로 호출하며 Secret key는 사용하지 않는다. 기존 테이블·RLS를 유지하고 원자적 생성 RPC만 추가한다. 함수 실행은 authenticated만 허용한다. 생성 타입은 적용된 로컬 DB에서 postgres-meta로 재생성한다.

## 리스크 · 열린 질문 · 승인 필요 지점

- 제어된 입력으로 React 폼 초기화·서버 실패 시 값 유실을 방지한다.
- 개별 insert 후 보상 삭제 대신 DB 트랜잭션으로 불완전한 카드 생성을 방지한다.
- 원격 사용에는 신규 migration 적용이 필요하다.
- 커밋·푸시·PR 생성·원격 DB 적용은 사용자 승인 후 실행한다. 승인 후 첫 커밋에는 계획만 담는다.
- planner 서브에이전트 계획을 반영했다. 추가 설계 질문 없음.

## 검증 계획

- 스키마: 필수·공백·문항 0개·경험 0개·빈 경험·길이 상한.
- Action: 잘못된 입력·비로그인은 저장 거부, 저장 오류 안내, 성공 시에만 redirect.
- SQL: 본인 소유·순서 조회·경험 0개·익명/주체 없는 요청 거부·계정 격리·자식 insert 오류 시 전체 롤백, 기존 ownership 회귀 검사.
- lint, typecheck, test, build 및 데스크톱·모바일 폼/접근성 확인.

## (구현 후) 변경 메모 / 리뷰 반영

- 구현 완료. 대시보드 진입 링크와 작성 화면, 동적 문항/경험 폼, 공유 검증, 서버 액션, 저장 어댑터와 원자적 RPC를 추가했다.
- 원본 계획에 더해 `src/lib/supabase/cover-letters.test.ts`에서 검증된 소유자와 순서를 단일 RPC에 전달하는지 확인했다.
- 일회용 PostgreSQL 18.6에서 두 migration 및 `cover-letter-create.sql`, 기존 `ownership.sql` 통과. 자식 INSERT 실패를 주입해 부모·자식 전체 롤백을 확인했다.
- 적용한 로컬 DB에서 `@supabase/postgres-meta@0.100.0`으로 타입 재생성, `oxfmt@0.66.0`으로 포맷했다. 생성기 버전 차이로 `ComputedFields: never`도 추가됐다.
- `npm run test` 77개, lint, typecheck, build 통과.
- 임시 로컬 폼 경로에서 Edge/Playwright로 클라이언트 오류 시 서버 호출 없음, 문항 추가/삭제/재정렬·키보드 조작·안정적인 필드 ID, 경험 추가/삭제, 저장 중 조작 차단, 비로그인 서버 오류 후 입력 유지를 검증했다. 실제 작성 경로의 비로그인 307 로그인 리다이렉트도 확인했다.
- 1280·375·320px에서 가로 넘침 없음, axe 접근성 위반 0건. 캡처를 직접 확인했다. 임시 QA 라우트는 제거했다.
- reviewer must-fix 1건 반영: Server Action 전송 실패를 폼 안에서 처리해 입력을 유지한다. `unstable_rethrow`로 성공 리다이렉트는 보존했다. 브라우저에서 POST 전송을 중단해 오류 안내·입력 유지·재시도 가능을 확인했다. 재리뷰 결과 잔여 지적 없음.
- 원격 DB migration 적용과 실제 Supabase 로그인/저장 통합 검증은 미실행. 커밋·푸시·PR 생성은 승인 대기다.
- 사용자 피드백 1 반영: 회사명·직무 예시를 `OO전자`·`SW 개발`로 변경하고 질문을 한 줄 입력으로 축소했다. 문항 번호와 이동·삭제 버튼을 카드 헤더의 같은 줄에 배치해 상단 빈 공간을 줄였다. 모바일은 이동 버튼을 화살표로 표시하고 접근성 이름은 유지했다. 1280·375·320px에서 헤더 정렬·한 줄 입력·가로 넘침 없음·axe 0건과 기존 폼 동작을 재확인했다.
- 추가 피드백 반영: 경험 번호와 삭제 버튼도 같은 헤더 줄에 배치했다. 1280·375·320px에서 정렬·라벨 클릭 시 입력 포커스·가로 넘침 없음·axe 0건, 경험 추가/삭제 및 다른 항목 값 유지를 확인했다. reviewer 재검토 지적 없음.
- 사용자 저장 오류 조사: 연결된 Supabase를 read-only로 조회해 `create_cover_letter(uuid,text,text,jsonb,jsonb)` 함수가 없음을 확인했다. 명시한 프로젝트 대상으로 `db push --dry-run --skip-vault`를 실행한 결과 신규 생성 RPC migration 1개만 미적용이었다. 원격 적용은 사용자 승인 대기다.
- 사용자 승인 후 연결된 Supabase에 `20261106000000_create_cover_letter_rpc.sql` 1개를 적용했다. migration 이력·함수 존재·SECURITY INVOKER·빈 search_path·authenticated 실행 허용/anon 실행 불가를 read-only로 확인했다. Data API에서도 함수가 인식되며 익명 실행은 401/42501로 거부된다(데이터 생성 없음). 후속 dry-run은 미적용 migration 0개다. 실제 로그인 사용자 저장 재시도 확인은 남아 있다. 커밋·푸시·PR 생성은 여전히 승인 대기다.
- 최종 UI 피드백까지 반영하고 사용자로부터 커밋·푸시·PR 생성 승인을 받았다. 계획을 첫 커밋에 보존하고 구현·검증 결과를 함께 PR로 제출한다.
