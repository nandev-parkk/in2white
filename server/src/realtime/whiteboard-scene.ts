import { mergeWhiteboardElements } from "@/realtime/whiteboard-element-merge";
import { mergeWhiteboardFiles } from "@/realtime/whiteboard-file-merge";
import { WHITEBOARD_LIMITS } from "@/realtime/whiteboard-limits";
import type {
  WhiteboardElement,
  WhiteboardFiles,
  WhiteboardFileUpdates,
  WhiteboardSnapshot,
} from "@/types/whiteboard";

type WhiteboardSceneUpdateResult =
  | {
      status: "updated";
      revision: number;
      elements: WhiteboardElement[];
      fileUpdates?: WhiteboardFileUpdates;
    }
  | { status: "noop"; revision: number }
  | { status: "file_conflict"; revision: number; fileId: string }
  | { status: "room_size_limit_exceeded"; revision: number };

export class WhiteboardSceneLimitError extends Error {
  constructor() {
    super("Whiteboard snapshot exceeds room limits");
    this.name = "WhiteboardSceneLimitError";
  }
}

function snapshotSize(
  elements: WhiteboardElement[],
  files: WhiteboardFiles,
  revision: number,
  lastSavedAt: Date,
): number {
  return Buffer.byteLength(
    JSON.stringify({
      canvasContent: {
        elements,
        ...(Object.keys(files).length > 0 ? { files } : {}),
      },
      revision,
      lastSavedAt,
    }),
    "utf8",
  );
}

function assertWithinRoomLimits(
  elements: WhiteboardElement[],
  files: WhiteboardFiles,
  revision: number,
  lastSavedAt: Date,
): void {
  if (
    elements.length > WHITEBOARD_LIMITS.elementsPerRoom ||
    snapshotSize(elements, files, revision, lastSavedAt) > WHITEBOARD_LIMITS.snapshotBytesPerRoom
  ) {
    throw new WhiteboardSceneLimitError();
  }
}

export class WhiteboardScene {
  private elementsById: Map<string, WhiteboardElement>;
  private elementOrder: string[];
  private files: WhiteboardFiles;
  private currentRevision: number;
  private currentPersistedRevision: number;
  private lastSavedAt: Date;

  private constructor(snapshot: WhiteboardSnapshot) {
    const canonicalElements = mergeWhiteboardElements([], snapshot.canvasContent.elements).elements;
    const files = { ...(snapshot.canvasContent.files ?? {}) };
    assertWithinRoomLimits(canonicalElements, files, snapshot.revision, snapshot.lastSavedAt);
    this.elementsById = new Map(canonicalElements.map((element) => [element.id, element]));
    this.elementOrder = canonicalElements.map((element) => element.id);
    this.files = files;
    this.currentRevision = snapshot.revision;
    this.currentPersistedRevision = snapshot.revision;
    this.lastSavedAt = new Date(snapshot.lastSavedAt);
  }

  static fromSnapshot(snapshot: WhiteboardSnapshot): WhiteboardScene {
    return new WhiteboardScene(snapshot);
  }

  applyUpdate(input: {
    elements: WhiteboardElement[];
    fileUpdates?: WhiteboardFileUpdates;
  }): WhiteboardSceneUpdateResult {
    const elementMerge = mergeWhiteboardElements(this.orderedElements(), input.elements);
    const fileMerge = mergeWhiteboardFiles(this.files, input.fileUpdates ?? {});

    if (fileMerge.status === "conflict") {
      return {
        status: "file_conflict",
        revision: this.currentRevision,
        fileId: fileMerge.fileId,
      };
    }

    if (elementMerge.appliedElements.length === 0 && !fileMerge.changed) {
      return { status: "noop", revision: this.currentRevision };
    }

    if (
      elementMerge.elements.length > WHITEBOARD_LIMITS.elementsPerRoom ||
      this.snapshotSize(elementMerge.elements, fileMerge.files, this.currentRevision + 1) >
        WHITEBOARD_LIMITS.snapshotBytesPerRoom
    ) {
      return { status: "room_size_limit_exceeded", revision: this.currentRevision };
    }

    this.replaceElements(elementMerge.elements);
    this.files = fileMerge.files;
    this.currentRevision += 1;

    return {
      status: "updated",
      revision: this.currentRevision,
      elements: elementMerge.appliedElements,
      ...(fileMerge.changed ? { fileUpdates: fileMerge.appliedFiles } : {}),
    };
  }

  mergeSnapshot(snapshot: WhiteboardSnapshot): {
    changed: boolean;
    snapshot: WhiteboardSnapshot;
  } {
    const elementMerge = mergeWhiteboardElements(
      snapshot.canvasContent.elements,
      this.orderedElements(),
    );
    const fileMerge = mergeWhiteboardFiles(snapshot.canvasContent.files ?? {}, this.files);
    const files =
      fileMerge.status === "merged"
        ? fileMerge.files
        : { ...(snapshot.canvasContent.files ?? {}), ...this.files };
    const changed =
      elementMerge.appliedElements.length > 0 ||
      fileMerge.status === "conflict" ||
      fileMerge.changed;
    const revision = changed ? snapshot.revision + 1 : snapshot.revision;

    assertWithinRoomLimits(elementMerge.elements, files, revision, snapshot.lastSavedAt);

    this.replaceElements(elementMerge.elements);
    this.files = files;
    this.currentPersistedRevision = snapshot.revision;
    this.currentRevision = revision;
    this.lastSavedAt = new Date(snapshot.lastSavedAt);

    return { changed, snapshot: this.toSnapshot() };
  }

  setPersisted(lastSavedAt: Date, persistedRevision: number): void {
    this.lastSavedAt = new Date(lastSavedAt);
    this.currentPersistedRevision = persistedRevision;
  }

  get revision(): number {
    return this.currentRevision;
  }

  get persistedRevision(): number {
    return this.currentPersistedRevision;
  }

  toSnapshot(): WhiteboardSnapshot {
    const files = { ...this.files };
    return {
      canvasContent: {
        elements: this.orderedElements(),
        ...(Object.keys(files).length > 0 ? { files } : {}),
      },
      revision: this.currentRevision,
      lastSavedAt: new Date(this.lastSavedAt),
    };
  }

  serializedSize(): number {
    return Buffer.byteLength(JSON.stringify(this.toSnapshot()), "utf8");
  }

  elementCount(): number {
    return this.elementsById.size;
  }

  private orderedElements(): WhiteboardElement[] {
    return this.elementOrder.map((id) => this.elementsById.get(id) as WhiteboardElement);
  }

  private replaceElements(elements: WhiteboardElement[]): void {
    this.elementsById = new Map(elements.map((element) => [element.id, element]));
    this.elementOrder = elements.map((element) => element.id);
  }

  private snapshotSize(
    elements: WhiteboardElement[],
    files: WhiteboardFiles,
    revision: number,
  ): number {
    return snapshotSize(elements, files, revision, this.lastSavedAt);
  }
}
