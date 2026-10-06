# 워크스페이스 레이아웃 React Hooks lint 오류

## 증상과 검색 키워드

커밋 전 ESLint hook이 `AuthenticatedWorkspaceLayout.tsx`에서 `react-hooks/preserve-manual-memoization` 2건과 `react-hooks/purity` 2건으로 중단된다. 검색 키워드: React Compiler, stable callback, `Date.now`, `MemberAddDialog`.

## 원인

`handleAccessLost`는 `MemberAddDialog`의 effect 의존성으로 사용되므로 identity를 안정적으로 유지해야 한다. React Compiler lint는 `refetch` 의존성을 이유로 기존 `useCallback`을 보존하지 못한다고 보고한다. 워크스페이스 변경·내비게이션 핸들러의 `Date.now()`는 실제 사용자 동작 때만 호출되지만, 이벤트 콜백으로 전달되는 함수 내부라 lint가 렌더 순수성 위반으로 보고한다.

## 해결

실제 동작 계약을 유지하도록 `handleAccessLost`의 memoization lint만 좁은 범위에서 비활성화하고, 사용자 이벤트에서 시간을 캡처하는 두 줄에만 순수성 lint 예외를 둔다. 각 예외에 필요한 이유를 코드 주석으로 남긴다.

관련 경로: `client/src/pages/shared/ui/AuthenticatedWorkspaceLayout.tsx`, `client/src/features/member/ui/MemberAddDialog.tsx`.

## 검증

- `pnpm --filter in2white-client exec eslint src/pages/shared/ui/AuthenticatedWorkspaceLayout.tsx` — 통과.
- `pnpm --filter in2white-client lint` — 통과.

## 적용 조건과 재발 방지

이 예외는 `MemberAddDialog`가 callback identity를 effect 의존성으로 사용하고, timestamp가 렌더가 아닌 사용자 이벤트에서 필요한 현재 계약에만 적용한다. 소비자 계약이 바뀌면 suppressions를 제거하고 lint를 다시 평가한다.
