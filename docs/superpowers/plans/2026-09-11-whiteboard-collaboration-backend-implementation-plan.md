# 화이트보드 실시간 공동 편집 백엔드 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 캔버스 콘텐츠를 별도 테이블에 저장하고, 인증된 workspace 멤버가 Socket.IO Room에서 Excalidraw 요소를 공동 편집하며 최신 스냅샷을 자동 저장할 수 있게 한다.

**Architecture:** `whiteboard_document_contents`가 문서 메타데이터와 최신 캔버스 스냅샷을 분리한다. Socket.IO adapter는 인증·Room·이벤트 전파를 담당하고, 순수 element merge module과 Room manager가 동시성·presence·디바운스 저장을 숨긴다. V1은 단일 인스턴스 in-memory adapter를 사용하며 저장 adapter와 Socket.IO adapter seam을 유지한다.

**Tech Stack:** Node.js 20+, Express, Node HTTP Server, Socket.IO, TypeScript, Drizzle ORM, PostgreSQL, Zod, Vitest, Supertest, Socket.IO Client, pnpm.

**Spec:** `docs/superpowers/specs/2026-09-11-whiteboard-collaboration-backend-design.md`

## Global Constraints

- `whiteboard_documents`에는 문서 메타데이터·lifecycle만 두고 `canvas_content`는 `whiteboard_document_contents`로 이동한다.
- content row는 `document_id`, `canvas_content`, `revision`, `updated_at`을 가지며 parent와 같은 transaction에서 생성한다.
- 상세 조회에는 `canvasContent`, `revision`, `lastSavedAt`을 반환하고 목록 조회에는 캔버스 본문을 반환하지 않는다.
- `appState`는 공동 스냅샷에 저장하지 않고 `elements`를 중심으로 처리한다. `files`는 optional JSON으로 보존하되 1 MiB message limit을 적용한다.
- element merge는 `id`, `version`, `versionNonce`, `isDeleted`만 해석하고 나머지 Excalidraw 필드는 JSON으로 보존한다.
- Socket.IO handshake의 access token, join 시 workspace membership·active project·active document 검증, token 만료 시 disconnect를 적용한다.
- scene update는 `clientUpdateId`로 멱등 처리하고, presence·cursor는 volatile memory event로만 전파한다.
- 자동 저장은 500ms quiet debounce와 2초 max wait를 사용하며 DB에는 최신 snapshot만 남긴다.
- 저장은 `revision = expectedRevision` 조건부 update로 충돌을 감지하고, 성공한 콘텐츠 저장은 parent `updated_at`도 갱신한다.
- V1에서는 Socket.IO 기본 in-memory adapter를 사용하며 Valkey Pub/Sub adapter는 구현하지 않는다.
- frontend Excalidraw 화면, offline sync, history/restore, 별도 file object storage는 이번 계획에 포함하지 않는다.
- 기존 작업 트리의 미커밋 상세 조회 변경을 덮어쓰지 않고 새 content service와 연결한다.
- 사용자가 별도로 요청하기 전까지 commit·push·merge·PR을 실행하지 않는다.

---

### Task 1: 협업 의존성과 content 스키마·migration 추가

**Files:**
- Modify: `backend/package.json`
- Modify: `backend/pnpm-lock.yaml`
- Create: `backend/src/types/whiteboard.ts`
- Create: `backend/src/db/schema/whiteboard-document-contents.ts`
- Modify: `backend/src/db/schema/whiteboard-documents.ts`
- Modify: `backend/src/db/schema/index.ts`
- Modify: `backend/src/db/schema/relations.ts`
- Create: `backend/src/db/migrations/0004_whiteboard_document_contents.sql` 또는 `drizzle-kit generate`가 생성한 다음 migration 파일
- Modify: `backend/src/db/migrations/meta/0004_snapshot.json` 및 `backend/src/db/migrations/meta/_journal.json`
- Modify: `backend/tests/db-schema.test.ts`

**Interfaces:**
- Consumes: 기존 `whiteboardDocuments` parent schema와 현재 `canvas_content` JSONB
- Produces: `CanvasContent`, `WhiteboardElement`, `WhiteboardSnapshot` 타입과 `whiteboardDocumentContents` Drizzle table export

- [x] **Step 1: 새 schema export를 검증하는 실패 테스트를 작성한다.**

`backend/tests/db-schema.test.ts`에 다음 계약을 먼저 추가한다.

```ts
it("exports the whiteboard document contents table", () => {
  expect(schema.whiteboardDocumentContents).toBeDefined();
  expect(schema.whiteboardDocumentContents.documentId).toBeDefined();
  expect(schema.whiteboardDocumentContents.canvasContent).toBeDefined();
  expect(schema.whiteboardDocumentContents.revision).toBeDefined();
  expect(schema.whiteboardDocumentContents.updatedAt).toBeDefined();
});

it("stores canvas content outside the document metadata table", () => {
  expect(schema.whiteboardDocuments.canvasContent).toBeUndefined();
});
```

Run:

```bash
pnpm --dir backend test -- tests/db-schema.test.ts --reporter=dot
```

Expected: 새 export assertion이 실패한다. 기존 schema 테스트의 실패가 있으면 새 assertion과 구분한다.

- [x] **Step 2: canvas domain type과 content table을 추가한다.**

`backend/src/types/whiteboard.ts`에 다음 타입을 작성한다.

```ts
export interface WhiteboardElement {
  [key: string]: unknown;
  id: string;
  version: number;
  versionNonce: number;
  isDeleted: boolean;
}

export interface CanvasContent {
  elements: WhiteboardElement[];
  files?: Record<string, unknown>;
}

export interface WhiteboardSnapshot {
  canvasContent: CanvasContent;
  revision: number;
  lastSavedAt: Date;
}
```

`backend/src/db/schema/whiteboard-document-contents.ts`에는 다음 table을 추가한다.

```ts
export const whiteboardDocumentContents = pgTable("whiteboard_document_contents", {
  documentId: uuid("document_id")
    .primaryKey()
    .references(() => whiteboardDocuments.id, { onDelete: "cascade" }),
  canvasContent: jsonb("canvas_content")
    .$type<CanvasContent>()
    .notNull()
    .default({ elements: [] }),
  revision: bigint("revision", { mode: "number" }).notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
```

`whiteboard-documents.ts`에서는 `jsonb` import와 `canvasContent` column을 삭제한다. `schema/index.ts`에서 새 table을 export하고, relations에는 `whiteboardDocumentsRelations.content`와 `whiteboardDocumentContentsRelations.document` one-to-one 관계를 추가한다.

- [x] **Step 3: Socket.IO runtime과 test client 의존성을 추가한다.**

Run:

```bash
pnpm --dir backend add socket.io
pnpm --dir backend add -D socket.io-client
```

`backend/package.json`에는 `socket.io`를 dependency, `socket.io-client`를 devDependency로 남기고 `pnpm-lock.yaml` 변경을 함께 보존한다.

- [x] **Step 4: migration을 생성하고 기존 데이터를 옮기는 SQL을 검토한다.**

Run:

```bash
pnpm --dir backend db:generate
```

생성된 다음 migration을 기존 Drizzle metadata와 함께 확인하고, migration SQL에 다음 순서를 보장한다.

```sql
CREATE TABLE "whiteboard_document_contents" (
  "document_id" uuid PRIMARY KEY NOT NULL,
  "canvas_content" jsonb DEFAULT '{"elements": []}'::jsonb NOT NULL,
  "revision" bigint DEFAULT 0 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

INSERT INTO "whiteboard_document_contents" (
  "document_id", "canvas_content", "revision", "updated_at"
)
SELECT
  "id",
  CASE
    WHEN "canvas_content" = '{}'::jsonb THEN '{"elements": []}'::jsonb
    ELSE "canvas_content"
  END,
  0,
  "updated_at"
FROM "whiteboard_documents";

ALTER TABLE "whiteboard_documents" DROP COLUMN "canvas_content";
```

실제 생성 파일의 table·column·foreign key·snapshot 차이를 확인한다. 기존 parent row가 먼저 content row를 가지도록 `INSERT`가 `DROP COLUMN`보다 앞서야 한다.

- [x] **Step 5: schema test를 GREEN으로 확인한다.**

Run:

```bash
pnpm --dir backend test -- tests/db-schema.test.ts --reporter=dot
```

Expected: schema export, nullable soft-delete, 기존 모든 DB schema 테스트가 통과한다.

### Task 2: content persistence module과 기존 REST 상세·생성 흐름 연결

**Files:**
- Create: `backend/src/services/whiteboard-document-content.service.ts`
- Modify: `backend/src/services/whiteboard-document.service.ts`
- Modify: `backend/src/controllers/whiteboard-document.controller.ts` only if response mapping needs the new fields
- Modify: `backend/tests/whiteboard-document.test.ts`
- Create: `backend/tests/whiteboard-document-content.test.ts`

**Interfaces:**
- Consumes: `whiteboardDocumentContents`, `CanvasContent`, existing workspace/project/document access checks
- Produces: `normalizeCanvasContent`, `getWhiteboardDocumentContent`, `saveWhiteboardDocumentContent`, detail response with `revision`·`lastSavedAt`

- [x] **Step 1: content canonicalization과 persistence 실패 테스트를 작성한다.**

`backend/tests/whiteboard-document-content.test.ts`에 다음 pure behavior를 먼저 작성한다.

```ts
it("normalizes an empty legacy object to an empty element scene", () => {
  expect(normalizeCanvasContent({})).toEqual({ elements: [] });
});

it("preserves elements and files from a valid canvas content object", () => {
  const element = { id: "element-1", version: 1, versionNonce: 10, isDeleted: false };
  expect(normalizeCanvasContent({ elements: [element], files: { "file-1": {} } })).toEqual({
    elements: [element],
    files: { "file-1": {} },
  });
});
```

Mocked Drizzle tests는 `getWhiteboardDocumentContent(documentId)`가 명시적 projection으로 `canvasContent`, `revision`, `updatedAt`을 읽는지, `saveWhiteboardDocumentContent`가 content revision 조건과 parent updatedAt을 transaction에서 사용하는지 검증한다. `revision`이 기대값과 다르면 `{ status: "conflict" }`를 반환하는 실패 테스트도 작성한다.

Run:

```bash
pnpm --dir backend test -- tests/whiteboard-document-content.test.ts --reporter=dot
```

Expected: 아직 module이 없으므로 import 또는 behavior assertion이 실패한다.

- [x] **Step 2: canonicalization과 content service interface를 구현한다.**

`backend/src/services/whiteboard-document-content.service.ts`에 다음 interface를 구현한다.

```ts
export const EMPTY_CANVAS_CONTENT: CanvasContent = { elements: [] };

export function normalizeCanvasContent(value: unknown): CanvasContent;

export async function getWhiteboardDocumentContent(
  documentId: string,
): Promise<WhiteboardSnapshot>;

export interface SaveWhiteboardDocumentContentInput {
  documentId: string;
  canvasContent: CanvasContent;
  expectedRevision: number;
  revision: number;
}

export type SaveWhiteboardDocumentContentResult =
  | { status: "saved"; lastSavedAt: Date }
  | { status: "conflict" }
  | { status: "not_found" };

export async function saveWhiteboardDocumentContent(
  input: SaveWhiteboardDocumentContentInput,
): Promise<SaveWhiteboardDocumentContentResult>;
```

`normalizeCanvasContent`는 `{}` 또는 `elements`가 없는 legacy object를 `{ elements: [] }`로 만들고, `elements`가 배열이면 최소 element shape을 검증한다. 잘못된 DB JSON은 임의로 저장하지 않고 Error를 발생시킨다. `files`가 있으면 object로 보존한다.

`saveWhiteboardDocumentContent`는 transaction에서 active parent 확인 → content `revision = expectedRevision` 조건부 update → parent `updatedAt` update 순서를 사용한다. content update가 0 row면 `conflict`, active parent가 없으면 `not_found`, 성공 시 동일한 `now`를 content `updatedAt`과 parent `updatedAt`에 사용한다.

- [x] **Step 3: 생성 service를 parent/content transaction으로 바꾼다.**

`createWhiteboardDocument`가 parent insert 후 content insert를 같은 `tx`에서 실행하도록 수정한다.

```ts
await tx.insert(whiteboardDocumentContents).values({
  documentId: whiteboardDocument.id,
  canvasContent: EMPTY_CANVAS_CONTENT,
  revision: 0,
});
```

생성 응답 type은 parent metadata와 `canvasContent: EMPTY_CANVAS_CONTENT`, `revision: 0`, `lastSavedAt`을 조합한다. content insert가 실패하면 transaction 전체가 rollback되는지 test mock으로 확인한다.

- [x] **Step 4: 상세 조회를 content service projection에 연결한다.**

기존 `getWhiteboardDocument`의 membership → project → document 검증은 유지한다. active document 확인 후 `getWhiteboardDocumentContent(documentId)`를 호출해 다음을 반환한다.

```ts
type WhiteboardDocumentDetail = {
  id: string;
  projectId: string;
  name: string;
  creatorId: string;
  canvasContent: CanvasContent;
  revision: number;
  lastSavedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};
```

`deletedAt`과 content row의 내부 `documentId`는 응답에서 제외한다. 기존 상세 테스트의 parent row에 content query mock을 추가하고 `revision`, `lastSavedAt`, canonical empty content를 검증한다. 목록 query projection에는 content table이나 `canvasContent`를 추가하지 않는다.

- [x] **Step 5: content와 REST 집중 테스트를 GREEN으로 확인한다.**

Run:

```bash
pnpm --dir backend test -- tests/whiteboard-document-content.test.ts tests/whiteboard-document.test.ts --reporter=dot
```

Expected: content persistence, 생성 transaction, 상세 response, 기존 목록·이름 변경·soft delete 테스트가 통과한다.

### Task 3: Excalidraw 최소 요소 계약과 deterministic merge module 구현

**Files:**
- Create: `backend/src/realtime/whiteboard-element-merge.ts`
- Create: `backend/tests/whiteboard-element-merge.test.ts`
- Create: `backend/src/realtime/whiteboard-protocol.schema.ts`
- Create: `backend/tests/whiteboard-protocol.test.ts`

**Interfaces:**
- Consumes: `WhiteboardElement`, `CanvasContent`
- Produces: `mergeWhiteboardElements`, join/scene/presence Zod schemas와 parsed payload type

- [x] **Step 1: merge의 RED 테스트를 작성한다.**

`backend/tests/whiteboard-element-merge.test.ts`에 다음 케이스를 작성한다.

```ts
it("keeps independent changes from both users", () => {
  const current = [element("a", 1), element("b", 1)];
  const result = mergeWhiteboardElements(current, [element("a", 2), element("c", 1)]);

  expect(result.elements.map((item) => item.id)).toEqual(["a", "b", "c"]);
  expect(result.appliedElements.map((item) => item.id)).toEqual(["a", "c"]);
});

it("uses version and then versionNonce for the same element", () => {
  const current = [element("a", 3, 10)];
  expect(mergeWhiteboardElements(current, [element("a", 2, 99)]).elements[0]).toEqual(
    current[0],
  );
  expect(mergeWhiteboardElements(current, [element("a", 3, 11)]).elements[0].versionNonce).toBe(11);
});

it("keeps delete tombstones when they win", () => {
  const result = mergeWhiteboardElements([element("a", 1)], [element("a", 2, 1, true)]);
  expect(result.elements[0].isDeleted).toBe(true);
});
```

Run:

```bash
pnpm --dir backend test -- tests/whiteboard-element-merge.test.ts --reporter=dot
```

Expected: module이 없으므로 실패한다.

- [x] **Step 2: pure merge implementation을 작성한다.**

`mergeWhiteboardElements(current, incoming)`은 `Map<id, element>`으로 현재 순서를 보존한다. 현재 ID가 없으면 추가하고, incoming `version`이 크거나 동일 version에서 `versionNonce`가 크면 교체한다. 기존 element는 배열 위치를 유지하고 새 ID만 끝에 추가한다. incoming batch에 같은 ID가 여러 번 있어도 같은 규칙을 순서대로 적용한다.

반환값은 다음으로 고정한다.

```ts
{
  elements: WhiteboardElement[];
  appliedElements: WhiteboardElement[];
}
```

`appliedElements`는 요청 요소별 최종 canonical winner를 중복 ID 없이 반환한다.

- [x] **Step 3: Socket.IO payload schema RED 테스트를 작성한다.**

다음 입력을 검증한다.

- join은 workspace/project/document UUID를 모두 요구한다.
- scene update는 `documentId`, UUID `clientUpdateId`, element 배열을 요구한다.
- element는 `id`, non-negative integer `version`, non-negative integer `versionNonce`, boolean `isDeleted`를 요구한다.
- presence cursor는 유한한 x/y 또는 null이며 `activeElementIds`는 제한된 string array다.
- scene update 2,000개 초과와 잘못된 payload를 거부한다.

- [x] **Step 4: Zod schema와 protocol type을 구현한다.**

`backend/src/realtime/whiteboard-protocol.schema.ts`에 다음 export를 구현한다.

```ts
const whiteboardElementSchema = z
  .object({
    id: z.string().min(1).max(255),
    version: z.number().int().nonnegative(),
    versionNonce: z.number().int().nonnegative(),
    isDeleted: z.boolean(),
  })
  .passthrough();

export const whiteboardJoinPayloadSchema = z.object({
  workspaceId: z.uuid(),
  projectId: z.uuid(),
  documentId: z.uuid(),
});

export const whiteboardSceneUpdatePayloadSchema = z.object({
  documentId: z.uuid(),
  clientUpdateId: z.uuid(),
  elements: z.array(whiteboardElementSchema).max(2000),
});

export const whiteboardPresenceUpdatePayloadSchema = z.object({
  documentId: z.uuid(),
  cursor: z
    .object({ x: z.number().finite(), y: z.number().finite() })
    .nullable(),
  activeElementIds: z.array(z.string().min(1).max(255)).max(50),
});

export type WhiteboardJoinPayload = z.infer<typeof whiteboardJoinPayloadSchema>;
export type WhiteboardSceneUpdatePayload = z.infer<typeof whiteboardSceneUpdatePayloadSchema>;
export type WhiteboardPresenceUpdatePayload = z.infer<typeof whiteboardPresenceUpdatePayloadSchema>;
```

element object는 `.passthrough()`로 Excalidraw type-specific fields를 보존하되, 전체 Socket.IO server의 `maxHttpBufferSize`는 1 MiB로 설정한다.

- [x] **Step 5: pure module 테스트를 GREEN으로 확인한다.**

Run:

```bash
pnpm --dir backend test -- tests/whiteboard-element-merge.test.ts tests/whiteboard-protocol.test.ts --reporter=dot
```

Expected: merge 충돌 규칙과 payload validation 테스트가 통과한다.

### Task 4: JWT 만료 정보와 in-memory Room manager 구현

**Files:**
- Modify: `backend/src/lib/jwt.ts`
- Modify: `backend/tests/jwt.test.ts`
- Create: `backend/src/realtime/whiteboard-room-manager.ts`
- Create: `backend/tests/whiteboard-room-manager.test.ts`

**Interfaces:**
- Consumes: `WhiteboardSnapshot`, `mergeWhiteboardElements`, `saveWhiteboardDocumentContent`
- Produces: `WhiteboardRoomManager.join`, `updateScene`, `updatePresence`, `leave`, `closeDocument`, `close`

- [x] **Step 1: access token exp 회귀 테스트를 작성한다.**

`backend/tests/jwt.test.ts`에 `verifyAccessToken` 결과가 numeric `exp`를 포함하는지 검증한다. refresh token payload에는 `exp`를 외부 interface로 추가하지 않는다.

- [x] **Step 2: JWT access payload에 exp를 반환한다.**

`AccessTokenPayload`에 `exp: number`를 추가하고 `verifyAccessToken`이 jose payload의 `exp`를 검증해 반환하도록 한다. 기존 `sub`, `email`, `sid`, `type` 검증은 유지한다.

- [x] **Step 3: Room manager RED 테스트를 작성한다.**

`backend/tests/whiteboard-room-manager.test.ts`에 다음 behavior를 fake persistence와 fake timers로 검증한다.

- 첫 join은 전달된 DB snapshot으로 Room을 만들고 participant를 반환한다.
- 두 번째 join은 같은 Room의 최신 in-memory snapshot과 모든 participant를 반환한다.
- 독립 요소 update는 둘 다 유지되고 revision이 한 번 증가한다.
- 같은 `clientUpdateId` 재전송은 persistence·revision·broadcast 결과를 중복 생성하지 않는다.
- presence는 userId refcount를 유지하고 마지막 socket이 나갈 때만 leave 결과를 만든다.
- 500ms quiet debounce와 2초 max wait 뒤 save adapter가 호출된다.
- save 중 새 update는 이전 snapshot 이후 최신 revision을 다시 저장한다.
- `closeDocument`는 pending timer를 취소하고 연결된 socket ID와 삭제 상태를 반환한다.

Room manager 외부 dependency는 다음 형태로 주입한다.

```ts
interface WhiteboardRoomManagerDependencies {
  loadSnapshot: (documentId: string) => Promise<WhiteboardSnapshot>;
  saveSnapshot: (input: SaveWhiteboardDocumentContentInput) => Promise<SaveWhiteboardDocumentContentResult>;
  setTimeout?: typeof setTimeout;
  clearTimeout?: typeof clearTimeout;
}
```

- [x] **Step 4: Room manager를 구현한다.**

`WhiteboardRoomManager`는 `Map<documentId, RoomState>`와 socket-to-document map을 보유한다. RoomState에는 canonical `CanvasContent`, current revision, expected persisted revision, dirty state, save timer, save promise, recent `clientUpdateId` 결과, userId participant refcount를 둔다.

manager가 사용하는 참여자 type은 다음으로 고정한다.

```ts
export interface ParticipantIdentity {
  userId: string;
  name: string;
}
```

public method는 다음으로 고정한다.

```ts
join(socketId: string, identity: ParticipantIdentity, documentId: string, initial: WhiteboardSnapshot): Promise<JoinRoomResult>;
updateScene(socketId: string, input: WhiteboardSceneUpdatePayload): SceneUpdateResult;
updatePresence(socketId: string, input: WhiteboardPresenceUpdatePayload): PresenceUpdateResult;
leave(socketId: string): LeaveRoomResult | null;
closeDocument(documentId: string): CloseDocumentResult | null;
close(): Promise<void>;
```

scene update 전에는 socket이 해당 document Room에 join했는지 확인한다. accepted element 또는 `files` 변경이 있으면 Room revision을 1 증가시키고 dirty save를 예약한다. persistence result가 `conflict`이면 latest snapshot을 같은 element merge 규칙으로 Room에 rebase하고, dirty 상태를 유지한 채 exponential backoff로 저장을 재시도한다. 최신 snapshot을 읽을 수 없는 반복 실패는 adapter callback을 통해 sync-required 경계를 반환한다.

- [x] **Step 5: JWT·Room unit test를 GREEN으로 확인한다.**

Run:

```bash
pnpm --dir backend test -- tests/jwt.test.ts tests/whiteboard-room-manager.test.ts --reporter=dot
```

Expected: exp 검증과 Room lifecycle·merge·debounce 테스트가 통과한다.

### Task 5: Socket.IO collaboration adapter와 인증·이벤트 전파 연결

**Files:**
- Create: `backend/src/realtime/whiteboard-collaboration.ts`
- Create: `backend/tests/whiteboard-collaboration.test.ts`
- Modify: `backend/src/app.ts`
- Modify: `backend/src/server.ts`
- Modify: `backend/src/controllers/whiteboard-document.controller.ts`
- Modify: `backend/tests/whiteboard-document.test.ts`

**Interfaces:**
- Consumes: Socket.IO Server, JWT verification, existing `getWhiteboardDocument`, `getUserById`, content save service, `WhiteboardRoomManager`
- Produces: `createWhiteboardCollaborationServer(httpServer, dependencies?)`, `closeDocument(documentId)`, `close()`와 공개 Socket.IO events

- [x] **Step 1: collaboration integration RED 테스트와 fake dependencies를 작성한다.**

`backend/tests/whiteboard-collaboration.test.ts`는 Node `createServer`, `socket.io-client`, fake authorization·snapshot·save dependency를 사용한다. 다음 테스트를 먼저 작성한다.

- auth 없는 client가 `connect_error`와 `UNAUTHORIZED`를 받는다.
- 유효 token client가 join ack로 snapshot·revision·participants를 받는다.
- authorization dependency가 workspace/project/document 오류를 반환하면 join ack가 해당 code를 전달한다.
- 두 client가 같은 Room에 join한 후 scene update ack와 상대방 `whiteboard:scene:updated`를 받는다.
- presence update가 `whiteboard:presence:updated`로 전파되고 persistence에는 전달되지 않는다.
- update payload 오류는 `INVALID_PAYLOAD` ack를 반환한다.
- `closeDocument`가 `whiteboard:document:deleted`를 전파하고 Room client를 종료한다.

Run:

```bash
pnpm --dir backend test -- tests/whiteboard-collaboration.test.ts --reporter=dot
```

Expected: collaboration server module이 없어 실패한다.

- [x] **Step 2: Socket.IO server와 handshake authentication을 구현한다.**

`createWhiteboardCollaborationServer`는 다음 options를 사용한다.

```ts
interface AuthorizedWhiteboardJoin {
  whiteboardDocument: WhiteboardDocumentDetail;
  participant: ParticipantIdentity;
}

interface WhiteboardCollaborationDependencies {
  authorizeJoin: (input: WhiteboardJoinPayload & { userId: string }) => Promise<AuthorizedWhiteboardJoin>;
  saveSnapshot: (input: SaveWhiteboardDocumentContentInput) => Promise<SaveWhiteboardDocumentContentResult>;
  loadSnapshot: (documentId: string) => Promise<WhiteboardSnapshot>;
}

interface WhiteboardCollaborationServer {
  closeDocument(documentId: string): void;
  close(): Promise<void>;
}
```

기본 dependency는 기존 `getWhiteboardDocument`, `getUserById`, `saveWhiteboardDocumentContent`로 구성한다. Socket.IO `Server`에는 다음을 설정한다.

```ts
new Server(httpServer, {
  cors: { origin: getEnv().CORS_ORIGIN, credentials: true },
  maxHttpBufferSize: 1_048_576,
});
```

`io.use`에서 `socket.handshake.auth.accessToken`을 검증하고 `socket.data.user`에 `AccessTokenPayload`를 넣는다. `exp`까지 남은 시간에 timer를 설정해 만료 시 `AUTH_EXPIRED` disconnect를 유도한다.

- [x] **Step 3: join·scene·presence handlers를 구현한다.**

`whiteboard:join`은 payload schema parse → 기존 authorization dependency → 이전 Room leave → manager join → Socket.IO room join → join ack 순서를 사용한다. 같은 socket의 join 요청은 직렬화하며, 권한 검증이 실패하면 기존 Room을 유지한다.

`whiteboard:scene:update`는 schema parse → manager `updateScene` → sender ack → 다른 socket에 `whiteboard:scene:updated` broadcast 순서를 사용한다. Socket.IO ack callback이 없는 경우에도 process error가 발생하지 않도록 handler에서 optional callback을 처리한다.

`whiteboard:presence:update`는 schema parse → manager `updatePresence` → `socket.volatile.to(room).emit` 순서를 사용한다. presence에는 DB save를 호출하지 않는다.

이벤트 payload 이름은 spec의 다음 계약을 그대로 사용한다.

```text
whiteboard:join
whiteboard:scene:update
whiteboard:scene:updated
whiteboard:presence:update
whiteboard:presence:joined
whiteboard:presence:updated
whiteboard:presence:left
whiteboard:scene:saved
whiteboard:scene:save-failed
whiteboard:sync:required
whiteboard:document:deleted
```

- [x] **Step 4: room broadcast와 save result 전달을 구현한다.**

manager callback 또는 adapter event 결과를 사용해 join/leave, scene, presence, save 성공·실패를 올바른 Room에 전파한다. save 성공은 revision과 ISO `lastSavedAt`을 포함한다. revision conflict는 latest snapshot rebase와 재시도를 수행하면서 `whiteboard:scene:save-failed`와 `whiteboard:sync:required`를 보낸다. save-failed의 `code`는 payload 최상위에 둔다.

- [x] **Step 5: Express app에 document deleted notifier seam을 추가한다.**

`createApp(options?: { onWhiteboardDocumentDeleted?: (documentId: string) => void })`를 추가하고 기본값은 no-op으로 둔다. `deleteWhiteboardDocumentHandler`가 soft delete 성공 후 callback을 호출하도록 한다. 기존 delete permission·404·204 응답은 변경하지 않는다.

`server.ts`에서는 closure를 통해 collaboration server를 연결한다.

```ts
let collaborationServer: WhiteboardCollaborationServer | undefined;
const app = createApp({
  onWhiteboardDocumentDeleted: (documentId) => collaborationServer?.closeDocument(documentId),
});
const httpServer = createServer(app);
collaborationServer = createWhiteboardCollaborationServer(httpServer);
```

- [x] **Step 6: Socket.IO 통합 테스트를 GREEN으로 확인한다.**

Run:

```bash
pnpm --dir backend test -- tests/whiteboard-collaboration.test.ts tests/whiteboard-document.test.ts --reporter=dot
```

Expected: auth, join, scene broadcast, presence, deleted Room close와 기존 REST 테스트가 통과한다.

### Task 6: HTTP server lifecycle·graceful shutdown과 migration 검증

**Files:**
- Modify: `backend/src/server.ts`
- Modify: `backend/tests/app.test.ts` if app option behavior needs direct coverage
- Modify: `backend/tests/db-client.test.ts` only if new schema import changes the test fixture
- Modify: `backend/src/realtime/whiteboard-collaboration.ts` if close lifecycle needs finalization

**Interfaces:**
- Consumes: `createWhiteboardCollaborationServer`, `WhiteboardDocumentDeleted` callback
- Produces: Socket.IO가 붙은 Node HTTP server와 graceful close path

- [x] **Step 1: HTTP server가 Express app을 감싸도록 바꾼다.**

기존 `app.listen`을 `createServer(app).listen`으로 바꾼다. `SIGINT`·`SIGTERM` 처리에서 다음 순서를 보장한다.

1. collaboration `close()`로 dirty Room을 flush한다.
2. Socket.IO의 단일 close 경로가 연결과 Socket.IO가 attach된 HTTP server를 함께 닫는다.
3. 오류 시 logger 기록 후 exit code 1

개발·production start script의 entrypoint는 계속 `src/server.ts`·`dist/server.js`를 사용한다.

- [x] **Step 2: migration SQL과 schema snapshot을 정적 검증한다.**

Run:

```bash
rg -n 'whiteboard_document_contents|canvas_content|DROP COLUMN|INSERT INTO' backend/src/db/migrations backend/src/db/migrations/meta
pnpm --dir backend db:generate
```

이미 적용된 migration과 동일한 추가 migration이 생성되지 않는지 확인한다. migration은 기존 `canvas_content`를 복사한 뒤 parent column을 제거해야 한다.

- [x] **Step 3: 전체 backend 테스트를 실행한다.**

Run:

```bash
pnpm --dir backend test -- --reporter=dot
```

Expected: 기존 테스트와 신규 content·merge·Room·Socket.IO 테스트가 모두 통과한다.

### Task 7: 최종 품질 검증과 계획 문서 결과 기록

**Files:**
- Modify: `docs/superpowers/plans/2026-09-11-whiteboard-collaboration-backend-implementation-plan.md`
- Modify: `docs/superpowers/specs/2026-09-10-whiteboard-document-detail-read-design.md` only to add a follow-up link if the historical scope needs clarification
- Modify: `docs/superpowers/plans/2026-09-10-whiteboard-document-detail-read-implementation-plan.md` only to add a follow-up link if the historical scope needs clarification

**Interfaces:**
- Consumes: 모든 구현 task의 테스트·lint·build·migration 결과
- Produces: 실제 구현 결과와 남은 후속 작업이 기록된 계획 문서

- [x] **Step 1: backend lint·build·format·diff 검증을 실행한다.**

Run:

```bash
pnpm --dir backend lint
pnpm --dir backend build
pnpm --dir backend exec prettier --check src tests
git diff --check
```

기존 generated metadata formatting 이슈가 있으면 변경 파일 focused 결과와 분리해 기록하되, 새 source/test 파일은 모두 통과시킨다.

- [x] **Step 2: 요구사항 회귀 검토를 실행한다.**

다음을 diff와 테스트 결과로 확인한다.

- 목록 response에 `canvasContent`가 없다.
- 상세 response에 `revision`, `lastSavedAt`이 있고 `deletedAt`이 없다.
- workspace 멤버만 Socket.IO join할 수 있다.
- 문서 creator가 아닌 member도 scene update할 수 있다.
- 이름 변경·삭제 권한은 기존 owner/creator 규칙을 유지한다.
- soft delete 이후 Room이 닫히고 추가 저장이 발생하지 않는다.
- appState와 cursor가 DB에 저장되지 않는다.
- V1에서 Valkey collaboration adapter가 추가되지 않았다.

- [x] **Step 3: 계획 문서에 Implementation Results를 추가한다.**

다음 내용을 실제 값으로 기록한다.

```markdown
## Implementation Results

### 실제 변경 내용

- schema/migration, content service, merge module, Room manager, Socket.IO adapter, server lifecycle, tests를 기록한다.

### 계획과 달라진 점

- 계획과 동일한지, 다르면 이유와 영향 범위를 기록한다.

### 실행한 검증 명령과 결과

- 각 명령의 exit code, 테스트 파일 수, 테스트 수를 기록한다.

### 남은 후속 작업

- frontend Socket.IO client·Excalidraw onChange delta adapter
- 이미지 files object storage 또는 별도 file table
- multi-instance Valkey adapter·load test
```

- [x] **Step 4: 변경 파일과 미커밋 상태를 최종 점검한다.**

Run:

```bash
git status --short
git diff --stat
git diff --check
```

unrelated change가 포함되지 않았는지 확인하고 사용자가 요청하지 않은 commit·push·PR은 실행하지 않는다.

## Implementation Results

### 실제 변경 내용

- `whiteboard_document_contents` schema와 migration을 추가하고 기존 parent `canvas_content`를 content row로 backfill한 뒤 parent column을 제거했다. 생성·상세 조회·자동 저장은 분리된 content service를 사용하며, revision 조건부 저장에는 parent row lock을 적용했다.
- Excalidraw `elements`와 optional `files`를 JSONB에 보존하고 `appState`, cursor, presence는 저장하지 않는다. element `version`·`versionNonce`·tombstone 기반 merge, user-scoped `clientUpdateId` 멱등 처리를 추가했다.
- 단일 인스턴스 in-memory Room manager와 Socket.IO adapter를 구현했다. 인증·workspace/project/document 권한 검증, join 직렬화, scene/presence broadcast, soft delete Room 종료, token expiry timer, graceful shutdown을 연결했다.
- 500ms quiet debounce·2초 max wait, 저장 중 최신 revision 재저장, revision conflict rebase 및 exponential backoff 재시도, transient save failure 재시도를 구현했다.
- schema·content service·REST·merge·Room·Socket.IO·server lifecycle 회귀 테스트를 추가·갱신했다.

### 계획과 달라진 점

- Drizzle이 생성한 migration 이름은 계획의 예시 대신 `0004_greedy_shriek.sql`이 되었다. `db:generate` 재실행 시 추가 schema change가 생성되지 않는다.
- 충돌 시 수동 sync 경계만 두지 않고, 설계 문서의 동시성 요구사항에 맞춰 최신 snapshot을 자동 merge/rebase한 뒤 backoff로 재시도하도록 구현했다.
- 실제 Excalidraw `files` 보존을 위해 scene update payload와 broadcast에 optional `files`를 포함했다. 대용량 binary file object storage는 범위에서 제외했다.
- Socket.IO `io.close()`가 attach된 HTTP server까지 닫으므로 `server.ts`에서 별도 `httpServer.close()`를 호출하지 않는 단일 소유 경로로 정리했다.

### 실행한 검증 명령과 결과

- `pnpm --dir backend exec vitest run --silent=passed-only --reporter=dot`: exit 0, 26개 테스트 파일·324개 테스트 통과
- `pnpm --dir backend lint`: exit 0
- `pnpm --dir backend build`: exit 0
- `pnpm --dir backend db:generate`: exit 0, `No schema changes, nothing to migrate`
- `pnpm --dir backend exec prettier --check` 변경 source/test 범위: exit 0
- `pnpm --dir backend exec prettier --check src tests`: generated metadata 3개(`_journal.json`, `0000_snapshot.json`, `0004_snapshot.json`)의 기존 포맷 경고로 exit 1; source·test focused check는 통과했다.
- `git diff --check`: exit 0
- migration `rg` 정적 검토: content table 생성·기존 값 INSERT/backfill·parent `canvas_content` DROP·FK cascade를 확인했다.

### 남은 후속 작업

- frontend Socket.IO client와 Excalidraw `onChange(elements, appState, files)` delta adapter 연결
- 이미지·파일 규모 증가 시 object storage 또는 별도 file table로 분리
- multi-instance 운영 시 Valkey Pub/Sub 또는 Socket.IO adapter 연결 및 부하 테스트
- offline sync, history/restore, CRDT 수준의 장기 충돌 해결
- 배포 환경에서 `0004_greedy_shriek.sql` migration 적용 및 rollback 운영 절차 확정
