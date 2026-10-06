# 모바일 내비게이션과 입력 확대 방지 구현 계획

## 작업 항목

- [x] 화이트보드 카드가 이미 프로젝트 카드와 같은 전체 영역 클릭 링크를 제공하는지 확인한다.
- [x] 640px 미만에서 사이드바를 햄버거 버튼이 여는 모달 서랍으로 이동하고 메뉴 이동 후 닫는다.
- [x] 모바일 폼 컨트롤에 최소 16px 글꼴을 적용한다.
- [x] 관련 테스트와 클라이언트 검증을 수행한다.

## 실제 변경

- `AuthenticatedWorkspaceLayout`에서 모바일 사이드바를 숨기고 `Dialog` 서랍과 메뉴 버튼을 추가했다. 데스크톱 사이드바는 기존 접기·크기 조절을 유지한다.
- `Sidebar`의 모바일 서랍 모드에서는 접기·크기 조절 컨트롤을 숨기고 별도의 닫기 버튼을 표시한다.
- 내비게이션 선택, 워크스페이스 전환, 계정 이동, 로그아웃에서 모바일 서랍 상태를 닫는다. 워크스페이스 생성·초대 대화상자는 기존 상태 흐름을 유지한다.
- 앱 전역 CSS에서 639px 이하의 `input`, `textarea`, `select` 글꼴 크기를 16px로 지정했다.
- 화이트보드 카드와 그리드 호출부는 이미 전체 클릭 링크와 메뉴 우선 순위를 구현하므로 수정하지 않았다.

## 계획과 달라진 점

- 화이트보드 카드 코드를 변경하지 않았다. `WhiteboardCard`의 전체 영역 링크와 `WhiteboardDocumentListContent`의 `onOpen` 전달이 이미 연결돼 있었다.

## 검증 결과

- `pnpm --filter in2white-client exec vitest run src/pages/shared/ui/AuthenticatedWorkspaceLayout.test.tsx src/widgets/sidebar/ui/Sidebar.test.tsx src/shared/ui/whiteboard-card.test.tsx` — 3개 파일, 55개 테스트 통과.
- `pnpm --filter in2white-client build` — 통과.
- `pnpm --filter in2white-client lint` — 기존 `react-hooks/preserve-manual-memoization` 2건과 `react-hooks/purity` (`Date.now()`) 2건을 계약 설명과 함께 필요한 범위에서 억제한 뒤 통과.
- `pnpm --filter in2white-client exec prettier --write ...`와 `git diff --check` — 통과.
- 실제 모바일 브라우저·기기에서는 확인하지 않았다.

## 후속 작업

- 모바일 브라우저와 실제 iOS 기기에서 서랍 조작과 입력 포커스 확대 여부를 확인한다.
