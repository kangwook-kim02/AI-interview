# 수동 작업 체크리스트 (사용자가 직접 해야 하는 것)

코드 작업과 별개로 **사람이 직접** 해야 하는 일들. API 키 발급·외부 서비스 가입 포함.
완료하면 체크박스를 채우고, 발급받은 값은 `.env.local`에 넣는다(이 파일에 키 자체는 적지 말 것).

> ⚠️ **모든 비밀 키는 `.env.local`에만.** 커밋 금지(`.gitignore`에 이미 포함). 공개 저장소/채팅/스크린샷에 노출 금지.

---

## A. 저장소 / 배포 계정

- [x] GitHub 저장소 생성 및 연동 완료 — `kangwook-kim02/AI-interview`
- [ ] (배포 시점) **Vercel** 계정 생성 → GitHub 저장소 연결
  - https://vercel.com → GitHub로 로그인 → Import Project
  - 환경변수는 Vercel 프로젝트 Settings → Environment Variables 에 동일하게 등록
- [ ] (선택) 커스텀 도메인 준비
- [ ] **GitHub CLI(`gh`) 설치** — 이슈/PR 자동 생성(issue-create·issue-work 스킬)에 필요
  - Windows: `winget install --id GitHub.cli` 또는 https://cli.github.com
  - 설치 후 `gh auth login` 으로 로그인 (GitHub 계정 연결)
  - 미설치 시에도 스킬은 이슈/PR 본문을 출력해 수동 복붙 가능(폴백)

---

## B. Supabase (Auth · DB · Storage)

- [ ] **Supabase 계정 생성** → https://supabase.com (GitHub 로그인 가능)
- [ ] **새 프로젝트 생성** (Organization → New project)
  - Region: 사용자 위치 가까운 곳(예: `Northeast Asia (Seoul)`) 권장
  - Database Password 설정 → **안전하게 보관**(복구용)
- [ ] 프로젝트의 **Connect**에서 `Project URL` 확인 → `.env.local`의 `NEXT_PUBLIC_SUPABASE_URL`
- [ ] **Settings → API Keys → Publishable and secret API keys**에서 키 확인:
  - [ ] `Publishable key` (`sb_publishable_...`) → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  - [ ] (관리자 작업이 필요할 때만) `Secret key` (`sb_secret_...`) → `SUPABASE_SECRET_KEY` **(서버 전용! 절대 클라 노출 금지)**
  - 일반 로그인·사용자 데이터 접근에는 Publishable key와 사용자 세션을 사용한다. Secret key는 RLS를 우회한다.
  - 예전 가이드의 `anon public`·`service_role`은 레거시 키다. 새 키를 사용한다.
  - 참고: [Supabase API 키 안내](https://supabase.com/docs/guides/getting-started/api-keys)
- [ ] **Authentication → Providers → Email** 활성화 (이메일+비밀번호 로그인)
  - [ ] (개발 편의) Email 확인 메일 요구를 끄거나, 테스트 메일 설정
  - [ ] (후순위) Google 소셜 로그인 쓸 경우 Google OAuth 클라이언트 발급 후 등록
- [ ] (Supabase 연동과 DB 마이그레이션은 후속 이슈에서 코드로 적용 — `supabase/migrations/`. 지금은 URL과 Publishable key를 준비하면 됨)

> Supabase 무료 티어로 MVP 충분. 규모 커져도 표준 Postgres라 이전 용이.

---

## C. LLM API 키 (provider 미지정 — 하나 선택)

코드는 provider 중립이다. **아래 중 하나를 골라** 키를 발급하고, `.env.local`의
`LLM_PROVIDER`에 provider 이름을, 해당 키 변수에 키를 넣는다.

### 옵션 1) Claude (Anthropic)
- [ ] https://console.anthropic.com 가입
- [ ] **결제 수단 등록 + 크레딧 충전** (API는 선불/종량제, 무료 크레딧 소진 후 과금)
- [ ] **API Keys → Create Key** → 키 복사 → `.env.local`의 `ANTHROPIC_API_KEY`
- [ ] `.env.local`에 `LLM_PROVIDER=claude`
- [ ] (선택) 사용량 한도(spend limit) 설정으로 비용 상한 걸기

### 옵션 2) OpenAI (GPT)
- [ ] https://platform.openai.com 가입
- [ ] **결제 수단 등록 + 사용량 한도 설정** (Billing → Limits)
- [ ] **API Keys → Create new secret key** → 키 복사 → `.env.local`의 `OPENAI_API_KEY`
- [ ] `.env.local`에 `LLM_PROVIDER=openai`

> 둘 다 발급해 두고 `LLM_PROVIDER`만 바꿔가며 비교해도 됨. 비용 상한(spend/usage limit)은 **반드시** 걸어두길 권장.

---

## D. 음성 (TTS/STT) — MVP는 발급 불필요

- [x] MVP는 **브라우저 Web Speech API** 사용 → 별도 키/계정 **불필요, 무료**
- [ ] (후순위) 고품질 음성으로 교체 시(OpenAI TTS/Whisper 등) 해당 키 발급
- [ ] 테스트는 **Chrome 데스크톱** 권장(Web Speech 지원 안정적). 마이크/카메라 권한 허용 필요

---

## E. 로컬 개발 환경

- [ ] **Node.js 22 이상** 설치 (24 LTS 권장) — https://nodejs.org
- [ ] 저장소 클론 후 `.env.local.example` 복사 → `.env.local` 작성 (위 A~C 값 입력, 기존 파일이 있으면 유지)
  - PowerShell: `Copy-Item .env.local.example .env.local` (처음 설정할 때만)
- [ ] `npm install` → `npm run dev`
  - PowerShell 실행 정책으로 `npm`이 차단되면 `npm.cmd`를 사용한다.
  - http://localhost:3000 에서 기본 화면을 확인한다. 스캐폴딩 단계는 API 키 없이 실행할 수 있다.
- [ ] `npm run lint` / `npm run typecheck` / `npm run build`로 개발 설정 확인
- [ ] (면접 기능 구현 이후) 브라우저에서 카메라/마이크 권한 허용하고 면접 플로우 확인

---

## F. Codex에서도 작업할 경우 (선택)

이 저장소는 Claude Code와 Codex **둘 다** 지원하도록 스킬/에이전트가 준비돼 있다.

- [ ] Codex CLI 설치 + 로그인
- [ ] **프로젝트를 "trusted"로 설정** — 그래야 `.codex/` 프로젝트 레이어(서브에이전트)가 로드됨
  - `~/.codex/config.toml`에 `projects.<repo-경로>.trust_level = "trusted"` 추가, 또는 최초 신뢰 프롬프트 승인
  - 스킬(`.agents/skills/`)은 trust 없이도 자동 로드됨
- 구조: 스킬 `.agents/skills/<name>/SKILL.md`, 서브에이전트 `.codex/agents/<name>.toml`, 지침 `AGENTS.md`(자동 로드). 상세는 `AGENTS.md` §10.

---

## 요약: 지금 당장 준비하면 좋은 것

1. **Supabase 프로젝트 만들고 URL·Publishable key 확보** (B, Secret key는 관리자 작업 시에만)
2. **LLM 하나 골라 키 발급 + 비용 상한 설정** (C)
3. Node.js 설치 (E)

→ 기본 앱은 API 키 없이 실행할 수 있다. 인증·DB·질문 생성은 각 후속 이슈 구현 후 위 설정으로 확인한다.
