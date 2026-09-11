import { beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { whiteboardDocumentContents, whiteboardDocuments } from "@/db/schema";
import {
  getWhiteboardDocumentContent,
  normalizeCanvasContent,
  saveWhiteboardDocumentContent,
} from "@/services/whiteboard-document-content.service";

vi.mock("@/db/client", () => ({
  db: {
    select: vi.fn(),
    transaction: vi.fn(),
  },
}));

const documentId = "6ba7b810-9dad-41d1-80b4-00c04fd430c8";
const updatedAt = new Date("2026-09-11T00:00:00.000Z");

beforeEach(() => {
  vi.mocked(db.select).mockReset();
  vi.mocked(db.transaction).mockReset();
});

describe("normalizeCanvasContent", () => {
  it("normalizes an empty legacy object to an empty element scene", () => {
    expect(normalizeCanvasContent({})).toEqual({ elements: [] });
  });

  it("preserves elements and files from a valid canvas content object", () => {
    const element = { id: "element-1", version: 1, versionNonce: 10, isDeleted: false };
    const file = {
      id: "file-1",
      mimeType: "image/png",
      dataURL: "data:image/png;base64,AA==",
      created: 1,
    };

    expect(normalizeCanvasContent({ elements: [element], files: { "file-1": file } })).toEqual({
      elements: [element],
      files: { "file-1": file },
    });
  });

  it("preserves a legacy file entry that still has a matching stable id", () => {
    const legacyFile = { id: "file-1", legacyStorageKey: "objects/file-1" };

    expect(normalizeCanvasContent({ elements: [], files: { "file-1": legacyFile } })).toEqual({
      elements: [],
      files: { "file-1": legacyFile },
    });
  });

  it.each([
    null,
    "invalid",
    { elements: [{ id: "element-1" }] },
    { elements: [], files: [] },
    { elements: [], files: { "file-1": {} } },
    {
      elements: [],
      files: {
        "file-1": {
          id: "another-file",
          mimeType: "image/png",
          dataURL: "data:image/png;base64,AA==",
          created: 1,
        },
      },
    },
  ])("rejects invalid canvas content: %j", (value) => {
    expect(() => normalizeCanvasContent(value)).toThrow();
  });
});

describe("getWhiteboardDocumentContent", () => {
  it("reads canvas content, revision, and updatedAt with an explicit projection", async () => {
    const query = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([
        {
          canvasContent: { elements: [] },
          revision: 3,
          updatedAt,
        },
      ]),
    };
    vi.mocked(db.select).mockReturnValue(query as never);

    await expect(getWhiteboardDocumentContent(documentId)).resolves.toEqual({
      canvasContent: { elements: [] },
      revision: 3,
      lastSavedAt: updatedAt,
    });

    expect(db.select).toHaveBeenCalledWith({
      canvasContent: whiteboardDocumentContents.canvasContent,
      revision: whiteboardDocumentContents.revision,
      updatedAt: whiteboardDocumentContents.updatedAt,
    });
    expect(query.from).toHaveBeenCalledWith(whiteboardDocumentContents);
    expect(query.where).toHaveBeenCalledWith(eq(whiteboardDocumentContents.documentId, documentId));
  });
});

describe("saveWhiteboardDocumentContent", () => {
  it("updates content conditionally and then touches the parent document with one timestamp", async () => {
    const parentQuery = {
      from: vi.fn().mockReturnThis(),
      for: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
    };
    const contentUpdate = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ updatedAt }]),
    };
    const parentUpdate = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    };
    const transaction = {
      select: vi.fn().mockReturnValue(parentQuery),
      update: vi.fn().mockReturnValueOnce(contentUpdate).mockReturnValueOnce(parentUpdate),
    };
    vi.mocked(db.transaction).mockImplementation(async (callback) =>
      callback(transaction as never),
    );
    parentQuery.for.mockResolvedValue([{ id: documentId }]);

    await expect(
      saveWhiteboardDocumentContent({
        documentId,
        canvasContent: { elements: [] },
        expectedRevision: 2,
        revision: 3,
      }),
    ).resolves.toEqual({ status: "saved", lastSavedAt: updatedAt });

    expect(transaction.select).toHaveBeenCalledWith({ id: whiteboardDocuments.id });
    expect(parentQuery.from).toHaveBeenCalledWith(whiteboardDocuments);
    expect(parentQuery.where).toHaveBeenCalledWith(
      and(eq(whiteboardDocuments.id, documentId), isNull(whiteboardDocuments.deletedAt)),
    );
    expect(parentQuery.for).toHaveBeenCalledWith("update");
    expect(transaction.update).toHaveBeenNthCalledWith(1, whiteboardDocumentContents);
    expect(contentUpdate.set).toHaveBeenCalledWith({
      canvasContent: { elements: [] },
      revision: 3,
      updatedAt: expect.any(Date),
    });
    expect(contentUpdate.where).toHaveBeenCalledWith(
      and(
        eq(whiteboardDocumentContents.documentId, documentId),
        eq(whiteboardDocumentContents.revision, 2),
      ),
    );
    expect(transaction.update).toHaveBeenNthCalledWith(2, whiteboardDocuments);
    expect(parentUpdate.set).toHaveBeenCalledWith({ updatedAt: expect.any(Date) });
    expect(parentUpdate.set.mock.calls[0]?.[0].updatedAt).toEqual(
      contentUpdate.set.mock.calls[0]?.[0].updatedAt,
    );
  });

  it.each([
    { contentRows: [{ id: documentId }], expected: { status: "conflict" } },
    { contentRows: [], expected: { status: "content_missing" } },
  ])(
    "distinguishes $expected.status when the revision predicate matches no row",
    async ({ contentRows, expected }) => {
      const parentQuery = {
        from: vi.fn().mockReturnThis(),
        for: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
      };
      const contentExistenceQuery = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(contentRows),
      };
      const contentUpdate = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([]),
      };
      const transaction = {
        select: vi.fn().mockReturnValueOnce(parentQuery).mockReturnValueOnce(contentExistenceQuery),
        update: vi.fn().mockReturnValue(contentUpdate),
      };
      vi.mocked(db.transaction).mockImplementation(async (callback) =>
        callback(transaction as never),
      );
      parentQuery.for.mockResolvedValue([{ id: documentId }]);

      await expect(
        saveWhiteboardDocumentContent({
          documentId,
          canvasContent: { elements: [] },
          expectedRevision: 2,
          revision: 3,
        }),
      ).resolves.toEqual(expected);

      expect(transaction.update).toHaveBeenCalledOnce();
      expect(contentExistenceQuery.from).toHaveBeenCalledWith(whiteboardDocumentContents);
      expect(contentExistenceQuery.where).toHaveBeenCalledWith(
        eq(whiteboardDocumentContents.documentId, documentId),
      );
    },
  );

  it("returns not_found without updating content when the active document is missing", async () => {
    const parentQuery = {
      from: vi.fn().mockReturnThis(),
      for: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
    };
    const transaction = {
      select: vi.fn().mockReturnValue(parentQuery),
      update: vi.fn(),
    };
    vi.mocked(db.transaction).mockImplementation(async (callback) =>
      callback(transaction as never),
    );
    parentQuery.for.mockResolvedValue([]);

    await expect(
      saveWhiteboardDocumentContent({
        documentId,
        canvasContent: { elements: [] },
        expectedRevision: 2,
        revision: 3,
      }),
    ).resolves.toEqual({ status: "not_found" });

    expect(transaction.update).not.toHaveBeenCalled();
  });
});
