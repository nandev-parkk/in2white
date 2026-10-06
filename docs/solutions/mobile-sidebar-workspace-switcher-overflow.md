# 모바일 사이드바 워크스페이스 목록 가로 넘침

## 증상과 검색 키워드

모바일 서랍에서 워크스페이스 버튼을 누르면 선택 목록이 서랍 바깥으로 튀어나오거나 잘린다. 검색 키워드: mobile sidebar workspace popover overflow, drawer width, `w-68`.

## 근본 원인

워크스페이스 목록은 `w-68`(272px) 고정 폭을 사용했다. 모바일 서랍은 최대 240px이고 내부 여백도 있어 목록이 서랍보다 넓었다.

## 해결

`Sidebar`의 `mobileDrawer` 값을 `WorkspaceSwitcher`에 전달하고, 모바일 서랍일 때 목록 폭을 부모 기준 `w-full`로 설정한다. 데스크톱 목록은 기존 `w-68`을 유지한다.

관련 경로: `client/src/widgets/sidebar/ui/Sidebar.tsx`, `client/src/widgets/sidebar/ui/Sidebar.test.tsx`.

## 검증

- 회귀 테스트는 기존 고정 폭에서 실패하고 수정 후 통과했다.
- `pnpm --filter in2white-client exec vitest run src/widgets/sidebar/ui/Sidebar.test.tsx src/pages/shared/ui/AuthenticatedWorkspaceLayout.test.tsx` — 2개 파일, 49개 테스트 통과.
- 변경 파일 ESLint와 `pnpm --filter in2white-client build` — 통과.

## 적용 조건과 재발 방지

모바일 서랍 폭을 바꿀 때 내부 absolute popover도 부모 폭에 맞는지 함께 확인한다. 실제 모바일 브라우저 검증은 별도로 수행한다.
