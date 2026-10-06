# iPad Excalidraw 화면 갱신

## 증상과 검색 키워드

iPad에서 Excalidraw 텍스트 입력을 마친 뒤 캔버스 화면이 깨져 보이고, 화면을 조금 움직이면 정상으로 돌아온다. 검색 키워드: iPad, Excalidraw, virtual keyboard, `visualViewport`, `api.refresh`.

## 원인

iPad 소프트 키보드는 Visual Viewport 높이를 바꾼다. 키보드가 닫힐 때 캔버스 루트와 Excalidraw가 컨테이너 크기를 바로 다시 계산하지 않아 이전 화면 상태가 남을 수 있다. 페이지를 움직이면 뒤늦게 영역을 다시 측정한다.

## 해결

Visual Viewport와 창 크기·스크롤 이벤트에서 캔버스 루트 높이를 현재 표시 높이로 맞춘다. 같은 애니메이션 프레임에 Excalidraw `api.refresh()`를 호출해 캔버스 레이아웃을 다시 읽게 한다.

관련 경로: `client/src/features/whiteboard-editor/ui/WhiteboardCanvas.tsx`.

## 검증

- `pnpm --filter in2white-client exec vitest run src/features/whiteboard-editor/ui/WhiteboardCanvas.test.tsx` — 통과
- 클라이언트 lint·build 및 변경 파일 Prettier 검사 — 통과
- 실제 iPad 기기에서 재확인하지 않았다.

## 적용 조건과 재발 방지

Visual Viewport가 없으면 창 높이를 사용한다. Excalidraw 초기화 전에는 API 갱신을 건너뛴다. 모바일 키보드 표시 여부에 따라 캔버스 컨테이너 크기가 바뀌는 경우 창·Visual Viewport 이벤트 후 편집기 레이아웃을 다시 계산한다.
