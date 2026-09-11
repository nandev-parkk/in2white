# 화이트보드 공동 편집 안정성 보강 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 단일 백엔드 인스턴스의 화이트보드 공동 편집에서 삭제·접속 경쟁, 동시 파일 변경, 저장 장애, 정상 종료 시 데이터 유실을 방지하고 공개 Socket.IO 계약과 자원 한도를 고정한다.

**Architecture:** `WhiteboardCollaboration`을 외부에는 `documentDeleted()`와 `close()`만 노출하는 깊은 모듈로 유지한다. 내부에서는 generation 기반 lifecycle fence, typed Socket.IO adapter, element/file canonical merge, Room별 persistence state machine을 분리하고 PostgreSQL compare-and-save adapter를 통해 최신 snapshot을 저장한다. HTTP 삭제와 application shutdown은 명시적으로 주입된 interface를 통해 공동 편집 모듈과 연결한다.

**Tech Stack:** Node.js 20+, TypeScript 5.9, Express 4, Socket.IO 4.8, Zod 4, Drizzle ORM, PostgreSQL, iovalkey, Vitest 5, Socket.IO Client, Testcontainers PostgreSQL, pnpm.

**Spec:** `docs/superpowers/specs/2026-09-11-whiteboard-collaboration-hardening-design.md`

## 발행 티켓

| Issue                                                     | 티켓                                                   | Blocked by    |
| --------------------------------------------------------- | ------------------------------------------------------ | ------------- |
| [#45](https://github.com/nandev-parkk/in2white/issues/45) | Excalidraw 파일 delta 병합과 캔버스 원자성 보장        | 없음          |
| [#46](https://github.com/nandev-parkk/in2white/issues/46) | 화이트보드 삭제와 접속 경쟁 조건 차단                  | 없음          |
| [#47](https://github.com/nandev-parkk/in2white/issues/47) | 화이트보드 콘텐츠 무결성과 migration 검증 강화         | 없음          |
| [#48](https://github.com/nandev-parkk/in2white/issues/48) | 자동 저장 장애와 revision conflict 복구 구현           | #45, #47      |
| [#49](https://github.com/nandev-parkk/in2white/issues/49) | Socket.IO 인증과 자원 제한 계약 강화                   | #45, #46, #48 |
| [#50](https://github.com/nandev-parkk/in2white/issues/50) | 정상 종료 시 최신 revision과 서버 자원 정리 보장       | #48, #49      |
| [#51](https://github.com/nandev-parkk/in2white/issues/51) | 화이트보드 공동 편집 안정성 통합 검증과 운영 문서 갱신 | #45~#50       |

모든 티켓은 `ready-for-agent` 상태로 발행했다. 현재 frontier는 #45, #46, #47이다.

## Global Constraints

- 백엔드 단일 인스턴스 V1만 구현하며 Valkey Pub/Sub adapter와 CRDT는 추가하지 않는다.
- `WhiteboardCollaboration`의 외부 interface는 `documentDeleted(documentId: string): void`와 `close(): Promise<void>`로 제한한다.
- 삭제와 draining 상태 전이는 첫 비동기 작업 전에 수행한다.
- scene update는 element 최대 2,000개, application payload 최대 1 MiB, transport 최대 1.5 MiB다.
- Room은 canonical element 최대 20,000개, canonical snapshot 최대 10 MiB, 고유 participant 최대 30명, socket 최대 60개다.
- scene update rate limit은 평균 20회/초·burst 40회, presence는 평균 30회/초·burst 60회다.
- 자동 저장은 기존 500ms quiet debounce와 2초 max wait를 유지한다.
- 저장 재시도는 500ms부터 최대 10초까지 full-jitter exponential backoff를 사용한다.
- 연속 conflict 3회 또는 일시 저장 실패 5회부터 Room을 blocked로 전환하지만 최대 10초 간격 재시도는 유지한다.
- application shutdown 전체 deadline은 20초이며 신규 connection·join·scene update를 받지 않는다.
- 상세 조회와 생성 응답의 `canvasContent`, `revision`, `lastSavedAt` additive field를 유지하고 목록에는 canvas 본문을 넣지 않는다.
- canvas JSON, data URL, access token, 사용자 개인정보를 로그에 기록하지 않는다.
- 기존 작업 트리의 미커밋 변경을 보존하고 unrelated 파일을 수정하지 않는다.
- 사용자가 별도로 요청하기 전에는 commit·push·merge·PR을 실행하지 않는다.

## 파일 구조

- `backend/src/types/whiteboard.ts`: 저장 snapshot과 Excalidraw element/file domain type.
- `backend/src/realtime/whiteboard-protocol.schema.ts`: client 입력 Zod schema와 parsed command type.
- `backend/src/realtime/whiteboard-socket.events.ts`: Socket.IO client/server/inter-server/socket-data event map.
- `backend/src/realtime/whiteboard-file-merge.ts`: version 기반 file delta 병합.
- `backend/src/realtime/whiteboard-scene.ts`: element `Map`·order와 file map을 소유하는 canonical scene.
- `backend/src/realtime/whiteboard-rate-limiter.ts`: socket별 token bucket.
- `backend/src/realtime/whiteboard-document-lifecycle.ts`: pending join generation과 global draining fence.
- `backend/src/realtime/whiteboard-room-manager.ts`: participant, idempotency, persistence 상태 머신, drain.
- `backend/src/realtime/whiteboard-collaboration.ts`: 인증·Socket.IO adapter와 내부 모듈 조립.
- `backend/src/services/whiteboard-document-content.service.ts`: PostgreSQL snapshot load와 compare-and-save.
- `backend/src/services/whiteboard-document.service.ts`: 권한 검증 및 parent/content 일관 조회.
- `backend/src/app.ts`, `backend/src/routes/index.ts`, `backend/src/routes/whiteboard-document.routes.ts`, `backend/src/controllers/whiteboard-document.controller.ts`: 삭제 hook의 명시적 주입.
- `backend/src/db/client.ts`, `backend/src/cache/valkey.ts`, `backend/src/server.ts`: 재진입 가능한 application shutdown과 자원 종료.
- `backend/tests/whiteboard-*.test.ts`: 순수 모듈, Room, Socket.IO, HTTP, shutdown 회귀 테스트.
- `backend/tests/whiteboard-migration.integration.test.ts`: 실제 PostgreSQL에서 0004 backfill 검증.

---

### Task 1: Excalidraw file 계약과 canonical scene 모듈

**Files:**

- Modify: `backend/src/types/whiteboard.ts`
- Modify: `backend/src/realtime/whiteboard-protocol.schema.ts`
- Create: `backend/src/realtime/whiteboard-file-merge.ts`
- Create: `backend/src/realtime/whiteboard-scene.ts`
- Modify: `backend/src/realtime/whiteboard-element-merge.ts`
- Modify: `backend/tests/whiteboard-protocol.test.ts`
- Create: `backend/tests/whiteboard-file-merge.test.ts`
- Create: `backend/tests/whiteboard-scene.test.ts`
- Modify: `backend/tests/whiteboard-element-merge.test.ts`

**Interfaces:**

- Consumes: 기존 `WhiteboardElement`, `mergeWhiteboardElements()`의 version/versionNonce 규칙.
- Produces: `WhiteboardFile`, `WhiteboardFileUpdates`, `mergeWhiteboardFiles()`, `WhiteboardScene.applyUpdate()`, `fileUpdates` 기반 scene payload.

- [x] **Step 1: file schema와 병합 규칙의 실패 테스트를 작성한다.**

`backend/tests/whiteboard-protocol.test.ts`와 `backend/tests/whiteboard-file-merge.test.ts`에 다음 계약을 추가한다.

```ts
const file = {
  id: "file-1",
  mimeType: "image/png",
  dataURL: "data:image/png;base64,AA==",
  created: 1,
  version: 1,
};

it("requires the file map key to match file.id", () => {
  expect(
    whiteboardSceneUpdatePayloadSchema.safeParse({
      documentId,
      clientUpdateId,
      elements: [],
      fileUpdates: { "another-id": file },
    }).success,
  ).toBe(false);
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
```

필수 필드 누락, 음수 `version`·`lastRetrieved`, 높은 version 교체, version 생략 시 0, legacy 현재 entry를 -1로 취급하는 경우, `lastRetrieved`만 바뀐 no-op도 각각 검증한다.

Run:

```bash
pnpm --dir backend test -- tests/whiteboard-protocol.test.ts tests/whiteboard-file-merge.test.ts --reporter=dot
```

Expected: `WhiteboardFile`, `fileUpdates`, `mergeWhiteboardFiles`가 없어 RED가 된다.

- [x] **Step 2: file domain type, 입력 schema, 원자적 merge를 구현한다.**

`backend/src/types/whiteboard.ts`의 file 계약을 다음으로 고정한다.

```ts
export interface WhiteboardFile {
  [key: string]: unknown;
  id: string;
  mimeType: string;
  dataURL: string;
  created: number;
  lastRetrieved?: number;
  version?: number;
}

export type WhiteboardFiles = Record<string, WhiteboardFile>;
export type WhiteboardFileUpdates = Record<string, WhiteboardFile>;
```

`CanvasContent.files`는 `WhiteboardFiles`로 바꾼다. Zod의 `superRefine`에서 record key와 `file.id` 일치를 검사하고 scene payload의 기존 `files`를 `fileUpdates`로 교체한다.

`mergeWhiteboardFiles()` 반환 type은 다음을 사용한다.

```ts
export type WhiteboardFileMergeResult =
  | {
      status: "merged";
      files: WhiteboardFiles;
      appliedFiles: WhiteboardFileUpdates;
      changed: boolean;
    }
  | { status: "conflict"; fileId: string };
```

모든 update를 임시 map에 검증한 뒤 한 번에 반환하여 한 entry가 충돌하면 아무 entry도 적용하지 않는다. `dataURL`과 `mimeType`은 binary identity로 비교하고 `lastRetrieved` 단독 변경은 canonical 변경으로 보지 않는다.

- [x] **Step 3: Map/order 기반 scene의 실패 테스트를 작성한다.**

`backend/tests/whiteboard-scene.test.ts`에서 다음을 검증한다.

```ts
it("does not increment the revision for a stale no-op update", () => {
  const scene = WhiteboardScene.fromSnapshot(snapshotWith(element("a", 2)));
  const result = scene.applyUpdate({
    elements: [element("a", 1)],
    fileUpdates: {},
  });

  expect(result).toMatchObject({ status: "noop", revision: 0 });
  expect(scene.toSnapshot().canvasContent.elements).toEqual([element("a", 2)]);
});

it("keeps concurrent files from separate updates", () => {
  const scene = WhiteboardScene.fromSnapshot(emptySnapshot);
  scene.applyUpdate({ elements: [], fileUpdates: { "file-1": file1 } });
  scene.applyUpdate({ elements: [], fileUpdates: { "file-2": file2 } });

  expect(Object.keys(scene.toSnapshot().canvasContent.files ?? {})).toEqual([
    "file-1",
    "file-2",
  ]);
});
```

기존 element 순서, 새 ID append, tombstone, 동일 update 안 중복 ID, file conflict 시 element도 적용되지 않는 원자성을 포함한다.

Run:

```bash
pnpm --dir backend test -- tests/whiteboard-scene.test.ts --reporter=dot
```

Expected: `WhiteboardScene` import가 없어 RED가 된다.

- [x] **Step 4: canonical scene을 구현하고 기존 merge를 연결한다.**

`WhiteboardScene`은 외부에 다음 interface만 제공한다.

```ts
export class WhiteboardScene {
  static fromSnapshot(snapshot: WhiteboardSnapshot): WhiteboardScene;
  applyUpdate(input: {
    elements: WhiteboardElement[];
    fileUpdates?: WhiteboardFileUpdates;
  }):
    | {
        status: "updated";
        revision: number;
        elements: WhiteboardElement[];
        fileUpdates?: WhiteboardFileUpdates;
      }
    | { status: "noop"; revision: number }
    | { status: "file_conflict"; revision: number; fileId: string };
  mergeSnapshot(snapshot: WhiteboardSnapshot): {
    changed: boolean;
    snapshot: WhiteboardSnapshot;
  };
  setPersisted(lastSavedAt: Date, persistedRevision: number): void;
  get revision(): number;
  get persistedRevision(): number;
  toSnapshot(): WhiteboardSnapshot;
  serializedSize(): number;
  elementCount(): number;
}
```

내부는 `Map<string, WhiteboardElement>`, element order 배열, `WhiteboardFiles`를 사용한다. candidate element/file merge와 제한 검증이 모두 성공한 뒤 내부 map을 교체한다.
`mergeWhiteboardElements()`의 `appliedElements`는 요청에 포함됐다는 이유만으로 현재 winner를 반환하지 않고, 실제 canonical 값을 추가하거나 교체한 element만 반환하도록 고친다. 따라서 stale element와 동일 file은 ack에는 최신 revision만 남고 broadcast delta에는 포함되지 않는다.

- [x] **Step 5: Task 1 집중 테스트를 GREEN으로 확인한다.**

Run:

```bash
pnpm --dir backend test -- tests/whiteboard-element-merge.test.ts tests/whiteboard-file-merge.test.ts tests/whiteboard-scene.test.ts tests/whiteboard-protocol.test.ts --reporter=dot
```

Expected: file delta, no-op, 원자적 scene merge 테스트가 모두 통과한다.

### Task 2: 자원 제한과 lifecycle fence

**Files:**

- Create: `backend/src/realtime/whiteboard-limits.ts`
- Create: `backend/src/realtime/whiteboard-rate-limiter.ts`
- Create: `backend/src/realtime/whiteboard-document-lifecycle.ts`
- Create: `backend/tests/whiteboard-rate-limiter.test.ts`
- Create: `backend/tests/whiteboard-document-lifecycle.test.ts`
- Modify: `backend/tests/whiteboard-scene.test.ts`

**Interfaces:**

- Consumes: Task 1의 `WhiteboardScene.serializedSize()`와 element count.
- Produces: 한도 상수, `TokenBucket.consume()`, generation 기반 `WhiteboardDocumentLifecycle`.

- [x] **Step 1: token bucket과 aggregate limit RED 테스트를 작성한다.**

```ts
it("allows the burst and rejects the next event", () => {
  const bucket = new TokenBucket({
    ratePerSecond: 20,
    burst: 40,
    now: () => now,
  });
  expect(
    Array.from({ length: 40 }, () => bucket.consume()).every(Boolean),
  ).toBe(true);
  expect(bucket.consume()).toBe(false);
  now += 50;
  expect(bucket.consume()).toBe(true);
});
```

`whiteboard-scene.test.ts`에는 20,001번째 새 element 거부, 기존 element 수정 허용, 10 MiB 초과 candidate 전체 거부를 추가한다. 테스트 fixture는 큰 data URL을 사용하되 실패 로그에 내용을 출력하지 않는다.

- [x] **Step 2: 한도와 token bucket을 구현한다.**

`whiteboard-limits.ts`는 다음 숫자를 단일 source로 export한다.

```ts
export const WHITEBOARD_LIMITS = {
  applicationPayloadBytes: 1_048_576,
  transportPayloadBytes: 1_572_864,
  elementsPerUpdate: 2_000,
  elementsPerRoom: 20_000,
  snapshotBytesPerRoom: 10_485_760,
  participantsPerRoom: 30,
  socketsPerRoom: 60,
  sceneRatePerSecond: 20,
  sceneBurst: 40,
  presenceRatePerSecond: 30,
  presenceBurst: 60,
} as const;
```

`TokenBucket`은 monotonic millisecond clock을 주입받고 elapsed time만큼 token을 채운다. wall clock이 뒤로 가면 elapsed를 0으로 취급한다.

- [x] **Step 3: stale join/delete 경쟁의 RED 테스트를 작성한다.**

`backend/tests/whiteboard-document-lifecycle.test.ts`에 authorization이 pending인 ticket을 만든 뒤 삭제하는 결정적 테스트를 작성한다.

```ts
it("invalidates a join that started before deletion", () => {
  const lifecycle = new WhiteboardDocumentLifecycle();
  const ticket = lifecycle.beginJoin(documentId);

  lifecycle.documentDeleted(documentId);

  expect(lifecycle.commitJoin(ticket, () => undefined)).toEqual({
    status: "deleted",
  });
  lifecycle.releaseJoin(ticket);
});
```

동시 ticket 모두 무효화, pending 해제 후 entry cleanup, draining 이후 `beginJoin`·`commitJoin` 거부, callback은 유효한 ticket에서 정확히 한 번 동기 실행되는 경우도 검증한다.

- [x] **Step 4: generation lifecycle fence를 구현한다.**

```ts
export interface JoinTicket {
  readonly documentId: string;
  readonly generation: number;
  readonly id: symbol;
}

export class WhiteboardDocumentLifecycle {
  beginJoin(documentId: string): JoinTicket | { status: "draining" };
  commitJoin<T>(
    ticket: JoinTicket,
    register: () => T,
  ): { status: "joined"; value: T } | { status: "deleted" | "draining" };
  releaseJoin(ticket: JoinTicket): void;
  documentDeleted(documentId: string): void;
  startDraining(): void;
  get draining(): boolean;
}
```

`documentDeleted()`와 `startDraining()`은 동기 메서드다. deletion entry는 해당 generation의 pending ticket이 모두 release된 뒤 제거한다.

- [x] **Step 5: Task 2 집중 테스트를 GREEN으로 확인한다.**

Run:

```bash
pnpm --dir backend test -- tests/whiteboard-rate-limiter.test.ts tests/whiteboard-document-lifecycle.test.ts tests/whiteboard-scene.test.ts --reporter=dot
```

Expected: 시간 기반 refill, Room aggregate 제한, 모든 lifecycle 순서 테스트가 통과한다.

### Task 3: persistence 결과와 REST 데이터 일관성

**Files:**

- Modify: `backend/src/services/whiteboard-document-content.service.ts`
- Modify: `backend/src/services/whiteboard-document.service.ts`
- Modify: `backend/src/constants/messages.ts`
- Modify: `backend/tests/whiteboard-document-content.test.ts`
- Modify: `backend/tests/whiteboard-document.test.ts`

**Interfaces:**

- Consumes: `whiteboardDocuments`, `whiteboardDocumentContents`, Task 1의 strict domain normalization.
- Produces: `SaveWhiteboardDocumentContentResult`의 `content_missing`, 한 statement 상세 조회, `CONTENT_INTEGRITY_ERROR` HTTP 계약.

- [x] **Step 1: save 결과 구분의 RED 테스트를 작성한다.**

`backend/tests/whiteboard-document-content.test.ts`에서 조건부 content update가 0 row인 뒤 active content row를 재확인하는 transaction mock을 구성한다.

```ts
it.each([
  [{ contentExists: true }, { status: "conflict" }],
  [{ contentExists: false }, { status: "content_missing" }],
])("distinguishes conflict from missing content", async (fixture, expected) => {
  arrangeConditionalUpdateMiss(fixture);
  await expect(saveWhiteboardDocumentContent(input)).resolves.toEqual(expected);
});
```

active parent가 없을 때는 기존 `{ status: "not_found" }`를 유지하고 parent `updated_at`을 건드리지 않는지 검증한다.

- [x] **Step 2: compare-and-save adapter를 보강한다.**

결과 union을 다음으로 바꾼다.

```ts
export type SaveWhiteboardDocumentContentResult =
  | { status: "saved"; lastSavedAt: Date }
  | { status: "conflict" }
  | { status: "not_found" }
  | { status: "content_missing" };
```

active parent row lock 후 조건부 update가 실패하면 같은 transaction에서 content row의 존재 여부를 조회한다. row가 있으면 conflict, 없으면 content_missing을 반환한다.

- [x] **Step 3: 상세 조회 single-statement 계약의 RED 테스트를 작성한다.**

`backend/tests/whiteboard-document.test.ts`에서 membership, project 검증 뒤 document와 content를 한 번의 joined select로 읽는지 검증한다. active parent는 있으나 joined content가 null인 fixture는 다음 오류를 기대한다.

```ts
await expect(getWhiteboardDocument(input)).rejects.toMatchObject({
  statusCode: 500,
  code: "CONTENT_INTEGRITY_ERROR",
});
```

soft-deleted document, 다른 project document, membership 없음의 기존 404 위장 계약도 그대로 유지한다.

- [x] **Step 4: 상세 조회를 parent/content join으로 변경한다.**

`getWhiteboardDocument()`는 membership과 active project 확인 후 `whiteboardDocuments`를 `whiteboardDocumentContents`와 left join하고 필요한 field를 명시적으로 projection한다. parent 미존재는 `WHITEBOARD_DOCUMENT_NOT_FOUND`, parent는 있으나 content projection이 null이면 구조화 로그 후 `CONTENT_INTEGRITY_ERROR`를 던진다. 응답 shape과 생성 응답의 additive field는 바꾸지 않는다.

- [x] **Step 5: Task 3 집중 테스트를 GREEN으로 확인한다.**

Run:

```bash
pnpm --dir backend test -- tests/whiteboard-document-content.test.ts tests/whiteboard-document.test.ts --reporter=dot
```

Expected: saved/conflict/not_found/content_missing 분기와 REST 권한·오류 계약이 통과한다.

### Task 4: Room persistence 상태 머신과 drain

**Files:**

- Modify: `backend/src/realtime/whiteboard-room-manager.ts`
- Modify: `backend/tests/whiteboard-room-manager.test.ts`

**Interfaces:**

- Consumes: Task 1의 `WhiteboardScene`, Task 2의 Room 한도, Task 3의 네 가지 save 결과.
- Produces: 명시적 persistence 상태, blocked/recovered/deleted/failed event, deadline-aware `close()`.

- [x] **Step 1: 상태 전이와 no-op RED 테스트를 작성한다.**

다음 결과를 개별 테스트로 고정한다.

```ts
expect(manager.updateScene(socketId, staleUpdate)).toMatchObject({
  status: "noop",
  revision: 1,
});
expect(saveSnapshot).not.toHaveBeenCalled();
expect(onRoomEvent).not.toHaveBeenCalledWith(
  expect.objectContaining({ status: "scene_updated" }),
);
```

- 저장 중 새 update가 들어오면 첫 save 직후 최신 revision을 다시 저장한다.
- conflict rebase event의 snapshot에는 DB element와 미저장 local element/file이 모두 있다.
- conflict 3회 또는 transient failure 5회면 blocked가 되고 신규 update는 `persistence_unavailable`이다.
- blocked 상태에서도 재시도는 계속되고 성공하면 `recovered`와 `saved`가 발생한다.
- `not_found`는 deleted, `content_missing`은 failed로 전이하고 socket ID를 반환해 종료할 수 있게 한다.

Run:

```bash
pnpm --dir backend test -- tests/whiteboard-room-manager.test.ts --reporter=dot
```

Expected: 기존 boolean `dirty` 중심 구현이 상태·한도·terminal 결과를 표현하지 못해 RED가 된다.

- [x] **Step 2: Room state와 command 결과 type을 명시적으로 변경한다.**

```ts
export type PersistenceState =
  "clean" | "dirty" | "saving" | "retrying" | "blocked" | "deleted" | "failed";

export type SceneUpdateResult =
  | {
      status: "updated" | "duplicate" | "noop";
      documentId: string;
      revision: number; /* canonical delta */
    }
  | { status: "file_version_conflict"; documentId: string; fileId: string }
  | { status: "room_size_limit_exceeded"; documentId: string }
  | { status: "persistence_unavailable"; documentId: string }
  | { status: "server_draining"; documentId: string }
  | { status: "document_room_mismatch" | "not_joined"; documentId: string };
```

Room의 `canvasContent`, `revision`, `persistedRevision`, `dirty` 중복 상태를 `WhiteboardScene`과 `PersistenceState`로 대체한다. participant 고유 사용자 30명과 socket 60개는 join mutation 전에 검사한다.

- [x] **Step 3: retry와 conflict rebase를 구현한다.**

constructor dependency에 `random?: () => number`, `now?: () => number`, timer 함수를 주입한다. 재시도 지연은 다음으로 계산한다.

```ts
const cap = Math.min(500 * 2 ** attempt, 10_000);
const retryDelay = Math.floor(random() * (cap + 1));
```

save promise는 Room마다 하나만 둔다. conflict면 최신 DB snapshot을 load하고 canonical scene과 병합한 뒤 `sync_required` event를 먼저 내보내고 새 expected revision으로 재시도한다. 일반 load 장애에는 snapshot event를 보내지 않는다. terminal 결과는 timer와 socket index를 정리한다.

Room manager는 logger의 `info`, `warn`, `error`만 받는 dependency를 두고 persistence state 전이, revision/persistedRevision, 재시도 횟수·지연, terminal 전이만 구조화 로그로 기록한다. snapshot, element, file, 사용자 정보는 logger argument에 넣지 않는다.

- [x] **Step 4: deadline-aware drain RED 테스트와 구현을 진행한다.**

```ts
it("persists an update received during the in-flight save before close resolves", async () => {
  const firstSave = deferred<SaveResult>();
  arrangeFirstSave(firstSave.promise);
  manager.updateScene(socketId, firstUpdate);
  await startScheduledSave();
  manager.updateScene(socketId, secondUpdate);

  const closing = manager.close({ deadlineAt: now() + 20_000 });
  firstSave.resolve(savedAtRevision1);
  await closing;

  expect(saveSnapshot).toHaveBeenLastCalledWith(
    expect.objectContaining({ revision: 2 }),
  );
});
```

`close({ deadlineAt })`는 첫 호출에서 `draining`을 동기 설정하고 같은 Promise를 재사용한다. in-flight save를 기다린 뒤 `persistedRevision === revision`까지 직접 flush한다. drain retry delay는 정상 지연, 2초, 남은 deadline 중 최솟값이다. deadline 초과 시 dirty Room의 document/revision만 담은 `WhiteboardDrainError`를 throw하고 canvas 본문은 포함하지 않는다.

- [x] **Step 5: Task 4 집중 테스트를 GREEN으로 확인한다.**

Run:

```bash
pnpm --dir backend test -- tests/whiteboard-room-manager.test.ts --reporter=dot
```

Expected: 저장 상태 전이, 복구, terminal cleanup, 최신 revision drain 테스트가 통과한다.

### Task 5: typed Socket.IO adapter, 인증 만료, rate/payload 계약

**Files:**

- Create: `backend/src/realtime/whiteboard-socket.events.ts`
- Modify: `backend/src/realtime/whiteboard-collaboration.ts`
- Modify: `backend/tests/whiteboard-collaboration.test.ts`

**Interfaces:**

- Consumes: Task 2의 lifecycle/token bucket, Task 4의 Room manager command와 event.
- Produces: 완전한 Socket.IO event map과 외부 `WhiteboardCollaboration` interface.

- [x] **Step 1: typed event map을 정의하고 compile-time cast 제거 범위를 고정한다.**

```ts
export interface WhiteboardClientToServerEvents {
  "whiteboard:join": (
    payload: WhiteboardJoinPayload,
    ack: WhiteboardJoinAck,
  ) => void;
  "whiteboard:scene:update": (
    payload: WhiteboardSceneUpdatePayload,
    ack: WhiteboardSceneAck,
  ) => void;
  "whiteboard:presence:update": (
    payload: WhiteboardPresenceUpdatePayload,
  ) => void;
}

export interface WhiteboardServerToClientEvents {
  "whiteboard:scene:updated": (event: WhiteboardSceneUpdatedEvent) => void;
  "whiteboard:scene:saved": (event: WhiteboardSceneSavedEvent) => void;
  "whiteboard:scene:save-failed": (event: WhiteboardSaveFailedEvent) => void;
  "whiteboard:sync:required": (event: WhiteboardSyncRequiredEvent) => void;
  "whiteboard:room:recovered": (event: WhiteboardRoomRecoveredEvent) => void;
  "whiteboard:document:deleted": (event: { documentId: string }) => void;
  "whiteboard:auth:expired": (event: { code: "AUTH_EXPIRED" }) => void;
  "whiteboard:error": (event: WhiteboardProtocolError) => void;
  "whiteboard:presence:joined": (event: WhiteboardPresenceJoinedEvent) => void;
  "whiteboard:presence:updated": (
    event: WhiteboardPresenceUpdatedEvent,
  ) => void;
  "whiteboard:presence:left": (event: WhiteboardPresenceLeftEvent) => void;
}
```

`SocketData`에는 verified user, expiry timer, scene/presence bucket, 현재 document ID만 둔다. `unknown`은 transport boundary의 raw payload에서만 허용하고 parse 이후 cast하지 않는다.

외부 interface는 다음으로 고정한다.

```ts
export interface WhiteboardCollaboration {
  documentDeleted(documentId: string): void;
  close(): Promise<void>;
}
```

- [x] **Step 2: 삭제 중 pending authorization 경쟁과 draining RED 테스트를 작성한다.**

`authorizeJoin` deferred promise를 사용한다.

```ts
const joining = join(client);
await authorizationStarted;
collaboration.documentDeleted(documentId);
authorization.resolve(authorizedJoin);

await expect(joining).resolves.toMatchObject({
  ok: false,
  error: { code: "WHITEBOARD_DOCUMENT_NOT_FOUND" },
});
expect(managerRoomWasCreated()).toBe(false);
```

`close()` 호출 직후 신규 connection·join·scene update가 `SERVER_DRAINING`으로 거부되는 테스트도 추가한다.

- [x] **Step 3: lifecycle fence를 Socket.IO join에 연결한다.**

join 시작 때 ticket을 만들고 authorization을 비동기로 수행한다. 성공 후 `commitJoin(ticket, () => manager.join(...))` callback 안에서만 Room participant를 등록한다. 모든 성공·실패·disconnect 경로에서 `releaseJoin(ticket)`을 `finally`로 호출한다. `documentDeleted()`는 lifecycle generation을 먼저 올린 뒤 Room terminal 처리와 socket event/disconnect를 실행한다.

- [x] **Step 4: payload, rate, capacity, auth expiry RED 테스트를 작성한다.**

다음 오류 코드를 실제 client ack/event로 검증한다.

- 1 MiB 초과 handler payload: `PAYLOAD_TOO_LARGE`
- scene burst 41번째: `RATE_LIMITED`
- participant 31번째: `ROOM_CAPACITY_EXCEEDED`
- socket 61번째: `ROOM_SOCKET_CAPACITY_EXCEEDED`
- file same-version conflict: `FILE_VERSION_CONFLICT`
- 10 MiB candidate: `ROOM_SIZE_LIMIT_EXCEEDED`
- blocked Room: `PERSISTENCE_UNAVAILABLE`
- presence invalid/rate 초과: cooldown당 `whiteboard:error` 한 번, event broadcast 없음
- token expiry: `whiteboard:auth:expired` 후 server disconnect

`maxHttpBufferSize`가 1.5 MiB로 설정되는지 server option 또는 1.5 MiB 초과 연결 종료 테스트로 고정한다.

- [x] **Step 5: transport adapter를 구현한다.**

`Server<WhiteboardClientToServerEvents, WhiteboardServerToClientEvents, WhiteboardInterServerEvents, WhiteboardSocketData>`를 사용한다. raw payload의 `Buffer.byteLength(JSON.stringify(rawPayload), "utf8")`를 schema parse 전에 검사하되 stringify 실패는 `INVALID_PAYLOAD`로 처리한다. Room manager 결과를 중앙 `toProtocolError()` 함수에서 오류 코드로 변환한다.

presence의 반복 오류 cooldown은 socket·오류 코드별 1초로 고정한다. `not_found` Room event를 받으면 누락된 HTTP hook에 대한 방어선으로 `documentDeleted(documentId)` 경로를 호출하고, `content_missing`이면 integrity event 전파와 socket 종료 후 Room 제거를 완료한다.

auth expiry timer callback은 다음 순서를 지킨다.

```ts
socket.emit("whiteboard:auth:expired", { code: "AUTH_EXPIRED" });
socket.disconnect(true);
```

save event는 saved/conflict/blocked/recovered/deleted/failed를 typed event로 변환한다. conflict의 `sync:required`에는 merged canonical snapshot을 필수로 넣는다.

- [x] **Step 6: Task 5 집중 테스트와 TypeScript build를 GREEN으로 확인한다.**

Run:

```bash
pnpm --dir backend test -- tests/whiteboard-collaboration.test.ts --reporter=dot
pnpm --dir backend build
```

Expected: 실시간 통합 테스트와 event map type-check가 통과하며 collaboration 외부에는 `io`나 Room manager가 노출되지 않는다.

### Task 6: 삭제 hook 주입과 application shutdown

**Files:**

- Modify: `backend/src/controllers/whiteboard-document.controller.ts`
- Modify: `backend/src/routes/whiteboard-document.routes.ts`
- Modify: `backend/src/routes/index.ts`
- Modify: `backend/src/app.ts`
- Modify: `backend/src/db/client.ts`
- Modify: `backend/src/cache/valkey.ts`
- Modify: `backend/src/server.ts`
- Modify: `backend/tests/app.test.ts`
- Modify: `backend/tests/whiteboard-document.test.ts`
- Create: `backend/tests/server-shutdown.test.ts`

**Interfaces:**

- Consumes: Task 5의 `WhiteboardCollaboration.documentDeleted()`와 `close()`.
- Produces: factory 기반 HTTP 삭제 callback, `closeDatabase()`, `closeValkey()`, 재진입 가능한 20초 application shutdown.

- [x] **Step 1: 삭제 hook의 호출·실패 계약 RED 테스트를 작성한다.**

controller가 `req.app.locals`를 사용하지 않도록 handler factory를 대상으로 검증한다.

```ts
it("returns 204 after a committed delete even when the realtime hook throws", async () => {
  const onDocumentDeleted = vi.fn(() => {
    throw new Error("socket cleanup failed");
  });

  const response = await request(
    createApp({ onWhiteboardDocumentDeleted: onDocumentDeleted }),
  )
    .delete(deleteUrl)
    .set("Authorization", bearerToken);

  expect(response.status).toBe(204);
  expect(onDocumentDeleted).toHaveBeenCalledWith(documentId);
});
```

DB delete service가 실패하면 hook을 부르지 않는 테스트와 hook 오류 로그에 document ID만 있고 canvas/token이 없는지도 검증한다.

- [x] **Step 2: router/controller factory로 callback을 명시적으로 전달한다.**

```ts
export interface WhiteboardDocumentRouteDependencies {
  onDocumentDeleted?: (documentId: string) => void;
}

export function createWhiteboardDocumentRouter(
  dependencies: WhiteboardDocumentRouteDependencies = {},
): Router;

export function createRouter(
  dependencies: WhiteboardDocumentRouteDependencies = {},
): Router;
```

delete handler는 service transaction이 resolve된 뒤 callback을 `try/catch`로 호출하고 204를 반환한다. `app.locals.onWhiteboardDocumentDeleted` assignment와 runtime cast를 제거한다.

- [x] **Step 3: DB·Valkey 종료 함수와 application shutdown RED 테스트를 작성한다.**

`backend/tests/server-shutdown.test.ts`는 주입형 shutdown 함수로 다음을 검증한다.

```ts
it("shares one promise and closes resources after collaboration drain", async () => {
  const shutdown = createApplicationShutdown(dependencies);
  const first = shutdown("SIGTERM");
  const second = shutdown("SIGINT");

  expect(second).toBe(first);
  await first;
  expect(callOrder).toEqual(["collaboration", "database", "valkey"]);
  expect(process.exitCode).toBe(0);
});
```

Room drain reject, DB close reject, deadline 초과 각각 `exitCode = 1`, 구조화 오류 로그, 후속 자원 종료 시도를 검증한다. 테스트 전후 기존 `process.exitCode`를 복원한다.

- [x] **Step 4: 종료 seam과 composition root를 구현한다.**

`backend/src/db/client.ts`는 `queryClient`를 외부에 노출하지 않고 `closeDatabase(): Promise<void>`를 export한다. `backend/src/cache/valkey.ts`는 lazy client 상태가 `wait` 또는 `end`면 성공하고, 연결 상태면 `quit()`을 시도하는 `closeValkey(): Promise<void>`를 export한다.

`server.ts` 조립 순서는 다음으로 바꾼다.

```ts
const httpServer = createServer();
const collaboration = createWhiteboardCollaborationServer(httpServer);
const app = createApp({
  onWhiteboardDocumentDeleted: collaboration.documentDeleted,
});
httpServer.on("request", app);
```

`WhiteboardCollaboration.close()`는 외부 인자 없이 호출되며 내부에서 `now() + 20_000`을 계산해 Room manager의 `close({ deadlineAt })`에 전달한다. `createApplicationShutdown()`도 최초 호출에서 application deadline을 계산하고 Promise를 closure에 저장한다. collaboration drain 완료 후 남은 시간 안에 DB와 Valkey를 닫고, 각 단계는 남은 시간 기반 timeout과 경쟁시켜 전체 20초를 넘기지 않는다. 실패해도 닫을 수 있는 나머지 자원을 시도하며 `process.exit()` 대신 `process.exitCode`만 설정한다.

- [x] **Step 5: Task 6 집중 테스트를 GREEN으로 확인한다.**

Run:

```bash
pnpm --dir backend test -- tests/app.test.ts tests/whiteboard-document.test.ts tests/server-shutdown.test.ts tests/whiteboard-collaboration.test.ts --reporter=dot
```

Expected: 삭제 callback, 조립 순서, 중복 signal, 자원 종료 테스트가 통과한다.

### Task 7: 실제 PostgreSQL migration backfill 검증

**Files:**

- Modify: `backend/package.json`
- Modify: `backend/pnpm-lock.yaml`
- Modify: `backend/tests/db-schema.test.ts`
- Create: `backend/tests/whiteboard-migration.integration.test.ts`
- Verify: `backend/src/db/migrations/0005_greedy_shriek.sql`
- Verify: `backend/src/db/migrations/meta/0005_snapshot.json`
- Verify: `backend/src/db/migrations/meta/_journal.json`

**Interfaces:**

- Consumes: 현재 0004 migration SQL과 pre-migration `whiteboard_documents.canvas_content` shape.
- Produces: 항상 실행되는 SQL 순서 계약 테스트와 opt-in 실제 PostgreSQL backfill 통합 테스트.

- [x] **Step 1: SQL 순서 계약 RED 테스트를 작성한다.**

`backend/tests/db-schema.test.ts`에서 migration 파일을 문자열로 읽고 index 순서를 검증한다.

```ts
expect(createTableIndex).toBeGreaterThanOrEqual(0);
expect(backfillIndex).toBeGreaterThan(createTableIndex);
expect(foreignKeyIndex).toBeGreaterThan(backfillIndex);
expect(dropColumnIndex).toBeGreaterThan(foreignKeyIndex);
```

`{}`를 `{"elements":[]}`로 정규화하는 CASE와 모든 parent row를 backfill하는 SELECT도 assertion에 포함한다.

- [x] **Step 2: Testcontainers PostgreSQL 의존성을 추가한다.**

Run:

```bash
pnpm --dir backend add -D @testcontainers/postgresql
```

통합 테스트는 `RUN_DATABASE_INTEGRATION_TESTS=1`일 때만 실행하고, 그 외에는 명시적으로 skip 상태를 남긴다. Docker 없는 환경에서 skip된 결과만으로 migration 전체 검증 성공을 선언하지 않는다.

- [x] **Step 3: 실제 backfill 통합 테스트를 작성한다.**

`PostgreSqlContainer`를 시작하고 `postgres` client로 최소 pre-0004 parent table을 만든다. active row, soft-deleted row, `{}`, elements/files JSON을 insert한 뒤 0004 SQL을 실행한다.

```ts
const container = await new PostgreSqlContainer("postgres:17-alpine").start();
const sql = postgres(container.getConnectionUri(), { max: 1 });
await sql.unsafe(preMigrationFixtureSql);
await sql.unsafe(migrationSql);
```

다음을 실제 catalog/query로 검증한다.

- parent row마다 content row가 하나 존재하며 soft-deleted parent도 backfill된다.
- `{}`는 `{ elements: [] }`가 되고 기존 elements/files JSON은 동일하다.
- revision은 0, content `updated_at`은 기존 parent `updated_at`이다.
- content PK/FK와 `ON DELETE CASCADE`가 존재한다.
- parent `canvas_content` column은 제거된다.

`afterAll`에서 SQL client와 container를 항상 종료한다.

- [x] **Step 4: migration unit·integration 검증을 실행한다.**

Run:

```bash
pnpm --dir backend test -- tests/db-schema.test.ts --reporter=dot
RUN_DATABASE_INTEGRATION_TESTS=1 pnpm --dir backend test -- tests/whiteboard-migration.integration.test.ts --reporter=dot
```

Expected: 첫 명령은 SQL 순서 계약 PASS, 두 번째는 실제 PostgreSQL backfill과 catalog assertion PASS다. Docker 기동 실패 시 그 사실을 최종 검증 결과와 계획 문서 결과에 기록한다.

### Task 8: 회귀 문서·전체 검증·리뷰

**Files:**

- Modify: `backend/README.md`
- Modify: `docs/superpowers/plans/2026-09-11-whiteboard-collaboration-hardening-implementation-plan.md`
- Review: 이번 계획에서 변경한 모든 backend source/test/migration 파일

**Interfaces:**

- Consumes: Task 1~7의 최종 REST, Socket.IO, persistence, shutdown 계약.
- Produces: 현재 동작과 일치하는 운영 문서, 최종 code review 결과, `Implementation Results`.

- [x] **Step 1: backend README의 실시간 계약을 갱신한다.**

다음을 문서화한다.

- join/scene `fileUpdates`/presence event와 ack shape
- saved/save-failed/sync-required/recovered/deleted/auth-expired/error event
- 전체 오류 코드와 application/transport/Room/rate 제한
- 500ms quiet·2초 max save, blocked/retry/recovered 의미
- 단일 인스턴스 한계와 다중 인스턴스 전환 시 Valkey adapter 필요성
- SIGTERM/SIGINT 20초 drain과 실패 exit code
- migration integration test의 Docker 및 실행 명령

- [x] **Step 2: focused suite와 전체 회귀 테스트를 실행한다.**

Run:

```bash
pnpm --dir backend test -- tests/whiteboard-element-merge.test.ts tests/whiteboard-file-merge.test.ts tests/whiteboard-scene.test.ts tests/whiteboard-protocol.test.ts tests/whiteboard-rate-limiter.test.ts tests/whiteboard-document-lifecycle.test.ts tests/whiteboard-room-manager.test.ts tests/whiteboard-collaboration.test.ts tests/whiteboard-document-content.test.ts tests/whiteboard-document.test.ts tests/server-shutdown.test.ts tests/db-schema.test.ts --reporter=dot
pnpm --dir backend test -- --reporter=dot
RUN_DATABASE_INTEGRATION_TESTS=1 pnpm --dir backend test -- tests/whiteboard-migration.integration.test.ts --reporter=dot
```

Expected: focused suite, 전체 suite, 실제 PostgreSQL migration suite가 모두 PASS다.

- [x] **Step 3: 정적 검증과 생성 결과 일치를 확인한다.**

Run:

```bash
pnpm --dir backend lint
pnpm --dir backend build
pnpm --dir backend db:generate
pnpm --dir backend exec prettier --check src tests README.md package.json
git diff --check
```

Expected: lint/build/format/diff check가 PASS하고 `db:generate` 후 의도하지 않은 schema migration이 추가되지 않는다. 새 migration이 생성되면 schema와 0004 metadata 불일치를 먼저 해결한 뒤 다시 실행한다.

- [x] **Step 4: `superpowers:requesting-code-review`와 최종 branch review를 수행한다.**

리뷰 기준은 다음으로 고정한다.

- 삭제 직후 stale Room 생성 가능성이 남아 있지 않은가.
- ack된 최신 revision이 drain 성공 전에 유실될 경로가 없는가.
- file/element update가 부분 적용되거나 동시 변경을 덮어쓰지 않는가.
- blocked/failed/deleted 상태에서 timer, socket index, Room memory가 누수되지 않는가.
- 모든 외부 payload가 schema·byte·rate·capacity 검증을 거치는가.
- 권한 오류가 resource 존재 여부를 노출하지 않는 기존 404 계약을 유지하는가.
- 로그에 canvas, data URL, token, 개인정보가 포함되지 않는가.
- unrelated change와 사용자 기존 변경을 덮어쓴 diff가 없는가.

발견된 문제는 해당 Task의 RED 테스트를 추가한 뒤 수정하고 전체 검증을 반복한다.

- [x] **Step 5: Implementation Results를 기록한다.**

이 문서 끝에 다음 형식으로 실제 결과를 추가한다.

```md
## Implementation Results

### 실제 변경 내용

- 구현된 모듈과 외부 계약

### 계획과 달라진 점

- 차이와 변경 이유, 차이가 없으면 "없음"

### 검증 결과

- 실행 명령, PASS/FAIL, 테스트 개수

### 남은 후속 작업

- 다중 인스턴스 Valkey adapter, 프론트엔드 file delta adapter 등 범위 밖 작업
```

실패하거나 실행하지 못한 검증은 성공으로 축약하지 않고 원인과 영향 범위를 그대로 기록한다.

## Implementation Results

### 실제 변경 내용

- `WhiteboardCollaboration` 내부에 generation lifecycle fence, strict Socket.IO protocol, socket별 rate limit, element/file canonical merge, Room persistence state machine과 20초 drain을 구현했다.
- scene update는 Excalidraw 파일 전체 map 대신 `fileUpdates` delta를 받고, element version/versionNonce와 file version을 기준으로 원자적으로 병합한다. 기존 DB의 id가 안정적인 legacy file entry는 보존하되 신규 Socket 입력은 엄격한 file schema로 검증한다.
- `whiteboard_document_contents` 1:1 테이블, 0004 backfill migration, parent/content 단일 상세 조회, compare-and-save와 `content_missing` 무결성 계약을 추가했다.
- HTTP soft delete commit 이후 명시적으로 주입한 `documentDeleted()` hook으로 Room과 socket을 정리하고, hook 오류가 성공한 204 응답을 뒤집지 않게 했다.
- SIGTERM/SIGINT에서 collaboration → PostgreSQL → Valkey 순서로 종료하며, 재진입 가능한 하나의 Promise와 application 전체 absolute deadline을 사용한다.
- Socket.IO 공개 event·ack·오류 코드·payload/rate/Room 제한과 단일 인스턴스 범위를 `backend/README.md`에 문서화했다.
- migration SQL 순서 계약 테스트와 opt-in Testcontainers PostgreSQL 통합 테스트를 추가했다.
- 재검토에서 발견한 blocked 상태 전이, Socket.IO/HTTP 종료 순서, persisted snapshot 한도 우회를 회귀 테스트로 재현하고 보완했다. blocked는 장애 유형과 무관하게 저장 성공까지 유지하며, Socket.IO 종료와 Room drain은 동시에 시작한다. 초기·rebase snapshot 한도 초과는 `CONTENT_INTEGRITY_ERROR`로 처리하고, 문서 전환 중 초기 검증이 실패해도 기존 Room 참여 상태를 보존한다.

### 계획과 달라진 점

- workspace agent credit 소진으로 Task 2 이후 구현과 최종 리뷰는 controller가 직접 수행했다. 작업별 commit을 만들지 않는 사용자 지침에 따라 commit 기반 독립 리뷰 대신 task report와 전체 working-tree diff를 기준으로 검토했다.
- 종료 deadline은 `close(deadline)`로 외부 interface를 넓히지 않고 composition root가 갱신하는 deadline provider로 collaboration에 전달해 `close(): Promise<void>` 계약을 유지했다.
- 최종 리뷰에서 설계와 달리 DB legacy file entry를 strict 입력 schema로 거부하던 문제와, draining 전에 시작된 token 검증이 종료 후 connection을 commit할 수 있던 경쟁 조건을 발견했다. 각각 RED 테스트를 추가하고 저장 파일 타입 분리와 middleware 재확인으로 수정했다.
- 최종 전체 suite 병렬 실행에서 scene burst 테스트가 1회 실패했다. 40개 network ack를 순차 대기하는 동안 실제 clock이 50ms 이상 흘러 token이 정상 보충된 테스트 타이밍 문제였으며, collaboration 통합 테스트에 고정 clock을 주입한 뒤 전체 suite를 연속 2회 통과시켰다.
- Drizzle 생성 metadata가 기존 `0000_snapshot.json`을 포함해 Prettier 전체 검사에 실패해 `backend/.prettierignore`에서 migration metadata JSON을 제외했다. 일반 source/test/README/package 파일은 전부 검사한다.
- 기본 Testcontainers 이미지 `postgres:17-alpine` pull은 현재 Docker credential/registry 경로에서 120초 timeout 됐다. 테스트 기본값은 유지하고 `TEST_POSTGRES_IMAGE` override를 추가해 로컬 PostgreSQL 18 이미지에서 실제 migration을 검증했다.
- 후속 리뷰에서 저장 장애 유형이 교차하면 blocked가 풀리던 상태 전이, Room drain 뒤에야 Socket.IO/HTTP를 닫던 종료 순서, 초기·rebase snapshot이 Room 한도를 우회하던 문제를 확인했다. 각 경로의 RED 테스트를 추가하고 저장 성공만 blocked를 해제하도록 변경했으며, 종료 작업을 병렬 시작하고 persisted snapshot을 무결성 오류로 명시했다.
- PR 준비 중 `dev`의 사용자 session-version migration과 번호가 겹쳐 최종 migration 순서를 `0003_silly_echo` → `0004_misty_zarda` → `0005_greedy_shriek`로 재구성했다. 각 snapshot의 `prevId`를 다시 연결하고 실제 PostgreSQL backfill 테스트로 검증한다.

### 검증 결과

```bash
pnpm --dir backend test -- tests/whiteboard-element-merge.test.ts tests/whiteboard-file-merge.test.ts tests/whiteboard-scene.test.ts tests/whiteboard-protocol.test.ts tests/whiteboard-rate-limiter.test.ts tests/whiteboard-document-lifecycle.test.ts tests/whiteboard-room-manager.test.ts tests/whiteboard-collaboration.test.ts tests/whiteboard-document-content.test.ts tests/whiteboard-document.test.ts tests/server-shutdown.test.ts tests/db-schema.test.ts --reporter=dot
pnpm --dir backend test -- --reporter=dot
RUN_DATABASE_INTEGRATION_TESTS=1 TEST_POSTGRES_IMAGE=postgres:18 TESTCONTAINERS_RYUK_DISABLED=true pnpm --dir backend test -- tests/whiteboard-migration.integration.test.ts --reporter=dot
pnpm --dir backend lint
pnpm --dir backend build
pnpm --dir backend db:generate
pnpm --dir backend exec prettier --check src tests README.md package.json
git diff --check
```

- focused suite: 최초 12 files / 222 tests passed, 재검토 보완 후 12 files / 231 tests passed.
- 전체 suite: 최초 31 files / 404 tests passed, 재검토 보완 후 31 files / 413 tests passed. opt-in migration 1 file / 3 tests는 일반 실행에서 skipped 상태다.
- 최초 flaky 수정 후 같은 전체 suite를 연속 2회 실행해 각각 404 passed / 3 skipped를 확인했고, 재검토 보완 후 전체 suite를 다시 실행해 413 passed / 3 skipped를 확인했다.
- 실제 PostgreSQL migration suite: 1 file / 3 tests passed.
- lint, TypeScript build, Prettier, diff check: 모두 exit 0.
- `db:generate`: `No schema changes, nothing to migrate`.
- PostgreSQL은 긴 Drizzle FK 이름을 63 byte로 자동 절단한다는 NOTICE를 냈지만 PK/FK와 `ON DELETE CASCADE` catalog 검증은 통과했다.

### 리뷰 결과

- 최초 리뷰 후 재검토에서 Important 2건과 보통 1건을 발견했고 모두 회귀 테스트와 함께 수정했다.
- Standards: 구현 체크리스트와 Implementation Results를 실제 상태로 갱신하고 lint·format 검증을 다시 수행한다.
- Spec: blocked/recovered 교차 장애 상태 전이, Socket.IO/HTTP와 Room drain의 동시 종료, 초기·rebase snapshot 한도 계약을 추가로 검증한다.
- `superpowers:requesting-code-review`가 요구하는 reviewer subagent는 workspace agent credit 소진과 현재 세션의 subagent 실행 도구 부재로 호출하지 못했다. 대신 `code-review`의 Standards/Spec 두 축을 controller가 직접 수행했다.

### 남은 후속 작업

- 여러 백엔드 인스턴스를 위한 Socket.IO Valkey adapter/Pub/Sub와 Room 상태 소유·분산 저장 충돌 정책
- 프론트엔드 Excalidraw `onChange` 전체 files map을 `fileUpdates` delta로 변환하는 adapter
- CRDT/Yjs 기반 오프라인·장시간 동시 편집 병합과 버전 히스토리/복원
- 이미지 object storage와 orphan file 정리
- workspace 멤버십 취소를 이미 연결된 socket에 즉시 전파하는 기능
- CI Docker 환경에서 기본 `postgres:17-alpine` migration 통합 테스트 실행
