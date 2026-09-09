# 사이드바 드래그·레이아웃 보정 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사이드바 리사이즈 중 토글이 로고와 겹치지 않고, 접힘·펼침 상태에서 워크스페이스와 메뉴의 세로 기준점이 동일하게 유지되도록 한다.

**Architecture:** `Sidebar`의 폭 상태와 시각적 레이아웃 상태를 분리한 현재 구조를 유지한다. 토글은 최종 접힘 상태가 아니라 현재 폭과 전환 상태를 기준으로 외부/내부 위치를 결정하고, 워크스페이스 블록은 멤버 미리보기 슬롯을 항상 보존하는 고정 최소 높이를 사용한다.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Vitest, Testing Library, Storybook

**Spec:** 사용자가 제공한 2026-09-08 화면 녹화와 사이드바 수정 요청 3개

## Global Constraints

- 문서와 UI 문구는 한국어로 작성한다.
- 사이드바 최소 폭은 64px, 최대 폭은 240px로 유지한다.
- 접힘·펼침 전환은 기존의 `prefers-reduced-motion` 대응을 유지한다.
- 기능 개발 완료 후 사용자가 요청하지 않았으므로 git commit은 실행하지 않는다.

---

### Task 1: 회귀 테스트로 화면 녹화 증상 고정

**Files:**
- Modify: `frontend/src/shared/ui/sidebar.test.tsx`

**Interfaces:**
- Consumes: `Sidebar`의 공개 리사이즈 핸들, 토글 버튼, 워크스페이스/메뉴 DOM
- Produces: 토글 보더 색상, 접힌 상태 드래그 중 토글 위치, 고정된 워크스페이스 블록 높이를 검증하는 회귀 테스트

- [x] **Step 1: 토글·리사이즈 보더 색상 테스트 작성**

리사이즈 핸들을 pointerdown한 뒤 토글과 핸들이 동일한 `border-border` 색상 규칙을 사용하는지 검증한다.

- [x] **Step 2: 접힌 상태 드래그 중 토글 위치 테스트 작성**

접힌 상태에서 리사이즈 핸들을 누르고 64px, 80px, 96px 폭으로 이동했을 때 96px 미만에서는 외부 토글, 96px 이상에서는 내부 토글 위치 클래스가 유지되는지 검증한다.

- [x] **Step 3: 워크스페이스 슬롯 높이 테스트 작성**

접힌 상태에서 멤버 미리보기 콘텐츠가 보이지 않더라도 워크스페이스 정보 블록이 고정 높이와 멤버 슬롯을 유지하고, 프로젝트 메뉴가 확장 상태와 같은 `mt-4` 기준을 사용하는지 검증한다.

- [x] **Step 4: 테스트를 실행해 실패를 확인**

실행:

```bash
pnpm test -- --run src/shared/ui/sidebar.test.tsx
```

기대 결과: 현재 구현은 리사이즈 시작 즉시 내부 토글로 바뀌고, 멤버 슬롯이 제거되며, 핸들 색상이 `bg-border-strong`이므로 새 테스트가 실패한다.

---

### Task 2: 토글 위치와 보더 색상 수정

**Files:**
- Modify: `frontend/src/shared/ui/sidebar.tsx`
- Test: `frontend/src/shared/ui/sidebar.test.tsx`

**Interfaces:**
- Consumes: `sidebarWidth`, `visualCollapsed`, `isResizing`
- Produces: `SIDEBAR_TOGGLE_INSIDE_MIN_WIDTH` 기준의 토글 위치 결정과 동일한 보더 색상 규칙

- [x] **Step 1: 최소 내부 토글 폭 상수 추가**

다음 상수를 사이드바 폭 상수 옆에 추가한다.

```ts
const SIDEBAR_TOGGLE_INSIDE_MIN_WIDTH = 96
```

- [x] **Step 2: 토글 위치를 현재 폭에 연결**

다음 계산값을 사용해 접힌 최종 상태이거나 96px 미만인 동안 외부 토글을 유지한다.

```ts
const toggleOutside =
  visualCollapsed || sidebarWidth < SIDEBAR_TOGGLE_INSIDE_MIN_WIDTH
```

토글의 클래스 조건은 `visualCollapsed`가 아니라 `toggleOutside`를 사용한다.

- [x] **Step 3: 핸들 강조 색상과 토글 보더 색상 통일**

리사이즈 핸들의 hover/focus/active 색상을 `bg-border`로 맞추고, 토글은 `border-border`를 유지해 사이드바 보더와 동일한 색을 사용한다.

- [x] **Step 4: 관련 테스트 통과 확인**

실행:

```bash
pnpm test -- --run src/shared/ui/sidebar.test.tsx
```

기대 결과: Task 1의 토글 위치·보더 테스트가 통과한다.

---

### Task 3: 워크스페이스 영역과 메뉴의 세로 기준 고정

**Files:**
- Modify: `frontend/src/shared/ui/sidebar.tsx`
- Test: `frontend/src/shared/ui/sidebar.test.tsx`

**Interfaces:**
- Consumes: `visualCollapsed`, `workspaceMembers`, `sidebar-navigation`
- Produces: 접힘 상태에서도 확장 상태와 동일한 워크스페이스 블록 높이와 메뉴 시작 위치

- [x] **Step 1: 워크스페이스 블록에 고정 최소 높이 적용**

워크스페이스 전환 버튼과 멤버 미리보기를 감싸는 영역을 `mt-2 min-h-[84px] gap-2`로 고정한다. 버튼이 접혀 16px 낮아지는 만큼 남은 공간은 블록의 최소 높이가 보존한다.

- [x] **Step 2: 멤버 미리보기 슬롯을 숨김 상태로 유지**

접힌 상태에서는 멤버 아바타의 시각 콘텐츠만 `invisible` 처리하고 `h-5` 슬롯은 유지한다. `display: none`이나 조건부 제거는 사용하지 않는다.

- [x] **Step 3: 메뉴 컨테이너 상단 여백을 상태와 무관하게 고정**

프로젝트·멤버·설정 메뉴 컨테이너에 항상 `mt-4 gap-1`을 사용해 접힘과 펼침에서 동일한 수직 시작점을 보장한다.

- [x] **Step 4: 관련 테스트 통과 확인**

실행:

```bash
pnpm test -- --run src/shared/ui/sidebar.test.tsx
```

기대 결과: 워크스페이스 슬롯 높이와 메뉴 기준점 테스트가 통과한다.

---

### Task 4: 전체 검증 및 정리

**Files:**
- Verify: `frontend/src/shared/ui/sidebar.tsx`
- Verify: `frontend/src/shared/ui/sidebar.test.tsx`

**Interfaces:**
- Consumes: Task 2와 Task 3의 구현
- Produces: 테스트·린트·프로덕션 빌드·Storybook 빌드가 통과한 작업 트리

- [x] **Step 1: 포맷과 전체 테스트 실행**

```bash
pnpm exec prettier --write src/shared/ui/sidebar.tsx src/shared/ui/sidebar.test.tsx
pnpm test -- --run
```

- [x] **Step 2: 린트와 빌드 실행**

```bash
pnpm lint
pnpm build
pnpm build-storybook
```

- [x] **Step 3: diff 검사**

```bash
git diff --check
```

- [x] **Step 4: 커밋하지 않고 결과 전달**

사용자가 커밋을 요청하지 않았으므로 변경 파일과 검증 결과만 한국어로 전달한다.

### Task 5: 양방향 전환과 하단 계정 영역 안정화

**Files:**
- Modify: `frontend/src/shared/ui/sidebar.tsx`
- Test: `frontend/src/shared/ui/sidebar.test.tsx`

**Interfaces:**
- Consumes: `sidebarWidth`, `layoutCollapsed`, `pendingCollapsed`, `isResizing`
- Produces: 보더를 눌렀다 놓는 동작에서 레이아웃이 변하지 않는 양방향 접힘·펼침 전환

- [x] **Step 1: 폭 기준 시각 레이아웃 테스트 작성**

접힌 상태에서 pointerdown/up만 발생한 경우 메뉴·워크스페이스·토글이 접힌 상태를 유지하고, 접었다가 다시 펴면 확장 레이아웃과 내부 토글 위치로 돌아오는지 검증했다.

- [x] **Step 2: 실제 폭 기준으로 시각 상태 계산**

`isResizing` 자체를 확장 레이아웃의 조건으로 사용하지 않고, 사이드바 폭이 `SIDEBAR_TOGGLE_INSIDE_MIN_WIDTH` 이상일 때만 확장 레이아웃으로 전환하도록 수정했다.

- [x] **Step 3: 하단 프로필 슬롯 높이 고정**

프로필 영역에 `min-h-16`을 적용하고 접힌 상태에서도 세로 패딩을 유지해 로그아웃·구분선·프로필의 하단 기준을 고정했다.

- [x] **Step 4: 양방향 전환 검증**

전체 테스트 104개, 린트, 프로덕션 빌드, Storybook 빌드, `git diff --check`를 실행했다.
