# 프로젝트 상세 프론트엔드 구현 계획

> **에이전트 실행 지침:** `superpowers:executing-plans`와 `test-driven-development`를 적용해 현재 에이전트가 Direct 방식으로 수행한다. 체크박스로 작업 상태를 기록하며 사용자 요청 없이 commit하지 않는다.

**목표:** 워크스페이스 멤버가 프로젝트 상세 페이지에서 프로젝트 정보를 확인하고 화이트보드 문서를 검색·생성·이름 변경·삭제한다.

**구조:** 워크스페이스 홈의 프로젝트 목록과 구조가 같으므로, 문구 없는 표현 컴포넌트(뷰 토글·페이지네이션)와 날짜 헬퍼·페이지네이션 타입을 `shared`로 추출해 양쪽이 공유한다. 화이트보드 문서는 entity(API 클라이언트) → feature(훅·UI) → page → route 순으로 새로 쌓는다.

**기술:** React 19, TypeScript, TanStack Router·Query, Tailwind CSS 4, Vitest, Testing Library, pnpm.

**설계:** [프로젝트 상세 프론트엔드 설계](../specs/2026-09-15-project-detail-frontend-design.md)

## 상태와 제약

- 상태: 2026-09-15 사용자 설계 승인 완료. 구현 대기.
- 작업 유형 / 프로필 / 실행 방식: Feature / Deep / Direct.
- 작업 경로: `/Users/nandev/workspace/01_Development/nandev/in2white/.claude/worktrees/project-detail-frontend`
- 브랜치: `feature/project-detail-frontend`
- 기준 commit: `3b1d7d2` (`origin/dev`)
- 이후 명령은 별도 표기가 없으면 작업 경로의 `frontend` 디렉터리에서 실행한다.
- 백엔드는 변경하지 않는다. 필요한 API 5종은 이미 `dev`에 병합되어 있다.
- 화이트보드 캔버스 편집 화면은 이번 범위가 아니다. 문서를 클릭해도 이동하지 않는다.
- commit·push·PR 생성은 사용자가 요청할 때만 수행한다.

## Global Constraints

- 모든 사용자 노출 문구는 한국어로 쓰고, 기존 화면과 같은 어투("…했어요", "…없어요")를 유지한다.
- 검증 문구 상수는 `src/shared/constants/messages.ts`의 `MESSAGES`에 추가한다.
- 화이트보드 문서 이름은 trim 후 1자 이상 50자 이하다. 백엔드 `whiteboardDocumentNameSchema`와 같다.
- 목록 쿼리의 `search`는 trim 후 빈 문자열이면 쿼리 파라미터에서 제외한다.
- 권한이 없는 사용자에게 컨텍스트 메뉴는 disabled가 아니라 **미렌더링**이다.
- 페이지당 문서 수는 12다.
- 파일·컴포넌트 이름과 export 방식은 기존 `features/project`의 규칙을 따른다 — 컴포넌트는 함수 선언 후 파일 하단에서 `export { Name }`.
- 새 파일에는 `@/` 경로 별칭을 쓴다. 단 `cn`은 `import { cn } from 'cn'`이다 (전용 별칭).
- 아이콘은 `lucide-react`만 쓴다. `src/shared/ui`에서는 `iconography.test.ts`가 `CalendarPlus`·`CalendarClock`·`FolderOpen`·`SearchX`·`FileQuestion`·`MoreHorizontal`과 인라인 `<svg>`를 금지한다. 이 계획이 쓰는 `LayoutGrid`·`List`·`MoreVertical`·`ArrowLeft`·`FolderX`·`PenLine`은 모두 허용된다.

---

## 파일 구조

| 파일 | 책임 | 작업 |
| --- | --- | --- |
| `src/shared/types/pagination.ts` | 목록 응답 공통 `Pagination` 타입 | Task 1 |
| `src/shared/lib/resource-date.ts` | `formatCreatedAt` · `formatUpdatedAt` | Task 2 |
| `src/shared/ui/view-toggle.tsx` | 카드/목록 전환 토글 | Task 3 |
| `src/shared/ui/list-pagination.tsx` | 페이지 번호 페이지네이션 블록 | Task 4 |
| `src/entities/whiteboard-document/api/whiteboard-document.ts` | 타입과 HTTP 요청 4종 | Task 5 |
| `src/features/whiteboard-document/model/use-whiteboard-documents.ts` | 쿼리·뮤테이션 훅 | Task 6 |
| `src/shared/ui/whiteboard-card.tsx` | 카드 표현 (수정) | Task 7 |
| `src/features/whiteboard-document/ui/WhiteboardDocumentFormDialog.tsx` | 생성·이름 변경 Dialog | Task 8 |
| `src/features/whiteboard-document/ui/WhiteboardDocumentDeleteDialog.tsx` | 삭제 확인 Dialog | Task 8 |
| `src/features/whiteboard-document/ui/WhiteboardDocumentMenu.tsx` | 카드·테이블 공용 컨텍스트 메뉴 | Task 9 |
| `src/features/whiteboard-document/ui/WhiteboardDocumentTable.tsx` | Table View | Task 9 |
| `src/features/whiteboard-document/ui/WhiteboardDocumentListContent.tsx` | 목록 컨테이너 | Task 10 |
| `src/entities/project/api/project.ts` | `getProjectRequest` 추가 (수정) | Task 11 |
| `src/features/project/model/use-projects.ts` | `useProject` 추가 (수정) | Task 11 |
| `src/features/project/ui/ProjectDetailHeader.tsx` | 4단 Page Header와 프로젝트 메뉴 | Task 12 |
| `src/pages/project-detail/ui/ProjectDetailPage.tsx` | 레이아웃 조립, 로딩·404·오류 분기 | Task 13 |
| `src/routes/workspaces/$workspaceId/projects_.$projectId.tsx` | 라우트 정의와 네비게이션 | Task 14 |
| `src/features/project/ui/ProjectCard.tsx` · `ProjectTable.tsx` | `onOpen` 추가 (수정) | Task 15 |

---

## Task 1: 공통 `Pagination` 타입

**Files:**
- Create: `src/shared/types/pagination.ts`
- Modify: `src/entities/project/api/project.ts`
- Modify: `src/entities/project/index.ts`

**Interfaces:**
- Produces: `Pagination = { page: number; limit: number; total: number; totalPages: number }` (`@/shared/types/pagination`). Task 5의 문서 목록 응답과 Task 4의 페이지네이션 컴포넌트가 쓴다.

- [ ] **Step 1: 공통 타입 파일 작성**

```ts
// src/shared/types/pagination.ts
export type Pagination = {
  page: number
  limit: number
  total: number
  totalPages: number
}
```

- [ ] **Step 2: 프로젝트 entity가 공통 타입을 쓰도록 변경**

`src/entities/project/api/project.ts`에서 기존 `ProjectPagination` 정의를 지우고 별칭으로 바꾼다. `ProjectPagination`을 import하는 기존 코드는 그대로 동작한다.

```ts
import type { Pagination } from '@/shared/types/pagination'

export type ProjectPagination = Pagination
```

`src/entities/project/index.ts`의 type export 목록에 `Pagination`은 추가하지 않는다 — 공통 타입은 `@/shared/types/pagination`에서 직접 가져온다.

- [ ] **Step 3: 타입 검사로 회귀 없음 확인**

Run: `pnpm exec tsc -b`
Expected: 오류 없음

- [ ] **Step 4: 기존 테스트 통과 확인**

Run: `pnpm test -- src/entities/project`
Expected: PASS

---

## Task 2: 날짜 헬퍼를 `shared/lib`으로 이동

**Files:**
- Create: `src/shared/lib/resource-date.ts`
- Create: `src/shared/lib/resource-date.test.ts`
- Delete: `src/features/project/lib/project-date.ts`
- Modify: `src/features/project/ui/ProjectCard.tsx`
- Modify: `src/features/project/ui/ProjectTable.tsx`

**Interfaces:**
- Produces: `formatCreatedAt(value: string): string` — `yyyy.MM.dd`, 파싱 실패 시 `'-'`. `formatUpdatedAt(value: string): string` — 한국어 상대 시각(`3시간 전`), 파싱 실패 시 `'-'`. Task 7·9가 쓴다.

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
// src/shared/lib/resource-date.test.ts
import { describe, expect, it } from 'vitest'

import { formatCreatedAt, formatUpdatedAt } from './resource-date'

describe('resource-date', () => {
  it('생성일을 yyyy.MM.dd로 표기한다', () => {
    expect(formatCreatedAt('2026-01-12T00:00:00.000Z')).toBe('2026.01.12')
  })

  it('잘못된 값은 하이픈으로 표기한다', () => {
    expect(formatCreatedAt('not-a-date')).toBe('-')
    expect(formatUpdatedAt('not-a-date')).toBe('-')
  })

  it('수정일을 한국어 상대 시각으로 표기한다', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000)
    expect(formatUpdatedAt(threeHoursAgo.toISOString())).toContain('전')
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm test -- src/shared/lib/resource-date.test.ts`
Expected: FAIL — `Failed to resolve import "./resource-date"`

- [ ] **Step 3: 헬퍼 이동**

`src/features/project/lib/project-date.ts`의 내용을 옮기고 함수 이름만 바꾼다.

```ts
// src/shared/lib/resource-date.ts
import { format, formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'

function parseDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatCreatedAt(value: string) {
  const date = parseDate(value)
  return date ? format(date, 'yyyy.MM.dd') : '-'
}

export function formatUpdatedAt(value: string) {
  const date = parseDate(value)
  return date ? formatDistanceToNow(date, { addSuffix: true, locale: ko }) : '-'
}
```

- [ ] **Step 4: 기존 파일 삭제와 호출부 수정**

```bash
rm src/features/project/lib/project-date.ts
```

`ProjectCard.tsx`와 `ProjectTable.tsx`의 import를 바꾼다.

```tsx
import { formatCreatedAt, formatUpdatedAt } from '@/shared/lib/resource-date'
```

본문의 `formatProjectCreatedAt` → `formatCreatedAt`, `formatProjectUpdatedAt` → `formatUpdatedAt`로 치환한다.

- [ ] **Step 5: 신규·회귀 테스트 통과 확인**

Run: `pnpm test -- src/shared/lib src/features/project`
Expected: PASS. 기존 `ProjectCard.test.tsx`·`ProjectTable.test.tsx`는 수정 없이 통과해야 한다.

---

## Task 3: `ViewToggle` 추출

**Files:**
- Create: `src/shared/ui/view-toggle.tsx`
- Create: `src/shared/ui/view-toggle.test.tsx`
- Modify: `src/features/project/ui/ProjectListContent.tsx`

**Interfaces:**
- Produces: `ViewToggle` — props `{ value: 'grid' | 'table'; onChange: (view: ListView) => void; label: string; gridLabel?: string; tableLabel?: string }`. `ListView` 타입도 함께 export한다. Task 10이 쓴다.

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
// src/shared/ui/view-toggle.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ViewToggle } from './view-toggle'

describe('ViewToggle', () => {
  it('현재 보기 방식을 aria-pressed로 알린다', () => {
    render(<ViewToggle value="grid" onChange={vi.fn()} label="프로젝트 보기 방식" />)

    expect(screen.getByRole('group', { name: '프로젝트 보기 방식' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '카드 보기' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '목록 보기' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('다른 보기 방식을 누르면 onChange를 호출한다', async () => {
    const onChange = vi.fn()
    render(<ViewToggle value="grid" onChange={onChange} label="프로젝트 보기 방식" />)

    await userEvent.click(screen.getByRole('button', { name: '목록 보기' }))

    expect(onChange).toHaveBeenCalledWith('table')
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm test -- src/shared/ui/view-toggle.test.tsx`
Expected: FAIL — `Failed to resolve import "./view-toggle"`

- [ ] **Step 3: 컴포넌트 구현**

`ProjectListContent.tsx`의 뷰 토글 마크업을 그대로 옮긴다. 클래스 문자열을 바꾸지 않아야 기존 스냅샷·스타일이 유지된다.

```tsx
// src/shared/ui/view-toggle.tsx
import { LayoutGrid, List } from 'lucide-react'

type ListView = 'grid' | 'table'

type ViewToggleProps = {
  value: ListView
  onChange: (view: ListView) => void
  label: string
  gridLabel?: string
  tableLabel?: string
}

const BUTTON_CLASS =
  'focus-visible:ring-action-focus-ring aria-pressed:bg-background-default aria-pressed:ring-border flex size-7 items-center justify-center rounded-md outline-none focus-visible:ring-3 aria-pressed:shadow-sm aria-pressed:ring-1'

function ViewToggle({
  value,
  onChange,
  label,
  gridLabel = '카드 보기',
  tableLabel = '목록 보기',
}: ViewToggleProps) {
  return (
    <div
      className="bg-background-subtle flex h-9 items-center gap-0.5 rounded-lg p-1"
      role="group"
      aria-label={label}
    >
      <button
        type="button"
        aria-label={gridLabel}
        aria-pressed={value === 'grid'}
        onClick={() => onChange('grid')}
        className={BUTTON_CLASS}
      >
        <LayoutGrid className="size-3.5" />
      </button>
      <button
        type="button"
        aria-label={tableLabel}
        aria-pressed={value === 'table'}
        onClick={() => onChange('table')}
        className={BUTTON_CLASS}
      >
        <List className="size-3.5" />
      </button>
    </div>
  )
}

export { ViewToggle }
export type { ListView }
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm test -- src/shared/ui/view-toggle.test.tsx`
Expected: PASS

- [ ] **Step 5: `ProjectListContent`가 추출한 컴포넌트를 쓰도록 변경**

- 인라인 `<div role="group" aria-label="프로젝트 보기 방식">…</div>` 블록을 `<ViewToggle value={view} onChange={setView} label="프로젝트 보기 방식" />`로 교체한다
- 로컬 `type ProjectView = 'grid' | 'table'`를 지우고 `ListView`를 import해 `useState<ListView>('grid')`로 바꾼다
- 더 쓰지 않는 `LayoutGrid`, `List` import를 지운다

- [ ] **Step 6: 회귀 확인**

Run: `pnpm test -- src/features/project`
Expected: PASS. `ProjectListContent.test.tsx`는 수정 없이 통과해야 한다.

---

## Task 4: `ListPagination` 추출

**Files:**
- Create: `src/shared/ui/list-pagination.tsx`
- Create: `src/shared/ui/list-pagination.test.tsx`
- Modify: `src/features/project/ui/ProjectListContent.tsx`

**Interfaces:**
- Consumes: Task 1의 `Pagination`
- Produces: `ListPagination` — props `{ page: number; totalPages: number; onPageChange: (page: number) => void }`. `totalPages <= 1`이면 `null`을 반환한다. Task 10이 쓴다.

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
// src/shared/ui/list-pagination.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ListPagination } from './list-pagination'

describe('ListPagination', () => {
  it('페이지가 하나면 렌더링하지 않는다', () => {
    const { container } = render(
      <ListPagination page={1} totalPages={1} onPageChange={vi.fn()} />,
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('첫 페이지에서는 이전 버튼이 비활성이다', () => {
    render(<ListPagination page={1} totalPages={3} onPageChange={vi.fn()} />)

    expect(screen.getByRole('button', { name: '이전 페이지' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '다음 페이지' })).toBeEnabled()
  })

  it('마지막 페이지에서는 다음 버튼이 비활성이다', () => {
    render(<ListPagination page={3} totalPages={3} onPageChange={vi.fn()} />)

    expect(screen.getByRole('button', { name: '다음 페이지' })).toBeDisabled()
  })

  it('페이지 번호를 누르면 해당 페이지를 전달한다', async () => {
    const onPageChange = vi.fn()
    render(<ListPagination page={1} totalPages={3} onPageChange={onPageChange} />)

    await userEvent.click(screen.getByRole('button', { name: '2' }))

    expect(onPageChange).toHaveBeenCalledWith(2)
  })

  it('다음 버튼은 현재 페이지의 다음 값을 전달한다', async () => {
    const onPageChange = vi.fn()
    render(<ListPagination page={2} totalPages={3} onPageChange={onPageChange} />)

    await userEvent.click(screen.getByRole('button', { name: '다음 페이지' }))

    expect(onPageChange).toHaveBeenCalledWith(3)
  })
})
```

접근성 이름은 확인했다. `src/shared/ui/pagination.tsx`의 `PaginationPrevious`는 `aria-label="이전 페이지"`, `PaginationNext`는 `aria-label="다음 페이지"`를 이미 갖고 있다.

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm test -- src/shared/ui/list-pagination.test.tsx`
Expected: FAIL — `Failed to resolve import "./list-pagination"`

- [ ] **Step 3: 컴포넌트 구현**

`ProjectListContent.tsx`의 페이지네이션 블록을 그대로 옮기되, 페이지 계산을 컴포넌트 안으로 넣는다.

```tsx
// src/shared/ui/list-pagination.tsx
import {
  Pagination,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/shared/ui/pagination'

type ListPaginationProps = {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

function ListPagination({ page, totalPages, onPageChange }: ListPaginationProps) {
  if (totalPages <= 1) return null

  return (
    <Pagination className="justify-center">
      <PaginationPrevious
        disabled={page <= 1}
        onClick={() => onPageChange(Math.max(1, page - 1))}
      />
      {Array.from({ length: totalPages }, (_, index) => index + 1).map(
        (pageNumber) => (
          <PaginationItem
            key={pageNumber}
            isActive={pageNumber === page}
            onClick={() => onPageChange(pageNumber)}
          >
            {pageNumber}
          </PaginationItem>
        ),
      )}
      <PaginationNext
        disabled={page >= totalPages}
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
      />
    </Pagination>
  )
}

export { ListPagination }
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm test -- src/shared/ui/list-pagination.test.tsx`
Expected: PASS

- [ ] **Step 5: `ProjectListContent`가 추출한 컴포넌트를 쓰도록 변경**

`{pagination && pagination.totalPages > 1 && (<Pagination …>…</Pagination>)}` 블록 전체를 아래로 교체한다.

```tsx
{pagination && (
  <ListPagination
    page={page}
    totalPages={pagination.totalPages}
    onPageChange={setPage}
  />
)}
```

`Pagination`, `PaginationItem`, `PaginationNext`, `PaginationPrevious` import를 지우고 `ListPagination`을 import한다.

- [ ] **Step 6: 회귀 확인**

Run: `pnpm test -- src/features/project`
Expected: PASS

---

## Task 5: 화이트보드 문서 API 클라이언트

**Files:**
- Create: `src/entities/whiteboard-document/api/whiteboard-document.ts`
- Create: `src/entities/whiteboard-document/api/whiteboard-document.test.ts`
- Create: `src/entities/whiteboard-document/index.ts`

**Interfaces:**
- Consumes: Task 1의 `Pagination`, 기존 `@/shared/api`의 `axiosInstance`
- Produces:
  - `WhiteboardDocument`, `WhiteboardDocumentCreator`, `WhiteboardDocumentListParams`, `ListWhiteboardDocumentsResponse`, `WhiteboardDocumentInput`
  - `CreatedWhiteboardDocument`, `UpdatedWhiteboardDocument`
  - `listWhiteboardDocumentsRequest(workspaceId, projectId, params, accessToken): Promise<ListWhiteboardDocumentsResponse>`
  - `createWhiteboardDocumentRequest(workspaceId, projectId, input, accessToken): Promise<CreatedWhiteboardDocument>`
  - `updateWhiteboardDocumentRequest(workspaceId, projectId, documentId, input, accessToken): Promise<UpdatedWhiteboardDocument>`
  - `deleteWhiteboardDocumentRequest(workspaceId, projectId, documentId, accessToken): Promise<void>`

백엔드 응답 형태가 엔드포인트마다 다르다. 목록 항목만 `creator`를 포함하고, 생성 응답은 `creator` 없이 문서 필드를 돌려주며, 수정 응답은 `{ id, name, updatedAt }`만 돌려준다 (`backend/src/services/whiteboard-document.service.ts`). 셋을 하나의 타입으로 뭉뚱그리지 않는다. UI는 뮤테이션 반환값을 쓰지 않고 목록 쿼리를 무효화하므로 이 차이가 화면에 영향을 주지 않는다.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// src/entities/whiteboard-document/api/whiteboard-document.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { axiosInstance } from '@/shared/api'

import {
  createWhiteboardDocumentRequest,
  deleteWhiteboardDocumentRequest,
  listWhiteboardDocumentsRequest,
  updateWhiteboardDocumentRequest,
  type WhiteboardDocument,
} from './whiteboard-document'

vi.mock('@/shared/api', () => ({
  axiosInstance: {
    delete: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
  },
}))

const documentFixture: WhiteboardDocument = {
  id: 'document-1',
  projectId: 'project-1',
  name: '킥오프 화이트보드',
  creatorId: 'user-1',
  creator: { id: 'user-1', name: '김민지' },
  createdAt: '2026-01-12T00:00:00.000Z',
  updatedAt: '2026-01-12T03:00:00.000Z',
}

const LIST_URL = '/workspaces/workspace-1/projects/project-1/whiteboard-documents'

describe('whiteboard document API requests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('목록 조회에 페이지, 검색어, bearer token을 전달한다', async () => {
    vi.mocked(axiosInstance.get).mockResolvedValueOnce({
      data: {
        whiteboardDocuments: [documentFixture],
        pagination: { page: 1, limit: 12, total: 1, totalPages: 1 },
      },
    })

    await expect(
      listWhiteboardDocumentsRequest(
        'workspace-1',
        'project-1',
        { page: 1, limit: 12, search: '킥오프' },
        'token-1',
      ),
    ).resolves.toEqual({
      whiteboardDocuments: [documentFixture],
      pagination: { page: 1, limit: 12, total: 1, totalPages: 1 },
    })

    expect(axiosInstance.get).toHaveBeenCalledWith(LIST_URL, {
      params: { page: 1, limit: 12, search: '킥오프' },
      headers: { Authorization: 'Bearer token-1' },
    })
  })

  it('공백뿐인 검색어는 쿼리에서 제외한다', async () => {
    vi.mocked(axiosInstance.get).mockResolvedValueOnce({
      data: {
        whiteboardDocuments: [],
        pagination: { page: 1, limit: 12, total: 0, totalPages: 0 },
      },
    })

    await listWhiteboardDocumentsRequest(
      'workspace-1',
      'project-1',
      { page: 1, limit: 12, search: '   ' },
      'token-1',
    )

    expect(axiosInstance.get).toHaveBeenCalledWith(LIST_URL, {
      params: { page: 1, limit: 12 },
      headers: { Authorization: 'Bearer token-1' },
    })
  })

  it('생성 요청은 이름만 보내고 생성된 문서를 반환한다', async () => {
    const created = { ...documentFixture, creator: undefined }
    delete (created as Record<string, unknown>).creator

    vi.mocked(axiosInstance.post).mockResolvedValueOnce({
      data: { whiteboardDocument: created },
    })

    await expect(
      createWhiteboardDocumentRequest(
        'workspace-1',
        'project-1',
        { name: '킥오프 화이트보드' },
        'token-1',
      ),
    ).resolves.toEqual(created)

    expect(axiosInstance.post).toHaveBeenCalledWith(
      LIST_URL,
      { name: '킥오프 화이트보드' },
      { headers: { Authorization: 'Bearer token-1' } },
    )
  })

  it('이름 변경 요청은 문서 경로로 patch하고 변경 결과만 반환한다', async () => {
    const updated = {
      id: 'document-1',
      name: '킥오프 v2',
      updatedAt: '2026-01-12T04:00:00.000Z',
    }

    vi.mocked(axiosInstance.patch).mockResolvedValueOnce({
      data: { whiteboardDocument: updated },
    })

    await expect(
      updateWhiteboardDocumentRequest(
        'workspace-1',
        'project-1',
        'document-1',
        { name: '킥오프 v2' },
        'token-1',
      ),
    ).resolves.toEqual(updated)

    expect(axiosInstance.patch).toHaveBeenCalledWith(
      `${LIST_URL}/document-1`,
      { name: '킥오프 v2' },
      { headers: { Authorization: 'Bearer token-1' } },
    )
  })

  it('삭제 요청은 문서 경로로 delete한다', async () => {
    vi.mocked(axiosInstance.delete).mockResolvedValueOnce({ data: undefined })

    await deleteWhiteboardDocumentRequest(
      'workspace-1',
      'project-1',
      'document-1',
      'token-1',
    )

    expect(axiosInstance.delete).toHaveBeenCalledWith(`${LIST_URL}/document-1`, {
      headers: { Authorization: 'Bearer token-1' },
    })
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm test -- src/entities/whiteboard-document`
Expected: FAIL — `Failed to resolve import "./whiteboard-document"`

- [ ] **Step 3: API 클라이언트 구현**

```ts
// src/entities/whiteboard-document/api/whiteboard-document.ts
import { axiosInstance } from '@/shared/api'
import type { Pagination } from '@/shared/types/pagination'

export type WhiteboardDocumentCreator = {
  id: string
  name: string
}

export type WhiteboardDocument = {
  id: string
  projectId: string
  name: string
  creatorId: string
  creator: WhiteboardDocumentCreator
  createdAt: string
  updatedAt: string
}

/** 생성 응답은 creator를 포함하지 않는다. */
export type CreatedWhiteboardDocument = Omit<WhiteboardDocument, 'creator'>

/** 이름 변경 응답은 변경된 필드만 돌려준다. */
export type UpdatedWhiteboardDocument = {
  id: string
  name: string
  updatedAt: string
}

export type WhiteboardDocumentListParams = {
  page: number
  limit: number
  search?: string
}

export type ListWhiteboardDocumentsResponse = {
  whiteboardDocuments: WhiteboardDocument[]
  pagination: Pagination
}

export type WhiteboardDocumentInput = {
  name: string
}

function authorization(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` }
}

function documentsUrl(workspaceId: string, projectId: string) {
  return `/workspaces/${workspaceId}/projects/${projectId}/whiteboard-documents`
}

export async function listWhiteboardDocumentsRequest(
  workspaceId: string,
  projectId: string,
  params: WhiteboardDocumentListParams,
  accessToken: string,
): Promise<ListWhiteboardDocumentsResponse> {
  const search = params.search?.trim()
  const { data } = await axiosInstance.get<ListWhiteboardDocumentsResponse>(
    documentsUrl(workspaceId, projectId),
    {
      params: {
        page: params.page,
        limit: params.limit,
        ...(search ? { search } : {}),
      },
      headers: authorization(accessToken),
    },
  )

  return data
}

export async function createWhiteboardDocumentRequest(
  workspaceId: string,
  projectId: string,
  input: WhiteboardDocumentInput,
  accessToken: string,
): Promise<CreatedWhiteboardDocument> {
  const { data } = await axiosInstance.post<{
    whiteboardDocument: CreatedWhiteboardDocument
  }>(documentsUrl(workspaceId, projectId), input, {
    headers: authorization(accessToken),
  })

  return data.whiteboardDocument
}

export async function updateWhiteboardDocumentRequest(
  workspaceId: string,
  projectId: string,
  documentId: string,
  input: WhiteboardDocumentInput,
  accessToken: string,
): Promise<UpdatedWhiteboardDocument> {
  const { data } = await axiosInstance.patch<{
    whiteboardDocument: UpdatedWhiteboardDocument
  }>(`${documentsUrl(workspaceId, projectId)}/${documentId}`, input, {
    headers: authorization(accessToken),
  })

  return data.whiteboardDocument
}

export async function deleteWhiteboardDocumentRequest(
  workspaceId: string,
  projectId: string,
  documentId: string,
  accessToken: string,
): Promise<void> {
  await axiosInstance.delete(
    `${documentsUrl(workspaceId, projectId)}/${documentId}`,
    { headers: authorization(accessToken) },
  )
}
```

- [ ] **Step 4: barrel 작성**

```ts
// src/entities/whiteboard-document/index.ts
export {
  createWhiteboardDocumentRequest,
  deleteWhiteboardDocumentRequest,
  listWhiteboardDocumentsRequest,
  updateWhiteboardDocumentRequest,
} from './api/whiteboard-document'
export type {
  CreatedWhiteboardDocument,
  ListWhiteboardDocumentsResponse,
  UpdatedWhiteboardDocument,
  WhiteboardDocument,
  WhiteboardDocumentCreator,
  WhiteboardDocumentInput,
  WhiteboardDocumentListParams,
} from './api/whiteboard-document'
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `pnpm test -- src/entities/whiteboard-document`
Expected: PASS (5 tests)

---

## Task 6: 화이트보드 문서 쿼리 훅

**Files:**
- Create: `src/features/whiteboard-document/model/use-whiteboard-documents.ts`
- Create: `src/features/whiteboard-document/model/use-whiteboard-documents.test.tsx`
- Create: `src/features/whiteboard-document/index.ts`

**Interfaces:**
- Consumes: Task 5의 요청 함수 4종
- Produces:
  - `useWhiteboardDocuments(accessToken, workspaceId, projectId, params)`
  - `useCreateWhiteboardDocument(accessToken, workspaceId, projectId)` — `mutateAsync(input: WhiteboardDocumentInput)`
  - `useUpdateWhiteboardDocument(accessToken, workspaceId, projectId)` — `mutateAsync({ documentId, input })`
  - `useDeleteWhiteboardDocument(accessToken, workspaceId, projectId)` — `mutateAsync(documentId: string)`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/features/project/model/use-projects.test.tsx`의 wrapper 구성 방식을 그대로 따른다. 구현 전에 그 파일을 열어 `QueryClientProvider` wrapper 헬퍼를 확인하고 동일하게 쓴다.

```tsx
// src/features/whiteboard-document/model/use-whiteboard-documents.test.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createWhiteboardDocumentRequest,
  deleteWhiteboardDocumentRequest,
  listWhiteboardDocumentsRequest,
  updateWhiteboardDocumentRequest,
} from '@/entities/whiteboard-document'

import {
  useCreateWhiteboardDocument,
  useDeleteWhiteboardDocument,
  useUpdateWhiteboardDocument,
  useWhiteboardDocuments,
} from './use-whiteboard-documents'

vi.mock('@/entities/whiteboard-document', () => ({
  createWhiteboardDocumentRequest: vi.fn(),
  deleteWhiteboardDocumentRequest: vi.fn(),
  listWhiteboardDocumentsRequest: vi.fn(),
  updateWhiteboardDocumentRequest: vi.fn(),
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }

  return { Wrapper, invalidateQueries }
}

const params = { page: 1, limit: 12, search: '' }

describe('use-whiteboard-documents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('accessToken이 없으면 목록을 조회하지 않는다', () => {
    const { Wrapper } = createWrapper()

    renderHook(
      () => useWhiteboardDocuments(null, 'workspace-1', 'project-1', params),
      { wrapper: Wrapper },
    )

    expect(listWhiteboardDocumentsRequest).not.toHaveBeenCalled()
  })

  it('목록 조회에 식별자와 파라미터를 전달한다', async () => {
    const { Wrapper } = createWrapper()
    vi.mocked(listWhiteboardDocumentsRequest).mockResolvedValue({
      whiteboardDocuments: [],
      pagination: { page: 1, limit: 12, total: 0, totalPages: 0 },
    })

    renderHook(
      () => useWhiteboardDocuments('token-1', 'workspace-1', 'project-1', params),
      { wrapper: Wrapper },
    )

    await waitFor(() => {
      expect(listWhiteboardDocumentsRequest).toHaveBeenCalledWith(
        'workspace-1',
        'project-1',
        params,
        'token-1',
      )
    })
  })

  it('생성 성공 시 문서 목록 쿼리를 무효화한다', async () => {
    const { Wrapper, invalidateQueries } = createWrapper()
    vi.mocked(createWhiteboardDocumentRequest).mockResolvedValue({
      id: 'document-1',
      projectId: 'project-1',
      name: '킥오프',
      creatorId: 'user-1',
      createdAt: '2026-01-12T00:00:00.000Z',
      updatedAt: '2026-01-12T00:00:00.000Z',
    })

    const { result } = renderHook(
      () => useCreateWhiteboardDocument('token-1', 'workspace-1', 'project-1'),
      { wrapper: Wrapper },
    )

    await result.current.mutateAsync({ name: '킥오프' })

    expect(createWhiteboardDocumentRequest).toHaveBeenCalledWith(
      'workspace-1',
      'project-1',
      { name: '킥오프' },
      'token-1',
    )
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['whiteboard-documents', 'workspace-1', 'project-1'],
    })
  })

  it('이름 변경 성공 시 문서 목록 쿼리를 무효화한다', async () => {
    const { Wrapper, invalidateQueries } = createWrapper()
    vi.mocked(updateWhiteboardDocumentRequest).mockResolvedValue({
      id: 'document-1',
      name: '킥오프 v2',
      updatedAt: '2026-01-12T01:00:00.000Z',
    })

    const { result } = renderHook(
      () => useUpdateWhiteboardDocument('token-1', 'workspace-1', 'project-1'),
      { wrapper: Wrapper },
    )

    await result.current.mutateAsync({
      documentId: 'document-1',
      input: { name: '킥오프 v2' },
    })

    expect(updateWhiteboardDocumentRequest).toHaveBeenCalledWith(
      'workspace-1',
      'project-1',
      'document-1',
      { name: '킥오프 v2' },
      'token-1',
    )
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['whiteboard-documents', 'workspace-1', 'project-1'],
    })
  })

  it('삭제 성공 시 문서 목록 쿼리를 무효화한다', async () => {
    const { Wrapper, invalidateQueries } = createWrapper()
    vi.mocked(deleteWhiteboardDocumentRequest).mockResolvedValue(undefined)

    const { result } = renderHook(
      () => useDeleteWhiteboardDocument('token-1', 'workspace-1', 'project-1'),
      { wrapper: Wrapper },
    )

    await result.current.mutateAsync('document-1')

    expect(deleteWhiteboardDocumentRequest).toHaveBeenCalledWith(
      'workspace-1',
      'project-1',
      'document-1',
      'token-1',
    )
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['whiteboard-documents', 'workspace-1', 'project-1'],
    })
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm test -- src/features/whiteboard-document`
Expected: FAIL — `Failed to resolve import "./use-whiteboard-documents"`

- [ ] **Step 3: 훅 구현**

```ts
// src/features/whiteboard-document/model/use-whiteboard-documents.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  createWhiteboardDocumentRequest,
  deleteWhiteboardDocumentRequest,
  listWhiteboardDocumentsRequest,
  updateWhiteboardDocumentRequest,
  type WhiteboardDocumentInput,
  type WhiteboardDocumentListParams,
} from '@/entities/whiteboard-document'

function listKey(workspaceId: string | null, projectId: string | null) {
  return ['whiteboard-documents', workspaceId, projectId]
}

export function useWhiteboardDocuments(
  accessToken: string | null,
  workspaceId: string | null,
  projectId: string | null,
  params: WhiteboardDocumentListParams,
) {
  return useQuery({
    queryKey: [...listKey(workspaceId, projectId), params],
    queryFn: () =>
      listWhiteboardDocumentsRequest(
        workspaceId as string,
        projectId as string,
        params,
        accessToken as string,
      ),
    enabled: Boolean(accessToken && workspaceId && projectId),
  })
}

export function useCreateWhiteboardDocument(
  accessToken: string | null,
  workspaceId: string | null,
  projectId: string | null,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: WhiteboardDocumentInput) =>
      createWhiteboardDocumentRequest(
        workspaceId as string,
        projectId as string,
        input,
        accessToken as string,
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: listKey(workspaceId, projectId),
      }),
  })
}

export function useUpdateWhiteboardDocument(
  accessToken: string | null,
  workspaceId: string | null,
  projectId: string | null,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      documentId,
      input,
    }: {
      documentId: string
      input: WhiteboardDocumentInput
    }) =>
      updateWhiteboardDocumentRequest(
        workspaceId as string,
        projectId as string,
        documentId,
        input,
        accessToken as string,
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: listKey(workspaceId, projectId),
      }),
  })
}

export function useDeleteWhiteboardDocument(
  accessToken: string | null,
  workspaceId: string | null,
  projectId: string | null,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (documentId: string) =>
      deleteWhiteboardDocumentRequest(
        workspaceId as string,
        projectId as string,
        documentId,
        accessToken as string,
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: listKey(workspaceId, projectId),
      }),
  })
}
```

- [ ] **Step 4: barrel 작성**

```ts
// src/features/whiteboard-document/index.ts
export {
  useCreateWhiteboardDocument,
  useDeleteWhiteboardDocument,
  useUpdateWhiteboardDocument,
  useWhiteboardDocuments,
} from './model/use-whiteboard-documents'
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `pnpm test -- src/features/whiteboard-document`
Expected: PASS (5 tests)

---

## Task 7: `WhiteboardCard`를 그리드와 메뉴에 맞게 수정

**Files:**
- Modify: `src/shared/ui/whiteboard-card.tsx`
- Modify: `src/shared/ui/whiteboard-card.stories.tsx`
- Create: `src/shared/ui/whiteboard-card.test.tsx`

**Interfaces:**
- Produces: `WhiteboardCard` props `{ title, createdAtLabel, updatedAtLabel, creatorName, menu?: ReactNode }` + `ComponentProps<'div'>`. `onMenuClick`은 제거한다. 현재 소비자는 stories 파일뿐이다.

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
// src/shared/ui/whiteboard-card.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { WhiteboardCard } from './whiteboard-card'

describe('WhiteboardCard', () => {
  it('제목, 생성일, 수정일, 생성자를 보여준다', () => {
    render(
      <WhiteboardCard
        title="킥오프 화이트보드"
        createdAtLabel="2026.01.12"
        updatedAtLabel="3시간 전"
        creatorName="김민지"
      />,
    )

    expect(screen.getByText('킥오프 화이트보드')).toBeInTheDocument()
    expect(screen.getByText('생성일 2026.01.12')).toBeInTheDocument()
    expect(screen.getByText('수정일 3시간 전')).toBeInTheDocument()
    expect(screen.getByText('김민지')).toBeInTheDocument()
  })

  it('menu를 주지 않으면 메뉴 영역을 렌더링하지 않는다', () => {
    render(
      <WhiteboardCard
        title="킥오프 화이트보드"
        createdAtLabel="2026.01.12"
        updatedAtLabel="3시간 전"
        creatorName="김민지"
      />,
    )

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('menu 슬롯에 넘긴 노드를 썸네일 위에 렌더링한다', () => {
    render(
      <WhiteboardCard
        title="킥오프 화이트보드"
        createdAtLabel="2026.01.12"
        updatedAtLabel="3시간 전"
        creatorName="김민지"
        menu={<button type="button">더 보기</button>}
      />,
    )

    expect(screen.getByRole('button', { name: '더 보기' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm test -- src/shared/ui/whiteboard-card.test.tsx`
Expected: FAIL — `menu` prop이 없어 세 번째 테스트가 실패한다

- [ ] **Step 3: 컴포넌트 수정**

- `WhiteboardCardProps`에서 `onMenuClick?: () => void`를 지우고 `menu?: React.ReactNode`를 추가한다
- 루트 `div`의 클래스에서 `w-58`을 `w-full`로 바꾼다
- 썸네일 영역의 인라인 `<button>` 블록을 아래로 교체한다

```tsx
{menu && <div className="absolute top-2 right-2">{menu}</div>}
```

- `MoreVertical` import를 지운다

- [ ] **Step 4: stories 갱신**

`whiteboard-card.stories.tsx`에서 `onMenuClick`을 쓰는 story를 `menu` 슬롯을 쓰도록 바꾼다. 최소한 메뉴 없는 story 하나와 메뉴 있는 story 하나를 남긴다.

- [ ] **Step 5: 테스트와 타입 검사 통과 확인**

Run: `pnpm test -- src/shared/ui/whiteboard-card.test.tsx && pnpm exec tsc -b`
Expected: PASS, 타입 오류 없음

---

## Task 8: 문서 생성·이름 변경·삭제 Dialog

**Files:**
- Create: `src/features/whiteboard-document/ui/WhiteboardDocumentFormDialog.tsx`
- Create: `src/features/whiteboard-document/ui/WhiteboardDocumentFormDialog.test.tsx`
- Create: `src/features/whiteboard-document/ui/WhiteboardDocumentDeleteDialog.tsx`
- Modify: `src/shared/constants/messages.ts`

**Interfaces:**
- Produces:
  - `WhiteboardDocumentFormDialog` props `{ open, title, submitLabel, onOpenChange, onSubmit: (input: { name: string }) => void, initialName?, loading?, error? }`
  - `WhiteboardDocumentDeleteDialog` props `{ open, documentName, onOpenChange, onConfirm, loading?, error? }`

- [ ] **Step 1: 메시지 상수 추가**

`src/shared/constants/messages.ts`의 `MESSAGES`에 추가한다.

```ts
  WHITEBOARD_NAME_REQUIRED: '화이트보드 이름을 입력해주세요',
  WHITEBOARD_NAME_TOO_LONG: '화이트보드 이름은 50자 이하로 입력해주세요',
```

- [ ] **Step 2: 실패하는 테스트 작성**

```tsx
// src/features/whiteboard-document/ui/WhiteboardDocumentFormDialog.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { MESSAGES } from '@/shared/constants/messages'

import { WhiteboardDocumentFormDialog } from './WhiteboardDocumentFormDialog'

function renderDialog(overrides: Record<string, unknown> = {}) {
  const props = {
    open: true,
    title: '새 화이트보드 만들기',
    submitLabel: '만들기',
    onOpenChange: vi.fn(),
    onSubmit: vi.fn(),
    ...overrides,
  }

  render(<WhiteboardDocumentFormDialog {...(props as never)} />)
  return props
}

describe('WhiteboardDocumentFormDialog', () => {
  it('이름이 비어 있으면 제출하지 않고 오류를 보여준다', async () => {
    const props = renderDialog()

    await userEvent.click(screen.getByRole('button', { name: '만들기' }))

    expect(screen.getByText(MESSAGES.WHITEBOARD_NAME_REQUIRED)).toBeInTheDocument()
    expect(props.onSubmit).not.toHaveBeenCalled()
  })

  it('앞뒤 공백을 제거한 이름을 전달한다', async () => {
    const props = renderDialog()

    await userEvent.type(screen.getByLabelText('이름'), '  킥오프 화이트보드  ')
    await userEvent.click(screen.getByRole('button', { name: '만들기' }))

    expect(props.onSubmit).toHaveBeenCalledWith({ name: '킥오프 화이트보드' })
  })

  it('초기 이름을 입력값으로 채운다', () => {
    renderDialog({ initialName: '로고 스케치 v2', title: '화이트보드 이름 변경', submitLabel: '저장' })

    expect(screen.getByLabelText('이름')).toHaveValue('로고 스케치 v2')
  })

  it('오류 문구를 보여준다', () => {
    renderDialog({ error: '화이트보드를 만들지 못했어요' })

    expect(screen.getByRole('alert')).toHaveTextContent('화이트보드를 만들지 못했어요')
  })

  it('로딩 중에는 제출해도 onSubmit을 호출하지 않는다', async () => {
    const props = renderDialog({ loading: true, initialName: '킥오프' })

    await userEvent.click(screen.getByRole('button', { name: '만들기' }))

    expect(props.onSubmit).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `pnpm test -- src/features/whiteboard-document/ui/WhiteboardDocumentFormDialog.test.tsx`
Expected: FAIL — `Failed to resolve import "./WhiteboardDocumentFormDialog"`

- [ ] **Step 4: Form Dialog 구현**

`ProjectFormDialog.tsx`를 기준으로 설명 필드와 그 검증을 뺀 형태로 만든다. `id`는 `whiteboard-document-name`을 쓴다.

```tsx
// src/features/whiteboard-document/ui/WhiteboardDocumentFormDialog.tsx
import { useState, type FormEvent } from 'react'

import type { WhiteboardDocumentInput } from '@/entities/whiteboard-document'
import { MESSAGES } from '@/shared/constants/messages'
import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'

type WhiteboardDocumentFormDialogProps = {
  open: boolean
  title: string
  submitLabel: string
  onOpenChange: (open: boolean) => void
  onSubmit: (input: WhiteboardDocumentInput) => void
  initialName?: string
  loading?: boolean
  error?: string
}

function WhiteboardDocumentFormDialog({
  open,
  title,
  submitLabel,
  onOpenChange,
  onSubmit,
  initialName = '',
  loading = false,
  error,
}: WhiteboardDocumentFormDialogProps) {
  const [name, setName] = useState(initialName)
  const [validationError, setValidationError] = useState<string | null>(null)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (loading) return

    const trimmedName = name.trim()
    if (!trimmedName) {
      setValidationError(MESSAGES.WHITEBOARD_NAME_REQUIRED)
      return
    }
    if (trimmedName.length > 50) {
      setValidationError(MESSAGES.WHITEBOARD_NAME_TOO_LONG)
      return
    }

    setValidationError(null)
    onSubmit({ name: trimmedName })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-90">
        <DialogTitle>{title}</DialogTitle>
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <label
              className="text-label text-foreground-default"
              htmlFor="whiteboard-document-name"
            >
              이름
            </label>
            <Input
              id="whiteboard-document-name"
              value={name}
              disabled={loading}
              onChange={(event) => {
                setName(event.target.value)
                if (validationError) setValidationError(null)
              }}
              placeholder="예: 킥오프 화이트보드"
              maxLength={50}
              aria-invalid={Boolean(validationError)}
              aria-describedby={
                validationError ? 'whiteboard-document-name-error' : undefined
              }
            />
            {validationError && (
              <p
                id="whiteboard-document-name-error"
                className="text-caption text-status-danger"
              >
                {validationError}
              </p>
            )}
          </div>
          {error && (
            <p className="text-caption text-status-danger mt-3" role="alert">
              {error}
            </p>
          )}
          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="tertiary"
              disabled={loading}
              onClick={() => onOpenChange(false)}
            >
              취소
            </Button>
            <Button type="submit" loading={loading}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export { WhiteboardDocumentFormDialog }
```

- [ ] **Step 5: Delete Dialog 구현**

`ProjectDeleteDialog.tsx`와 같은 구조로 문구만 바꾼다.

```tsx
// src/features/whiteboard-document/ui/WhiteboardDocumentDeleteDialog.tsx
import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/shared/ui/dialog'

type WhiteboardDocumentDeleteDialogProps = {
  open: boolean
  documentName: string
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  loading?: boolean
  error?: string
}

function WhiteboardDocumentDeleteDialog({
  open,
  documentName,
  onOpenChange,
  onConfirm,
  loading = false,
  error,
}: WhiteboardDocumentDeleteDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!loading) onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="max-w-90">
        <DialogTitle>화이트보드 문서 삭제</DialogTitle>
        <DialogDescription>
          <strong className="text-foreground-default">{documentName}</strong>
          을(를) 삭제하면 되돌릴 수 없어요.
        </DialogDescription>
        {error && (
          <p className="text-caption text-status-danger" role="alert">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="tertiary"
            disabled={loading}
            onClick={() => onOpenChange(false)}
          >
            취소
          </Button>
          <Button
            type="button"
            variant="destructive"
            loading={loading}
            onClick={onConfirm}
          >
            삭제
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { WhiteboardDocumentDeleteDialog }
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `pnpm test -- src/features/whiteboard-document`
Expected: PASS

---

## Task 9: 컨텍스트 메뉴와 Table View

**Files:**
- Create: `src/features/whiteboard-document/ui/WhiteboardDocumentMenu.tsx`
- Create: `src/features/whiteboard-document/ui/WhiteboardDocumentTable.tsx`
- Create: `src/features/whiteboard-document/ui/WhiteboardDocumentTable.test.tsx`

**Interfaces:**
- Consumes: Task 2의 `formatCreatedAt` · `formatUpdatedAt`
- Produces:
  - `WhiteboardDocumentMenu` props `{ document, onRename, onDelete }` — 항목은 "이름 변경"과 "화이트보드 문서 삭제"
  - `WhiteboardDocumentTable` props `{ documents, onRename, onDelete, canManage?: (document) => boolean }`

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
// src/features/whiteboard-document/ui/WhiteboardDocumentTable.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { WhiteboardDocument } from '@/entities/whiteboard-document'

import { WhiteboardDocumentTable } from './WhiteboardDocumentTable'

const documents: WhiteboardDocument[] = [
  {
    id: 'document-1',
    projectId: 'project-1',
    name: '킥오프 화이트보드',
    creatorId: 'user-1',
    creator: { id: 'user-1', name: '김민지' },
    createdAt: '2026-01-12T00:00:00.000Z',
    updatedAt: '2026-01-12T00:00:00.000Z',
  },
  {
    id: 'document-2',
    projectId: 'project-1',
    name: '로고 스케치 v2',
    creatorId: 'user-2',
    creator: { id: 'user-2', name: '이서준' },
    createdAt: '2026-01-14T00:00:00.000Z',
    updatedAt: '2026-01-14T00:00:00.000Z',
  },
]

describe('WhiteboardDocumentTable', () => {
  it('이름·생성자·생성일·수정일 컬럼을 보여준다', () => {
    render(
      <WhiteboardDocumentTable
        documents={documents}
        onRename={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    expect(screen.getByRole('columnheader', { name: '이름' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: '생성자' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: '생성일' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: '수정일' })).toBeInTheDocument()
    expect(screen.getByText('킥오프 화이트보드')).toBeInTheDocument()
    expect(screen.getByText('2026.01.12')).toBeInTheDocument()
  })

  it('관리 권한이 없는 문서에는 메뉴를 렌더링하지 않는다', () => {
    render(
      <WhiteboardDocumentTable
        documents={documents}
        onRename={vi.fn()}
        onDelete={vi.fn()}
        canManage={(document) => document.id === 'document-1'}
      />,
    )

    expect(
      screen.getByRole('button', { name: '킥오프 화이트보드 메뉴' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: '로고 스케치 v2 메뉴' }),
    ).not.toBeInTheDocument()
  })

  it('메뉴에서 이름 변경과 삭제를 호출한다', async () => {
    const onRename = vi.fn()
    const onDelete = vi.fn()
    render(
      <WhiteboardDocumentTable
        documents={[documents[0]]}
        onRename={onRename}
        onDelete={onDelete}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: '킥오프 화이트보드 메뉴' }))
    await userEvent.click(screen.getByRole('menuitem', { name: '이름 변경' }))

    expect(onRename).toHaveBeenCalledWith(documents[0])

    await userEvent.click(screen.getByRole('button', { name: '킥오프 화이트보드 메뉴' }))
    await userEvent.click(screen.getByRole('menuitem', { name: '화이트보드 문서 삭제' }))

    expect(onDelete).toHaveBeenCalledWith(documents[0])
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm test -- src/features/whiteboard-document/ui/WhiteboardDocumentTable.test.tsx`
Expected: FAIL — `Failed to resolve import "./WhiteboardDocumentTable"`

- [ ] **Step 3: 메뉴 구현**

`ProjectCard.tsx`의 `ProjectMenu`와 같은 구조다. 트리거의 `aria-label`은 `` `${document.name} 메뉴` ``다.

```tsx
// src/features/whiteboard-document/ui/WhiteboardDocumentMenu.tsx
import { MoreVertical } from 'lucide-react'

import type { WhiteboardDocument } from '@/entities/whiteboard-document'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'

type WhiteboardDocumentMenuProps = {
  document: WhiteboardDocument
  onRename: (document: WhiteboardDocument) => void
  onDelete: (document: WhiteboardDocument) => void
}

function WhiteboardDocumentMenu({
  document,
  onRename,
  onDelete,
}: WhiteboardDocumentMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`${document.name} 메뉴`}
          className="text-foreground-tertiary hover:bg-action-secondary-hover focus-visible:ring-action-focus-ring flex size-7 items-center justify-center rounded-md outline-none focus-visible:ring-3"
        >
          <MoreVertical className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onRename(document)}>
          이름 변경
        </DropdownMenuItem>
        <DropdownMenuItem variant="danger" onSelect={() => onDelete(document)}>
          화이트보드 문서 삭제
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export { WhiteboardDocumentMenu }
```

- [ ] **Step 4: Table 구현**

`ProjectTable.tsx`와 같은 컬럼 폭을 쓴다.

```tsx
// src/features/whiteboard-document/ui/WhiteboardDocumentTable.tsx
import type { WhiteboardDocument } from '@/entities/whiteboard-document'
import { formatCreatedAt, formatUpdatedAt } from '@/shared/lib/resource-date'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/table'

import { WhiteboardDocumentMenu } from './WhiteboardDocumentMenu'

type WhiteboardDocumentTableProps = {
  documents: WhiteboardDocument[]
  onRename: (document: WhiteboardDocument) => void
  onDelete: (document: WhiteboardDocument) => void
  canManage?: (document: WhiteboardDocument) => boolean
}

function WhiteboardDocumentTable({
  documents,
  onRename,
  onDelete,
  canManage = () => true,
}: WhiteboardDocumentTableProps) {
  return (
    <Table className="min-w-[1008px] table-fixed">
      <TableHeader>
        <TableRow>
          <TableHead className="w-[420px]">이름</TableHead>
          <TableHead className="w-[180px]">생성자</TableHead>
          <TableHead className="w-[180px]">생성일</TableHead>
          <TableHead className="w-[180px]">수정일</TableHead>
          <TableHead className="w-12" aria-label="작업" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {documents.map((document) => (
          <TableRow key={document.id}>
            <TableCell>
              <span className="text-card-title text-foreground-strong block truncate">
                {document.name}
              </span>
            </TableCell>
            <TableCell>
              <span className="truncate">{document.creator.name}</span>
            </TableCell>
            <TableCell>
              <span className="whitespace-nowrap">
                {formatCreatedAt(document.createdAt)}
              </span>
            </TableCell>
            <TableCell>
              <span className="whitespace-nowrap">
                {formatUpdatedAt(document.updatedAt)}
              </span>
            </TableCell>
            <TableCell>
              {canManage(document) && (
                <WhiteboardDocumentMenu
                  document={document}
                  onRename={onRename}
                  onDelete={onDelete}
                />
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export { WhiteboardDocumentTable }
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `pnpm test -- src/features/whiteboard-document`
Expected: PASS

---

## Task 10: 문서 목록 컨테이너

**Files:**
- Create: `src/features/whiteboard-document/ui/WhiteboardDocumentListContent.tsx`
- Create: `src/features/whiteboard-document/ui/WhiteboardDocumentListContent.test.tsx`
- Modify: `src/features/whiteboard-document/index.ts`

**Interfaces:**
- Consumes: Task 3 `ViewToggle`·`ListView`, Task 4 `ListPagination`, Task 6 훅 4종, Task 7 `WhiteboardCard`, Task 8 Dialog 2종, Task 9 `WhiteboardDocumentMenu`·`WhiteboardDocumentTable`
- Produces: `WhiteboardDocumentListContent` props `{ accessToken: string; workspaceId: string; projectId: string; userId: string; workspaceRole?: WorkspaceRole }`

- [ ] **Step 1: 실패하는 테스트 작성**

`ProjectListContent.test.tsx`의 mock 구성 방식을 그대로 따른다. 구현 전에 그 파일을 열어 훅 mock과 `QueryClientProvider` 없이 렌더링하는 방식을 확인하고 동일하게 쓴다.

```tsx
// src/features/whiteboard-document/ui/WhiteboardDocumentListContent.test.tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { WhiteboardDocument } from '@/entities/whiteboard-document'
import {
  useCreateWhiteboardDocument,
  useDeleteWhiteboardDocument,
  useUpdateWhiteboardDocument,
  useWhiteboardDocuments,
} from '@/features/whiteboard-document'

import { WhiteboardDocumentListContent } from './WhiteboardDocumentListContent'

vi.mock('@/features/whiteboard-document', () => ({
  useCreateWhiteboardDocument: vi.fn(),
  useDeleteWhiteboardDocument: vi.fn(),
  useUpdateWhiteboardDocument: vi.fn(),
  useWhiteboardDocuments: vi.fn(),
}))

vi.mock('@/shared/ui/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const documents: WhiteboardDocument[] = [
  {
    id: 'document-1',
    projectId: 'project-1',
    name: '킥오프 화이트보드',
    creatorId: 'user-1',
    creator: { id: 'user-1', name: '김민지' },
    createdAt: '2026-01-12T00:00:00.000Z',
    updatedAt: '2026-01-12T00:00:00.000Z',
  },
  {
    id: 'document-2',
    projectId: 'project-1',
    name: '로고 스케치 v2',
    creatorId: 'user-2',
    creator: { id: 'user-2', name: '이서준' },
    createdAt: '2026-01-14T00:00:00.000Z',
    updatedAt: '2026-01-14T00:00:00.000Z',
  },
]

function mockMutation(overrides: Record<string, unknown> = {}) {
  return {
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    reset: vi.fn(),
    isPending: false,
    error: null,
    ...overrides,
  }
}

function mockQuery(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      whiteboardDocuments: documents,
      pagination: { page: 1, limit: 12, total: 2, totalPages: 1 },
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    ...overrides,
  }
}

function renderContent(props: Record<string, unknown> = {}) {
  render(
    <WhiteboardDocumentListContent
      accessToken="token-1"
      workspaceId="workspace-1"
      projectId="project-1"
      userId="user-1"
      {...(props as never)}
    />,
  )
}

describe('WhiteboardDocumentListContent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useWhiteboardDocuments).mockReturnValue(mockQuery() as never)
    vi.mocked(useCreateWhiteboardDocument).mockReturnValue(mockMutation() as never)
    vi.mocked(useUpdateWhiteboardDocument).mockReturnValue(mockMutation() as never)
    vi.mocked(useDeleteWhiteboardDocument).mockReturnValue(mockMutation() as never)
  })

  it('기본은 카드 보기이고 목록 보기로 전환하면 테이블을 보여준다', async () => {
    renderContent()

    expect(screen.getByTestId('whiteboard-document-grid')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '목록 보기' }))

    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.queryByTestId('whiteboard-document-grid')).not.toBeInTheDocument()
  })

  it('검색어를 입력하면 첫 페이지로 조회한다', async () => {
    renderContent()

    await userEvent.type(
      screen.getByRole('textbox', { name: '화이트보드 검색' }),
      '킥오프',
    )

    expect(useWhiteboardDocuments).toHaveBeenLastCalledWith(
      'token-1',
      'workspace-1',
      'project-1',
      { page: 1, limit: 12, search: '킥오프' },
    )
  })

  it('Owner가 아니고 생성자도 아니면 메뉴를 렌더링하지 않는다', () => {
    renderContent({ userId: 'user-1', workspaceRole: 'member' })

    expect(
      screen.getByRole('button', { name: '킥오프 화이트보드 메뉴' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: '로고 스케치 v2 메뉴' }),
    ).not.toBeInTheDocument()
  })

  it('Owner는 모든 문서의 메뉴를 볼 수 있다', () => {
    renderContent({ userId: 'user-3', workspaceRole: 'owner' })

    expect(
      screen.getByRole('button', { name: '로고 스케치 v2 메뉴' }),
    ).toBeInTheDocument()
  })

  it('화이트보드를 만들면 생성 요청을 보내고 Dialog를 닫는다', async () => {
    const createMutation = mockMutation()
    vi.mocked(useCreateWhiteboardDocument).mockReturnValue(createMutation as never)
    renderContent()

    await userEvent.click(screen.getByRole('button', { name: '화이트보드 생성' }))

    const dialog = screen.getByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText('이름'), '새 보드')
    await userEvent.click(within(dialog).getByRole('button', { name: '만들기' }))

    expect(createMutation.mutateAsync).toHaveBeenCalledWith({ name: '새 보드' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('생성이 실패하면 Dialog를 닫지 않고 오류를 보여준다', async () => {
    vi.mocked(useCreateWhiteboardDocument).mockReturnValue(
      mockMutation({
        mutateAsync: vi.fn().mockRejectedValue(new Error('failed')),
        error: new Error('failed'),
      }) as never,
    )
    renderContent()

    await userEvent.click(screen.getByRole('button', { name: '화이트보드 생성' }))

    const dialog = screen.getByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText('이름'), '새 보드')
    await userEvent.click(within(dialog).getByRole('button', { name: '만들기' }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('화이트보드를 만들지 못했어요')
  })

  it('이름 변경을 확정하면 문서 id와 새 이름을 전달한다', async () => {
    const updateMutation = mockMutation()
    vi.mocked(useUpdateWhiteboardDocument).mockReturnValue(updateMutation as never)
    renderContent({ workspaceRole: 'owner' })

    await userEvent.click(screen.getByRole('button', { name: '킥오프 화이트보드 메뉴' }))
    await userEvent.click(screen.getByRole('menuitem', { name: '이름 변경' }))

    const dialog = screen.getByRole('dialog')
    await userEvent.clear(within(dialog).getByLabelText('이름'))
    await userEvent.type(within(dialog).getByLabelText('이름'), '킥오프 v2')
    await userEvent.click(within(dialog).getByRole('button', { name: '저장' }))

    expect(updateMutation.mutateAsync).toHaveBeenCalledWith({
      documentId: 'document-1',
      input: { name: '킥오프 v2' },
    })
  })

  it('삭제를 확정하면 문서 id를 전달한다', async () => {
    const deleteMutation = mockMutation()
    vi.mocked(useDeleteWhiteboardDocument).mockReturnValue(deleteMutation as never)
    renderContent({ workspaceRole: 'owner' })

    await userEvent.click(screen.getByRole('button', { name: '킥오프 화이트보드 메뉴' }))
    await userEvent.click(screen.getByRole('menuitem', { name: '화이트보드 문서 삭제' }))

    const dialog = screen.getByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: '삭제' }))

    expect(deleteMutation.mutateAsync).toHaveBeenCalledWith('document-1')
  })

  it('문서가 없으면 빈 상태를 보여준다', () => {
    vi.mocked(useWhiteboardDocuments).mockReturnValue(
      mockQuery({
        data: {
          whiteboardDocuments: [],
          pagination: { page: 1, limit: 12, total: 0, totalPages: 0 },
        },
      }) as never,
    )
    renderContent()

    expect(screen.getByText('아직 화이트보드가 없어요')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '새 화이트보드 만들기' }),
    ).toBeInTheDocument()
  })

  it('검색 결과가 없으면 검색 전용 빈 상태를 보여준다', async () => {
    renderContent()

    vi.mocked(useWhiteboardDocuments).mockReturnValue(
      mockQuery({
        data: {
          whiteboardDocuments: [],
          pagination: { page: 1, limit: 12, total: 0, totalPages: 0 },
        },
      }) as never,
    )

    await userEvent.type(
      screen.getByRole('textbox', { name: '화이트보드 검색' }),
      '없는이름',
    )

    expect(screen.getByText('검색 결과가 없어요')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '검색 결과 초기화' }),
    ).toBeInTheDocument()
  })

  it('목록 조회가 실패하면 다시 시도 버튼을 보여준다', async () => {
    const refetch = vi.fn()
    vi.mocked(useWhiteboardDocuments).mockReturnValue(
      mockQuery({ isError: true, data: undefined, refetch }) as never,
    )
    renderContent()

    expect(screen.getByText('화이트보드를 불러오지 못했어요')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }))

    expect(refetch).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm test -- src/features/whiteboard-document/ui/WhiteboardDocumentListContent.test.tsx`
Expected: FAIL — `Failed to resolve import "./WhiteboardDocumentListContent"`

- [ ] **Step 3: 컨테이너 구현**

`ProjectListContent.tsx`를 기준으로 아래 차이를 반영해 작성한다.

- 상수 `const DOCUMENTS_PER_PAGE = 12`
- 상태: `search`, `page`, `view`(`ListView`), `createOpen`, `renamingDocument`, `deletingDocument`
- 훅: `useWhiteboardDocuments(accessToken, workspaceId, projectId, { page, limit: DOCUMENTS_PER_PAGE, search })`와 뮤테이션 3종
- 권한 판정: `const canManageDocument = (document: WhiteboardDocument) => workspaceRole === 'owner' || document.creatorId === userId`
- 타이틀 행은 두지 않는다 — Page Header는 Task 12의 `ProjectDetailHeader`가 담당한다. 루트는 `<section className="flex min-w-0 flex-1 flex-col gap-6">`이고 첫 자식이 툴바다
- 툴바: `<Search aria-label="화이트보드 검색" placeholder="화이트보드 이름으로 검색" …/>` + `<ViewToggle value={view} onChange={setView} label="화이트보드 보기 방식" />` + `<Button className="h-9" onClick={openCreateDialog}>화이트보드 생성</Button>`
- 로딩: `화이트보드 불러오는 중`
- 오류: `화이트보드를 불러오지 못했어요` + `다시 시도`
- 빈 상태: 검색 중이면 `SearchIcon`·`검색 결과가 없어요`·`다른 검색어로 다시 시도해보세요`·`검색 결과 초기화`, 아니면 `PenLine`·`아직 화이트보드가 없어요`·`새 화이트보드를 만들어 팀과 함께 아이디어를 그려보세요`·`새 화이트보드 만들기`
- 카드 그리드: `data-testid="whiteboard-document-grid"`, 클래스는 `ProjectListContent`의 그리드와 동일하게 `grid grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))] gap-3 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-3 min-[1360px]:grid-cols-4`
- 각 카드는 `WhiteboardCard`에 `title`, `createdAtLabel={formatCreatedAt(document.createdAt)}`, `updatedAtLabel={formatUpdatedAt(document.updatedAt)}`, `creatorName={document.creator.name}`를 주고, `canManageDocument(document)`일 때만 `menu={<WhiteboardDocumentMenu … />}`를 준다
- 테이블: `<WhiteboardDocumentTable documents={documents} onRename={openRenameDialog} onDelete={openDeleteDialog} canManage={canManageDocument} />`
- 페이지네이션: `{pagination && <ListPagination page={page} totalPages={pagination.totalPages} onPageChange={setPage} />}`
- Dialog: 생성은 `title="새 화이트보드 만들기"` `submitLabel="만들기"`, 이름 변경은 `title="화이트보드 이름 변경"` `submitLabel="저장"` `initialName={renamingDocument.name}`. 삭제는 `WhiteboardDocumentDeleteDialog`
- Toast: 생성 `화이트보드를 만들었어요`, 이름 변경 `화이트보드 이름을 변경했어요`, 삭제 `화이트보드를 삭제했어요`
- Dialog 오류 문구: 생성 `화이트보드를 만들지 못했어요`, 이름 변경 `화이트보드 이름을 변경하지 못했어요`, 삭제 `화이트보드를 삭제하지 못했어요`
- 삭제 성공 시 현재 페이지에 항목이 하나뿐이고 `page > 1`이면 `setPage((current) => Math.max(1, current - 1))`

핸들러의 `try { await …mutateAsync(...) } catch { return }` 구조와 `handleXOpenChange`의 `if (!open && mutation.isPending) return` 가드는 `ProjectListContent`와 동일하게 둔다.

- [ ] **Step 4: barrel 갱신**

```ts
// src/features/whiteboard-document/index.ts 에 추가
export { WhiteboardDocumentListContent } from './ui/WhiteboardDocumentListContent'
```

주의: 테스트가 `@/features/whiteboard-document`를 mock하므로, `WhiteboardDocumentListContent.tsx`는 훅을 barrel(`@/features/whiteboard-document`)에서 import해야 mock이 적용된다. `ProjectListContent`가 `@/features/project`에서 훅을 가져오는 것과 같은 이유다.

- [ ] **Step 5: 테스트 통과 확인**

Run: `pnpm test -- src/features/whiteboard-document`
Expected: PASS

---

## Task 11: 프로젝트 단건 조회

**Files:**
- Modify: `src/entities/project/api/project.ts`
- Modify: `src/entities/project/index.ts`
- Modify: `src/entities/project/api/project.test.ts`
- Modify: `src/features/project/model/use-projects.ts`
- Modify: `src/features/project/index.ts`
- Modify: `src/features/project/model/use-projects.test.tsx`

**Interfaces:**
- Produces:
  - `getProjectRequest(workspaceId, projectId, accessToken): Promise<Project>`
  - `useProject(accessToken, workspaceId, projectId)` — 쿼리 키 `['project', workspaceId, projectId]`
  - `isProjectNotFound(error: unknown): boolean` — 오류 코드가 `PROJECT_NOT_FOUND` 또는 `WORKSPACE_NOT_FOUND`면 `true`

- [ ] **Step 1: 실패하는 테스트 추가**

`src/entities/project/api/project.test.ts`의 `describe` 안에 추가한다.

```ts
  it('프로젝트 단건 조회에 workspace, project, bearer token을 전달한다', async () => {
    vi.mocked(axiosInstance.get).mockResolvedValueOnce({
      data: { project: projectFixture },
    })

    await expect(
      getProjectRequest('workspace-1', 'project-1', 'token-1'),
    ).resolves.toEqual(projectFixture)

    expect(axiosInstance.get).toHaveBeenCalledWith(
      '/workspaces/workspace-1/projects/project-1',
      { headers: { Authorization: 'Bearer token-1' } },
    )
  })
```

import 목록에 `getProjectRequest`를 추가한다.

`src/features/project/model/use-projects.test.tsx`에는 아래를 추가한다.

```tsx
  it('프로젝트 단건 조회는 project 키를 쓴다', async () => {
    const { Wrapper } = createWrapper()
    vi.mocked(getProjectRequest).mockResolvedValue(projectFixture)

    renderHook(() => useProject('token-1', 'workspace-1', 'project-1'), {
      wrapper: Wrapper,
    })

    await waitFor(() => {
      expect(getProjectRequest).toHaveBeenCalledWith(
        'workspace-1',
        'project-1',
        'token-1',
      )
    })
  })

  it('projectId가 없으면 단건 조회를 하지 않는다', () => {
    const { Wrapper } = createWrapper()

    renderHook(() => useProject('token-1', 'workspace-1', null), {
      wrapper: Wrapper,
    })

    expect(getProjectRequest).not.toHaveBeenCalled()
  })
```

기존 `vi.mock('@/entities/project', …)` 블록에 `getProjectRequest: vi.fn()`을 추가하고, `projectFixture` 상수가 없으면 Task 5의 fixture와 같은 모양으로 정의한다.

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm test -- src/entities/project src/features/project/model`
Expected: FAIL — `getProjectRequest is not exported`

- [ ] **Step 3: API 함수 구현**

```ts
// src/entities/project/api/project.ts 에 추가
export async function getProjectRequest(
  workspaceId: string,
  projectId: string,
  accessToken: string,
): Promise<Project> {
  const { data } = await axiosInstance.get<{ project: Project }>(
    `/workspaces/${workspaceId}/projects/${projectId}`,
    { headers: authorization(accessToken) },
  )

  return data.project
}
```

`src/entities/project/index.ts`의 함수 export 목록에 `getProjectRequest`를 추가한다.

- [ ] **Step 4: 훅과 오류 판별 구현**

```ts
// src/features/project/model/use-projects.ts 에 추가
import { isAxiosError } from 'axios'
import { getProjectRequest } from '@/entities/project'

export function projectErrorCode(error: unknown): string | undefined {
  return isAxiosError(error) ? error.response?.data?.error?.code : undefined
}

export function isProjectNotFound(error: unknown) {
  const code = projectErrorCode(error)
  return code === 'PROJECT_NOT_FOUND' || code === 'WORKSPACE_NOT_FOUND'
}

export function useProject(
  accessToken: string | null,
  workspaceId: string | null,
  projectId: string | null,
) {
  return useQuery({
    queryKey: ['project', workspaceId, projectId],
    queryFn: () =>
      getProjectRequest(
        workspaceId as string,
        projectId as string,
        accessToken as string,
      ),
    enabled: Boolean(accessToken && workspaceId && projectId),
    retry: (count, error) => !isProjectNotFound(error) && count < 2,
  })
}
```

`src/features/project/index.ts`에 `useProject`와 `isProjectNotFound`를 export한다.

- [ ] **Step 5: 테스트 통과 확인**

Run: `pnpm test -- src/entities/project src/features/project`
Expected: PASS

---

## Task 12: 프로젝트 상세 Page Header

**Files:**
- Create: `src/features/project/ui/ProjectDetailHeader.tsx`
- Create: `src/features/project/ui/ProjectDetailHeader.test.tsx`

**Interfaces:**
- Consumes: 기존 `Breadcrumb` 계열, `Avatar`, `DropdownMenu`
- Produces: `ProjectDetailHeader` props `{ project: Project; canManage: boolean; onBack: () => void; onEdit: () => void; onDelete: () => void }`

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
// src/features/project/ui/ProjectDetailHeader.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { Project } from '@/entities/project'

import { ProjectDetailHeader } from './ProjectDetailHeader'

const project: Project = {
  id: 'project-1',
  workspaceId: 'workspace-1',
  name: '2026 브랜드 리뉴얼',
  description: '브랜드 아이덴티티 전면 개편을 위한 프로젝트예요',
  creatorId: 'user-1',
  creator: { id: 'user-1', name: '김민지' },
  createdAt: '2026-01-10T00:00:00.000Z',
  updatedAt: '2026-01-10T03:00:00.000Z',
}

function renderHeader(overrides: Record<string, unknown> = {}) {
  const props = {
    project,
    canManage: true,
    onBack: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  }

  render(<ProjectDetailHeader {...(props as never)} />)
  return props
}

describe('ProjectDetailHeader', () => {
  it('Breadcrumb, 제목, 설명, 생성자를 보여준다', () => {
    renderHeader()

    expect(screen.getByRole('link', { name: '프로젝트' })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: '2026 브랜드 리뉴얼' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('브랜드 아이덴티티 전면 개편을 위한 프로젝트예요'),
    ).toBeInTheDocument()
    expect(screen.getByText('생성자 김민지')).toBeInTheDocument()
  })

  it('설명이 없으면 설명 영역을 렌더링하지 않는다', () => {
    renderHeader({ project: { ...project, description: null } })

    expect(
      screen.queryByText('브랜드 아이덴티티 전면 개편을 위한 프로젝트예요'),
    ).not.toBeInTheDocument()
  })

  it('뒤로가기 버튼과 Breadcrumb 링크가 onBack을 호출한다', async () => {
    const props = renderHeader()

    await userEvent.click(screen.getByRole('button', { name: '프로젝트 목록으로' }))
    expect(props.onBack).toHaveBeenCalledTimes(1)

    await userEvent.click(screen.getByRole('link', { name: '프로젝트' }))
    expect(props.onBack).toHaveBeenCalledTimes(2)
  })

  it('관리 권한이 없으면 프로젝트 메뉴를 렌더링하지 않는다', () => {
    renderHeader({ canManage: false })

    expect(
      screen.queryByRole('button', { name: '2026 브랜드 리뉴얼 메뉴' }),
    ).not.toBeInTheDocument()
  })

  it('메뉴에서 수정과 삭제를 호출한다', async () => {
    const props = renderHeader()

    await userEvent.click(
      screen.getByRole('button', { name: '2026 브랜드 리뉴얼 메뉴' }),
    )
    await userEvent.click(screen.getByRole('menuitem', { name: '수정' }))
    expect(props.onEdit).toHaveBeenCalled()

    await userEvent.click(
      screen.getByRole('button', { name: '2026 브랜드 리뉴얼 메뉴' }),
    )
    await userEvent.click(screen.getByRole('menuitem', { name: '삭제' }))
    expect(props.onDelete).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm test -- src/features/project/ui/ProjectDetailHeader.test.tsx`
Expected: FAIL — `Failed to resolve import "./ProjectDetailHeader"`

- [ ] **Step 3: 컴포넌트 구현**

`DESIGN.md` §9.3의 4단 구조를 그대로 만든다. `shared/ui/page-header.tsx`는 이 구조를 표현할 슬롯이 없으므로 쓰지 않는다.

```tsx
// src/features/project/ui/ProjectDetailHeader.tsx
import { ArrowLeft, MoreVertical } from 'lucide-react'

import type { Project } from '@/entities/project'
import { Avatar, AvatarFallback } from '@/shared/ui/avatar'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/shared/ui/breadcrumb'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'

type ProjectDetailHeaderProps = {
  project: Project
  canManage: boolean
  onBack: () => void
  onEdit: () => void
  onDelete: () => void
}

function ProjectDetailHeader({
  project,
  canManage,
  onBack,
  onEdit,
  onDelete,
}: ProjectDetailHeaderProps) {
  return (
    <header className="flex flex-col gap-4">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink
              href="#"
              onClick={(event) => {
                event.preventDefault()
                onBack()
              }}
            >
              프로젝트
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{project.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="프로젝트 목록으로"
            onClick={onBack}
            className="text-foreground-secondary hover:bg-action-secondary-hover focus-visible:ring-action-focus-ring flex size-7 items-center justify-center rounded-md outline-none focus-visible:ring-3"
          >
            <ArrowLeft className="size-4" />
          </button>
          <h1 className="text-heading1 text-foreground-strong min-w-0 flex-1 truncate">
            {project.name}
          </h1>
          {canManage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={`${project.name} 메뉴`}
                  className="text-foreground-tertiary hover:bg-action-secondary-hover focus-visible:ring-action-focus-ring flex size-7 items-center justify-center rounded-md outline-none focus-visible:ring-3"
                >
                  <MoreVertical className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={onEdit}>수정</DropdownMenuItem>
                <DropdownMenuItem variant="danger" onSelect={onDelete}>
                  삭제
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {project.description && (
          <p className="text-body text-foreground-secondary">
            {project.description}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Avatar size="small">
          <AvatarFallback size="small">
            {project.creator.name.slice(0, 1)}
          </AvatarFallback>
        </Avatar>
        <span className="text-body text-foreground-secondary">
          생성자 {project.creator.name}
        </span>
      </div>
    </header>
  )
}

export { ProjectDetailHeader }
```

API는 확인했다. `BreadcrumbLink`는 `React.ComponentProps<'a'> & { asChild?: boolean }`이라 `href`와 `onClick`을 받고, `Avatar`·`AvatarFallback`은 `size`로 `'small' | 'default' | 'large'`를 받는다 (`small` = 24px).

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm test -- src/features/project/ui/ProjectDetailHeader.test.tsx`
Expected: PASS

---

## Task 13: 프로젝트 상세 페이지

**Files:**
- Create: `src/pages/project-detail/ui/ProjectDetailPage.tsx`
- Create: `src/pages/project-detail/ui/ProjectDetailPage.test.tsx`
- Create: `src/pages/project-detail/index.ts`

**Interfaces:**
- Consumes: `AuthenticatedWorkspaceLayout`, Task 10 `WhiteboardDocumentListContent`, Task 11 `useProject`·`isProjectNotFound`, Task 12 `ProjectDetailHeader`, 기존 `ProjectFormDialog`·`ProjectDeleteDialog`·`useUpdateProject`·`useDeleteProject`
- Produces: `ProjectDetailPage` props `{ workspaceId: string; projectId: string; onBack: () => void; onWorkspaceChange?: (workspaceId: string) => void; onNavChange?: …; onUserClick?: … }`

- [ ] **Step 1: 실패하는 테스트 작성**

`AuthenticatedWorkspaceLayout`을 mock해 render prop에 고정 컨텍스트를 넘긴다. `src/pages/account/ui/AccountPage.test.tsx`의 mock 방식을 먼저 확인하고 같은 형태로 쓴다.

```tsx
// src/pages/project-detail/ui/ProjectDetailPage.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Project } from '@/entities/project'
import { useProject } from '@/features/project'

import { ProjectDetailPage } from './ProjectDetailPage'

vi.mock('@/pages/shared/ui/AuthenticatedWorkspaceLayout', () => ({
  AuthenticatedWorkspaceLayout: ({ children }: { children: (context: unknown) => unknown }) =>
    children({
      accessToken: 'token-1',
      user: { id: 'user-1', name: '김민지', email: 'a@b.c' },
      selectedWorkspace: { id: 'workspace-1', role: 'owner' },
      selectedWorkspaceId: 'workspace-1',
      onAccessLost: vi.fn(),
    }),
}))

vi.mock('@/features/project', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/project')>()
  return {
    ...actual,
    useProject: vi.fn(),
    useUpdateProject: vi.fn(() => ({
      mutateAsync: vi.fn(),
      reset: vi.fn(),
      isPending: false,
      error: null,
    })),
    useDeleteProject: vi.fn(() => ({
      mutateAsync: vi.fn(),
      reset: vi.fn(),
      isPending: false,
      error: null,
    })),
  }
})

vi.mock('@/features/whiteboard-document', () => ({
  WhiteboardDocumentListContent: () => <div data-testid="document-list" />,
}))

const project: Project = {
  id: 'project-1',
  workspaceId: 'workspace-1',
  name: '2026 브랜드 리뉴얼',
  description: '브랜드 아이덴티티 전면 개편',
  creatorId: 'user-1',
  creator: { id: 'user-1', name: '김민지' },
  createdAt: '2026-01-10T00:00:00.000Z',
  updatedAt: '2026-01-10T03:00:00.000Z',
}

function renderPage(onBack = vi.fn()) {
  render(
    <ProjectDetailPage
      workspaceId="workspace-1"
      projectId="project-1"
      onBack={onBack}
    />,
  )
  return onBack
}

describe('ProjectDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('로딩 중에는 Skeleton을 보여주고 문서 목록을 렌더링하지 않는다', () => {
    vi.mocked(useProject).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never)
    renderPage()

    expect(screen.getByTestId('project-detail-header-skeleton')).toBeInTheDocument()
    expect(screen.queryByTestId('document-list')).not.toBeInTheDocument()
  })

  it('프로젝트를 찾을 수 없으면 빈 상태와 목록 이동 버튼을 보여준다', async () => {
    vi.mocked(useProject).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: {
        isAxiosError: true,
        response: { data: { error: { code: 'PROJECT_NOT_FOUND' } } },
      },
      refetch: vi.fn(),
    } as never)
    const onBack = renderPage()

    expect(screen.getByText('프로젝트를 찾을 수 없어요')).toBeInTheDocument()
    expect(screen.queryByTestId('document-list')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '프로젝트 목록으로' }))
    expect(onBack).toHaveBeenCalled()
  })

  it('404가 아닌 오류는 다시 시도 버튼을 보여준다', async () => {
    const refetch = vi.fn()
    vi.mocked(useProject).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: { isAxiosError: true, response: { status: 500, data: {} } },
      refetch,
    } as never)
    renderPage()

    expect(screen.getByText('프로젝트를 불러오지 못했어요')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(refetch).toHaveBeenCalled()
  })

  it('조회에 성공하면 헤더와 문서 목록을 함께 보여준다', () => {
    vi.mocked(useProject).mockReturnValue({
      data: project,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never)
    renderPage()

    expect(
      screen.getByRole('heading', { name: '2026 브랜드 리뉴얼' }),
    ).toBeInTheDocument()
    expect(screen.getByTestId('document-list')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm test -- src/pages/project-detail`
Expected: FAIL — `Failed to resolve import "./ProjectDetailPage"`

- [ ] **Step 3: 페이지 구현**

구조:

```tsx
<AuthenticatedWorkspaceLayout
  workspaceId={workspaceId}
  activeNav="projects"
  onWorkspaceChange={onWorkspaceChange}
  onNavChange={onNavChange}
  onUserClick={onUserClick}
>
  {({ accessToken, selectedWorkspace, user }) => (
    <ProjectDetailContent … />
  )}
</AuthenticatedWorkspaceLayout>
```

`ProjectDetailContent`는 같은 파일 안의 비공개 컴포넌트로 두고 다음을 담당한다.

- `useProject(accessToken, workspaceId, projectId)` 호출
- `isLoading`이면 `data-testid="project-detail-header-skeleton"`를 가진 Skeleton 블록만 렌더링한다. `shared/ui/skeleton.tsx`의 `Skeleton`으로 Breadcrumb(18px) / 제목(28px) / 설명(20px) / 생성자(24px) 높이를 그대로 채워 Layout Shift를 없앤다
- `isError && isProjectNotFound(error)`이면 `EmptyState`(`icon`은 `FolderX`, `title`은 `프로젝트를 찾을 수 없어요`, `description`은 `삭제되었거나 접근할 수 없는 프로젝트예요`, `action`은 `프로젝트 목록으로` Secondary Button → `onBack`)
- `isError && !isProjectNotFound(error)`이면 `프로젝트를 불러오지 못했어요` 문구와 `다시 시도` Secondary Button → `refetch()`
- 성공이면 `<ProjectDetailHeader …/>`와 `<WhiteboardDocumentListContent …/>`를 `<div className="flex min-w-0 flex-1 flex-col gap-6">`로 감싼다
- 프로젝트 관리 권한: `selectedWorkspace?.role === 'owner' || project.creatorId === user.id`
- 프로젝트 수정: `useUpdateProject(accessToken, workspaceId)` + `ProjectFormDialog`. 성공 시 `toast.success('프로젝트를 수정했어요')`
- 프로젝트 삭제: `useDeleteProject(accessToken, workspaceId)` + `ProjectDeleteDialog`. 성공 시 `toast.success('프로젝트를 삭제했어요')` 후 `onBack()`
- Dialog의 열림·로딩 가드·오류 문구는 `ProjectListContent`와 같은 형태로 둔다

barrel:

```ts
// src/pages/project-detail/index.ts
export { ProjectDetailPage } from './ui/ProjectDetailPage'
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm test -- src/pages/project-detail`
Expected: PASS

---

## Task 14: 라우트

**Files:**
- Create: `src/routes/workspaces/$workspaceId/projects_.$projectId.tsx`
- Create: `src/routes/workspaces/$workspaceId/projects_.$projectId.test.tsx`

**Interfaces:**
- Consumes: Task 13 `ProjectDetailPage`, 기존 `redirectIfUnauthenticated`
- Produces: `PROJECT_DETAIL_ROUTE = '/workspaces/$workspaceId/projects/$projectId'`, `Route`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/routes/workspaces/$workspaceId/projects.test.tsx`의 라우터 mount 헬퍼를 그대로 재사용한다. 구현 전에 그 파일을 열어 `createRouter` 구성 방식을 확인하고 동일하게 쓴다.

```tsx
// src/routes/workspaces/$workspaceId/projects_.$projectId.test.tsx
import { describe, expect, it, vi } from 'vitest'

import { PROJECT_DETAIL_ROUTE } from './projects_.$projectId'

vi.mock('@/pages/project-detail', () => ({
  ProjectDetailPage: (props: Record<string, unknown>) => (
    <div
      data-testid="project-detail-page"
      data-workspace-id={String(props.workspaceId)}
      data-project-id={String(props.projectId)}
    />
  ),
}))

describe('프로젝트 상세 라우트', () => {
  it('경로 상수를 노출한다', () => {
    expect(PROJECT_DETAIL_ROUTE).toBe('/workspaces/$workspaceId/projects/$projectId')
  })
})
```

`projects.test.tsx`가 비인증 리다이렉트와 params 전달을 어떻게 검증하는지 확인한 뒤, 같은 방식의 테스트 두 개를 이 파일에 추가한다.

- 비인증 상태로 `/workspaces/workspace-1/projects/project-1`에 진입하면 로그인으로 리다이렉트한다
- 인증 상태로 진입하면 `data-workspace-id="workspace-1"`, `data-project-id="project-1"`가 전달된다

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm test -- src/routes/workspaces`
Expected: FAIL — `Failed to resolve import "./projects_.$projectId"`

- [ ] **Step 3: 라우트 구현**

```tsx
// src/routes/workspaces/$workspaceId/projects_.$projectId.tsx
import { createFileRoute, useNavigate } from '@tanstack/react-router'

import { ProjectDetailPage } from '@/pages/project-detail'

import { redirectIfUnauthenticated } from '../../index'
import { PROJECTS_ROUTE } from './projects'

export const PROJECT_DETAIL_ROUTE =
  '/workspaces/$workspaceId/projects/$projectId' as const

export const Route = createFileRoute(
  '/workspaces/$workspaceId/projects/$projectId',
)({
  beforeLoad: redirectIfUnauthenticated,
  component: WorkspaceProjectDetailRoute,
})

function WorkspaceProjectDetailRoute() {
  const { workspaceId, projectId } = Route.useParams()
  const navigate = useNavigate()

  return (
    <ProjectDetailPage
      workspaceId={workspaceId}
      projectId={projectId}
      onBack={() =>
        void navigate({ to: PROJECTS_ROUTE, params: { workspaceId } })
      }
      onWorkspaceChange={(nextWorkspaceId) =>
        void navigate({
          to: PROJECTS_ROUTE,
          params: { workspaceId: nextWorkspaceId },
        })
      }
      onUserClick={(selectedWorkspaceId) => {
        void navigate({
          to: '/account',
          search: { workspaceId: selectedWorkspaceId ?? workspaceId },
        })
      }}
    />
  )
}
```

`createFileRoute`에 넘기는 문자열은 생성된 라우트 id와 정확히 같아야 한다. `vite.config.ts`의 `tanstackRouter` 플러그인이 `routeFileIgnorePattern: '.*\\.test\\..*'`로 테스트 파일을 제외하고 `src/routeTree.gen.ts`를 생성한다. 이 플러그인은 `vitest/config`의 `defineConfig`를 공유하므로 **`pnpm test`를 돌리기만 해도 라우트 트리가 다시 생성된다**. `pnpm build`는 `tsc -b`를 먼저 돌리므로 라우트 트리가 갱신되기 전에는 타입 오류로 실패한다 — 반드시 테스트를 먼저 돌린다.

- [ ] **Step 4: 라우트 트리 재생성과 테스트 통과 확인**

Run: `pnpm test -- src/routes/workspaces`
Expected: PASS. `src/routeTree.gen.ts`에 `/workspaces/$workspaceId/projects/$projectId`가 추가되고, 기존 `projects.test.tsx`와 `members.test.tsx`도 수정 없이 통과한다.

생성된 id가 `createFileRoute` 인자와 다르면 `src/routeTree.gen.ts`에 실제로 들어간 문자열로 맞추고 다시 돌린다.

Run: `pnpm build`
Expected: 빌드 성공

---

## Task 15: 워크스페이스 홈에서 상세로 이동

**Files:**
- Modify: `src/features/project/ui/ProjectCard.tsx`
- Modify: `src/features/project/ui/ProjectTable.tsx`
- Modify: `src/features/project/ui/ProjectListContent.tsx`
- Modify: `src/pages/home/ui/HomePage.tsx`
- Modify: `src/routes/workspaces/$workspaceId/projects.tsx`
- Modify: `src/features/project/ui/ProjectListContent.test.tsx`

**Interfaces:**
- Produces: `ProjectCard`·`ProjectTable`에 `onOpen?: (project: Project) => void`, `ProjectListContent`에 `onProjectOpen?: (projectId: string) => void`, `HomePage`에 `onProjectOpen?: (projectId: string) => void`

- [ ] **Step 1: 실패하는 테스트 추가**

`src/features/project/ui/ProjectListContent.test.tsx`에 추가한다.

```tsx
  it('프로젝트 제목을 누르면 상세 이동 콜백을 호출한다', async () => {
    const onProjectOpen = vi.fn()
    renderContent({ onProjectOpen })

    await userEvent.click(
      screen.getByRole('button', { name: '2026 브랜드 리뉴얼 열기' }),
    )

    expect(onProjectOpen).toHaveBeenCalledWith('project-1')
  })
```

기존 테스트의 fixture 이름·id에 맞춰 문자열을 조정한다.

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm test -- src/features/project/ui/ProjectListContent.test.tsx`
Expected: FAIL — 해당 이름의 버튼을 찾지 못한다

- [ ] **Step 3: 카드와 테이블에 열기 동작 추가**

카드 전체를 클릭 대상으로 만들면 안쪽 메뉴 버튼과 클릭이 겹친다. 제목을 버튼으로 감싼다.

`ProjectCard.tsx` — `onOpen?: (project: Project) => void`를 props에 추가하고, `<h2>` 안의 텍스트를 아래로 바꾼다.

```tsx
<h2 className="text-card-title text-foreground-strong truncate">
  {onOpen ? (
    <button
      type="button"
      aria-label={`${project.name} 열기`}
      onClick={() => onOpen(project)}
      className="focus-visible:ring-action-focus-ring block w-full truncate rounded-sm text-left outline-none hover:underline focus-visible:ring-3"
    >
      {project.name}
    </button>
  ) : (
    project.name
  )}
</h2>
```

`ProjectTable.tsx` — 같은 방식으로 이름 셀의 `<span>`을 조건부 버튼으로 바꾸고 `onOpen`을 props에 추가한다.

- [ ] **Step 4: 컨테이너와 페이지에 콜백 연결**

- `ProjectListContent`에 `onProjectOpen?: (projectId: string) => void`를 추가하고, `ProjectCard`·`ProjectTable`에 `onOpen={onProjectOpen ? (project) => onProjectOpen(project.id) : undefined}`를 넘긴다
- `HomePage`에 `onProjectOpen?: (projectId: string) => void`를 추가해 `ProjectListContent`로 전달한다
- `routes/workspaces/$workspaceId/projects.tsx`의 `<HomePage …>`에 아래를 추가한다

```tsx
onProjectOpen={(projectId) =>
  void navigate({
    to: PROJECT_DETAIL_ROUTE,
    params: { workspaceId, projectId },
  })
}
```

`PROJECT_DETAIL_ROUTE`는 `./projects_.$projectId`에서 import한다. Task 14의 라우트 파일이 `./projects`에서 `PROJECTS_ROUTE`를 import하므로 두 파일이 서로를 참조하게 된다. 순환 import를 피하기 위해 `PROJECT_DETAIL_ROUTE` 문자열을 `projects.tsx`에 직접 쓰지 말고, 두 경로 상수를 `src/routes/workspaces/$workspaceId/route-paths.ts`로 옮겨 양쪽이 그 파일에서 가져오게 한다.

```ts
// src/routes/workspaces/$workspaceId/route-paths.ts
export const PROJECTS_ROUTE = '/workspaces/$workspaceId/projects' as const
export const PROJECT_DETAIL_ROUTE =
  '/workspaces/$workspaceId/projects/$projectId' as const
```

`projects.tsx`와 `projects_.$projectId.tsx`는 이 파일에서 import한 뒤 그대로 re-export해, `account.tsx`와 기존 테스트의 `import { PROJECTS_ROUTE } from './workspaces/$workspaceId/projects'`가 계속 동작하게 한다.

- [ ] **Step 5: 테스트 통과 확인**

Run: `pnpm test -- src/features/project src/pages/home src/routes`
Expected: PASS

---

## Task 16: 전체 검증

**Files:** 없음

- [ ] **Step 1: 전체 테스트**

Run: `pnpm test`
Expected: 모든 테스트 PASS

- [ ] **Step 2: 린트**

Run: `pnpm lint`
Expected: 오류 없음

- [ ] **Step 3: 빌드**

Run: `pnpm build`
Expected: 성공

- [ ] **Step 4: 포맷 검사**

Run: `pnpm format:check`
Expected: 통과. 실패하면 `pnpm format` 후 다시 실행한다

- [ ] **Step 5: 브라우저 확인**

`pnpm dev`로 띄운 뒤 내장 브라우저로 다음을 확인한다.

- 워크스페이스 홈에서 프로젝트 제목을 눌러 상세로 이동
- Page Header 4단이 Figma `173:1854`와 같은 순서·간격으로 보이는지
- 카드 ↔ 테이블 전환, 검색, 페이지네이션
- 문서 생성·이름 변경·삭제와 각 Toast
- 뒤로가기와 Breadcrumb "프로젝트" 링크

- [ ] **Step 6: 계획 문서에 결과 기록**

이 문서의 `## 구현 결과` 절에 실제 변경, 계획과 달라진 점, 실행한 검증 명령과 결과, 남은 후속 작업을 적는다.

---

## Task 17: Figma 반영

**Files:** 없음 (Figma 파일 `Dimhltnal74SHy2NcLz1Lf`, `v1.0` 페이지)

공유 디자인 파일을 수정하므로 이 Task는 **사용자 확인 후에만** 실행한다.

- [x] **Step 1: 변경안 제시와 승인 요청**

대상 프레임과 변경 내용을 사용자에게 보여주고 진행 여부를 확인한다.

| 프레임 | 변경 |
| --- | --- |
| `173:1854`, `175:1904`, `176:1990`, `176:2183`, `178:2230`, `178:3068` | `title-row` 우측에 프로젝트 컨텍스트 메뉴(`⋮`) 추가 |
| 〃 | Search placeholder를 "화이트보드 이름으로 검색"으로 수정 |
| 〃 | Breadcrumb을 "프로젝트 → {프로젝트명}" 두 항목으로 수정 |

- [x] **Step 2: `figma-use` 스킬 로드**

`use_figma` 호출 전에 `/figma-use` 스킬을 반드시 먼저 읽는다.

- [x] **Step 3: 변경 적용**

`use_figma`로 위 세 가지를 적용한다. 기존 컴포넌트 인스턴스(Breadcrumb, Search, Button)를 재사용하고 새 스타일을 만들지 않는다.

- [x] **Step 4: 결과 확인**

`get_screenshot`으로 `173:1854`를 다시 받아 세 변경이 반영됐는지 눈으로 확인하고 사용자에게 보고한다.

---

## 구현 결과

작성일: 2026-09-15

### 실제 변경 내용

**공통 (shared)**

- `src/shared/types/pagination.ts` — `Pagination` 타입 신설
- `src/shared/lib/resource-date.ts` (+ 테스트) — `features/project/lib/project-date.ts`를 이동·일반화한 `formatCreatedAt` / `formatUpdatedAt`
- `src/shared/ui/view-toggle.tsx` (+ 테스트) — 카드/목록 전환 토글 추출, `ListView` 타입 export
- `src/shared/ui/list-pagination.tsx` (+ 테스트) — 페이지네이션 블록 추출
- `src/shared/ui/whiteboard-card.tsx` (+ 테스트·스토리) — 그리드 배치와 `⋮` 메뉴 슬롯에 맞게 수정
- `src/shared/constants/messages.ts` — 화이트보드 이름 검증 메시지 추가

**화이트보드 문서 (entities / features)**

- `src/entities/whiteboard-document/` — API 클라이언트(목록·생성·이름 변경·삭제)와 타입, 배럴
- `src/features/whiteboard-document/model/use-whiteboard-documents.ts` — TanStack Query 훅 4종
- `src/features/whiteboard-document/ui/WhiteboardDocumentFormDialog.tsx` — 이름 전용 생성·이름 변경 Dialog
- `src/features/whiteboard-document/ui/WhiteboardDocumentDeleteDialog.tsx` — 삭제 확인 Dialog
- `src/features/whiteboard-document/ui/WhiteboardDocumentMenu.tsx` — 문서 `⋮` 메뉴
- `src/features/whiteboard-document/ui/WhiteboardDocumentTable.tsx` — 목록(Table) 뷰
- `src/features/whiteboard-document/ui/WhiteboardDocumentListContent.tsx` — 검색·뷰 전환·페이지네이션·CRUD·Toast를 담당하는 컨테이너

**프로젝트 상세**

- `src/entities/project/api/project.ts` — `getProjectRequest` 추가
- `src/features/project/model/use-projects.ts` — `useProject`, `projectErrorCode`, `isProjectNotFound` 추가
- `src/features/project/ui/ProjectDetailHeader.tsx` — Breadcrumb / 제목·뒤로가기·`⋮` / 설명 / 생성자 4단 Page Header
- `src/pages/project-detail/ui/ProjectDetailPage.tsx` — 레이아웃, 로딩 스켈레톤, 404·오류 상태, 프로젝트 수정·삭제 Dialog 연결

**라우팅과 진입점**

- `src/routes/workspaces/$workspaceId/-route-paths.ts` — `PROJECTS_ROUTE`, `PROJECT_DETAIL_ROUTE` 상수
- `src/routes/workspaces/$workspaceId/projects_.$projectId.tsx` — 상세 라우트
- `src/routes/workspaces/$workspaceId/projects.tsx` — 경로 상수를 `-route-paths`에서 재export하고 `onProjectOpen` 연결
- `src/features/project/ui/ProjectCard.tsx`, `ProjectTable.tsx`, `ProjectListContent.tsx`, `src/pages/home/ui/HomePage.tsx` — 프로젝트 제목을 버튼으로 바꾸고 `onProjectOpen` 전달

### 계획과 달라진 점

1. **Search의 role** — 계획의 테스트 코드는 `getByRole('textbox', { name: '화이트보드 검색' })`였지만 `shared/ui/search.tsx`는 `role="searchbox"`를 렌더링한다. 모든 쿼리를 `searchbox`로 고쳤다.
2. **테스트 헬퍼 타입** — 계획의 `{...(props as never)}` 패턴은 `tsc -b`에서 `TS2698`로 실패했다. `Partial<React.ComponentProps<typeof X>>`로 타입을 주고 그대로 spread하도록 바꿨다.
3. **`-route-paths.ts` 위치와 이름** — 계획은 Task 15에서 만들도록 했지만, Task 14에서 `projects.tsx` ↔ `projects_.$projectId.tsx` 순환 import를 피하려고 앞당겨 만들었다. 또 `route-paths.ts`는 TanStack Router가 "Route를 export하지 않는 라우트 파일"로 경고해서 무시 접두사를 붙인 `-route-paths.ts`로 이름을 바꿨다.
4. **`use-projects.test.tsx` 헬퍼** — 계획의 `createWrapper()` 대신 파일에 이미 있던 `createTestQueryClient()` / `createQueryClientWrapper()`를 재사용했다.
5. **프로젝트 제목 버튼의 `aria-label` 제거** — 계획대로 `aria-label={`${project.name} 열기`}`를 붙였더니 버튼을 감싼 `<h2>`의 접근성 이름까지 "… 열기"로 오염됐다(내장 브라우저 접근성 스냅샷으로 확인). `aria-label`을 없애고 버튼 텍스트(프로젝트 이름)를 그대로 쓰도록 바꿨고, 관련 테스트 쿼리도 이름만 쓰도록 수정했다.
6. **`whiteboard-document.test.ts`의 lint 오류** — `const { creator: _creator, ...created }` 구조 분해가 `@typescript-eslint/no-unused-vars`에 걸려서, `Omit<WhiteboardDocument, 'creator'>` 객체를 명시적으로 만들도록 바꿨다.

### 실행한 검증 명령과 결과

`frontend/`에서 실행했다.

| 명령 | 결과 |
| --- | --- |
| `pnpm test` | PASS — Test Files 61 passed (61), Tests 326 passed (326) |
| `pnpm lint` | PASS — 0 errors (`shared/ui`의 기존 react-refresh warning 4건만 남음, 이번 작업과 무관) |
| `pnpm build` | PASS |
| `pnpm format:check` | PASS |

브라우저 확인은 이 worktree 전용으로 backend `:4001`, frontend `:5174`를 띄우고 내장 브라우저로 진행했다.

프로젝트 상세 진입과 헤더:

- 워크스페이스 홈에서 프로젝트 제목(카드) 클릭 → `/workspaces/{id}/projects/{projectId}`로 이동
- Page Header 4단(Breadcrumb / 뒤로가기·제목·`⋮` / 설명 / 생성자) 렌더링과 순서
- 프로젝트 `⋮` → "수정" → 프로젝트 수정 Dialog 정상 오픈(이름 prefill, 설명, 취소·저장)
- 뒤로가기 버튼과 Breadcrumb "프로젝트" 링크 → 프로젝트 목록으로 복귀

화이트보드 문서 목록:

- 빈 상태 "아직 화이트보드가 없어요" + "새 화이트보드 만들기"
- 생성 → Toast "화이트보드를 만들었어요" (문서 4건 생성)
- 그리드 뷰 카드(이름, `⋮`, 생성일 `2026.09.15`, 수정일 상대시간, 생성자 아바타)
- 테이블 뷰 컬럼(이름 / 생성자 / 생성일 / 수정일 / 작업)과 뷰 전환
- 검색 "설계" → 해당 문서만 노출, "없는이름zz" → "검색 결과가 없어요" + "검색 결과 초기화"
- 문서 `⋮` → "이름 변경" → Dialog 저장 → 목록 반영 + Toast "화이트보드 이름을 변경했어요"
- 문서 `⋮` → "삭제" → 확인 Dialog "화이트보드 삭제" → 삭제 + Toast "화이트보드를 삭제했어요"

페이지네이션(문서 13건, `DOCUMENTS_PER_PAGE = 12`):

- 카드 뷰 1페이지 12건 + `이전 페이지` 비활성 / `1` / `2` / `다음 페이지` 활성
- `2` 클릭 → 2페이지 1건, `다음 페이지` 비활성 / `이전 페이지` 활성
- `다음 페이지` → 2페이지, `이전 페이지` → 1페이지
- 테이블 뷰에서도 동일하게 1↔2페이지 이동
- 2페이지에서 검색어 "스케치" 입력 → 1페이지로 초기화되고 결과 2건만 노출(`totalPages = 1`이라 페이지네이션 숨김)

처음에는 `다음 페이지` 클릭이 반응하지 않는 것처럼 보였다. 브라우저에서 확인해 보니 버튼이 뷰포트 아래(`y=1837`, `innerHeight=1779`)에 있어서 내장 브라우저의 클릭이 닿지 않은 것이었고, `scrollintoview` 후에는 정상 동작했다. 앱 결함이 아니라 자동화 도구 쪽 문제다.

### 로컬 dev DB 정리

브라우저 확인 중 목록 API가 500(`column whiteboard_documents.deleted_at does not exist`)을 반환했다. 로컬 dev DB가 마이그레이션 `0003` 상태였고 `pnpm db:migrate`도 권한 오류로 실패해서 다음을 정리했다. 프론트엔드 변경과 무관한 로컬 환경 문제다.

1. 작업 전 `pg_dump`로 백업했다(`whiteboard_documents`는 0행이라 유실 데이터 없음).
2. `drizzle` 스키마·`drizzle.__drizzle_migrations` 테이블·시퀀스 소유자를 애플리케이션 롤로 변경했다.
3. 애플리케이션 롤에 `GRANT CREATE ON DATABASE`, `GRANT USAGE, CREATE ON SCHEMA public`을 부여하고 `public`의 기존 테이블·타입 소유자를 애플리케이션 롤로 변경했다.
4. 마이그레이션 `0004`·`0005`가 적용되어 `deleted_at` 추가, `canvas_content` 제거, `whiteboard_document_contents` 생성이 완료됐고 이후 `pnpm db:migrate`는 정상 동작한다.

`drizzle-kit migrate`가 오류를 삼켜서 원인 파악에는 `drizzle-orm/postgres-js/migrator`를 직접 호출하는 임시 스크립트를 썼고, 확인 후 삭제했다.

### Figma 반영 (Task 17)

파일 `Dimhltnal74SHy2NcLz1Lf`의 `v1.0` 페이지, Project Detail 6개 프레임(카드 / 테이블 / 빈 상태 / 검색 결과 없음 / 카드 메뉴 / 화이트보드 생성 Modal)에 세 가지를 적용했다.

1. `title-row`를 `left`(back-button + project-name) + `menu-trigger` 2단으로 바꾸고 `SPACE_BETWEEN` 정렬로 변경. `menu-trigger`는 `back-button`과 동일한 28×28·radius 8 사양에 기존 `Icon/more-vertical` 컴포넌트(`69:135`) 인스턴스를 넣었다.
2. Breadcrumb을 "프로젝트 → {프로젝트명}" 2항목으로 변경. 기존 인스턴스가 1개 segment만 노출하는 상태여서 `Breadcrumb` 컴포넌트(`56:53`) 인스턴스를 새로 만들어 교체했다.
3. Search placeholder를 "화이트보드 이름으로 검색"으로 변경. 검색 결과 없음 프레임은 입력값("존재하지 않는 문서")이라 그대로 뒀고, 빈 상태 프레임은 toolbar가 숨김 상태라 잠시 표시해 수정한 뒤 다시 숨겼다.

새 컴포넌트·스타일·변수는 만들지 않았고 기존 인스턴스와 토큰만 재사용했다. 카드 / 테이블 / 빈 상태 프레임 스크린샷으로 결과를 확인했다.

### 카피 일관성 정리

Figma와 구현의 빈 상태 카피가 달라서, 프로젝트 목록 페이지(`ProjectListContent` / `ProjectCard` / `ProjectDeleteDialog`)의 기존 코드 관례를 기준으로 삼고 양쪽을 맞췄다.

구현 수정(코드가 관례에서 벗어난 2곳):

1. `WhiteboardDocumentMenu.tsx` — 메뉴 항목 "화이트보드 문서 삭제" → "삭제". `ProjectCard`의 메뉴가 "수정 / 삭제"인 것과 맞췄다.
2. `WhiteboardDocumentDeleteDialog.tsx` — Dialog 제목 "화이트보드 문서 삭제" → "화이트보드 삭제". `ProjectDeleteDialog`의 "프로젝트 삭제"와 맞췄다.

관련 테스트 2건(`WhiteboardDocumentListContent.test.tsx`, `WhiteboardDocumentTable.test.tsx`)의 쿼리도 함께 고쳤다. 나머지 카피(검색 placeholder, 로딩·오류·빈 상태·검색 결과 없음 문구, 생성·이름 변경 Dialog)는 이미 프로젝트 목록 페이지와 같은 형태였다.

Figma 수정(구현에 맞춤, Project Detail 프레임):

1. `176:2010` "아직 화이트보드 문서가 없어요" → "아직 화이트보드가 없어요" (레이어명도 같이 변경)
2. `I176:2012;30:9` 버튼 "화이트보드 생성" → "새 화이트보드 만들기"
3. `I178:2627;46:10` 메뉴 항목 "화이트보드 문서 삭제" → "삭제"

### 남은 후속 작업

1. Workspace Home의 프로젝트 카드 메뉴가 Figma는 "이름 변경 / 설명 변경 / 프로젝트 삭제", 구현은 "수정 / 삭제"로 다르다. 이번 작업 범위 밖의 기존 차이라 손대지 않았다.
2. 화이트보드 문서 클릭 시 동작(캔버스 에디터 진입)은 이번 범위에서 제외했다.
3. 검증용으로 만든 로컬 dev 데이터(화이트보드 문서 13건)는 그대로 남아 있다.
