# UI 정합성 및 사용성 개선 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 현재 구현된 사이드바·워크스페이스·프로젝트 목록 UI를 Figma와 정합화하고, 요청된 17개 레이아웃·상태·접근성 문제를 회귀 테스트와 함께 수정한다.

**Architecture:** 기존 React 컴포넌트와 Tailwind 토큰을 유지하면서 공통 Search와 CompactEmptyState의 책임을 명확히 한다. 사이드바는 기존 collapse/resize 상태 모델을 보존하고 표현 구조만 조정하며, 프로젝트 카드는 고정 높이를 최소 높이와 자연스러운 grid row stretch로 바꾼다. Figma에는 워크스페이스 검색 빈 상태와 함께 Sidebar 토글, Card border, view toggle active 상태를 기존 컴포넌트·화면에 동기화한다.

**Tech Stack:** React 19, TypeScript, TanStack Router/Query, Tailwind CSS v4, Radix UI, Vitest, Testing Library, Figma MCP.

**Spec:** `docs/superpowers/specs/2026-09-09-ui-consistency-design.md`

## Global Constraints

- 새 페이지·미구현 멤버/설정/화이트보드 화면은 만들지 않는다.
- API·인증·권한·데이터 모델 계약은 변경하지 않는다.
- 기존 접근성, 키보드 탐색, focus ring, 사이드바 resize/collapse 동작을 보존한다.
- Figma 쓰기 작업은 구현된 화면과 대응되는 컴포넌트·상태 보정으로 한정한다. `Empty State / Compact`와 워크스페이스 검색 빈 상태 외에도 Sidebar 토글, Card border, view toggle active 상태를 동기화한다.
- production code는 해당 변경을 검출하는 실패 테스트를 먼저 작성하고 RED를 확인한 뒤 수정한다.
- 커밋·push·PR은 사용자 요청 전에는 실행하지 않는다.

---

## 변경 파일 지도

### 공통 UI

- Modify: `frontend/src/shared/ui/search.tsx` — text searchbox와 custom clear button
- Create: `frontend/src/shared/ui/compact-empty-state.tsx` — popover/list용 compact empty state
- Modify: `frontend/src/shared/ui/toast.tsx` — 320px 기본 폭과 wrapping
- Tests: `frontend/src/shared/ui/search.test.tsx`, `frontend/src/shared/ui/compact-empty-state.test.tsx`, `frontend/src/shared/ui/toast.test.tsx`

### 사이드바·워크스페이스

- Modify: `frontend/src/shared/ui/sidebar.tsx` — workspace trigger, chevron, list gap/scrollbar, compact empty state, clear callback, collapsed toggle geometry
- Modify: `frontend/src/pages/home/ui/HomePage.tsx` — workspace creation success toast
- Modify: `frontend/src/features/workspace/ui/WorkspaceCreateDialog.tsx` — close reset
- Tests: `frontend/src/shared/ui/sidebar.test.tsx`, `frontend/src/pages/home/ui/HomePage.test.tsx`, `frontend/src/features/workspace/ui/WorkspaceCreateDialog.test.tsx`

### 프로젝트 목록

- Modify: `frontend/src/features/project/ui/ProjectCard.tsx` — min-height, description flow, footer spacing
- Modify: `frontend/src/features/project/ui/ProjectListContent.tsx` — page size 12, Figma view toggle, spacing, search empty action/centering
- Modify: `frontend/src/features/project/ui/ProjectTable.tsx` — Figma column widths/alignment and metadata rendering
- Modify: `frontend/src/features/project/lib/project-date.ts` only if formatting evidence requires it; otherwise leave unchanged
- Tests: `frontend/src/features/project/ui/ProjectCard.test.tsx`, `frontend/src/features/project/ui/ProjectListContent.test.tsx`, `frontend/src/features/project/ui/ProjectTable.test.tsx`

### Figma

- Existing file: `Dimhltnal74SHy2NcLz1Lf`, page `v1.0`, workspace switcher state based on `156:1038`
- Create/use: `Empty State / Compact` component and an existing implemented workspace-search-empty state
- Update: Sidebar toggle geometry/chevrons, Card border token, grid/table view toggle active emphasis
- No code export or new application screen is created in Figma

---

## Task 1: 공통 Search와 CompactEmptyState

**Files:**

- Create: `frontend/src/shared/ui/compact-empty-state.tsx`
- Modify: `frontend/src/shared/ui/search.tsx`
- Create: `frontend/src/shared/ui/compact-empty-state.test.tsx`
- Create or modify: `frontend/src/shared/ui/search.test.tsx`

**Interfaces:**

- `SearchProps`는 기존 input props에 `onClear?: () => void`를 추가한다.
- Search input은 `type="text"`, `role="searchbox"`, `inputMode="search"`를 사용하고, 값이 비어 있지 않고 `onClear`가 있을 때 clear button을 렌더링한다.
- `CompactEmptyStateProps`는 `{ icon: React.ReactNode; title: React.ReactNode; description?: React.ReactNode }`와 표준 div props를 사용한다.

- [x] **Step 1: clear 동작과 compact layout의 실패 테스트 작성**

```tsx
it("renders an accessible clear button and calls onClear without native search chrome", async () => {
  const onClear = vi.fn();
  const user = userEvent.setup();
  render(<Search value="alpha" onChange={() => {}} onClear={onClear} />);

  expect(screen.getByRole("searchbox")).toHaveAttribute("type", "text");
  await user.click(screen.getByRole("button", { name: "검색어 지우기" }));
  expect(onClear).toHaveBeenCalledOnce();
});

it("centers compact empty state content in its available area", () => {
  render(
    <CompactEmptyState
      icon={<span aria-hidden="true">?</span>}
      title="검색 결과가 없어요"
      description="다른 검색어로 다시 시도해보세요"
    />,
  );

  expect(screen.getByText("검색 결과가 없어요").parentElement).toHaveClass(
    "items-center",
    "justify-center",
  );
});
```

- [x] **Step 2: RED 실행**

Run from `frontend/`: `pnpm vitest run src/shared/ui/search.test.tsx src/shared/ui/compact-empty-state.test.tsx`

Expected: Search test fails because the input is still `type="search"` and no clear button exists; CompactEmptyState test fails because the component does not exist.

- [x] **Step 3: 최소 구현**

Search implementation requirements:

```tsx
const showClear = Boolean(onClear && props.value)
<input type="text" role="searchbox" inputMode="search" ... />
{showClear && (
  <button type="button" aria-label="검색어 지우기" onClick={onClear}>
    <X aria-hidden="true" />
  </button>
)}
```

Use a relative wrapper, preserve the leading search icon, keep input focusable, and expose the clear button only when a value exists. `CompactEmptyState` uses a full-size flex container with an 8px vertical gap and compact typography.

- [x] **Step 4: GREEN 실행**

Run the same Vitest command. Expected: both tests pass.

- [x] **Step 5: 기존 Search 사용처 연결 테스트**

Update `frontend/src/shared/ui/search.stories.tsx` if story props require an `onClear` example. Run `pnpm vitest run src/shared/ui/search.test.tsx src/features/project/ui/ProjectListContent.test.tsx` and confirm existing search behavior remains green.

## Task 2: 사이드바 워크스페이스 헤더·목록·접힘 토글

**Files:**

- Modify: `frontend/src/shared/ui/sidebar.tsx`
- Modify: `frontend/src/shared/ui/sidebar.test.tsx`

**Interfaces:**

- `WorkspaceSwitcher` receives the existing callbacks plus `CompactEmptyState` and Search `onClear` usage internally.
- No public `SidebarProps` contract is removed or renamed.

- [x] **Step 1: 구조와 CSS 계약을 검출하는 실패 테스트 추가**

Add tests that assert:

```tsx
it("keeps workspace name and role in a left-aligned text column with a sibling chevron", () => {
  render(<Sidebar {...sidebarFixture} />);
  const row = screen.getByTestId("workspace-name-row");
  expect(row).toHaveClass("text-left");
  expect(row.querySelector('[data-slot="workspace-name"]')).toHaveClass(
    "text-left",
  );
  expect(row.querySelector('[data-slot="workspace-chevron"]')).toBeTruthy();
});

it("centers the collapsed toggle on the sidebar border with a full rounded border", () => {
  render(<Sidebar {...sidebarFixture} collapsed />);
  const toggle = screen.getByRole("button", { name: "사이드바 펼치기" });
  expect(toggle).toHaveClass("left-full", "-translate-x-1/2", "border");
  expect(toggle).not.toHaveClass("border-l-0", "rounded-l-none");
});

it("renders a compact centered empty state for an unmatched workspace query", async () => {
  const user = userEvent.setup();
  render(<Sidebar {...sidebarFixture} />);
  await user.click(
    screen.getByRole("button", { name: sidebarFixture.workspace.name }),
  );
  await user.type(
    screen.getByRole("searchbox", { name: "워크스페이스 검색" }),
    "없는",
  );
  expect(screen.getByText("검색 결과가 없어요")).toBeInTheDocument();
});
```

Also add an assertion for the list container's scrollbar-hiding classes, an 8px item gap, and the Figma List Cell height.

- [x] **Step 2: RED 실행**

Run: `pnpm vitest run src/shared/ui/sidebar.test.tsx`

Expected: the new structure, toggle geometry, and compact empty-state assertions fail against the current implementation.

- [x] **Step 3: 구현**

Apply these changes in `WorkspaceSwitcher`:

- Add `text-left` to the trigger.
- Keep the mark, text column, and chevron as three siblings in the trigger row.
- Add stable `data-slot` attributes for the workspace name and chevron.
- Give the listbox an 8px item gap, Figma List Cell height (`62px`), `scrollbar-width: none`, `-ms-overflow-style: none`, and `::-webkit-scrollbar { display: none; }` utility classes.
- Render `CompactEmptyState` for zero filtered results and clear the query through Search’s `onClear`.

Apply these collapsed-toggle classes while preserving current top/transition timing:

```text
left-full -translate-x-1/2 border rounded-full bg-background-default h-8 w-8 z-40 cursor-default
```

Do not change the existing `top-4`, transition duration, or pending collapse state machine.

- [x] **Step 4: GREEN 실행**

Run: `pnpm vitest run src/shared/ui/sidebar.test.tsx`

Expected: all sidebar tests pass, including existing resize/collapse keyboard cases.

- [x] **Step 5: 회귀 확인**

Run: `pnpm vitest run src/shared/ui/sidebar.test.tsx src/pages/home/ui/HomePage.test.tsx` and inspect that no existing sidebar width or aria-label assertion changed unintentionally.

## Task 3: 워크스페이스 생성 성공 토스트와 초기화

**Files:**

- Modify: `frontend/src/features/workspace/ui/WorkspaceCreateDialog.tsx`
- Modify: `frontend/src/pages/home/ui/HomePage.tsx`
- Modify: `frontend/src/features/workspace/ui/WorkspaceCreateDialog.test.tsx`
- Modify: `frontend/src/pages/home/ui/HomePage.test.tsx`

**Interfaces:**

- `WorkspaceCreateDialog` keeps its current controlled `open`/`onOpenChange` contract.
- HomePage uses the existing `toast` helper and does not alter workspace mutation payloads.

- [x] **Step 1: 실패 테스트 작성**

Add a dialog test that types a name, rerenders from `open=true` to `open=false` and back to `open=true`, then expects an empty input. Add a HomePage test that resolves workspace creation and expects `toast.success('워크스페이스를 만들었어요')` once.

- [x] **Step 2: RED 실행**

Run: `pnpm vitest run src/features/workspace/ui/WorkspaceCreateDialog.test.tsx src/pages/home/ui/HomePage.test.tsx`

Expected: the reopened input still contains the previous value and the success toast is not called.

- [x] **Step 3: 구현**

In `WorkspaceCreateDialog`, reset `name` and `requiredError` whenever the controlled `open` changes to false, including parent-controlled close. Keep user-entered values while the dialog remains open after validation or API failure. In `HomePage.handleCreateWorkspace`, call the success toast only after `mutateAsync` resolves and before closing the dialog.

- [x] **Step 4: GREEN 실행**

Run the same Vitest command. Expected: reset and toast assertions pass.

## Task 4: Toast 고정 폭과 줄바꿈

**Files:**

- Modify: `frontend/src/shared/ui/toast.tsx`
- Modify: `frontend/src/shared/ui/toast.test.tsx`

**Interfaces:**

- `Toaster` keeps `ToasterProps`, `toastOptions`, position, duration, and icons.
- The visual contract is a 320px default width with a viewport-safe max width.

- [x] **Step 1: 실패 테스트 작성**

Render `Toaster` and assert the generated toast class configuration contains a fixed 320px width, a viewport-safe max width, normal whitespace, and word breaking. Keep the test focused on the public `data-slot="toaster"` configuration/classes rather than Sonner internals.

- [x] **Step 2: RED 실행**

Run: `pnpm vitest run src/shared/ui/toast.test.tsx`

Expected: the current `!w-fit` class violates the fixed-width assertion.

- [x] **Step 3: 구현**

Replace `!w-fit` with a fixed `w-80`/320px equivalent plus `max-w-[calc(100vw-3rem)]`, keep Figma's centered icon alignment, and add `break-words` with a `min-w-0` content slot. Preserve existing semantic colors and icon map.

- [x] **Step 4: GREEN 실행**

Run the same command and then `pnpm vitest run src/shared/ui/toast.test.tsx src/pages/home/ui/HomePage.test.tsx`.

## Task 5: 프로젝트 카드 레이아웃과 목록 페이지

**Files:**

- Modify: `frontend/src/features/project/ui/ProjectCard.tsx`
- Modify: `frontend/src/features/project/ui/ProjectListContent.tsx`
- Modify: `frontend/src/features/project/ui/ProjectTable.tsx`
- Modify: `frontend/src/features/project/ui/ProjectCard.test.tsx`
- Modify: `frontend/src/features/project/ui/ProjectListContent.test.tsx`
- Modify: `frontend/src/features/project/ui/ProjectTable.test.tsx`

**Interfaces:**

- Project API hooks and mutation callbacks remain unchanged.
- `PROJECTS_PER_PAGE` becomes 12.
- Project search clear uses the shared Search `onClear` callback.

- [x] **Step 1: 실패 테스트 작성**

Add assertions for:

```tsx
expect(screen.getByRole("article")).toHaveClass("min-h-[204px]");
expect(screen.getByTestId("project-grid")).toHaveClass("gap-3");
expect(
  screen.getByRole("button", { name: "검색 결과 초기화" }),
).toBeInTheDocument();
expect(projectRequest).toHaveBeenCalledWith(
  expect.objectContaining({ limit: 12 }),
);
```

Add a table assertion for fixed Figma column classes/widths, and a view-toggle assertion for 36px outer height, subtle background, and active default-background button. Add an empty-state test that verifies the reset action clears the search and requests page 1.

- [x] **Step 2: RED 실행**

Run: `pnpm vitest run src/features/project/ui/ProjectCard.test.tsx src/features/project/ui/ProjectListContent.test.tsx src/features/project/ui/ProjectTable.test.tsx`

Expected: current limit 6, missing reset action, fixed card height, and old toggle styles fail the new assertions.

- [x] **Step 3: 구현**

ProjectCard:

- Change `h-[204px]` to `min-h-[204px]`.
- Remove `min-h-10` from the description while retaining two-line clamp.
- Add explicit 8px separation before the divider/footer and preserve 16px card padding.

ProjectListContent:

- Set `PROJECTS_PER_PAGE = 12`.
- Use section gap 24px and remove the old pagination padding that double-counts the gap.
- Make the grid/table toggle an outer 36px subtle surface with 4px padding, 2px gap, 8px radius, no border, and 28px/4px-radius items. Active item uses default background.
- Pass `onClear={() => handleSearchChange('')}` to Search.
- For search empty state, render Search icon, Figma copy, secondary `검색 결과 초기화`, and `flex-1` centered layout.
- Keep the no-project state’s Figma copy and Large Primary CTA.

ProjectTable:

- Use the Figma 420/180/180/180/remaining column structure with plain date values.
- Remove calendar/clock icons from table date cells because the Figma table uses plain values; keep icons in cards.

- [x] **Step 4: GREEN 실행**

Run the three project test files. Expected: all new and existing tests pass.

- [x] **Step 5: 회귀 확인**

Run: `pnpm vitest run src/features/project/ui src/pages/home/ui/HomePage.test.tsx` and verify mutation/menu permission tests remain green.

## Task 6: Figma Compact Empty State 반영

**Files:**

- Modify in Figma: file `Dimhltnal74SHy2NcLz1Lf`, `Components` page and `v1.0` workspace switcher example
- No application source file beyond Task 1/2

**Prerequisites:**

- Read `skill://figma/figma-generate-library/SKILL.md` and `skill://figma/figma-use/SKILL.md` through the Figma MCP resource before any `use_figma` call.
- Use Figma MCP only; do not open the Figma URL in a browser.

- [x] **Step 1: Inspect existing Empty State component and workspace switcher**

Use Figma MCP read tools on `152:1029` and `158:1290`/`156:1038` to preserve existing semantic colors and typography.

- [x] **Step 2: Create the component with the smallest safe edit**

Create `Empty State / Compact` with a small neutral search icon, title, optional short description, 8px vertical gap, centered auto layout, and no CTA. Keep the component within the existing Figma page/component area.

- [x] **Step 3: Use the component in the workspace search-empty state**

Add or update the already implemented workspace switcher search-empty state so the component instance is centered in the popover list area. Do not alter the normal workspace list state.

- [x] **Step 4: Read back and verify**

Use Figma metadata/screenshot to verify component name, instance placement, typography, color, and no unintended changes to the normal switcher.

## Task 7: 통합 시각 검증 및 문서 결과 기록

**Files:**

- Modify: `docs/superpowers/plans/2026-09-09-ui-consistency-implementation-plan.md`
- Potentially modify: Storybook stories only if a changed shared component needs a required fixture

- [x] **Step 1: Run all automated checks**

From `frontend/`, run:

```bash
pnpm test
pnpm lint
pnpm build
pnpm format:check
```

- [x] **Step 2: Run visual smoke checks**

Inspect expanded/collapsed/intermediate sidebar widths, workspace list overflow and empty query state, long toast copy on a narrow viewport, project grid with one- and two-line descriptions, table view, project empty/search-empty/error states, and workspace dialog reopen behavior.

- [x] **Step 3: Review diff scope**

Run `git diff --check` and `git status --short`. Confirm only the planned frontend files, Figma state, spec, and plan are changed.

- [x] **Step 4: Record Implementation Results**

Append an `## Implementation Results` section to this plan with:

- actual changed files and behavior
- deviations from this plan and why
- exact verification commands and pass/fail output
- remaining follow-up work, if any

## Execution Notes

- Run each RED command before its corresponding production code edit; if a test passes immediately, correct the test before continuing.
- Keep edits focused on one task at a time and rerun the affected test file after each GREEN step.
- Do not commit during execution unless the user explicitly requests a commit.

## Implementation Results

### 실제 변경 내용

- 공통 `Search`를 text searchbox로 전환하고 접근 가능한 custom clear 버튼을 추가했으며, `CompactEmptyState`를 코드와 Figma에 추가했다.
- 사이드바 워크스페이스 trigger의 좌측 정렬·chevron 중앙 정렬, 접힌 토글의 border 중앙 배치, 목록 gap·스크롤바 숨김·검색 빈 상태를 반영했다. 검색어가 없는 실제 빈 목록의 기존 문구는 유지했다.
- 워크스페이스 생성 성공 toast와 dialog close reset, 320px toast wrapping, 프로젝트 카드 자연 높이·footer 여백, 목록 12개 page size, Figma view toggle·empty state·table 열 너비를 적용했다.
- Figma `Components` 페이지에 `Empty State / Compact`(`342:183`)를 생성하고 `Workspace Home — 워크스페이스 전환` 예시에 instance `344:4232`를 배치했다.

### 계획과 달라진 점

- Toast 아이콘 정렬은 긴 텍스트에서도 기존 Figma 컴포넌트와 일관되도록 `items-center`를 유지했다. 폭은 기본 320px, 좁은 viewport에서는 `calc(100vw - 3rem)`으로 제한한다.
- Compact empty state 설명 문구는 Figma 기준인 `다른 검색어로 다시 시도해보세요`로 통일했다.
- Figma 컴포넌트는 별도 페이지를 만들지 않고 기존 `Components` 페이지의 패턴을 따랐고, 사용 예시는 기존 전환 화면 안에 보조 popover 상태로 추가했다.

### 검증 명령과 결과

- `pnpm test` (`vitest run`) — 34개 파일, 175개 테스트 통과 (기존 jsdom `scrollTo` 경고만 존재)
- `pnpm lint` — 오류 0개, 기존 Fast Refresh 경고 4개
- `pnpm build` — TypeScript와 Vite production build 통과
- `pnpm format:check` — 전체 파일 포맷 통과
- Figma MCP `get_metadata`, `get_screenshot`, `get_design_context` — 컴포넌트와 workspace empty instance 구조·시각 결과 확인

### 남은 후속 작업

- 사용자 요청이 없어 commit·push·PR은 실행하지 않았다.
- 미구현 멤버·설정·화이트보드 화면은 범위에서 제외한 상태로 남아 있다.

### 후속 디자인 피드백 구현 결과

- Sidebar는 `sticky top-0 h-svh max-h-svh overflow-visible`로 화면 높이를 유지하면서 popover·토글의 외부 표시를 보장하고, 토글을 `32px` 원형으로 정리했다. 펼침 상태는 `ChevronLeft`, 접힘 상태는 같은 아이콘의 `180deg` 회전이며, `z-40 cursor-default`로 resize handle의 드래그 커서가 아이콘 위에 노출되지 않는다.
- workspace popover는 검색창과 목록 사이 여백을 늘리고, 목록 셀은 `62px` 높이와 `8px` 간격을 사용한다. 이름·권한은 한 줄 truncation을 유지하고 참여자 stack은 `pl-1.5`로 안쪽 정렬했다.
- 프로젝트 view toggle active 상태에 border/ring/shadow 강조를 추가하고, 카드 외곽선을 `border-border`로 조정했다. 내부 divider는 `border-border-subtle`을 유지했다.
- Figma MCP로 `211:3718`/`211:3794` 토글을 원형·Chevron 상태로 수정하고, 접힌 토글을 `107:77` 루트의 절대 위치로 이동했다. Card `43:28`, grid active `125:227`, table active `125:292`에 `border/default` 토큰을 반영했다.

### 후속 검증 결과

- `pnpm test` — 34개 파일, 176개 테스트 통과 (jsdom `scrollTo` 미구현 경고만 존재)
- `pnpm lint` — 오류 0개, 기존 Fast Refresh 경고 4개
- `pnpm build` — TypeScript와 Vite production build 통과
- `pnpm format:check` 및 문서 Prettier check — 통과
- `git diff --check` — 통과
- Figma MCP `get_metadata`/`get_screenshot` — expanded/collapsed Sidebar, Workspace Home, grid/table view toggle 시각 확인

### Task 10 결과

#### 실제 변경 내용

- `frontend/src/shared/hooks/use-scroll-active-item.ts`와 단위 테스트를 추가했다. callback ref로 항목을 등록하고, 활성 키가 유효하며 목록이 활성화된 경우 `scrollIntoView`를 수직 중앙·수평 nearest·즉시 이동 옵션으로 호출한다.
- WorkspaceSwitcher가 hook의 container ref와 option 등록 callback을 사용해 팝오버를 열 때 선택된 Workspace를 중앙에 표시하도록 했다. 필터 결과에서 선택 항목이 사라지거나 브라우저가 `scrollIntoView`를 제공하지 않으면 호출하지 않는다.
- Sidebar 콜랩스 토글을 `24px` 원형으로 축소하고 chevron 아이콘을 `14px`로 조정했다. 회색 hover 배경 대신 흰색(`background-default`) hover·아이콘 색상·미세 shadow를 사용하며 기존 border 중앙 위치와 전환 타이밍은 보존했다.
- Workspace option 높이를 `58px`, 목록 gap을 `6px`로 조정하고 `min-height`/`shrink-0`을 유지했다.
- Figma `211:3718`/`211:3794` 토글과 아이콘을 24/14px로, `158:1290` Workspace popover의 셀을 58px·gap 6px로 동기화했다.
- 추가 피드백에 따라 접힌 토글의 `top`을 `top-3`에서 `top-4`로 맞춰 펼침·접힘 전환에서 세로 기준선을 고정하고, Figma `211:3794`도 y=16으로 보정했다.

#### 계획과 달라진 점

- hook의 `containerRef`는 향후 Select/Dropdown이 실제 스크롤 컨테이너를 연결할 수 있도록 generic container 타입을 지원한다. 현재 동작은 등록된 active item의 `scrollIntoView`에 집중하며 컨테이너 자체의 scrollTop은 변경하지 않는다.
- jsdom에는 `scrollIntoView`가 없을 수 있어 hook이 함수 존재 여부를 확인한 뒤 호출하도록 방어 로직을 추가했다.

#### 검증 명령과 결과

- RED: `pnpm vitest run src/shared/hooks/use-scroll-active-item.test.ts src/shared/ui/sidebar.test.tsx` — hook 모듈 부재·기존 클래스·자동 스크롤 assertion 실패 확인
- GREEN: 동일 명령 — 2개 파일, 36개 테스트 통과
- `pnpm test` — 35개 파일, 179개 테스트 통과 (기존 jsdom `scrollTo` 미구현 경고만 존재)
- `pnpm lint` — 오류 0개, 기존 Fast Refresh 경고 4개
- `pnpm build` — TypeScript와 Vite production build 통과
- `pnpm format:check` — 전체 frontend 파일 포맷 통과
- 문서 `prettier --check` — 설계·구현 계획 문서 포맷 통과
- `git diff --check` — 통과
- Figma MCP `get_metadata`/`get_screenshot` — 토글 24px 및 Workspace popover 셀 58px·6px gap 확인

#### 남은 후속 작업

- `Select`/`Dropdown`에서 동일 hook을 연결하는 작업은 해당 UI 요구가 생길 때 적용한다.
- 사용자가 요청하지 않아 commit·push·PR은 실행하지 않았다.

## Task 9: 이미지 기반 Sidebar overflow·Workspace Cell 보정

**Files:**

- Modify: `frontend/src/shared/ui/sidebar.tsx`, `frontend/src/shared/ui/sidebar.test.tsx`
- Modify: `docs/superpowers/specs/2026-09-09-ui-consistency-design.md`
- Figma: workspace switcher popover 기준 확인 (`158:1290`)

- [x] Sidebar 루트의 가로 overflow 클리핑과 workspace option flex shrink를 회귀 테스트로 재현한다.
- [x] Sidebar overflow-visible과 `62px`/`shrink-0` workspace option을 구현한다.
- [x] Figma `158:1290`의 List Cell `62px` 높이와 `8px` gap을 다시 확인한다.
- [x] 관련 테스트와 전체 검증을 실행하고 계획 문서에 결과를 기록한다.

### Task 9 결과

- Sidebar 루트의 `overflow-y-auto`를 `overflow-visible`로 바꿔 workspace popover와 border 중앙 토글이 사이드바 바깥으로 표시되도록 했다.
- Workspace option에 `min-h-[62px] shrink-0`을 추가해 항목 수가 많아도 Figma List Cell 높이와 현재 `gap-2` 간격을 유지하도록 했다.
- 추가 회귀 테스트 1건을 포함해 전체 테스트 176건, lint/build/format 및 `git diff --check`를 통과했다.

## Task 10: Workspace 선택 항목 자동 중앙 스크롤과 밀도 보정

**Files:**

- Create: `frontend/src/shared/hooks/use-scroll-active-item.ts`
- Create: `frontend/src/shared/hooks/use-scroll-active-item.test.ts`
- Modify: `frontend/src/shared/ui/sidebar.tsx`, `frontend/src/shared/ui/sidebar.test.tsx`
- Modify: `docs/superpowers/specs/2026-09-09-ui-consistency-design.md`

**Interfaces:**

- `useScrollActiveItem<TKey extends PropertyKey, TElement extends HTMLElement = HTMLElement, TContainer extends HTMLElement = HTMLElement>`는 `{ activeKey, enabled, behavior, block, inline }` 옵션을 받고 `{ containerRef, registerItem }`를 반환한다.
- `registerItem(key)`는 option·select item에 붙일 callback ref이며, 등록된 항목이 없으면 동작하지 않는다.
- 기존 Sidebar props, Workspace API, 키보드 listbox 계약은 변경하지 않는다.

- [x] **Step 1: hook과 Sidebar의 실패 테스트 작성**

  - hook 단위 테스트에서 활성 항목 등록 후 `scrollIntoView({ behavior: 'auto', block: 'center', inline: 'nearest' })`가 호출되는지 검증한다.
  - `enabled=false`와 활성 키 미등록 시 호출되지 않는지 검증한다.
  - Sidebar 테스트에서 토글 `h-6 w-6`, Workspace option `h-[58px] min-h-[58px]`, listbox `gap-1.5`를 검증하고, 하단 선택 Workspace를 열 때 해당 option의 `scrollIntoView` 호출을 검증한다.

- [x] **Step 2: RED 실행**

Run from `frontend/`:

```bash
pnpm vitest run src/shared/hooks/use-scroll-active-item.test.ts src/shared/ui/sidebar.test.tsx
```

Expected: hook 파일이 없어 단위 테스트가 실패하고, 기존 Sidebar 클래스 및 자동 스크롤 assertion도 실패한다.

- [x] **Step 3: 최소 구현**

  - `useScrollActiveItem`에서 `Map<TKey, TElement>`을 callback ref로 관리하고 `useLayoutEffect`로 활성 항목을 찾는다.
  - `enabled`와 `activeKey`가 유효할 때만 `scrollIntoView`를 호출한다. 기본 옵션은 `behavior: 'auto'`, `block: 'center'`, `inline: 'nearest'`다.
  - WorkspaceSwitcher의 listbox에 `containerRef`를 연결하고 각 option을 `registerItem(item.id)`로 등록한다.
  - Sidebar 토글을 24px 원형으로 축소하고 회색 hover 배경을 제거한다. Workspace option을 58px로 낮추고 listbox gap을 6px로 조정한다.

- [x] **Step 4: GREEN 실행**

Run the same Vitest command. Expected: hook and Sidebar tests pass while keyboard navigation, filtering, and popover positioning remain unchanged.

- [x] **Step 5: 회귀 검증**

Run `pnpm vitest run src/shared/hooks/use-scroll-active-item.test.ts src/shared/ui/sidebar.test.tsx src/features/project/ui/ProjectListContent.test.tsx` and ensure unrelated project UI tests remain green.

- [x] **Step 6: 전체 검증과 결과 기록**

Run `pnpm test`, `pnpm lint`, `pnpm build`, `pnpm format:check`, and `git diff --check`. Append actual changes, deviations, command results, and follow-up work to `Implementation Results` below.

## Task 8: 후속 디자인 피드백 반영

**Files:**

- Modify: `frontend/src/shared/ui/sidebar.tsx`, `frontend/src/shared/ui/sidebar.test.tsx`
- Modify: `frontend/src/pages/home/ui/HomePage.tsx` if the shell needs an explicit viewport-height contract
- Modify: `frontend/src/features/project/ui/ProjectListContent.tsx`, `frontend/src/features/project/ui/ProjectListContent.test.tsx`
- Modify: `frontend/src/features/project/ui/ProjectCard.tsx`, `frontend/src/features/project/ui/ProjectCard.test.tsx`
- Modify: `docs/superpowers/specs/2026-09-09-ui-consistency-design.md`
- Figma: `Workspace Home`/`Sidebar`, `Card`, `view-toggle`

- [x] 토글 아이콘 방향·원형 버튼·resize handle stacking 계약을 실패 테스트로 고정한다.
- [x] 사이드바 viewport 높이, workspace popover 셀 크기·간격, member inset, project card border, view toggle active 강조를 실패 테스트로 고정한다.
- [x] 코드 구현 후 관련 테스트와 전체 test/lint/build/format 검사를 실행한다.
- [x] Figma MCP로 동일 변경을 반영하고 metadata/screenshot으로 확인한다.

## Task 11: Workspace 전환 시 Sidebar 접힘 상태 보존

**Files:**

- Modify: `frontend/src/routes/workspaces/$workspaceId/projects.tsx`
- Modify: `frontend/src/routes/workspaces/$workspaceId/projects.test.tsx`
- Modify: `docs/superpowers/specs/2026-09-09-ui-consistency-design.md`

- [x] **Step 1: RED 회귀 테스트 작성**

  Workspace 전환 전후 `HomePage` 인스턴스 ID가 유지되는지 테스트한다. 기존 `key={workspaceId}` 구현에서는 인스턴스가 재생성되어 테스트가 실패한다.

- [x] **Step 2: 최소 수정**

  route-level `key={workspaceId}`를 제거해 workspaceId 변경이 `HomePage`와 Sidebar를 재마운트하지 않도록 한다. 기존 workspace 이동과 Sidebar 토글 API는 변경하지 않는다.

- [x] **Step 3: GREEN 실행**

  `pnpm vitest run 'src/routes/workspaces/$workspaceId/projects.test.tsx'` — 4개 테스트 통과.

### Task 11 결과

#### 실제 변경 내용

- `WorkspaceProjectsRoute`에서 `key={workspaceId}`를 제거했다. workspace 전환 시 `HomePage`/`AuthenticatedHomePage`/`Sidebar` 로컬 상태가 유지된다.
- route 테스트 mock에 인스턴스 ID를 추가하고 workspace 전환 전후 동일한 인스턴스인지 회귀 검증을 추가했다.

#### 계획과 달라진 점

- 전역 저장소나 localStorage를 추가하지 않았다. React의 동일 트리 rerender에서는 기존 로컬 상태가 유지되며, 이번 회귀의 원인은 route key에 의한 명시적 재마운트였기 때문이다.

#### 검증 명령과 결과

- `pnpm vitest run 'src/routes/workspaces/$workspaceId/projects.test.tsx'` — 4개 테스트 통과.
- `pnpm test` — 35개 파일, 179개 테스트 통과 (jsdom `scrollTo` 미구현 경고만 존재).
- `pnpm lint` — 오류 0개, 기존 Fast Refresh 경고 4개.
- `pnpm build` — TypeScript와 Vite production build 통과.
- `pnpm format:check` 및 문서 Prettier check — 통과.
- `git diff --check` — 통과.

#### 남은 후속 작업

- 사용자가 직접 Sidebar를 다시 펴거나 접는 경우를 제외한 일반 workspace 전환·부모 rerender에서 접힘 상태가 유지된다.
