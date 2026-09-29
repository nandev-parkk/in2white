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

type Dimensions = { width: number; height: number; scale?: number }

/**
 * 그림의 원래 크기를 주면 `getDimensions`가 정한 픽셀 크기로 캔버스를 돌려주는 대역.
 * 종이 크기와 렌더 배율을 함께 정하는 실제 동작을 그대로 흉내 낸다.
 */
function exportsCanvas(naturalWidth: number, naturalHeight: number) {
  excalidraw.exportToCanvas.mockImplementation(
    async ({
      getDimensions,
    }: {
      getDimensions: (width: number, height: number) => Dimensions
    }) => {
      const size = getDimensions(naturalWidth, naturalHeight)
      return {
        width: size.width,
        height: size.height,
        toDataURL: () => 'data:image/png;base64,PNG',
      }
    },
  )
}

/** 마지막 호출에 넘긴 `getDimensions`를 직접 불러 배율을 확인한다. */
function lastDimensions(width: number, height: number): Dimensions {
  const calls = excalidraw.exportToCanvas.mock.calls
  return calls[calls.length - 1][0].getDimensions(width, height)
}
function element(id: string, isDeleted = false) {
  return { id, version: 1, versionNonce: 1, isDeleted }
}

let clicked: { href: string; download: string }[] = []
beforeEach(() => {
  vi.clearAllMocks()
  clicked = []
  exportsCanvas(800, 600)
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
    }),
  )
})

it('가로로 넓은 캔버스는 landscape, 세로로 긴 캔버스는 portrait로 만든다', async () => {
  await downloadScenePdf({ elements: [element('a')] }, '문서')
  expect(pdf.options).toMatchObject({
    orientation: 'landscape',
    unit: 'px',
    format: [800, 600],
  })

  exportsCanvas(600, 900)
  await downloadScenePdf({ elements: [element('a')] }, '문서')
  expect(pdf.options).toMatchObject({
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

it('px를 CSS 픽셀로 읽도록 px_scaling 핫픽스를 켠다', async () => {
  await downloadScenePdf({ elements: [element('a')] }, '문서')
  expect(pdf.options).toMatchObject({ hotfixes: ['px_scaling'] })
})

it('종이는 그림 크기로 두고 캔버스만 두 배로 그린다', async () => {
  await downloadScenePdf({ elements: [element('a')] }, '문서')
  expect(lastDimensions(800, 600)).toEqual({
    width: 1600,
    height: 1200,
    scale: 2,
  })
  expect(pdf.options).toMatchObject({ format: [800, 600] })
  expect(pdf.addImage).toHaveBeenCalledWith(
    'data:image/png;base64,PNG',
    'PNG',
    0,
    0,
    800,
    600,
  )
})

it('긴 변이 상한을 넘으면 배율을 낮춰 캔버스 한계를 지킨다', async () => {
  exportsCanvas(4000, 1000)
  await downloadScenePdf({ elements: [element('a')] }, '문서')
  expect(lastDimensions(4000, 1000)).toEqual({
    width: 4096,
    height: 1024,
    scale: 1.024,
  })
  expect(pdf.options).toMatchObject({ format: [4000, 1000] })
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
