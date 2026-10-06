# iPad 모달과 키보드 겹침

## 증상과 검색 키워드

화이트보드·프로젝트 생성 모달을 열자마자 iPad 소프트 키보드가 나타나거나, 키보드가 열린 뒤 모달 일부가 가려진다. 검색 키워드: iPad, virtual keyboard, Radix Dialog autofocus, `visualViewport`.

## 원인

터치 환경에서 Radix Dialog가 첫 입력란에 자동 포커스해 키보드를 열었다. 초기 위치 보정 효과는 Dialog가 닫혀 있을 때 실행되어 Portal 안의 모달 요소를 찾지 못하고 종료했다. 모달이 열린 뒤에는 효과가 다시 실행되지 않아 키보드가 차지한 Visual Viewport를 반영하지 못했다.

## 해결

터치 환경에서는 자동 포커스를 막고 모달 컨테이너에 포커스한다. 데스크톱은 기존 입력란 자동 포커스를 유지한다. 모달 요소가 실제로 마운트된 뒤 Visual Viewport와 창 이벤트를 구독하고, 키보드가 표시되면 위쪽에 배치하며 최대 높이를 현재 표시 영역에 맞춘다.

관련 경로: `packages/ui/src/ui/dialog.tsx`.

## 검증

- `pnpm --filter @in2white/ui exec vitest run src/ui/dialog.test.tsx` — 통과
- UI 패키지 lint·build 및 변경 파일 Prettier 검사 — 통과
- 실제 iPad 기기에서 재확인하지 않았다.

## 적용 조건과 재발 방지

Visual Viewport가 제공되는 브라우저에서 키보드 표시 영역을 따라간다. 공통 모달의 자동 포커스나 위치 계산을 바꿀 때는 포털 요소가 마운트된 뒤 효과가 연결되는지, 터치와 데스크톱 포커스 동작이 모두 유지되는지 확인한다.
