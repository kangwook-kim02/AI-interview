# Plan — Issue #5: [인증] 이메일 가입과 로그인 및 보호 라우트를 제공한다

- 이슈: #5
- 브랜치: `feat/5-email-auth`
- 상태: 구현중
- 작성일: 2026-11-05

## 목표

이 작업이 끝나면:
- 사용자가 이메일/비밀번호로 **회원가입 / 로그인 / 로그아웃**을 할 수 있다.
- 잘못된 입력·중복 가입·인증 실패가 **이해 가능한 한국어 메시지**로 안내된다.
- 비로그인 상태에서 `/dashboard`·`/interview`(자소서·면접 준비·진행·결과 포함) 경로에 직접 접근하면 **로그인 화면으로 리다이렉트**된다.
- 보호 경로에서 **세션이 유지**되고 로그아웃 후에는 **차단**된다.
- 공통 서버 인증 확인(`getCurrentUser`)을 후속 기능에서 재사용할 수 있고, **UI 번들에 비밀 키가 없다**(Publishable key + 세션만 사용).

범위 밖(별도 이슈로): Google OAuth, 자소서·면접 데이터 처리, 비밀번호 재설정.

## 단계별 계획 (의미 단위 = 커밋 단위)

1. **플랜 커밋**: `docs/plans/issue-005-auth.md` 추가 (브랜치 첫 커밋).
2. **인증 도메인 로직 (features, UI 없음)**: Zod 폼 스키마 + Supabase `AuthError` → 한국어 메시지 매핑 + 가입/로그인/로그아웃 서버 액션. 각각 단위 테스트 동반.
3. **인증 UI 조립**: `(auth)/login`, `(auth)/signup` 페이지 + `features/auth/components`의 폼 컴포넌트. frontend-design 스킬 준수(중앙 단순 카드 폼).
4. **보호 경로 가드**: `middleware.ts`에 리다이렉트 로직 추가(기존 `updateSupabaseSession` 재사용) + `dashboard` 서버 레이아웃 가드. middleware 판단 함수 단위 테스트.
5. **마무리**: `npm run lint/typecheck/test` 통과 확인.

## 건드릴 파일 (경로 / 레이어)

### 생성 — features (도메인 로직)
- `src/features/auth/schema.ts` — **features**. Zod 스키마(`signupSchema`, `loginSchema`): 이메일 형식, 비밀번호 최소 길이, 한국어 `message`. 서버 액션·클라 폼 공유.
- `src/features/auth/messages.ts` — **features**. `authErrorToMessage(error): string`. Supabase `AuthError`(code/status) → 사용자용 한국어 문자열 매핑. 미매핑은 일반 메시지 폴백.
- `src/features/auth/actions.ts` — **features**. `'use server'`. `signUp`, `signIn`, `signOut` 서버 액션. `lib/supabase/server`만 사용(supabase-js 직접 import 금지). 반환은 `{ error: string } | { message: string }`(성공 시 `redirect`).
- `src/features/auth/messages.test.ts` — 에러 매핑 단위 테스트.
- `src/features/auth/actions.test.ts` — 서버 액션 로직 테스트(`createServerSupabaseClient`·`redirect` 모킹, 외부 호출 없음).

### 생성 — features (UI 컴포넌트)
- `src/features/auth/components/AuthForm.tsx` — **features**. `'use client'`. 이메일/비밀번호 입력 + 제출 + 에러/안내 표시 공용 폼. `useActionState`(React 19)로 서버 액션 연결, pending 처리. 모드(`login`/`signup`) prop으로 재사용.

### 생성 — app (라우팅/조립만)
- `src/app/(auth)/layout.tsx` — **app**. (auth) 그룹 공통 중앙 정렬 레이아웃(따뜻한 배경, 중앙 카드).
- `src/app/(auth)/login/page.tsx` — **app**. `AuthForm mode="login"` 조립 + 회원가입 링크.
- `src/app/(auth)/signup/page.tsx` — **app**. `AuthForm mode="signup"` + 로그인 링크.
- `src/app/dashboard/layout.tsx` — **app**. 서버 컴포넌트. `getCurrentUser()` → null이면 `redirect('/login')`. 공통 셸(로그아웃 버튼 포함) + `children`.
- `src/app/dashboard/page.tsx` — **app**. 보호 경로 접근 확인용 최소 플레이스홀더(대시보드 본 구현은 범위 밖).

### 수정
- `src/middleware.ts` — **app(엣지)**. `updateSupabaseSession` 호출 뒤, 보호 경로 미인증 리다이렉트 판단 추가.
- `src/lib/supabase/middleware.ts` — **lib**. `{ response, isAuthenticated }` 반환으로 확장(현재는 `response`만). `getClaims()` 결과로 로그인 여부 전달.

### 생성 — 테스트
- `src/middleware.test.ts` — 보호 경로 판단 순수 함수(`resolveAuthRedirect`) 테스트: 보호+미인증→리다이렉트, 보호+인증→통과, 공개→통과.

## 인증 플로우 설계

### 회원가입 (`signUp` 서버 액션)
- `signupSchema.safeParse` 실패 → 한국어 메시지 반환(리다이렉트 X).
- `supabase.auth.signUp({ email, password })`.
- 에러 → `authErrorToMessage`.
- 성공 분기: `data.session` 존재(확인 불필요) → `redirect('/dashboard')` / `session` null(확인 필요) → "확인 메일을 보냈어요" 안내 반환. 기존 가입 이메일(`data.user?.identities?.length === 0`) → 중복 안내.

### 로그인 (`signIn` 서버 액션)
- `loginSchema.safeParse` → `supabase.auth.signInWithPassword`.
- 성공: `revalidatePath('/', 'layout')` 후 `redirect('/dashboard')`.
- 실패: `authErrorToMessage`.

### 로그아웃 (`signOut` 서버 액션)
- 대시보드 레이아웃의 `<form action={signOut}>` 버튼 → `supabase.auth.signOut()` → `redirect('/login')`.

**쿠키**: 서버 액션 내 `createServerSupabaseClient()`가 `cookies()` 기반 → `Set-Cookie` 자동. 상태 변경은 전부 서버 액션 경유.

### middleware 보호 경로 리다이렉트
- `updateSupabaseSession(request)` → `{ response, isAuthenticated }`(세션 쿠키 갱신 유지).
- 순수 함수 `resolveAuthRedirect(pathname, isAuthenticated)`가 리다이렉트 대상 경로 or null 반환.
- 보호 경로(`/dashboard`, `/interview`, `/api/interview`) + 미인증 → `/login`으로 리다이렉트하되 **갱신 쿠키를 리다이렉트 응답에 복사**(세션 쿠키 유실 방지). 공개 경로(`/login`,`/signup`)는 통과.

## 한국어 에러 메시지 매핑 전략

- 위치: `src/features/auth/messages.ts` (features 레이어).
- Supabase v2 `AuthError`의 **`code`** 우선 매핑(`invalid_credentials`, `user_already_exists`/`email_exists`, `weak_password`, rate limit류). `code` 없으면 `status` 폴백. 미매핑은 일반 메시지.
- 입력 형식 오류(이메일/길이)는 **Zod 스키마 한국어 `message`**로 네트워크 호출 전 차단.

## 보호 경로 가드 — 이중화

- **middleware (1차, 엣지)**: 비로그인 보호 경로 접근 시 즉시 `/login` 리다이렉트(렌더 전 차단). `getClaims()` JWT 검증 기반이라 가벼움.
- **서버 레이아웃 가드 (2차, 확정)**: `dashboard/layout.tsx`에서 `getCurrentUser()`(Auth 서버 재검증) null이면 `redirect('/login')`. middleware만 믿지 않음.
- **후속 데이터 처리 재사용**: 서버 액션/route handler가 동일 `getCurrentUser()` 사용 — 신규 작성 불필요.

## 외부 의존·어댑터 / 스키마 변경

- Supabase Auth만. 전부 기존 `lib/supabase` 어댑터 뒤로 접근. features/app에서 `@supabase/*` 직접 import 없음.
- `updateSupabaseSession` 반환 시그니처 1곳 확장 외 새 포트 불필요.
- 비밀 키 없음(Publishable + 세션만). 스키마/마이그레이션 변경 없음. 신규 패키지 없음(React 19 `useActionState`).

## 리스크 · 열린 질문 · 승인 필요 지점

1. **`updateSupabaseSession` 반환 확장**: 호출부(`middleware.ts`) 동시 수정. → 채택(어댑터가 라우팅 정책 모르게 유지).
2. **이메일 확인 토글 상태 불명**: 코드로 양쪽(`data.session` 유무) 대응. 수동 e2e는 확인 off가 편함 → `docs/SETUP.md`에 이미 "개발 편의로 확인 끄기" 명시됨.
3. **로그인 상태 `/login` 접근 → `/dashboard` 리다이렉트**: 완료조건 밖 → **제외**(범위 최소화).
4. **interview 레이아웃 가드**: interview 하위 페이지 미존재 → middleware가 `/interview/:path*` 보호를 커버. 레이아웃 가드는 페이지 생기는 이슈에서 추가. 완료조건 충족(미인증 접근 차단).

## 검증 계획

- `npm run lint` / `npm run typecheck` 무경고.
- `npm run test` (node, 외부 호출 없음):
  - 에러 매핑: 주요 `AuthError` code → 한국어 문자열, 미매핑 폴백.
  - 서버 액션: Zod 실패 시 메시지 반환·네트워크 호출 안 함 / 성공 시 `redirect` / 에러 시 매핑 메시지 / 가입 세션 유무 분기.
  - 보호 경로 판단 함수: 보호+미인증→`/login`, 보호+인증→통과, 공개→통과.
- 수동 확인(dev): 미인증 `/dashboard`→`/login`, 가입/로그인 후 세션 유지·새로고침 유지, 로그아웃 후 재접근 차단, 잘못된 입력·중복·빈 입력 한국어 메시지.

## (구현 후) 변경 메모 / 리뷰 반영

<!-- 구현 중 계획과 달라진 점, 리뷰 반영 내역을 여기에 덧붙인다. -->
