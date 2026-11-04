---
name: issue-work
description: >
  GitHub 이슈 하나를 처음부터 끝까지 작업한다. 이슈를 읽고 → 전용 브랜치를 파고 →
  계획(planner 서브에이전트)을 세우고 → 코드를 구현하고 → 리뷰(reviewer 서브에이전트)를 받아
  반영하고 → PR 템플릿에 맞춰 PR을 올린다. 항상 브랜치에서 작업하고 main에 직접 커밋하지 않는다.
  트리거: 이슈 작업, 이슈 진행, issue work, #숫자 작업, 이 이슈 해줘, 작업 시작.
---

# issue-work — 이슈 작업 스킬

입력: 이슈 번호(예: `#5`) 또는 이슈 설명.

> Claude Code용 동일 스킬: `.claude/skills/issue-work/SKILL.md` — **같은 내용 동기화 유지**(에이전트 경로·리뷰 커맨드만 도구별로 다름).
> **전제 규칙**: 작업 전 `AGENTS.md`(정본) + `docs/ARCHITECTURE.md`를 읽는다. UI가 포함되면 `frontend-design` 스킬을 반드시 로드한다. main에 직접 커밋/푸시 금지 — 반드시 브랜치 + PR.

## 절차

### 1. 이슈 읽기
- `gh issue view <N>` (없으면 사용자가 준 설명 사용)으로 목적·완료조건·의존성·범위밖을 파악.
- 의존 이슈가 미완이면 사용자에게 알리고 진행 여부 확인.

### 2. 브랜치 생성
브랜치·커밋 명명은 **`docs/CONVENTIONS.md`** 를 그대로 따른다(전적으로 자동 적용).
```bash
git checkout main && git pull --ff-only
git checkout -b <type>/<N>-<영문-슬러그>   # 예: feat/5-email-auth
```

### 3. 계획 (planner 서브에이전트) + 플랜 보존
- **`planner` 서브에이전트**(`.codex/agents/planner.toml`)에 위임해 단계별 계획 + 건드릴 파일(경로) + 어댑터/스키마 + 리스크를 받는다. (Codex 위임은 프롬프트로 명시.)
- 받은 계획을 **`docs/plans/issue-<NNN>-<슬러그>.md`** 로 저장한다(번호 3자리 zero-pad). 형식은 `docs/plans/README.md`의 템플릿을 따른다.
  - 이 플랜 파일을 **브랜치의 첫 커밋**으로 추가(`docs: add plan for #<N>`). → 플랜·코드·리뷰가 한 PR에 함께 남는다.
- 계획을 사용자에게 간단히 공유(핵심만). 큰 설계 결정/열린 질문이 있으면 확인받는다.

### 4. 구현 (메인 흐름에서 직접)
- **별도 코드 에이전트에 위임하지 않는다.** 이 스킬을 실행 중인 메인 흐름에서 직접 구현한다(컨텍스트 유지·사용자 가시성). 계획대로 AGENTS.md의 레이어·어댑터·보안 규칙 준수.
- 외부 의존은 어댑터 뒤, 비밀 키 서버 전용, 상수는 `config/`, 스키마는 `supabase/migrations/`.
- UI면 `frontend-design` 토큰/규칙(따뜻·친근·라이트·단순함) 사용, 범용/포털 룩 금지.
- 의미 단위로 커밋 — `docs/CONVENTIONS.md`의 커밋 규칙(`<type>(<scope>): <제목>`) 준수.

### 5. 리뷰 (reviewer 서브에이전트)
- 변경 diff에 **`reviewer` 서브에이전트**(`.codex/agents/reviewer.toml`)로 프로젝트 규칙 기반 리뷰를 받는다. (범용 추가 점검이 필요하면 내장 `/review` 병행 가능.)
- 나온 지적 중 **must-fix는 반영**, nice-to-have는 취사선택(불필요한 과수정 금지). 반영 내역을 기록.

### 6. PR 생성
- 브랜치 푸시 후, `.github/pull_request_template.md`에 맞춰 PR 작성.
  - 제목: `<type>: <요약>`
  - 본문: 요약 / `Closes #<N>` / 변경사항 / 테스트 / 체크리스트 전부 채움. 변경사항에 플랜 파일(`docs/plans/issue-<NNN>-...md`) 링크 포함.
  - `gh` 있으면 템플릿 본문을 직접 채워 생성하고 PR URL 보고. 없으면 PR 본문 마크다운 출력 + 수동 생성 안내.

### 7. 보고
- 한 일 요약, PR 링크, 완료조건 충족 여부, 검증 결과(테스트 통과/미실행)를 **사실대로** 보고.

## 주의
- 되돌리기 어려운/외부로 나가는 작업(푸시, PR 생성)은 진행 전 사용자 승인(이미 이 흐름에 동의한 경우 제외).
- 이슈 범위 밖 작업은 하지 않는다. 필요하면 별도 이슈로 제안(issue-create).
- 테스트 실패/미실행을 숨기지 않는다.
