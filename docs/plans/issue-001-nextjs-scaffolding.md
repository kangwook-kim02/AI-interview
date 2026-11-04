# Plan — Issue #1: Next.js 프로젝트와 기본 개발 환경을 초기화한다

- 이슈: #1
- 브랜치: `chore/1-nextjs-scaffolding`
- 상태: 구현중
- 작성일: 2026-11-04

## 목표

Next.js 15·TypeScript·App Router·Tailwind 앱을 로컬에서 실행하고 빌드·린트할 수 있게 한다.
후속 기능을 위한 레이어 디렉터리와 `@/*` 별칭, 면접 공통 상수, 환경변수 예시를 준비한다.
Supabase 연결, 도메인 기능, 인증·랜딩 완성, 디자인 시스템 완성, 배포는 범위 밖이다.

## 단계별 계획

1. Next.js 15.5.29와 호환 React, TypeScript strict, Tailwind 3.4.19, ESLint를 구성한다.
   `dev`, `build`, `start`, `lint`, `typecheck` 스크립트와 lockfile을 준비한다.
2. 루트 레이아웃·한국어 메타데이터·`lang="ko"`와 최소 초기 페이지를 구성한다.
   디자인 스킬의 배경·본문색 및 Pretendard 본문 폰트만 적용한다.
   폰트는 공식 배포본과 라이선스를 포함해 `next/font/local`로 제공한다.
   전체 토큰·제목 폰트·shadcn 및 본격적인 랜딩은 #4·#6에 남긴다.
3. `features/{auth,cover-letter,interview}`, `lib/{supabase,ai,speech,recording}`,
   `components/ui`, `types`, `public`, `supabase/migrations`를 준비한다.
   비어 있는 디렉터리에 `.gitkeep`을 두고 동작하지 않는 액션·API·DB 타입은 만들지 않는다.
4. `src/config/interview.ts`에 메인 질문 4개, 꼬리질문 최대 2개, `ko-KR`,
   TTS 안전 타임아웃과 아키텍처의 녹화 MIME 상수를 정의한다.
5. 기존 `.env.local.example`을 포함하고 새 Supabase 변수명으로 안내를 일치시킨다.
   실제 `.env.local`은 읽거나 변경하지 않는다.
6. 설치·린트·타입 검사·빌드와 개발 서버를 검증하고 reviewer의 필수 지적을 반영한다.

## 건드릴 파일 (경로 / 레이어)

- 도구: `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`,
  `eslint.config.mjs`, `tailwind.config.ts`, `postcss.config.mjs`, `.gitignore`
- app: `src/app/{layout.tsx,page.tsx,globals.css}`
- 공통: `src/config/interview.ts`, `src/assets/fonts` 및 기반 디렉터리의 `.gitkeep`
- 환경 예시: `.env.local.example`
- 안내: `README.md`, `AGENTS.md`, `docs/SETUP.md`, `docs/ARCHITECTURE.md`
- 계획: `docs/plans/issue-001-nextjs-scaffolding.md`

`next-env.d.ts`는 Next.js가 생성하며 저장소에서 제외한다.

## 외부 의존·어댑터 / 스키마 변경

- 웹 앱 개발에 필요한 프레임워크·도구와 로컬 폰트만 추가한다.
- Supabase·LLM·Web Speech·Storage는 어댑터 디렉터리만 준비한다.
- 서비스 SDK·네트워크 호출·DB 스키마 변경은 없다.

## 리스크 · 열린 질문 · 승인 필요 지점

- 최신 생성기는 다른 주 버전을 만들 수 있으므로 Next.js 15에 맞는 최소 구성을 직접 작성한다.
- 기존 문서와 이전 대화에서 만든 환경 예시를 보존한다.
- Secret key는 서버의 관리자 작업용이며 일반 인증·데이터 접근의 필수 키로 설명하지 않는다.
- 패키지와 공식 폰트 다운로드에는 네트워크 권한이 필요할 수 있다.
- AGENTS.md §9에 따라 구현·검증·리뷰 후 커밋·푸시·PR 진행 승인을 받는다.
  승인 후 계획 파일만 첫 커밋에 선택적으로 포함하고 나머지 구현을 다음 커밋으로 남긴다.

## 검증 계획

- `npm install`, `npm run lint`, `npm run typecheck`, `npm run build` 성공.
- 개발 서버 루트 HTTP 200, 한국어 화면·Tailwind·로컬 폰트 적용 확인.
- 데스크톱·작은 화면에서 가로 넘침과 잘림 확인.
- `git check-ignore .env.local`, 예제 파일의 빈 값, 변경 파일 목록 확인.
- `git diff --check` 통과.
- 설정 중심 변경이므로 구현을 그대로 반복하는 단위 테스트는 추가하지 않는다.

## (구현 후) 변경 메모 / 리뷰 반영

- planner가 반환한 계획에 초기 화면의 디자인 스킬 준수를 위한 로컬 Pretendard 배포본을 추가했다.
- Next.js 내부 PostCSS 8.4.31의 취약점 경고를 확인해 루트 PostCSS 8.5.32를
  Next.js에도 적용하는 동일 주 버전 override를 추가했다. 새 lockfile로 `npm ci`를 검증했다.
- 보조 글자색은 작은 본문의 대비를 확보하도록 같은 따뜻한 계열의 `#756a61`을 사용했다.
- 검증 통과: `npm run lint`, `npm run typecheck`, `npm run build`, `git diff --check`.
- 개발 서버 HTTP 검증 통과: 루트 200·한국어 HTML·Tailwind CSS 200·로컬 WOFF2 200.
- `.env.local`·`.env.production`·`.env.test.local` 제외 및 `.env.local.example` 추적 가능 여부를 확인했다.
- `npm audit --omit=dev`: 취약점 0건. 전체 감사에는 ESLint 계열의 minimatch 관련
  개발 의존성 경고 14건(moderate)이 남아 있다. 강제 주 버전 변경은 적용하지 않았다.
- reviewer 결과: must-fix 및 추가 개선 지적 없음.
- 실제 데스크톱·모바일 화면 검사는 연결 가능한 브라우저가 없어 미실행했다.
  HTTP·스타일·폰트 응답 검증을 실제 브라우저 레이아웃 검증으로 간주하지 않는다.
- 구현·검증·리뷰를 마쳤으며 커밋·푸시·PR은 사용자 승인 후 진행한다.
