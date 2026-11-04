# Plan — Issue #4: 공통 디자인 토큰과 폰트를 설정한다

- 이슈: #4
- 브랜치: `design/4-design-tokens-fonts`
- 상태: planning
- 작성일: 2026-11-05

## 목표

따뜻한 라이트 테마의 토큰과 제목·본문 폰트를 공통 기반으로 제공한다. 버튼·입력·카드에 같은 토큰을 적용하고, 키보드 포커스·오류·비활성 상태와 작은 화면의 레이아웃을 확인한다. 완성 랜딩·인증 페이지와 도메인 로직은 제외한다.

## 단계별 계획

1. 기존 CSS 변수·Tailwind 설정·Pretendard 구성을 유지하면서 공통 토큰을 확장한다.
2. 배경·표면·본문·보조색·테두리·코랄 액션·파인 그린·상태색·포커스와 모서리·그림자·4px 간격·전환 시간을 정의하고 Tailwind에 매핑한다.
3. Gmarket Sans의 사용하는 굵기만 로컬 자산으로 추가하고 출처·라이선스를 기록한다. `next/font/local`로 제목용 CSS 변수를 연결하고, Pretendard 본문과 명시적 행간·fallback으로 로딩 중 레이아웃 변화를 줄인다.
4. 도메인과 무관한 `Button`, `Input`, `Card`를 추가한다. 네이티브 속성·ref·`className`을 전달하고 불필요한 라이브러리·클라이언트 경계를 추가하지 않는다.
   - 버튼: 기본/보조 액션, `type="button"` 기본값, 키보드 포커스, 네이티브 `disabled`, 긴 한국어 문구 줄바꿈.
   - 입력: `w-full`·`min-w-0`, 포커스, `aria-invalid`, `disabled`, 외부 label·설명·오류 연결을 위한 기본 속성 전달.
   - 카드: 표면·테두리·둥근 모서리·여백·부드러운 그림자. 비대화형 카드에 불필요한 tab stop이나 disabled 의미를 만들지 않는다.
5. 기존 스캐폴딩 제목에 display 폰트만 적용한다. 컴포넌트 사용 예와 오류 메시지 연결 방식은 짧은 문서로 남긴다.
6. 임시 로컬 확인 화면에서 상태·반응형·폰트 로딩을 검증하고, 확인 화면은 제품 라우트에 남기지 않는다. reviewer 리뷰 후 필수 지적을 반영한다.

## 건드릴 파일 (경로 / 레이어)

- `docs/plans/issue-004-design-tokens-fonts.md` — 계획 기록.
- `src/app/globals.css` — 전역 토큰과 기본 스타일.
- `tailwind.config.ts` — 토큰·타이포그래피 매핑.
- `src/app/layout.tsx` — 로컬 제목·본문 폰트 조립.
- `src/app/page.tsx` — 기존 제목의 폰트 적용만.
- `src/assets/fonts/GmarketSans*.woff2` — 필요한 제목 굵기.
- `src/assets/fonts/README.md`, `src/assets/fonts/GmarketSans-LICENSE.txt` — 출처·배포 조건.
- `src/components/ui/button.tsx`, `input.tsx`, `card.tsx` — 공용 UI 레이어.
- `docs/DESIGN_SYSTEM.md` — 토큰·컴포넌트 사용법과 접근성 결정.

## 외부 의존·어댑터 / 스키마 변경

LLM·음성·녹화·Supabase 어댑터와 DB 스키마 변경 없음. 폰트는 빌드 자산으로 자체 제공하며 런타임 외부 요청을 추가하지 않는다. 기본 요소에는 새 패키지가 필요하지 않다.

## 리스크 · 열린 질문 · 승인 필요 지점

- 스킬 예시의 밝은 코랄 `#FF7A59`와 흰 글자는 일반 크기 텍스트 AA 대비를 충족하지 않는다. 코랄 계열은 유지하되 흰 버튼 글자와 대비가 확보되는 더 어두운 액션 색을 사용하고 근거를 CSS·문서에 기록한다. 보조 텍스트·오류 텍스트도 배경 대비를 계산한다.
- Gmarket Sans의 공식 출처·재배포 조건과 지원 굵기를 확인한다. 존재하지 않는 굵기를 가변 폰트처럼 선언하지 않는다.
- 폰트 로딩 전후의 한글 줄바꿈과 제목 높이를 브라우저에서 비교한다.
- 커밋·푸시·PR 생성은 최종 사용자 승인 후 진행한다. 승인 후 계획 파일만 첫 커밋으로 기록하고 구현을 다음 커밋으로 분리한다.

## 검증 계획

- `npm run lint`, `npm run typecheck`, `npm run build`.
- 데스크톱과 320/375px 화면에서 긴 한국어 제목·버튼 문구·입력 값·카드 내용의 가로 넘침 확인.
- Tab 탐색으로 활성 버튼·입력의 포커스 확인, 비활성 요소의 탐색 제외 확인.
- 입력 오류에서 테두리와 설명 문구를 함께 사용하고 `aria-invalid`·`aria-describedby` 연결 확인.
- 로컬 폰트 응답·한국어 글리프·실제 적용 폰트 확인, 폰트 지연·차단 상태에서 콘텐츠와 레이아웃 확인.
- 액션·본문·보조·오류·포커스 색 대비 계산.
- 모션 사용 시 `prefers-reduced-motion` 대응 확인.
- 시각적 변경을 그대로 복제하는 단위 테스트는 추가하지 않는다.

## (구현 후) 변경 메모 / 리뷰 반영

- 구현·검증·reviewer 리뷰 완료. 2026-11-05 사용자에게 커밋·푸시·PR 생성 승인을 받았다.
- 제목 폰트는 전역 heading 기본 스타일에 적용했다. 따라서 `src/app/page.tsx`를 따로 수정할 필요가 없었다.
- 공식 사이트가 사용하는 원본 WOFF2 Medium/Bold를 로컬에 포함했다(약 815KiB). 변환·서브세팅 없이 제공하고 공식 TTF에 포함된 영문 라이선스를 별도 파일에 보존했다.
- 폰트는 preload와 `display: optional`을 사용한다. 느린 최초 요청에는 한글 fallback을 유지해 늦은 swap을 방지한다. 실제 렌더링 글꼴은 Gmarket Sans Bold/Medium과 Pretendard Variable로 확인했다.
- 임시 Playwright 확인 화면에서 긴 영숫자 버튼의 flex 내부 텍스트 넘침을 발견해 `overflow-wrap: anywhere`로 수정했다. 확인 라우트와 QA 패키지는 제품에 포함하지 않았다.
- 검증: `npm run lint`, `npm run typecheck`, `npm run build`, 기존 테스트 29개 모두 통과. 최종 빌드 라우트는 `/`, `/_not-found`뿐이다.
- 브라우저: Edge(Chromium)에서 1280/375/320px 가로 넘침 없음. Tab 순서·disabled 제외·오류 테두리와 포커스 동시 표시·모션 감소 대응 확인. axe WCAG A/AA 검사 위반 0건.
- 320px에서 폰트 1.8초 지연 및 차단 시 기존 화면의 요소 위치·크기가 유지됐다. 모든 로컬 폰트에 한글 완성형 11,172자가 포함됨을 확인했다.
- 대비: 흰 글자/코랄 4.90:1(hover 6.17:1), 그린/보조 표면 5.06:1. 본문·보조·오류·경고·성공 텍스트는 배경/표면 위 4.5:1 이상, 입력 경계·포커스는 3:1 이상이다.
- reviewer 결과: 이상 없음. must-fix·nice-to-have 지적 없음.
