# Plan — Issue #6: [디자인] 공개 랜딩에서 서비스 소개와 가입 동선을 제공한다

- 이슈: #6
- 브랜치: design/6-landing-page
- 상태: planning
- 작성일: 2026-11-05

## 목표

비로그인 사용자가 루트(`/`)에서 **히어로 + 핵심 기능 소개 + 작동 방식(3~4스텝)**을 보고,
상단 로그인 링크와 시작 CTA로 각각 `/login`·`/signup`으로 이동할 수 있다.
로그인 사용자가 `/`에 오면 서버에서 `/dashboard`로 리다이렉트된다.
frontend-design 시스템(따뜻·친근·라이트·단순함, 코랄 CTA)을 지키고, 데스크톱 우선에
모바일에서 안 깨지며, 영상 저장은 제공 기능처럼 안내하지 않는다. (FR-LAND-1~7 충족)

## 단계별 계획

1. **리다이렉트 가드** — `src/app/page.tsx` 서버 컴포넌트 최상단에서 `getCurrentUser()` →
   유저 있으면 `redirect(AUTH_REDIRECT_PATH)`. dashboard/layout.tsx 기존 패턴 재사용.
   middleware는 건드리지 않음(§리스크 참조).
2. **config 상수 신설** — `src/config/auth.ts`에 `SIGNUP_PATH = "/signup"` 추가(하드코딩 방지).
3. **상단 헤더(네비)** — 좌: 워드마크 "AI 면접"(디스플레이 폰트), 우: "로그인" 텍스트 링크(`/login`) +
   "시작하기" 코랄 pill CTA(`/signup`). 항목 2개로 제한.
4. **히어로 섹션** — `features/landing/components/Hero.tsx`. 캐치프레이즈(h1) + 부가 설명(muted) +
   코랄 CTA(`/signup`). 따뜻한 배경, 여백 넉넉히. 가벼운 인라인 장식(SVG) 선택.
5. **핵심 기능 소개** — `features/landing/components/Features.tsx`. 4개(자소서 기반 맞춤 질문 /
   실시간 음성 면접 / 꼬리질문 / 진행 상황 표시). 동일 "아이콘+제목+설명 3그리드 반복" slop 회피.
6. **작동 방식** — `features/landing/components/HowItWorks.tsx`. 4스텝(자소서 등록 → AI 질문 생성 →
   음성 면접 → 진행 확인). 부드러운 번호 스텝/타임라인. `MAIN_QUESTION_COUNT` 활용 가능.
7. **조립** — `src/app/page.tsx`에서 가드 + 헤더 + 섹션 배치, 페이지 `metadata` 지정. 서버 컴포넌트 유지.
8. **반응형·접근성 점검** — 모바일(≤375px) 안 깨짐, 시맨틱 마크업(header/main/section), h1 단일, 링크 대비 AA.
9. **검증** — `npm run lint` / `typecheck` / `build` + 수동 확인(§검증 계획).

## 건드릴 파일 (경로 / 레이어)

**수정**
- `src/app/page.tsx` (app) — 리다이렉트 가드 + 헤더/섹션 조립 + metadata. 서버 컴포넌트 유지.
- `src/config/auth.ts` (config) — `SIGNUP_PATH` 추가.

**신규 (features/landing — 프레젠테이션 응집)**
- `src/features/landing/components/LandingHeader.tsx`
- `src/features/landing/components/Hero.tsx`
- `src/features/landing/components/Features.tsx`
- `src/features/landing/components/HowItWorks.tsx`

> **레이어 근거:** ARCHITECTURE §3 — `features/`는 도메인별 UI 응집. 랜딩 섹션은 로직 없는 순수
> 프레젠테이션이라 hook/action 없이 components만 둔다. 다른 feature를 import하지 않아 "features끼리
> 직접 참조 금지" 위반 없음. app은 조립만.

## 외부 의존·어댑터 / 스키마 변경

- **세션 조회**: `getCurrentUser()`(`lib/supabase/session.ts`, 서버 전용) — 리다이렉트 가드에만 사용. 신규 포트 불필요.
- LLM/TTS/STT/Storage/DB: 전부 불필요(정적 소개 페이지). 음성·질문 생성은 "소개 문구"로만 언급.
- **DB/마이그레이션 변경 없음.**

## 리스크 · 열린 질문 · 승인 필요 지점

- **미들웨어 미커버**: `middleware.ts` matcher에 `/`가 없음 → 로그인 사용자 `/`→`/dashboard`는 서버
  컴포넌트 가드로만 처리. 이슈 충족에 충분(dashboard와 동일 패턴). matcher에 `/` 추가 시 모든 공개
  방문자에 미들웨어 비용↑ + 가드 이원화 → **추가 안 함**, 서버 가드로 일원화.
- **디자인 slop 회피**: 동일 3그리드 반복·조밀 캐러셀·8개 아이콘·NEW 배지·3D 히어로 금지.
- **영상 저장 오안내 금지**: "녹화 영상 저장/다시보기" 류 문구 금지. "실시간 음성 면접 / 진행 상황"까지만.
- **접근성**: CTA는 실제 `<Link>`로 라우팅, h1 단일, 포커스 링은 globals `:focus-visible`가 커버, 코랄 위 흰 글자 AA OK.
- **서버/클라 경계**: page.tsx 서버 컴포넌트(가드). 랜딩 섹션에 상호작용 상태 없어 `'use client'` 불필요.
- **결정(기본값으로 진행)**: 섹션은 features/landing 분리 / 히어로는 1차 타이포+가벼운 장식 중심 /
  카피는 기존 page.tsx 톤을 따뜻·격려 톤으로 다듬음.

**범위 밖 (별도 이슈 제안 가능)**
- middleware의 기존 `"/signup"`/`"/login"` 리터럴을 config 상수로 일괄 치환하는 리팩터.
- FAQ/문의/정책, 결제/소셜 로그인.

## 검증 계획

- `npm run lint` / `npm run typecheck` / `npm run build` 통과(Windows 차단 시 `npm.cmd`).
- 수동 확인:
  - 비로그인 `/` → 히어로·핵심기능·작동방식 노출.
  - "로그인" → `/login`, "시작하기"/히어로 CTA → `/signup` 실제 이동.
  - 로그인 상태 `/` 접근 → `/dashboard` 리다이렉트.
  - 데스크톱(1440) 정상 + 모바일(375px) 안 깨짐.
  - 영상 저장/다시보기 안내 없음.
  - 키보드 Tab 포커스 링, h1 단일 계층.

## (구현 후) 변경 메모 / 리뷰 반영

<!-- 구현·리뷰 중 계획과 달라진 점을 여기에 덧붙인다 -->
