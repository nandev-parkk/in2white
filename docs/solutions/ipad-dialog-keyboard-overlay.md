# iPad 모달과 키보드 겹침

## 증상과 검색 키워드

화이트보드·프로젝트 생성 모달에서 iPad 소프트 키보드가 바로 나타나지 않거나, 키보드가 열릴 때 모달이 필요 이상 위로 이동한다. 검색 키워드: iPad, virtual keyboard, Radix Dialog autofocus, `visualViewport`.

## 원인

공통 Dialog는 터치 환경에서 Radix의 입력란 자동 포커스를 막아, 생성 모달을 열어도 키보드가 나타나지 않았다. 또 키보드가 열리면 모달의 실제 겹침 여부와 관계없이 항상 상단으로 옮겼다.

## 해결

화이트보드·프로젝트 폼의 생성 모드는 열릴 때 이름 입력란에 직접 포커스한다. 공통 Dialog의 터치 포커스 기본 동작은 유지한다. 키보드가 열리면 모달을 기본 중앙 위치로 되돌려 실제로 Visual Viewport를 벗어날 때만 위쪽에 배치하고, 최대 높이는 현재 표시 영역에 맞춘다.

관련 경로: `packages/ui/src/ui/dialog.tsx`, `client/src/features/project/ui/ProjectFormDialog.tsx`, `client/src/features/whiteboard-document/ui/WhiteboardDocumentFormDialog.tsx`.

## 검증

- `pnpm --filter @in2white/ui build` — 통과
- `pnpm --filter in2white-client build` — 통과
- 변경한 TSX 파일 ESLint — 통과
- Prettier 정리 및 `git diff --check` — 통과
- 테스트와 실제 iPad 기기 검증은 수행하지 않았다.

## 적용 조건과 재발 방지

Visual Viewport가 제공되는 브라우저에서 키보드 표시 영역을 따라간다. 생성 폼의 터치 자동 포커스를 바꿀 때는 입력란을 직접 포커스하고, 키보드가 떠도 모달이 가려지지 않으면 위치를 유지하는지 확인한다.
