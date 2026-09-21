export type WhiteboardElement = {
  id: string
  version: number
  versionNonce: number
  isDeleted: boolean
  [key: string]: unknown
}
export type WhiteboardFile = {
  id: string
  dataURL: string
  mimeType: string
  created: number
  version?: number
  lastRetrieved?: number
}
export type CanvasContent = {
  elements: WhiteboardElement[]
  files?: Record<string, WhiteboardFile>
}
