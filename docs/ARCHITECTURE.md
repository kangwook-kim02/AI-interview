# AI 면접 웹서비스 — 아키텍처 설계

- **문서 상태:** Draft v0.1
- **작성일:** 2026-11-04
- **연관 문서:** [PRD.md](./PRD.md)

이 문서는 **기술부채 방지**를 1차 목표로, 폴더 구조·데이터 모델·모듈 경계·상태머신을 코드 작성 전에 고정한다.

---

## 1. 기술 스택 (확정)

| 영역 | 선택 | 비고 |
|---|---|---|
| 프레임워크 | **Next.js 15 (App Router) + TypeScript** | 프론트 + API(route handler/server action) 통합 |
| 스타일 | **Tailwind CSS** + shadcn/ui | 빠른 UI, 일관된 디자인 시스템 |
| 인증 | **Supabase Auth** | 이메일/비밀번호, 추후 OAuth |
| DB | **Supabase Postgres** | RLS로 계정 격리 |
| 파일 저장 | **Supabase Storage** | 면접 녹화 영상/오디오 |
| LLM | **미지정 (provider-무관)** — 어댑터로 교체 가능 (Claude / OpenAI 등) | 질문/꼬리질문 생성. 구현 단계에서 선택, 코드는 특정 provider에 종속 금지 |
| TTS/STT | **브라우저 Web Speech API** | 어댑터로 추상화 (교체 가능) |
| 녹화 | **MediaRecorder API** | 카메라+마이크 → webm |
| 상태관리 | React 상태 + **Zustand**(면접 세션 전용) | 서버 상태는 React Query/서버 컴포넌트 |
| 유효성 검사 | **Zod** | 폼 + API 입출력 스키마 공유 |
| 배포 | **Vercel** + Supabase (managed) | |

> **원칙:** 외부 의존(LLM, TTS, STT, Storage)은 전부 `lib/`의 어댑터 인터페이스 뒤에 숨긴다. 페이지/컴포넌트는 구현체를 직접 import 하지 않는다.
>
> **LLM provider 미지정:** 질문 생성은 `QuestionGenerator` 인터페이스에만 의존한다. Claude든 OpenAI든 다른 LLM이든 **구현체만 갈아끼우면 되고 상위 코드는 불변**이다. 어떤 provider를 쓸지는 구현 단계에서 환경변수(`LLM_PROVIDER`)로 선택하며, **어느 한 provider에 코드가 종속되지 않도록** 한다.

---

## 2. 시스템 아키텍처 (상위)

```
┌─────────────────────────────────────────────────────────┐
│                      Browser (Client)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐   │
│  │ React UI      │  │ Web Speech   │  │ MediaRecorder │   │
│  │ (pages/comp)  │  │ TTS / STT    │  │ (cam+mic)     │   │
│  └──────┬───────┘  └──────┬───────┘  └───────┬───────┘   │
│         │  interview session store (Zustand)  │           │
└─────────┼───────────────────────────────────┼───────────┘
          │ (fetch)                            │ (upload)
          ▼                                    ▼
┌──────────────────────────┐        ┌────────────────────────┐
│  Next.js API / Server     │        │   Supabase Storage      │
│  - /api/interview/...      │        │   (recordings bucket)   │
│  - Claude 질문 생성         │        └────────────────────────┘
│  - 인증 가드                │
└──────────┬───────────────┘
           │ (server-side supabase client)
           ▼
┌──────────────────────────┐        ┌────────────────────────┐
│   Supabase Postgres (RLS)  │        │   Claude API            │
│   users/cover_letters/...  │        │   (server-side only)    │
└──────────────────────────┘        └────────────────────────┘
```

**핵심 경계 규칙**
- Claude API 키는 **서버에서만** 사용(클라이언트 노출 금지). 질문 생성은 항상 Next.js API 경유.
- TTS/STT/MediaRecorder는 **클라이언트 전용**(브라우저 API).
- DB 쓰기는 서버(Server Action/Route Handler) 경유를 기본으로 하되, 단순 조회는 RLS 보호 하에 클라이언트 Supabase 사용 가능.

---

## 3. 폴더 구조 (기술부채 방지 핵심)

```
AI-interview/
├─ docs/
│  ├─ PRD.md
│  └─ ARCHITECTURE.md
├─ public/
├─ src/
│  ├─ app/                         # Next.js App Router (라우팅 전용, 로직 최소화)
│  │  ├─ (auth)/
│  │  │  ├─ login/page.tsx
│  │  │  └─ signup/page.tsx
│  │  ├─ (dashboard)/
│  │  │  ├─ layout.tsx             # 인증 가드 + 공통 레이아웃
│  │  │  ├─ page.tsx               # 자소서 카드 목록(대시보드)
│  │  │  └─ cover-letters/
│  │  │     ├─ new/page.tsx        # 회사 정보 입력(생성)
│  │  │     └─ [id]/edit/page.tsx  # 수정
│  │  ├─ interview/
│  │  │  └─ [coverLetterId]/
│  │  │     ├─ prepare/page.tsx    # 장비 점검
│  │  │     ├─ page.tsx            # 면접 진행 (세션)
│  │  │     └─ [interviewId]/result/page.tsx
│  │  ├─ api/
│  │  │  └─ interview/
│  │  │     ├─ questions/route.ts   # 메인 질문 생성(Claude)
│  │  │     └─ follow-up/route.ts   # 꼬리질문 판단/생성(Claude)
│  │  ├─ layout.tsx
│  │  └─ globals.css
│  │
│  ├─ features/                    # 도메인별 기능 모듈 (UI+로직 응집)
│  │  ├─ auth/
│  │  │  ├─ components/
│  │  │  └─ hooks/
│  │  ├─ cover-letter/
│  │  │  ├─ components/            # CoverLetterForm, EssayItemRow, ExperienceRow, Card
│  │  │  ├─ hooks/
│  │  │  └─ actions.ts             # Server Actions (CRUD)
│  │  └─ interview/
│  │     ├─ components/            # CameraView, QATranscript, ProgressBar, Timer, AnswerControls
│  │     ├─ hooks/                 # useInterviewSession, useRecorder, useSpeech
│  │     ├─ machine.ts             # 면접 상태머신 (핵심)
│  │     └─ store.ts               # Zustand 세션 스토어
│  │
│  ├─ lib/                         # 외부 의존 어댑터 + 공용 유틸 (교체 지점)
│  │  ├─ supabase/
│  │  │  ├─ client.ts              # 브라우저 클라이언트
│  │  │  ├─ server.ts              # 서버 클라이언트 (쿠키 기반)
│  │  │  └─ storage.ts             # 녹화 업로드 헬퍼
│  │  ├─ ai/
│  │  │  ├─ types.ts               # QuestionGenerator 인터페이스 (provider-무관 계약)
│  │  │  ├─ index.ts               # 팩토리: LLM_PROVIDER 보고 구현체 선택/반환
│  │  │  ├─ providers/
│  │  │  │  ├─ claude.ts           # Claude 구현체 (서버 전용, 구현 단계에 추가)
│  │  │  │  └─ openai.ts           # OpenAI 구현체 (서버 전용, 구현 단계에 추가)
│  │  │  └─ prompts.ts             # 프롬프트 템플릿 (버전 관리, provider-중립)
│  │  ├─ speech/
│  │  │  ├─ types.ts               # TTS/STT 인터페이스
│  │  │  ├─ web-speech-tts.ts      # Web Speech 구현체
│  │  │  └─ web-speech-stt.ts
│  │  └─ recording/
│  │     └─ media-recorder.ts      # MediaRecorder 래퍼
│  │
│  ├─ components/ui/               # shadcn/ui 공용 프리미티브 (도메인 무관)
│  ├─ types/                       # 전역 타입 (DB row, DTO)
│  │  └─ database.ts               # Supabase 생성 타입
│  └─ config/
│     └─ interview.ts              # 상수: MAIN_QUESTION_COUNT=4, MAX_FOLLOW_UPS=2 등
│
├─ supabase/
│  ├─ migrations/                  # SQL 마이그레이션 (버전 관리)
│  └─ seed.sql
├─ .env.local.example
├─ next.config.ts
├─ tailwind.config.ts
├─ tsconfig.json
└─ package.json
```

**레이어 규칙 (의존 방향 단방향)**
```
app/  ──▶  features/  ──▶  lib/  ──▶  (외부 서비스)
                 └──▶  components/ui, types, config
```
- `app/`는 라우팅/조립만. 비즈니스 로직 금지.
- `features/`끼리 직접 참조 금지(공유물은 `lib`/`types`로 승격).
- `lib/`는 상위 레이어를 import 하지 않음.

---

## 4. 데이터 모델 (Supabase Postgres)

ERD:
```
auth.users (Supabase 관리)
   │ 1
   │
   ▼ N
cover_letters ──1──▶ N essay_items
   │                    (question, answer)
   │ 1
   ├──────────▶ N experiences  (content)
   │
   ▼ N
interviews ──1──▶ N interview_questions
                     (type: main|follow_up, parent_id, order, question_text,
                      answer_transcript, answer_audio_path, asked_at, answered_at)
```

### 4.1 테이블 정의

```sql
-- 자기소개서(=회사 지원 카드)
create table cover_letters (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  company_name text not null,
  job_title   text not null,          -- 지원 직무
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 자소서 문항 (질문 + 답변)
create table essay_items (
  id              uuid primary key default gen_random_uuid(),
  cover_letter_id uuid not null references cover_letters(id) on delete cascade,
  position        int  not null default 0,
  question        text not null,
  answer          text not null default '',
  created_at      timestamptz not null default now()
);

-- 경험 항목
create table experiences (
  id              uuid primary key default gen_random_uuid(),
  cover_letter_id uuid not null references cover_letters(id) on delete cascade,
  position        int  not null default 0,
  content         text not null,
  created_at      timestamptz not null default now()
);

-- 면접 세션
create table interviews (
  id               uuid primary key default gen_random_uuid(),
  cover_letter_id  uuid not null references cover_letters(id) on delete cascade,
  user_id          uuid not null references auth.users(id) on delete cascade,
  status           text not null default 'in_progress'
                   check (status in ('in_progress','completed','aborted')),
  started_at       timestamptz not null default now(),
  ended_at         timestamptz,
  duration_seconds int,
  recording_path   text,          -- Storage 내 영상 경로
  created_at       timestamptz not null default now()
);

-- 면접 질문/답변 (메인 + 꼬리)
create table interview_questions (
  id                 uuid primary key default gen_random_uuid(),
  interview_id       uuid not null references interviews(id) on delete cascade,
  type               text not null check (type in ('main','follow_up')),
  parent_question_id uuid references interview_questions(id) on delete cascade,
  order_index        int  not null,     -- 메인은 0..3, 꼬리는 부모 기준 순서
  question_text      text not null,
  answer_transcript  text,
  answer_audio_path  text,
  asked_at           timestamptz,
  answered_at        timestamptz
);
```

### 4.2 RLS (Row Level Security) 정책 원칙
- 모든 테이블 `enable row level security`.
- 기본 정책: `user_id = auth.uid()` (직접 소유) 또는 상위 `cover_letters/interviews`의 소유자와 join 확인.
- Storage 버킷 `recordings`: 경로 규칙 `recordings/{user_id}/{interview_id}/...`, 본인만 read/write.

---

## 5. 외부 의존 추상화 (교체 가능 어댑터)

기술부채 방지의 핵심. 각 외부 서비스는 인터페이스로 고정하고 구현체를 갈아끼운다.

### 5.1 질문 생성 (`lib/ai/types.ts`)
```ts
export interface InterviewContext {
  companyName: string;
  jobTitle: string;                    // 지원 직무 (질문 생성 맥락)
  essays: { question: string; answer: string }[];
  experiences: { content: string }[];
}

export interface QuestionGenerator {
  /** 메인 질문 N개 생성 */
  generateMainQuestions(ctx: InterviewContext, count: number): Promise<string[]>;
  /** 직전 Q/A 기반 꼬리질문 1개 or null(안 함) */
  generateFollowUp(input: {
    ctx: InterviewContext;
    question: string;
    answerTranscript: string;
    previousFollowUps: string[]; // 이미 한 꼬리질문
  }): Promise<string | null>;
}
```
→ 구현: `providers/*.ts`. **상위 코드는 항상 `getQuestionGenerator()` 팩토리를 통해서만 접근**하고, 구체 provider를 직접 import 하지 않는다:

```ts
// lib/ai/index.ts
import type { QuestionGenerator } from './types';

export function getQuestionGenerator(): QuestionGenerator {
  switch (process.env.LLM_PROVIDER) {
    case 'openai': return new OpenAIQuestionGenerator();
    case 'claude': return new ClaudeQuestionGenerator();
    default: throw new Error('LLM_PROVIDER 미설정');
  }
}
```

→ provider 교체는 `.env`의 `LLM_PROVIDER` 값과 해당 API 키만 바꾸면 끝. 호출부(API 라우트)는 불변.

### 5.2 음성 (`lib/speech/types.ts`)
```ts
export interface TTSPort {
  speak(text: string, opts?: { lang?: string }): Promise<void>; // 재생 끝나면 resolve
  cancel(): void;
  isSupported(): boolean;
}

export interface STTPort {
  start(handlers: {
    onInterim?: (text: string) => void;  // 실시간 중간 결과
    onFinal: (text: string) => void;      // 최종 전사
    onError?: (e: unknown) => void;
  }): void;
  stop(): void;        // 최종 결과 확정
  isSupported(): boolean;
}
```
→ 구현: Web Speech. 추후 OpenAI TTS / Whisper 등으로 교체 가능.

### 5.3 녹화 (`lib/recording/media-recorder.ts`)
```ts
export interface Recorder {
  start(stream: MediaStream): void;
  stop(): Promise<Blob>;   // webm blob
}
```

---

## 6. 면접 진행 상태머신 (가장 복잡한 부분)

`features/interview/machine.ts`에 **명시적 상태머신**으로 구현해 경쟁 조건/엣지케이스를 통제한다.

### 6.1 상태 정의
```
idle
 → generating_questions      // Claude로 메인 4개 생성
 → asking         (TTS 재생 중)
 → recording      (TTS 끝 → 자동 녹음, 사용자 답변 중)
 → transcribing   (대답완료 → STT 확정 대기)
 → evaluating     (꼬리질문 여부 Claude 판단)
 → asking         (꼬리질문 있으면 루프)
 → ... (다음 메인 질문으로)
 → finishing      (녹화 중단 + 업로드 + 기록 저장)
 → done
```

### 6.2 상태 전이표

| 현재 상태 | 이벤트 | 다음 상태 | 액션 |
|---|---|---|---|
| idle | START | generating_questions | 녹화 시작, 타이머 시작 |
| generating_questions | QUESTIONS_READY | asking | 첫 질문 TTS |
| asking | TTS_END (or timeout fallback) | recording | STT start |
| recording | ANSWER_DONE(사용자 버튼) | transcribing | STT stop |
| transcribing | TRANSCRIPT_FINAL | evaluating | DB에 Q/A 저장 |
| evaluating | FOLLOW_UP(text) | asking | 꼬리질문 TTS (카운트++) |
| evaluating | NO_FOLLOW_UP / 꼬리2개 소진 | asking(다음 메인) 또는 finishing | 진행률++ |
| 모든 질문 소진 | — | finishing | 녹화 stop→업로드→기록 |
| finishing | UPLOAD_DONE | done | 결과 페이지 이동 |
| (any) | ABORT | finishing | 중도 종료 |

### 6.3 주의 설계 포인트
- **TTS 종료 감지 이중화**: `speak()`의 resolve + 안전 타이머(최대 길이) 병행 → `onend` 누락 대비.
- **마이크 스트림 공유**: `getUserMedia`로 얻은 단일 스트림을 MediaRecorder(저장)와 SpeechRecognition(전사)이 공유. (Web Speech STT는 자체 마이크 사용 → 충돌 없는지 구현 단계 검증, 필요시 STT는 별도 운용)
- **꼬리질문 상한**: `MAX_FOLLOW_UPS=2`를 상태머신에서 하드 캡(LLM 응답과 무관하게 강제).
- **경과 시간**: `started_at` 기준 클라이언트 타이머(1s). 종료 시 서버 기준으로 `duration_seconds` 확정.
- **진행률**: 메인 질문 index 기준(꼬리질문은 진행률에 미포함, 하위 표시).

---

## 7. API 설계 (Next.js Route Handlers, 서버 전용)

| 메서드 | 경로 | 입력 | 출력 | 설명 |
|---|---|---|---|---|
| POST | `/api/interview/questions` | `{ coverLetterId }` | `{ interviewId, questions: string[] }` | 면접 생성 + 메인 질문 4개 |
| POST | `/api/interview/follow-up` | `{ interviewId, questionId, answerTranscript }` | `{ followUp: string \| null }` | 꼬리질문 판단 |
| POST (또는 Server Action) | 자소서 CRUD | — | — | `features/cover-letter/actions.ts` |

- 인증: 모든 API는 서버 Supabase 클라이언트로 세션 검증 후 소유권 확인.
- 입출력은 Zod 스키마로 검증(클라이언트와 타입 공유).

---

## 8. 환경 변수 (`.env.local.example`)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # 서버 전용(절대 클라 노출 금지)

# LLM — provider 미지정. 구현 단계에서 하나 선택
LLM_PROVIDER=                     # 'claude' | 'openai' | ... (서버 전용)
ANTHROPIC_API_KEY=                # LLM_PROVIDER=claude 일 때만 (서버 전용)
OPENAI_API_KEY=                   # LLM_PROVIDER=openai 일 때만 (서버 전용)
```

---

## 9. 설정 상수 (`src/config/interview.ts`)

```ts
export const MAIN_QUESTION_COUNT = 4;
export const MAX_FOLLOW_UPS = 2;        // 메인 질문당
export const SPEECH_LANG = 'ko-KR';
export const TTS_SAFETY_TIMEOUT_MS = 30_000;
export const RECORDING_MIME = 'video/webm';
```

---

## 10. 코딩 규약 (부채 방지)

1. **타입 단일 출처**: DB row 타입은 Supabase 생성 타입(`types/database.ts`)에서만. DTO는 Zod로 파생.
2. **외부 의존 직접 import 금지**: 컴포넌트는 `lib/*` 포트 인터페이스만 사용.
3. **상수 하드코딩 금지**: 숫자/문자 상수는 `config/`로.
4. **서버/클라 경계 명확화**: `'use server'` / `'use client'` 명시. 비밀 키는 서버 모듈에서만.
5. **마이그레이션 버전관리**: 스키마 변경은 `supabase/migrations/`에 SQL로.
6. **기능 모듈 응집**: 새 기능은 `features/<domain>/` 아래 UI+hook+action 함께.

---

## 11. 다음 단계 (M1 스캐폴딩 착수 시)

1. `create-next-app`(TS, Tailwind, App Router) + 위 폴더 구조 생성.
2. Supabase 프로젝트 연결 + 마이그레이션(섹션 4) 적용 + RLS 정책.
3. `lib/` 어댑터 인터페이스 스텁 작성.
4. 인증 → 자소서 CRUD → 면접 순으로 수직 구현.
