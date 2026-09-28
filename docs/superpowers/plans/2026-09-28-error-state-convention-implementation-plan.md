# 에러 상태 화면 컨벤션 구현 계획

Refs: #82
설계: `docs/superpowers/specs/2026-09-28-error-state-convention-design.md`

## 목표

로딩 실패 화면 7곳을 공용 `ErrorState` 컴포넌트로 통일한다. 아이콘·제목·설명·재시도 액션 구조와 `role="alert"`를 모든 실패 화면이 공유한다.

## 작업 단계

### 1. `ErrorState` 컴포넌트 (TDD)

1. `shared/ui/error-state.test.tsx`를 먼저 작성해 실패를 확인한다.
   - 기본 아이콘이 `CircleAlert`이고 `text-status-danger`가 적용된다.
   - 루트에 `role="alert"`가 있다.
   - `title`, `description`, `action`이 렌더된다.
   - `icon`을 넘기면 기본 아이콘을 대체한다.
   - `size="compact"`면 `data-slot="compact-empty-state"` 레이아웃을 쓴다.
2. `shared/ui/error-state.tsx`를 구현한다.
   - `EmptyState`/`CompactEmptyState`를 감싸고 `size`에 따라 아이콘 크기를 `size-8`/`size-5`로 고정한다.
   - props: `title`, `description`(기본 `잠시 후 다시 시도해보세요`), `action`, `icon`, `size`, `className`.
3. `shared/ui/error-state.stories.tsx`에 default/compact/커스텀 아이콘 스토리를 추가한다.

### 2. 목록 영역 에러 교체

4. `features/member/ui/MemberListContent.tsx`를 `ErrorState`로 옮긴다. 같은 화면의 빈 상태 아이콘도 `size-8`로 맞춘다.
5. `features/project/ui/ProjectListContent.tsx` 에러 블록을 `ErrorState`로 교체한다. `className="min-h-48"`로 현재 최소 높이를 유지한다.
6. `features/whiteboard-document/ui/WhiteboardDocumentListContent.tsx`도 같게 교체한다.
7. `pages/project-detail/ui/ProjectDetailPage.tsx`의 로딩 실패 블록을 교체한다. `min-h-48 flex-1`을 유지하고 404 `EmptyState`는 그대로 둔다.

각 단계마다 해당 파일의 기존 테스트를 먼저 갱신해 실패를 확인한 뒤 구현한다. 재시도 버튼이 `setLoadingStartedAt` 재설정과 `refetch`를 호출하는 계약을 유지한다.

### 3. 전체 화면 에러 교체

8. `pages/shared/ui/AuthenticatedWorkspaceLayout.tsx`의 `isError` 분기를 `<main className="... min-h-svh ...">` + `ErrorState`로 바꾼다.
9. `pages/whiteboard-editor/ui/WhiteboardEditorPage.tsx`를 두 분기로 나눈다.
   - 404: `EmptyState` + `FileX` + `프로젝트로 돌아가기`
   - 로딩 실패: `ErrorState` + `다시 시도` + `프로젝트로 돌아가기`
   - 버튼 2개는 `action` 슬롯에 `flex gap-2`로 넣는다.

### 4. 패널 내부 에러 교체

10. `pages/account/ui/AccountPage.tsx`의 워크스페이스 로딩 실패를 `ErrorState size="compact"`로 바꾼다. 기존 `role="alert"`는 컴포넌트가 제공하므로 중복 지정을 제거한다.

### 5. 검증

11. `pnpm test`로 전체 테스트를 실행한다.
12. `pnpm lint`, `pnpm build`를 실행한다.
13. 브라우저에서 워크스페이스 로딩 실패, 프로젝트 목록 실패, 계정 패널 실패를 확인한다.

## 주요 동작

- 모든 실패 화면: 위험색 `CircleAlert` 아이콘 + 제목 + 설명 + 다시 시도 액션, 루트 `role="alert"`.
- 404/부재 상태는 도메인 아이콘의 `EmptyState`로 남아 실패와 구분된다.

## 변경 범위

- 신규 3개: `shared/ui/error-state.tsx`, `error-state.test.tsx`, `error-state.stories.tsx`
- 수정 7개 화면 + 해당 테스트 파일

## 권한·오류 계약

- 권한 판정 함수(`isMemberAccessLost`, `isProjectNotFound`)와 404 분기 조건은 바꾸지 않는다.
- 서버 원문 오류를 화면에 노출하지 않는다.

## 검증 계획

- `ErrorState` 단위 테스트 5건
- 7개 화면 에러 상태 회귀 테스트 갱신
- `pnpm test` / `pnpm lint` / `pnpm build`
- 브라우저 확인 3개 화면

## Implementation Results

### 실제 변경 내용

신규 파일 3개

- `frontend/src/shared/ui/error-state.tsx`: `ErrorState` 추가. `size="default"`는 `EmptyState`, `size="compact"`는 `CompactEmptyState`를 감싼다. 기본 아이콘은 `CircleAlert` + `text-status-danger`이고 크기는 `default` `size-8`, `compact` `size-5`. `description` 기본값은 `잠시 후 다시 시도해보세요`이며 루트에 `role="alert"`를 부여한다.
- `frontend/src/shared/ui/error-state.test.tsx`: 단위 테스트 5건(기본 아이콘·위험색, `role="alert"`, 제목·설명·액션 렌더, 커스텀 아이콘 대체, `compact` 레이아웃).
- `frontend/src/shared/ui/error-state.stories.tsx`: `Default` / `Compact` / `CustomIcon` 스토리.

수정 파일 14개 (구현 7 + 테스트 7)

- `features/member/ui/MemberListContent.tsx`: 에러 `EmptyState` → `ErrorState`. 같은 화면 빈 상태 아이콘을 `size-6` → `size-8`로 맞췄고 사용하지 않게 된 `CircleAlert` import 제거.
- `features/project/ui/ProjectListContent.tsx`: 평문 `<p>` + 버튼 블록 → `ErrorState className="min-h-48"`.
- `features/whiteboard-document/ui/WhiteboardDocumentListContent.tsx`: 동일하게 `ErrorState className="min-h-48"`.
- `pages/project-detail/ui/ProjectDetailPage.tsx`: 로딩 실패 블록만 `ErrorState className="min-h-48 flex-1"`로 교체. 404 `EmptyState` + `FolderX`는 그대로 유지.
- `pages/shared/ui/AuthenticatedWorkspaceLayout.tsx`: `<main className="bg-background-default flex min-h-svh items-center justify-center">` 안에 `ErrorState className="w-full max-w-90"`를 둬 `WorkspaceAccessDeniedPage` 구조와 맞췄다.
- `pages/whiteboard-editor/ui/WhiteboardEditorPage.tsx`: 404와 로딩 실패를 분기했다. 404는 `EmptyState` + `FileX` + `프로젝트로 돌아가기`, 로딩 실패는 `ErrorState` + `action`에 `<div className="flex gap-2">`로 `다시 시도`·`프로젝트로 돌아가기`.
- `pages/account/ui/AccountPage.tsx`: 좌우 배치 `text-[12px]` 블록 → `ErrorState size="compact"`. 래퍼의 중복 `role="alert"` 제거.
- 테스트 갱신: `MemberListContent.test.tsx`, `ProjectListContent.test.tsx`, `WhiteboardDocumentListContent.test.tsx`, `ProjectDetailPage.test.tsx`, `HomePage.test.tsx`(`AuthenticatedWorkspaceLayout` 에러 분기 커버), `WhiteboardEditorPage.test.tsx`, `AccountPage.test.tsx`. 모두 `role="alert"` 루트·제목·설명·위험색 아이콘 크기를 검증하도록 바꾸고 기존 `refetch`·`setLoadingStartedAt`/`setStartedAt` 재설정 계약은 유지했다.

### 계획과 달라진 점

- `ErrorState`에 자체 `data-slot`을 넣지 않았다. `EmptyState`/`CompactEmptyState`의 `{...props}`가 `data-slot`을 덮어쓰기 때문에, `size="compact"`에서 `data-slot="compact-empty-state"` 레이아웃을 확인하는 계약을 지키려면 하위 슬롯 값을 보존해야 했다.
- `CompactEmptyState`에는 `action` 슬롯이 없다. `CompactEmptyState`를 수정하지 않기 위해 `compact` 분기만 `role="alert"`를 가진 래퍼 `div`로 감싸고 그 안에 `CompactEmptyState`와 액션을 배치했다. `default` 분기는 `EmptyState`의 `action` 슬롯을 그대로 쓴다.
- `ErrorStateProps.title` 타입을 `React.ReactNode`가 아니라 `string`으로 확정했다. `EmptyState`의 props가 `React.ComponentProps<'div'>`와 교차하면서 `title`이 `string & ReactNode`로 좁혀져 `tsc`가 TS2322로 실패했다. 7개 호출부 모두 평문 문자열이라 영향이 없다.
- `WhiteboardEditorPage`의 404에는 설명 문구 `삭제되었거나 접근할 수 없는 화이트보드예요`를 새로 넣었다. `EmptyState`의 `description`이 필수 prop이고, `ProjectDetailPage`의 404 문구와 결을 맞췄다. 제목 문구는 기존 그대로다.
- 브라우저 육안 확인 3개 화면은 실행하지 않았다. 자동 테스트로만 검증했다.

### 실행한 검증 명령과 결과

`<worktree>/frontend`에서 실행했다.

| 명령 | 결과 |
| --- | --- |
| `pnpm test` | 통과(exit 0). Test Files 77 passed (77), Tests 417 passed (417). 변경 전 기준 76파일·412건에서 `error-state.test.tsx` 5건이 늘었다. |
| `pnpm lint` | 통과(exit 0). 0 errors, 4 warnings. 경고는 `badge.tsx`·`button.tsx`·`input.tsx`·`toast.tsx`의 기존 `react-refresh/only-export-components`로 이번 변경과 무관하다. |
| `pnpm build` | 통과(exit 0). `vite build` + `tsc -b` 모두 성공. 최초 실행에서 잡힌 TS2322는 위 `title` 타입 수정으로 해소했다. |
| `npx prettier --check <변경 파일 전체>` | 통과(exit 0). |

`pnpm format:check`는 저장소 전체에서 8개 파일을 경고하며 실패하지만, 모두 이번 작업에서 건드리지 않은 기존 파일(`entities/workspace/api/workspace.test.ts`, `features/workspace/model/use-workspaces.test.tsx`, `features/workspace/model/use-workspaces.ts`, `features/workspace/ui/WorkspaceSettingsContent.test.tsx`, `pages/shared/ui/AuthenticatedWorkspaceLayout.test.tsx`, `pages/workspace-settings/ui/WorkspaceSettingsPage.test.tsx`, `routes/workspaces/$workspaceId/projects.test.tsx`, `routes/workspaces/$workspaceId/settings.test.tsx`)이다. 선행 문제이며 이번 변경 범위 밖으로 두었다.

### 남은 후속 작업

- 브라우저에서 워크스페이스 로딩 실패, 프로젝트 목록 실패, 계정 패널 실패 화면을 육안으로 확인한다.
- 에러 문구 상수화는 #83에서 처리한다. 현재 7곳이 문자열 리터럴을 그대로 갖고 있다.
- `CompactEmptyState`에 `action` 슬롯을 추가하면 `ErrorState`의 `compact` 분기에서 래퍼 `div`를 없앨 수 있다. 별도 정리 작업으로 남긴다.
- 저장소 전체 `pnpm format:check` 실패(기존 8개 파일)를 별도로 정리한다.
- `WorkspaceAccessDeniedPage`는 `<h1>`을, `EmptyState`/`ErrorState`는 `<p className="text-heading1">`을 쓴다. 전체 화면 상태의 제목 요소 통일은 후속 과제다.
