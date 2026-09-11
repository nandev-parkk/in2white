# 계정 설정 프론트엔드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Figma 201:3216을 기준으로 사용자 전역 계정 설정을 /account에서 제공하고, 현재 워크스페이스 컨텍스트를 query parameter로 유지하며 실제 계정 API와 연결한다.

**Architecture:** 기존 프로젝트 화면과 계정 화면이 동일한 인증 워크스페이스 셸을 사용하도록 HomePage의 셸 책임을 공통 레이아웃으로 추출한다. 계정 HTTP 계약은 entities/account, TanStack Query와 세션 반영은 features/account, Figma 기준 조합 화면은 pages/account가 소유한다. canonical route는 /account이며 workspaceId는 화면 컨텍스트 전용 optional search parameter다.

**Tech Stack:** Vite, React 19, TypeScript, TanStack Router, TanStack Query, Axios, Tailwind CSS v4, React Hook Form, Zod, Radix UI, Vitest, Testing Library, Pretendard.

**Spec:** [계정 설정 프론트엔드 설계](../specs/2026-09-10-account-settings-frontend-design.md)

## Global Constraints

- canonical route는 /account로 한다.
- workspaceId는 optional query parameter이며 화면 컨텍스트만 나타낸다.
- 계정 API는 사용자 전역 범위를 유지하고 workspace ID를 받지 않는다.
- workspaceId가 없거나 접근할 수 없으면 접근 가능한 기본 workspace로 fallback한다.
- 기존 /workspaces/$workspaceId/projects route의 접근 불가 workspace 동작은 유지한다.
- 기존 Sidebar, Avatar, Input, PasswordInput, Button, ListCell, 디자인 토큰을 우선 재사용한다.
- 새 계정 API는 GET /account, PATCH /account, PATCH /account/password를 사용한다.
- 비밀번호 확인 값은 API body에 포함하지 않는다.
- 성공한 계정 응답은 기존 session store에 즉시 반영한다.
- PASSWORD_CHANGED_REAUTH_REQUIRED 오류는 세션을 정리하고 /login으로 이동한다.
- 모든 사용자 대면 문구와 문서는 한국어로 작성한다.
- 기존 backend 변경사항은 수정하지 않는다.
- Git commit, push, merge, PR은 사용자 요청 없이는 실행하지 않는다.
- 구현 완료 전후에 기존 변경사항을 덮어쓰지 않고 git diff --check로 whitespace 오류를 확인한다.

## 사전 확인 결과

- 현재 worktree는 링크드 worktree의 feature/account 브랜치다.
- 계정 백엔드 관련 파일은 이미 사용자 변경사항으로 존재하므로 프론트엔드 구현에서 수정하지 않는다.
- 기준 프론트엔드 테스트는 31개 파일, 167개 테스트 통과다.
- 기준 lint는 오류 0개, 기존 Fast Refresh 경고 4개다.
- 새 작업에서는 별도 worktree를 만들지 않는다.

## 파일 구조와 책임

### 새 파일

- frontend/src/entities/account/api/account.ts: 계정 API 타입과 Axios 요청 함수
- frontend/src/entities/account/api/account.test.ts: 계정 API HTTP 계약 테스트
- frontend/src/entities/account/index.ts: 계정 entity public export
- frontend/src/features/account/model/use-account.ts: 계정 조회·이름 변경·비밀번호 변경 hook
- frontend/src/features/account/model/use-account.test.tsx: hook query key와 mutation 성공 테스트
- frontend/src/features/account/model/account-form-schema.ts: 이름·비밀번호 변경 폼 Zod schema
- frontend/src/features/account/model/account-form-schema.test.ts: 폼 경계 검증 테스트
- frontend/src/features/account/ui/AccountProfileForm.tsx: 이메일 read-only와 이름 저장 form
- frontend/src/features/account/ui/AccountProfileForm.test.tsx: 기본 정보 form 테스트
- frontend/src/features/account/ui/AccountPasswordForm.tsx: 비밀번호 변경 form
- frontend/src/features/account/ui/AccountPasswordForm.test.tsx: 비밀번호 form 테스트
- frontend/src/pages/shared/ui/AuthenticatedWorkspaceLayout.tsx: 프로젝트·계정이 공유하는 인증 workspace 셸
- frontend/src/pages/shared/ui/AuthenticatedWorkspaceLayout.test.tsx: 셸 context·navigation 테스트
- frontend/src/pages/account/index.ts: 계정 page public export
- frontend/src/pages/account/ui/AccountPage.tsx: account route와 인증 셸을 연결하는 page
- frontend/src/pages/account/ui/AccountPage.test.tsx: 계정 화면·목록·세션 갱신 테스트
- frontend/src/routes/account.tsx: 보호된 /account route와 search validation
- frontend/src/routes/account.test.tsx: route guard·search·navigation 테스트

### 수정 파일

- frontend/src/shared/constants/messages.ts: 계정 이름·비밀번호 확인·성공 메시지 추가
- frontend/src/pages/home/ui/HomePage.tsx: 공통 셸 사용과 사용자 정보 navigation callback 연결
- frontend/src/pages/home/ui/HomePage.test.tsx: navigation 회귀 테스트 보강
- frontend/src/routes/workspaces/$workspaceId/projects.tsx: 현재 workspace를 유지한 account 이동 연결
- frontend/src/routes/workspaces/$workspaceId/projects.test.tsx: project→account navigation 계약 테스트
- frontend/src/shared/ui/sidebar.tsx: 하단 사용자 정보 클릭 callback 연결
- frontend/src/shared/ui/sidebar.test.tsx: 사용자 정보 클릭 회귀 테스트 보강

frontend/src/routeTree.gen.ts는 Router plugin이 생성하므로 직접 수정하지 않는다.

---

### Task 1: 계정 entity API 계약

**Files:**

- Create: frontend/src/entities/account/api/account.ts
- Create: frontend/src/entities/account/api/account.test.ts
- Create: frontend/src/entities/account/index.ts

**Interfaces:**

- Consumes: axiosInstance, SessionUser
- Produces: AccountUser = SessionUser
- Produces: UpdateAccountInput = { name: string }
- Produces: ChangeAccountPasswordInput = { currentPassword: string; newPassword: string }
- Produces: ChangeAccountPasswordResult = { accessToken: string; user: AccountUser }
- Produces: getAccountRequest(accessToken: string, signal?: AbortSignal): Promise<AccountUser>
- Produces: updateAccountRequest(input: UpdateAccountInput, accessToken: string): Promise<AccountUser>
- Produces: changeAccountPasswordRequest(input: ChangeAccountPasswordInput, accessToken: string): Promise<ChangeAccountPasswordResult>

AccountUser는 기존 SessionUser의 public 필드만 사용한다. ChangeAccountPasswordInput에는 confirmPassword를 정의하지 않는다.

- [ ] **Step 1: 요청 경로·header·body를 검증하는 실패 테스트를 작성한다.**

```ts
it("계정 조회는 user envelope를 벗기고 bearer token을 전달한다", async () => {
  vi.mocked(axiosInstance.get).mockResolvedValue({
    data: { user: accountUser },
  });

  await expect(getAccountRequest("token-1")).resolves.toEqual(accountUser);
  expect(axiosInstance.get).toHaveBeenCalledWith("/account", {
    headers: { Authorization: "Bearer token-1" },
  });
});

it("이름 변경은 PATCH /account로 name만 전송한다", async () => {
  vi.mocked(axiosInstance.patch).mockResolvedValue({
    data: { user: accountUser },
  });

  await updateAccountRequest({ name: "새 이름" }, "token-1");

  expect(axiosInstance.patch).toHaveBeenCalledWith(
    "/account",
    { name: "새 이름" },
    { headers: { Authorization: "Bearer token-1" } },
  );
});

it("비밀번호 확인 값은 API body에 포함하지 않는다", async () => {
  vi.mocked(axiosInstance.patch).mockResolvedValue({
    data: { accessToken: "token-2", user: accountUser },
  });

  await changeAccountPasswordRequest(
    { currentPassword: "Old123!", newPassword: "New12345!" },
    "token-1",
  );

  expect(axiosInstance.patch).toHaveBeenCalledWith(
    "/account/password",
    { currentPassword: "Old123!", newPassword: "New12345!" },
    { headers: { Authorization: "Bearer token-1" } },
  );
  expect(axiosInstance.patch.mock.calls[0]?.[1]).not.toHaveProperty(
    "confirmPassword",
  );
});
```

- [ ] **Step 2: 테스트가 missing module/function으로 실패하는지 확인한다.**

Run:

```bash
pnpm --dir frontend test -- src/entities/account/api/account.test.ts
```

Expected: FAIL — account entity 모듈과 요청 함수가 없다.

- [ ] **Step 3: API 타입과 요청 함수를 최소 구현한다.**

```ts
import { axiosInstance } from "@/shared/api";
import type { SessionUser } from "@/entities/session";

export type AccountUser = SessionUser;
export type UpdateAccountInput = { name: string };
export type ChangeAccountPasswordInput = {
  currentPassword: string;
  newPassword: string;
};
export type ChangeAccountPasswordResult = {
  accessToken: string;
  user: AccountUser;
};

type AccountResponse = { user: AccountUser };

export async function getAccountRequest(
  accessToken: string,
): Promise<AccountUser> {
  const { data } = await axiosInstance.get<AccountResponse>("/account", {
    headers: { Authorization: "Bearer " + accessToken },
  });
  return data.user;
}

export async function updateAccountRequest(
  input: UpdateAccountInput,
  accessToken: string,
): Promise<AccountUser> {
  const { data } = await axiosInstance.patch<AccountResponse>(
    "/account",
    input,
    { headers: { Authorization: "Bearer " + accessToken } },
  );
  return data.user;
}

export async function changeAccountPasswordRequest(
  input: ChangeAccountPasswordInput,
  accessToken: string,
): Promise<ChangeAccountPasswordResult> {
  const { data } = await axiosInstance.patch<ChangeAccountPasswordResult>(
    "/account/password",
    input,
    { headers: { Authorization: "Bearer " + accessToken } },
  );
  return data;
}
```

entities/account/index.ts에서는 API 함수와 public type만 export한다.

- [ ] **Step 4: entity 및 기존 workspace API 테스트를 통과시킨다.**

Run:

```bash
pnpm --dir frontend test -- src/entities/account/api/account.test.ts src/entities/workspace/api/workspace.test.ts
```

Expected: 새 계정 API 계약과 기존 workspace API 테스트가 모두 PASS.

---

### Task 2: 계정 Query/Mutation과 폼 schema

**Files:**

- Create: frontend/src/features/account/model/use-account.ts
- Create: frontend/src/features/account/model/use-account.test.tsx
- Create: frontend/src/features/account/model/account-form-schema.ts
- Create: frontend/src/features/account/model/account-form-schema.test.ts
- Create: frontend/src/features/account/index.ts
- Modify: frontend/src/shared/constants/messages.ts

**Interfaces:**

- Consumes: Task 1 entity API
- Produces: accountQueryKey(userId: string): readonly ['account', string]
- Produces: useAccount(accessToken: string | null, userId: string | null)
- Produces: useUpdateAccount(accessToken: string | null, userId: string | null)
- Produces: useChangeAccountPassword(accessToken: string | null, userId: string | null)
- Produces: accountNameSchema and accountPasswordFormSchema
- Produces: getAccountApiError(error: unknown): { code?: string; message: string }

messages에 다음 키를 추가한다.

```ts
ACCOUNT_NAME_REQUIRED: '이름을 입력해주세요',
ACCOUNT_NAME_TOO_LONG: '이름은 255자 이내로 입력해주세요',
PASSWORD_CONFIRM_REQUIRED: '비밀번호 확인을 입력해주세요',
PASSWORD_CONFIRM_MISMATCH: '새 비밀번호가 일치하지 않습니다',
ACCOUNT_UPDATED: '이름을 저장했어요',
PASSWORD_UPDATED: '비밀번호를 변경했어요',
ACCOUNT_LOAD_FAILED: '계정 정보를 불러오지 못했어요',
```

- [ ] **Step 1: 이름과 비밀번호 schema의 실패 테스트를 작성한다.**

```ts
it("이름을 trim하고 공백·256자 이상을 거부한다", () => {
  expect(accountNameSchema.parse({ name: "  새 이름  " })).toEqual({
    name: "새 이름",
  });
  expect(accountNameSchema.safeParse({ name: "   " }).success).toBe(false);
  expect(accountNameSchema.safeParse({ name: "a".repeat(256) }).success).toBe(
    false,
  );
});

it("새 비밀번호 확인이 다르면 confirmPassword에 오류를 연결한다", () => {
  const result = accountPasswordFormSchema.safeParse({
    currentPassword: "Old123!",
    newPassword: "New12345!",
    confirmPassword: "Different123!",
  });

  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.error.issues[0]?.path).toEqual(["confirmPassword"]);
    expect(result.error.issues[0]?.message).toBe(
      MESSAGES.PASSWORD_CONFIRM_MISMATCH,
    );
  }
});
```

- [ ] **Step 2: schema 테스트가 실패하는지 확인한다.**

Run:

```bash
pnpm --dir frontend test -- src/features/account/model/account-form-schema.test.ts
```

Expected: FAIL — account schema와 메시지 키가 없다.

- [ ] **Step 3: 기존 passwordSchema를 재사용해 form schema를 구현한다.**

이름 schema는 trim, min 1, max 255를 사용한다. 비밀번호 schema는 기존 passwordSchema를 사용하고 현재 비밀번호·확인 비밀번호는 required 검증을 추가한다. object refine은 confirmPassword path로 mismatch를 연결한다.

- [ ] **Step 4: Query/Mutation hook의 실패 테스트를 작성한다.**

```tsx
it("token과 userId가 있을 때만 계정 query를 실행한다", async () => {
  vi.mocked(getAccountRequest).mockResolvedValue(accountUser);
  const queryClient = createTestQueryClient();

  const { result } = renderHook(() => useAccount("token-1", "user-1"), {
    wrapper: createQueryClientWrapper(queryClient),
  });

  await waitFor(() => expect(result.current.data).toEqual(accountUser));
  expect(getAccountRequest).toHaveBeenCalledWith("token-1");
});

it("이름 변경 성공 시 account query cache를 갱신한다", async () => {
  const updatedUser = { ...accountUser, name: "새 이름" };
  vi.mocked(updateAccountRequest).mockResolvedValue(updatedUser);
  const queryClient = createTestQueryClient();

  const { result } = renderHook(() => useUpdateAccount("token-1", "user-1"), {
    wrapper: createQueryClientWrapper(queryClient),
  });

  await act(async () => {
    await result.current.mutateAsync({ name: "새 이름" });
  });

  expect(queryClient.getQueryData(["account", "user-1"])).toEqual(updatedUser);
});

it("비밀번호 변경 결과로 새 access token과 user를 반환한다", async () => {
  const resultData = { accessToken: "token-2", user: accountUser };
  vi.mocked(changeAccountPasswordRequest).mockResolvedValue(resultData);
  const queryClient = createTestQueryClient();

  const { result } = renderHook(
    () => useChangeAccountPassword("token-1", "user-1"),
    { wrapper: createQueryClientWrapper(queryClient) },
  );

  await expect(
    result.current.mutateAsync({
      currentPassword: "Old123!",
      newPassword: "New12345!",
    }),
  ).resolves.toEqual(resultData);
});
```

- [ ] **Step 5: hook 테스트가 실패하는지 확인한다.**

Run:

```bash
pnpm --dir frontend test -- src/features/account/model/use-account.test.tsx
```

Expected: FAIL — hook과 entity mock export가 없다.

- [ ] **Step 6: query key와 hook을 구현한다.**

계정 query key는 ['account', userId]로 고정한다. query는 accessToken과 userId가 모두 있을 때만 활성화한다. 이름 mutation은 성공 결과를 account cache에 저장하고, 비밀번호 mutation은 API 결과를 그대로 반환하며 성공 user를 cache에 저장한다. getAccountApiError는 Axios error의 response.data.error.code와 response.data.error.message를 읽고 없으면 NETWORK_ERROR를 반환한다.

- [ ] **Step 7: schema·hook 테스트를 통과시킨다.**

Run:

```bash
pnpm --dir frontend test -- src/features/account/model/account-form-schema.test.ts src/features/account/model/use-account.test.tsx
```

Expected: 모두 PASS.

---

### Task 3: Figma 기준 계정 form UI

**Files:**

- Create: frontend/src/features/account/ui/AccountProfileForm.tsx
- Create: frontend/src/features/account/ui/AccountProfileForm.test.tsx
- Create: frontend/src/features/account/ui/AccountPasswordForm.tsx
- Create: frontend/src/features/account/ui/AccountPasswordForm.test.tsx
- Modify: frontend/src/features/account/index.ts

**Interfaces:**

- Consumes: Task 2 form schema와 AccountUser
- Produces: AccountProfileForm props { user, onSubmit, loading, error? }
- Produces: AccountPasswordForm props { onSubmit, loading, error? }
- AccountProfileForm callback payload: { name: string }
- AccountPasswordForm callback payload: { currentPassword: string; newPassword: string }

- [ ] **Step 1: 기본 정보 form 실패 테스트를 작성한다.**

```tsx
it("아이디는 disabled이고 이름 저장 callback에는 trim된 값만 전달한다", async () => {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const user = userEvent.setup();

  render(
    <AccountProfileForm
      user={accountUser}
      onSubmit={onSubmit}
      loading={false}
    />,
  );

  expect(screen.getByLabelText("아이디")).toBeDisabled();
  await user.clear(screen.getByLabelText("이름"));
  await user.type(screen.getByLabelText("이름"), "  새 이름  ");
  await user.click(screen.getByRole("button", { name: "저장" }));

  expect(onSubmit).toHaveBeenCalledWith({ name: "새 이름" });
});

it("공백 이름은 callback을 호출하지 않고 오류를 표시한다", async () => {
  const onSubmit = vi.fn();
  const user = userEvent.setup();

  render(
    <AccountProfileForm
      user={accountUser}
      onSubmit={onSubmit}
      loading={false}
    />,
  );

  await user.clear(screen.getByLabelText("이름"));
  await user.click(screen.getByRole("button", { name: "저장" }));

  expect(onSubmit).not.toHaveBeenCalled();
  expect(screen.getByText("이름을 입력해주세요")).toBeInTheDocument();
});
```

- [ ] **Step 2: 비밀번호 form 실패 테스트를 작성한다.**

```tsx
it("confirmPassword를 callback payload에 포함하지 않는다", async () => {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const user = userEvent.setup();

  render(<AccountPasswordForm onSubmit={onSubmit} loading={false} />);

  await user.type(screen.getByLabelText("현재 비밀번호"), "Old123!");
  await user.type(screen.getByLabelText("새 비밀번호"), "New12345!");
  await user.type(screen.getByLabelText("새 비밀번호 확인"), "New12345!");
  await user.click(screen.getByRole("button", { name: "변경" }));

  expect(onSubmit).toHaveBeenCalledWith({
    currentPassword: "Old123!",
    newPassword: "New12345!",
  });
  expect(onSubmit.mock.calls[0]?.[0]).not.toHaveProperty("confirmPassword");
});

it("확인 비밀번호 불일치 시 callback을 호출하지 않는다", async () => {
  const onSubmit = vi.fn();
  const user = userEvent.setup();

  render(<AccountPasswordForm onSubmit={onSubmit} loading={false} />);

  await user.type(screen.getByLabelText("현재 비밀번호"), "Old123!");
  await user.type(screen.getByLabelText("새 비밀번호"), "New12345!");
  await user.type(screen.getByLabelText("새 비밀번호 확인"), "Different123!");
  await user.click(screen.getByRole("button", { name: "변경" }));

  expect(onSubmit).not.toHaveBeenCalled();
  expect(
    screen.getByText("새 비밀번호가 일치하지 않습니다"),
  ).toBeInTheDocument();
});
```

- [ ] **Step 3: form 테스트가 실패하는지 확인한다.**

Run:

```bash
pnpm --dir frontend test -- src/features/account/ui/AccountProfileForm.test.tsx src/features/account/ui/AccountPasswordForm.test.tsx
```

Expected: FAIL — 계정 form component가 없다.

- [ ] **Step 4: Figma 필드 구조를 공통 컴포넌트로 구현한다.**

기본 정보는 아이디 disabled Input, 이름 Input, 저장 Button 순서로 만든다. 비밀번호 form은 현재 비밀번호·새 비밀번호·새 비밀번호 확인 PasswordInput과 변경 Button을 사용한다. 모든 input은 visible label, aria-invalid, aria-describedby를 사용한다. server error는 form 내부 role alert로 렌더링하고 loading 중에는 Button을 비활성화한다.

- [ ] **Step 5: form 테스트를 통과시킨다.**

Run:

```bash
pnpm --dir frontend test -- src/features/account/ui/AccountProfileForm.test.tsx src/features/account/ui/AccountPasswordForm.test.tsx
```

Expected: 모두 PASS.

---

### Task 4: 인증 workspace 셸 공통화

**Files:**

- Create: frontend/src/pages/shared/ui/AuthenticatedWorkspaceLayout.tsx
- Create: frontend/src/pages/shared/ui/AuthenticatedWorkspaceLayout.test.tsx
- Modify: frontend/src/pages/home/ui/HomePage.tsx
- Modify: frontend/src/pages/home/ui/HomePage.test.tsx

**Interfaces:**

```ts
export type WorkspaceShellContext = {
  accessToken: string;
  user: SessionUser;
  workspaces: WorkspaceSummary[];
  selectedWorkspace: WorkspaceSummary | null;
  selectedWorkspaceId: string | null;
};

export type AuthenticatedWorkspaceLayoutProps = {
  workspaceId?: string;
  activeNav?: SidebarNavKey;
  unknownWorkspace?: "deny" | "fallback";
  onWorkspaceChange?: (workspaceId: string) => void;
  onNavChange?: (
    key: SidebarNavKey,
    selectedWorkspaceId: string | null,
  ) => void;
  onUserClick?: (selectedWorkspaceId: string | null) => void;
  children: (context: WorkspaceShellContext) => React.ReactNode;
};
```

- Consumes: useSessionStore, useWorkspaces, useCreateWorkspace, Sidebar, WorkspaceCreateDialog
- Produces: 프로젝트와 계정이 같은 workspace 목록·사이드바·로그아웃·workspace create 동작을 사용한다.

- [ ] **Step 1: 공통 셸 추출 전 기존 회귀 테스트를 실행한다.**

Run:

```bash
pnpm --dir frontend test -- src/pages/home/ui/HomePage.test.tsx src/shared/ui/sidebar.test.tsx
```

Expected: 기준 테스트 PASS.

- [ ] **Step 2: fallback context와 navigation callback 실패 테스트를 작성한다.**

```tsx
it("fallback 모드에서는 알 수 없는 ID에도 기본 workspace를 선택한다", () => {
  render(
    <AuthenticatedWorkspaceLayout
      workspaceId="workspace-unknown"
      unknownWorkspace="fallback"
      activeNav="settings"
    >
      {({ selectedWorkspace }) => <span>{selectedWorkspace?.id}</span>}
    </AuthenticatedWorkspaceLayout>,
  );

  expect(screen.getByText("workspace-default")).toBeInTheDocument();
});

it("navigation callback에 선택 workspace ID를 전달한다", async () => {
  const onNavChange = vi.fn();

  render(
    <AuthenticatedWorkspaceLayout
      workspaceId="workspace-1"
      activeNav="projects"
      onNavChange={onNavChange}
    >
      {() => null}
    </AuthenticatedWorkspaceLayout>,
  );

  await userEvent.click(screen.getByRole("button", { name: "설정" }));

  expect(onNavChange).toHaveBeenCalledWith("settings", "workspace-1");
});
```

- [ ] **Step 3: 셸 테스트가 실패하는지 확인한다.**

Run:

```bash
pnpm --dir frontend test -- src/pages/shared/ui/AuthenticatedWorkspaceLayout.test.tsx
```

Expected: FAIL — 셸 파일이 없다.

- [ ] **Step 4: HomePage의 인증 셸 책임을 이동한다.**

공통 셸은 session guard, workspace query, selected workspace fallback, compact sidebar, create dialog, logout, Sidebar 렌더링을 담당한다. unknownWorkspace가 deny이면 현재 프로젝트 화면의 기존 access denied 동작을 유지하고, fallback이면 account 화면이 계정 전역 페이지를 계속 표시하도록 기본 workspace를 선택한다.

HomePage는 children으로 ProjectListContent만 주입한다. 기존 프로젝트 query, workspace 생성 overlay, 접근 불가 workspace, logout 회귀 동작은 유지한다. layout은 internal activeNav state를 기본으로 제공하되 onNavChange가 있으면 외부 route handler를 호출한다.

- [ ] **Step 5: 셸과 기존 회귀 테스트를 통과시킨다.**

Run:

```bash
pnpm --dir frontend test -- src/pages/home/ui/HomePage.test.tsx src/pages/shared/ui/AuthenticatedWorkspaceLayout.test.tsx src/shared/ui/sidebar.test.tsx
```

Expected: 모두 PASS.

---

### Task 5: Figma 기준 계정 page 구현

**Files:**

- Create: frontend/src/pages/account/index.ts
- Create: frontend/src/pages/account/ui/AccountPage.tsx
- Create: frontend/src/pages/account/ui/AccountPage.test.tsx
- Modify: frontend/src/features/account/index.ts

**Interfaces:**

```ts
export type AccountPageProps = {
  workspaceId?: string;
  onWorkspaceChange?: (workspaceId: string) => void;
  onNavChange?: (
    key: SidebarNavKey,
    selectedWorkspaceId: string | null,
  ) => void;
};
```

- Consumes: Task 2 account hooks, Task 3 forms, Task 4 layout
- Produces: Figma 201:3216 기준 기본 정보·비밀번호 변경·참여 workspace 화면

- [ ] **Step 1: 계정 page 실패 테스트를 작성한다.**

계정 user 조회 결과로 disabled email과 이름을 표시하고, shell context의 모든 workspace를 ListCell row로 표시하는 테스트를 작성한다. 이름 변경 성공 시 session store user.name이 바뀌는지, 비밀번호 변경 성공 시 accessToken이 새 값으로 바뀌는지 검증한다.

비밀번호 mutation이 다음 오류로 실패하면 session clear와 login navigation을 검증한다.

```ts
{
  response: {
    data: {
      error: {
        code: 'PASSWORD_CHANGED_REAUTH_REQUIRED',
        message: '다시 로그인해주세요',
      },
    },
  },
}
```

- [ ] **Step 2: page 테스트가 실패하는지 확인한다.**

Run:

```bash
pnpm --dir frontend test -- src/pages/account/ui/AccountPage.test.tsx
```

Expected: FAIL — account page가 없다.

- [ ] **Step 3: Figma 레이아웃을 구현한다.**

AccountPage는 AuthenticatedWorkspaceLayout에 activeNav=settings, unknownWorkspace=fallback을 전달한다. layout children에서 page header, 중앙 설정 column max width 480px, 기본 정보·비밀번호 변경·참여 workspace list를 렌더링한다.

- app shell horizontal padding 20px
- section gap 40px
- section title 18px
- field gap 6px, section field gap 16px
- input height와 border/radius는 기존 Input token
- password field는 기존 PasswordInput
- workspace row는 ListCell + Avatar + role label + chevron

계정 query loading 중에는 기존 session user를 초기 표시값으로 사용하고 query 결과가 도착하면 form을 reset한다. query error에는 ACCOUNT_LOAD_FAILED와 retry action을 표시한다. 480px column은 좁은 viewport에서 width 100%로 줄어든다.

- [ ] **Step 4: 성공 mutation과 오류 계약을 연결한다.**

이름 변경 성공 시 update result를 기존 access token과 함께 session store에 저장하고 ACCOUNT_UPDATED toast를 표시한다. 비밀번호 변경 성공 시 응답의 accessToken과 user를 session store에 저장하고 form을 reset한다. PASSWORD_CHANGED_REAUTH_REQUIRED 오류는 clearSession, 오류 toast, /login replace navigation 순서로 처리한다. 그 외 서버 오류는 getAccountApiError의 message를 form alert에 표시한다.

workspace row 클릭은 row workspace ID로 /workspaces/$workspaceId/projects 이동을 요청한다. 설정 화면의 workspace switcher는 AccountPage의 onWorkspaceChange callback으로 위임한다.

- [ ] **Step 5: page 테스트를 통과시킨다.**

Run:

```bash
pnpm --dir frontend test -- src/pages/account/ui/AccountPage.test.tsx
```

Expected: 계정 조회, 이름 session 갱신, 비밀번호 success/re-auth, workspace list 테스트가 모두 PASS.

---

### Task 6: /account route와 양방향 navigation 연결

**Files:**

- Create: frontend/src/routes/account.tsx
- Create: frontend/src/routes/account.test.tsx
- Modify: frontend/src/routes/workspaces/$workspaceId/projects.tsx
- Modify: frontend/src/routes/workspaces/$workspaceId/projects.test.tsx
- Modify: frontend/src/pages/home/ui/HomePage.tsx
- Modify: frontend/src/pages/home/ui/HomePage.test.tsx

**Interfaces:**

- Produces: ACCOUNT_ROUTE = '/account' as const
- Produces: search validation result { workspaceId?: string }
- Consumes: AccountPage workspaceId, onWorkspaceChange, onNavChange, onUserClick

- [ ] **Step 1: account route 실패 테스트를 작성한다.**

```tsx
it("account route는 /account와 기존 auth guard를 사용한다", () => {
  expect(ACCOUNT_ROUTE).toBe("/account");
  expect(Route.options.beforeLoad).toBe(redirectIfUnauthenticated);
});

it("workspaceId가 문자열일 때만 search에 보존한다", () => {
  expect(
    Route.options.validateSearch?.({ workspaceId: "workspace-1" }),
  ).toEqual({ workspaceId: "workspace-1" });
  expect(Route.options.validateSearch?.({ workspaceId: 123 })).toEqual({});
});
```

- [ ] **Step 2: project→account와 account→project navigation 실패 테스트를 작성한다.**

프로젝트 route의 Sidebar 하단 사용자 정보 클릭은 /account와 search { workspaceId: 'workspace-current' }를 사용하고, 설정 클릭은 account route로 이동하지 않는다. 계정 route의 Sidebar 프로젝트 클릭과 workspace row 클릭은 /workspaces/$workspaceId/projects와 params { workspaceId: 'workspace-current' }를 사용한다. workspace switcher 선택은 /account route를 replace true로 이동하고 account API request에는 workspaceId를 전달하지 않는지 검증한다.

- [ ] **Step 3: route 테스트가 실패하는지 확인한다.**

Run:

```bash
pnpm --dir frontend test -- src/routes/account.test.tsx src/routes/workspaces/$workspaceId/projects.test.tsx
```

Expected: FAIL — account route와 navigation callback이 없다.

- [ ] **Step 4: /account route와 search validation을 구현한다.**

```tsx
export const ACCOUNT_ROUTE = "/account" as const;

export const Route = createFileRoute("/account")({
  beforeLoad: redirectIfUnauthenticated,
  validateSearch: (search: Record<string, unknown>) => ({
    workspaceId:
      typeof search.workspaceId === "string" ? search.workspaceId : undefined,
  }),
  component: AccountRoute,
});
```

AccountRoute는 Route.useSearch()를 AccountPage에 전달한다. workspace switcher는 /account와 workspaceId 값을 replace true로 navigate한다. 프로젝트 navigation은 현재 selectedWorkspaceId가 있을 때 기존 project route로 이동한다.

- [ ] **Step 5: project route의 사용자 정보 navigation을 연결한다.**

project route에서 HomePage에 다음 callback을 전달한다.

```tsx
onUserClick={(selectedWorkspaceId) => {
  void navigate({
    to: '/account',
    search: {
      workspaceId: selectedWorkspaceId ?? workspaceId,
    },
  })
}}
```

HomePage와 셸의 기존 projects·members·settings active state는 유지한다. 계정 route 이동은 설정 메뉴가 아닌 하단 사용자 정보 callback으로 위임한다.

- [ ] **Step 6: route tree 생성과 테스트를 확인한다.**

Run:

```bash
pnpm --dir frontend test -- src/routes/account.test.tsx src/routes/workspaces/$workspaceId/projects.test.tsx src/pages/home/ui/HomePage.test.tsx
```

Expected: account guard, search validation, 양방향 navigation, 기존 HomePage 테스트가 모두 PASS.

---

### Task 7: 통합·시각 검증과 결과 기록

**Files:**

- Modify: docs/superpowers/plans/2026-09-10-account-settings-frontend-implementation-plan.md

- [ ] **Step 1: 계정 집중 테스트를 실행한다.**

Run:

```bash
pnpm --dir frontend test -- src/entities/account src/features/account src/pages/account src/routes/account.test.tsx
```

Expected: 모두 PASS.

- [ ] **Step 2: 전체 테스트·lint·build·format 검사를 실행한다.**

Run:

```bash
pnpm --dir frontend test
pnpm --dir frontend lint
pnpm --dir frontend build
pnpm --dir frontend format:check
```

Expected: 모든 테스트 PASS, lint 오류 0개, build 성공, format check 성공. 기존 Fast Refresh warning 수는 증가하지 않는다.

- [ ] **Step 3: 로컬 시각 smoke test를 실행한다.**

인증된 상태에서 다음을 확인한다.

1. 프로젝트 화면의 설정 클릭은 account route로 이동하지 않고, 하단 사용자 정보 클릭이 /account?workspaceId=<현재 ID>로 이동한다.
2. Figma처럼 240px sidebar, 중앙 480px 설정 column, 세 섹션이 표시된다.
3. workspace switcher 선택 시 URL query만 바뀌고 account content가 유지된다.
4. 새로고침 후에도 선택 workspace가 복원된다.
5. workspace row 클릭 시 같은 workspace project route로 이동한다.
6. 좁은 화면에서 sidebar collapse와 form width가 깨지지 않는다.

- [ ] **Step 4: 변경 범위와 whitespace를 확인한다.**

Run:

```bash
git diff --check
git status --short
git diff --stat -- frontend docs/superpowers/specs/2026-09-10-account-settings-frontend-design.md docs/superpowers/plans/2026-09-10-account-settings-frontend-implementation-plan.md
```

Expected: 계정 기능에 필요한 frontend·문서 파일만 변경되고 기존 backend 변경사항은 추가되지 않는다.

- [ ] **Step 5: 실제 결과를 계획 문서 끝에 기록한다.**

구현 완료 후 계획 문서 끝에 실제 생성·수정 파일, 계획과 달라진 점, 실행한 검증 명령과 결과, 남은 후속 작업을 기록한다.

## Execution Notes

- 설계 문서와 이 계획 문서는 한국어로 유지한다.
- 구현 중 account API 계약, 인증·권한, workspace context 의미가 바뀌면 구현을 멈추고 설계·계획을 먼저 갱신한다.
- 계획 실행 시 별도 commit은 만들지 않는다. 사용자가 명시적으로 요청할 때만 Conventional Commit 규칙으로 commit한다.

## Implementation Results

### 실제 변경 내용

- 계정 프론트엔드 신규 파일: `frontend/src/entities/account/` 전체, `frontend/src/features/account/` 전체, `frontend/src/pages/account/` 전체, `frontend/src/pages/shared/ui/AuthenticatedWorkspaceLayout.{tsx,test.tsx}`, `frontend/src/routes/account.{tsx,test.tsx}`
- 기존 프론트엔드 수정 파일: `frontend/src/pages/home/ui/HomePage.{tsx,test.tsx}`, `frontend/src/routes/workspaces/$workspaceId/projects.{tsx,test.tsx}`, `frontend/src/shared/constants/messages.ts`
- 검증 기록: `docs/superpowers/plans/2026-09-10-account-settings-frontend-implementation-plan.md`, `.superpowers/sdd/2026-09-10-account-settings-frontend-implementation-plan/task-7-report.md`, `.superpowers/sdd/2026-09-10-account-settings-frontend-implementation-plan/progress.md`
- 기존 `/logo-mark.png`, `Sidebar`, `Avatar`, `Input`, `PasswordInput`, `Button`, `ListCell`, Lucide 아이콘을 재사용했다.
- account query는 TanStack Query의 `AbortSignal`을 API 요청에 전달하고, 이름·비밀번호 mutation은 요청 시작 시점의 access token/user ID를 검증한 뒤 세션과 cache를 갱신한다. mutation 전에 account query를 취소해 늦은 GET 응답이 PATCH 결과를 덮지 않게 했다.
- 인증 workspace 셸에 `workspaceMode="optional"`과 loading/error/refetch context를 추가했다. `/account`는 workspace query loading/error 중에도 계정 form을 유지하고 참여 workspace 섹션에서 상태와 재시도를 표시하며, 프로젝트 화면의 기존 차단 동작은 유지한다.
- profile form은 pristine 상태에서만 새 server user를 reset하고 dirty draft와 focus를 보존한다. 이름 저장 성공 시에만 명시적으로 form revision을 올려 서버 응답으로 초기화한다.
- 시각 QA를 위해 추가한 임시 Storybook story는 검사 후 제거했으며 최종 작업 트리에 남지 않는다.
- 현재 worktree에는 이 작업 범위와 별개의 백엔드 변경 파일도 함께 존재한다. Task 7에서 백엔드 파일을 수정하지 않았고 commit, push, merge, PR도 수행하지 않았다.
- 후속 navigation 변경에서 Sidebar 하단 사용자 정보 영역을 버튼으로 만들고 `onUserClick`을 공통 workspace 셸·HomePage·프로젝트 route까지 연결했다. 프로젝트 화면의 설정 메뉴는 더 이상 계정 설정 route를 호출하지 않는다.
- `AccountPasswordForm`의 서버 비밀번호 오류를 form 상단 alert에서 현재 비밀번호 입력 하단의 필드 오류로 이동하고, 해당 입력에 `aria-invalid`·`aria-describedby`를 적용했다.
- 참여 워크스페이스 목록에 기존 사이드바와 같은 검색 입력·`워크스페이스가 없습니다` 결과 없음 문구를 추가하고, 목록 영역을 4행 높이(`248px`)로 제한해 초과 항목을 세로 스크롤하도록 했다.

### 계획과 달라진 점

- Figma MCP의 `201:3216` 노드 원본(1440×982)과 Chrome CDP 캡처를 직접 비교해 시각 smoke test를 완료했다.
- 시각 QA 결과를 반영해 제목을 중앙 column 밖 main 좌측에 배치하고 28px 간격, 버튼 우측 정렬, label-input 6px 간격, 선택 workspace 강조, avatar 첫 글자, mobile title spacing, 비밀번호 placeholder를 보정했다. 이동 전 상태 초기화 순서는 테스트로 고정했다.
- 최종 리뷰에서 확인된 세션 경합, 늦은 account GET, workspace query 실패에 의한 전체 화면 차단, background refetch에 의한 dirty draft reset을 회귀 테스트로 재현한 뒤 수정했다.
- 전체 `format:check`는 `frontend/src/shared/ui/sidebar.tsx`, `frontend/src/shared/ui/sidebar.test.tsx`에 기존부터 있던 baseline 불일치 때문에 종료 코드 1이었다. 이번 후속 변경에서는 해당 파일을 전체 재포맷하지 않고 필요한 줄만 수정했으며, 이번에 수정한 `AccountPasswordForm` 파일을 포함한 focused Prettier 검사는 통과했다.
- 후속 navigation 변경 검증에서 `pnpm --dir frontend test`는 39개 파일 / 223개 테스트로 통과했다. `projects.test.tsx`에는 사용자 정보의 account 이동과 설정 메뉴의 비이동 회귀 테스트를 추가했고, Sidebar·AuthenticatedWorkspaceLayout에도 callback 전달 테스트를 추가했다.
- 비밀번호 오류 위치 회귀 테스트를 먼저 RED로 확인한 뒤 수정했으며, `AccountPasswordForm.test.tsx` 5개 테스트가 GREEN으로 통과했다.
- 참여 워크스페이스 검색·스크롤 회귀 테스트를 먼저 RED로 확인한 뒤 수정했으며, `AccountPage.test.tsx` 13개 테스트가 GREEN으로 통과했다.

### 실행한 검증 명령과 결과

- 다음 계정 관련 focused tests — PASS, 9개 파일 / 68개 테스트.

  ```bash
  pnpm --dir frontend test -- src/entities/account src/features/account src/pages/account src/pages/shared/ui/AuthenticatedWorkspaceLayout.test.tsx src/routes/account.test.tsx src/pages/home/ui/HomePage.test.tsx 'src/routes/workspaces/$workspaceId/projects.test.tsx'
  ```

- `pnpm --dir frontend test` — PASS, 39개 파일 / 225개 테스트. jsdom의 `Window's scrollTo() method` 알림은 테스트 실패가 아니다.
- `pnpm --dir frontend lint` — PASS, 오류 0개. 기존 Fast Refresh 경고 4개(`badge.tsx`, `button.tsx`, `input.tsx`, `toast.tsx`)가 출력됨.
- `pnpm --dir frontend build` — PASS, 종료 코드 0.
- 모든 Task 프론트엔드 파일 대상 focused Prettier 검사 — PASS.
- `pnpm --dir frontend format:check` — 종료 코드 1. 기존 baseline 불일치인 `src/shared/ui/sidebar.tsx`, `src/shared/ui/sidebar.test.tsx` 두 파일이 보고되었으며, 전체 재포맷은 범위 밖으로 두고 수정 대상 focused Prettier 검사는 통과함.
- `git diff --check` — PASS, whitespace 오류 없음.
- 테스트는 먼저 RED를 확인한 뒤 구현 후 GREEN을 확인했다. RED에서는 signal 미전달, session/cache stale mutation, late GET overwrite, optional workspace 차단, dirty draft reset을 재현했고, 최종 focused/전체 테스트에서 모두 GREEN이었다.
- Figma MCP `201:3216` — 원본 1440×982 확인.
- Chrome CDP 1440×982 — header `x=260, y=24`, section `x=600, y=80, width=480`, input `width=480`, save button right `1080`으로 Figma 매핑과 일치.
- Chrome CDP 390×844 — `scrollWidth=390`, compact sidebar `64`, header/section `x=84, right=370, width=286`; 수평 overflow가 없고 버튼과 placeholder가 노출됨을 확인.

### 브라우저 상호작용 smoke 결과

- 로컬 전용으로 frontend Vite를 5174 포트, mock API를 4010 포트에서 실행하고 Chrome CDP로 실제 app/router를 조작했다. 임시 소스 파일이나 fixture는 만들지 않았고 검증 후 두 서버를 모두 종료했다.
- 기존 Task 7 smoke에서는 프로젝트 화면 `/workspaces/workspace-1/projects`에서 Sidebar 설정 클릭 시 account route 이동을 확인했으나, 후속 요구사항에 따라 이 계약을 사용자 정보 클릭으로 변경했다. 최신 자동화 테스트에서는 설정 클릭이 project route에 머물고 하단 사용자 정보 클릭이 `pathname=/account`, `search=?workspaceId=workspace-1`로 이동함을 확인한다.
- Account workspace switcher에서 브랜드 스튜디오를 선택하자 `pathname=/account`는 유지되고 `search=?workspaceId=workspace-2`만 변경됐으며, `accountVisible=true`, `selectedWorkspace=브랜드 스튜디오`, `pageTitle=계정 설정`을 확인했다.
- 브라우저 reload 후 `pathname=/account`, `search=?workspaceId=workspace-2`, `accountVisible=true`, `selectedWorkspace=브랜드 스튜디오`가 복원됨을 확인했다.
- Account의 My Workspace 소유자 row를 클릭하자 `pathname=/workspaces/workspace-1/projects`, search 없음, `accountVisible=false`, `projectVisible=true`, `selectedWorkspace=My Workspace`를 확인했다.
- CDP script는 종료 코드 0이었다. 이 smoke는 로컬 mock 응답을 사용했으므로 실제 backend E2E가 아니라 실제 frontend router와 shell DOM의 상호작용 검증이다.

### 남은 후속 작업

- baseline Prettier 불일치인 `frontend/src/shared/ui/sidebar.tsx`, `frontend/src/shared/ui/sidebar.test.tsx`는 이 작업 범위 밖의 별도 정리 대상으로 남긴다.
- 현재 worktree에 함께 있는 백엔드 변경은 이 프론트엔드 Task 7 범위 밖이므로 별도로 검증·정리한다.
