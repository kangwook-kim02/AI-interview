# 공통 스타일 사용법

따뜻한 페이퍼 배경, 밝은 표면, 코랄 핵심 액션과 파인 그린 보조 액션을 사용한다.
토큰의 원본은 `src/app/globals.css`의 `:root`, Tailwind 매핑은 `tailwind.config.ts`다.
컴포넌트에는 hex 값을 넣지 않고 아래 클래스를 사용한다.

| 용도 | Tailwind 클래스 |
| --- | --- |
| 배경 / 카드 표면 | `bg-background` / `bg-surface` |
| 본문 / 보조 텍스트 | `text-foreground` / `text-muted` |
| 장식 테두리 / 입력 테두리 | `border-line` / `border-control-border` |
| 핵심 액션 | `bg-primary text-primary-foreground`, `hover:bg-primary-hover` |
| 보조 액션 / 링크 | `bg-accent-soft text-accent` / `text-accent` |
| 상태 텍스트 | `text-success` / `text-warning` / `text-danger` |
| 비활성 | `bg-disabled text-disabled-foreground` |
| 모서리 | `rounded-sm` (입력), `rounded-md` (카드), `rounded-lg` (패널), `rounded-pill` (버튼) |
| 그림자 | `shadow-sm` / `shadow-md` |
| 본문 / 제목 / 숫자 | `font-sans` / `font-display` / `tabular-nums` |
| 전환 | `transition-colors duration-ui ease-ui motion-reduce:transition-none` |

RGB 채널 토큰으로 `bg-primary/10` 같은 Tailwind 투명도 문법을 지원한다.
간격은 Tailwind 기본 4px 그리드를 사용하며 자주 쓰는 `1/2/3/4/6/8/12/16`을 CSS 변수에도 노출한다.
본문은 16px/1.6, 제목은 Gmarket Sans 500/700과 1.25 행간을 기본으로 한다. 루트 레이아웃에서 로컬 폰트를 제공하며 로딩 방식·출처는 [폰트 문서](../src/assets/fonts/README.md)에 기록한다.

## 기본 요소

React 네이티브 속성(`ref`, 이벤트, `aria-*`, `disabled` 등)을 그대로 전달한다. 클라이언트 이벤트를 쓰는 폼은 호출하는 쪽에서 `'use client'`를 선언한다. `className`은 폭·배치·간격을 추가하는 데 사용한다.

```tsx
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

<Card>
  <h2 className="text-2xl font-medium">지원 정보</h2>
  <form className="mt-6 space-y-6">
    <div className="space-y-2">
      <label htmlFor="company" className="block font-semibold">회사명</label>
      <Input
        id="company"
        name="company"
        autoComplete="organization"
        aria-invalid={true}
        aria-describedby="company-error"
      />
      <p id="company-error" className="text-sm text-danger">
        회사명을 입력해 주세요.
      </p>
    </div>
    <Button type="submit" className="w-full sm:w-auto">저장하기</Button>
  </form>
</Card>
```

`Button`은 `primary`(기본)·`secondary` 변형을 제공한다. 기본 `type`은 `button`이므로 제출 버튼에는 `type="submit"`을 지정한다. 긴 문구는 줄바꿈되며 48px 이상의 높이를 유지한다. 페이지 이동은 네이티브 링크/Next Link로 표현한다.

`Input`은 텍스트 입력 계열의 기본 요소다. 접근 가능한 label은 호출부에서 제공한다. 오류는 `aria-invalid={true}`와 `aria-describedby`로 연결한 설명을 함께 제공한다. 색만으로 오류를 전달하지 않는다. 네이티브 `disabled`로 키보드 탐색에서 제외한다. `Card`는 비대화형 컨테이너로, 자체 포커스·오류·비활성 상태를 만들지 않는다.

기본 요소와 링크는 키보드 `:focus-visible`에서 파인 그린 외곽선을 표시한다. 입력 오류 테두리는 포커스 중에도 유지되어 포커스와 오류를 동시에 볼 수 있다. 모션 감소 환경에서는 기본 요소의 전환을 끈다.

## 대비 결정

디자인 스킬의 AA 대비 규칙을 지키기 위해 예시 색 중 일부를 조정했다. 따뜻한 팔레트와 라이트 테마는 유지한다.

- 밝은 코랄 `#FF7A59` 대신 흰 글자용 액션 코랄 `#C4472B`(hover `#AC3B22`)를 사용한다. 밝은 코랄은 흰 글자와 일반 텍스트 AA 기준을 충족하지 않는다.
- 보조 텍스트는 기존의 짙은 회갈색 `#756A61`을 유지한다.
- `line`은 카드의 장식 테두리용이다. 입력 경계에는 더 짙은 `control-border`를 써서 표면과 3:1 이상의 대비를 확보한다.
- 성공·경고·오류 색도 배경·표면 위의 일반 텍스트에 사용할 수 있는 짙은 톤이다. 실제 오류 내용과 상태 설명은 호출부에서 제공한다.

전체 랜딩·인증 페이지, 전용 폼 라이브러리, 테마 전환은 이 공통 기반의 범위에 포함하지 않는다.
