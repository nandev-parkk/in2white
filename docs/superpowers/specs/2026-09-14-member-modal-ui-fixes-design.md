# 멤버 추가 모달·사이드바 활성 표시 수정 설계

## 상태와 목표

2026-09-14 사용자 설계 승인 완료. 멤버 기능 병합(`dev` a05dadb) 이후 확인된 UI·권한 결함 6건을 수정한다.

- 작업 공간: `/Users/nandev/orca/workspaces/in2white/fix-member-modal-ui`, 브랜치 `fix/member-modal-ui`, base `dev`
- 작업 유형: Bug / Standard. 프론트엔드 5건과 백엔드 권한 계약 1건을 포함한다.
- 기준: 기존 멤버 관리 설계([2026-09-14 멤버 관리 프론트엔드 설계](2026-09-14-members-frontend-design.md)), DESIGN.md 토큰, 기존 멤버 API 계약
- 피그마: https://www.figma.com/design/Dimhltnal74SHy2NcLz1Lf/in2white?node-id=84-2 (추가 모달 `188:3264`, 검색 결과 없음 `220:4473`, 로딩 `220:3927`)

## 결함과 원인

| # | 증상 | 원인 |
| --- | --- | --- |
| 1 | 계정 설정 진입 시 사이드바 "설정"이 활성화된다 | `AccountPage`가 `activeNav="settings"`를 넘겨 워크스페이스 설정 항목이 활성화된다 |
| 2 | 멤버 추가 시 모달이 깜빡인다 | 추가 성공 후 캐시 무효화로 `isFetching`이 true가 되어 목록이 한 줄 로딩 텍스트로 교체되고 모달 높이가 변한다 |
| 3 | 추가 모달 디자인이 피그마와 다르다 | 피그마 프레임과 실제 구현의 간격·치수·구성 차이 |
| 4 | 검색 순간 빈 결과 자리에 다른 텍스트가 스쳐 지나간다 | 2번과 같은 `loading={candidates.isFetching}` 사용 |
| 5 | 빈 검색 결과가 맨텍스트 한 줄이다 | `UserPicker`가 공용 빈 상태 컴포넌트를 쓰지 않는다 |
| 6 | My Workspace에도 멤버를 초대할 수 있다 | 기본 워크스페이스에 대한 초대 차단 규칙이 없다 |

## 설계

### 1. 사이드바 활성 표시

`Sidebar`의 `activeNav`를 `SidebarNavKey | null`로 확장한다. `null`은 활성 항목 없음을 뜻한다.

`AuthenticatedWorkspaceLayout`의 `activeNav`도 `SidebarNavKey | null`을 받고, 활성 항목 계산을 `activeNav ?? internalActiveNav`에서 `activeNav === undefined ? internalActiveNav : activeNav`로 바꾼다. `??`는 `null`도 fallback 처리하므로 명시적 `undefined` 비교가 필요하다.

`AccountPage`는 `activeNav={null}`을 넘긴다. 계정 화면에서도 사이드바의 프로젝트·멤버 이동은 기존대로 동작한다.

### 2·4. 로딩 상태와 깜빡임

- `useMemberCandidates`에 `placeholderData: keepPreviousData`를 추가해 검색어·페이지 변경과 추가 후 재조회 중에도 이전 결과를 유지한다.
- `MemberAddDialog`의 `loading`을 `candidates.isFetching`에서 `candidates.isLoading`으로 바꾼다. 로딩 표시는 모달을 처음 열었을 때 1회만 나타난다.
- `UserPicker` 목록 영역에 최소 높이를 부여해 결과 수가 바뀌어도 모달 높이가 출렁이지 않게 한다.

실제 브라우저 재현으로 위 원인을 확정한 뒤 수정한다. 모달 자체가 닫혔다 다시 열리는 다른 원인이 확인되면 그 원인을 우선 처리하고 사용자에게 보고한다.

### 3. 로딩 전용 공용 컴포넌트

`shared/ui/compact-loading-state.tsx`를 추가한다. `CompactEmptyState`와 같은 구조·토큰을 쓰고 아이콘 자리에 기존 `Spinner`를 둔다.

```tsx
<CompactLoadingState title="사용자 불러오는 중" description="잠시만 기다려주세요" />
```

- 래퍼가 `role="status"`를 갖고 내부 `Spinner`는 `aria-hidden`으로 내려 중복 안내를 막는다.
- 빈 결과 UI와 최소 높이·여백이 같아 로딩에서 결과로 전환할 때 모달 높이가 변하지 않는다.
- 다른 화면의 맨텍스트 로딩 문구는 이번 범위에서 바꾸지 않는다.

### 5. 빈 결과 UI

`UserPicker`의 맨텍스트를 `CompactEmptyState`로 교체한다. 사이드바 워크스페이스 검색과 동일한 형태를 사용한다.

- 검색어가 있을 때: 제목 "검색 결과가 없어요", 설명 "다른 검색어로 다시 시도해보세요"
- 검색어 없이 후보가 없을 때: 제목 "추가할 사용자가 없어요"

### 6. 기본 워크스페이스 초대 차단

권한·오류 계약을 다음과 같이 추가한다.

- `POST /workspaces/:workspaceId/members`: 대상 워크스페이스가 기본 워크스페이스면 403 `MEMBER_ADD_DEFAULT_WORKSPACE_FORBIDDEN`, 메시지 "기본 워크스페이스에는 멤버를 추가할 수 없습니다"
- `GET /workspaces/:workspaceId/member-candidates`: 같은 조건에서 동일한 403 코드
- 검사 순서는 기존 계약을 유지한다. 비소속자 404 `WORKSPACE_NOT_FOUND`와 비소유자 403이 먼저이고, 그다음 기본 워크스페이스 검사를 수행한다. 기존 404/403/409 응답은 바뀌지 않는다.

프론트엔드는 초대 진입점을 숨긴다.

- `AuthenticatedWorkspaceLayout`의 `onInviteMember`를 `role === 'owner' && !isDefault`일 때만 전달한다.
- `MemberListContent`에 `canAddMember` prop을 추가해 "멤버 추가" 버튼 노출을 제어한다. 내보내기 판단에 쓰는 `workspaceRole`은 그대로 둔다.
- 안내 문구는 추가하지 않는다. 피그마에 해당 상태가 없다.

### 7. 피그마 대조

Figma Dev Mode MCP 연결 후 노드 `84-2`, `188:3264`, `220:4473`, `220:3927`을 읽어 추가 모달의 간격·치수·구성을 맞춘다. MCP 연결 전에는 이 항목만 보류하고 나머지를 먼저 완료한다.

## 변경 범위

- 프론트엔드: `shared/ui/sidebar.tsx`, `shared/ui/user-picker.tsx`, 신규 `shared/ui/compact-loading-state.tsx`, `pages/shared/ui/AuthenticatedWorkspaceLayout.tsx`, `pages/account/ui/AccountPage.tsx`, `pages/home/ui/HomePage.tsx`, `features/member/model/use-members.ts`, `features/member/ui/MemberAddDialog.tsx`, `features/member/ui/MemberListContent.tsx`
- 백엔드: `src/constants/messages.ts`, `src/services/member.service.ts`
- 스키마 변경과 마이그레이션은 없다.

## 검증

각 결함의 회귀 테스트를 먼저 실패 상태로 확인한 뒤 수정한다.

- 프론트엔드: `npm test`, `npm run lint`, `npm run build`
- 백엔드: `npm test`, `npm run lint`, `npm run build`
- 변경 파일 Prettier 확인, `git diff --check`
- 브라우저: 실제 로컬 서버로 계정 설정 활성 표시, 모달 검색·추가 시 깜빡임, 빈 결과·로딩 UI, My Workspace 초대 진입점 부재를 확인한다.
