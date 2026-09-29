# 화이트보드 PDF 내보내기 — 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` 또는
> `superpowers:executing-plans`로 task 단위 구현한다. 단계는 체크박스(`- [ ]`)로 추적한다.

**Goal:** 편집 중인 화이트보드를 그림 크기 그대로의 PDF 한 장으로 내려받는다.

**Architecture:** 내보내기 로직을 `WhiteboardCanvas.tsx`에서 꺼내
`features/whiteboard-editor/model/export-scene.ts`로 옮긴다. 이 모듈은 Excalidraw
인스턴스가 아니라 평범한 `CanvasContent` 객체를 받아 파일을 만들고, 컴포넌트는 호출과
토스트만 맡는다. PDF는 `exportToCanvas` → PNG → jsPDF `addImage` 순으로 만든다.

**Tech Stack:** React 19, TypeScript, Vitest + Testing Library, `@excalidraw/excalidraw` 0.18, `jspdf`

**Spec:** [2026-09-29-whiteboard-pdf-export-design.md](../specs/2026-09-29-whiteboard-pdf-export-design.md)

## Global Constraints

- 사용자에게 보이는 문구는 모두 `MESSAGES`를 거친다. 컴포넌트에 문자열 리터럴을 두지 않는다.
- FSD 계층 방향은 `app → pages → features → entities → shared`. `features/whiteboard-editor`는
  `shared`와 `entities`만 참조한다.
- 코드 주석·문서·커밋 메시지는 한국어로 쓴다.
- `jspdf`는 `await import('jspdf')`로만 불러온다. 정적 import를 쓰지 않는다.
- PDF 배경은 화면 테마와 무관하게 항상 흰색이다.
- 커밋은 Conventional Commits(`feat:`, `refactor:`, `test:`) 형식을 따른다.

## Review Focus

spec이 요구하지만 각 task의 기본 테스트만으로는 놓치기 쉬운 입력들. 아래 다섯 줄은 해당
task의 단계로 이미 포함돼 있다.

1. 문서 이름이 `보드/2026: 1분기?` 처럼 경로·예약 문자를 포함할 때 — 다운로드가
   디렉터리 경로로 해석되지 않고 `보드_2026_ 1분기_.pdf`가 되어야 한다. (Task 2, Step 1)
2. 장면에 삭제된 요소만 남았을 때 — `getSceneElements()`가 빈 배열을 주므로 PDF를 만들지
   않고 "내보낼 내용이 없어요"가 떠야 한다. (Task 2, Step 1 / Task 4, Step 1)
3. `scene.files`가 `undefined`일 때(이미지가 한 장도 없는 보드) — `exportToCanvas`는
   `files` 인자에 `null`을 요구한다. `undefined`를 그대로 넘기면 런타임에서 터진다. (Task 2, Step 1)
4. `exportToCanvas`나 jsPDF가 던졌을 때 — 예외가 전파되어 호출부가 잡고 토스트를 띄워야
   한다. 조용히 삼키면 사용자는 눌렀는데 아무 일도 없는 상태에 놓인다. (Task 4, Step 1)
5. 사용자가 PDF 메뉴를 연달아 두 번 누를 때 — 첫 생성이 끝나기 전에는 항목이 비활성화돼
   두 번째 실행이 일어나지 않아야 한다. (Task 4, Step 1)
6. 동기화가 끊겼거나 읽기 전용일 때 — PDF 메뉴가 사라지거나 막히면 안 된다. 손에 쥔
   변경을 꺼내야 하는 바로 그 상황이다. (Task 4, Step 1)

---

## File Structure

| 파일 | 상태 | 책임 |
| --- | --- | --- |
| `frontend/package.json` | 수정 | `jspdf` 의존성 |
| `frontend/src/shared/constants/messages/whiteboard.ts` | 수정 | 문구 3개 추가 |
| `frontend/src/features/whiteboard-editor/model/export-scene.ts` | 생성 | 장면 → 파일 변환·다운로드 |
| `frontend/src/features/whiteboard-editor/model/export-scene.test.ts` | 생성 | 위 모듈 단위 테스트 |
| `frontend/src/features/whiteboard-editor/ui/WhiteboardCanvas.tsx` | 수정 | 인라인 `exportScene` 제거, 메뉴 항목·토스트 |
| `frontend/src/features/whiteboard-editor/ui/WhiteboardCanvas.export.test.tsx` | 생성 | 메뉴 동작 테스트 |

`WhiteboardCanvas.test.tsx`는 이미 230줄이고 동기화 시나리오로 가득하다. 내보내기
테스트는 별도 파일 `WhiteboardCanvas.export.test.tsx`에 둔다. Excalidraw 목이
`exportToCanvas`를 포함해야 하는데, 기존 파일의 목을 건드리면 동기화 테스트가 흔들린다.

---

## Task 1: jsPDF 의존성과 문구 추가

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/src/shared/constants/messages/whiteboard.ts`

**Interfaces:**
- Produces: `MESSAGES.whiteboard.action.exportPdf`, `MESSAGES.whiteboard.error.exportEmpty`,
  `MESSAGES.whiteboard.error.exportPdfFailed` — Task 2·4가 쓴다.

- [ ] **Step 1: jspdf 설치**

```bash
cd frontend && pnpm add jspdf
```

- [ ] **Step 2: 문구 추가**

`src/shared/constants/messages/whiteboard.ts`의 `error` 묶음에 두 줄을 더한다.

```ts
  error: {
    loadFailed: '화이트보드를 불러오지 못했어요',
    createFailed: '화이트보드를 만들지 못했어요',
    renameFailed: '화이트보드 이름을 변경하지 못했어요',
    deleteFailed: '화이트보드를 삭제하지 못했어요',
    notFound: '화이트보드를 찾을 수 없어요',
    notFoundDescription: '삭제되었거나 접근할 수 없는 화이트보드예요',
    exportEmpty: '내보낼 내용이 없어요',
    exportPdfFailed: 'PDF를 만들지 못했어요',
  },
```

`action` 묶음의 `exportFile` 바로 아래에 한 줄을 더한다.

```ts
    exportFile: '파일로 내보내기',
    exportPdf: 'PDF로 내려받기',
```

- [ ] **Step 3: 문구 사전 테스트가 통과하는지 확인**

Run: `cd frontend && pnpm test -- src/shared/constants/messages src/architecture.test.ts`
Expected: PASS

- [ ] **Step 4: 커밋**

```bash
git add frontend/package.json frontend/pnpm-lock.yaml frontend/src/shared/constants/messages/whiteboard.ts
git commit -m "$(cat <<'EOF'
build: PDF 내보내기용 jspdf 의존성과 문구 추가

- jspdf를 frontend dependencies에 추가
- 화이트보드 내보내기 문구 3개(exportPdf·exportEmpty·exportPdfFailed) 추가

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `export-scene` 모듈

`WhiteboardCanvas.tsx:145`의 인라인 `exportScene()`을 모듈로 옮기고, 같은 파일에 PDF
경로를 더한다. 이동과 신규를 한 task로 묶는 이유: 두 함수가 파일명 sanitize와 다운로드
트리거를 공유하므로, 나눠서 커밋하면 중간 상태에 중복 코드가 남는다.

**Files:**
- Create: `frontend/src/features/whiteboard-editor/model/export-scene.ts`
- Test: `frontend/src/features/whiteboard-editor/model/export-scene.test.ts`

**Interfaces:**
- Consumes: `CanvasContent` (`../model/protocol`), `exportToCanvas` (`@excalidraw/excalidraw`), `jsPDF` (`jspdf`)
- Produces:
  ```ts
  export function downloadSceneFile(scene: CanvasContent, name: string): void
  export type ScenePdfResult = 'downloaded' | 'empty'
  export function downloadScenePdf(scene: CanvasContent, name: string): Promise<ScenePdfResult>
  ```

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/src/features/whiteboard-editor/model/export-scene.test.ts`

```ts
import { beforeEach, expect, it, vi } from 'vitest'
import type { CanvasContent } from './protocol'
import { downloadSceneFile, downloadScenePdf } from './export-scene'

const excalidraw = vi.hoisted(() => ({ exportToCanvas: vi.fn() }))
const pdf = vi.hoisted(() => ({
  addImage: vi.fn(),
  save: vi.fn(),
  options: undefined as unknown,
}))
vi.mock('@excalidraw/excalidraw', () => ({
  exportToCanvas: excalidraw.exportToCanvas,
}))
vi.mock('jspdf', () => ({
  jsPDF: class {
    addImage = pdf.addImage
    save = pdf.save
    constructor(options: unknown) {
      pdf.options = options
    }
  },
}))

/** 지정한 크기를 보고하고 고정 dataURL을 돌려주는 캔버스 대역. */
function fakeCanvas(width: number, height: number) {
  return { width, height, toDataURL: () => 'data:image/png;base64,PNG' }
}
function element(id: string, isDeleted = false) {
  return { id, version: 1, versionNonce: 1, isDeleted }
}

let clicked: { href: string; download: string }[] = []
beforeEach(() => {
  vi.clearAllMocks()
  clicked = []
  excalidraw.exportToCanvas.mockResolvedValue(fakeCanvas(800, 600))
  vi.stubGlobal('URL', {
    createObjectURL: () => 'blob:scene',
    revokeObjectURL: vi.fn(),
  })
  vi.spyOn(window.document, 'createElement').mockImplementation(((
    tag: string,
  ) => {
    const link = { href: '', download: '', click: () => {} }
    link.click = () => clicked.push({ href: link.href, download: link.download })
    return link as unknown as HTMLElement
  }) as typeof window.document.createElement)
})

it('요소가 없으면 PDF를 만들지 않는다', async () => {
  const scene: CanvasContent = { elements: [] }
  await expect(downloadScenePdf(scene, '문서')).resolves.toBe('empty')
  expect(excalidraw.exportToCanvas).not.toHaveBeenCalled()
  expect(pdf.save).not.toHaveBeenCalled()
})

it('삭제된 요소만 남은 장면도 빈 장면으로 본다', async () => {
  const scene: CanvasContent = { elements: [element('gone', true)] }
  await expect(downloadScenePdf(scene, '문서')).resolves.toBe('empty')
  expect(excalidraw.exportToCanvas).not.toHaveBeenCalled()
})

it('이미지가 없는 장면에서도 files에 null을 넘긴다', async () => {
  await downloadScenePdf({ elements: [element('a')] }, '문서')
  expect(excalidraw.exportToCanvas).toHaveBeenCalledWith(
    expect.objectContaining({ files: null }),
  )
})

it('인쇄용 흰 배경을 고정해 내보낸다', async () => {
  await downloadScenePdf({ elements: [element('a')] }, '문서')
  expect(excalidraw.exportToCanvas).toHaveBeenCalledWith(
    expect.objectContaining({
      appState: {
        exportBackground: true,
        viewBackgroundColor: '#ffffff',
        exportWithDarkMode: false,
      },
      exportPadding: 16,
      maxWidthOrHeight: 4096,
    }),
  )
})

it('가로로 넓은 캔버스는 landscape, 세로로 긴 캔버스는 portrait로 만든다', async () => {
  await downloadScenePdf({ elements: [element('a')] }, '문서')
  expect(pdf.options).toEqual({
    orientation: 'landscape',
    unit: 'px',
    format: [800, 600],
  })

  excalidraw.exportToCanvas.mockResolvedValue(fakeCanvas(600, 900))
  await downloadScenePdf({ elements: [element('a')] }, '문서')
  expect(pdf.options).toEqual({
    orientation: 'portrait',
    unit: 'px',
    format: [600, 900],
  })
})

it('캔버스 크기를 채우도록 이미지를 배치한다', async () => {
  await downloadScenePdf({ elements: [element('a')] }, '문서')
  expect(pdf.addImage).toHaveBeenCalledWith(
    'data:image/png;base64,PNG',
    'PNG',
    0,
    0,
    800,
    600,
  )
})

it('경로 문자를 밑줄로 바꾼 pdf 파일명으로 저장한다', async () => {
  await downloadScenePdf({ elements: [element('a')] }, '보드/2026: 1분기?')
  expect(pdf.save).toHaveBeenCalledWith('보드_2026_ 1분기_.pdf')
})

it('렌더에 실패하면 예외를 그대로 올린다', async () => {
  excalidraw.exportToCanvas.mockRejectedValue(new Error('canvas too large'))
  await expect(
    downloadScenePdf({ elements: [element('a')] }, '문서'),
  ).rejects.toThrow('canvas too large')
})

it('excalidraw 파일을 같은 이름 규칙으로 내려받는다', () => {
  downloadSceneFile({ elements: [element('a')] }, '보드/2026: 1분기?')
  expect(clicked).toEqual([
    { href: 'blob:scene', download: '보드_2026_ 1분기_.excalidraw' },
  ])
})
```

- [ ] **Step 2: 실패 확인**

Run: `cd frontend && pnpm test -- src/features/whiteboard-editor/model/export-scene.test.ts`
Expected: FAIL — `Failed to resolve import "./export-scene"`

- [ ] **Step 3: 모듈 구현**

`frontend/src/features/whiteboard-editor/model/export-scene.ts`

```ts
import { exportToCanvas } from '@excalidraw/excalidraw'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import type { BinaryFiles } from '@excalidraw/excalidraw/types'
import type { CanvasContent } from './protocol'

/** 그림이 종이 가장자리에 붙지 않게 하는 최소 여백(px). */
const PDF_PADDING = 16
/** 캔버스 한계와 파일 크기를 막는 긴 변 상한(px). */
const PDF_MAX_SIZE = 4096

/** 파일 이름에 쓸 수 없는 문자를 밑줄로 바꾼다. */
function toFileName(name: string, extension: string) {
  return `${name.replace(/[\\/:*?"<>|]/g, '_')}.${extension}`
}

function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = window.document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadSceneFile(scene: CanvasContent, name: string) {
  download(
    new Blob(
      [
        JSON.stringify({
          type: 'excalidraw',
          version: 2,
          source: 'in2white',
          ...scene,
        }),
      ],
      { type: 'application/json' },
    ),
    toFileName(name, 'excalidraw'),
  )
}

export type ScenePdfResult = 'downloaded' | 'empty'

/**
 * 장면을 그림 크기 그대로의 PDF 한 장으로 내려받는다.
 * 화면 테마와 무관하게 흰 배경으로 고정해 인쇄·공유에 쓸 수 있게 한다.
 */
export async function downloadScenePdf(
  scene: CanvasContent,
  name: string,
): Promise<ScenePdfResult> {
  const elements = scene.elements.filter((element) => !element.isDeleted)
  if (elements.length === 0) return 'empty'
  const canvas = await exportToCanvas({
    elements: elements as unknown as ExcalidrawElement[],
    files: (scene.files as unknown as BinaryFiles) ?? null,
    appState: {
      exportBackground: true,
      viewBackgroundColor: '#ffffff',
      exportWithDarkMode: false,
    },
    exportPadding: PDF_PADDING,
    maxWidthOrHeight: PDF_MAX_SIZE,
  })
  // jsPDF는 이 메뉴를 누른 뒤에만 필요하므로 초기 번들에서 떼어낸다.
  const { jsPDF } = await import('jspdf')
  const { width, height } = canvas
  const document = new jsPDF({
    orientation: width >= height ? 'landscape' : 'portrait',
    unit: 'px',
    format: [width, height],
  })
  document.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, width, height)
  document.save(toFileName(name, 'pdf'))
  return 'downloaded'
}
```

`exportToCanvas`는 정적 import로 둔다. `WhiteboardCanvas`가 이미 `lazy()`로 분리돼
있어 Excalidraw 전체가 같은 청크에 들어가므로, 여기서 나눠도 얻는 게 없다.

- [ ] **Step 4: 통과 확인**

Run: `cd frontend && pnpm test -- src/features/whiteboard-editor/model/export-scene.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: 커밋**

```bash
git add frontend/src/features/whiteboard-editor/model/export-scene.ts frontend/src/features/whiteboard-editor/model/export-scene.test.ts
git commit -m "$(cat <<'EOF'
feat: 화이트보드 장면 PDF 내보내기 모듈 추가

- export-scene 모듈에 downloadSceneFile·downloadScenePdf 구현
- PDF는 그림 크기 1페이지, 흰 배경 고정, 긴 변 4096px 상한
- 빈 장면·경로 문자 이름·렌더 실패 테스트 추가

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `WhiteboardCanvas`의 인라인 내보내기를 모듈로 교체

동작을 바꾸지 않는 이동만 한다. PDF 메뉴는 Task 4에서 붙인다. 이동과 신규 동작을 나눠야
기존 `.excalidraw` 내보내기가 깨졌는지 커밋 단위로 가려낼 수 있다.

**Files:**
- Modify: `frontend/src/features/whiteboard-editor/ui/WhiteboardCanvas.tsx`

**Interfaces:**
- Consumes: `downloadSceneFile` (Task 2)

- [ ] **Step 1: import 추가**

`WhiteboardCanvas.tsx`의 import 묶음에 한 줄을 더한다.

```ts
import { downloadSceneFile } from '../model/export-scene'
```

- [ ] **Step 2: 인라인 `exportScene` 교체**

기존 함수 전체(`function exportScene() { ... }`, `WhiteboardCanvas.tsx:145-171`)를
아래로 바꾼다.

```ts
  /** 편집기가 들고 있는 최신 장면. API가 아직 없으면 동기화 장면을 쓴다. */
  function currentScene(): CanvasContent {
    if (!api) return editor.scene
    return {
      elements: api
        .getSceneElementsIncludingDeleted()
        .map((element) => ({ ...element })) as WhiteboardElement[],
      files: api.getFiles() as CanvasContent['files'],
    }
  }
```

드롭다운 항목의 `onSelect`를 바꾼다.

```tsx
                <DropdownMenuItem
                  onSelect={() =>
                    downloadSceneFile(currentScene(), document.name)
                  }
                >
                  {MESSAGES.whiteboard.action.exportFile}
                </DropdownMenuItem>
```

- [ ] **Step 3: 기존 테스트가 그대로 통과하는지 확인**

Run: `cd frontend && pnpm test -- src/features/whiteboard-editor`
Expected: PASS — 동기화 테스트가 모두 통과한다. 실패하면 이동 과정에서 장면을 읽는
방식이 바뀐 것이므로 되돌려 원인을 찾는다.

- [ ] **Step 4: 커밋**

```bash
git add frontend/src/features/whiteboard-editor/ui/WhiteboardCanvas.tsx
git commit -m "$(cat <<'EOF'
refactor: 화이트보드 내보내기 로직을 export-scene 모듈로 이동

- WhiteboardCanvas의 인라인 exportScene을 downloadSceneFile 호출로 교체
- 컴포넌트는 장면 수집과 호출만 맡는다

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: PDF 메뉴 항목과 토스트

**Files:**
- Modify: `frontend/src/features/whiteboard-editor/ui/WhiteboardCanvas.tsx`
- Create: `frontend/src/features/whiteboard-editor/ui/WhiteboardCanvas.export.test.tsx`

**Interfaces:**
- Consumes: `downloadScenePdf`, `ScenePdfResult` (Task 2), `MESSAGES.whiteboard.*` (Task 1)

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/src/features/whiteboard-editor/ui/WhiteboardCanvas.export.test.tsx`

```tsx
import { useEffect } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useWhiteboardEditor } from '../model/use-whiteboard-editor'
import { downloadScenePdf } from '../model/export-scene'
import WhiteboardCanvas from './WhiteboardCanvas'

const canvas = vi.hoisted(() => ({
  updateScene: vi.fn(),
  addFiles: vi.fn(),
  getSceneElementsIncludingDeleted: vi.fn(() => []),
  getAppState: () => ({}),
  getFiles: () => ({}),
}))
vi.mock('@excalidraw/excalidraw', () => ({
  CaptureUpdateAction: { NEVER: 'never' },
  restoreElements: (elements: unknown) => elements,
  reconcileElements: (_local: unknown, remote: unknown) => remote,
  MainMenu: Object.assign(() => null, {
    DefaultItems: {
      LoadScene: () => null,
      SaveToActiveFile: () => null,
      Export: () => null,
      SaveAsImage: () => null,
      SearchMenu: () => null,
      Help: () => null,
      ClearCanvas: () => null,
      ToggleTheme: () => null,
      ChangeCanvasBackground: () => null,
    },
    Separator: () => null,
  }),
  Excalidraw: ({
    excalidrawAPI,
  }: {
    excalidrawAPI: (value: unknown) => void
  }) => {
    useEffect(() => excalidrawAPI(canvas), [excalidrawAPI])
    return <div aria-label="캔버스" />
  },
}))
vi.mock('@tanstack/react-router', () => ({ useBlocker: vi.fn() }))
vi.mock('../model/use-whiteboard-editor', () => ({
  useWhiteboardEditor: vi.fn(),
}))
vi.mock('../model/export-scene', () => ({
  downloadSceneFile: vi.fn(),
  downloadScenePdf: vi.fn(),
}))
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const { toast } = await import('sonner')

const props = {
  workspaceId: 'workspace',
  projectId: 'project',
  userId: 'user',
  accessToken: 'token',
  onBack: vi.fn(),
  document: {
    id: 'document',
    projectId: 'project',
    creatorId: 'user',
    name: '문서',
    canvasContent: { elements: [] },
    revision: 0,
    lastSavedAt: '',
    createdAt: '',
    updatedAt: '',
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useWhiteboardEditor).mockReturnValue({
    scene: { elements: [] },
    participants: [],
    status: 'saved' as const,
    readOnly: false,
    error: null,
    hasUnsavedChanges: false,
    onSceneChange: vi.fn(),
    onPresenceChange: vi.fn(),
    retry: vi.fn(),
    discard: vi.fn(),
  })
})
afterEach(() => vi.restoreAllMocks())

async function openMenu() {
  fireEvent.click(screen.getByRole('button', { name: '더 보기' }))
  return screen.findByRole('menuitem', { name: 'PDF로 내려받기' })
}

it('메뉴에서 PDF로 내려받기를 고르면 현재 장면을 PDF로 만든다', async () => {
  vi.mocked(downloadScenePdf).mockResolvedValue('downloaded')
  render(<WhiteboardCanvas {...props} />)
  fireEvent.click(await openMenu())
  await waitFor(() =>
    expect(downloadScenePdf).toHaveBeenCalledWith(
      expect.objectContaining({ elements: [] }),
      '문서',
    ),
  )
  expect(toast.error).not.toHaveBeenCalled()
})

it('내보낼 내용이 없으면 안내 토스트를 띄운다', async () => {
  vi.mocked(downloadScenePdf).mockResolvedValue('empty')
  render(<WhiteboardCanvas {...props} />)
  fireEvent.click(await openMenu())
  await waitFor(() =>
    expect(toast.error).toHaveBeenCalledWith('내보낼 내용이 없어요'),
  )
})

it('PDF 생성이 실패하면 실패 토스트를 띄운다', async () => {
  vi.mocked(downloadScenePdf).mockRejectedValue(new Error('render failed'))
  render(<WhiteboardCanvas {...props} />)
  fireEvent.click(await openMenu())
  await waitFor(() =>
    expect(toast.error).toHaveBeenCalledWith('PDF를 만들지 못했어요'),
  )
})

it('생성이 끝나기 전에는 PDF 항목을 다시 실행하지 않는다', async () => {
  let finish = (_result: 'downloaded') => {}
  vi.mocked(downloadScenePdf).mockReturnValue(
    new Promise((resolve) => {
      finish = resolve
    }),
  )
  render(<WhiteboardCanvas {...props} />)
  fireEvent.click(await openMenu())
  await waitFor(() => expect(downloadScenePdf).toHaveBeenCalledTimes(1))

  fireEvent.click(screen.getByRole('button', { name: '더 보기' }))
  const item = await screen.findByRole('menuitem', { name: 'PDF로 내려받기' })
  expect(item).toHaveAttribute('data-disabled')
  fireEvent.click(item)
  expect(downloadScenePdf).toHaveBeenCalledTimes(1)

  finish('downloaded')
  await waitFor(() =>
    expect(
      screen.getByRole('menuitem', { name: 'PDF로 내려받기' }),
    ).not.toHaveAttribute('data-disabled'),
  )
})

it('동기화가 끊기고 읽기 전용이어도 PDF를 내보낼 수 있다', async () => {
  vi.mocked(useWhiteboardEditor).mockReturnValue({
    scene: { elements: [] },
    participants: [],
    status: 'disconnected' as const,
    readOnly: true,
    error: '연결이 끊겼어요',
    hasUnsavedChanges: true,
    onSceneChange: vi.fn(),
    onPresenceChange: vi.fn(),
    retry: vi.fn(),
    discard: vi.fn(),
  })
  vi.mocked(downloadScenePdf).mockResolvedValue('downloaded')
  render(<WhiteboardCanvas {...props} />)
  fireEvent.click(await openMenu())
  await waitFor(() => expect(downloadScenePdf).toHaveBeenCalledTimes(1))
})
```

- [ ] **Step 2: 실패 확인**

Run: `cd frontend && pnpm test -- src/features/whiteboard-editor/ui/WhiteboardCanvas.export.test.tsx`
Expected: FAIL — `Unable to find an accessible element with the role "menuitem" and name "PDF로 내려받기"`

- [ ] **Step 3: 메뉴 항목과 상태 구현**

`WhiteboardCanvas.tsx` import에 두 줄을 더한다.

```ts
import { toast } from 'sonner'
import { downloadSceneFile, downloadScenePdf } from '../model/export-scene'
```

컴포넌트 본문에 상태와 핸들러를 더한다. `currentScene()` 정의 바로 아래에 둔다.

```ts
  const [exportingPdf, setExportingPdf] = useState(false)

  async function exportPdf() {
    setExportingPdf(true)
    try {
      const result = await downloadScenePdf(currentScene(), document.name)
      if (result === 'empty') toast.error(MESSAGES.whiteboard.error.exportEmpty)
    } catch {
      toast.error(MESSAGES.whiteboard.error.exportPdfFailed)
    } finally {
      setExportingPdf(false)
    }
  }
```

드롭다운 그룹에 항목을 더한다. 기존 `exportFile` 항목 바로 아래다.

```tsx
                <DropdownMenuItem
                  disabled={exportingPdf}
                  onSelect={() => void exportPdf()}
                >
                  {MESSAGES.whiteboard.action.exportPdf}
                </DropdownMenuItem>
```

`onSelect`은 동기 함수여야 하므로 `void`로 비동기 작업만 띄운다. 메뉴는 기본 동작대로
닫히고, 생성은 뒤에서 계속 돈다.

- [ ] **Step 4: 통과 확인**

Run: `cd frontend && pnpm test -- src/features/whiteboard-editor/ui/WhiteboardCanvas.export.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 5: 커밋**

```bash
git add frontend/src/features/whiteboard-editor/ui/WhiteboardCanvas.tsx frontend/src/features/whiteboard-editor/ui/WhiteboardCanvas.export.test.tsx
git commit -m "$(cat <<'EOF'
feat: 화이트보드 PDF 내려받기 메뉴 추가

- 상단바 더 보기 메뉴에 PDF로 내려받기 항목 추가
- 빈 장면 안내와 생성 실패 토스트, 생성 중 중복 실행 차단
- 메뉴 동작 테스트 추가

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: 전체 검증과 계획 문서 갱신

**Files:**
- Modify: `docs/superpowers/plans/2026-09-29-whiteboard-pdf-export-implementation-plan.md`

- [ ] **Step 1: 테스트 전체 실행**

Run: `cd frontend && pnpm test`
Expected: PASS

- [ ] **Step 2: 린트**

Run: `cd frontend && pnpm lint`
Expected: 오류 0

- [ ] **Step 3: 빌드**

Run: `cd frontend && pnpm build`
Expected: 성공. `jspdf`가 별도 청크로 분리됐는지 출력에서 확인한다.

- [ ] **Step 4: 실제 동작 확인**

Run: `cd frontend && pnpm dev`

화이트보드를 열어 도형·한글 텍스트·이미지를 하나씩 넣고 `PDF로 내려받기`를 누른다.
확인할 것: 파일이 내려오는지, 한글이 깨지지 않는지, 배경이 흰색인지, 그림이 잘리지
않는지. 빈 화이트보드에서도 눌러 안내 토스트를 확인한다.

- [ ] **Step 5: 계획 문서에 결과 기록**

이 문서 끝에 `## Implementation Results` 절을 더해 실제 변경, 계획과 달라진 점,
실행한 검증 명령과 결과, 남은 후속 작업을 적는다.

- [ ] **Step 6: 커밋**

```bash
git add docs/superpowers/plans/2026-09-29-whiteboard-pdf-export-implementation-plan.md
git commit -m "$(cat <<'EOF'
docs: 화이트보드 PDF 내보내기 구현 결과 기록

- 실제 변경과 계획 차이, 검증 명령 결과 기록

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Implementation Results

### 실제 변경

| 파일 | 내용 |
| --- | --- |
| `frontend/package.json`, `pnpm-lock.yaml` | `jspdf@^4.2.1` 추가 |
| `frontend/pnpm-workspace.yaml` | `allowBuilds`에 `core-js: false`, `esbuild: true` 고정 |
| `frontend/src/shared/constants/messages/whiteboard.ts` | `action.exportPdf`, `error.exportEmpty`, `error.exportPdfFailed` 추가 |
| `frontend/src/features/whiteboard-editor/model/export-scene.ts` | 신규. `downloadSceneFile`, `downloadScenePdf`, 파일명 정규화, 다운로드 헬퍼 |
| `frontend/src/features/whiteboard-editor/model/export-scene.test.ts` | 신규. 9건 |
| `frontend/src/features/whiteboard-editor/ui/WhiteboardCanvas.tsx` | 인라인 `exportScene`을 `export-scene` 모듈 호출로 교체, `currentScene()` 추출, `exportingPdf` 상태와 PDF 메뉴 항목 추가 |
| `frontend/src/features/whiteboard-editor/ui/WhiteboardCanvas.export.test.tsx` | 신규. 5건 |

커밋: `5406c2c`(설계·계획) → `62d9d49`(의존성·문구) → `42d65d0`(모듈) → `3586917`(리팩터링) → `98c0016`(메뉴 연결).

### 계획과 달라진 점

- `pnpm add jspdf`가 core-js postinstall 때문에 `ERR_PNPM_IGNORED_BUILDS`로 끝나며
  `pnpm-workspace.yaml`에 플레이스홀더를 남겼다. core-js의 postinstall은 후원 안내
  배너뿐이라 `core-js: false`로 고정했다.
- 계획이 적은 `pnpm test -- <경로>`는 경로 필터로 동작하지 않고 전체 테스트를 돌린다.
  단일 파일 실행에는 `pnpm vitest run <경로>`를 썼다.
- Task 4 테스트가 두 번째 케이스부터 Radix 메뉴를 열지 못했다. 원인은 jsdom이 포커스된
  노드가 분리되면 `_lastFocusedElement`를 document로 되돌리고(`jsdom/living/nodes/Node-impl.js:494`),
  이후 `focus()`의 blur가 window를 대상으로 발사돼(`living/helpers/focusing.js:101`)
  Radix Menu의 window blur 핸들러(`@radix-ui/react-menu/dist/index.mjs:76`)가 메뉴를
  닫는 것이다. 제품 버그가 아니라 jsdom 아티팩트라, 테스트에서만 정리 후에도 남는
  포커스 앵커 요소를 매 테스트 앞에 포커스하도록 했다.
- 수동 확인(Step 4)은 앱 전체가 아니라 같은 코드 경로를 실제 브라우저에서 직접 호출하는
  임시 하네스로 했다. 아래 "검증"의 단서 참고.

### 검증

| 명령 | 결과 |
| --- | --- |
| `pnpm test` | 83개 파일 464개 테스트 전부 통과 |
| `pnpm lint` | error 0, warning 4 (모두 기존 `shared/ui` react-refresh 경고) |
| `pnpm build` | 성공. `jspdf.es.min-*.js` 399.13 kB (gzip 129.64 kB) 별도 청크로 분리 |
| `npx tsc -b` | exit 0 |

실제 브라우저 확인은 `pnpm dev` 위에 임시 페이지를 올려 `downloadScenePdf`를 같은 인자
모양(한글·漢字·이모지 텍스트, 도형, dataURL 이미지)으로 호출하고 내려받은 PDF를 이미지로
변환해 눈으로 검사했다. 확인한 것:

- 파일명이 `보드_2026_ 1분기_.pdf`로 정규화된 채 내려온다.
- 한글·漢字·이모지·디센더가 깨지지 않는다.
- 배경이 흰색이고, 상하좌우 여백이 있으며 도형이 잘리지 않는다.
- 이미지 요소가 그대로 들어간다.
- `MediaBox`가 `0 0 682.67 362.67`로 그림 bounding box 비율(1.88)과 같다. 즉 늘어남 없이
  그림 크기 그대로의 1페이지다.

하네스(`frontend/pdf-probe.html`, `frontend/src/pdf-probe.ts`)는 확인 후 삭제했다.

### 남은 후속 작업

- 앱 전체(로그인 → 워크스페이스 → 문서)를 띄운 수동 확인은 하지 않았다. Postgres·Valkey·
  시크릿과 계정 데이터가 필요해 이 범위에서 다루지 않았다. 빈 보드 안내 토스트와 생성 중
  중복 실행 차단은 `WhiteboardCanvas.export.test.tsx`의 단위 테스트로만 검증했다.
- 긴 변이 4096 px를 넘는 아주 큰 보드는 래스터가 축소돼 들어간다(종이 크기는 그대로).
  해상도 불만이 나오면 상한 조정이나 여러 페이지 분할을 별도로 논의한다.

### 최종 리뷰와 수정 패스

전체 브랜치 리뷰 결과는 Critical 0건, Important 2건, Minor 7건이었다. Important 2건과,
효과 기준으로 Important로 올린 Minor 2건(5·6)을 한 번의 수정 패스로 처리했다.

| 수정 | 변경 | 검증 |
| --- | --- | --- |
| 생성 중 진행 신호 없음 | `toast.loading` → `finally`에서 `toast.dismiss`, 문구 `toast.exportingPdf` 추가 | 신규 테스트 2건 RED→GREEN |
| UI 테스트가 배선 회귀를 못 잡음 | 실제 요소가 실린 장면을 넘기는지, `파일로 내보내기`도 같은 장면·이름을 쓰는지 검사 | `currentScene()`을 일부러 되돌려 2건 모두 실패하는 것을 확인한 뒤 복구 |
| 인쇄 실물 크기가 1.33배 | `hotfixes: ['px_scaling']` | Node에서 MediaBox 측정: `682.67 × 362.67` → `384 × 204`(512 CSS px = 384 pt) |
| 항상 1배 래스터 | `maxWidthOrHeight` 대신 `getDimensions`로 종이 크기와 배율을 분리, 배율 2배(긴 변 4096 px 상한) | 신규 테스트 3건 RED→GREEN |

`maxWidthOrHeight`를 쓰면 Excalidraw가 `getDimensions`를 무시하고 종이 크기를 래스터
크기에서 되뽑기 때문에, 배율만 올리면 종이가 같이 2배가 된다. 그래서 `getDimensions`로
바꿔 종이는 그림의 원래 크기, 캔버스는 그 2배로 각각 정한다.

수정하지 않은 Minor: vendor `sonner` 직접 import, `const document` 섀도잉, 사실상 무효한
`orientation` 인자, jsPDF optional deps(`html2canvas` 199 kB 청크, 이 경로에서는 로드되지
않음), 예약 문자로만 이루어진 이름이 `___.pdf`가 되는 점.
