# in2white backend

Express + TypeScript(ESM) + MVC 패턴 기반 백엔드. 자세한 설계 배경은
[`../docs/superpowers/specs/2026-09-05-backend-scaffolding-design.md`](../docs/superpowers/specs/2026-09-05-backend-scaffolding-design.md)를 참고한다.

## 요구 사항

- Node.js >= 20
- pnpm
- PostgreSQL
- Valkey (현재 일반 API cache 용도, 화이트보드 Room 동기화에는 아직 사용하지 않음)

## 시작하기

```bash
cd backend
pnpm install
cp .env.example .env   # 값을 환경에 맞게 수정
pnpm dev
```

`GET http://localhost:4000/health`로 서버가 떠 있는지 확인할 수 있다.

## 스크립트

| 명령                        | 설명                                                                          |
| --------------------------- | ----------------------------------------------------------------------------- |
| `pnpm dev`                  | 개발 서버 실행 (파일 변경 시 자동 재시작)                                     |
| `pnpm build`                | `dist/`로 프로덕션 빌드 (경로 alias는 `tsc-alias`가 상대경로+확장자로 재작성) |
| `pnpm start`                | 빌드된 `dist/server.js` 실행                                                  |
| `pnpm lint` / `pnpm format` | ESLint 검사 / Prettier 포맷팅                                                 |
| `pnpm test`                 | vitest 테스트 실행                                                            |
| `pnpm db:generate`          | drizzle 스키마로부터 마이그레이션 SQL 생성                                    |
| `pnpm db:migrate`           | 생성된 마이그레이션을 DB에 적용                                               |
| `pnpm db:studio`            | drizzle-kit studio 실행                                                       |

## 화이트보드 실시간 공동 편집

Socket.IO handshake의 `auth.accessToken`에 access token을 전달한다. 한 socket은 한 번에 하나의 문서 Room에 참여하며, join 시 workspace membership과 활성 project/document를 다시 검증한다.

### Client → Server

- `whiteboard:join`: `{ workspaceId, projectId, documentId }`. 성공 ack는 `{ ok: true, whiteboardDocument, participants }`, 실패 ack는 `{ ok: false, error: { code, message } }`이다.
- `whiteboard:scene:update`: `{ documentId, clientUpdateId, elements, fileUpdates? }`. `clientUpdateId`는 UUID이며 재전송 중복 제거에 사용한다. 성공 ack는 `{ ok: true, revision, appliedElements, savedRevision, fileUpdates? }`이다.
- `whiteboard:presence:update`: `{ documentId, cursor, activeElementIds }`. 고빈도 volatile 이벤트라 ack가 없으며 오류는 cooldown이 적용된 `whiteboard:error`로 받는다.

Excalidraw `onChange`가 주는 전체 files map을 그대로 보내지 않는다. 프론트엔드가 직전 서버 반영본과 비교해 추가·변경된 entry만 `fileUpdates`로 보내야 한다. map key와 `file.id`는 같아야 하고 각 파일은 `id`, `mimeType`, `dataURL`, `created`를 포함하며 `version`, `lastRetrieved`는 선택 항목이다. 같은 file ID/version에 서로 다른 binary data가 오면 update 전체가 원자적으로 거부된다.

### Server → Client

- `whiteboard:scene:updated`: 다른 사용자가 실제 반영한 element/file delta
- `whiteboard:scene:saved`: PostgreSQL에 저장된 revision과 `lastSavedAt`
- `whiteboard:scene:save-failed`: 연속 저장 실패로 Room이 blocked 됐거나 content 무결성이 손상된 상태
- `whiteboard:sync:required`: revision conflict rebase 후 미저장 변경까지 합친 canonical snapshot
- `whiteboard:room:recovered`: blocked Room의 저장이 다시 성공해 편집 가능해진 상태
- `whiteboard:document:deleted`: 문서 soft delete 후 terminal 상태. 이벤트 뒤 socket이 종료된다.
- `whiteboard:auth:expired`: token 만료 상태. 이벤트 뒤 socket이 종료된다.
- `whiteboard:presence:joined`, `whiteboard:presence:updated`, `whiteboard:presence:left`: 참여자 presence 변경
- `whiteboard:error`: ack가 없는 presence 이벤트의 제한된 오류 알림

공개 오류 코드는 `UNAUTHORIZED`, `AUTH_EXPIRED`, `INVALID_PAYLOAD`, `PAYLOAD_TOO_LARGE`, `RATE_LIMITED`, `NOT_JOINED`, `DOCUMENT_ROOM_MISMATCH`, `ROOM_CAPACITY_EXCEEDED`, `ROOM_SOCKET_CAPACITY_EXCEEDED`, `ROOM_SIZE_LIMIT_EXCEEDED`, `FILE_VERSION_CONFLICT`, `PERSISTENCE_UNAVAILABLE`, `SERVER_DRAINING`, `CONTENT_INTEGRITY_ERROR`, `WHITEBOARD_DOCUMENT_NOT_FOUND`, `WORKSPACE_NOT_FOUND`, `PROJECT_NOT_FOUND`, `INTERNAL_SERVER_ERROR`다.

### 저장과 제한

- 변경 후 500ms 동안 조용하면 저장하며, 변경이 계속되어도 최초 변경 후 2초 안에 저장을 시작한다.
- 일시 오류는 500ms부터 최대 10초인 full-jitter exponential backoff로 재시도한다. 연속 conflict 3회 또는 일반 실패 5회면 Room을 blocked로 전환해 scene update를 거부하되 저장 재시도와 presence는 유지한다. 장애 유형이 바뀌어도 blocked 상태는 저장 성공까지 유지하며, 성공 시 `scene:saved`와 `room:recovered`를 보낸다.
- content row 누락과 제한을 초과한 persisted snapshot은 자동 복구하지 않고 `CONTENT_INTEGRITY_ERROR` terminal 상태로 처리한다. 초기 snapshot과 conflict rebase 결과에도 canonical element 20,000개 및 snapshot 10 MiB 제한을 적용한다.

| 제한                        |                   기본값 |
| --------------------------- | -----------------------: |
| application scene payload   |                    1 MiB |
| Socket.IO transport message |                  1.5 MiB |
| 변경 element/update         |                  2,000개 |
| canonical element/Room      |                 20,000개 |
| canonical snapshot/Room     |                   10 MiB |
| 고유 participant/Room       |                     30명 |
| socket/Room (다중 tab 포함) |                     60개 |
| scene update/socket         | 평균 20회/초, burst 40회 |
| presence update/socket      | 평균 30회/초, burst 60회 |

현재 Room과 revision 상태는 한 Node.js 프로세스 메모리에 있으므로 백엔드 단일 인스턴스만 지원한다. 여러 인스턴스로 수평 확장할 때는 sticky session만으로 충분하지 않으며 Socket.IO Valkey adapter/Pub/Sub와 Room 상태 소유·저장 충돌 정책을 함께 설계해야 한다.

### 종료와 migration 검증

`SIGTERM`/`SIGINT`를 받으면 신규 join/update를 막고 Socket.IO와 기반 HTTP server 종료를 dirty Room drain과 함께 시작한다. Room 저장이 끝난 뒤 PostgreSQL과 Valkey를 닫는다. application 전체 종료 deadline은 20초이며, 미저장 Room이나 자원 종료 실패가 있으면 `process.exitCode`를 1로 설정한다.

0004 content 분리 migration은 Docker 기반 실제 PostgreSQL 테스트로 검증할 수 있다. 평소 전체 테스트에서는 명시적으로 skip되며, 아래 명령만 컨테이너를 시작한다.

```bash
RUN_DATABASE_INTEGRATION_TESTS=1 pnpm test -- tests/whiteboard-migration.integration.test.ts --reporter=dot
```

기본 이미지는 `postgres:17-alpine`이다. 사전에 내려받은 호환 이미지로 검증해야 하는 환경에서는 `TEST_POSTGRES_IMAGE=postgres:18`처럼 override할 수 있다. Docker를 사용할 수 없어 이 테스트가 실행되지 않았다면 migration 검증 완료로 간주하지 않는다.

## 폴더 구조

`routes` → `controllers` → `services` → `db/schema`로 이어지는 계층형 MVC 구조를 따른다. 새 도메인 기능을 추가할 때도 이 계층 구조를 그대로 따라 파일을 추가한다.

## 범위

로그인, Workspace/Project/Whiteboard Document CRUD와 단일 백엔드 인스턴스용 화이트보드 실시간 공동 편집을 제공한다. 다중 인스턴스 Room 동기화, CRDT/오프라인 병합, 파일 object storage와 프론트엔드 Excalidraw adapter는 현재 범위에 포함하지 않는다.
