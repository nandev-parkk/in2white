# iPad 모달과 키보드 겹침

## 증상과 검색 키워드

화이트보드·프로젝트 생성 모달을 열자마자 iPad 소프트 키보드가 나타나고, 키보드가 모달 일부를 가린다. 검색 키워드: iPad, virtual keyboard, Radix Dialog autofocus, `visualViewport`.

## 원인

공통 `DialogContent`가 Radix Dialog의 기본 초기 포커스 동작을 사용해 첫 번째 입력란에 포커스를 줬다. iPad는 포커스된 입력란을 위해 소프트 키보드를 열었다. 모달은 `100dvh`와 화면 중앙 위치만 사용해, 키보드가 열린 뒤 줄어든 Visual Viewport의 높이와 오프셋을 반영하지 않았다.

## 해결

터치 입력이 가능한 환경에서는 초기 포커스를 입력란 대신 모달 컨테이너에 둔다. `visualViewport`의 `resize`와 `scroll` 이벤트에 맞춰 모달의 중심과 최대 높이를 갱신하고, 내용이 넘치면 모달 내부에서 스크롤한다.

관련 경로: `packages/ui/src/ui/dialog.tsx`.

## 검증

- `pnpm --filter @in2white/ui lint` — 통과
- `pnpm --filter @in2white/ui build` — 통과
- `pnpm --filter @in2white/ui exec prettier --check src/ui/dialog.tsx` — 통과
- `git diff --check` — 통과
- 자동 테스트와 실제 iPad 기기 확인은 실행하지 않았다.

## 적용 조건과 재발 방지

최신 Safari처럼 `VisualViewport`를 제공하는 터치 브라우저에서 키보드 표시 영역을 따라간다. `VisualViewport`가 없는 브라우저는 `100dvh`와 기본 중앙 정렬을 사용한다. 공통 모달의 자동 포커스나 위치 계산을 바꿀 때는 소프트 키보드 표시 중 입력란과 하단 버튼이 모두 접근 가능한지 확인한다.
