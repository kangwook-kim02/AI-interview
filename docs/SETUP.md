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
- [ ] (DB 마이그레이션·RLS는 #3에서 적용 — `supabase/migrations/`. 이번 클라이언트 연결에는 URL과 Publishable key만 필요)

> Supabase 무료 티어로 MVP 충분. 규모 커져도 표준 Postgres라 이전 용이.

### B.1 Supabase 연결과 세션 조회 확인

1. `.env.local`에 `NEXT_PUBLIC_SUPABASE_URL`과 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`를 입력하고
   개발 서버를 다시 시작한다. Publishable key는 `sb_publishable_...` 형식이다.
   예제 파일은 빈 값으로 유지하며 실제 설정 파일을 Git에 추가하지 않는다.
2. 클라이언트 생성 시 공개 설정을 검증한다. 누락·빈 값·HTTP(S)가 아닌 URL·Secret key 오입력은
   변수명과 이 문서 위치로 안내하고 실제 값은 오류 메시지에 포함하지 않는다.
   Secret key는 이번 클라이언트에서 읽지 않으므로 비워둬도 된다.
3. feature의 Client Component에서는 `@/lib/supabase/client`의 `createBrowserSupabaseClient()`를,
   서버 처리에서는 `@/lib/supabase/server`의 `await createServerSupabaseClient()`를 사용한다.
   SDK를 상위 코드에서 직접 생성하거나 서버 클라이언트를 전역 공유하지 않는다.
4. 서버에서 현재 사용자를 확인하려면 다음 진입점을 사용한다.

   ```ts
   import { getCurrentUser } from "@/lib/supabase/session";

   const user = await getCurrentUser();
   // 검증된 User 또는 null. 토큰·쿠키·키 전체를 로그에 남기지 않는다.
   ```

   로그인 쿠키가 없거나 인증이 거부되면 `null`이다. 정상 로그인 쿠키가 있으면 Auth 서버에서
   확인한 사용자를 반환한다. 네트워크·서비스 장애·요청 제한은 오류로 전달하므로 비로그인과 구분한다.
   서버 인증 판단에 검증하지 않은 `getSession()`의 사용자 객체를 사용하지 않는다.
5. 세션 갱신은 Next.js 15의 `src/middleware.ts`에서 처리한다. `/login`, `/signup`,
   `/dashboard/**`, `/interview/**`, `/api/interview/**`에 적용하며 로그인 가드·리다이렉트는 아직 없다.
   새 인증 경로를 추가하면 matcher도 확장한다. `/`와 정적 자원은 제외하므로 기본 화면은 키 없이 실행된다.
   갱신 쿠키를 요청과 응답에 반영하고 SDK의 캐시 방지 헤더를 유지한다.
   이 응답을 교체할 때 쿠키와 캐시 헤더를 복사해야 하며 사용자별 응답을 공유 캐시에 저장하지 않는다.
6. `npm run test`로 설정·요청 쿠키 격리·사용자 검증·갱신 헤더를 외부 요청 없이 확인한다.
   `npm run lint`, `npm run typecheck`, `npm run build`도 실행한다.
   실제 로그인 전후·세션 만료 후 재접속 검증은 로그인 기능을 구현하는 #5에서 수행한다.

이 단계에는 로그인 화면이나 공개 진단 API를 추가하지 않는다. 클라이언트 생성만으로 원격 접속 성공을
확인한 것은 아니다. 실제 연결은 Auth 서버의 읽기 전용 응답으로, 로그인은 검증된 사용자 조회로 각각 확인한다.

원격 연결만 별도로 확인하려면 프로젝트 루트에서 아래 명령을 실행한다(PowerShell·bash 공통).
`.env.local`의 공개 설정만 사용하며 키나 응답 본문 대신 HTTP 상태만 출력한다. HTTP 200이면 연결 성공이다.
이 확인은 로그인·DB·RLS 검증을 대신하지 않는다.

```bash
node --env-file=.env.local --input-type=module -e "const r = await fetch(new URL('/auth/v1/settings', process.env.NEXT_PUBLIC_SUPABASE_URL), { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY }, signal: AbortSignal.timeout(10000) }); console.log('Supabase Auth HTTP ' + r.status); if (!r.ok) process.exitCode = 1;"
```

참고: [Supabase SSR 설정](https://supabase.com/docs/guides/auth/server-side/creating-a-client).

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

- [ ] **Node.js 22.x는 22.12 이상, 또는 24 이상** 설치 (24 LTS 권장) — https://nodejs.org
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
