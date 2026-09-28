# 에러 상태 화면 컨벤션 설계

Refs: #82

## 목표

데이터 로딩 실패 화면의 표현을 하나의 컨벤션으로 통일한다. 현재 `MemberListContent`만 아이콘·제목·설명·재시도 액션을 갖춘 형태이고, 나머지 6곳은 아이콘 없는 평문 한 줄과 버튼만 보여준다. 사용자가 실패 화면을 어디서 만나도 같은 형태를 보게 한다.

## 현재 상태

| 위치 | 현재 표현 |
| --- | --- |
| `pages/shared/ui/AuthenticatedWorkspaceLayout.tsx:184` | 전체 화면, 평문 `<p>` + 다시 시도 |
| `features/project/ui/ProjectListContent.tsx:209` | 목록 영역, 평문 `<p>` + 다시 시도 |
| `features/whiteboard-document/ui/WhiteboardDocumentListContent.tsx:211` | 목록 영역, 평문 `<p>` + 다시 시도 |
| `pages/project-detail/ui/ProjectDetailPage.tsx:164` | 목록 영역, 평문 `<p>` + 다시 시도 |
| `pages/whiteboard-editor/ui/WhiteboardEditorPage.tsx:74` | 전체 화면, 평문 `<h1>` + 버튼 2개, 404도 같은 마크업 |
| `pages/account/ui/AccountPage.tsx:193` | 패널 안, 좌우 배치 `text-[12px]` 위험색 + 버튼 |
| `features/member/ui/MemberListContent.tsx:159` | `EmptyState` + `CircleAlert`(위험색) + 설명 + 다시 시도 |

## 확정된 동작

- `shared/ui/error-state.tsx`에 `ErrorState`를 추가한다. 기존 `EmptyState`·`CompactEmptyState` 위에 얹어 아이콘과 색을 고정하고, 제목·설명·액션 슬롯을 받는다.
  - 아이콘 기본값은 `CircleAlert`이며 `text-status-danger`로 고정한다. 호출부가 아이콘을 넘기면 대체할 수 있다.
  - `size` prop으로 `default`(전체 화면·목록 영역)와 `compact`(패널 내부)를 고른다. `compact`는 `CompactEmptyState` 레이아웃을 쓴다.
  - 루트에 `role="alert"`를 부여해 실패를 보조기술에 즉시 알린다. 기존 `AccountPage`의 `role="alert"` 계약을 유지·확장한다.
- 위 7곳을 모두 `ErrorState`로 교체한다. 제목 문구는 현재 문구를 그대로 쓰고, 설명이 없던 곳에는 `잠시 후 다시 시도해보세요`를 넣는다.
- 전체 화면 에러는 페이지가 `<main className="... min-h-svh ...">` 래퍼를 유지하고 그 안에 `ErrorState`를 둔다. `WorkspaceAccessDeniedPage`의 기존 구조와 같은 방식이다.
- `WhiteboardEditorPage`의 404(`화이트보드를 찾을 수 없어요`)는 에러가 아니라 부재 상태이므로 `EmptyState` + `FileX` 아이콘으로 바꾼다. 로딩 실패만 `ErrorState`로 간다. `ProjectDetailPage`의 404는 이미 `EmptyState` + `FolderX`이므로 유지한다.
- `EmptyState` 아이콘 크기가 화면마다 `size-6`과 `size-8`로 갈려 있다. `ErrorState`는 `default`에서 `size-8`, `compact`에서 `size-5`로 고정하고, 같은 화면 안에서 짝이 어긋나지 않도록 `MemberListContent`의 빈 상태 아이콘도 `size-8`로 맞춘다.

## 범위

- 신규: `frontend/src/shared/ui/error-state.tsx`, `error-state.test.tsx`, `error-state.stories.tsx`
- 수정: 위 표의 7개 파일과 해당 테스트
- 유지: 재시도 동작, `refetch` 호출, `setLoadingStartedAt` 재설정, 404 분기 조건, 뒤로 가기 버튼

## 권한·오류 계약

- API·권한 판정은 바꾸지 않는다. `isMemberAccessLost`, `isProjectNotFound`, 404 상태 코드 분기는 그대로 둔다.
- 워크스페이스 접근 거부(`WorkspaceAccessDeniedPage`)와 로딩 실패는 서로 다른 화면이며, 이 작업은 로딩 실패만 다룬다.
- 실패 시 노출 정보량은 늘리지 않는다. 서버 원문 오류를 화면에 그대로 출력하지 않는다.

## 검증 계획

- `ErrorState` 단위 테스트: 기본 아이콘·위험색, `role="alert"`, `compact` 레이아웃, 액션 슬롯 렌더링.
- 7개 화면의 기존 에러 상태 테스트를 `ErrorState` 기준으로 갱신하고, 재시도 버튼이 `refetch`를 호출하는 계약을 유지 확인한다.
- `pnpm test`, `pnpm lint`, `pnpm build`를 실행한다.
- 브라우저에서 워크스페이스 로딩 실패, 프로젝트 목록 실패, 계정 패널 실패 화면을 확인한다.

## 범위 밖

- 빈 상태(`검색 결과가 없어요` 등) 문구와 아이콘 재설계
- 에러 문구의 상수화 (#83에서 처리)
- 재시도 백오프나 에러 로깅 도입
