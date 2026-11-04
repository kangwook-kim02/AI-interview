# AGENTS.md

이 저장소의 AI 에이전트 작업 지침 정본은 [`CLAUDE.md`](./CLAUDE.md)에 있다.

어떤 에이전트/도구를 쓰든 **작업 전에 `CLAUDE.md`와 [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)를 먼저 읽는다.**
중복/드리프트를 피하기 위해 지침은 `CLAUDE.md` 한 곳에서만 관리한다.

## 가장 중요한 규칙 (요약 — 전문은 CLAUDE.md)

1. 레이어는 단방향: `app → features → lib → 외부서비스`.
2. 외부 의존(LLM/TTS/STT/녹화/DB)은 전부 `lib/` 어댑터 뒤로. 구현체 직접 import 금지.
3. **LLM provider 미지정** — `getQuestionGenerator()` 팩토리로만 접근, 특정 provider에 종속 금지.
4. 비밀 키는 서버 전용. LLM 호출은 서버 경유.
5. 상수는 `src/config/`, 스키마 변경은 `supabase/migrations/`.
6. 면접 플로우는 `features/interview/machine.ts`의 명시적 상태머신으로.

문서: [PRD](./docs/PRD.md) · [아키텍처](./docs/ARCHITECTURE.md) · [수동 작업 체크리스트](./docs/SETUP.md)
