# Plan — Issue #3: 자소서와 면접 데이터 스키마 및 RLS를 구성한다

- 이슈: #3
- 브랜치: feat/3-database-rls
- 상태: 완료
- 작성일: 2026-11-04

## 목표

아키텍처 §4의 5개 테이블을 SQL로 재현하고 계정별 CRUD를 격리한다. 다른 계정의
자소서·면접·부모 질문을 연결하는 우회를 차단한다. 영상 없이 기록을 저장할 수 있고,
실제 DB에서 생성한 Supabase 타입과 재실행 가능한 검증 절차를 제공한다.

## 단계별 계획

1. 전용 브랜치에 planner의 계획을 보존한다.
2. 테이블·제약·인덱스·updated_at 트리거와 RLS를 초기 마이그레이션에 작성한다.
3. 두 계정 및 anon 역할로 CRUD와 외래키 우회를 검사하는 SQL 테스트를 작성한다.
4. 임시 로컬 PostgreSQL에 적용하고 실제 역할/JWT 주체를 전환하여 검증한다.
5. 공식 Supabase 생성기를 적용 DB에 실행하고 기존 클라이언트에 Database 타입을 연결한다.
6. 재현 방법을 문서화하고 lint/typecheck/test/build 및 reviewer 검토를 완료한다.
7. 승인 후 계획을 첫 커밋, 구현을 다음 커밋으로 남기고 푸시·PR을 생성한다.

## 건드릴 파일 (경로 / 레이어)

- `supabase/migrations/20261104000000_create_interview_schema.sql` — DB
- `supabase/tests/ownership.sql` — DB 회귀 검증
- `supabase/tests/bootstrap.sql` — 빈 로컬 PostgreSQL 전용 Auth 테스트 기반
- `src/types/database.ts` — 생성 타입
- `src/lib/supabase/{client,server,middleware}.ts` — 기존 어댑터의 타입 연결
- `docs/SETUP.md` — 적용·타입 생성·검증 안내
- `README.md` — 현재 제공하는 DB 기반과 검증 안내 링크
- `docs/plans/issue-003-database-rls.md` — 계획과 결과 기록

## 외부 의존·어댑터 / 스키마 변경

기존 Supabase 어댑터를 유지한다. 화면·CRUD 액션·Storage는 범위 밖이다.

- cover_letters, essay_items, experiences, interviews, interview_questions를 구현한다.
- 정렬 순번과 소요시간은 음수를 금지하고 상태/질문 종류는 CHECK로 제한한다.
- 영상·오디오 경로와 종료 메타데이터는 nullable로 유지한다.
- 모든 테이블에 RLS를 적용하고 authenticated에 CRUD만 허용한다. anon/PUBLIC의
  기본 권한과 authenticated의 TRUNCATE 등 불필요한 권한은 명시적으로 회수한다.
- USING과 WITH CHECK로 기존 행/변경 행 모두 소유권을 확인한다.
- 하위 행은 소유 자소서/면접의 존재를 확인한다. 면접의 자소서와 user_id는
  복합 FK로 일치시킨다.
- 질문 부모는 `(parent_question_id, interview_id)` 복합 FK로 같은 면접에 제한한다.
  부모 질문의 면접을 변경하여 기존 자식의 연결을 깨뜨리는 것도 차단한다.
- 재정렬 UNIQUE, 최소 문항 수, 꼬리질문 개수 제한은 후속 도메인 구현에 맡긴다.

## 리스크 · 열린 질문 · 승인 필요 지점

- PATH에 PostgreSQL/Docker가 없어 임시 디렉터리에 PostgreSQL 바이너리와 공식
  `@supabase/postgres-meta`를 준비한다. 앱 의존성은 추가하지 않는다.
- 로컬 Auth fixture/역할 검증과 실제 Supabase Auth/PostgREST HTTP 검증을 구분한다.
- 타입을 수작업으로 작성하지 않고 실제 적용 DB에서 생성한다.
- 원격 DB 적용 및 커밋·푸시·PR은 구현/검증 결과를 준비한 뒤 승인받는다.

## 검증 계획

- SQL 테스트는 트랜잭션 안에서 A/B 계정을 만들고 ROLLBACK한다.
- 두 계정의 본인 CRUD 성공, 타인 SELECT/UPDATE/DELETE 무효 및 INSERT 거부를 확인한다.
- anon CRUD와 authenticated TRUNCATE를 차단한다.
- 소유자 변경, 하위 행 재연결, 타인 및 본인 다른 면접의 부모 질문 연결을 거부한다.
- 부모 면접 변경, 필수 CHECK, 영상 없는 종료/Q&A 저장, cascade를 확인한다.
- 공식 타입 생성 후 lint, typecheck, 기존 test, build를 실행한다.
- reviewer의 must-fix를 반영하고 실제 검증 범위를 기록한다.

## (구현 후) 변경 메모 / 리뷰 반영

- 커밋 승인 전에는 계획과 구현 파일을 작업 트리에 보존한다. 승인 후 계획을 첫 커밋으로 남긴다.
- 공식 Supabase CLI 3.0.0의 `gen types --remote=<local-db-url>`이 Docker 없이 로컬 DB에서
  동작함을 확인하여 최종 타입은 CLI 결과를 `oxfmt@0.66.0`으로 포맷했다. postgres-meta의
  별도 생성 결과도 대조했다. CLI 3.0.0은 v2의 `--linked` 대신 `--remote`를 사용한다.
- Windows 일회용 PostgreSQL 18.6 두 DB에서 검증했다. 첫 DB는 SQL 직접 적용,
  두 번째 DB는 과거 Supabase의 ALL 기본 권한을 재현한 뒤 CLI `db push --skip-vault`로
  적용했다. 두 DB 모두 `ownership.sql`의 A/B 계정 CRUD·anon·FK·제약·cascade 검사가 통과했다.
- 부모 질문 복합 FK와 RLS를 각각 일시 제거했을 때 테스트가 실패함도 확인했고, 해당 변경은
  ROLLBACK했다. 깨끗한 DB의 타입 재생성 결과는 최종 파일과 해시가 같고 CLI dry-run의
  pending migration은 0이었다.
- 로컬 DB는 TLS를 제공하지 않아 최초 CLI 생성 연결이 거부되었다. 일회용 loopback URL에만
  `sslmode=disable`을 지정하여 해결했다. 원격 환경에 이 옵션을 적용하지 않는다.
- `npm run lint`, `npm run typecheck`, `npm run test`(4개 파일/29개 테스트),
  `npm run build` 모두 통과했다. DB 검사는 앱의 모킹 테스트와 별도로 실제 PostgreSQL에서 실행했다.
- reviewer 검토 및 기본 권한 테스트 대역 추가 후 재검토 모두 must-fix/nice-to-have 없음.
- 원격 Supabase migration 적용 및 실제 Auth 로그인/PostgREST HTTP 요청 검증은 미실행이다.
  임시 Auth fixture를 사용한 역할/JWT DB 검증과 구분하여 PR에도 명시한다.
- 코드·검증·리뷰 완료 후 2026-11-05 사용자 승인을 받아 계획/구현 커밋·푸시·초안 PR을
  진행한다. 원격 DB 적용 및 실제 Auth/PostgREST 검증은 이번 게시 승인 범위에 포함하지 않는다.

### 2026-11-05 원격 적용 및 HTTP 검증 보완

- 사용자가 원격 적용·실제 로그인/HTTP 검증 및 PR 반영을 추가 승인했다. CLI 로그인 완료 후
  `.env.local`의 프로젝트와 일치하는 `interview-AI`에 migration을 적용했다.
  적용 후 dry-run은 pending migration 0이며 원격 PostgreSQL 버전은 17.11이다.
- `ownership.sql`을 CLI `db query`로 원격 DB에서도 실행했고 오류 없이 ROLLBACK했다.
- `scripts/verify-supabase-http.mjs`와 명시적 `npm run test:db:http` 명령을 추가했다.
  기존 오프라인 테스트와 분리하고, Secret key는 fixture 관리에만 사용한다.
- 실제 이메일·비밀번호로 로그인한 A/B 계정 및 비로그인 요청으로 190개 HTTP 요청과
  373개 assertion을 통과했다. 본인 CRUD, 계정/anon 격리, FK/소유자 우회 차단,
  영상 없는 결과 저장, cascade 및 계정/데이터 정리를 확인했다.
- 테스트 사용자는 해당 실행의 ID·이메일·metadata를 확인하고 삭제했으며, 사용자 GET의
  404와 해당 fixture ID의 DB 조회 결과 0건을 확인했다. 키·비밀번호·토큰은 기록하지 않는다.
- 실제 원격 DB에서 타입을 다시 생성했다. 이후 원격 검증 결과와 재실행 방법을 PR에 반영한다.
- 원격 타입 갱신 및 HTTP 스크립트 추가 후 lint/typecheck/기존 29개 테스트/build가 모두 통과했다.
- reviewer 재검토 must-fix 없음. nice-to-have인 정리 실패 메시지의 비밀값이 아닌 `test_run`
  식별자를 추가하여 관리자 화면에서 잔여 fixture를 찾을 수 있게 했다.
