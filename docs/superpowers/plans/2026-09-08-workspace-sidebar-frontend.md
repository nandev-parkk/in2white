# 워크스페이스 사이드바 프론트엔드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Figma의 Workspace Home 사이드바를 실제 워크스페이스 목록·생성 API와 연결하고, 전환 팝오버와 사이드바 폴딩을 제공한다.

**Architecture:** 워크스페이스 API 타입과 요청 함수는 `entities/workspace`에 두고, React Query 조회·생성 훅과 팝오버·생성 모달은 `features/workspace`에 둔다. `HomePage`가 세션·선택 워크스페이스·활성 메뉴·폴딩 상태를 조합하고, 기존 `Sidebar`는 표현과 상호작용을 담당한다.

**Tech Stack:** React 19, TypeScript, TanStack Query, Zustand session store, Axios, Radix UI Dialog, Tailwind CSS v4, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-08-workspace-sidebar-frontend-design.md`

## Global Constraints

- 모든 화면 문구와 문서 문구는 한국어로 작성한다.
- Figma 기준 사이드바는 240px, 접힌 사이드바는 64px, 전환 팝오버는 272×320, 생성 모달은 360×227이다.
- 기존 디자인 토큰·Pretendard·공용 UI 컴포넌트를 재사용하고 새 UI 라이브러리를 추가하지 않는다.
- 인증 요청은 세션의 access token을 `Authorization: Bearer <token>` 헤더로 전달한다.
- 테스트는 production 코드보다 먼저 작성하고, 새 테스트가 기능 부재로 실패하는 것을 확인한 뒤 구현한다.
- 멤버 목록 API가 없으므로 임의의 멤버 데이터를 만들지 않는다.
- 커밋은 사용자가 별도로 요청할 때만 실행한다.

---

### Task 1: 워크스페이스 API 타입과 요청 함수

**Files:**

- Create: `frontend/src/entities/workspace/api/workspace.ts`
- Create: `frontend/src/entities/workspace/api/workspace.test.ts`
- Create: `frontend/src/entities/workspace/index.ts`

**Interfaces:**

- Produces `WorkspaceRole`, `WorkspaceSummary`, `ListWorkspacesResponse`, `CreateWorkspaceResponse` 타입
- Produces `listWorkspacesRequest(accessToken: string): Promise<WorkspaceSummary[]>`
- Produces `createWorkspaceRequest(name: string, accessToken: string): Promise<WorkspaceSummary>`

테스트 파일 상단에는 API 응답 계약을 고정하는 다음 fixture를 둔다.

```typescript
const workspaceFixture: WorkspaceSummary = {
  id: 'workspace-1',
  name: 'My Workspace',
  ownerId: 'user-1',
  isDefault: true,
  createdAt: '2026-09-08T00:00:00.000Z',
  updatedAt: '2026-09-08T00:00:00.000Z',
  role: 'owner',
}

const createdWorkspaceResponseFixture = {
  id: 'workspace-2',
  name: '새 팀',
  ownerId: 'user-1',
  isDefault: false,
  createdAt: '2026-09-08T00:00:00.000Z',
  updatedAt: '2026-09-08T00:00:00.000Z',
}

const createdWorkspaceFixture: WorkspaceSummary = {
  ...createdWorkspaceResponseFixture,
  role: 'owner',
}
```

- [ ] **Step 1: GET 요청이 Bearer 토큰과 응답 데이터를 전달하는 실패 테스트 작성**

```tsx
it('워크스페이스 목록을 Bearer 토큰으로 조회한다', async () => {
  vi.mocked(axiosInstance.get).mockResolvedValueOnce({
    data: { workspaces: [workspaceFixture] },
  })

  await expect(listWorkspacesRequest('token-1')).resolves.toEqual([
    workspaceFixture,
  ])
  expect(axiosInstance.get).toHaveBeenCalledWith('/workspaces', {
    headers: { Authorization: 'Bearer token-1' },
  })
})

it('워크스페이스를 생성하고 owner 역할을 붙여 반환한다', async () => {
  vi.mocked(axiosInstance.post).mockResolvedValueOnce({
    data: { workspace: createdWorkspaceResponseFixture },
  })

  await expect(createWorkspaceRequest('새 팀', 'token-1')).resolves.toEqual(
    createdWorkspaceFixture,
  )
  expect(axiosInstance.post).toHaveBeenCalledWith(
    '/workspaces',
    { name: '새 팀' },
    { headers: { Authorization: 'Bearer token-1' } },
  )
})
```

- [ ] **Step 2: 테스트를 실행해 요청 함수가 없어 실패하는지 확인**

실행: `pnpm --dir frontend exec vitest run src/entities/workspace/api/workspace.test.ts`

기대 결과: `listWorkspacesRequest` 미정의 또는 export 누락으로 실패한다.

- [ ] **Step 3: 목록·생성 요청 함수의 최소 구현 작성**

```typescript
export async function listWorkspacesRequest(
  accessToken: string,
): Promise<WorkspaceSummary[]> {
  const { data } = await axiosInstance.get<ListWorkspacesResponse>(
    '/workspaces',
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
  return data.workspaces
}

export async function createWorkspaceRequest(
  name: string,
  accessToken: string,
): Promise<WorkspaceSummary> {
  const { data } = await axiosInstance.post<CreateWorkspaceResponse>(
    '/workspaces',
    { name },
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
  return {
    ...data.workspace,
    role: 'owner',
  }
}
```

- [ ] **Step 4: GET·POST 테스트가 통과하는지 확인**

실행: `pnpm --dir frontend exec vitest run src/entities/workspace/api/workspace.test.ts`

기대 결과: 목록 조회와 생성 요청 테스트가 모두 통과한다.

- [ ] **Step 5: entity index에서 타입과 함수를 export**

```typescript
export {
  createWorkspaceRequest,
  listWorkspacesRequest,
} from './api/workspace'
export type { WorkspaceRole, WorkspaceSummary } from './api/workspace'
```

---

### Task 2: 워크스페이스 조회·생성 React Query 훅

**Files:**

- Create: `frontend/src/features/workspace/model/use-workspaces.ts`
- Create: `frontend/src/features/workspace/model/use-workspaces.test.tsx`
- Create: `frontend/src/features/workspace/index.ts`

**Interfaces:**

- Consumes `listWorkspacesRequest`와 `createWorkspaceRequest` from Task 1
- Produces `useWorkspaces(accessToken: string | null, userId: string | null)` with query key `['workspaces', userId]`; 사용자 전환 시 이전 사용자의 캐시를 재사용하지 않는다.
- Produces `useCreateWorkspace(accessToken: string | null)` whose success handler invalidates `['workspaces']`

Task 2 테스트 파일에는 다음처럼 Task 1과 동일한 응답 fixture를 직접 선언하고, Query Client wrapper도 파일 안에 둔다.

```tsx
const workspaceFixture: WorkspaceSummary = {
  id: 'workspace-1',
  name: 'My Workspace',
  ownerId: 'user-1',
  isDefault: true,
  createdAt: '2026-09-08T00:00:00.000Z',
  updatedAt: '2026-09-08T00:00:00.000Z',
  role: 'owner',
}

const createdWorkspaceFixture: WorkspaceSummary = {
  ...workspaceFixture,
  id: 'workspace-2',
  name: '새 팀',
  isDefault: false,
}

function createQueryClientWrapper(queryClient: QueryClient) {
  return function QueryClientWrapper({
    children,
  }: React.PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}
```

- [ ] **Step 1: 토큰이 있을 때 목록을 조회하고 생성 성공 후 캐시를 무효화하는 실패 테스트 작성**

```tsx
it('access token으로 목록을 조회하고 생성 성공 시 목록을 무효화한다', async () => {
  vi.mocked(listWorkspacesRequest).mockResolvedValue([workspaceFixture])
  vi.mocked(createWorkspaceRequest).mockResolvedValue(createdWorkspaceFixture)

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries')
  const { result } = renderHook(
    () => ({
      list: useWorkspaces('token-1'),
      create: useCreateWorkspace('token-1'),
    }),
    { wrapper: createQueryClientWrapper(queryClient) },
  )

  await waitFor(() => expect(result.current.list.data).toEqual([workspaceFixture]))
  await act(async () => {
    await result.current.create.mutateAsync('새 팀')
  })

  expect(createWorkspaceRequest).toHaveBeenCalledWith('새 팀', 'token-1')
  expect(invalidateQueriesSpy).toHaveBeenCalledWith({
    queryKey: ['workspaces'],
  })
})
```

- [ ] **Step 2: 훅이 없어서 실패하는지 확인**

실행: `pnpm --dir frontend exec vitest run src/features/workspace/model/use-workspaces.test.tsx`

기대 결과: `useWorkspaces` 또는 `useCreateWorkspace` 미정의로 실패한다.

- [ ] **Step 3: 최소 훅 구현 작성**

```typescript
export function useWorkspaces(accessToken: string | null) {
  return useQuery({
    queryKey: ['workspaces'],
    queryFn: () => listWorkspacesRequest(accessToken as string),
    enabled: Boolean(accessToken),
  })
}

export function useCreateWorkspace(accessToken: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (name: string) =>
      createWorkspaceRequest(name, accessToken as string),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workspaces'] }),
  })
}
```

`enabled`가 false인 경우에는 query function이 호출되지 않도록 HomePage에서 토큰 없는 상태를 렌더링하지 않는다. mutation은 토큰이 없으면 실행 버튼을 비활성화한다.

- [ ] **Step 4: 훅 테스트 통과 확인**

실행: `pnpm --dir frontend exec vitest run src/features/workspace/model/use-workspaces.test.tsx`

기대 결과: 목록 조회, 생성 호출, 캐시 무효화 테스트가 통과한다.

---

### Task 3: 사이드바 워크스페이스 전환과 폴딩

**Files:**

- Modify: `frontend/src/shared/ui/sidebar.tsx`
- Create: `frontend/src/shared/ui/sidebar.test.tsx`

**Interfaces:**

- Consumes `workspace: WorkspaceSummary | null`, `workspaces: WorkspaceSummary[]`, `selectedWorkspaceId`, `onWorkspaceChange`, `onCreateWorkspace`를 Sidebar props로 받는다.
- Produces `collapsed`/`onCollapsedChange`로 240px↔64px 상태를 제어한다.
- Produces `role="complementary"`와 `aria-label="워크스페이스 사이드바"`를 루트에 설정한다.
- Produces `aria-expanded`, `aria-haspopup="listbox"`, `role=listbox`, `role=option`, `aria-selected` 접근성 상태를 제공한다.

기존 `workspaceName` prop은 선택된 `workspace.name`으로 대체하고, role 텍스트는 `owner`일 때 `소유자`, 그 외에는 `멤버`로 표시한다. 기존 `workspaceMembers`, `activeNav`, `onNavChange`, `onLogout` prop은 유지한다.

테스트 파일에는 다음 최소 fixture와 필수 callback을 둔다.

```tsx
const workspaceFixture: WorkspaceSummary = {
  id: 'workspace-1',
  name: 'My Workspace',
  ownerId: 'user-1',
  isDefault: true,
  createdAt: '2026-09-08T00:00:00.000Z',
  updatedAt: '2026-09-08T00:00:00.000Z',
  role: 'owner',
}

const sidebarFixture = {
  workspace: workspaceFixture,
  workspaces: [
    workspaceFixture,
    {
      ...workspaceFixture,
      id: 'workspace-2',
      name: '브랜드 스튜디오',
      role: 'member' as const,
    },
  ],
  selectedWorkspaceId: 'workspace-1',
  workspaceMembers: [
    { id: 'user-1', name: '테스터', presenceIndex: 1 },
  ],
  activeNav: 'projects' as const,
  onNavChange: vi.fn(),
  onWorkspaceChange: vi.fn(),
  onCreateWorkspace: vi.fn(),
  onLogout: vi.fn(),
  userName: '테스터',
  userEmail: 'user@in2white.team',
}
```

- [ ] **Step 1: 전환·검색·폴딩·생성 액션의 실패 테스트 작성**

```tsx
it('워크스페이스 버튼을 열고 검색 결과를 선택한다', async () => {
  const onWorkspaceChange = vi.fn()
  render(<Sidebar {...sidebarFixture} onWorkspaceChange={onWorkspaceChange} />)

  await userEvent.click(screen.getByRole('button', { name: 'My Workspace' }))
  await userEvent.type(screen.getByRole('searchbox', { name: '워크스페이스 검색' }), '브랜드')

  expect(screen.getByRole('option', { name: /브랜드 스튜디오/ })).toBeVisible()
  expect(screen.queryByRole('option', { name: /My Workspace/ })).not.toBeInTheDocument()

  await userEvent.click(screen.getByRole('option', { name: /브랜드 스튜디오/ }))
  expect(onWorkspaceChange).toHaveBeenCalledWith('workspace-2')
})

it('폴딩하면 64px 사이드바와 메뉴 툴팁을 사용한다', async () => {
  render(<Sidebar {...sidebarFixture} collapsed={false} />)

  await userEvent.click(screen.getByRole('button', { name: '사이드바 접기' }))

  expect(screen.getByRole('complementary', { name: '워크스페이스 사이드바' })).toHaveClass(
    'w-(--layout-sidebar-width-collapsed)',
  )
  expect(screen.getByRole('button', { name: '프로젝트' })).toBeInTheDocument()
})
```

- [ ] **Step 2: 테스트가 기능 부재로 실패하는지 확인**

실행: `pnpm --dir frontend exec vitest run src/shared/ui/sidebar.test.tsx`

기대 결과: 워크스페이스 목록 prop과 전환 popover가 없어서 실패한다.

- [ ] **Step 3: 기존 Sidebar에 워크스페이스 상태와 접힘 동작을 연결**

구현 규칙:

1. `collapsed`가 false면 현재 워크스페이스 이름·role·아바타를 240px 레일 상단에 표시한다.
2. 워크스페이스 버튼은 `aria-haspopup="listbox"`와 `aria-expanded`를 갖고, 내부에 검색어를 `useState`로 관리하는 272×320 팝오버를 연다.
3. 검색은 `workspace.name.toLocaleLowerCase()`와 입력값을 비교하고, 항목 선택 시 `onWorkspaceChange(workspace.id)` 호출 후 팝오버를 닫고 검색어를 초기화한다.
4. 팝오버 바깥 pointerdown과 Escape 키에서 닫는다.
5. `collapsed`가 true면 워크스페이스 이름 대신 로고 버튼을 보여주고, 선택 팝오버는 `left-full top-0 ml-2`로 사이드바 오른쪽에 둔다. 펼친 상태에서는 `top-full left-0 mt-2`로 워크스페이스 버튼 아래에 둔다.
6. 기존 프로젝트·멤버·설정·로그아웃 버튼은 유지하며, 접힌 상태에서는 기존 `Tooltip`을 사용한다.
7. `새 워크스페이스 생성` 버튼은 `onCreateWorkspace`를 호출한다.

- [ ] **Step 4: Sidebar 테스트가 통과하는지 확인**

실행: `pnpm --dir frontend exec vitest run src/shared/ui/sidebar.test.tsx`

기대 결과: 전환, 검색, 선택, 폴딩, 툴팁, 생성 액션 테스트가 통과한다.

---

### Task 4: 워크스페이스 생성 모달

**Files:**

- Create: `frontend/src/features/workspace/ui/WorkspaceCreateDialog.tsx`
- Create: `frontend/src/features/workspace/ui/WorkspaceCreateDialog.test.tsx`
- Modify: `frontend/src/shared/constants/messages.ts`

**Interfaces:**

- Consumes `open`, `onOpenChange`, `onSubmit(name: string)`, `loading`, `error` props
- Produces an accessible dialog titled `새 워크스페이스 만들기`

- [ ] **Step 1: 필수 입력·취소·제출·로딩·에러 표시 실패 테스트 작성**

```tsx
it('이름이 비어 있으면 제출하지 않고 필수 오류를 표시한다', async () => {
  const onSubmit = vi.fn()
  render(<WorkspaceCreateDialog open onOpenChange={vi.fn()} onSubmit={onSubmit} />)

  await userEvent.click(screen.getByRole('button', { name: '만들기' }))

  expect(screen.getByText('워크스페이스 이름을 입력해주세요')).toBeInTheDocument()
  expect(onSubmit).not.toHaveBeenCalled()
})

it('유효한 이름은 공백을 제거해 제출한다', async () => {
  const onSubmit = vi.fn()
  render(<WorkspaceCreateDialog open onOpenChange={vi.fn()} onSubmit={onSubmit} />)

  await userEvent.type(screen.getByLabelText('이름'), '  새 팀  ')
  await userEvent.click(screen.getByRole('button', { name: '만들기' }))

  expect(onSubmit).toHaveBeenCalledWith('새 팀')
})

it('생성 중에는 버튼을 비활성화한다', async () => {
  const onSubmit = vi.fn()
  render(
    <WorkspaceCreateDialog
      open
      onOpenChange={vi.fn()}
      onSubmit={onSubmit}
      loading
    />,
  )

  expect(screen.getByRole('button', { name: '만들기' })).toBeDisabled()
})

it('생성 오류를 모달 안에 표시한다', () => {
  render(
    <WorkspaceCreateDialog
      open
      onOpenChange={vi.fn()}
      onSubmit={vi.fn()}
      error="워크스페이스를 만들지 못했어요"
    />,
  )

  expect(screen.getByText('워크스페이스를 만들지 못했어요')).toBeInTheDocument()
})
```

- [ ] **Step 2: 테스트가 먼저 실패하는지 확인**

실행: `pnpm --dir frontend exec vitest run src/features/workspace/ui/WorkspaceCreateDialog.test.tsx`

기대 결과: 컴포넌트와 `WORKSPACE_NAME_REQUIRED` 문구가 없어 실패한다.

- [ ] **Step 3: Figma 규격으로 Dialog 구현**

구현 규칙:

1. 기존 `Dialog`, `DialogContent`, `DialogTitle`, `DialogFooter`, `Input`, `Button`을 사용한다.
2. `DialogContent`에 `max-w-90 p-8`을 적용해 360px 폭과 32px 패딩을 맞춘다.
3. 제목은 `새 워크스페이스 만들기`, 레이블은 `이름`, placeholder는 `예: 마케팅팀`으로 고정한다.
4. `name.trim()`이 비어 있으면 `워크스페이스 이름을 입력해주세요`를 입력 아래 표시하고 제출하지 않는다.
5. `취소`는 `onOpenChange(false)`를 호출하며, `만들기`는 trim된 이름을 `onSubmit`으로 전달한다.
6. 외부 생성 오류는 `워크스페이스를 만들지 못했어요`를 모달 안에 표시한다.

- [ ] **Step 4: 모달 테스트 통과 확인**

실행: `pnpm --dir frontend exec vitest run src/features/workspace/ui/WorkspaceCreateDialog.test.tsx`

기대 결과: 검증·제출·로딩·에러 테스트가 통과한다.

---

### Task 5: HomePage에 실제 API와 사이드바 연결

**Files:**

- Modify: `frontend/src/pages/home/ui/HomePage.tsx`
- Modify: `frontend/src/pages/home/ui/HomePage.test.tsx`

**Interfaces:**

- Consumes `useSessionStore`, `useWorkspaces`, `useCreateWorkspace`, `Sidebar`, `WorkspaceCreateDialog`
- Produces a page shell with `Sidebar`, project content heading, active navigation state, and selected workspace state

HomePage 테스트는 실제 React Query wrapper를 사용하되 `@/features/workspace`의 두 훅을 mock한다. `useWorkspaces` mock은 `[workspaceFixture]`와 `isLoading: false`, `isError: false`, `refetch: vi.fn()`을 반환하고, `useCreateWorkspace` mock은 `mutateAsync`가 `createdWorkspaceFixture`를 반환하도록 한다. 이 경계는 API·훅 테스트와 페이지 조합 테스트를 분리한다.

테스트 파일에는 다음 fixture와 mock 함수를 선언한다.

```tsx
const userFixture = {
  id: 'user-1',
  name: '테스터',
  email: 'user@in2white.team',
}

const workspaceFixture: WorkspaceSummary = {
  id: 'workspace-1',
  name: 'My Workspace',
  ownerId: 'user-1',
  isDefault: true,
  createdAt: '2026-09-08T00:00:00.000Z',
  updatedAt: '2026-09-08T00:00:00.000Z',
  role: 'owner',
}

const createdWorkspaceFixture: WorkspaceSummary = {
  ...workspaceFixture,
  id: 'workspace-2',
  name: '새 팀',
  isDefault: false,
}

const mockUseWorkspaces = vi.fn()
const mockUseCreateWorkspace = vi.fn()
```

- [ ] **Step 1: API 결과가 사이드바에 표시되고 생성 성공 후 선택되는 실패 테스트 작성**

```tsx
it('워크스페이스를 불러와 사이드바에 표시하고 생성한 워크스페이스를 선택한다', async () => {
  useSessionStore.getState().setSession('token-1', userFixture)
  const mutateAsync = vi.fn().mockResolvedValue(createdWorkspaceFixture)
  mockUseWorkspaces.mockReturnValue({
    data: [workspaceFixture],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  })
  mockUseCreateWorkspace.mockReturnValue({
    mutateAsync,
    isPending: false,
    error: null,
  })

  renderHomePage()

  expect(await screen.findByRole('button', { name: 'My Workspace' })).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'My Workspace' }))
  await userEvent.click(screen.getByRole('button', { name: '새 워크스페이스 생성' }))
  await userEvent.type(screen.getByLabelText('이름'), '새 팀')
  await userEvent.click(screen.getByRole('button', { name: '만들기' }))

  await waitFor(() =>
    expect(screen.getByRole('button', { name: '새 팀' })).toBeInTheDocument(),
  )
  expect(mutateAsync).toHaveBeenCalledWith('새 팀')
})
```

- [ ] **Step 2: HomePage 테스트를 실행해 기존 placeholder와 새 동작의 불일치 확인**

실행: `pnpm --dir frontend exec vitest run src/pages/home/ui/HomePage.test.tsx`

기대 결과: 기존 `시작하기` placeholder assertion을 새 사이드바 계약으로 바꾸기 전에는 실패한다.

- [ ] **Step 3: HomePage 조합 구현**

구현 규칙:

1. `useSessionStore`에서 access token과 사용자 정보를 읽는다.
2. `useWorkspaces(accessToken)`으로 목록을 조회하고, `isDefault`가 true인 항목을 우선 선택한다. 기본 항목이 없으면 목록 첫 항목을 선택한다.
3. 목록이 바뀌어 현재 선택 ID가 없어지면 같은 규칙으로 선택 ID를 보정한다.
4. `useCreateWorkspace` mutation을 `WorkspaceCreateDialog`에 연결하고 성공한 결과 ID를 선택한다.
5. `collapsed`와 `activeNav`는 HomePage local state로 관리하며 Sidebar의 callback을 연결한다.
6. 화면 본문은 우선 `프로젝트` 제목과 선택된 워크스페이스 이름을 표시해 사이드바 선택 결과를 확인할 수 있게 한다. 프로젝트 카드 구현은 추가하지 않는다.
7. 로딩·실패 상태는 계획 문서의 한국어 문구를 표시하고, `다시 시도`는 `refetch`를 호출한다.

- [ ] **Step 4: HomePage 테스트 통과 확인**

실행: `pnpm --dir frontend exec vitest run src/pages/home/ui/HomePage.test.tsx`

기대 결과: 조회·생성·선택 상태 테스트가 통과한다. 폴딩과 검색은 Task 3의 Sidebar 테스트에서 검증한다.

---

### Task 6: 전체 검증과 피그마 기준 확인

**Files:**

- Modify: 없음. 이 태스크는 검증만 수행한다.

- [ ] **Step 1: 프론트엔드 전체 테스트 실행**

실행: `pnpm --dir frontend test`

기대 결과: 모든 테스트 파일과 새 워크스페이스 테스트가 통과한다.

- [ ] **Step 2: 린트와 빌드 실행**

실행:

```bash
pnpm --dir frontend lint
pnpm --dir frontend build
```

기대 결과: 두 명령 모두 exit code 0이다.

- [ ] **Step 3: 로컬 화면에서 주요 상태 확인**

실행: `pnpm --dir frontend dev --host 127.0.0.1`

확인 항목:

1. 기본 화면에 240px 사이드바와 프로젝트 본문이 함께 보인다.
2. 워크스페이스 버튼을 누르면 272×320 팝오버가 사이드바를 가리지 않는 위치에 열린다.
3. 검색 결과가 없는 입력에는 `워크스페이스가 없습니다`가 보인다.
4. 새 워크스페이스 생성 모달의 제목·입력·취소·만들기 배치가 Figma와 같다.
5. 사이드바 접기 후 폭이 64px이 되고 메뉴 아이콘에 툴팁이 노출된다.
6. 브라우저 새로고침 없이 워크스페이스 전환·생성이 본문 선택 상태에 반영된다.

- [ ] **Step 4: 변경 범위와 공백 오류 확인**

실행: `git diff --check && git status --short`

기대 결과: 계획 범위 밖 변경이 없고 공백 오류가 없다. 커밋은 사용자가 요청할 때만 수행한다.
