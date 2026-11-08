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
