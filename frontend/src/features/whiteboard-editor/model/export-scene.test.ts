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
  vi.spyOn(window.document, 'createElement').mockImplementation((() => {
    const link = { href: '', download: '', click: () => {} }
    link.click = () =>
      clicked.push({ href: link.href, download: link.download })
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
