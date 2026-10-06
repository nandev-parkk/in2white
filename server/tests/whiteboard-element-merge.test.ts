import { describe, expect, it } from "vitest";
import { mergeWhiteboardElements } from "@/realtime/whiteboard-element-merge";
import type { WhiteboardElement } from "@/types/whiteboard";

function element(
  id: string,
  version: number,
  versionNonce = 1,
  isDeleted = false,
): WhiteboardElement {
  return { id, version, versionNonce, isDeleted, type: "rectangle" };
}

describe("mergeWhiteboardElements", () => {
  it("keeps independent changes from both users", () => {
    const current = [element("a", 1), element("b", 1)];
    const result = mergeWhiteboardElements(current, [element("a", 2), element("c", 1)]);

    expect(result.elements.map((item) => item.id)).toEqual(["a", "b", "c"]);
    expect(result.appliedElements.map((item) => item.id)).toEqual(["a", "c"]);
  });

  it("uses version and then versionNonce for the same element", () => {
    const current = [element("a", 3, 10)];

    expect(mergeWhiteboardElements(current, [element("a", 2, 99)]).elements[0]).toEqual(current[0]);
    expect(mergeWhiteboardElements(current, [element("a", 3, 11)]).elements[0].versionNonce).toBe(
      11,
    );
  });

  it("does not report a stale element as applied", () => {
    const current = [element("a", 2)];

    expect(mergeWhiteboardElements(current, [element("a", 1)]).appliedElements).toEqual([]);
  });

  it("keeps delete tombstones when they win", () => {
    const result = mergeWhiteboardElements([element("a", 1)], [element("a", 2, 1, true)]);

    expect(result.elements[0].isDeleted).toBe(true);
  });

  it("returns the canonical winner once for duplicate incoming ids", () => {
    const result = mergeWhiteboardElements([], [element("a", 1), element("a", 2)]);

    expect(result.appliedElements).toEqual([element("a", 2)]);
  });
});
