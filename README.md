# AI 면접 (AI Interview)

자기소개서를 기반으로 AI가 실시간 음성 면접을 진행하는 웹 서비스.

## 개요

사용자가 회사별 자기소개서(회사명·직무·자소서 문항·경험)를 등록하면, AI가 내용을 분석해
맞춤 질문 4개와 꼬리질문(최대 2개/문항)을 생성하고, TTS로 질문 → 음성 답변 녹음 →
STT 전사 흐름으로 면접을 진행한다. 전 과정은 카메라/마이크로 녹화된다.

## 기술 스택

- **Next.js 15 (App Router) + TypeScript**
- **Tailwind CSS** + shadcn/ui
- **Supabase** (Auth · Postgres · Storage)
- **LLM (provider 미지정)** — 질문/꼬리질문 생성 (서버 전용). 어댑터로 Claude·OpenAI 등 교체 가능, 구현 단계에서 선택
- **Web Speech API** — TTS/STT (어댑터로 추상화, 교체 가능)
- **MediaRecorder API** — 카메라+마이크 녹화

## 문서

- [PRD](./docs/PRD.md) — 제품 요구사항 (랜딩 페이지 포함)
- [아키텍처](./docs/ARCHITECTURE.md) — 폴더 구조·데이터 모델·면접 상태머신
- [수동 작업 체크리스트](./docs/SETUP.md) — API 키 발급 등 사람이 직접 할 일
- [작업 지침](./CLAUDE.md) — 에이전트/개발 규칙 (정본; `AGENTS.md`는 포인터)

## 상태

🚧 MVP 설계 단계 (M0: 문서 확정). 구현 전.

## 개발 환경 설정 (예정)

```bash
# 1) 의존성 설치
npm install

# 2) 환경 변수 (.env.local)
cp .env.local.example .env.local
# NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
# SUPABASE_SERVICE_ROLE_KEY
# LLM_PROVIDER (claude|openai) + 해당 API 키 채우기

# 3) 개발 서버
npm run dev
```
