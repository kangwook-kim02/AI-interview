# AGENTS.md — AI 면접 프로젝트 작업 지침 (정본)

이 파일은 이 저장소에서 작업하는 모든 AI 에이전트(Claude Code · Codex 등)와 사람을 위한 **지침 정본**이다.
**코드를 쓰기 전에 이 문서와 `docs/ARCHITECTURE.md`를 먼저 읽는다.**

> Claude Code는 `CLAUDE.md`(이 문서를 가리키는 포인터)를, Codex는 이 `AGENTS.md`를 자동으로 읽는다.
> 규칙은 **여기 한 곳**에서만 관리한다.

---

## 0. 프로젝트 한 줄 요약
자기소개서를 기반으로 AI가 실시간 음성 면접(질문 TTS → 음성 답변 → 꼬리질문)을 진행하는 웹 서비스.
상세: [docs/PRD.md](./docs/PRD.md), [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).
현재 상태: **M0 문서 확정 완료, 아직 코드 스캐폴딩 전.**

## 1. 기술 스택 (확정)
- **Next.js 15 (App Router) + TypeScript**
- **Tailwind CSS** + shadcn/ui
- **Supabase** (Auth · Postgres · Storage)
- **LLM: provider 미지정** — `QuestionGenerator` 어댑터 뒤에 숨김. `LLM_PROVIDER` 환경변수로 선택(claude/openai/…)
- **Web Speech API** (TTS/STT) — 어댑터로 추상화
- **MediaRecorder** (면접 중 카메라 표시, MVP에서 영상 저장 안 함 — 후순위)
- 상태: 서버 상태는 서버 컴포넌트, 면접 세션은 Zustand, 폼/IO 검증은 Zod

## 2. 반드시 지킬 아키텍처 규칙 (기술부채 방지)
1. **단방향 레이어**: `app → features → lib → 외부서비스`.
   - `app/`은 라우팅/조립만. 비즈니스 로직 금지.
   - `features/`끼리 직접 참조 금지. 공유물은 `lib`/`types`/`config`로 승격.
   - `lib/`은 상위 레이어(app, features) import 금지.
2. **외부 의존은 전부 어댑터 뒤로 숨긴다.** 컴포넌트/페이지는 구현체를 직접 import 하지 않는다.
   - LLM → `lib/ai/` (`getQuestionGenerator()` 팩토리로만 접근, 특정 provider 직접 import 금지)
   - TTS/STT → `lib/speech/` (`TTSPort`/`STTPort`)
   - 녹화 → `lib/recording/`
   - Supabase/DB → `lib/supabase/`
3. **LLM provider에 코드 종속 금지.** Claude·OpenAI 등 교체해도 상위 코드 불변.
4. **상수 하드코딩 금지** → `src/config/` (예: `MAIN_QUESTION_COUNT=4`, `MAX_FOLLOW_UPS=2`, `SPEECH_LANG='ko-KR'`).
5. **면접 플로우는 명시적 상태머신** (`features/interview/machine.ts`). 꼬리질문 상한은 상태머신에서 하드 캡.
6. **스키마 변경은 `supabase/migrations/`에 SQL로** 버전 관리.

## 3. 서버/클라이언트 & 보안 경계
- **비밀 키(SUPABASE_SERVICE_ROLE_KEY, 각 LLM API 키)는 서버 전용.** 절대 클라 번들/`NEXT_PUBLIC_*`에 넣지 않는다.
- **LLM 호출은 항상 서버(API 라우트/서버 액션) 경유.** 브라우저에서 LLM API 직접 호출 금지.
- TTS/STT/MediaRecorder는 **클라이언트 전용**(브라우저 API).
- 모든 데이터는 로그인 계정 귀속. Supabase **RLS로 격리** + 서버 코드에서도 소유권 검증(RLS에만 의존 금지).

## 4. 코딩 컨벤션
- 타입 단일 출처: DB row 타입은 Supabase 생성 타입(`src/types/database.ts`). DTO는 Zod로 파생.
- `'use server'` / `'use client'` 경계 명시.
- 새 기능은 `features/<domain>/` 아래 UI+hook+action 함께(응집).
- 네이밍·주석 밀도는 주변 코드에 맞춘다. 불필요한 추상화 금지.
- 한국어 UI 기본(MVP 한국어 고정).
- **[필수] 모든 UI/프론트엔드 작업은 시작 전에 `frontend-design` 스킬을 반드시 로드하고 따른다.** 트리거를 사용자가 말하지 않아도 자동 적용. 범용 AI 기본 디자인 금지 — "따뜻·친근/라이트/개성 있는 산세리프 + **단순함**" 시스템 준수(스킬 §7 금지 목록).

## 5. 폴더 구조
정식 구조는 [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) §3. 요약:
```
src/app/   라우팅 (랜딩 /, (auth), dashboard/, interview/, api/)
src/features/   도메인 모듈 (auth, cover-letter, interview)
src/lib/   외부 의존 어댑터 (supabase, ai, speech, recording)
src/components/ui · src/types · src/config · supabase/migrations
```

## 6. 환경 변수
`.env.local` (서버 전용 키는 클라 노출 금지):
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
LLM_PROVIDER=            # claude | openai | ...
ANTHROPIC_API_KEY=       # LLM_PROVIDER=claude 일 때
OPENAI_API_KEY=          # LLM_PROVIDER=openai 일 때
```

## 7. 명령어 (스캐폴딩 이후)
```bash
npm install
npm run dev     # 개발 서버
npm run build
npm run lint
```
(스캐폴딩 전 — 생성 후 실제 스크립트에 맞게 이 섹션 갱신.)

## 8. 작업 흐름 (이슈 → 브랜치 → PR)
- 의미 있는 작업은 **이슈 단위**. 백로그: [docs/BACKLOG.md](./docs/BACKLOG.md)(의존성 순서). trivial(오타 등)은 이슈 없이 작은 커밋.
- **명명 규칙은 [docs/CONVENTIONS.md](./docs/CONVENTIONS.md)** 를 따른다 — 이슈 제목·브랜치명·커밋 메시지. **전적으로 AI가 자동 적용**(사용자는 하고 싶은 일만 말하면 됨).
- **main에 직접 커밋/푸시 금지.** 항상 브랜치 → PR(`.github/pull_request_template.md`, 본문에 `Closes #<번호>`).
- 이슈 작업 흐름: 읽기 → 브랜치 → **planner 서브에이전트** 계획 → **메인 흐름에서 구현** → **reviewer 서브에이전트** 리뷰 → PR.
  - 구현은 별도 에이전트로 빼지 않는다(컨텍스트 유지).
  - **플랜 보존**: 각 이슈 계획은 `docs/plans/issue-<NNN>-<슬러그>.md`로 저장하고 해당 브랜치/PR에 함께 커밋(규칙: `docs/plans/README.md`).

## 9. 작업 시 주의
- 기능 구현은 **수직 슬라이스**로(M1~M6, PRD §9).
- 되돌리기 어려운/외부로 나가는 작업(배포, 커밋/푸시, 외부 전송)은 사용자 승인 후.
- 수동 작업(키 발급 등)은 [docs/SETUP.md](./docs/SETUP.md) 참조.
- 결과는 사실대로 보고(테스트 실패 시 출력과 함께, 건너뛴 단계는 명시).

## 10. 도구별 스킬/에이전트 위치 (Claude Code · Codex)
스킬과 서브에이전트는 **두 도구용으로 각각** 둔다. **같은 내용으로 동기화 유지**(한쪽만 고치지 말 것).

| 구성 | Claude Code | Codex |
|---|---|---|
| 스킬 | `.claude/skills/<name>/SKILL.md` | `.agents/skills/<name>/SKILL.md` |
| 서브에이전트 | `.claude/agents/<name>.md` (Markdown) | `.codex/agents/<name>.toml` (TOML) |
| 지침 파일 | `CLAUDE.md`(→ 이 문서 포인터) | `AGENTS.md`(이 문서, 자동 로드) |
| 리뷰 커맨드 | `/code-review`(내장) | `/review`(내장) |

- 스킬(`frontend-design`, `issue-create`, `issue-work`)은 **설명 매칭으로 자동 발동** — 두 도구 모두 지원.
- **Codex 사용 시**: 프로젝트를 "trusted"로 설정해야 `.codex/` 프로젝트 레이어가 로드된다(`~/.codex/config.toml`의 `projects.<repo-path>.trust_level = "trusted"` 또는 신뢰 프롬프트 승인). `.agents/skills`는 trust 불필요.
- Codex 서브에이전트 위임은 **프롬프트 기반**(스킬/지침에서 "planner/reviewer에 위임"이라 명시).

문서: [PRD](./docs/PRD.md) · [아키텍처](./docs/ARCHITECTURE.md) · [명명 규칙](./docs/CONVENTIONS.md) · [백로그](./docs/BACKLOG.md) · [수동 셋업](./docs/SETUP.md)
