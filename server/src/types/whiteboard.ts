export interface WhiteboardElement {
  [key: string]: unknown;
  id: string;
  version: number;
  versionNonce: number;
  isDeleted: boolean;
}

export interface WhiteboardFile {
  [key: string]: unknown;
  id: string;
  mimeType: string;
  dataURL: string;
  created: number;
  lastRetrieved?: number;
  version?: number;
}

export interface LegacyWhiteboardFile {
  [key: string]: unknown;
  id: string;
}

export type StoredWhiteboardFile = WhiteboardFile | LegacyWhiteboardFile;
export type WhiteboardFiles = Record<string, StoredWhiteboardFile>;
export type WhiteboardFileUpdates = Record<string, WhiteboardFile>;

export interface CanvasContent {
  elements: WhiteboardElement[];
  files?: WhiteboardFiles;
}

export interface WhiteboardSnapshot {
  canvasContent: CanvasContent;
  revision: number;
  lastSavedAt: Date;
}
