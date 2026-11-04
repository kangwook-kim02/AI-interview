# 로컬 폰트

## Pretendard (본문/UI)

- 버전: v1.3.9
- 원본: https://github.com/orioncactus/pretendard
- 배포 파일: https://raw.githubusercontent.com/orioncactus/pretendard/v1.3.9/packages/pretendard/dist/web/variable/woff2/PretendardVariable.woff2
- 라이선스: SIL Open Font License 1.1 (`OFL.txt`)

변경하지 않은 가변 폰트 배포본을 `next/font/local`로 제공한다.

## Gmarket Sans (제목)

- 공식 소개·배포: https://corp.gmarket.com/fonts/
- 공식 웹사이트의 CSS: https://script.gmarket.co.kr/pc/css/application/kr/company/app.css
- Medium (500): https://script.gmarket.com/fonts/GmarketSansMedium.woff2
- Bold (700): https://script.gmarket.com/fonts/GmarketSansBold.woff2
- 라이선스: SIL Open Font License 1.1 (`GmarketSans-LICENSE.txt`). 공식 TTF의 영문 라이선스 메타데이터를 그대로 추출했다.

2026-11-05 내려받은 공식 WOFF2 배포본을 변환·서브세팅 없이 포함했다. 두 파일 모두 한글 11,172자와 영문·숫자를 제공한다. 실제 제공되는 500/700 굵기만 등록한다.

모두 `next/font/local`로 자체 제공한다. preload와 `display: optional`을 사용해 최초 로딩이 느리면 한글 시스템 fallback을 유지하고 늦은 폰트 교체로 생기는 줄바꿈 변화를 방지한다. 다음 방문에는 캐시된 폰트를 사용한다. fallback은 `Malgun Gothic`, `Apple SD Gothic Neo`, `sans-serif` 순서이며 제목은 Pretendard를 먼저 시도한다. 영문 전용 Arial 자동 fallback은 비활성화한다.
