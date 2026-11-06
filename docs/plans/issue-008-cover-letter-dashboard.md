# Plan — Issue #8: 대시보드에 내 지원 카드와 면접 진입 버튼을 표시한다

- 이슈: #8
- 브랜치: feat/8-cover-letter-dashboard
- 상태: 완료
- 작성일: 2026-11-06

## 목표

로그인 사용자의 자소서를 회사별 카드로 표시하고, 새 자소서 등록과 해당 자소서의 면접 준비 경로를 연결한다. 회사명·직무·문항 수·생성일을 표시하고 빈 목록과 조회 실패를 구분한다.

## 단계별 계획

1. 기존 Supabase 어댑터에 검증된 사용자 ID로 필터링하는 목록 조회를 추가한다. 카드 필드와 `essay_items(count)`만 조회하고 최신 생성 순으로 정렬한다.
2. feature 서버 조회 함수에서 인증을 확인한다. 미인증 사용자는 로그인으로 보내고 DB 오류는 일반 안내로 변환한다.
3. 반응형 카드 목록, 간단한 일러스트를 포함한 빈 상태, 조회 오류와 재시도 동선을 구현한다. 각 카드에 면접 준비 링크를 제공한다.
4. dashboard 페이지는 feature 컴포넌트를 조립한다. 기존 저장 후 재검증·리다이렉트를 재사용한다.
5. 인증·소유권·오류 경계 및 기존 저장 후 이동을 검증한다.
6. reviewer의 필수 지적을 반영하고 검증 결과를 기록한다.

## 건드릴 파일 (경로 / 레이어)

- `docs/plans/issue-008-cover-letter-dashboard.md` — 계획 보존.
- `src/lib/supabase/cover-letters.ts`, `cover-letters.test.ts` — DB 조회 어댑터와 소유권·집계·오류 테스트.
- `src/types/cover-letter.ts` — 생성 DB 타입에서 파생한 카드 조회 타입.
- `src/features/cover-letter/queries.ts`, `queries.test.ts` — 서버 인증·조회 경계.
- `src/features/cover-letter/components/CoverLetterDashboard.tsx`, `CoverLetterCard.tsx` — 목록·빈 상태·오류 UI.
- `src/config/cover-letter.ts`, `src/config/interview.ts` — 날짜 표시 설정과 면접 준비 경로.
- `src/app/dashboard/page.tsx` — feature 조립.

## 외부 의존·어댑터 / 스키마 변경

기존 서버 Supabase 클라이언트·사용자 세션·Publishable key를 사용한다. RLS와 함께 서버 소유권 필터를 적용한다. Secret key와 새 어댑터는 필요하지 않으며 스키마 변경은 없다. 자소서 본문과 경험은 조회하지 않는다.

## 리스크 · 열린 질문 · 승인 필요 지점

- 면접 준비 페이지 기능·수정·삭제·검색·면접 기록은 범위 밖이다.
- 날짜는 한국어와 한국 시간대를 명시해 서버 환경에 따른 차이를 막는다.
- 오류를 빈 목록으로 취급하지 않으며 원시 오류를 UI에 노출하지 않는다.
- 로컬 구현·검증·리뷰 후 커밋·푸시·PR 생성 승인을 받는다. 승인 후 계획 파일을 첫 커밋으로 보존한다.

## 검증 계획

- 어댑터의 소유권 필터, 최소 필드·문항 수 집계, 정렬, 빈 결과, DB 오류를 테스트한다.
- feature 조회의 미인증 차단·검증된 사용자 ID 사용·안전한 오류 반환을 테스트한다.
- 기존 저장 액션 테스트로 저장 후 대시보드 재검증과 이동을 확인한다.
- lint·typecheck·test·build를 실행한다.
- 데스크톱·모바일에서 카드 목록·긴 텍스트·빈 상태·오류 상태와 링크를 확인한다.
- 실제 Supabase 계정 격리·저장 후 반영을 확인하지 못하면 명시한다.

## (구현 후) 변경 메모 / 리뷰 반영

- 목록 조회는 `user_id` 필터에 더해 반환된 행의 소유권도 확인한다. 불일치가 있으면 전체 조회를 실패시켜 타인 카드 노출을 막는다.
- 날짜 표시 설정은 `config/cover-letter.ts`, 면접 준비 경로 생성은 `config/interview.ts`에 둔다. DB 생성 타입에서 카드 필드 타입을 파생했다.
- `npm run lint`, `npm run typecheck`, `npm run test`(87개), `npm run build` 통과.
- 임시 서버 렌더링 검증 3개 통과: 카드 정보·한국 날짜·HTML 이스케이프·준비 링크, 빈 상태·등록 링크, 오류 상태·재시도·내부 오류 비노출. 임시 검증 설정의 JSX 변환 문제를 고친 뒤 통과했으며 제품 코드 수정은 없었다.
- reviewer 결과: 이상 없음. must-fix·nice-to-have 지적 없음.
- 연결 가능한 브라우저가 없어 데스크톱·모바일 시각 검증은 미실행. 실제 Supabase 계정 간 격리 및 저장 직후 반영도 미실행이며, 소유권·저장 후 재검증/이동은 자동 테스트로 확인했다.
- 로컬 구현·검증·리뷰 완료. 사용자가 커밋·푸시·PR 생성을 승인했다.
