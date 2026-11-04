# AI 면접 (AI Interview)

자기소개서를 기반으로 AI가 실시간 음성 면접을 진행하는 웹 서비스.

## 개요

사용자가 회사별 자기소개서(회사명·직무·자소서 문항·경험)를 등록하면, AI가 내용을 분석해
맞춤 질문 4개와 꼬리질문(최대 2개/문항)을 생성하고, TTS로 질문 → 음성 답변 녹음 →
STT 전사 흐름으로 면접을 진행한다. MVP는 카메라 표시와 전사 저장을 제공할 예정이며, 영상 저장은 후순위다.

## 기술 스택

- **Next.js 15 (App Router) + TypeScript**
- **Tailwind CSS** + shadcn/ui
- **Supabase** (Auth · Postgres · Storage)
- **LLM (provider 미지정)** — 질문/꼬리질문 생성 (서버 전용). 어댑터로 Claude·OpenAI 등 교체 가능, 구현 단계에서 선택
- **Web Speech API** — TTS/STT (어댑터로 추상화, 교체 가능)
- **MediaRecorder API** — 카메라+마이크 녹화 (후순위)

## 문서

- [PRD](./docs/PRD.md) — 제품 요구사항 (랜딩 페이지 포함)
- [아키텍처](./docs/ARCHITECTURE.md) — 폴더 구조·데이터 모델·면접 상태머신
- [수동 작업 체크리스트](./docs/SETUP.md) — API 키 발급 등 사람이 직접 할 일
- [작업 지침 (정본)](./AGENTS.md) — 에이전트/개발 규칙 (`CLAUDE.md`는 Claude Code용 포인터)
- [명명 규칙](./docs/CONVENTIONS.md) — 이슈/브랜치/커밋/PR 규칙 (AI 자동 적용)
- [백로그](./docs/BACKLOG.md) — 의존성 순서 작업 목록 (이슈 단위)

## 상태

M1 기본 스캐폴딩: 한국어 초기 화면과 개발·빌드·린트 환경을 제공한다.
Supabase의 브라우저·서버 클라이언트와 검증된 사용자 조회·쿠키 세션 갱신 기반을 제공한다.
자소서·면접 DB 마이그레이션, 계정별 RLS와 생성 DB 타입을 제공한다.
인증 UI, 자소서 관리와 면접 기능은 후속 이슈에서 구현한다.

## 개발 환경 설정

Node.js 22.x는 22.12 이상, 또는 24 이상(24 LTS 권장)이 필요하다. PowerShell에서 `npm` 실행이 차단되면 `npm.cmd`를 사용한다.

```bash
# 1) 의존성 설치
npm install

# 2) 환경 변수 (.env.local)
cp .env.local.example .env.local # 기존 파일이 없을 때만 복사
# NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
# SUPABASE_SECRET_KEY (서버 관리자 작업이 필요할 때만)
# LLM_PROVIDER (claude|openai) + 해당 API 키 채우기

# 3) 개발 서버
npm run dev
```

PowerShell에서는 처음 설정할 때 `Copy-Item .env.local.example .env.local`로 복사한다.
기존 `.env.local`은 덮어쓰지 않는다. 기본 앱은 API 키 없이도 실행된다.

http://localhost:3000 에서 초기 화면을 확인할 수 있다.

```bash
npm run lint       # ESLint
npm run typecheck  # TypeScript
npm run test       # 설정·인증·쿠키 경계 테스트 (모킹, 실제 키 불필요)
npm run build      # 프로덕션 빌드
npm run start      # 빌드한 앱 실행
```

## 코드 구조

- `src/app`: 라우팅·레이아웃·화면 조립
- `src/features`: 인증·자소서·면접 도메인 기능
- `src/lib`: Supabase·AI·음성·녹화 어댑터
- `src/components/ui`, `src/types`, `src/config`: 공통 UI·타입·설정
- `supabase/migrations`: DB 스키마·RLS 변경 SQL
- `supabase/tests`: 두 계정·비로그인 DB 격리 검증 SQL

의존 방향은 `app → features → lib`이다. 아직 구현되지 않은 영역은 디렉터리만 준비되어 있다.
Supabase 설정·클라이언트·세션 갱신 사용법은 [SETUP §B.1](./docs/SETUP.md#b1-supabase-연결과-세션-조회-확인)을 참고한다.
DB 적용·격리 검증·타입 생성은 [SETUP §B.2](./docs/SETUP.md#b2-db-마이그레이션rls생성-타입)를 참고한다.
본문 폰트는 [Pretendard](https://github.com/orioncactus/pretendard) v1.3.9를 로컬에서 제공하며,
배포 라이선스는 [OFL.txt](./src/assets/fonts/OFL.txt)에 포함되어 있다.
