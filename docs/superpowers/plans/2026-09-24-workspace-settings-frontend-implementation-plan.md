# 워크스페이스 설정 프론트엔드 구현 계획

> **For agentic workers:** 구현은 사용자 승인 후 진행한다. Native 실행 방식을 선택하면 superpowers:executing-plans에 따라 이 계획을 작업별로 수행한다. 각 작업 단계는 체크박스로 진행 상태를 기록한다.

**목표:** Owner가 워크스페이스 이름을 변경하고 기본 워크스페이스가 아닌 워크스페이스를 삭제할 수 있는 Figma 기준 설정 화면을 제공한다.

**구조:** 기존 workspace 엔티티와 React Query mutation을 확장한다. 설정 UI는 workspace feature에 두고, 페이지와 인증 셸은 새 settings route에서 조합한다. 기존 프로젝트·멤버 경로에서 사이드바 설정 이동을 연결한다.

**기술 스택:** React 19, TypeScript, TanStack Router, TanStack Query, Axios, Vitest, Testing Library, Tailwind 기반 기존 공유 UI.

**설계:** [2026-09-24-workspace-settings-frontend-design.md](../specs/2026-09-24-workspace-settings-frontend-design.md)

## 전역 제약

- 이름은 trim 후 1~255자이며 서버 검증을 최종 기준으로 둔다.
- 설정은 Owner 전용이다. 기본 워크스페이스는 이름을 바꿀 수 있지만 삭제 UI는 없어야 한다.
- 이름 변경은 PATCH /workspaces/:workspaceId, 삭제는 DELETE /workspaces/:workspaceId를 사용한다. 백엔드와 DB는 수정하지 않는다.
- 기존 AuthenticatedWorkspaceLayout, workspace 쿼리, Dialog, Input, Button, 오류 표시 방식을 재사용한다. 의존성을 추가하지 않는다.
- Figma 설정 프레임 224:4561과 모달 224:4672를 시각 기준으로 삼는다.
- 각 동작은 실패 테스트부터 작성하고 해당 테스트를 먼저 실행한다.
- 사용자가 별도로 요청하기 전까지 commit하지 않는다.

## 검토 중점

1. 이름이 공백뿐이면 저장할 수 없고 오류를 입력 필드 근처에서 확인할 수 있는가? Task 5에서 검증한다.
2. 이름이 256자 이상이면 저장이 막히고 API 우회 요청도 서버가 거부하는가? Task 1과 Task 5에서 검증한다.
3. 저장·삭제 요청이 진행 중일 때 중복 제출이 막히는가? Task 2와 Task 5에서 검증한다.
4. 기본 워크스페이스는 이름 변경이 가능하고 삭제 UI가 숨겨지는가? Task 5에서 검증한다.
5. 멤버는 설정 메뉴를 보지 못하고 직접 URL 접근 시 권한 거부 상태를 보는가? Task 3과 Task 6에서 검증한다.
6. 삭제 실패 시 모달이 유지되고, 성공한 경우에만 기본 경로로 이동하는가? Task 5와 Task 6에서 검증한다.

---

### Task 1: 워크스페이스 수정·삭제 API 요청

**파일**

- 수정: frontend/src/entities/workspace/api/workspace.ts
- 수정: frontend/src/entities/workspace/index.ts
- 수정: frontend/src/entities/workspace/api/workspace.test.ts

**인터페이스**

- 제공: updateWorkspaceRequest(workspaceId: string, name: string, accessToken: string): Promise<WorkspaceSummary>
- 제공: deleteWorkspaceRequest(workspaceId: string, accessToken: string): Promise<void>
- 업데이트 응답은 백엔드의 workspace 객체에 Owner 역할을 보충해 기존 WorkspaceSummary로 반환한다. 삭제 요청은 204 응답 본문을 요구하지 않는다.

- [x] **Step 1: 실패하는 API 계약 테스트를 작성한다.**

PATCH는 경로, 본문, Bearer 헤더를 확인하고 응답에 role owner가 보충되는지 확인한다. DELETE는 경로·헤더를 확인하고 반환값이 undefined인지 확인한다.

~~~ts
expect(axiosInstance.patch).toHaveBeenCalledWith(
  '/workspaces/workspace-1',
  { name: '브랜드 스튜디오 2' },
  { headers: { Authorization: 'Bearer access-token' } },
)
expect(axiosInstance.delete).toHaveBeenCalledWith(
  '/workspaces/workspace-1',
  { headers: { Authorization: 'Bearer access-token' } },
)
~~~

- [x] **Step 2: API 테스트를 실행해 실패를 확인한다.**

실행: pnpm --dir frontend test -- src/entities/workspace/api/workspace.test.ts

예상 결과: 새 request 함수가 없어서 실패한다.

- [x] **Step 3: 기존 Axios 패턴으로 요청 함수를 구현하고 엔티티 공개 API에서 export한다.**

~~~ts
await axiosInstance.patch<UpdateWorkspaceResponse>(
  `/workspaces/${workspaceId}`,
  { name },
  { headers: { Authorization: `Bearer ${accessToken}` } },
)
await axiosInstance.delete(
  `/workspaces/${workspaceId}`,
  { headers: { Authorization: `Bearer ${accessToken}` } },
)
~~~

PATCH 응답에는 role owner를 붙여 반환한다. DELETE는 응답 본문 없이 완료한다.

- [x] **Step 4: API 테스트를 다시 실행해 통과를 확인한다.**

실행: pnpm --dir frontend test -- src/entities/workspace/api/workspace.test.ts

예상 결과: 목록·생성의 기존 테스트와 수정·삭제 요청 테스트가 모두 통과한다.

---

### Task 2: 수정·삭제 React Query mutation

**파일**

- 수정: frontend/src/features/workspace/model/use-workspaces.ts
- 수정: frontend/src/features/workspace/model/use-workspaces.test.tsx
- 수정: frontend/src/features/workspace/index.ts

**인터페이스**

- 제공: useUpdateWorkspace(accessToken: string | null)
- 제공: useDeleteWorkspace(accessToken: string | null)
- 수정 변수: { workspaceId: string; name: string }
- 삭제 변수: workspaceId: string
- 성공 시 둘 다 ['workspaces'] 접두 키를 무효화한다.

- [x] **Step 1: 두 mutation의 실패 테스트를 추가한다.**

테스트는 전달된 workspaceId, 이름, 토큰이 올바른 API 함수로 전달되는지 확인한다. 성공 시 workspace query가 무효화되고, 실패 시 성공 후처리가 실행되지 않는지도 확인한다.

- [x] **Step 2: 훅 테스트를 실행해 새 API 함수가 아직 연결되지 않아 실패하는지 확인한다.**

실행: pnpm --dir frontend test -- src/features/workspace/model/use-workspaces.test.tsx

예상 결과: 수정·삭제 훅 또는 API 호출 검증이 실패한다.

- [x] **Step 3: 기존 useCreateWorkspace 패턴으로 두 mutation을 구현한다.**

~~~ts
return useMutation({
  mutationFn: ({ workspaceId, name }) =>
    updateWorkspaceRequest(workspaceId, name, accessToken as string),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workspaces'] }),
})
~~~

삭제 mutation은 workspaceId 하나를 받아 deleteWorkspaceRequest를 호출하고 같은 query 접두 키를 무효화한다.

- [x] **Step 4: 훅 테스트를 다시 실행해 통과를 확인한다.**

실행: pnpm --dir frontend test -- src/features/workspace/model/use-workspaces.test.tsx

예상 결과: 생성 훅 기존 테스트와 두 mutation 테스트가 통과한다.

---

### Task 3: 사이드바 Owner 권한 노출

**파일**

- 수정: frontend/src/shared/ui/sidebar.tsx
- 수정: frontend/src/shared/ui/sidebar.test.tsx

**인터페이스**

- 기존 SidebarProps의 workspace는 WorkspaceSummary | null이다. 별도 권한 prop을 만들지 않고 현재 workspace.role을 사용한다.

- [x] **Step 1: Owner와 Member의 설정 메뉴 표시 테스트를 추가한다.**

Owner는 설정 메뉴를 볼 수 있고 클릭 시 onNavChange('settings')를 호출한다. Member는 같은 메뉴를 볼 수 없다. 기본 워크스페이스 Owner도 설정 메뉴를 볼 수 있어야 한다.

- [x] **Step 2: 사이드바 테스트를 실행해 Member 표시 조건에서 실패를 확인한다.**

실행: pnpm --dir frontend test -- src/shared/ui/sidebar.test.tsx

예상 결과: 현재는 Member에게도 설정 메뉴가 표시되어 실패한다.

- [x] **Step 3: 기존 설정 SidebarNavItem을 Owner 조건으로 감싼다.**

~~~tsx
{workspace?.role === 'owner' && (
  <SidebarNavItem
    icon={SlidersHorizontal}
    label="설정"
    active={activeNav === 'settings'}
    onClick={() => onNavChange('settings')}
  />
)}
~~~

기존 collapsed/compact 스타일 prop도 그대로 전달한다.

- [x] **Step 4: 사이드바 테스트를 다시 실행해 통과를 확인한다.**

실행: pnpm --dir frontend test -- src/shared/ui/sidebar.test.tsx

예상 결과: Owner 메뉴 노출, Member 메뉴 비노출, 기존 사이드바 회귀 테스트가 통과한다.

---

### Task 4: 프로젝트·멤버 화면의 설정 경로 연결

**파일**

- 수정: frontend/src/routes/workspaces/$workspaceId/projects.tsx
- 수정: frontend/src/routes/workspaces/$workspaceId/projects.test.tsx
- 수정: frontend/src/routes/workspaces/$workspaceId/members.tsx
- 수정: frontend/src/routes/workspaces/$workspaceId/members.test.tsx

**인터페이스**

- 기존 HomePage의 onNavChange(key, selectedWorkspaceId) callback을 사용한다.
- projects, members, settings 키를 각각 프로젝트, 멤버, 설정 경로에 연결한다. workspaceId가 없으면 이동하지 않는다.

- [x] **Step 1: 프로젝트·멤버 route 테스트에 설정 메뉴 이동 케이스를 추가한다.**

Owner가 프로젝트 또는 멤버 화면의 설정 메뉴를 선택하면 해당 workspaceId의 settings route로 이동해야 한다. 멤버 메뉴와 프로젝트 메뉴도 기존 목적지로 이동하는지 확인한다.

- [x] **Step 2: 두 route 테스트를 실행해 새 callback이 전달되지 않아 실패하는지 확인한다.**

실행: pnpm --dir frontend test -- 'src/routes/workspaces/$workspaceId/projects.test.tsx' 'src/routes/workspaces/$workspaceId/members.test.tsx'

예상 결과: HomePage에 설정 이동 handler가 없어 새 설정 이동 검증이 실패한다.

- [x] **Step 3: 두 route에서 SidebarNavKey를 TanStack Router 경로에 매핑한다.**

~~~tsx
onNavChange={(key, selectedWorkspaceId) => {
  if (!selectedWorkspaceId) return
  void navigate({
    to: key === 'members'
      ? '/workspaces/$workspaceId/members'
      : key === 'settings'
        ? '/workspaces/$workspaceId/settings'
        : PROJECTS_ROUTE,
    params: { workspaceId: selectedWorkspaceId },
  })
}}
~~~

- [x] **Step 4: 프로젝트·멤버 route 테스트를 다시 실행해 통과를 확인한다.**

실행: pnpm --dir frontend test -- 'src/routes/workspaces/$workspaceId/projects.test.tsx' 'src/routes/workspaces/$workspaceId/members.test.tsx'

예상 결과: 세 사이드바 목적지와 기존 route 동작이 통과한다.

---

### Task 5: 설정 콘텐츠와 삭제 확인 모달

**파일**

- 생성: frontend/src/features/workspace/ui/WorkspaceSettingsContent.tsx
- 생성: frontend/src/features/workspace/ui/WorkspaceSettingsContent.test.tsx

**인터페이스**

- 제공: WorkspaceSettingsContent({ workspace, accessToken, onDeleted })
- workspace 타입: WorkspaceSummary
- accessToken 타입: string
- onDeleted 타입: () => void
- mutation 훅은 Task 2에서 제공한 useUpdateWorkspace와 useDeleteWorkspace를 사용한다.

- [x] **Step 1: 입력·저장·기본 workspace·삭제 dialog의 실패 테스트를 작성한다.**

Owner 이름이 초기값으로 표시되는지, trim 후 빈 문자열과 256자 이름을 저장할 수 없는지, 변경 없음과 pending 상태에서 저장이 막히는지 검증한다. 기본 workspace에는 위험 구역이 없어야 한다. 비기본 workspace에서는 삭제 dialog의 취소가 API를 호출하지 않고 확인은 삭제 mutation을 호출해야 한다. mutation 실패 후에는 폼 값과 dialog가 유지되어야 한다.

- [x] **Step 2: 콘텐츠 테스트를 실행해 컴포넌트 부재로 실패하는지 확인한다.**

실행: pnpm --dir frontend test -- src/features/workspace/ui/WorkspaceSettingsContent.test.tsx

예상 결과: WorkspaceSettingsContent를 import할 수 없어 실패한다.

- [x] **Step 3: Figma 레이아웃과 mutation 동작을 구현한다.**

일반 섹션에는 400px 너비의 36px Input과 36px 저장 Button을 사용한다. 위험 구역은 비기본 workspace에만 렌더링한다. 확인 모달은 기존 Dialog 컴포넌트로 만들고 360×208 Figma 노드의 문구·위계를 따른다.

~~~tsx
const normalizedName = name.trim()
const canSave =
  normalizedName.length > 0 &&
  normalizedName.length <= 255 &&
  normalizedName !== workspace.name &&
  !updateMutation.isPending
~~~

저장 오류는 입력 가까이에 접근 가능한 오류 문구로 표시한다. 삭제 오류는 모달 안에 표시하고 모달을 유지한다. 삭제 성공 callback은 mutation 성공 후에만 호출한다.

- [x] **Step 4: 콘텐츠 테스트를 다시 실행해 통과를 확인한다.**

실행: pnpm --dir frontend test -- src/features/workspace/ui/WorkspaceSettingsContent.test.tsx

예상 결과: 입력 경계값, 저장 상태, 기본 workspace, 취소·확인·실패 흐름이 모두 통과한다.

---

### Task 6: 설정 페이지와 보호된 라우트

**파일**

- 생성: frontend/src/pages/workspace-settings/index.ts
- 생성: frontend/src/pages/workspace-settings/ui/WorkspaceSettingsPage.tsx
- 생성: frontend/src/pages/workspace-settings/ui/WorkspaceSettingsPage.test.tsx
- 생성: frontend/src/routes/workspaces/$workspaceId/settings.tsx
- 생성: frontend/src/routes/workspaces/$workspaceId/settings.test.tsx

**인터페이스**

- Route는 기존 redirectIfUnauthenticated guard를 사용한다.
- WorkspaceSettingsPage는 workspaceId와 기존 레이아웃의 workspace/user callback을 받는다.
- AuthenticatedWorkspaceLayout의 children context에서 accessToken과 selectedWorkspace를 WorkspaceSettingsContent에 전달한다.
- selectedWorkspace.role이 owner가 아니면 WorkspaceAccessDeniedPage를 렌더링한다. 돌아가기 동작은 같은 workspace 프로젝트 route로 보낸다.
- workspace 변경은 새 workspace의 settings route를 유지한다. 이름 변경 성공은 현재 route에 머문다. 삭제 성공은 root route로 이동한다.
- settings 화면의 nav callback은 projects·members·settings 경로를 선택한다. 사용자 클릭은 현재 workspaceId를 포함한 /account 경로로 이동한다.

- [x] **Step 1: page 및 route 테스트를 먼저 작성한다.**

설정 route가 인증 guard를 사용하는지, Owner에게 설정 제목·입력·위험 구역을 표시하는지, Member 직접 접근은 권한 거부 UI를 표시하는지 검증한다. workspace 전환, 사용자 설정 이동, nav 이동, 삭제 후 기본 경로 이동도 검증한다.

- [x] **Step 2: route/page 테스트를 실행해 아직 없는 모듈 또는 동작 때문에 실패하는지 확인한다.**

실행: pnpm --dir frontend test -- 'src/routes/workspaces/$workspaceId/settings.test.tsx' src/pages/workspace-settings/ui/WorkspaceSettingsPage.test.tsx

예상 결과: 새 route와 page가 없어 실패한다.

- [x] **Step 3: WorkspaceSettingsPage와 route를 구현하고 workspace-settings page export를 추가한다.**

~~~tsx
<AuthenticatedWorkspaceLayout
  workspaceId={workspaceId}
  activeNav="settings"
  workspaceMode="required"
  onWorkspaceChange={onWorkspaceChange}
  onNavChange={onNavChange}
  onUserClick={onUserClick}
>
  {({ accessToken, selectedWorkspace }) =>
    selectedWorkspace?.role === 'owner'
      ? <WorkspaceSettingsContent
          key={selectedWorkspace.id}
          workspace={selectedWorkspace}
          accessToken={accessToken}
          onDeleted={onDeleted}
        />
      : <WorkspaceAccessDeniedPage
          workspaceName={selectedWorkspace?.name ?? ''}
          onReturn={onReturn}
        />
  }
</AuthenticatedWorkspaceLayout>
~~~

route는 /workspaces/$workspaceId/settings를 등록하고 auth guard를 적용한다. 프로젝트·멤버 route와 같은 방식으로 TanStack Router callback을 page props에 연결한다.

- [x] **Step 4: route/page 테스트를 다시 실행해 통과를 확인한다.**

실행: pnpm --dir frontend test -- 'src/routes/workspaces/$workspaceId/settings.test.tsx' src/pages/workspace-settings/ui/WorkspaceSettingsPage.test.tsx

예상 결과: 인증, Owner/Member 상태, nav·workspace 이동, 삭제 후 이동이 통과한다.

---

### Task 7: 전체 검증과 구현 기록

**최종 실행 기록 (2026-09-25)**

- 실제 변경: 워크스페이스 설정 API·mutation·Owner 설정 메뉴·보호된 설정 페이지를 구현하고, 이름 변경/삭제 완료 후 목록 갱신과 이동을 연결했다.
- 계획과 달라진 점: 메뉴 테스트에서 `user-event`가 body에서 포커스를 옮길 때 발생시키는 Window blur로 Radix 메뉴가 닫혔다. 해당 테스트에서 문서 루트에 포커스를 둬 테스트 환경의 초기 포커스 상태를 보정했다. 제품 동작은 변경하지 않았다.
- 검증: frontend `pnpm exec vitest run`, `pnpm lint`, `pnpm build` 통과. 문제였던 세 테스트 파일은 32개 모두 통과했다. `git diff --check` 통과.
- 후속 작업: 없음.

**파일**

- 수정: docs/superpowers/plans/2026-09-24-workspace-settings-frontend-implementation-plan.md

- [x] **Step 1: 관련 프론트엔드 테스트 전체를 실행한다.**

실행: pnpm --dir frontend test -- src/entities/workspace/api/workspace.test.ts src/features/workspace/model/use-workspaces.test.tsx src/features/workspace/ui/WorkspaceSettingsContent.test.tsx src/shared/ui/sidebar.test.tsx 'src/routes/workspaces/$workspaceId/projects.test.tsx' 'src/routes/workspaces/$workspaceId/members.test.tsx' 'src/routes/workspaces/$workspaceId/settings.test.tsx' src/pages/workspace-settings/ui/WorkspaceSettingsPage.test.tsx

예상 결과: 지정한 모든 workspace 설정·네비게이션 회귀 테스트가 통과한다.

- [x] **Step 2: 프론트엔드 lint와 build를 실행한다.**

실행:

~~~sh
pnpm --dir frontend lint
pnpm --dir frontend build
~~~

예상 결과: ESLint와 TypeScript/Vite build가 오류 없이 완료된다.

**실행 결과**

- 실제 변경: 워크스페이스 이름 변경·삭제 API와 React Query mutation, Owner 전용 설정 화면 및 확인 모달, 설정 navigation을 구현했다. Figma 설정 화면(224:4561)과 삭제 모달(224:4672)을 비교해 간격과 모달 높이를 조정했다.
- 계획과 달라진 점: 리뷰에서 설정 메뉴 경로 누락을 발견해 공통 레이아웃과 계정 경로의 navigation 연결을 보완했다.
- 검증: `pnpm --dir frontend exec vitest run <관련 테스트 경로> --reporter=dot`에서 13개 파일 117개 통과. `pnpm --dir frontend lint` 오류 0개(기존 Fast Refresh 경고 4개), `pnpm --dir frontend build` 통과. 전체 테스트 76개 파일 중 73개 통과, 3개 파일에서 4개 프로젝트·화이트보드 UI 테스트 실패.
- 후속 작업: 전체 테스트에서 실패한 프로젝트·화이트보드 UI 4건을 별도 확인한다. 커밋하지 않고 현재 기능 브랜치에 변경을 유지한다.

- [x] **Step 3: Figma 기준 화면을 확인하고 계획 문서에 구현 결과를 기록한다.**

1440px 프레임에서 설정·위험 구역·삭제 모달을 비교한다. 계획 문서에 실제 파일 변경, 계획과 달라진 점, 실행 명령과 결과, 남은 후속 작업을 적는다. 계획과 다른 점이 없으면 그 사실을 명시한다.
