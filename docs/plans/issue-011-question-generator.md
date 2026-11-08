# Plan — Issue #11: 교체 가능한 AI 어댑터로 메인 질문과 꼬리질문을 생성한다

- 이슈: #11
- 브랜치: feat/11-question-generator
- 상태: 완료
- 작성일: 2026-11-08

## 목표

회사명·직무·자소서 문항/답변·경험을 받는 provider 중립 `InterviewContext`와
`QuestionGenerator` 계약을 제공한다. 서버 코드는 `getQuestionGenerator()`로만
구현체에 접근하며, OpenAI 하나로 메인 질문과 꼬리질문 또는 null을 생성한다.
질문 개수·비공백 문자열·응답 형식을 검증하고 미설정·빈 응답·형식 오류·provider
실패를 구분한다. 한국어 중립 면접관 톤과 입력 맥락을 프롬프트에 반영한다.

범위 밖: 면접 API, DB 세션, 상태머신, 여러 provider 구현, 점수·피드백, UI.

## 단계별 계획

1. 공식 문서로 OpenAI Responses API 및 구조화 응답 형식을 확인한다.
2. Zod 파생 입력 계약과 provider 중립 오류를 정의한다.
3. 호출 시점에 provider와 키를 검증하는 서버 전용 팩토리를 구현한다.
4. 메인/꼬리질문 프롬프트에 회사·직무·자소서·경험·직전 Q/A·기존 꼬리질문을
   포함한다. 지원자 데이터와 지시문을 분리하고 불필요한 꼬리질문은 null로 지시한다.
5. native fetch와 strict JSON Schema로 OpenAI 어댑터를 구현한다.
   `store:false`, `cache:no-store`, 제한 시간, 출력 토큰 상한을 적용한다.
6. 응답 완료 상태·거절·JSON·개수·비공백 문자열·꼬리질문/null을 검증한다.
   네트워크·HTTP·시간 초과 오류에서 키·지원자 내용·provider 원문을 숨긴다.
7. 설정 문서 및 환경 변수 예제를 갱신하고 테스트·정적 검사·빌드·리뷰를 수행한다.

## 건드릴 파일 (경로 / 레이어)

- `src/lib/ai/{types,errors,index,prompts,schemas}.ts` — lib 중립 계약·팩토리·검증
- `src/lib/ai/providers/openai.ts` — lib 서버 전용 OpenAI 구현
- `src/config/ai.ts` — 서버 전용 기본 모델·호출 정책
- `src/lib/ai/*.test.ts` — 설정·정상 생성·실패·입력 전달 검증
- `.env.local.example`, `docs/SETUP.md` §C — 실제 지원 설정 및 사용 방법
- `docs/plans/issue-011-question-generator.md` — 계획 보존

## 외부 의존·어댑터 / 스키마 변경

외부 의존은 OpenAI Responses API 하나이며 추가 SDK 의존은 없다.
계약에는 SDK 타입을 노출하지 않고 설정·팩토리·구현을 `server-only`로 보호한다.
import만으로 키 검증이나 외부 요청을 시작하지 않는다. Supabase·DB·migration 변경은 없다.
꼬리질문 상한 강제는 후속 상태머신의 책임이다.

## 리스크 · 열린 질문 · 승인 필요 지점

- 사용자 정정에 따라 `.env.local`의 `LLM_PROVIDER=openai`와 등록된 키를 사용한다.
  실제 키는 출력하지 않고 `.env.local`을 수정하지 않는다.
- 모델 설정이 없으므로 공식 문서로 확인한 기본 모델을 config에 두고 선택적 `LLM_MODEL`로 변경한다.
- 한국어·톤의 지시 전달과 실제 모델 품질 검증은 다르다. 테스트는 외부 호출 없이 수행한다.
- 커밋·푸시·PR 승인은 구현·검증·리뷰 및 PR 초안을 준비한 뒤 최종 단계에서 받는다.
  승인 후 계획 파일만 브랜치 첫 커밋으로 추가하고 구현 커밋을 이어서 생성한다.

## 검증 계획

- provider 미설정/미지원·키 누락·설정값 비노출 및 import 시 키 불필요 확인.
- 메인 질문 정확한 개수, 문자열 및 꼬리질문/null 정상 반환.
- 잘못된 입력·공백/빈 응답·JSON/개수/타입 오류·거절·불완전 응답 거부.
- HTTP/네트워크/시간 초과 오류의 중립 코드 및 민감 정보 비노출.
- 요청 맥락·한국어/중립 톤 지시·strict schema·store:false·캐시/제한 시간 확인.
- lint·typecheck·전체 test·production build 및 reviewer 검토.

## (구현 후) 변경 메모 / 리뷰 반영

- planner 계획을 보존하고 사용자 정정에 맞춰 OpenAI로 확정했다.
- 기존 자소서 입력의 Zod 파생 타입을 `InterviewContext`로 재사용했다.
- 설정 검증은 팩토리에 두고 config에는 서버 전용 기본 모델·호출 정책을 모았다.
- `LLM_MODEL`이 없으면 공식 문서에서 Responses/Structured Outputs 지원을 확인한
  `gpt-5.6-terra`를 사용한다. `.env.local`은 변경하지 않았다.
- 테스트 코드의 불완전한 Response 캐스트로 발생한 TS2352를 실제 Response 대역으로 수정했다.
- lint·typecheck·전체 테스트 190개·production build 통과.
- reviewer 검토 결과 이상 없음. must-fix 및 추가 지적 없음.
- 사용자 승인 후 2026-11-08 가상 자소서로 실제 OpenAI API 호출 3회를 수행했다.
  팩토리와 어댑터를 그대로 사용하고 `server-only` 표식만 Node 검증용으로 대역 처리했다.
  메인 질문 4개, 구체성이 부족한 답변의 꼬리질문 문자열, 빈 답변의 null 반환을 모두 확인했다.
  등록된 키와 설정 모델의 접근은 확인했으며 질문 품질의 사용자 평가는 별도다.
- 사용자에게 커밋·푸시·PR 생성 승인을 받았다. 계획 파일을 첫 커밋으로 추가하고 구현 커밋을 이어서 생성한다.
