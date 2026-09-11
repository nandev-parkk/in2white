import { whiteboardFileSchema } from "@/realtime/whiteboard-protocol.schema";
import type { StoredWhiteboardFile, WhiteboardFiles } from "@/types/whiteboard";

export type WhiteboardFileMergeResult<TFile extends StoredWhiteboardFile> =
  | {
      status: "merged";
      files: WhiteboardFiles;
      appliedFiles: Record<string, TFile>;
      changed: boolean;
    }
  | { status: "conflict"; fileId: string };

function fileVersion(fileId: string, file: StoredWhiteboardFile): number {
  const parsed = whiteboardFileSchema.safeParse(file);
  return parsed.success && parsed.data.id === fileId ? (parsed.data.version ?? 0) : -1;
}

function hasSameBinaryIdentity(
  current: StoredWhiteboardFile,
  incoming: StoredWhiteboardFile,
): boolean {
  return current.dataURL === incoming.dataURL && current.mimeType === incoming.mimeType;
}

export function mergeWhiteboardFiles<TFile extends StoredWhiteboardFile>(
  current: WhiteboardFiles,
  incoming: Record<string, TFile>,
): WhiteboardFileMergeResult<TFile> {
  const files = { ...current };
  const appliedFiles: Record<string, TFile> = {};

  for (const [fileId, incomingFile] of Object.entries(incoming)) {
    const currentFile = files[fileId];
    if (!currentFile || fileVersion(fileId, incomingFile) > fileVersion(fileId, currentFile)) {
      files[fileId] = incomingFile;
      appliedFiles[fileId] = incomingFile;
      continue;
    }

    if (fileVersion(fileId, incomingFile) < fileVersion(fileId, currentFile)) {
      continue;
    }

    if (!hasSameBinaryIdentity(currentFile, incomingFile)) {
      return { status: "conflict", fileId };
    }
  }

  const changed = Object.keys(appliedFiles).length > 0;
  return { status: "merged", files, appliedFiles, changed };
}
