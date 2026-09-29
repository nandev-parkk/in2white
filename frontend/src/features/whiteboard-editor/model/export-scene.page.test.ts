import { beforeEach, expect, it, vi } from 'vitest'
import type { CanvasContent } from './protocol'
import { downloadScenePdf } from './export-scene'

/**
 * 다른 테스트가 jsPDF를 모킹해 "우리가 넘긴 인자"만 되읽는 것과 달리,
 * 이 파일은 진짜 jsPDF로 PDF를 만들어 실제 종이 크기를 확인한다.
 * 단위 표기(px → pt)와 방향 뒤집힘은 라이브러리 안에서 결정되기 때문이다.
 */
const excalidraw = vi.hoisted(() => ({ exportToCanvas: vi.fn() }))
vi.mock('@excalidraw/excalidraw', () => ({
  exportToCanvas: excalidraw.exportToCanvas,
}))

const captured = vi.hoisted(() => ({ documents: [] as Blob[] }))
/**
 * jsdom에서는 jsPDF의 저장 헬퍼가 조용히 아무것도 하지 않아 결과를 볼 수 없다.
 * 문서 생성은 실제 라이브러리에 맡기고 저장만 가로채 완성된 PDF를 받는다.
 */
vi.mock('jspdf', async (importOriginal) => {
  const actual = await importOriginal<typeof import('jspdf')>()
  function CapturingPdf(this: unknown, options: unknown) {
    const pdf = new actual.jsPDF(
      options as ConstructorParameters<typeof actual.jsPDF>[0],
    )
    pdf.save = (() => {
      captured.documents.push(pdf.output('blob'))
      return pdf
    }) as typeof pdf.save
    return pdf
  }
  return { ...actual, jsPDF: CapturingPdf }
})

/** jsPDF가 실제로 디코드할 수 있는 8×8 PNG. */
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGP4z8CAFWEXHbQSACj/P8Fu7N9hAAAAAElFTkSuQmCC'

type Dimensions = { width: number; height: number; scale?: number }

/** 그림의 원래 크기를 받아 `getDimensions`가 정한 크기의 캔버스 대역을 돌려준다. */
function exportsCanvas(naturalWidth: number, naturalHeight: number) {
  excalidraw.exportToCanvas.mockImplementation(
    async ({
      getDimensions,
    }: {
      getDimensions: (width: number, height: number) => Dimensions
    }) => {
      const size = getDimensions(naturalWidth, naturalHeight)
      return { width: size.width, height: size.height, toDataURL: () => PNG }
    },
  )
}

beforeEach(() => {
  captured.documents = []
  excalidraw.exportToCanvas.mockReset()
})

/** 만들어진 PDF의 MediaBox를 pt 단위 [가로, 세로]로 읽는다. */
async function pageSize() {
  const text = await captured.documents[0].text()
  const box = /\/MediaBox \[([^\]]+)\]/.exec(text)
  if (!box) throw new Error('MediaBox를 찾지 못했다')
  const [, , width, height] = box[1].trim().split(/\s+/).map(Number)
  return { width, height }
}

const scene: CanvasContent = {
  elements: [{ id: 'a', version: 1, versionNonce: 1, isDeleted: false }],
}

it('가로로 넓은 그림은 뒤집히지 않고 가로 페이지로 나온다', async () => {
  exportsCanvas(800, 600)
  await downloadScenePdf(scene, '문서')
  // 96 DPI 기준으로 800 CSS px = 600 pt, 600 CSS px = 450 pt.
  expect(await pageSize()).toEqual({ width: 600, height: 450 })
})

it('세로로 긴 그림은 뒤집히지 않고 세로 페이지로 나온다', async () => {
  exportsCanvas(600, 900)
  await downloadScenePdf(scene, '문서')
  expect(await pageSize()).toEqual({ width: 450, height: 675 })
})
