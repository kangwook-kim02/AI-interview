# REST API

## 자소서

화면 주소는 `/dashboard/cover-letters/{id}/edit`이며, 데이터 API는 `/api/cover-letters` 아래에 둔다.
화면은 생성·수정·삭제에 아래 API를 호출한다. 서버 컴포넌트의 초기 조회는 같은 DB 어댑터를 직접 사용한다.

| 메서드 | 경로 | 성공 응답 |
|---|---|---|
| GET | `/api/cover-letters` | `200 { coverLetters: CoverLetterSummary[] }` |
| POST | `/api/cover-letters` | `201 { id }`, `Location: /api/cover-letters/{id}` |
| GET | `/api/cover-letters/{id}` | `200 { coverLetter: CoverLetterDetail }` |
| PATCH | `/api/cover-letters/{id}` | `200 { id }` |
| DELETE | `/api/cover-letters/{id}` | `204` (본문 없음) |

### 인증·요청

- Supabase 사용자 세션 쿠키로 인증한다. 사용자 ID는 요청 본문에서 받지 않는다.
- 변경 요청은 `Origin`이 요청 URL의 origin과 정확히 일치해야 한다. 브라우저의 동일 출처 fetch는 이를 자동으로 보낸다. 별도 HTTP 클라이언트도 인증 쿠키와 일치하는 `Origin`을 보내야 한다.
- POST/PATCH는 `Content-Type: application/json`과 아래 본문을 사용한다. 모든 필드가 필수이며 생성·편집에 같은 Zod 검증을 적용한다.
- PATCH는 카드의 편집 가능한 필드 전체를 설정하는 계약이다. 문항·경험 배열은 전달한 순서대로 교체되며, `experiences: []`는 경험 전체 삭제를 의미한다. 일부 필드만 보내는 merge patch는 지원하지 않는다.
- DELETE는 본문이 없다. 화면에서 삭제 범위를 확인한 뒤 요청한다. 문항·경험·연결된 면접 기록은 기존 FK cascade로 함께 삭제된다.

```json
{
  "companyName": "함께컴퍼니",
  "jobTitle": "SW 개발",
  "essays": [{ "question": "지원 동기", "answer": "작성한 답변" }],
  "experiences": [{ "content": "프로젝트 경험" }]
}
```

타입과 입력 제한의 단일 출처는 `src/types/cover-letter.ts`와 `src/config/cover-letter.ts`다.
수정은 서버 소유권 확인 후 단일 DB RPC 트랜잭션으로 처리해 일부만 변경되는 것을 막는다.

### 실패 응답

실패 본문은 `{ error: string, fieldErrors?: Record<string, string> }`이며 DB 내부 오류는 노출하지 않는다.

| 상태 코드 | 의미 |
|---|---|
| 400 | 잘못된 JSON·Content-Type·UUID·입력값 |
| 401 | 로그인 필요 (HTML 로그인 이동 대신 JSON 응답) |
| 403 | 변경 요청의 Origin이 없거나 일치하지 않음 |
| 404 | 타인 소유 또는 없는 카드 (같은 응답) |
| 500 | 인증 서비스·DB 등 서버 장애 |

모든 처리 응답은 `Cache-Control: private, no-store`를 사용한다.
성공한 변경은 대시보드와 해당 편집 경로를 갱신한다. 화면은 성공 시 대시보드로 이동하고,
실패하면 작성 내용을 유지하면서 폼 안에 오류를 표시한다.

## 면접 시작

`POST /api/interview/questions`는 저장된 본인 자소서로 새 면접을 준비한다.
Supabase 사용자 세션 쿠키, 요청 URL과 같은 `Origin`, `Content-Type: application/json`을 보낸다.
요청에는 아래 `coverLetterId`만 허용한다. 사용자 ID·자소서 내용·질문 개수는 서버에서 결정한다.

```json
{ "coverLetterId": "c0120000-0000-4000-8000-000000000001" }
```

성공은 `201`이며 다음 형태로 반환한다. 실제 `questions`에는 정확히 4개의 질문이 들어간다.
계약의 단일 출처는 `src/types/interview.ts`와 `src/config/interview.ts`다.

```ts
{ interviewId: string; questions: string[] }
```

서버는 검증된 사용자로 본인 자소서를 조회하고 저장된 회사명·직무·문항/답변·경험을 AI 팩토리에
전달한다. 질문 생성 및 결과 검증이 끝난 후 `create_interview` RPC에서 세션과 메인 질문을 한
트랜잭션에 저장한다. 세션은 `in_progress`, 질문은 `type=main`, `parent_question_id=null`,
`order_index=0..3`으로 저장하며 아직 발화하지 않았으므로 `asked_at`은 null이다.
같은 자소서로 다시 요청하면 새 세션을 만들고 기존 면접·질문·답변은 유지한다.

실패 본문은 `{ error: string }`이며 키·자소서 내용·AI/DB 오류 원문을 포함하지 않는다.
성공·실패 모두 `Cache-Control: private, no-store`를 사용한다.

| 상태 코드 | 의미 |
| --- | --- |
| 400 | 잘못된 JSON·Content-Type·UUID·요청 필드 |
| 401 | 로그인 필요. HTML 로그인 이동 없이 JSON 반환 |
| 403 | Origin 누락 또는 불일치 (인증 전에 확인) |
| 404 | 없는/타인 카드 또는 생성 중 삭제된 카드 |
| 500 | 인증/DB 장애, 저장된 맥락 또는 저장 결과 오류 |
| 502 | AI 서비스 실패·빈 응답·질문 개수/형식 오류 |
| 503 | AI provider/키 미설정 또는 미지원 provider |
| 504 | AI 응답 시간 초과 |

AI 실패 시 DB 저장을 호출하지 않고 질문 저장이 실패하면 세션을 포함해 트랜잭션 전체가 롤백된다.
DB 응답이 유실되면 완전한 세션이 저장됐는지 알 수 없을 수 있으며 성공으로 응답하지 않는다.
자동 재시도나 중복 요청 방지는 제공하지 않으므로 재요청 시 새 세션이 생길 수 있다.
TTS/STT·화면 자동 진행·꼬리질문 API·영상 녹화는 이 API에 포함되지 않는다.

## 꼬리질문 판단

`POST /api/interview/follow-up`은 본인의 진행 중 면접에서 직전 질문의 확정 답변을 판단한다.
사용자 세션 쿠키, 요청 URL과 같은 `Origin`, `Content-Type: application/json`이 필요하다.
다음 세 필드만 허용한다. 사용자 ID·메인 부모·순서·기존 질문·자소서 맥락은 서버가 결정한다.

```json
{
  "interviewId": "c0150000-0000-4000-8000-000000000002",
  "questionId": "c0150000-0000-4000-8000-000000000003",
  "answerTranscript": "제가 담당한 부분은 접근성 개선이었습니다."
}
```

성공은 `200 { followUp: string | null }`이다. 답변은 양끝 공백을 제거하고 최대 20,000자다.
빈 확정 전사는 내용을 추측하지 않고 AI 호출 없이 null로 판단한다.
서버는 저장된 회사·직무·자소서·경험, 직전 질문/답변과 해당 메인의 이전 꼬리질문을
기존 AI 팩토리에 전달한다. 추가 확인이 불필요하면 null을 저장한다.

생성한 질문은 항상 메인 질문을 부모로 하며 `type=follow_up`, `order_index=0,1`로 저장한다.
한 메인의 마지막 꼬리질문만 새로운 판단을 요청할 수 있다. 최대 2개 이후에는 AI 호출 없이
null을 저장한다. 시작 API의 메인 질문 텍스트만으로는 이 API를 호출할 수 없으므로,
화면 연결 시 저장된 질문 UUID를 조회하는 처리가 필요하다. 질문 ID를 반환하는 화면/조회 API
연결과 공통 답변·종료 기록 저장은 이번 범위에 포함하지 않는다.

판단은 소스 질문별로 답변과 결과(null 포함)를 보존한다. 같은 질문·정규화한 같은 답변은
기존 결과를 재사용하며, 다른 답변은 409다. 네트워크 응답 유실 뒤에도 같은 요청으로 재시도할 수 있다.
동시 AI 호출 자체는 중복될 수 있으나 DB RPC가 면접 행을 잠근 뒤 실제 저장 결과 하나를 확정하고
모든 호출에 그 결과를 반환한다. 질문과 판단은 같은 트랜잭션으로 저장한다. AI 실패는 판단으로 저장하지 않는다.
AI 도중 종료/삭제된 세션은 저장 시 재검사한다. 기존 판단의 재요청도 종료된 세션에서는 거부한다.
맥락은 조회 시점의 자소서이며 면접 시작 시점의 스냅샷은 아니다.

실패 본문은 `{ error: string }`이고 내부 오류·키·지원자 내용은 포함하지 않는다.
모든 응답은 `Cache-Control: private, no-store`다.

| 상태 코드 | 의미 |
| --- | --- |
| 400 | 잘못된 JSON·Content-Type·UUID·필드·답변 길이 |
| 401 | 로그인 필요 (JSON 응답) |
| 403 | Origin 누락/불일치 |
| 404 | 없는/타인 면접·해당 면접에 속하지 않는 질문·삭제된 자소서 |
| 409 | 종료된 면접 또는 이미 판단한 질문의 답변 변경/과거 질문 |
| 500 | 인증/DB 장애·저장된 맥락/저장 결과 오류 |
| 502 | AI 실패·잘못된 생성 결과 |
| 503 | AI provider/키 미설정·미지원 provider |
| 504 | AI 응답 시간 초과 |
