# 백로그 (의존성 순서)

작업 단위를 **의존성 순서대로** 정리한 목록. 여기 항목을 `issue-create` 스킬로 GitHub 이슈로 만들고,
`issue-work` 스킬로 브랜치 파서 작업 → PR 한다.

> 규칙: 한 항목 = 하나의 머지 가능한 변경. 너무 크면 이슈 생성 시 더 쪼갠다.
> 마일스톤 정의는 [PRD](./PRD.md) §9 참조.

---

## M1 — 기반 (스캐폴딩 · Supabase · 인증 · 디자인 토큰 · 랜딩)

의존성 그래프:
```
T1 스캐폴딩
 ├─ T2 Supabase 연동 ── T3 DB 마이그레이션+RLS
 └─ T4 디자인 토큰/폰트
        ├─ T5 인증 (needs T2, T4)
        └─ T6 랜딩 (needs T4, +T5 리다이렉트)
```

- **T1. [스캐폴딩] Next.js 프로젝트 초기화** — *의존: 없음*
  - create-next-app(TS, Tailwind, App Router), `docs/ARCHITECTURE.md` §3 폴더구조 생성, `src/config/interview.ts` 상수, `.env.local.example`, `.gitignore` 확인, 기본 lint/build 통과.
- **T2. [인프라] Supabase 클라이언트 연동** — *의존: T1*
  - `lib/supabase/{client,server}.ts`, env 연결, 세션 읽기 유틸. 키는 서버 전용 분리.
- **T3. [인프라] DB 마이그레이션 + RLS** — *의존: T2*
  - `supabase/migrations/`에 스키마(ARCHITECTURE §4) SQL, RLS 정책, 생성 타입 `types/database.ts`.
- **T4. [디자인] 디자인 토큰 & 폰트 셋업** — *의존: T1* (frontend-design 스킬)
  - `globals.css` CSS 변수, Tailwind theme 매핑, next/font(Pretendard/Gmarket Sans), shadcn 베이스 오버라이드.
- **T5. [인증] 회원가입/로그인/로그아웃 + 보호 라우트** — *의존: T2, T4*
  - `(auth)/login`, `(auth)/signup`, 로그아웃, `dashboard` 레이아웃 인증 가드. FR-AUTH-1~4.
- **T6. [디자인] 랜딩 페이지** — *의존: T4 (+T5)*
  - 공개 `/`, 히어로+CTA+작동방식, 로그인 시 `/dashboard` 리다이렉트. FR-LAND-1~7. **단순하게.**

## M2 — 자소서 CRUD (회사 정보 입력 · 카드 목록) — *의존: M1*
- 회사정보 입력 폼(회사명·직무·자소서 문항 동적 추가/삭제·경험 동적 추가/삭제), 저장 Server Action, 대시보드 카드 목록, 수정/삭제. FR-CL-1~9.

## M3 — 면접 준비 + 질문 생성 API — *의존: M2*
- 장비 점검(카메라/마이크/Web Speech 지원 체크), `lib/ai` 어댑터 + 팩토리, `/api/interview/questions`(메인 4문항). FR-PREP, FR-INT-1.

## M4 — 면접 진행 상태머신 — *의존: M3*
- `features/interview/machine.ts` 상태머신(TTS→자동녹음→대답완료→STT→꼬리질문), `lib/speech` 어댑터, 좌(카메라)·우(Q&A) UI, 진행률/타이머, 꼬리질문 API. FR-INT-2~13.

## M5 — 면접 기록 저장 — *의존: M4*
- 종료 시 메타데이터/전사 저장, 결과 화면 Q&A 요약. FR-REC-1~2. (영상 저장은 후순위 — MVP 제외)

## M6 — 통합 테스트 + 폴리싱 — *의존: M5*
- E2E 수동 점검(가입→자소서→면접→기록), 반응형/접근성/엣지케이스 다듬기.

---

### 다음에 할 일
M1의 **T1부터** 이슈로 만들어 작업 시작. (T1은 의존성 없음 → 키 발급 전에도 가능)
