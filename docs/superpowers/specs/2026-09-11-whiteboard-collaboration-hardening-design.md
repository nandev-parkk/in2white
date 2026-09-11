# 화이트보드 공동 편집 안정성 보강 설계

## 상태

- 대화 설계 승인: 2026-09-11
- 문서 상태: 최종 승인
- 대상 범위: 백엔드 단일 인스턴스 V1
- 선행 설계: `2026-09-11-whiteboard-collaboration-backend-design.md`

## 배경

현재 작업 트리에는 Socket.IO Room, Excalidraw 요소 병합, revision 기반 자동 저장, 소프트 삭제 Room 종료가 구현되어 있다. 전체 테스트·lint·build는 통과하지만 다음 경쟁 조건과 계약 공백이 남아 있다.

- join authorization과 소프트 삭제가 엇갈리면 삭제된 문서의 Room이 뒤늦게 생성될 수 있다.
- 저장 중 새 revision이 생긴 상태에서 서버가 종료되면 최신 dirty revision이 저장되지 않을 수 있다.
- scene update의 `files` 전체 교체로 동시 이미지 추가가 유실될 수 있다.
- 저장 장애·revision conflict·content row 손상에 대한 Room 상태와 클라이언트 오류 계약이 불명확하다.
- payload, 이벤트 전송률, Room 전체 크기 제한이 일관되게 적용되지 않는다.
- 삭제 후 실시간 정리가 controller의 비정형 `app.locals` callback에 결합되어 있다.
- 핵심 경쟁 조건과 실제 migration backfill을 재현하는 테스트가 없다.

이 문서는 기존 기능을 폐기하지 않고, 공동 편집 lifecycle을 하나의 깊은 Module 안으로 모아 위 문제를 해결한다.

## 목표

- 삭제가 join과 어떤 순서로 겹쳐도 삭제 완료 후 활성 Room이 남지 않게 한다.
- 정상 종료가 시작된 뒤 신규 변경을 받지 않고, ack된 최신 revision을 저장하거나 종료 실패를 명시한다.
- 서로 다른 사용자의 요소와 이미지 파일 변경을 결정적으로 병합한다.
- 저장 장애 중 유실 범위와 메모리 증가를 제한하고 복구 상태를 클라이언트에 전달한다.
- Socket.IO 이벤트·오류·크기·전송률 계약을 타입과 테스트로 고정한다.
- migration, 상세 조회, 삭제 후처리의 데이터 일관성을 강화한다.

## 비목표

- 여러 백엔드 인스턴스와 Valkey Pub/Sub adapter 구현
- Yjs/CRDT, 오프라인 편집 병합, 버전 히스토리·복원
- 이미지 object storage와 영구 orphan file 정리
- 프론트엔드 Excalidraw 화면 구현
- workspace 멤버십 변경을 이미 연결된 socket에 즉시 전파하는 기능

프론트엔드는 범위 밖이지만, backend가 요구하는 `fileUpdates` delta와 rate limit 계약은 이 문서에 포함한다.

## 설계 원칙

### 깊은 공동 편집 Module

외부 호출자가 Room timer, save promise, revision rebase, lifecycle generation을 알지 않도록 `WhiteboardCollaboration` Module의 Interface를 작게 유지한다.

```ts
interface WhiteboardCollaboration {
  documentDeleted(documentId: string): void;
  close(): Promise<void>;
}
```

- Socket.IO event handler는 Module 내부의 transport Adapter다.
- Room state, merge, retry, lifecycle fence는 in-process Implementation이다.
- PostgreSQL content persistence는 production Adapter와 테스트용 local substitute를 갖는 내부 seam이다.
- 외부 Interface에서는 Socket.IO `Server`, Room manager, timer를 노출하지 않는다.

내부 구현은 책임별 파일로 나눌 수 있지만 호출자는 위 두 동작만 학습한다.

### 상태를 먼저 전이하고 비동기 작업을 수행한다

삭제와 종료는 첫 `await` 이전에 lifecycle 상태를 전이한다. 상태가 바뀐 뒤 시작되거나 재개된 join·scene update는 이전 상태를 사용할 수 없다.

## Module 구성

```text
WhiteboardCollaboration
├── Socket.IO transport Adapter
│   ├── handshake 인증과 만료
│   ├── typed event/ack 변환
│   └── payload·rate limit
├── document lifecycle fence
│   ├── pending join generation
│   ├── delete terminal fence
│   └── global draining state
├── Room manager
│   ├── participant/presence
│   ├── element/file merge
│   ├── idempotency
│   └── save state machine
└── content persistence Adapter
    ├── load snapshot
    ├── compare-and-save
    └── content integrity result
```

Socket.IO Adapter는 인증된 입력을 내부 command로 변환하고 결과를 ack 또는 broadcast로 변환한다. lifecycle과 저장 순서는 Adapter가 아니라 공동 편집 Module이 소유한다.

## 문서 lifecycle fence

영구적인 deleted ID `Set` 대신 pending join을 추적하는 generation fence를 사용한다.

### join ticket

1. join 요청이 시작되면 `beginJoin(documentId)`가 현재 generation과 pending join 참조를 담은 ticket을 반환한다.
2. workspace membership, 활성 project·document, 사용자 이름을 비동기로 조회한다.
3. authorization 완료 후 `commitJoin(ticket)`이 generation과 deleted 상태를 다시 확인한다.
4. ticket이 유효할 때만 같은 동기 실행 구간에서 Room participant를 등록한다.
5. 성공·실패와 관계없이 pending join 참조를 해제한다.

동시에 들어온 여러 join의 DB authorization은 병렬로 실행할 수 있다. Room 반영 단계만 lifecycle fence를 통과한다.

### 소프트 삭제

1. HTTP delete service가 PostgreSQL transaction을 commit한다.
2. commit 이후 주입된 deletion hook이 `documentDeleted(documentId)`를 호출한다.
3. `documentDeleted`는 첫 비동기 작업 전에 generation을 증가시키고 deleted fence를 세운다.
4. 활성 Room이 있으면 save timer를 취소하고 `whiteboard:document:deleted`를 전파한 뒤 socket을 종료한다.
5. 삭제 전에 시작된 pending join은 authorization이 성공해도 generation 불일치로 거부한다.
6. 모든 pending join이 끝나면 fence entry를 제거할 수 있다. 이후 join은 DB의 활성 document 조회에서 거부된다.

`documentDeleted`는 호출자에게 예외를 던지지 않는 Interface다. 내부 transport 정리 실패는 기록하되 이미 commit된 HTTP 삭제 응답을 500으로 뒤집지 않는다. 저장 Adapter가 `not_found`를 반환하는 경우에도 같은 삭제 종료 경로를 호출해 deletion hook 누락에 대한 방어선을 둔다.

## Room과 저장 상태

Room은 다음 persistence 상태 중 하나를 갖는다.

```text
clean -> dirty -> saving -> clean
                    |        ^
                    v        |
                 retrying -> blocked
                    |          |
                    v          v
                  deleted    failed
```

- `clean`: `revision === persistedRevision`이며 예약된 저장이 없다.
- `dirty`: 저장되지 않은 canonical scene이 있다.
- `saving`: 하나의 snapshot 저장이 진행 중이다.
- `retrying`: 저장 또는 conflict rebase 재시도를 기다린다.
- `blocked`: 연속 실패 한도에 도달해 신규 scene update를 받지 않는다.
- `deleted`: terminal 상태이며 join·update·save를 받지 않는다.
- `failed`: 복구 불가능한 데이터 무결성 오류의 terminal 상태이며 알림과 socket 종료 후 Room을 제거한다.

전역 `draining`은 Room persistence 상태와 별개다. draining이 시작되면 모든 Room에서 신규 join·scene update를 거부하고 현재 dirty 상태만 저장한다.

### revision 불변식

- canonical scene이 실제로 변경될 때만 `revision`을 1 증가시킨다.
- stale element 또는 동일 file update처럼 canonical scene이 바뀌지 않으면 revision·broadcast·save를 발생시키지 않는다.
- Room별 save promise는 하나만 존재한다.
- 저장 중 새 변경이 생기면 현재 save 완료 후 최신 revision을 다시 저장한다.
- 정상 실행 중 `persistedRevision`은 감소하지 않는다.
- 성공적으로 ack된 scene update는 저장되거나, blocked/deleted/failed/drain 실패 상태로 명시되어야 한다.

## Excalidraw 요소와 파일 계약

### 요소

기존 규칙을 유지한다.

- ID가 없으면 추가한다.
- incoming `version`이 크면 교체한다.
- version이 같으면 `versionNonce`가 큰 요소가 이긴다.
- 둘 다 같으면 현재 요소를 유지한다.
- `isDeleted: true` 요소도 tombstone으로 유지한다.
- 기존 순서를 유지하고 새 ID만 뒤에 추가한다.

Room 내부에서는 element `Map`과 order 배열을 유지해 매 update마다 전체 element map을 다시 만들지 않는다. snapshot이 필요한 join·save·resync 시 배열을 생성한다.

### 파일

Excalidraw 0.18.1의 `BinaryFileData`에는 `id`, `mimeType`, `dataURL`, `created`와 optional `lastRetrieved`, `version`이 있다. `onChange`는 전체 `BinaryFiles` map을 반환하지만 backend scene update는 변경된 파일만 받는다.

Client -> Server:

```ts
type WhiteboardSceneUpdate = {
  documentId: string;
  clientUpdateId: string;
  elements: WhiteboardElement[];
  fileUpdates?: Record<string, WhiteboardFile>;
};
```

프론트엔드 adapter는 마지막으로 서버에 반영한 file map과 Excalidraw `onChange`의 전체 map을 비교해 추가·변경된 entry만 `fileUpdates`로 보낸다.

새 `fileUpdates` entry는 map key와 `file.id`가 같아야 하며 `id`, `mimeType`, `dataURL`, `created`를 필수로 검증한다. `version`과 `lastRetrieved`가 있으면 0 이상의 정수여야 한다. 이 엄격한 입력 검증은 새 socket update에 적용하고, 기존 DB snapshot의 legacy entry는 아래 호환 규칙으로 읽는다.

파일 병합 규칙은 다음과 같다.

1. 현재 file ID가 없으면 추가한다.
2. optional `version`이 없으면 0으로 비교한다.
3. incoming version이 크면 incoming binary data로 교체한다.
4. version이 같고 binary data가 같으면 현재 값을 유지한다.
5. version이 같은데 `dataURL` 또는 `mimeType`이 다르면 update 전체를 `FILE_VERSION_CONFLICT`로 원자적으로 거부한다.
6. `lastRetrieved`만 다른 경우 canonical revision을 올리지 않는다. V1은 이를 storage cleanup 기준으로 사용하지 않는다.
7. legacy DB file entry는 읽을 때 보존한다. 유효한 새 entry가 같은 ID로 들어오면 legacy entry의 비교 version을 -1로 취급해 교체할 수 있다.

Server -> Client scene update에는 실제 적용된 element와 file entry만 포함한다. join과 resync snapshot에는 전체 canonical `files`를 포함한다. 파일 삭제와 orphan 정리는 별도 object storage 설계 전까지 수행하지 않는다.

## 저장, 충돌, 복구

### 저장 결과

content persistence Adapter는 다음 결과를 구분한다.

```ts
type SaveResult =
  | { status: "saved"; lastSavedAt: Date }
  | { status: "conflict" }
  | { status: "not_found" }
  | { status: "content_missing" };
```

- `saved`: revision과 parent `updated_at`이 같은 transaction에서 갱신됐다.
- `conflict`: active content row가 있지만 expected revision이 다르다.
- `not_found`: 활성 parent document가 없다.
- `content_missing`: 활성 parent는 있지만 1:1 content row가 없다.

조건부 update가 0 row이면 같은 transaction에서 content 존재 여부를 확인해 `conflict`와 `content_missing`을 구분한다.

### revision conflict

1. 최신 DB snapshot을 읽는다.
2. element와 file version 규칙으로 Room canonical scene과 병합한다.
3. Room revision을 최신 DB revision 기준으로 다시 계산한다.
4. 병합된 전체 canonical snapshot을 `whiteboard:sync:required`로 Room에 전파한다.
5. 새 expected revision으로 저장을 재시도한다.

`sync:required`의 snapshot은 DB 원본이 아니라 Room의 미저장 변경까지 포함한 병합 완료 canonical snapshot이다. snapshot을 만들 수 없는 일반 DB 장애에는 이 이벤트를 보내지 않는다.

연속 conflict가 3회 발생하면 livelock으로 보고 Room을 blocked 상태로 전환한다. blocked 이후에도 최대 10초 간격으로 저장 재시도를 계속하며, 성공 시 recovered 상태로 돌아간다.

### 일시 저장 장애

- 500ms부터 시작해 최대 10초인 full-jitter exponential backoff를 사용한다.
- dirty scene은 메모리에 유지하고 저장 재시도를 포기하지 않는다.
- 연속 5회 실패하면 `whiteboard:scene:save-failed`를 한 번 전파하고 Room을 blocked로 전환한다.
- blocked Room은 presence와 저장 재시도는 유지하지만 신규 scene update를 `PERSISTENCE_UNAVAILABLE`로 거부한다.
- 재시도가 성공하면 `whiteboard:scene:saved`와 `whiteboard:room:recovered`를 전파하고 편집을 다시 허용한다.
- 같은 장애 상태의 반복 event는 rate-limit해 클라이언트와 로그를 과도하게 채우지 않는다.

`content_missing`과 Room 한도를 초과한 persisted snapshot은 자동 복구할 수 없는 데이터 무결성 오류다. Room을 `failed` terminal 상태로 전이하고 `CONTENT_INTEGRITY_ERROR`를 전파한 뒤 socket을 종료하고 Room을 제거한다. content row를 자동 생성하거나 oversized snapshot을 잘라 기존 손상을 숨기지 않으며, 이후 join은 DB 무결성 오류로 거부한다.

## 정상 종료

`close()`는 재진입 가능하며 최초 호출에서 만든 하나의 Promise를 모든 호출자가 공유한다.

1. 첫 `await` 이전에 전역 상태를 `draining`으로 전환한다.
2. 신규 connection·join·scene update를 `SERVER_DRAINING`으로 거부한다.
3. Socket.IO `close()`를 시작해 기존 socket과 기반 HTTP server를 닫는다.
4. 모든 in-flight save가 끝날 때까지 기다린다.
5. 각 Room에서 `persistedRevision === revision`이 될 때까지 직접 flush를 반복한다. drain 중 재시도 지연은 정상 backoff, 2초, 남은 deadline 중 가장 짧은 값으로 제한하며 deadline 이후 새 timer를 예약하지 않는다.
6. 모든 Room이 clean이면 timer와 메모리 상태를 제거하고 성공한다.
7. application shutdown 전체에 20초 deadline을 적용한다. deadline에 dirty Room이 남으면 document ID와 revision을 구조화 로그로 남기고 reject한다.
8. 공동 편집 drain 뒤 PostgreSQL query client와 Valkey client를 닫는다. 이미 연결되지 않은 lazy Valkey client 종료도 안전하게 처리한다.
9. server entrypoint는 모든 자원 종료 성공 시 exit code 0, 미저장 Room 또는 lifecycle·자원 종료 오류 시 exit code 1을 설정한다.

Socket.IO close와 Room drain은 함께 시작할 수 있지만, 최종 성공은 두 작업이 모두 끝난 뒤에만 반환한다. DB·Valkey 연결은 Room drain이 완료된 뒤 닫아 flush 도중 연결이 사라지지 않게 한다. 신호 handler도 같은 application shutdown Promise를 사용해 SIGTERM·SIGINT 중복 실행을 막는다. 즉시 `process.exit()`하지 않고 `process.exitCode`를 설정해 마지막 로그와 연결 종료가 끝난 뒤 event loop가 자연스럽게 끝나게 한다.

## 인증과 Socket.IO 계약

### 인증

- handshake `auth.accessToken`을 검증한다.
- 만료 시각에 `whiteboard:auth:expired`를 전파한 뒤 socket을 종료한다.
- join 시 workspace membership, 활성 project, 활성 document를 검증한다.
- 이미 연결된 뒤 workspace에서 제거된 사용자는 access token 만료 또는 재연결 시점에 재검증한다. 즉시 멤버십 취소 전파는 V1 비목표다.

### typed event map

Socket.IO server/client event map을 별도 타입 module에 선언한다. event 이름, payload, ack 결과, socket data를 `unknown` cast 없이 연결한다. transport Adapter는 Zod schema parse 결과만 공동 편집 내부 command로 전달한다.

### 오류 코드

- 인증 누락·변조·만료: `UNAUTHORIZED` 또는 `AUTH_EXPIRED`
- join 전 event: `NOT_JOINED`
- 다른 Room document ID: `DOCUMENT_ROOM_MISMATCH`
- schema 오류: `INVALID_PAYLOAD`
- 애플리케이션 크기 제한: `PAYLOAD_TOO_LARGE`
- event rate 제한: `RATE_LIMITED`
- Room participant 제한: `ROOM_CAPACITY_EXCEEDED`
- Room socket 제한: `ROOM_SOCKET_CAPACITY_EXCEEDED`
- Room 전체 크기 제한: `ROOM_SIZE_LIMIT_EXCEEDED`
- file 동일 version 충돌: `FILE_VERSION_CONFLICT`
- 저장 차단 상태: `PERSISTENCE_UNAVAILABLE`
- 종료 진행 중: `SERVER_DRAINING`
- content row 손상: `CONTENT_INTEGRITY_ERROR`

scene·join은 ack로 오류를 반환한다. presence는 고빈도 volatile event이므로 ack를 강제하지 않고, 잘못된 payload·Room mismatch·rate 제한은 `whiteboard:error`를 cooldown당 한 번만 전파한다.

## 자원 제한

V1 기본 제한은 다음과 같다.

| 항목                        |                     제한 | 처리                                                  |
| --------------------------- | -----------------------: | ----------------------------------------------------- |
| application scene payload   |                    1 MiB | `PAYLOAD_TOO_LARGE` ack                               |
| Socket.IO transport message |                  1.5 MiB | transport가 socket 종료                               |
| 변경 element/update         |                  2,000개 | `PAYLOAD_TOO_LARGE` ack                               |
| canonical element/Room      |                 20,000개 | 새 ID 추가 거부                                       |
| canonical snapshot/Room     |                   10 MiB | update 전체 원자적 거부                               |
| participant/Room            |                     30명 | 신규 participant join 거부                            |
| socket/Room                 |                     60개 | 같은 사용자의 다중 tab을 포함해 신규 socket join 거부 |
| scene update                | 평균 20회/초, burst 40회 | `RATE_LIMITED` ack                                    |
| presence update             | 평균 30회/초, burst 60회 | event drop + 제한된 오류 event                        |

rate limit은 socket별 token bucket으로 구현한다. participant 제한은 고유 사용자 수, socket 제한은 다중 tab을 포함한 실제 연결 수에 적용한다.

Room element limit에 도달해도 기존 ID의 수정·삭제는 허용하고 새 element ID 추가만 거부한다. snapshot 크기 또는 file conflict를 초과하는 update는 element와 file 일부를 적용하지 않고 전체를 거부한다.

DB에서 처음 적재하는 snapshot과 revision conflict rebase 결과에도 같은 canonical element·snapshot 제한을 적용한다. 초기 snapshot이 한도를 초과하면 join을 `CONTENT_INTEGRITY_ERROR`로 거부한다. rebase 후보가 한도를 초과하면 기존 canonical scene을 변경하지 않고 Room을 `failed` terminal 상태로 종료한다.

Room은 entry별 직렬화 크기와 aggregate byte 수를 유지한다. 한도에 근접했을 때만 최종 candidate snapshot의 정확한 byte 수를 검증해 매 update의 전체 JSON 직렬화를 피한다.

Socket.IO `maxHttpBufferSize`는 handler 실행 전에 초과 message의 socket을 종료한다. 따라서 application 1 MiB보다 큰 transport 1.5 MiB를 두어 handler에 도달한 제한 초과 요청에는 가능한 한 typed ack를 제공하되, 1.5 MiB 자체를 넘는 message에는 ack를 보장하지 않는다.

## HTTP·DB 일관성

### 상세 조회

membership과 project 검증 이후 active `whiteboard_documents`와 `whiteboard_document_contents`를 한 query에서 join해 metadata와 snapshot을 같은 statement snapshot으로 읽는다. content row가 없으면 `CONTENT_INTEGRITY_ERROR`를 기록하고 500을 반환한다.

### 생성 응답

생성 transaction은 parent와 content row를 함께 만든다. 현재 작업 트리가 추가한 `revision`, `lastSavedAt`은 additive response field로 유지하고 설계 문서에 명시한다.

### migration

기존 migration 순서는 유지한다.

1. content table 생성
2. 기존 parent JSONB backfill
3. foreign key 생성
4. parent `canvas_content` 제거

항상 실행되는 SQL 순서 계약 테스트와 Testcontainers가 기동한 실제 PostgreSQL을 사용하는 backfill 통합 테스트를 추가한다. 통합 테스트는 기존 `{}`, elements/files JSON, soft-deleted parent를 준비하고 migration 후 row 수·JSON·revision·timestamp·foreign key·parent column 제거를 검증한다. Docker를 사용할 수 없는 환경에서는 단위 테스트 결과만으로 전체 검증 성공을 선언하지 않고 migration 통합 테스트 미실행을 명시한다.

## 삭제 hook 구성

process-global event bus를 추가하지 않는다. application composition root에서 deletion hook을 명시적으로 주입한다.

```text
create bare HTTP server
├── create WhiteboardCollaboration(httpServer)
├── create HTTP app({ onDocumentDeleted: collaboration.documentDeleted })
└── httpServer.on("request", app)

DELETE controller
├── delete service transaction
└── after commit: injected documentDeleted(documentId)
```

빈 HTTP server에 공동 편집 Module을 먼저 붙인 뒤, 그 Module의 안정된 callback을 HTTP app factory에 주입한다. 이렇게 하면 생성 순환이나 초기화 전 closure 없이 router/controller factory가 deletion hook을 전달받을 수 있다. hook 호출 실패는 구조화 로그를 남기되 성공한 DB transaction을 실패 응답으로 바꾸지 않는다. `app.locals` runtime cast는 제거한다.

## 관측 가능성

구조화 로그에 다음 필드를 남긴다.

- `documentId`
- Room persistence state
- `revision`, `persistedRevision`
- save failure/conflict attempt
- retry delay
- blocked/recovered/deleted/draining transition
- shutdown 시 미저장 Room 목록

canvas JSON, data URL, access token, 사용자 개인정보는 로그에 포함하지 않는다.

## 검증 계획

### pure module

- element version/versionNonce/tombstone merge
- file add, higher version 교체, same-version conflict, lastRetrieved no-op
- no-op update의 revision·broadcast·save 억제
- lifecycle join ticket의 generation 무효화
- token bucket과 Room aggregate limit

### Room manager

- 저장 중 새 update가 들어오면 다음 revision 저장
- conflict rebase 후 병합 canonical snapshot 전파와 재저장
- 3회 conflict 또는 5회 일시 실패 후 blocked
- blocked 상태의 update 거부와 저장 성공 후 recovered
- not_found의 deleted 전이
- content_missing의 integrity failure
- 빈 Room의 dirty flush와 cleanup

### Socket.IO 통합

- 누락·변조·만료 token과 `auth:expired`
- pending authorization 중 document delete race
- 같은 Room의 element/file 동시 편집
- join/scene/presence typed 오류
- payload·rate·participant 제한
- 동일 사용자의 다중 tab을 포함한 socket 제한
- disconnect/reconnect 후 전체 snapshot 동기화
- 삭제 event와 socket 종료
- 종료 시작 이후 join/update 거부

### 종료

- in-flight save 중 최신 update가 생긴 뒤 close해도 마지막 revision 저장
- 저장 실패 후 deadline 내 복구
- deadline 초과 시 close reject와 exit code 1
- 중복 SIGTERM/SIGINT가 같은 close Promise 사용
- Socket.IO와 기반 HTTP server 종료
- Room flush 이후 PostgreSQL·Valkey 연결 종료

### HTTP·DB

- 상세 조회의 workspace/project/document/content 조건
- delete transaction 성공 후 hook 호출
- hook 내부 오류가 204를 500으로 바꾸지 않음
- active parent의 content row 누락 구분
- migration SQL 순서 계약
- Testcontainers 실제 PostgreSQL migration backfill

### 전체 검증

```bash
pnpm --dir backend test -- --reporter=dot
pnpm --dir backend lint
pnpm --dir backend build
pnpm --dir backend db:generate
pnpm --dir backend exec prettier --check <변경 파일>
git diff --check
```

## 완료 기준

- 삭제와 stale join 경쟁 테스트가 결정적으로 재현되고 수정 후 통과한다.
- 정상 종료가 최신 ack revision을 저장하거나 명시적으로 실패한다.
- 동시 element/file update가 유실되지 않는다.
- 저장 장애가 blocked/recovered 상태로 관찰되고 dirty snapshot을 임의로 버리지 않는다.
- 모든 Socket.IO 오류·한도·인증 계약이 타입과 테스트에 반영된다.
- migration backfill과 parent column 제거를 Testcontainers의 실제 PostgreSQL에서 검증한다.
- 기존 REST·인증·workspace/project/whiteboard 테스트가 회귀 없이 통과한다.
- backend lint·build·format·migration schema 일치 검증이 통과한다.
- 구현 계획 문서에 실제 변경, 계획과의 차이, 검증 결과, 남은 후속 작업을 기록한다.

## 참고 자료

- Excalidraw 0.18.1 `BinaryFileData`, `BinaryFiles`, `onChange`: https://github.com/excalidraw/excalidraw/blob/v0.18.1/packages/excalidraw/types.ts
- Excalidraw file API: https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props/excalidraw-api
- Socket.IO `maxHttpBufferSize`: https://socket.io/docs/v4/server-options/#maxhttpbuffersize
- Socket.IO server close: https://socket.io/docs/v4/server-api/#serverclosecallback
