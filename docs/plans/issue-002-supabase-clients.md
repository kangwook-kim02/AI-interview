# Plan — Issue #2: Supabase 연결과 서버 세션 조회 기반을 마련한다

- 이슈: #2
- 브랜치: `feat/2-supabase-clients`
- 상태: 구현중
- 작성일: 2026-11-04

## 목표

브라우저·서버 Supabase 클라이언트, 쿠키 기반의 검증된 현재 사용자 조회와 세션 갱신을 제공한다.
설정 누락을 값 노출 없이 안내하고 사용자 클라이언트에서 Secret key를 사용하지 않는다.
DB 스키마·RLS(#3), 가입·로그인 UI·보호 라우트(#5), Storage는 범위 밖이다.

## 단계별 계획

1. 호환 SDK `@supabase/ssr`·`@supabase/supabase-js`, `server-only`, Zod와 Vitest를 추가한다.
2. 공개 URL·Publishable key만 함수 호출 시 검증한다. 누락·잘못된 URL·공개 변수의 Secret key를
   거부하고 오류에는 변수명과 SETUP 문서 위치만 포함한다.
3. 브라우저 팩토리는 클라이언트 경계에, 서버 팩토리는 `server-only` 경계에 둔다.
   서버 클라이언트는 요청마다 `await cookies()`로 만들고 Server Component의 쓰기 제한을 고려한다.
4. `getCurrentUser()`는 `auth.getUser()`로 검증한다. 인증 없음·무효 인증은 비로그인으로,
   통신·서비스 장애는 오류로 구분한다. `getSession()`의 쿠키 사용자 정보를 신뢰하지 않는다.
5. Next.js 15의 `middleware.ts`에서 갱신 어댑터를 조립한다. 갱신 쿠키를 요청·응답에 함께
   반영하고 SDK의 캐시 방지 헤더를 보존한다. 로그인 가드·리다이렉트는 추가하지 않는다.
6. matcher는 login·signup·dashboard·interview·면접 API로 한정해 공개 `/`·정적 자원은 유지한다.
   루트의 로그인 리다이렉트 연결은 #6에서 확장한다.
7. SETUP에 진입점 사용·연결·세션 조회 확인 절차를 남긴다. 실제 `.env.local`을 출력·수정하지 않는다.
8. 인증·요청 격리·갱신 쿠키·캐시 헤더 경계 테스트와 lint·typecheck·build 후 reviewer 검토를 반영한다.

## 건드릴 파일 (경로 / 레이어)

- 패키지·도구: `package.json`, `package-lock.json`, `vitest.config.mjs`
- 설정: `src/config/supabase.ts` (공개 환경변수 검증; SDK 의존 없음)
- 어댑터: `src/lib/supabase/{client,server,session,middleware}.ts`
- 조립: `src/middleware.ts`
- 검증: 설정·어댑터의 `*.test.ts`
- 안내: `docs/SETUP.md`, `README.md`, `AGENTS.md`의 사용·검증 명령
- 계획: `docs/plans/issue-002-supabase-clients.md`

## 외부 의존·어댑터 / 스키마 변경

- Supabase SDK는 `lib/supabase`에서만 사용한다.
- 사용자 접근은 Publishable key와 사용자 쿠키를 사용한다. 관리자 클라이언트는 만들지 않는다.
- DB 스키마·SQL·RLS·생성 타입 변경은 없다. 임시 Database 타입도 만들지 않는다.

## 리스크 · 열린 질문 · 승인 필요 지점

- 최신 문서의 `proxy.ts`는 Next.js 16 방식이다. 이 프로젝트는 `middleware.ts`를 사용한다.
- 서버 클라이언트를 전역 공유하거나 새 응답에서 갱신 쿠키·캐시 헤더를 잃지 않도록 검증한다.
- 로그인 UI가 없어 실제 가입→로그인 검증은 #5에서 진행한다. 원격 연결과 모킹된 세션 검증을 구분한다.
- 커밋·푸시·PR은 사용자 승인 후 진행하고 계획 파일을 첫 커밋으로 분리한다.

## 검증 계획

- 공개 설정 누락·공백·잘못된 URL·Secret key 오입력의 안전한 오류 처리.
- 브라우저/서버 팩토리의 공개 키 사용, 요청 간 클라이언트·쿠키 격리.
- 비로그인·검증된 사용자·잘못된 인증·서비스 장애 구분.
- 갱신 쿠키의 요청·응답 반영, 쿠키 옵션과 캐시 방지 헤더 보존.
- 공개 루트·정적 자원의 matcher 제외와 기본 페이지 유지.
- `npm run test`, `npm run lint`, `npm run typecheck`, `npm run build`, `git diff --check`.
- 가능한 경우 설정된 Supabase Auth의 읽기 전용 연결 확인(값·응답 본문 출력 없음).

## (구현 후) 변경 메모 / 리뷰 반영

- planner 권고에 따라 현재 사용자 조회와 세션 갱신 기반을 포함한다.
- 환경변수 검증은 공통 설정인 `src/config`에 두고 SDK 의존 없이 공유한다.
- reviewer가 Vite 8의 Node 최소 버전을 확인했다. `engines`와 세 문서의 Node 안내를
  `^22.12.0 || >=24.0.0`으로 일치시켰다.
- 공통 인증 오류 분류는 `lib/supabase/errors.ts`에서 공유한다. 인증 오류만 비로그인으로 처리하고
  통신 장애와 요청 제한은 숨기지 않는다.
- 검증 통과: 설정·클라이언트·세션·갱신 경계 29개 테스트, lint, typecheck, build, diff 공백 검사.
- 실제 설정의 Publishable key로 Supabase Auth `/auth/v1/settings` 읽기 전용 연결 HTTP 200을 확인했다.
  키·프로젝트 응답 본문은 출력하지 않았다. 실제 `.env.local`의 변경도 없다.
- 빌드한 앱에서 `/` HTTP 200을 확인했다. `/login`·`/dashboard`는 갱신 middleware를 통과하고
  아직 화면이 없어 예상대로 HTTP 404다. 로그인 가드·UI를 구현한 것으로 간주하지 않는다.
- 실행 의존성 `npm audit --omit=dev` 취약점 0건. 기존 ESLint 계열의 개발 의존성 경고 14건(moderate)은 유지된다.
- reviewer의 Node 호환성 지적 반영 후 재검토 결과 남은 must-fix 없음.
- 실제 로그인·만료 세션 E2E 검증은 로그인 UI가 있는 #5에서 수행한다.
- 구현·검증·리뷰를 마쳤으며 커밋·푸시·PR은 사용자 승인 후 진행한다.
