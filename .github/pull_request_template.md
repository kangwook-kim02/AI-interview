<!-- PR 제목: <type>: <요약>  (type = feat|fix|docs|chore|design|refactor) -->

## 요약
<!-- 무엇을 왜 바꿨는지 1~3문장. -->

## 관련 이슈
Closes #

## 변경 사항
-
-

## 테스트 / 확인
<!-- 어떻게 검증했는지. 실행 결과·스크린샷 등. 못 한 건 솔직히 적기. -->
- [ ] `npm run lint` / `npm run build` 통과
- [ ] 로컬에서 동작 확인
- [ ] (UI면) 데스크톱/모바일 레이아웃 확인

## 체크리스트
- [ ] 레이어 규칙 준수 (`app → features → lib`, 외부 의존은 어댑터 뒤)
- [ ] 비밀 키 클라 노출 없음 (서버 전용 유지)
- [ ] 상수는 `config/`, 스키마 변경은 `supabase/migrations/`
- [ ] (UI면) `frontend-design` 스킬 준수 — 범용 디자인/복잡한 포털 룩 아님
- [ ] 이슈의 "완료 조건"을 모두 충족
