# 프로젝트·화이트보드 카드 전체 영역 탐색

## 증상과 검색 키워드

프로젝트와 화이트보드 카드에서 제목만 눌러야 상세 화면으로 이동한다. 검색 키워드: project card, whiteboard card, stretched link, dropdown menu.

## 원인

카드 제목 버튼에만 `onOpen` 동작이 연결되어 나머지 카드 영역은 탐색 동작을 하지 않았다.

## 해결

제목 버튼의 가상 요소를 카드 전체로 늘려 동일한 탐색 동작을 제공한다. 카드 메뉴를 더 높은 쌓임 순서로 올려 메뉴 조작을 유지한다.

관련 경로: `client/src/features/project/ui/ProjectCard.tsx`, `client/src/shared/ui/whiteboard-card.tsx`.

## 검증

- 프로젝트·화이트보드 카드 회귀 테스트 — 통과
- 클라이언트 lint·build 및 변경 파일 Prettier 검사 — 통과
- 실제 브라우저에서 빈 영역 클릭과 메뉴 조작을 확인하지 않았다.

## 적용 조건과 재발 방지

카드가 탐색 동작을 제공할 때 제목 버튼의 클릭 영역을 카드 전체로 늘린다. 메뉴처럼 별도 동작을 하는 요소는 탐색 버튼 위에 유지하고 개별 조작 테스트를 둔다.
