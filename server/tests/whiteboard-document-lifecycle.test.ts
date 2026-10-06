import { describe, expect, it, vi } from "vitest";
import {
  WhiteboardDocumentLifecycle,
  type JoinTicket,
} from "@/realtime/whiteboard-document-lifecycle";

const documentId = "document-1";

function expectTicket(value: JoinTicket | { status: "draining" }): JoinTicket {
  expect(value).not.toEqual({ status: "draining" });
  return value as JoinTicket;
}

describe("WhiteboardDocumentLifecycle", () => {
  it("invalidates a join that started before deletion", () => {
    const lifecycle = new WhiteboardDocumentLifecycle();
    const ticket = expectTicket(lifecycle.beginJoin(documentId));

    lifecycle.documentDeleted(documentId);

    expect(lifecycle.commitJoin(ticket, () => undefined)).toEqual({ status: "deleted" });
    lifecycle.releaseJoin(ticket);
  });

  it("invalidates every pending ticket from the deleted generation", () => {
    const lifecycle = new WhiteboardDocumentLifecycle();
    const first = expectTicket(lifecycle.beginJoin(documentId));
    const second = expectTicket(lifecycle.beginJoin(documentId));

    lifecycle.documentDeleted(documentId);

    expect(lifecycle.commitJoin(first, () => "first")).toEqual({ status: "deleted" });
    expect(lifecycle.commitJoin(second, () => "second")).toEqual({ status: "deleted" });
    lifecycle.releaseJoin(first);
    lifecycle.releaseJoin(second);

    const next = expectTicket(lifecycle.beginJoin(documentId));
    expect(next.generation).toBeGreaterThan(first.generation);
  });

  it("runs registration synchronously and exactly once for a valid ticket", () => {
    const lifecycle = new WhiteboardDocumentLifecycle();
    const ticket = expectTicket(lifecycle.beginJoin(documentId));
    const register = vi.fn(() => "registered");

    expect(lifecycle.commitJoin(ticket, register)).toEqual({
      status: "joined",
      value: "registered",
    });
    expect(lifecycle.commitJoin(ticket, register)).toEqual({ status: "deleted" });
    expect(register).toHaveBeenCalledTimes(1);
    lifecycle.releaseJoin(ticket);
  });

  it("rejects begin and commit after draining starts", () => {
    const lifecycle = new WhiteboardDocumentLifecycle();
    const ticket = expectTicket(lifecycle.beginJoin(documentId));
    const register = vi.fn();

    lifecycle.startDraining();

    expect(lifecycle.draining).toBe(true);
    expect(lifecycle.beginJoin(documentId)).toEqual({ status: "draining" });
    expect(lifecycle.commitJoin(ticket, register)).toEqual({ status: "draining" });
    expect(register).not.toHaveBeenCalled();
    lifecycle.releaseJoin(ticket);
  });
});
