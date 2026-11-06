# 자소서 REST API

화면 주소는 `/dashboard/cover-letters/{id}/edit`이며, 데이터 API는 `/api/cover-letters` 아래에 둔다.
화면은 생성·수정·삭제에 아래 API를 호출한다. 서버 컴포넌트의 초기 조회는 같은 DB 어댑터를 직접 사용한다.

| 메서드 | 경로 | 성공 응답 |
|---|---|---|
| GET | `/api/cover-letters` | `200 { coverLetters: CoverLetterSummary[] }` |
| POST | `/api/cover-letters` | `201 { id }`, `Location: /api/cover-letters/{id}` |
| GET | `/api/cover-letters/{id}` | `200 { coverLetter: CoverLetterDetail }` |
| PATCH | `/api/cover-letters/{id}` | `200 { id }` |
| DELETE | `/api/cover-letters/{id}` | `204` (본문 없음) |

## 인증·요청

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

## 실패 응답

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
