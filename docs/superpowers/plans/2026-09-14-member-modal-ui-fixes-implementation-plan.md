# 멤버 추가 모달·사이드바 활성 표시 수정 구현 계획

## 상태

2026-09-14 사용자 설계 승인 완료. 9번 피그마 대조를 포함한 전 항목 구현·검증 완료. 보류했던 로딩 표현 방식도 사용자 승인 후 스켈레톤으로 전환 완료.

설계: [멤버 추가 모달·사이드바 활성 표시 수정 설계](../specs/2026-09-14-member-modal-ui-fixes-design.md)

작업 공간은 `/Users/nandev/orca/workspaces/in2white/fix-member-modal-ui`, 브랜치는 `fix/member-modal-ui`이며 base는 `dev`다. 커밋·푸시·PR은 별도 요청 시 수행한다.

## 작업 순서

- [x] 1. 실제 브라우저에서 모달 깜빡임과 순간 로딩 텍스트를 재현하고 원인을 확정한다. 설계의 원인 가설과 다르면 보고한다.
- [x] 2. 계정 설정의 사이드바 활성 표시 회귀 테스트를 실패 상태로 추가하고, `Sidebar`·레이아웃·`AccountPage`의 `activeNav` 계약을 `SidebarNavKey | null`로 고친다.
- [x] 3. `CompactLoadingState`를 단위 테스트와 함께 추가한다. `CompactEmptyState`와 동일한 토큰·최소 높이, `role="status"` 래퍼와 `aria-hidden` 스피너를 검증한다.
- [x] 4. `UserPicker`의 로딩·빈 결과를 공용 컴포넌트로 교체하고 목록 최소 높이를 적용한다. 검색어 유무에 따른 빈 결과 문구 분기를 테스트한다.
- [x] 5. `useMemberCandidates`에 `keepPreviousData`를 적용하고 `MemberAddDialog`의 `loading`을 `isLoading`으로 바꾼다. 재조회 중 이전 목록 유지와 로딩 1회 표시를 테스트한다.
- [x] 6. 백엔드 `addMember`·`listMemberCandidates`에 기본 워크스페이스 403 검사를 추가한다. 서비스·HTTP 테스트를 먼저 실패 상태로 확인하고, 기존 404/403/409 순서가 유지되는지 회귀 테스트한다.
- [x] 7. 프론트엔드 초대 진입점을 차단한다. 레이아웃 `onInviteMember` 조건과 `MemberListContent`의 `canAddMember`를 연결하고 기본 워크스페이스에서 버튼이 없는지 테스트한다.
- [x] 8. 전체 검증과 코드 리뷰를 수행하고 브라우저로 6개 증상의 해소를 확인한다.
- [x] 9. Figma Dev Mode MCP 연결 후 추가 모달을 피그마 노드와 대조해 맞춘다. 연결 전에는 보류한다.
- [x] 10. 아래 구현 결과에 실제 변경, 계획과 달라진 점, 검증 명령·결과, 남은 후속 작업을 기록한다.

## 검증 명령

- frontend: `npm test`, `npm run lint`, `npm run build`
- backend: `npm test`, `npm run lint`, `npm run build`
- 변경 파일 `npx prettier --check`, `git diff --check`
- 브라우저: 계정 설정 활성 표시, 모달 검색·추가 깜빡임, 로딩·빈 결과 UI, My Workspace 초대 진입점 부재

## Implementation Results

### 실제 변경

- 프론트엔드
  - `shared/ui/sidebar.tsx`: `activeNav`를 `SidebarNavKey | null`로 확장했다.
  - `pages/shared/ui/AuthenticatedWorkspaceLayout.tsx`: 활성 항목 계산을 `activeNav === undefined ? internalActiveNav : activeNav`로 바꿔 `null`이 fallback되지 않게 했다. 사이드바 초대 진입점과 초대 모달 렌더 조건에 `!selectedWorkspace.isDefault`를 추가했다.
  - `pages/account/ui/AccountPage.tsx`: `activeNav={null}`로 바꿔 계정 설정에서 워크스페이스 "설정"이 활성화되지 않게 했다.
  - `shared/ui/compact-loading-state.tsx` 신규: `CompactEmptyState`와 같은 토큰·최소 높이를 쓰고 `Spinner`를 `aria-hidden`으로 내린 `role="status"` 로딩 컴포넌트.
  - `shared/ui/user-picker.tsx`: 맨텍스트 로딩·빈 결과를 `CompactLoadingState`·`CompactEmptyState`로 교체했다. 검색어 유무로 "검색 결과가 없어요"와 "추가할 사용자가 없어요"를 구분한다. 오류 영역도 같은 중앙 정렬로 맞췄다. 피그마 대조 후 목록 컨테이너의 `min-h-40`을 제거하고(피그마에 없는 최소 높이) 아바타 이니셜을 `slice(0, 2)`에서 `slice(0, 1)`로 바꿔 피그마·`MemberListContent`와 맞췄다.
  - `features/member/model/use-members.ts`: 후보 조회에 `placeholderData: keepPreviousData`를 적용했다.
  - `features/member/ui/MemberAddDialog.tsx`: `loading`을 `isFetching`에서 `isLoading`으로 바꿨다.
  - `features/member/ui/MemberListContent.tsx`, `pages/home/ui/HomePage.tsx`: `canAddMember` prop을 추가해 기본 워크스페이스에서 "멤버 추가" 버튼과 모달을 숨긴다.
  - `shared/ui/sidebar.stories.tsx`: 확장된 `activeNav` 타입에 맞춰 story 상태와 라벨 표시를 보정했다.
- 백엔드
  - `src/constants/messages.ts`: `MEMBER_ADD_DEFAULT_WORKSPACE_FORBIDDEN` 메시지를 추가했다.
  - `src/services/member.service.ts`: `addMember`와 `listMemberCandidates`의 요청자 멤버십 조회를 `workspaces` innerJoin으로 바꿔 `isDefault`를 함께 읽고, 기존 404/403 검사 뒤에 403 `MEMBER_ADD_DEFAULT_WORKSPACE_FORBIDDEN`을 던진다.

### 계획과 달라진 점

- 1번 항목의 브라우저 선재현 대신, 실패하는 회귀 테스트로 원인(`loading={candidates.isFetching}`)을 먼저 고정한 뒤 구현하고 브라우저로 최종 확인했다. 설계의 원인 가설과 실제 동작은 일치했다.
- 기본 워크스페이스 응답 코드는 기존 `WORKSPACE_DEFAULT_DELETE_FORBIDDEN`의 400이 아니라 멤버 도메인의 다른 금지 규칙과 같은 403을 사용했다.
- `routes/workspaces/$workspaceId/members.test.tsx`의 워크스페이스 fixture가 소유자 워크스페이스를 `isDefault: true`로 두고 있어 초대 빠른 작업 테스트가 새 규칙에 걸렸다. 테스트 의도에 맞게 fixture를 `isDefault: false`로 고쳤다.
- 9번 피그마 대조는 사용자가 `/mcp`로 Figma Dev Mode MCP를 연결한 뒤 수행했다.
- 설계 2·4번에서 계획한 "목록 최소 높이"(`min-h-40`)는 피그마 모달 프레임에 없는 값이라 대조 과정에서 제거했다. 로딩·빈 상태의 `min-h-24`가 남아 있어 상태 전환 시 급격한 높이 변화는 없다.

### 실행한 검증과 결과

| 대상 | 명령 | 결과 |
| --- | --- | --- |
| frontend | `npx vitest run` | 50개 파일 / 270개 테스트 통과 |
| frontend | `npx eslint .` | 오류 0, 기존 Fast Refresh 경고 4건 |
| frontend | `npm run build` | exit 0 |
| backend | `npx vitest run` | 543개 통과, DB 통합 14개 skip(`RUN_DATABASE_INTEGRATION_TESTS` 미설정) |
| backend | `npm run lint`, `npm run build` | 모두 exit 0 |
| 변경 파일 | `npx prettier --write` (각 패키지) | 통과 |
| 루트 | `git diff --check` | 통과 |

TDD 순서를 지켰다. 구현 전 프론트 8건, 백엔드 7건이 실패하는 것을 확인한 뒤 구현했다.

9번 피그마 대조 수정(`min-h-40` 제거, 아바타 이니셜 1글자) 이후 위 검증을 모두 다시 실행했고 결과는 동일했다.

### 피그마 대조 결과 (9번)

노드 `188:3264`(추가 모달)를 `get_design_context`로 읽어 대조했다.

이미 일치한 항목:

| 항목 | 피그마 | 구현 |
| --- | --- | --- |
| 모달 폭 | 380px | 380px |
| 패딩 | 24px | 24px |
| 모서리 | `--radius-lg` | `--radius-lg` |
| 그림자 | 2겹 `--shadow-lg` | 동일 토큰 |
| 제목 | heading1 | heading1 |
| 검색 입력 | h36 / rounded-full / bg-subtle / px-16 / gap-8 / icon-16 | 동일 |
| 목록 셀 | `--component-list-cell-*` 토큰 | 동일 |
| 셀 trailing | 기본 ChevronRight | 동일 |
| 닫기 버튼 | tertiary | tertiary |

수정한 항목:

- 목록 컨테이너의 `min-h-40` 제거. 피그마 모달에는 목록 최소 높이가 없다.
- 아바타 이니셜을 이름 1글자로 변경. 피그마와 기존 멤버 목록(`MemberListContent`)이 모두 1글자다.

수정하지 않고 보고만 하는 항목:

- 후보가 많아 스크롤이 생기면 마지막 행이 중간에서 잘린다. 피그마에는 스크롤 상태 프레임이 없어 임의로 정하지 않았다.
- 딤 배경 불투명도가 구현 0.40, 피그마 0.44다. 전역 Dialog 토큰이라 이번 범위에서 바꾸지 않았다.
- 모달 하단 페이지네이션은 피그마 모달 프레임에 없다. 기존 동작을 유지했다.

로딩·빈 결과 노드 확인 결과:

- `220:4473`과 `220:3927`은 `get_metadata`로 확인한 결과 모달이 아니라 **멤버 관리 페이지 레벨** 프레임이다.
- 피그마의 목록 로딩 패턴은 `Skeleton / List Cell` 5개이고, 빈 상태는 페이지 전체 `EmptyState`다.
- 즉 피그마에는 **모달 전용 로딩·빈 상태 디자인이 없다**. 이번 구현의 `CompactLoadingState`(스피너)는 사용자가 승인한 형태이며 피그마 스켈레톤 패턴과는 다르다. 어느 쪽으로 맞출지는 사용자 판단이 필요하다.

### 브라우저·API 확인

워크트리 전용 서버(백엔드 4001, 프론트 5175)와 실제 PostgreSQL로 확인했다. 사용자의 기존 서버(4000/5173)는 건드리지 않았다.

- API: 기본 워크스페이스 멤버 추가 403 `MEMBER_ADD_DEFAULT_WORKSPACE_FORBIDDEN`, 기본 워크스페이스 후보 조회 403, 일반 워크스페이스 추가 201·후보 조회 200.
- My Workspace 멤버 화면: 사이드바 "멤버 초대"와 본문 "멤버 추가" 모두 없음. 일반 워크스페이스에서는 둘 다 표시.
- 추가 모달: 폭 380px. 검색·멤버 추가 중 로딩 컴포넌트로 교체되지 않고 목록이 유지됐다.
- 피그마 대조는 Playwright MCP 스크린샷으로 모달 현재 모습·수정 후 모습·빈 결과를 캡처해 피그마 렌더와 나란히 비교했다. 캡처 파일은 저장소 밖 임시 경로에 두었고 저장소에는 남기지 않았다.
- 검색 결과 없음: `CompactEmptyState`로 "검색 결과가 없어요 / 다른 검색어로 다시 시도해보세요" 표시.
- 계정 설정(`/account`): 프로젝트·멤버·설정 모두 비활성(배경 transparent). 멤버 화면으로 돌아가면 "멤버"만 활성.
- 검증용 계정·워크스페이스는 확인 후 삭제했고, 검증 서버도 종료했다. 인증정보는 문서·로그에 남기지 않았다.
- Orca 내장 브라우저의 스크린샷은 탭 비표시 상태에서 CDP 타임아웃이 발생해 DOM 측정과 접근성 snapshot으로 검증했다.

### 남은 후속 작업

- 모달 로딩 표현은 사용자 승인 후 스켈레톤으로 전환했다. 아래 "후속 작업: 모달 로딩 스켈레톤 전환" 참고.
- 스크롤 시 마지막 행 잘림, 딤 배경 불투명도 0.40 대 0.44는 의도적으로 두기로 했다.
  - 마지막 행 잘림은 표준 스크롤 어포던스이고, 피그마에 스크롤 상태 프레임이 없다. `max-h-72`를 행 높이 배수로 튜닝하는 방식은 이름 줄바꿈·토큰 변경에 취약하다.
  - 딤 배경은 전역 `DialogOverlay`(`shared/ui/dialog.tsx`)의 `bg-black/40`이라 0.04 차이 때문에 앱 전체 다이얼로그를 바꾸게 된다. 디자인 토큰 정합성 작업에서 다룬다.
- 규칙 도입 전 기본 워크스페이스 멤버십은 사용자 선택(B안)에 따라 위반 3건만 삭제했다. 삭제 후 위반 0건, 기본 워크스페이스 6개 모두 멤버십 1건을 확인했다.
- 커밋·푸시·PR은 미실행이다.

## 후속 작업: 모달 로딩 스켈레톤 전환

2026-09-14 사용자 승인 후 진행. 브랜치 `fix/member-modal-loading-skeleton`, base `dev`.

### 배경

피그마 노드 `220:3927`의 목록 로딩 패턴은 `Skeleton / List Cell`인데 모달만 스피너(`CompactLoadingState`)를 썼다. 모달 뒤에 깔린 멤버 목록 페이지가 이미 스켈레톤 행을 보여주고 있어 일관성도 맞지 않았다.

### 실제 변경

- `shared/ui/user-picker.tsx`: 로딩을 `SkeletonListCell` 5개로 교체했다. 래퍼는 `role="status"` + `aria-label="사용자 불러오는 중"`으로 스크린리더 안내를 유지한다.
- `shared/ui/skeleton.tsx`: `SkeletonListCell` 기본 높이에 `h-15.5`를 넣어 `ListCell` 실제 렌더 높이(62px)와 맞췄다.
- `features/member/ui/MemberListContent.tsx`: 직접 작성한 스켈레톤 행을 `SkeletonListCell`로 교체했다. 기존에 지정하던 `h-15.5`가 공용 컴포넌트 기본값이 되어 override가 필요 없다.
- `shared/ui/user-picker.stories.tsx`: `loading` 인자를 wrapper로 전달하고 `Loading` 스토리를 추가했다.
- `shared/ui/compact-loading-state.tsx`와 테스트를 삭제했다. `user-picker.tsx` 외에 사용처가 없었다.

### 검증

TDD 순서를 지켰다. 테스트를 먼저 스켈레톤 기준으로 바꿔 실패를 확인한 뒤 구현했다.

| 대상 | 명령 | 결과 |
| --- | --- | --- |
| frontend | `npx vitest run` | 49파일 / 268개 통과 |
| frontend | `npx eslint .` | 오류 0, 기존 Fast Refresh 경고 4건 |
| frontend | `npm run build` | exit 0 |
| frontend | `npx prettier --check src/` | 통과 |
| 루트 | `git diff --check` | 통과 |

브라우저 확인은 Storybook(포트 6007)과 Orca 내장 브라우저의 DOM 측정으로 했다.

| 상태 | 행 높이 | 목록 높이 | 모달 |
| --- | --- | --- | --- |
| 로딩(스켈레톤 5개) | 62px | 288px | 380 x 480 |
| 로드 완료(실제 5행) | 62px | 288px | 380 x 480 |

두 상태의 치수가 완전히 같아 로딩에서 데이터로 전환할 때 레이아웃 이동이 없다. 높이를 맞추기 전에는 스켈레톤이 56px이라 행당 6px, 모달 전체 8px이 밀렸다.

### 계획과 달라진 점

- `SkeletonListCell`이 `--component-list-cell-*` 토큰을 쓰는데도 실제 `ListCell`보다 6px 낮았다. 토큰만으로는 높이가 맞지 않아 `h-15.5`를 기본값으로 넣었다. 이 값은 기존 `MemberListContent`가 쓰던 수치와 같다.
- 로딩 상태를 브라우저에서 재현하려면 스토리가 필요해 `Loading` 스토리를 추가했다. 계획에는 없던 변경이다.
