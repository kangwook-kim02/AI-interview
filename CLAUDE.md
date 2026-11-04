# CLAUDE.md

이 저장소의 작업 지침 **정본은 [`AGENTS.md`](./AGENTS.md)** 이다.
**작업 전에 `AGENTS.md`와 [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)를 반드시 읽는다.**
(규칙 중복/드리프트를 피하려고 지침은 `AGENTS.md` 한 곳에서만 관리한다.)

## Claude Code 전용 안내
- 스킬: `.claude/skills/` — `frontend-design`, `issue-create`, `issue-work` (설명 매칭으로 자동 발동)
- 서브에이전트: `.claude/agents/` — `planner`, `reviewer`
- 리뷰 커맨드: 내장 `/code-review`
- **[필수] 모든 UI/프론트엔드 작업은 시작 전 `frontend-design` 스킬을 반드시 로드**하고 따른다(범용 디자인/복잡한 포털 룩 금지).

> Codex 등 다른 도구용 스킬/에이전트 위치와 동기화 규칙은 `AGENTS.md` §10 참조.
