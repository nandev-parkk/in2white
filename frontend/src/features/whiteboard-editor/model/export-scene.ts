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
