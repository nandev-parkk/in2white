import { describe, expect, it } from "vitest";
import { mergeWhiteboardFiles } from "@/realtime/whiteboard-file-merge";
import type { WhiteboardFile, WhiteboardFiles } from "@/types/whiteboard";

const file: WhiteboardFile = {
  id: "file-1",
  mimeType: "image/png",
  dataURL: "data:image/png;base64,AA==",
  created: 1,
  version: 1,
};

describe("mergeWhiteboardFiles", () => {
  it("adds a new file", () => {
    expect(mergeWhiteboardFiles({}, { "file-1": file })).toEqual({
      status: "merged",
      files: { "file-1": file },
      appliedFiles: { "file-1": file },
      changed: true,
    });
  });

  it("replaces a file with a higher version", () => {
    const incoming = {
      ...file,
      dataURL: "data:image/png;base64,BB==",
      version: 2,
    };

    expect(mergeWhiteboardFiles({ "file-1": file }, { "file-1": incoming })).toEqual({
      status: "merged",
      files: { "file-1": incoming },
      appliedFiles: { "file-1": incoming },
      changed: true,
    });
  });

  it("treats an omitted version as zero", () => {
    const current = { ...file, version: 0 };
    const incoming = { ...file, dataURL: "data:image/png;base64,BB==" };
    delete incoming.version;

    expect(mergeWhiteboardFiles({ "file-1": current }, { "file-1": incoming })).toEqual({
      status: "conflict",
      fileId: "file-1",
    });
  });

  it("treats a legacy current entry as version negative one", () => {
    const legacyFiles = {
      "file-1": { id: "file-1", legacy: true },
    } as unknown as WhiteboardFiles;
    const incoming = { ...file, version: 0 };

    expect(mergeWhiteboardFiles(legacyFiles, { "file-1": incoming })).toEqual({
      status: "merged",
      files: { "file-1": incoming },
      appliedFiles: { "file-1": incoming },
      changed: true,
    });
  });

  it.each([
    ["a mismatched id", { ...file, id: "another-id" }],
    ["an empty id", { ...file, id: "" }],
    ["a missing MIME type", { ...file, mimeType: undefined }],
    ["a non-string data URL", { ...file, dataURL: 1 }],
    ["an infinite created value", { ...file, created: Number.POSITIVE_INFINITY }],
    ["a NaN created value", { ...file, created: Number.NaN }],
    ["a negative lastRetrieved", { ...file, lastRetrieved: -1 }],
    ["a fractional lastRetrieved", { ...file, lastRetrieved: 1.5 }],
    ["an infinite lastRetrieved", { ...file, lastRetrieved: Number.POSITIVE_INFINITY }],
    ["a negative version", { ...file, version: -1 }],
    ["a fractional version", { ...file, version: 1.5 }],
    ["an infinite version", { ...file, version: Number.POSITIVE_INFINITY }],
  ])("treats current entry with %s as legacy", (_case, invalidCurrent) => {
    const current = { "file-1": invalidCurrent } as unknown as WhiteboardFiles;
    const incoming = {
      ...file,
      dataURL: "data:image/png;base64,BB==",
      version: 0,
    };

    expect(mergeWhiteboardFiles(current, { "file-1": incoming })).toEqual({
      status: "merged",
      files: { "file-1": incoming },
      appliedFiles: { "file-1": incoming },
      changed: true,
    });
  });

  it.each([
    ["negative", -1],
    ["fractional", 1.5],
  ])("treats a %s finite created value as valid", (_case, created) => {
    const currentFile = { ...file, created };
    const incoming = {
      ...file,
      dataURL: "data:image/png;base64,BB==",
      version: 0,
    };

    expect(mergeWhiteboardFiles({ "file-1": currentFile }, { "file-1": incoming })).toEqual({
      status: "merged",
      files: { "file-1": currentFile },
      appliedFiles: {},
      changed: false,
    });
  });

  it("ignores a lastRetrieved-only change", () => {
    const current = { ...file, lastRetrieved: 1 };
    const incoming = { ...file, lastRetrieved: 2 };

    expect(mergeWhiteboardFiles({ "file-1": current }, { "file-1": incoming })).toEqual({
      status: "merged",
      files: { "file-1": current },
      appliedFiles: {},
      changed: false,
    });
  });

  it("ignores a stale file update", () => {
    const current = { ...file, version: 2 };
    const incoming = {
      ...file,
      dataURL: "data:image/png;base64,BB==",
      version: 1,
    };

    expect(mergeWhiteboardFiles({ "file-1": current }, { "file-1": incoming })).toEqual({
      status: "merged",
      files: { "file-1": current },
      appliedFiles: {},
      changed: false,
    });
  });

  it("rejects different binary data at the same version", () => {
    expect(
      mergeWhiteboardFiles(
        { "file-1": file },
        {
          "file-1": { ...file, dataURL: "data:image/png;base64,BB==" },
        },
      ),
    ).toEqual({ status: "conflict", fileId: "file-1" });
  });

  it("does not mutate current files when any update conflicts", () => {
    const current = { "file-1": file };
    const file2 = { ...file, id: "file-2" };

    expect(
      mergeWhiteboardFiles(current, {
        "file-2": file2,
        "file-1": { ...file, mimeType: "image/jpeg" },
      }),
    ).toEqual({ status: "conflict", fileId: "file-1" });
    expect(current).toEqual({ "file-1": file });
  });
});
