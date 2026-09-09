# 프로젝트 목록 페이지 구현 계획

> **에이전트 작업자용:** 이 계획은 `superpowers:test-driven-development` 순서로 실행한다. 각 단계는 체크박스로 추적하고, production code보다 실패 테스트를 먼저 작성한다.

**목표:** Figma 기준 프로젝트 목록 화면을 구현하고, 로그인 직후 기본 workspace project route 진입, 접근 불가 workspace 전체 화면, workspace 생성 유지 동작과 기존 프로젝트 API·목록 상호작용을 완성한다.

**아키텍처:** `entities/project`가 HTTP 계약과 도메인 타입을 소유하고, `features/project`가 TanStack Query hook과 프로젝트 상호작용 UI를 소유한다. `pages/home`은 workspace 목록을 검증한 뒤 project shell 또는 Figma 접근 불가 전체 화면을 선택하며, 로그인 feature는 인증 직후 workspace 목록을 조회해 canonical route로 이동한다.

**기술 스택:** Vite, React 19, TypeScript, TanStack Query, Axios, Tailwind CSS v4, Radix UI, Vitest, Testing Library, Pretendard.

**설계 문서:** [`docs/superpowers/specs/2026-09-09-project-list-page-design.md`](../specs/2026-09-09-project-list-page-design.md)

**상태:** 보완 구현 및 검증 완료 (2026-09-09)

## 전역 제약

- 기본 라우트는 기존 `/`를 유지하되 로그인 성공 직후에는 거치지 않는다.
- `/`는 기존 세션 사용자의 직접 접근을 기본 workspace project route로 redirect하는 호환 진입 route다.
- 프로젝트 목록 canonical route는 `/workspaces/$workspaceId/projects`이고 `/workspaces/$workspaceId` route는 추가하지 않는다.
- `workspaces`, `projects`는 복수형 resource명으로 사용하고 `$workspaceId`는 dynamic parameter로 사용한다.
- 프로젝트 API 경로는 `/workspaces/:workspaceId/projects`와 하위 `/:projectId`를 사용한다.
- 목록 기본 page size는 Figma 카드 수와 동일한 `6`이며, 검색은 `search` query parameter로 프로젝트 이름에 서버 포함 검색을 적용한다.
- 프로젝트 생성은 Owner와 Member 모두 가능하다.
- 프로젝트 수정·삭제는 Workspace Owner 또는 해당 프로젝트 Creator만 가능하다.
- Figma `125:158` 카드 그리드를 기본 뷰로 사용하고 `125:274` 테이블 뷰를 보조 뷰로 구현한다.
- 기존 `Sidebar`, `Button`, `Search`, `Pagination`, `Dialog`, `DropdownMenu`, `Card`, `Avatar`, `EmptyState`와 CSS 토큰을 우선 재사용한다.
- Figma `224:4748` 레이아웃을 기준으로 복제한 `325:2` 존재하지 않는 workspace 전체 화면은 `Users` 아이콘과 Empty State 전용 page component로 구현한다.
- workspace 목록에 없는 URL workspace ID는 project query를 호출하지 않고 접근 불가 화면을 표시한다.
- 새 workspace 생성 성공 후 현재 URL·선택 workspace·project query는 유지하고 Sidebar 목록만 갱신한다.
- 프로젝트 카드 그리드는 1440px에서 4열·280px 카드·12px gap을 유지하고 viewport 폭에 따라 3·2·1열로 줄인다.
- 로그인 성공 후 workspace 목록 조회 실패·빈 목록은 오류 toast를 표시하고 project route로 이동하지 않는다.
- 모든 사용자-facing 문구와 문서는 한국어로 작성한다.
- 새 Code Connect 매핑이나 백엔드·DB 변경은 추가하지 않는다.
- 사용자가 요청하기 전에는 Git commit, push, merge, PR을 실행하지 않는다.

---

### Task 1: 프로젝트 API entity와 타입 추가

**Files:**

- Create: `frontend/src/entities/project/api/project.ts`
- Create: `frontend/src/entities/project/api/project.test.ts`
- Create: `frontend/src/entities/project/index.ts`

**Interfaces:**

- Produces `Project`, `ProjectCreator`, `ProjectPagination`, `ListProjectsResponse`, `ProjectListParams`, `CreateProjectInput`, `UpdateProjectInput` 타입.
- Produces `listProjectsRequest(workspaceId, params, accessToken): Promise<ListProjectsResponse>`.
- Produces `createProjectRequest(workspaceId, input, accessToken): Promise<ProjectMutationProject>`.
- Produces `updateProjectRequest(workspaceId, projectId, input, accessToken): Promise<ProjectMutationProject>`.
- Produces `deleteProjectRequest(workspaceId, projectId, accessToken): Promise<void>`.

- [x] **Step 1: 실패하는 API 계약 테스트를 작성한다.**

`project.test.ts`에서 기존 `workspace.test.ts`와 동일하게 `axiosInstance`를 mock하고 다음을 검증한다.

```ts
it("프로젝트 목록 조회에 workspace, pagination, search, bearer token을 전달한다", async () => {
  vi.mocked(axiosInstance.get).mockResolvedValue({
    data: {
      projects: [],
      pagination: { page: 2, limit: 20, total: 0, totalPages: 0 },
    },
  });

  await listProjectsRequest(
    "workspace-1",
    { page: 2, limit: 20, search: "브랜드" },
    "token-1",
  );

  expect(axiosInstance.get).toHaveBeenCalledWith(
    "/workspaces/workspace-1/projects",
    {
      params: { page: 2, limit: 20, search: "브랜드" },
      headers: { Authorization: "Bearer token-1" },
    },
  );
});

it("프로젝트 생성·수정·삭제 요청의 경로와 body를 계약대로 만든다", async () => {
  vi.mocked(axiosInstance.post).mockResolvedValue({
    data: { project: projectFixture },
  });
  vi.mocked(axiosInstance.patch).mockResolvedValue({
    data: { project: projectFixture },
  });
  vi.mocked(axiosInstance.delete).mockResolvedValue({ data: undefined });

  await createProjectRequest(
    "workspace-1",
    { name: "새 프로젝트", description: null },
    "token-1",
  );
  await updateProjectRequest(
    "workspace-1",
    "project-1",
    { name: "이름 변경" },
    "token-1",
  );
  await deleteProjectRequest("workspace-1", "project-1", "token-1");

  expect(axiosInstance.post).toHaveBeenCalledWith(
    "/workspaces/workspace-1/projects",
    { name: "새 프로젝트", description: null },
    { headers: { Authorization: "Bearer token-1" } },
  );
  expect(axiosInstance.patch).toHaveBeenCalledWith(
    "/workspaces/workspace-1/projects/project-1",
    { name: "이름 변경" },
    { headers: { Authorization: "Bearer token-1" } },
  );
  expect(axiosInstance.delete).toHaveBeenCalledWith(
    "/workspaces/workspace-1/projects/project-1",
    { headers: { Authorization: "Bearer token-1" } },
  );
});
```

- [x] **Step 2: 테스트가 구현 누락으로 실패하는지 확인한다.**

Run: `pnpm --dir frontend test -- src/entities/project/api/project.test.ts`

Expected: `FAIL` with missing project module/functions.

- [x] **Step 3: API 타입과 요청 함수를 구현한다.**

`axiosInstance`에 기존 workspace API와 같은 `Authorization` header를 사용하고, 목록 query에서 빈 검색어는 `search` 키를 생략한다. 응답은 `{ projects, pagination }`, `{ project }` envelope를 벗겨 반환한다.

- [x] **Step 4: 해당 테스트와 기존 entity 테스트가 통과하는지 확인한다.**

Run: `pnpm --dir frontend test -- src/entities/project/api/project.test.ts src/entities/workspace/api/workspace.test.ts`

Expected: `PASS`.

- [x] **Step 5: entity barrel export를 확인한다.**

`frontend/src/entities/project/index.ts`에서 API 함수와 public type만 export하고 내부 구현은 노출하지 않는다.

### Task 2: 프로젝트 TanStack Query hook 추가

**Files:**

- Create: `frontend/src/features/project/model/use-projects.ts`
- Create: `frontend/src/features/project/model/use-projects.test.tsx`
- Create: `frontend/src/features/project/index.ts`

**Interfaces:**

- Produces `useProjects(accessToken, workspaceId, params)`.
- Produces `useCreateProject(accessToken, workspaceId)`.
- Produces `useUpdateProject(accessToken, workspaceId)`.
- Produces `useDeleteProject(accessToken, workspaceId)`.
- 모든 mutation 성공 후 `['projects', workspaceId]` query를 무효화한다.

- [x] **Step 1: query key와 mutation invalidation 실패 테스트를 작성한다.**

`use-projects.test.tsx`에서 `entities/project`의 네 API 함수를 mock하고 다음을 검증한다.

```ts
it("workspace와 list params로 프로젝트를 조회한다", async () => {
  vi.mocked(listProjectsRequest).mockResolvedValue(projectListFixture);
  const queryClient = createTestQueryClient();

  const { result } = renderHook(
    () =>
      useProjects("token-1", "workspace-1", { page: 1, limit: 20, search: "" }),
    { wrapper: createQueryClientWrapper(queryClient) },
  );

  await waitFor(() => expect(result.current.data).toEqual(projectListFixture));
  expect(listProjectsRequest).toHaveBeenCalledWith(
    "workspace-1",
    { page: 1, limit: 20, search: "" },
    "token-1",
  );
});

it("생성·수정·삭제 성공 시 workspace 프로젝트 query를 무효화한다", async () => {
  const queryClient = createTestQueryClient();
  const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
  vi.mocked(createProjectRequest).mockResolvedValue(projectFixture);
  vi.mocked(updateProjectRequest).mockResolvedValue(projectFixture);
  vi.mocked(deleteProjectRequest).mockResolvedValue();

  const { result } = renderHook(
    () => ({
      create: useCreateProject("token-1", "workspace-1"),
      update: useUpdateProject("token-1", "workspace-1"),
      remove: useDeleteProject("token-1", "workspace-1"),
    }),
    { wrapper: createQueryClientWrapper(queryClient) },
  );

  await act(async () => {
    await result.current.create.mutateAsync({
      name: "새 프로젝트",
      description: null,
    });
    await result.current.update.mutateAsync({
      projectId: "project-1",
      input: { name: "변경" },
    });
    await result.current.remove.mutateAsync("project-1");
  });

  expect(invalidateQueries).toHaveBeenCalledWith({
    queryKey: ["projects", "workspace-1"],
  });
});
```

- [x] **Step 2: hook 테스트가 실패하는지 확인한다.**

Run: `pnpm --dir frontend test -- src/features/project/model/use-projects.test.tsx`

Expected: `FAIL` because hooks and feature exports do not exist.

- [x] **Step 3: 조회 hook과 mutation hook을 최소 구현한다.**

조회 hook은 `workspaceId`, `accessToken`이 없으면 disabled로 설정하고, query key에 `workspaceId`와 `params`를 포함한다. mutation은 API 함수에 필요한 경로·token을 주입하고 성공 시 workspace 범위 query를 invalidate한다.

- [x] **Step 4: hook 테스트를 통과시킨다.**

Run: `pnpm --dir frontend test -- src/features/project/model/use-projects.test.tsx`

Expected: `PASS`.

### Task 3: 기본 워크스페이스 redirect와 project route 추가

**Files:**

- Create: `frontend/src/pages/workspace-redirect/index.ts`
- Create: `frontend/src/pages/workspace-redirect/ui/WorkspaceRedirectPage.tsx`
- Create: `frontend/src/pages/workspace-redirect/ui/WorkspaceRedirectPage.test.tsx`
- Create: `frontend/src/routes/workspaces/$workspaceId/projects.tsx`
- Create: `frontend/src/routes/workspaces/$workspaceId/projects.test.tsx`
- Modify: `frontend/src/routes/index.tsx`
- Verify: `frontend/src/routes/index.test.tsx`의 기존 인증 guard 테스트
- Modify: `frontend/src/pages/home/ui/HomePage.tsx`
- Modify: `frontend/src/pages/home/ui/HomePage.test.tsx`

**Interfaces:**

- `WorkspaceRedirectPage`는 `accessToken`, `user`, `navigate` callback을 props로 받고 내부에서 `useWorkspaces`를 호출한다.
- `HomePage`는 `workspaceId?: string`, `onWorkspaceChange?: (workspaceId: string) => void` props를 받는다.
- `src/routes/index.tsx`의 `/` route는 `redirectIfUnauthenticated`를 유지하고 `WorkspaceRedirectPage`를 렌더링한다.
- `src/routes/workspaces/$workspaceId/projects.tsx`는 `Route.useParams()`의 `$workspaceId`를 `HomePage`에 전달한다.
- route module은 `PROJECTS_ROUTE = '/workspaces/$workspaceId/projects' as const`를 export해 path 계약을 테스트할 수 있게 한다.

- [x] **Step 1: root redirect와 canonical route의 실패 테스트를 작성한다.**

기존 `redirectIfUnauthenticated` 테스트를 유지하면서 다음을 추가한다.

```ts
it('인증된 root 진입은 기본 workspace project route로 이동한다', async () => {
  const navigate = vi.fn()
  mockUseWorkspaces.mockReturnValue({
    data: [otherWorkspaceFixture, defaultWorkspaceFixture],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  })

  render(
    <WorkspaceRedirectPage
      accessToken="token-1"
      user={userFixture}
      navigate={navigate}
    />,
  )

  await waitFor(() =>
    expect(navigate).toHaveBeenCalledWith({
      to: '/workspaces/$workspaceId/projects',
      params: { workspaceId: 'workspace-default' },
    }),
  )
})

it('canonical project route는 복수형 resource 경로를 사용한다', () => {
  expect(PROJECTS_ROUTE).toBe('/workspaces/$workspaceId/projects')
})
```

`WorkspaceRedirectPage`는 테스트에서 `navigate` callback을 주입할 수 있게 설계한다. root route에는 별도 workspace home component를 연결하지 않는다.

- [x] **Step 2: route 테스트가 새 component/path 누락으로 실패하는지 확인한다.**

Run: `pnpm --dir frontend test -- 'src/pages/workspace-redirect/ui/WorkspaceRedirectPage.test.tsx' 'src/routes/workspaces/$workspaceId/projects.test.tsx'`

Expected: `FAIL` because the redirect page and dynamic project route do not exist.

- [x] **Step 3: root redirect page를 구현한다.**

`WorkspaceRedirectPage`는 `isDefault` workspace를 우선 선택하고 없으면 첫 workspace를 fallback으로 사용한다. 로딩 중에는 `워크스페이스로 이동하는 중`, 오류 중에는 `워크스페이스로 이동하지 못했어요`와 `다시 시도`를 표시한다. workspace가 준비되면 `navigate({ to: '/workspaces/$workspaceId/projects', params: { workspaceId } })`를 호출한다.

- [x] **Step 4: dynamic project route와 workspace navigation을 구현한다.**

`src/routes/workspaces/$workspaceId/projects.tsx`의 route component가 `useNavigate`로 Sidebar의 workspace 변경을 같은 canonical route로 이동시킨다. `HomePage`는 전달받은 `workspaceId`를 선택 workspace 초기값으로 사용하고, 기존 `/`에서 렌더링되던 project placeholder를 route 기반 목록 콘텐츠로 교체한다.

- [x] **Step 5: 기존 route/home 테스트와 새 route 테스트를 통과시킨다.**

Run: `pnpm --dir frontend test -- src/routes/index.test.tsx 'src/routes/workspaces/$workspaceId/projects.test.tsx' src/pages/workspace-redirect/ui/WorkspaceRedirectPage.test.tsx src/pages/home/ui/HomePage.test.tsx`

Expected: `PASS`.

### Task 4: 프로젝트 생성·수정·삭제 상호작용 UI 추가

**Files:**

- Create: `frontend/src/features/project/ui/ProjectFormDialog.tsx`
- Create: `frontend/src/features/project/ui/ProjectDeleteDialog.tsx`
- Create: `frontend/src/features/project/ui/ProjectFormDialog.test.tsx`
- Create: `frontend/src/features/project/ui/ProjectDeleteDialog.test.tsx`
- Modify: `frontend/src/shared/constants/messages.ts`

**Interfaces:**

- `ProjectFormDialog` props:

```ts
type ProjectFormDialogProps = {
  open: boolean;
  title: string;
  submitLabel: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: { name: string; description: string | null }) => void;
  initialName?: string;
  initialDescription?: string | null;
  loading?: boolean;
  error?: string;
};
```

- `ProjectDeleteDialog` props:

```ts
type ProjectDeleteDialogProps = {
  open: boolean;
  projectName: string;
  loading?: boolean;
  error?: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};
```

- [x] **Step 1: 폼 validation과 submit의 실패 테스트를 작성한다.**

`ProjectFormDialog.test.tsx`에서 이름 required/trim, 이름 50자 제한, 설명 200자 제한, 수정 초기값, loading/error/cancel을 검증한다. `ProjectDeleteDialog.test.tsx`에서는 대상 프로젝트명, 확인·취소, loading/error를 검증한다.

```ts
it('이름이 비어 있으면 submit하지 않고 오류를 표시한다', async () => {
  const onSubmit = vi.fn()
  render(<ProjectFormDialog open title="새 프로젝트 만들기" submitLabel="만들기" onOpenChange={vi.fn()} onSubmit={onSubmit} />)

  await userEvent.click(screen.getByRole('button', { name: '만들기' }))

  expect(screen.getByText('프로젝트 이름을 입력해주세요')).toBeInTheDocument()
  expect(onSubmit).not.toHaveBeenCalled()
})

it('이름과 설명을 trim한 뒤 생성 callback에 전달한다', async () => {
  const onSubmit = vi.fn()
  render(<ProjectFormDialog open title="새 프로젝트 만들기" submitLabel="만들기" onOpenChange={vi.fn()} onSubmit={onSubmit} />)

  await userEvent.type(screen.getByLabelText('이름'), '  새 프로젝트  ')
  await userEvent.type(screen.getByLabelText('설명 (선택)'), '  설명  ')
  await userEvent.click(screen.getByRole('button', { name: '만들기' }))

  expect(onSubmit).toHaveBeenCalledWith({ name: '새 프로젝트', description: '설명' })
})

it('수정 모드에서는 기존 값을 표시하고 저장 버튼을 사용한다', () => {
  render(
    <ProjectFormDialog
      open
      title="프로젝트 수정"
      submitLabel="저장"
      onOpenChange={vi.fn()}
      onSubmit={vi.fn()}
      initialName="기존 이름"
      initialDescription="기존 설명"
    />,
  )

  expect(screen.getByDisplayValue('기존 이름')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '저장' })).toBeInTheDocument()
})
```

- [x] **Step 2: 폼 테스트가 validation 누락으로 실패하는지 확인한다.**

Run: `pnpm --dir frontend test -- src/features/project/ui/ProjectFormDialog.test.tsx src/features/project/ui/ProjectDeleteDialog.test.tsx`

Expected: `FAIL` because dialog components do not exist.

- [x] **Step 3: 기존 Dialog/Input/Textarea/Button 토큰으로 폼을 구현한다.**

이름은 client-side에서 trim 후 1~50자를 검사하고, 설명은 trim 후 빈 값이면 `null`, 200자 초과면 오류로 처리한다. Figma 기준 `max-w-90`(360px) 모달을 사용한다. `loading` 중에는 생성/저장과 닫기를 막고 `aria-busy`를 전달한다. `error`는 폼 안에 `role="alert"`로 표시한다.

- [x] **Step 4: 삭제 확인 dialog와 mutation 실패 경계를 구현한다.**

삭제 확인 문구는 프로젝트명과 되돌릴 수 없다는 안내를 포함하고, 확인 버튼은 `삭제`로 표시한다. Dialog 자체는 삭제 mutation을 직접 호출하지 않고 callback만 호출한다.

- [x] **Step 5: UI 테스트를 통과시킨다.**

Run: `pnpm --dir frontend test -- src/features/project/ui/ProjectFormDialog.test.tsx src/features/project/ui/ProjectDeleteDialog.test.tsx`

Expected: `PASS`.

### Task 5: Figma 기준 프로젝트 카드와 테이블 renderer 구현

**Files:**

- Create: `frontend/src/features/project/ui/ProjectCard.tsx`
- Create: `frontend/src/features/project/ui/ProjectTable.tsx`
- Create: `frontend/src/features/project/ui/ProjectCard.test.tsx`
- Create: `frontend/src/features/project/lib/project-date.ts`

**Interfaces:**

- `ProjectCard`는 `project`, `canManage`, `onEdit`, `onDelete`를 받는다.
- `ProjectTable`는 `projects`, 프로젝트별 `canManage`, `onEdit`, `onDelete`를 받는다.
- `formatProjectCreatedAt(value)`는 `yyyy.MM.dd`, `formatProjectUpdatedAt(value)`는 한국어 상대 시간을 반환한다.

- [x] **Step 1: 날짜 formatter와 카드 접근성 실패 테스트를 작성한다.**

```ts
it('생성일은 점으로 구분된 날짜를 반환한다', () => {
  expect(formatProjectCreatedAt('2026-01-10T00:00:00.000Z')).toBe('2026.01.10')
})

it('권한이 있으면 카드 메뉴에서 수정과 삭제를 노출한다', async () => {
  render(
    <ProjectCard
      project={projectFixture}
      canManage
      onEdit={vi.fn()}
      onDelete={vi.fn()}
    />,
  )

  await userEvent.click(screen.getByRole('button', { name: '2026 브랜드 리뉴얼 메뉴' }))

  expect(screen.getByRole('menuitem', { name: '수정' })).toBeInTheDocument()
  expect(screen.getByRole('menuitem', { name: '삭제' })).toBeInTheDocument()
})
```

- [x] **Step 2: renderer 테스트가 구현 누락으로 실패하는지 확인한다.**

Run: `pnpm --dir frontend test -- src/features/project/ui/ProjectCard.test.tsx src/features/project/ui/ProjectTable.test.tsx`

Expected: `FAIL` because the renderer modules do not exist.

- [x] **Step 3: Figma 카드 geometry와 typography를 구현한다.**

카드는 `w-full`, `min-h-[204px]`, `rounded-md`, 1px `border-border-subtle`, `p-4`, `gap-2`를 사용한다. 카드 내부는 folder icon·menu trigger, title, description, date rows, divider, creator footer 순서를 지킨다. Figma와 동일하게 일반 카드에는 그림자를 사용하지 않는다.

- [x] **Step 4: 기존 아이콘과 Avatar를 재사용해 테이블을 구현한다.**

프로젝트 이름·생성자·생성일·수정일·메뉴 열을 가진 semantic `<table>`을 만들고, 좁은 화면에서는 상위 컨테이너가 가로 스크롤한다. Figma의 `Folder`, `MoreVertical`, `CalendarDays`, `Clock3`, `List`, `LayoutGrid`와 glyph가 일치하는 기존 `lucide-react` 아이콘을 사용한다.

- [x] **Step 5: renderer 테스트를 통과시킨다.**

Run: `pnpm --dir frontend test -- src/features/project/ui/ProjectCard.test.tsx src/features/project/ui/ProjectTable.test.tsx`

Expected: `PASS`.

### Task 6: 프로젝트 목록 콘텐츠와 Figma toolbar 구현

**Files:**

- Create: `frontend/src/features/project/ui/ProjectListContent.tsx`
- Create: `frontend/src/features/project/ui/ProjectListContent.test.tsx`
- Modify: `frontend/src/pages/home/ui/HomePage.tsx`

**Interfaces:**

- `ProjectListContent` props:

```ts
type ProjectListContentProps = {
  accessToken: string;
  workspaceId: string;
  userId: string;
  workspaceRole?: "owner" | "member";
};
```

- `ProjectListContent`가 `useProjects`, `useCreateProject`, `useUpdateProject`, `useDeleteProject`를 조합한다.
- `HomePage`는 기존 Sidebar와 workspace selection을 유지하고, main 영역에 `ProjectListContent`를 렌더링한다.

- [x] **Step 1: 프로젝트 목록 콘텐츠 실패 테스트를 작성한다.**

`ProjectListContent.test.tsx`에서 hooks를 mock하고 다음을 검증한다.

```ts
it('프로젝트 목록을 카드로 표시하고 기본 그리드 버튼을 활성화한다', () => {
  mockUseProjects.mockReturnValue({
    data: projectListFixture,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  })

  render(<ProjectListContent accessToken="token-1" workspaceId="workspace-1" userId="user-1" workspaceRole="owner" />)

  expect(screen.getByRole('heading', { name: '프로젝트' })).toBeInTheDocument()
  expect(screen.getByText('2026 브랜드 리뉴얼')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '카드 보기' })).toHaveAttribute('aria-pressed', 'true')
})

it('검색어를 입력하면 검색 상태를 갱신하고 목록 query에 전달한다', async () => {
  mockUseProjects.mockReturnValue({ data: projectListFixture, isLoading: false, isError: false, refetch: vi.fn() })
  render(<ProjectListContent accessToken="token-1" workspaceId="workspace-1" userId="user-1" workspaceRole="owner" />)

  await userEvent.type(screen.getByRole('searchbox', { name: '프로젝트 검색' }), '브랜드')

  expect(mockUseProjects).toHaveBeenLastCalledWith(
    'token-1',
    'workspace-1',
    { page: 1, limit: 6, search: '브랜드' },
  )
})
```

- [x] **Step 2: 콘텐츠 테스트가 컴포넌트 누락으로 실패하는지 확인한다.**

Run: `pnpm --dir frontend test -- src/features/project/ui/ProjectListContent.test.tsx`

Expected: `FAIL` because the content component does not exist.

- [x] **Step 3: Figma page header와 toolbar를 구현한다.**

main 영역은 기존 Sidebar 옆에서 `min-w-0 flex-1`로 확장하고 `px-5 py-6`을 사용한다. 상단에는 `프로젝트` heading, 320px 검색 필드, 카드/테이블 view toggle, `프로젝트 생성` primary button을 둔다.

- [x] **Step 4: 조회·로딩·오류·빈 상태와 pagination을 연결한다.**

조회 중에는 카드 영역에 `Skeleton` 또는 `프로젝트 불러오는 중`을 표시한다. 실패 시 `다시 시도` 버튼을 연결하고, 결과가 비면 `EmptyState`와 생성 action을 표시한다. pagination은 기존 shared component로 `pagination.page`, `pagination.totalPages`를 사용한다.

- [x] **Step 5: 생성·수정·삭제 callback과 permission을 연결한다.**

`workspaceRole === 'owner' || project.creatorId === userId`일 때만 카드/행 메뉴를 제공한다. 생성·수정·삭제 성공은 각각 `toast.success`와 해당 dialog close를 수행한다. mutation error는 모달 안의 화면 오류로 표시한다.

- [x] **Step 6: HomePage의 기존 workspace shell과 통합한다.**

기존 workspace 생성 dialog·sidebar 동작·로그아웃은 유지한다. 선택된 workspace가 바뀌면 `ProjectListContent`의 page를 1로 초기화하도록 key 또는 props state를 사용하고, workspace가 없으면 프로젝트 조회를 disabled로 둔다.

- [x] **Step 7: 콘텐츠와 기존 home 테스트를 통과시킨다.**

Run: `pnpm --dir frontend test -- src/features/project/ui/ProjectListContent.test.tsx src/pages/home/ui/HomePage.test.tsx`

Expected: `PASS`.

### Task 7: TDD 회귀 보강 및 정적 검증

**Files:**

- Modify: `frontend/src/pages/home/ui/HomePage.test.tsx`
- Modify: `frontend/src/features/project/model/use-projects.test.tsx`
- Modify: `frontend/src/entities/project/api/project.test.ts`
- Modify: `docs/superpowers/plans/2026-09-09-project-list-page-implementation-plan.md`

- [x] **Step 1: 회귀 테스트를 추가한다.**

다음 사용자 흐름을 실제 DOM 상호작용으로 검증한다.

1. 카드 보기에서 테이블 보기로 전환한다.
2. 페이지 2를 누르면 `page: 2`로 hook이 다시 호출된다.
3. 생성 dialog에서 성공 callback 후 새 프로젝트 생성 버튼이 유지된다.
4. 권한 없는 member project에는 수정/삭제 메뉴가 없다.
5. 삭제 확인 dialog의 취소는 delete mutation을 호출하지 않는다.
6. 목록 조회 실패 후 다시 시도 버튼이 `refetch`를 호출한다.

- [x] **Step 2: 전체 프론트엔드 테스트를 실행한다.**

Run: `pnpm --dir frontend test`

Expected: 모든 test file과 test가 `PASS`이고, 기존 route-file 제외 warning 외의 오류가 없다.

- [x] **Step 3: lint와 build를 실행한다.**

Run: `pnpm --dir frontend lint`

Expected: exit code `0`.

Run: `pnpm --dir frontend build`

Expected: TypeScript build와 Vite production build가 exit code `0`.

- [x] **Step 4: formatting과 diff 검사를 실행한다.**

Run: `pnpm --dir frontend format:check`

Expected: 모든 파일이 Prettier 검사를 통과한다.

Run: `git diff --check`

Expected: whitespace error가 없다.

- [x] **Step 5: 계획 문서의 `Implementation Results`를 실제 결과로 갱신한다.**

다음 항목을 한국어로 기록한다.

- 실제 추가·수정한 파일과 동작
- 계획과 달라진 점 및 이유
- 실행한 검증 명령과 exit/result
- 남은 후속 작업 또는 확인이 필요한 항목

### Task 8: 최종 코드 리뷰와 완료 전 검증

**Files:**

- Review only: `git diff` 전체
- Update if needed: Task 1~6의 해당 파일

- [x] **Step 1: 현재 변경 범위를 확인한다.**

Run: `git status --short` and `git diff --stat`

Expected: 프로젝트 목록 기능과 설계·계획 문서만 변경 목록에 포함된다.

- [x] **Step 2: `requesting-code-review` 기준으로 최종 리뷰를 요청한다.**

리뷰어에게 다음을 전달한다.

- 요구사항: 설계 문서와 Figma `125:158` 기준 UI/동작
- 확인할 계약: 프로젝트 API 경로, query invalidation, Owner/Creator 권한, 오류 상태, 접근성
- 기준 diff: 현재 `HEAD`와 작업 시작 시점의 `HEAD`

Critical/Important 지적은 수정 후 관련 테스트를 다시 실행한다. Minor 지적은 계획 문서의 후속 작업에 기록한다.

- [x] **Step 3: 완료 전 fresh verification을 실행한다.**

`superpowers:verification-before-completion` 규칙에 따라 아래 명령의 최신 결과를 확인한 뒤에만 완료를 보고한다.

```bash
pnpm --dir frontend test
pnpm --dir frontend lint
pnpm --dir frontend build
pnpm --dir frontend format:check
git diff --check
```

- [x] **Step 4: 사용자에게 결과를 보고한다.**

변경 파일 링크, 검증 결과, 계획과 실제 차이, 남은 후속 작업을 한국어로 간단히 보고한다. Commit·push·PR은 수행하지 않는다.

---

## 보완 구현 계획 (2026-09-09)

이번 보완은 사용자 승인된 요구사항을 기존 프로젝트 목록 기능에 반영한다. 아래 단계는 기존 완료 기록과 분리해 추적한다.

### Task 9: 로그인 성공 후 기본 workspace project route 직접 이동

**Files:**

- Create: `frontend/src/entities/workspace/lib/select-default-workspace.ts`
- Create: `frontend/src/entities/workspace/lib/select-default-workspace.test.ts`
- Modify: `frontend/src/entities/workspace/index.ts`
- Modify: `frontend/src/features/auth/ui/LoginForm.tsx`
- Modify: `frontend/src/features/auth/ui/LoginForm.test.tsx`
- Modify: `frontend/src/pages/workspace-redirect/ui/WorkspaceRedirectPage.tsx`

**Interfaces:**

- `selectDefaultWorkspace(workspaces: WorkspaceSummary[]): WorkspaceSummary | null`은 `isDefault` workspace를 우선하고 없으면 첫 workspace를 반환한다.
- LoginForm은 `useLogin().mutateAsync`의 access token으로 `listWorkspacesRequest`를 호출한 뒤 `/workspaces/$workspaceId/projects`로 navigate한다.

- [x] **Step 1: default 선택 helper와 LoginForm의 direct navigation 실패 테스트를 작성한다.**

`select-default-workspace.test.ts`에서 기본 workspace 우선·fallback·빈 목록을 검증한다. `LoginForm.test.tsx`에서 login POST와 workspace GET을 mock하고 성공 시 canonical route와 `replace: true`를 전달하는지 검증한다. workspace 조회가 실패하거나 목록이 비면 project route로 이동하지 않고 오류 toast를 표시한다.

- [x] **Step 2: 테스트가 기존 `navigate({ to: '/' })` 동작 때문에 실패하는지 확인한다.**

Run: `pnpm --dir frontend test -- src/features/auth/ui/LoginForm.test.tsx src/entities/workspace/lib/select-default-workspace.test.ts`

Expected: direct route assertion fails before production code is changed.

- [x] **Step 3: helper와 direct navigation을 구현한다.**

LoginForm은 login 성공 후 workspace 목록을 조회하고, 선택된 workspace가 있으면 `navigate`에 canonical route와 `replace: true`를 전달한다. workspace 조회 중에는 로그인 버튼의 loading 상태를 유지하고, 조회 실패·빈 목록에서는 이동하지 않는다. 기존 `/` root redirect는 직접 접근 호환용으로 유지한다.

- [x] **Step 4: workspace redirect page가 공통 helper를 사용하도록 정리한다.**

중복된 `isDefault ?? first` 선택 로직을 helper로 교체하고 기존 root redirect 테스트를 유지한다.

- [x] **Step 5: LoginForm·workspace helper 테스트를 통과시킨다.**

Run: `pnpm --dir frontend test -- src/features/auth/ui/LoginForm.test.tsx src/entities/workspace/lib/select-default-workspace.test.ts src/pages/workspace-redirect/ui/WorkspaceRedirectPage.test.tsx`

Expected: PASS.

### Task 10: 접근 불가 workspace 전체 화면 구현과 route 검증

**Files:**

- Create: `frontend/src/pages/workspace-access-denied/index.ts`
- Create: `frontend/src/pages/workspace-access-denied/ui/WorkspaceAccessDeniedPage.tsx`
- Create: `frontend/src/pages/workspace-access-denied/ui/WorkspaceAccessDeniedPage.test.tsx`
- Modify: `frontend/src/pages/home/ui/HomePage.tsx`
- Modify: `frontend/src/pages/home/ui/HomePage.test.tsx`
- Modify: `frontend/src/routes/workspaces/$workspaceId/projects.test.tsx`

**Interfaces:**

- `WorkspaceAccessDeniedPage`는 `workspaceName: string`, `onReturn: () => void`를 받고 Figma node `325:2`의 전체 화면을 렌더링한다.
- `HomePage`는 route의 `workspaceId`가 workspace 목록에 없으면 `ProjectListContent` 대신 `WorkspaceAccessDeniedPage`를 렌더링한다.

- [x] **Step 1: Figma 문구·복귀 동작과 invalid workspace query 차단 테스트를 작성한다.**

Figma 문구·button label·Users icon 렌더링을 확인하고, 알 수 없는 route workspace에서 `ProjectListContent`가 렌더링되지 않는지 검증한다.

```ts
expect(screen.getByText("존재하지 않는 워크스페이스예요")).toBeInTheDocument();
expect(
  screen.getByText("입력한 워크스페이스를 찾을 수 없어요"),
).toBeInTheDocument();
expect(screen.queryByTestId("project-list-content")).not.toBeInTheDocument();
```

- [x] **Step 2: 테스트가 아직 project list를 렌더링하는 동작으로 실패하는지 확인한다.**

Run: `pnpm --dir frontend test -- src/pages/workspace-access-denied/ui/WorkspaceAccessDeniedPage.test.tsx src/pages/home/ui/HomePage.test.tsx`

Expected: missing page module 또는 invalid workspace에서 project query 호출 assertion FAIL.

- [x] **Step 3: Figma 존재하지 않는 workspace page component를 구현한다.**

`325:2`의 `min-h-svh`, `bg-background-default`, 중앙 `w-90`, `px-6 py-12`, `gap-4`를 사용하고 `Users` icon, `존재하지 않는 워크스페이스예요`, `입력한 워크스페이스를 찾을 수 없어요`, secondary button을 배치한다. button label은 실제 fallback workspace 이름을 사용한다.

- [x] **Step 4: HomePage에서 workspace 검증을 project query보다 먼저 수행한다.**

workspace 목록 로딩 중에는 project query를 실행하지 않는다. 목록 로딩이 끝난 뒤 route ID가 목록에 없으면 full-screen denied page를 표시하고, 복귀 callback은 default workspace ID로 canonical route navigate를 호출한다. 정상 workspace에서는 기존 Sidebar와 project list를 유지한다.

- [x] **Step 5: route-level guard 테스트와 page 테스트를 통과시킨다.**

Run: `pnpm --dir frontend test -- src/pages/workspace-access-denied/ui/WorkspaceAccessDeniedPage.test.tsx src/pages/home/ui/HomePage.test.tsx 'src/routes/workspaces/$workspaceId/projects.test.tsx'`

Expected: PASS.

### Task 11: workspace 생성 유지·반응형 grid·API 타입 계약 보완

**Files:**

- Modify: `frontend/src/pages/home/ui/HomePage.tsx`
- Modify: `frontend/src/pages/home/ui/HomePage.test.tsx`
- Modify: `frontend/src/features/project/ui/ProjectListContent.tsx`
- Modify: `frontend/src/features/project/ui/ProjectListContent.test.tsx`
- Modify: `frontend/src/entities/project/api/project.ts`
- Modify: `frontend/src/entities/project/api/project.test.ts`

**Interfaces:**

- workspace 생성 성공 callback은 새 workspace를 목록에 추가하지만 `selectedWorkspaceId`와 URL을 변경하지 않는다.
- `ProjectMutationProject = Omit<Project, 'creator'>` 타입으로 backend POST/PATCH raw response를 표현한다.

- [x] **Step 1: workspace 생성 유지·responsive class·mutation response type 실패 테스트를 추가한다.**

현재 workspace에서 새 workspace를 생성한 뒤 Sidebar trigger가 기존 workspace명을 유지하는지 검증한다. Grid wrapper에 Figma 기준 4열 breakpoint class가 포함되는지 확인하고, API 함수의 mutation return type이 creator 없는 응답을 표현하도록 fixture를 조정한다.

- [x] **Step 2: 테스트가 현재 자동 선택·단일 grid class·full Project 타입과 충돌하는지 확인한다.**

Run: `pnpm --dir frontend test -- src/pages/home/ui/HomePage.test.tsx src/features/project/ui/ProjectListContent.test.tsx src/entities/project/api/project.test.ts`

Expected: workspace 생성 후 새 workspace 선택 assertion 또는 새 반응형/type assertion이 FAIL.

- [x] **Step 3: 새 workspace 생성 시 현재 workspace를 유지하도록 수정한다.**

`handleCreateWorkspace`에서 생성 workspace를 overlay에 추가하되 `setSelectedWorkspaceId(workspace.id)`를 제거한다. route workspace ID가 제공된 경우 URL과 project query는 그대로 유지한다. HomePage 테스트는 ProjectListContent를 mock해 project network query를 격리한다.

- [x] **Step 4: Figma 기준 grid와 반응형 breakpoint를 적용한다.**

ProjectListContent의 grid를 1440px에서 4열·12px gap·280px에 가까운 카드 폭이 나오도록 `min-[1360px]:grid-cols-4`, 중간 폭 3열, 작은 폭 2·1열로 구성한다. 카드 자체의 `h-[204px]`와 table 가로 스크롤은 유지한다.

- [x] **Step 5: mutation response 타입을 backend 계약에 맞춘다.**

생성·수정 API 반환 타입을 `ProjectMutationProject`로 변경한다. 목록 응답의 `Project` 타입에는 creator를 유지하고, 기존 query/mutation invalidation 동작은 변경하지 않는다.

- [x] **Step 6: 보완 테스트를 통과시킨다.**

Run: `pnpm --dir frontend test -- src/pages/home/ui/HomePage.test.tsx src/features/project/ui/ProjectListContent.test.tsx src/entities/project/api/project.test.ts`

Expected: PASS.

### Task 12: 보완 변경 최종 검증과 문서 결과 갱신

**Files:**

- Modify: `docs/superpowers/specs/2026-09-09-project-list-page-design.md`
- Modify: `docs/superpowers/plans/2026-09-09-project-list-page-implementation-plan.md`

- [x] **Step 1: 전체 테스트·정적 검증을 실행한다.**

Run: `pnpm --dir frontend test`, `pnpm --dir frontend exec tsc -b`, `pnpm --dir frontend lint`, `pnpm --dir frontend build`, `pnpm --dir frontend format:check`, `git diff --check`.

Expected: test·typecheck·lint·build·diff 검사가 통과한다. repository baseline 포맷 경고가 남으면 기존 파일 경로와 함께 기록한다. 실제로 포맷 검사에는 기존 파일 2개의 경고만 남았다.

- [x] **Step 2: 접근 불가 화면과 canonical route를 브라우저에서 확인한다.**

실제 인증 계정이 없는 환경이므로 보호된 canonical route의 `/login` redirect는 브라우저에서 확인하고, 접근 불가 full screen·복귀 callback·login direct navigation은 컴포넌트/라우트 테스트로 확인했다.

- [x] **Step 3: Implementation Results에 실제 변경·검증·차이를 기록한다.**

보완 구현 파일, Figma node `325:2` 반영 내용, 계획과 실제 차이, 검증 명령 결과, 실제 backend 인증 데이터로 남은 수동 확인을 한국어로 기록한다. 사용자가 요청한 이슈·commit·push·PR 생성까지 수행한다.

## Implementation Results

### 실제 변경 내용

- `entities/project`에 프로젝트 타입과 목록·생성·수정·삭제 Axios 요청을 추가하고, `features/project/model/use-projects.ts`에서 조회 query와 mutation invalidation을 연결했다.
- 로그인 성공 시에는 LoginForm이 workspace 목록을 직접 조회해 canonical project route로 이동하고, `/`는 `WorkspaceRedirectPage`를 통해 기존 세션의 `isDefault` workspace를 선택하는 호환 진입점으로 남겼다. `/workspaces/$workspaceId` 홈 route는 추가하지 않았다.
- `HomePage`의 placeholder를 Figma 기준 프로젝트 목록으로 교체했다. 카드 그리드, 테이블 전환, 이름 검색, 서버 페이지네이션, 빈 상태·오류 상태를 제공한다. 좁은 viewport에서는 Sidebar를 자동으로 접어 본문과 겹치지 않게 했다.
- `selectDefaultWorkspace` helper를 workspace redirect와 LoginForm에서 공유해 기본 workspace 우선·첫 workspace fallback 규칙을 일관되게 적용했다.
- Figma `224:4748`을 복제해 만든 `325:2` 기준 `WorkspaceAccessDeniedPage`를 추가했다. 목록에 없는 workspace ID는 project query를 호출하지 않고 `존재하지 않는 워크스페이스예요` / `입력한 워크스페이스를 찾을 수 없어요` 전체 화면 UI를 표시하며, fallback workspace로 돌아가는 버튼을 제공한다.
- workspace 생성 성공 후 새 workspace를 Sidebar overlay 목록에만 추가하고 현재 workspace·URL·프로젝트 목록을 유지한다.
- 프로젝트 그리드는 Figma 1440px 기준 4열을 유지하면서 `4→3→2→1` responsive breakpoint로 축소한다. 카드 최소 폭을 `minmax()`로 제한하고 검색 필드는 `w-full max-w-80`으로 조정했다.
- 공용 Table wrapper에 가로 스크롤을 적용하고 프로젝트 테이블에 최소 폭을 부여했다. 접근 불가 화면도 `w-full max-w-90`과 줄바꿈 가능한 제목으로 작은 화면 overflow를 방지한다.
- 프로젝트 생성·수정 mutation 응답은 목록 항목의 `creator`가 없는 backend raw 응답에 맞춰 `ProjectMutationProject`로 분리했다.
- canonical project route의 인증 guard와 보완 요구사항을 route/page/auth/API 테스트에 반영했다. 실제 메모리 라우터에서 URL workspace ID 전달과 workspace 전환 경로를 검증하고, workspace 조회 실패 시 stale data로 redirect하지 않는 회귀 테스트를 추가했다.
- `ProjectFormDialog`와 `ProjectDeleteDialog`로 프로젝트 생성·수정·삭제 흐름을 구현했다. 이름 1~50자, 설명 최대 200자, trim 및 빈 설명 `null` 변환을 적용했다.
- Owner 또는 현재 프로젝트 Creator에게만 수정·삭제 메뉴를 노출하고, mutation 성공 toast와 실패 모달 오류를 제공한다.
- Figma MCP에서 확인한 1440×680 레이아웃, 240px Sidebar, 320px 검색 필드, 4열 카드, 204px 카드 높이, 360px 생성 모달, 테이블 5열을 기존 shared UI·토큰·lucide 아이콘으로 재현했다.
- 설계 문서: [`docs/superpowers/specs/2026-09-09-project-list-page-design.md`](../specs/2026-09-09-project-list-page-design.md)

### 계획과 달라진 점

- 계획의 통합 `ProjectDialog` 대신 초기값·버튼 문구를 명확히 제어할 수 있는 `ProjectFormDialog`와 삭제 확인용 `ProjectDeleteDialog`로 분리했다.
- 목록 컨테이너는 계획의 `pages/home`가 아니라 프로젝트 상호작용 경계에 맞춰 `features/project/ui/ProjectListContent.tsx`에 배치했다.
- 기본 page size는 계획의 20에서 Figma 카드 화면에 표시된 6개로 조정했다. 백엔드의 `limit` 계약은 변경하지 않았다.
- Figma 테이블 스크린샷에는 설명 열이 없어 `이름·생성자·생성일·수정일·메뉴` 5열로 구현했다.
- 실제 백엔드 mutation 응답에 `creator`가 없다는 계약을 반영해 목록용 `Project`와 생성·수정용 `ProjectMutationProject`를 분리했다.
- 실제 인증 계정이 없는 환경에서는 접근 불가 화면을 브라우저에서 백엔드 데이터로 재현하지 못해 해당 상태는 Figma 확인과 컴포넌트 테스트로 검증했다.
- Code Connect 매핑과 백엔드/DB 변경은 추가하지 않았다.
- 리뷰에서 확인된 반응형·테이블 스크롤·route/workspace 회귀 검증 공백을 보완하고, 보완 테스트를 먼저 실패시킨 뒤 최소 구현으로 통과시켰다.

### 실행한 검증 명령과 결과

- `pnpm test`: 전체 테스트 통과. 초기 전체 검증은 25개 파일, 102개 테스트였고, 리뷰 보완 테스트를 추가해 재검증했다.
- `pnpm exec tsc -b`: 통과.
- `pnpm lint`: exit code 0. 기존 shared UI의 Fast Refresh warning 4건만 남아 있다.
- `pnpm build`: TypeScript 및 Vite production build 통과. route test 파일 제외 설정을 추가해 route plugin 경고도 제거했다.
- `pnpm format:check`: 작업 범위 파일은 정리했으며, 기존 변경이 없던 `src/entities/session/model/session-store.test.ts`, `src/routes/login.test.tsx` 2개 파일의 기존 포맷 경고로 전체 명령은 exit code 1이다.
- `git diff --check`: 통과.
- 로컬 개발 서버에서 보호된 `/workspaces/workspace-1/projects` 직접 진입이 비인증 상태에서 `/login`으로 redirect되는 것을 브라우저 접근성 트리로 확인했다. 리뷰에서 지적된 root redirect history 교체와 마지막 페이지 삭제 후 page 보정도 반영했다.
- `gh issue create`: 이슈 [#39](https://github.com/nandev-parkk/in2white/issues/39) 생성.
- 리뷰 보완사항까지 포함한 최종 기능 커밋을 생성했다.
- `git push` 및 PR 생성은 사용자의 요청에 따라 수행하며 결과는 최종 보고에 기록한다.

### 남은 후속 작업

- 실제 로그인 계정과 실행 중인 백엔드 데이터가 있는 환경에서 인증 후 카드·테이블 화면을 한 번 더 시각 검수할 수 있다.
- 기존 포맷 경고 2개는 이번 기능과 무관하므로 별도 포맷 정리 작업으로 분리한다.
- 프로젝트 상세/화이트보드 route와 workspace 멤버·설정 화면은 이번 범위에 포함하지 않았다.
