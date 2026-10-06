# 모바일 입력 포커스 확대

## 증상과 검색 키워드

iPhone 등 모바일에서 입력란을 누르면 페이지가 자동 확대된다. 검색 키워드: iOS Safari input zoom, font-size 16px, mobile form controls.

## 원인

iOS Safari는 글꼴이 16 CSS px보다 작은 폼 컨트롤에 포커스할 때 가독성을 위해 페이지를 확대할 수 있다. 디자인 시스템의 `text-body` 크기가 이 기준보다 작을 수 있다.

## 해결

클라이언트 전역 스타일에서 639px 이하의 `input`, `textarea`, `select`에 16px 글꼴을 지정한다. viewport 배율을 제한하지 않아 사용자의 수동 확대는 허용한다.

관련 경로: `client/src/app/styles/index.css`.

## 검증

- 모바일 브라우저 실기기 검증은 수행하지 않았다.

## 적용 조건과 재발 방지

폼 컨트롤 글꼴은 모바일에서 최소 16px을 유지한다. viewport의 `maximum-scale=1` 등으로 사용자 확대를 막지 않는다.
