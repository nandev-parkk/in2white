export interface JoinTicket {
  readonly documentId: string;
  readonly generation: number;
  readonly id: symbol;
}

interface PendingJoin {
  generation: number;
  committed: boolean;
}

interface DocumentEntry {
  generation: number;
  pending: Map<symbol, PendingJoin>;
}

export class WhiteboardDocumentLifecycle {
  private readonly entries = new Map<string, DocumentEntry>();
  private nextGeneration = 0;
  private isDraining = false;

  beginJoin(documentId: string): JoinTicket | { status: "draining" } {
    if (this.isDraining) {
      return { status: "draining" };
    }

    let entry = this.entries.get(documentId);
    if (!entry) {
      entry = { generation: this.nextGeneration++, pending: new Map() };
      this.entries.set(documentId, entry);
    }

    const id = Symbol(documentId);
    entry.pending.set(id, { generation: entry.generation, committed: false });
    return { documentId, generation: entry.generation, id };
  }

  commitJoin<T>(
    ticket: JoinTicket,
    register: () => T,
  ): { status: "joined"; value: T } | { status: "deleted" | "draining" } {
    if (this.isDraining) {
      return { status: "draining" };
    }

    const entry = this.entries.get(ticket.documentId);
    const pending = entry?.pending.get(ticket.id);
    if (
      !entry ||
      !pending ||
      pending.committed ||
      entry.generation !== ticket.generation ||
      pending.generation !== ticket.generation
    ) {
      return { status: "deleted" };
    }

    pending.committed = true;
    return { status: "joined", value: register() };
  }

  releaseJoin(ticket: JoinTicket): void {
    const entry = this.entries.get(ticket.documentId);
    if (!entry) {
      return;
    }

    entry.pending.delete(ticket.id);
    if (entry.pending.size === 0) {
      this.entries.delete(ticket.documentId);
    }
  }

  documentDeleted(documentId: string): void {
    const entry = this.entries.get(documentId);
    if (!entry) {
      return;
    }

    entry.generation = this.nextGeneration++;
  }

  startDraining(): void {
    this.isDraining = true;
  }

  get draining(): boolean {
    return this.isDraining;
  }
}
