# iPad 모달·카드 탐색·화이트보드 캔버스 구현 계획

설계: [iPad 모달·카드 탐색·화이트보드 캔버스 설계](../specs/2026-10-06-ipad-dialog-cards-canvas-design.md)

## 목표

iPad에서 모달과 Excalidraw 캔버스가 소프트 키보드에 가려지거나 깨지는 문제를 해결하고 카드 전체에서 상세 화면으로 이동하게 한다.

## 구현 순서

1. 모달 포커스·키보드 표시 영역, 카드 전체 탐색, 캔버스 갱신의 회귀 테스트를 추가한다.
2. 공통 Dialog가 Portal 요소가 마운트된 뒤 Viewport 이벤트를 구독하도록 수정한다. 터치 환경만 자동 포커스를 막고 데스크톱 동작을 유지한다.
3. 카드 제목 버튼의 클릭 영역을 카드 전체로 확장하고 메뉴를 위에 둔다.
4. Visual Viewport·창 이벤트에서 캔버스 높이와 Excalidraw 레이아웃을 갱신한다.
5. 관련 테스트, lint, build, 포맷, diff 검사를 실행하고 해결 문서를 갱신한다.

## 구현 결과

- Dialog의 ref가 실제 Portal 콘텐츠를 가리킨 뒤 위치 보정 효과를 연결한다. 키보드 표시 중 모달을 위쪽에 배치하고 표시 높이에 맞춰 최대 높이를 바꾼다.
- 초기 포커스는 터치 기기에서만 모달로 옮겨 소프트 키보드 자동 표시를 막는다. 데스크톱 입력 포커스는 유지한다.
- 프로젝트·화이트보드 카드의 제목 버튼을 카드 크기의 가상 영역으로 늘리고 메뉴를 상위 쌓임 순서에 둔다.
- 캔버스 루트 높이를 Visual Viewport에 맞추고 이벤트마다 `api.refresh()`를 예약한다.
- 모달, 프로젝트 카드, 화이트보드 카드, 캔버스의 4개 테스트 파일에 회귀 검증을 추가했다.

## 계획과의 차이

초기 모달 효과는 Dialog가 닫혀 Portal 콘텐츠가 아직 없을 때 실행되어 위치 보정 구독을 놓쳤다. ref callback이 실제 요소를 받은 뒤 효과를 실행하도록 변경했다. 회귀 테스트 과정에서 자동 포커스를 모든 기기에서 차단하는 변경도 확인해 터치 기기로 제한했다.

## 검증

- 기준 구현에서 모달 위치, 카드 영역, 캔버스 갱신 회귀 테스트가 의도한 이유로 실패하는 것을 확인했다.
- `pnpm --filter @in2white/ui exec vitest run src/ui/dialog.test.tsx` — 4개 테스트 통과
- `pnpm --filter in2white-client exec vitest run src/features/project/ui/ProjectCard.test.tsx src/shared/ui/whiteboard-card.test.tsx src/features/whiteboard-editor/ui/WhiteboardCanvas.test.tsx` — 3개 파일, 16개 테스트 통과
- UI·클라이언트 `lint`와 `build` — 통과
- 변경 TS/TSX와 문서 Prettier 검사, `git diff --check` — 통과
- 실제 iPad 재확인은 아직 하지 않았다.

## 후속 작업

실제 iPad Safari에서 모달 입력·제출 버튼, 카드 메뉴 클릭, 키보드 닫힌 뒤 Excalidraw 렌더링을 확인한다.

## 2026-10-07 프로젝트 생성 모달 위치 재수정

- 실제 변경: 자동 포커스 직후와 키보드 애니메이션 중 터치 입력에 포커스된 모달 위치를 유지한다. Visual Viewport와 window 높이 변화로 키보드 열림을 확인하고, 실제로 영역을 벗어날 때만 이동한다. 키보드가 닫히면 중앙으로 복귀한다.
- 계획과의 차이: 기존 계획에는 포커스 직후 위치 보존과 키보드 애니메이션 중 중앙 재정렬 방지가 없었다. 공통 Dialog에서 보정했다.
- 검증: `pnpm --filter @in2white/ui test` (19개 파일, 50개 테스트 통과), `pnpm --filter @in2white/ui build`, `pnpm --filter @in2white/ui lint`, `pnpm --filter in2white-client build`, Prettier와 `git diff --check` 통과.
- 후속: 실제 iPad/태블릿에서 프로젝트 생성 시 키보드를 열고, 모달이 가려지는 경우와 공간이 남는 경우를 각각 확인한다.
