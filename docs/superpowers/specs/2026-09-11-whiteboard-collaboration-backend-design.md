# 화이트보드 실시간 공동 편집 백엔드 설계

## 상태

- 승인 상태: 사용자 승인
- 승인 일자: 2026-09-11
- 구현 범위: 백엔드 V1
- 배포 가정: 백엔드 단일 인스턴스

## 목표

화이트보드 문서의 캔버스 콘텐츠를 문서 메타데이터와 분리해 저장하고, workspace 멤버들이 Socket.IO를 통해 같은 문서를 실시간으로 공동 편집할 수 있도록 한다.

이번 V1은 다음을 만족해야 한다.

- 문서 상세 조회 시 최신 캔버스 스냅샷과 저장 revision을 반환한다.
- 같은 문서에 접속한 사용자에게 서로 다른 요소의 변경 사항을 유실 없이 전파한다.
- 같은 요소를 동시에 수정하면 Excalidraw 요소의 `version`·`versionNonce`로 결과를 결정한다.
- 커서와 현재 편집 요소는 실시간으로 공유하되 DB에는 저장하지 않는다.
- 편집 변경은 짧은 지연으로 최신 스냅샷 하나만 자동 저장한다.
- workspace 멤버십과 활성 project·document 검증을 HTTP와 Socket.IO에서 동일하게 적용한다.
- 이후 여러 백엔드 인스턴스와 Valkey Pub/Sub adapter를 붙일 수 있도록 협업 모듈의 교체 지점을 둔다.

## 배경과 현재 상태

현재 `whiteboard_documents`에 `canvas_content` JSONB가 메타데이터와 함께 저장되어 있다. 인증된 단건 조회 API는 작업 트리에 구현되어 있으나 아직 커밋되지 않았고, 목록 조회는 캔버스 본문을 반환하지 않는다.

제품 요구사항은 다음과 같다.

- workspace 멤버는 문서 생성자 여부와 관계없이 캔버스를 편집할 수 있다.
- 문서 이름 변경·삭제 권한은 캔버스 편집 권한과 별개로 owner 또는 creator에게만 있다.
- 변경 사항은 실시간 반영되고 자동 저장된다.
- 오프라인 편집·온라인 복귀 동기화와 버전 히스토리·복원은 범위 밖이다.

목록 API에 전체 캔버스 JSON을 포함하면 문서 수와 캔버스 크기에 따라 응답·파싱 비용이 증가하므로 목록은 메타데이터 전용으로 유지한다.

## 접근 방식 비교

### 전체 스냅샷 Last-Write-Wins

클라이언트가 매번 전체 캔버스를 보내고 서버가 마지막 요청을 저장·전파하는 방식이다. 구현은 단순하지만 서로 다른 사용자가 동시에 수정한 요소가 서로의 전체 스냅샷에 의해 덮어써질 수 있다. 자동 저장을 위해 전체 JSON을 자주 직렬화해야 하므로 V1의 공동 편집 방식으로 채택하지 않는다.

### Yjs 등 CRDT 기반 동기화

동시 수정과 재접속·오프라인 병합까지 강하게 해결할 수 있다. 그러나 현재 제품의 오프라인 편집은 명시적인 비목표이고, CRDT 문서 포맷·provider·영구 로그까지 함께 도입하면 현재 백엔드 규모를 크게 넘어선다. 추후 오프라인 요구사항이 추가될 때 별도 설계한다.

### Socket.IO + 요소 단위 병합 + 최신 스냅샷 저장

클라이언트가 변경된 Excalidraw 요소만 보내고 서버 Room이 요소 ID별 최신 상태를 유지한다. 서버는 서로 다른 요소의 변경을 합치고 같은 요소는 결정적인 version 비교로 선택한 뒤, 디바운스된 최신 전체 스냅샷만 DB에 저장한다.

이 방식은 Socket.IO의 Room·ack·재접속을 활용하면서도 특정 전송 계층이나 Excalidraw 프론트엔드 패키지에 서버가 강하게 결합되지 않는다. V1의 추천 방식으로 채택한다.

## 아키텍처

```text
HTTP server
├── Express app
│   └── REST: 문서 목록·상세·이름 변경·소프트 삭제
└── Socket.IO server
    └── Whiteboard collaboration module
        ├── access/authentication
        ├── Room manager (단일 인스턴스 메모리)
        ├── element merge
        ├── presence/cursor
        └── debounced snapshot persistence

PostgreSQL
├── whiteboard_documents       # 메타데이터·lifecycle
└── whiteboard_document_contents # 최신 캔버스 스냅샷·revision

Valkey
└── 기존 refresh session 용도만 사용
```

### Module과 seam

- `whiteboard-document.service`: 문서 접근 권한, 상세 조회, 생성·이름 변경·소프트 삭제를 담당한다.
- `whiteboard-document-content` 저장 module: 콘텐츠 스냅샷 조회·revision 조건부 저장을 담당한다. Socket.IO Room은 이 module의 Interface만 사용하고 Drizzle query를 직접 알지 않는다.
- `whiteboard-element-merge` module: Excalidraw 전체 타입을 import하지 않고 최소한의 요소 Interface로 ID별 병합을 수행한다. 순수 함수로 테스트한다.
- `whiteboard-room-manager` module: Room lifecycle, 참여자, scene 상태, 중복 update id, 저장 예약을 관리한다.
- `whiteboard-collaboration` adapter: Socket.IO 이벤트와 room manager·access·persistence module을 연결한다. 이후 Socket.IO Redis adapter 또는 다른 transport로 교체할 수 있는 seam이다.

외부 Interface는 Socket.IO 이벤트와 문서 상세 응답으로 작게 유지하고, 저장·충돌·재시도 복잡성은 협업 module 내부에 둔다.

## 데이터 모델

### `whiteboard_document_contents`

```text
document_id   UUID        PRIMARY KEY, FK whiteboard_documents.id ON DELETE CASCADE
canvas_content JSONB      NOT NULL DEFAULT {"elements": []}
revision      BIGINT      NOT NULL DEFAULT 0
updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
```

`whiteboard_documents.canvas_content`는 제거한다. 문서가 생성될 때 parent와 content row를 같은 transaction에서 생성한다. 기존 문서의 콘텐츠는 migration에서 새 테이블로 복사한다. 부모 문서가 soft delete되어도 content row는 유지하며, hard delete 또는 부모 row cascade 시 함께 삭제된다.

`revision`은 버전 히스토리가 아니다. 최신 스냅샷의 동시 저장 충돌을 감지하기 위한 단조 증가 concurrency token이다. 과거 스냅샷이나 복원 기능은 저장하지 않는다.

### 캔버스 콘텐츠 JSON

서버가 저장하는 기본 형태는 다음과 같다.

```json
{
  "elements": [],
  "files": {}
}
```

서버는 Excalidraw 전체 element union을 의존하지 않고 다음 필드만 병합 계약으로 요구한다.

```ts
type WhiteboardElement = Record<string, unknown> & {
  id: string;
  version: number;
  versionNonce: number;
  isDeleted: boolean;
};

type CanvasContent = {
  elements: WhiteboardElement[];
  files?: Record<string, unknown>;
};
```

그 외 요소 필드는 불투명 JSON으로 보존한다. `appState`처럼 사용자별 화면 상태는 공동 편집 스냅샷의 필수 항목으로 취급하지 않는다. 기존 `{}` 콘텐츠는 읽을 때 `elements: []`를 갖는 canonical shape으로 정규화한다.

## HTTP 계약

### 문서 생성

기존 생성 API 계약을 유지한다.

```http
POST /workspaces/:workspaceId/projects/:projectId/whiteboard-documents
```

서비스는 `whiteboard_documents` insert와 `whiteboard_document_contents` insert를 같은 transaction에서 실행한다. 응답의 `canvasContent`는 canonical empty content를 반환한다.

### 문서 목록

기존 목록 응답을 유지한다. `canvasContent`, `revision`, 파일 데이터는 포함하지 않는다. `updatedAt`은 이름 변경·소프트 삭제·성공한 콘텐츠 저장 시각을 반영한다.

### 문서 상세

기존 상세 API 경로와 인증·권한 오류 계약을 유지하고, 분리된 content row를 함께 반환한다.

```http
GET /workspaces/:workspaceId/projects/:projectId/whiteboard-documents/:documentId
Authorization: Bearer <access-token>
```

```json
{
  "whiteboardDocument": {
    "id": "document-uuid",
    "projectId": "project-uuid",
    "name": "기획 보드",
    "creatorId": "user-uuid",
    "canvasContent": {
      "elements": [],
      "files": {}
    },
    "revision": 3,
    "lastSavedAt": "2026-09-11T00:00:00.000Z",
    "createdAt": "2026-09-10T00:00:00.000Z",
    "updatedAt": "2026-09-11T00:00:00.000Z"
  }
}
```

`deletedAt`과 내부 content row의 `documentId`·DB `updatedAt`은 응답에 노출하지 않는다. `updatedAt`은 목록 정렬과 문서 메타데이터용이고, `lastSavedAt`은 마지막 콘텐츠 저장 시각이다.

### 문서 콘텐츠 저장 REST API

추가하지 않는다. 온라인 편집 저장은 Socket.IO Room이 담당한다. 오프라인 저장·수동 저장 endpoint는 현재 제품 범위에 없다.

### 접근 제어 오류

HTTP 상세 조회와 동일한 순서를 사용한다.

1. access token 인증
2. workspace membership 확인 — 없으면 `404 WORKSPACE_NOT_FOUND`
3. 해당 workspace의 활성 project 확인 — 아니면 `404 PROJECT_NOT_FOUND`
4. 해당 project의 활성 document 확인 — 아니면 `404 WHITEBOARD_DOCUMENT_NOT_FOUND`

인증 실패는 `401 UNAUTHORIZED`, UUID 오류는 `400 VALIDATION_ERROR`, DB 오류는 기존 error handler에 따라 `500 INTERNAL_SERVER_ERROR`를 사용한다. 삭제된 문서는 존재하지 않는 문서와 동일하게 처리한다.

## Socket.IO 계약

### 연결과 인증

클라이언트는 다음 형태로 연결한다.

```ts
io(API_URL, {
  auth: { accessToken },
});
```

Socket.IO middleware에서 access token을 검증한다. 토큰이 없거나 유효하지 않으면 connection을 거부하고 `connect_error`에 `UNAUTHORIZED`를 전달한다. access token의 만료 시각에 맞춰 서버는 socket을 종료하며, 클라이언트는 갱신된 access token으로 재연결한다. Socket 연결이 access token 만료 이후에도 권한을 유지하지 않도록 한다.

현재 access token은 15분 수명이므로 Socket.IO middleware를 한 번만 실행하는 기본 동작에 의존하지 않는다. 인증 payload에 만료 시각을 보존해 만료 timer를 설정한다.

### Room 규칙

- socket 하나는 한 시점에 하나의 whiteboard document Room만 참여한다.
- Room 이름은 서버 내부에서 `whiteboard:document:<documentId>`로 만든다.
- join 전에는 scene·presence 이벤트를 처리하지 않는다.
- 첫 번째 join 시 DB에서 상세 snapshot을 읽어 Room 상태를 만든다.
- 같은 인스턴스의 이후 join은 최신 메모리 Room 상태를 사용한다.
- 마지막 사용자가 나가면 pending save를 flush한 후 Room 상태를 제거한다.
- 서버 종료 시 모든 dirty Room의 저장을 먼저 시도한 뒤 HTTP server를 닫는다.

### `whiteboard:join`

Client → Server:

```ts
{
  workspaceId: string;
  projectId: string;
  documentId: string;
}
```

join 시 membership → 활성 project → 활성 document를 검증하고, 참여자의 사용자 이름을 조회한다. workspace 멤버는 모두 편집자로 간주한다.

성공 ack:

```ts
{
  ok: true;
  whiteboardDocument: {
    id: string;
    projectId: string;
    name: string;
    canvasContent: CanvasContent;
    revision: number;
    lastSavedAt: string;
  };
  participants: Participant[];
}
```

실패 ack:

```ts
{
  ok: false;
  error: {
    code: "WORKSPACE_NOT_FOUND" | "PROJECT_NOT_FOUND" |
      "WHITEBOARD_DOCUMENT_NOT_FOUND" | "UNAUTHORIZED" | "INVALID_PAYLOAD";
    message: string;
  };
}
```

### `whiteboard:scene:update`

Client → Server:

```ts
{
  documentId: string;
  clientUpdateId: string; // UUID, retry idempotency key
  elements: WhiteboardElement[];
  files?: Record<string, unknown>;
}
```

서버는 payload 크기 1 MiB, 한 update의 변경 요소 수 2,000개를 상한으로 둔다. 요소는 `id`, `version`, `versionNonce`, `isDeleted`를 검증하고 나머지는 보존한다. `files`가 있으면 Excalidraw binary file JSON을 함께 최신 스냅샷에 반영하며, `appState`는 수신하더라도 저장하지 않는다.

서버는 Room의 canonical element map에 다음 규칙을 적용한다.

1. 현재 요소가 없으면 incoming 요소를 적용한다.
2. incoming `version`이 현재보다 크면 적용한다.
3. `version`이 같으면 `versionNonce`가 큰 요소를 적용한다.
4. 둘 다 같으면 현재 요소를 유지한다.
5. `isDeleted: true`인 요소도 tombstone으로 유지해 늦게 도착한 이전 수정이 삭제를 되살리지 못하게 한다.
6. 기존 요소의 배열 위치는 유지하고, 새 요소는 끝에 추가한다. Excalidraw의 `index` 등 순서 관련 필드는 그대로 보존한다.

accepted element가 있거나 `files`가 변경되면 Room `revision`을 1 증가시킨다. 같은 update가 재전송되면 `clientUpdateId` 캐시로 중복 적용·중복 revision 증가·중복 broadcast를 막고 이전 ack를 반환한다.

성공 ack:

```ts
{
  ok: true;
  revision: number;
  appliedElements: WhiteboardElement[];
  savedRevision: number;
}
```

`appliedElements`는 요청이 승리한 요소뿐 아니라 같은 ID 충돌에서 서버가 유지한 최신 요소도 포함할 수 있어, 요청자가 자신의 로컬 상태를 서버 canonical 상태에 맞출 수 있게 한다.

다른 참여자에게 보내는 Server → Client 이벤트:

```ts
{
  documentId: string;
  sourceUserId: string;
  clientUpdateId: string;
  revision: number;
  elements: WhiteboardElement[];
}
```

scene update는 중요 이벤트이므로 Socket.IO acknowledgement를 사용한다. 클라이언트의 재전송은 `clientUpdateId`로 멱등 처리한다.

### `whiteboard:presence:update`

Client → Server:

```ts
{
  documentId: string;
  cursor: { x: number; y: number } | null;
  activeElementIds: string[];
}
```

커서 좌표는 유한한 숫자여야 하며, `activeElementIds` 개수도 제한한다. presence 이벤트는 저장하지 않고 `volatile` broadcast를 사용해 최신 상태가 중요하고 일부 이벤트 유실은 허용한다.

참여자 정보는 다음 형태다.

```ts
type Participant = {
  userId: string;
  name: string;
  presenceIndex: number;
  cursor: { x: number; y: number } | null;
  activeElementIds: string[];
};
```

같은 사용자가 여러 탭으로 접속한 경우 userId별로 하나의 참여자 정보를 유지하고 socket 수를 참조 카운트한다. 한 탭이 나가도 다른 탭이 남아 있으면 leave 이벤트를 보내지 않는다.

서버는 다음 이벤트를 broadcast한다.

- `whiteboard:presence:joined`
- `whiteboard:presence:updated`
- `whiteboard:presence:left`

### 저장·동기화 이벤트

저장 성공:

```ts
whiteboard:scene:saved
{
  documentId: string;
  revision: number;
  lastSavedAt: string;
}
```

저장 실패:

```ts
whiteboard:scene:save-failed
{
  documentId: string;
  revision: number;
  code: "SAVE_FAILED" | "REVISION_CONFLICT";
  message: string;
}
```

Room 상태와 DB revision이 일치하지 않으면 서버는 DB snapshot을 다시 읽어 Room 요소를 같은 병합 규칙으로 합치고 저장을 재시도한다. 재시도할 수 없는 오류이면 `whiteboard:sync:required`를 보내 최신 상세 snapshot을 전달하고, 클라이언트가 로컬 상태를 재동기화하도록 한다.

문서 소프트 삭제가 성공하면 Room의 모든 socket에 다음 이벤트를 보내고 Room을 닫는다.

```ts
whiteboard:document:deleted
{ documentId: string }
```

### Socket 오류 경계

- join 전 scene/presence: `NOT_JOINED`
- 현재 Room과 다른 documentId: `DOCUMENT_ROOM_MISMATCH`
- 잘못된 payload: `INVALID_PAYLOAD`
- 제한 초과: `PAYLOAD_TOO_LARGE`
- 멤버십·활성 리소스 실패: 기존 404 코드
- 저장 실패: `SAVE_FAILED` 또는 `REVISION_CONFLICT`

Socket 이벤트 오류는 process를 중단하지 않고 해당 ack 또는 error event로 반환한다. 인증·권한 오류는 필요한 경우 해당 socket을 Room에서 제거한다.

## 자동 저장과 동시성

Room에 dirty 상태가 생기면 500ms quiet debounce로 저장을 예약한다. 계속 변경되는 경우에도 최대 2초마다 한 번은 저장하도록 한다. 저장 대상은 Room의 최신 전체 `CanvasContent`이며, pointer 이벤트나 presence는 저장하지 않는다.

저장 adapter는 다음 의미를 갖는다.

```ts
load(documentId): Promise<WhiteboardSnapshot>;
save(input: {
  documentId: string;
  canvasContent: CanvasContent;
  expectedRevision: number;
  revision: number;
}): Promise<SaveResult>;
```

`save`는 content row의 `revision = expectedRevision` 조건으로 update하고 성공 시 `revision`·`updated_at`을 갱신한다. 같은 transaction에서 parent document의 `updated_at`을 갱신한다. 조건에 맞는 row가 없으면 `REVISION_CONFLICT`로 처리한다.

단일 인스턴스에서는 하나의 Room manager가 문서의 write order를 직렬화한다. `save`가 진행 중 새 변경이 들어오면 진행 중인 snapshot 이후 최신 revision을 다시 저장한다. save promise를 Room별로 직렬화해 이전 저장이 최신 변경을 덮지 못하게 한다.

## 인증·권한

- HTTP는 기존 Bearer access token middleware를 사용한다.
- Socket.IO는 handshake auth의 access token을 검증한다.
- token 만료 시각에 socket을 종료하고 갱신된 token으로 재연결하게 한다.
- join 시 workspace membership, project 소속·활성 상태, document 소속·활성 상태를 검증한다.
- 캔버스 scene 편집과 presence는 join을 성공한 모든 workspace 멤버에게 허용한다.
- 이름 변경·삭제 권한(owner 또는 creator)은 기존 HTTP API 계약을 유지한다.
- 문서 삭제가 성공하면 활성 Room을 즉시 닫아 이후 scene update를 처리하지 않는다.

## 장애와 재접속

- 연결이 끊기면 클라이언트는 Socket.IO reconnect 후 `join`을 다시 호출한다.
- join ack는 항상 전체 최신 snapshot을 포함하므로 별도의 connection state recovery에 의존하지 않는다.
- 서버가 재시작되어 메모리 Room이 사라져도 DB의 마지막 자동 저장 snapshot에서 복구한다.
- debounce window 안에서 프로세스가 비정상 종료되면 마지막 저장 이후 변경은 유실될 수 있다. 정상 SIGTERM에서는 dirty Room flush를 시도한다.
- DB 저장 실패는 dirty 상태를 유지하고 재시도한다. 반복 실패 시 save-failed와 sync-required를 통해 UI가 동기화 오류를 표시할 수 있게 한다.
- 오프라인 상태에서 편집 내용을 장기간 쌓아두거나 온라인 복귀 시 CRDT 병합하는 기능은 제공하지 않는다.

## 확장 계획

V1에서는 Socket.IO 기본 in-memory adapter를 사용한다. `iovalkey`는 기존 refresh session 용도로만 사용하며, 협업 Room 상태를 Valkey에 저장하지 않는다.

여러 백엔드 인스턴스가 필요해지면 다음 순서로 확장한다.

1. 각 인스턴스에 Socket.IO Redis/Valkey Pub/Sub adapter를 연결한다.
2. pub/sub 연결은 refresh session client와 분리한다.
3. DB revision 조건부 저장과 sync-required 경계를 유지한다.
4. 부하 테스트로 동일 문서 30명, 전체 활성 연결 목표를 재검증한다.

adapter는 이벤트 전달만 담당하며 스냅샷 영속화·충돌 해결·재접속 복구를 대신하지 않는다. 따라서 클라이언트의 join 기반 전체 snapshot 동기화는 유지한다.

## 범위 제외

- 프론트엔드 Excalidraw 화면과 Socket.IO client 연동
- 오프라인 편집 및 offline-online merge
- Yjs/CRDT 도입
- 문서 버전 히스토리·복원
- pointer event 로그·감사 로그
- 별도 이미지/file object storage
- 여러 백엔드 인스턴스와 Valkey adapter의 실제 배포
- 목록 API의 `canvasContent` 반환
- 별도 REST canvas save endpoint

## 검증 계획

### 단위 검증

- canvas content canonicalization
- 요소 version/versionNonce/isDeleted 병합
- 서로 다른 요소 병합
- 같은 요소의 낮은 version·동일 version 충돌
- 중복 `clientUpdateId` 멱등 처리
- presence 참조 카운트와 Room cleanup
- debounce·max wait·save serialization

### HTTP·DB 검증

- migration이 기존 parent 콘텐츠를 content table로 옮기는지 확인
- 생성 transaction이 parent와 content row를 함께 만드는지 확인
- 상세 조회가 분리된 snapshot·revision·lastSavedAt을 반환하는지 확인
- 목록에 canvas content가 포함되지 않는지 확인
- soft delete 이후 상세·join·save가 404 또는 document-deleted로 종료되는지 확인
- revision 조건부 저장 성공·충돌을 확인

### Socket.IO 통합 검증

- 인증 누락·만료·잘못된 token의 connection 거부
- workspace 멤버의 join 성공
- 비멤버·다른 project·삭제 document의 join 거부
- 두 client 간 scene update 전파
- 동시에 다른 요소를 수정했을 때 양쪽 변경 보존
- 같은 요소의 version 충돌 결과 일관성
- presence join/update/leave 전파와 volatile payload
- disconnect/reconnect 후 전체 snapshot 재동기화
- 자동 저장 성공·실패·revision conflict
- 문서 soft delete의 Room 종료

### 완료 기준

- backend 전체 테스트·lint·TypeScript build가 통과한다.
- migration 생성물과 schema가 일치한다.
- 변경 파일 formatting과 `git diff --check`가 통과한다.
- 계획 문서에 실제 변경·계획과의 차이·검증 결과·남은 후속 작업을 기록한다.
- commit·push·PR은 사용자가 별도로 요청할 때만 실행한다.
