import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import { fileURLToPath } from "node:url";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres, { type Sql } from "postgres";
import { io, type Socket } from "socket.io-client";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import { signAccessToken } from "@/lib/jwt";
import type {
  WhiteboardClientToServerEvents,
  WhiteboardServerToClientEvents,
} from "@/realtime/whiteboard-socket.events";
import type { WhiteboardCollaboration } from "@/realtime/whiteboard-collaboration";

const integration = process.env.RUN_DATABASE_INTEGRATION_TESTS === "1" ? describe : describe.skip;
type Client = Socket<WhiteboardServerToClientEvents, WhiteboardClientToServerEvents>;
integration("실제 DB 화이트보드 편집·저장·복원", () => {
  const owner = randomUUID(),
    member = randomUUID(),
    outsider = randomUUID();
  const workspaceId = randomUUID(),
    projectId = randomUUID(),
    documentId = randomUUID();
  const path =
    "/workspaces/" + workspaceId + "/projects/" + projectId + "/whiteboard-documents/" + documentId;
  let container: StartedPostgreSqlContainer | undefined;
  let sql: Sql | undefined;
  let database: ReturnType<typeof drizzle<typeof schema>>;
  let server: Server;
  let collaboration: WhiteboardCollaboration | undefined;
  let url: string;
  let ownerToken: string;
  const clients: Client[] = [];
  async function connect(userId: string) {
    const token = await signAccessToken({
      sub: userId,
      email: userId + "@example.test",
      sid: "integration",
      ver: 0,
    });
    const client: Client = io(url, {
      auth: { accessToken: token },
      forceNew: true,
      reconnection: false,
    });
    clients.push(client);
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("socket connect timeout")), 5000);
      client.once("connect", () => {
        clearTimeout(timer);
        resolve();
      });
      client.once("connect_error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
    return client;
  }
  const join = (client: Client) =>
    client.timeout(5000).emitWithAck("whiteboard:join", { workspaceId, projectId, documentId });
  async function storedAtLeast(revision: number) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const [content] = await database
        .select()
        .from(schema.whiteboardDocumentContents)
        .where(eq(schema.whiteboardDocumentContents.documentId, documentId));
      if (content.revision >= revision) return content;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error("DB save timeout");
  }
  beforeAll(async () => {
    container = await new PostgreSqlContainer(
      process.env.TEST_POSTGRES_IMAGE ?? "postgres:17-alpine",
    ).start();
    sql = postgres(container.getConnectionUri(), { max: 5 });
    database = drizzle(sql, { schema });
    await migrate(database, {
      migrationsFolder: fileURLToPath(new URL("../src/db/migrations", import.meta.url)),
    });
    await database.insert(schema.users).values(
      [owner, member, outsider].map((id) => ({
        id,
        name: "검증 사용자",
        email: id + "@example.test",
        passwordHash: "unused",
      })),
    );
    await database
      .insert(schema.workspaces)
      .values({ id: workspaceId, name: "검증", ownerId: owner });
    await database.insert(schema.workspaceMemberships).values([
      { workspaceId, userId: owner, role: "owner" },
      { workspaceId, userId: member, role: "member" },
    ]);
    await database
      .insert(schema.projects)
      .values({ id: projectId, workspaceId, name: "검증", creatorId: owner });
    await database
      .insert(schema.whiteboardDocuments)
      .values({ id: documentId, projectId, name: "검증", creatorId: owner });
    await database.insert(schema.whiteboardDocumentContents).values({ documentId });
    vi.doMock("@/db/client", () => ({ db: database }));
    const { createApplicationServer } = await import("@/server-app");
    ({ httpServer: server, collaboration } = createApplicationServer());
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("missing server port");
    url = "http://127.0.0.1:" + address.port;
    ownerToken = await signAccessToken({
      sub: owner,
      email: owner + "@example.test",
      sid: "integration",
      ver: 0,
    });
  }, 120000);
  afterAll(async () => {
    for (const client of clients) client.disconnect();
    try {
      await collaboration?.close();
    } finally {
      if (server?.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
      await sql?.end();
      await container?.stop();
      vi.doUnmock("@/db/client");
    }
  }, 30000);
  it("두 사용자의 도형·파일·삭제를 DB에 저장하고 재입장·HTTP 상세로 복원한다", async () => {
    const first = await connect(owner);
    const second = await connect(member);
    expect(await join(first)).toMatchObject({
      ok: true,
      savedRevision: 0,
      persistenceState: "clean",
    });
    expect(await join(second)).toMatchObject({ ok: true });
    const remote = new Promise<void>((resolve) =>
      second.once("whiteboard:scene:updated", (event) => {
        expect(event.elements[0].id).toBe("a");
        resolve();
      }),
    );
    const a = { id: "a", version: 1, versionNonce: 1, isDeleted: false, type: "rectangle" };
    const b = { ...a, id: "b", type: "image", fileId: "image" };
    const one = await first.timeout(5000).emitWithAck("whiteboard:scene:update", {
      documentId,
      clientUpdateId: randomUUID(),
      elements: [a],
    });
    expect(one.ok).toBe(true);
    await remote;
    const two = await second.timeout(5000).emitWithAck("whiteboard:scene:update", {
      documentId,
      clientUpdateId: randomUUID(),
      elements: [b],
      fileUpdates: {
        image: {
          id: "image",
          dataURL: "data:image/png;base64,AA==",
          mimeType: "image/png",
          created: 1,
          version: 0,
        },
      },
    });
    expect(two.ok).toBe(true);
    if (!two.ok) throw new Error("update rejected");
    const stored = await storedAtLeast(two.revision);
    expect(stored.canvasContent.elements.map((element) => element.id)).toEqual(["a", "b"]);
    expect(stored.canvasContent.files?.image.dataURL).toBe("data:image/png;base64,AA==");
    const deleted = await first.timeout(5000).emitWithAck("whiteboard:scene:update", {
      documentId,
      clientUpdateId: randomUUID(),
      elements: [{ ...a, version: 2, isDeleted: true }],
    });
    if (!deleted.ok) throw new Error("delete rejected");
    await storedAtLeast(deleted.revision);
    first.disconnect();
    second.disconnect();
    const reopened = await join(await connect(owner));
    expect(reopened).toMatchObject({
      ok: true,
      savedRevision: deleted.revision,
      whiteboardDocument: {
        canvasContent: { elements: [{ ...a, version: 2, isDeleted: true }, b] },
      },
    });
    const detail = await request(server)
      .get(path)
      .set("Authorization", "Bearer " + ownerToken);
    expect(detail.status).toBe(200);
    expect(detail.body.whiteboardDocument.revision).toBe(deleted.revision);
    expect(detail.body.whiteboardDocument.canvasContent.files.image.id).toBe("image");
  }, 20000);
  it("비멤버 입장을 거부하고 HTTP 삭제가 연결을 종료한다", async () => {
    expect(await join(await connect(outsider))).toMatchObject({
      ok: false,
      error: { code: "WORKSPACE_NOT_FOUND" },
    });
    const client = await connect(member);
    await join(client);
    const deletion = new Promise<void>((resolve) =>
      client.once("whiteboard:document:deleted", () => resolve()),
    );
    const result = await request(server)
      .delete(path)
      .set("Authorization", "Bearer " + ownerToken);
    expect(result.status).toBe(204);
    await deletion;
    expect(
      (
        await request(server)
          .get(path)
          .set("Authorization", "Bearer " + ownerToken)
      ).status,
    ).toBe(404);
  }, 10000);
});
