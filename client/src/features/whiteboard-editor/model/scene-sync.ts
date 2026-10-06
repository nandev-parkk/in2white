import type {
  CanvasContent,
  SceneDelta,
  WhiteboardElement,
  WhiteboardFile,
} from './protocol'
import { MESSAGES } from '@/shared/constants/messages'

function newer(a: WhiteboardElement, b?: WhiteboardElement) {
  return (
    !b ||
    a.version > b.version ||
    (a.version === b.version && a.versionNonce > b.versionNonce)
  )
}
function fileChanged(a: WhiteboardFile, b?: WhiteboardFile) {
  return (
    !b ||
    (a.version ?? 0) > (b.version ?? 0) ||
    ((a.version ?? 0) === (b.version ?? 0) &&
      (a.dataURL !== b.dataURL || a.mimeType !== b.mimeType))
  )
}
export function diffScene(
  base: CanvasContent,
  next: CanvasContent,
): SceneDelta {
  const previous = new Map(
    base.elements.map((element) => [element.id, element]),
  )
  const elements = next.elements.filter((element) =>
    newer(element, previous.get(element.id)),
  )
  const entries = Object.entries(next.files ?? {}).filter(([id, file]) =>
    fileChanged(file, base.files?.[id]),
  )
  return {
    elements,
    ...(entries.length ? { fileUpdates: Object.fromEntries(entries) } : {}),
  }
}
export function mergeScene(
  base: CanvasContent,
  delta: SceneDelta,
): CanvasContent {
  const elements = new Map(
    base.elements.map((element) => [element.id, element]),
  )
  for (const element of delta.elements)
    if (newer(element, elements.get(element.id)))
      elements.set(element.id, element)
  const files = { ...base.files }
  for (const [id, file] of Object.entries(delta.fileUpdates ?? {})) {
    if (
      !Object.hasOwn(files, id) ||
      (file.version ?? 0) > (files[id].version ?? 0)
    ) {
      Object.defineProperty(files, id, {
        value: file,
        enumerable: true,
        writable: true,
        configurable: true,
      })
    }
  }
  const ordered = [...elements.values()].sort((a, b) => {
    if (typeof a.index !== 'string' || typeof b.index !== 'string') return 0
    const left = a.index === b.index ? a.id : a.index
    const right = a.index === b.index ? b.id : b.index
    return left < right ? -1 : left > right ? 1 : 0
  })
  return { elements: ordered, ...(Object.keys(files).length ? { files } : {}) }
}
export const hasDelta = (delta: SceneDelta) =>
  delta.elements.length > 0 || Object.keys(delta.fileUpdates ?? {}).length > 0
export const isSaved = (
  revision: number,
  savedRevision: number,
  pending: boolean,
) => !pending && savedRevision >= revision

export function nextBatch(delta: SceneDelta): SceneDelta {
  const batch: SceneDelta = { elements: [] }
  // UUID와 이벤트 envelope를 포함해 서버의 1 MiB 제한보다 작게 유지한다.
  let bytes = 1024
  const size = (value: unknown) =>
    new TextEncoder().encode(JSON.stringify(value)).length + 2
  for (const [id, file] of Object.entries(delta.fileUpdates ?? {})) {
    const length = size({ [id]: file })
    if (length + 1024 > 1_048_576)
      throw new Error(MESSAGES.whiteboard.sync.imageTooLarge)
    if (bytes + length > 1_048_576) return batch
    batch.fileUpdates ??= {}
    Object.defineProperty(batch.fileUpdates, id, {
      value: file,
      enumerable: true,
    })
    bytes += length
  }
  for (const element of delta.elements) {
    const length = size(element)
    if (length + 1024 > 1_048_576)
      throw new Error(MESSAGES.whiteboard.sync.elementTooLarge)
    if (batch.elements.length >= 2000 || bytes + length > 1_048_576) break
    batch.elements.push(element)
    bytes += length
  }
  return batch
}
