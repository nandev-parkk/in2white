# 화이트보드 상세·실시간 편집 구현 계획

> 실행 담당: `superpowers:executing-plans`를 사용해 이 세션에서 아래 작업을 순서대로 구현한다. 각 비자명한 동작은 실패하는 테스트를 먼저 확인한다. 사용자 요청 전 커밋하지 않는다.

**목표:** 기존 상세·실시간 저장 백엔드와 Excalidraw 화면을 연결해 두 사용자의 편집과 DB 복원까지 검증한다.

**아키텍처:** 기존 프론트 entities/features/pages/routes 구조를 유지한다. 순수 장면 동기화 함수와 문서별 협업 훅을 분리하며, 서버 Room·콘텐츠 저장 서비스는 재사용한다. 백엔드는 입장·재동기화 응답의 저장 상태 보완과 실제 통합 검증을 담당한다.

**기술:** React, TanStack Router/Query, Excalidraw 0.18 계열, Socket.IO, Express, Drizzle/PostgreSQL, Vitest, Testcontainers.

**설계:** [설계 문서](../specs/2026-09-21-whiteboard-editor-design.md).

**상태:** 사용자 승인 후 구현·독립 리뷰·최종 검증 완료. 커밋·push·병합하지 않았으며 작업 브랜치를 보존한다. 아래 작업별 항목은 구현 전의 세부 계획이다. 실제 수행 내용과 대체 검증·미검증 항목은 마지막 Implementation Results를 기준으로 한다.

## 공통 제약

- 작업 경로: `/Users/nandev/orca/workspaces/in2white/feat-whiteboard-editor`.
- 작업 브랜치: `nandev-parkk/feat-whiteboard-editor`, 기준 `dev@13d518b`.
- 원본 작업 트리의 미커밋 변경은 유지한다. PR·push·커밋은 별도 요청이 없으면 하지 않는다.
- 단일 백엔드 인스턴스, 온라인 공동 편집. 오프라인 신규 편집·버전 히스토리·별도 REST 저장·DB migration은 추가하지 않는다.
- 프론트 직접 의존성은 `socket.io-client`만 추가한다. 기존 Excalidraw·UI·세션 갱신을 재사용한다.
- 소켓 payload는 `fileUpdates`; 요소 충돌은 version, 동률이면 높은 versionNonce. 삭제 요소는 보존한다.
- 신규 의존성 설치 전에 잠금 파일 호환 pnpm 버전을 확인한다. 설치가 무관한 전체 의존성 갱신을 만들지 않도록 변경 전후를 비교한다. 원본 dev의 pnpm 12 설치 결과를 기능 변경에 섞지 않는다.
- 검증은 기존 명령의 종료 코드로 판정한다. 반복 테스트 출력에는 `/Users/nandev/.agents/skills/nandev-workflow/scripts/rtk-filtered-test.sh`를 사용한다. 민감한 실제 API 로그는 출력 필터의 입력으로 보내지 않는다.
- 임시 테스트 데이터는 격리 DB에 생성하고 정리한다. 실제 개인 계정 비밀번호와 .env 내용은 출력하거나 복사해 문서화하지 않는다.

## 집중 리뷰 항목

1. 다른 사용자가 만든 dirty/blocked Room에 신규 입장해도 저장됨으로 오인하지 않는다 → 작업 1·3.
2. ack가 늦게 도착해도 전송 이후의 로컬 편집을 덮어쓰지 않는다 → 작업 2·3.
3. 연결 단절 직전의 미확인 변경을 재입장 스냅샷이 지우지 않는다 → 작업 2·3·5.
4. 큰 이미지·파일 충돌을 반복 재전송하거나 조용히 버리지 않는다 → 작업 2·3·4.
5. 문서 전환 후 이전 소켓 callback이 새 화면·저장 상태를 변경하지 않는다 → 작업 3·4.

## 작업 1: 서버 입장·재동기화 저장 상태 계약

변경:

- `backend/src/realtime/whiteboard-room-manager.ts`
- `backend/src/realtime/whiteboard-collaboration.ts`
- `backend/src/realtime/whiteboard-socket.events.ts`
- `backend/tests/whiteboard-room-manager.test.ts`
- `backend/tests/whiteboard-collaboration.test.ts`

인터페이스: 기존 JoinRoomResult의 성공 결과, join ack와 sync-required 이벤트에 `savedRevision: number`, `persistenceState: PersistenceState`를 추가한다. frontend는 이 필드로 초기·재동기화 저장 상태를 판단한다.

- [ ] dirty Room에 두 번째 socket이 입장했을 때 canonical revision과 persistedRevision이 다름을 검증하는 테스트를 추가한다. blocked Room의 상태 전달과 sync-required 계약도 검증한다.

```ts
expect(joined).toMatchObject({
  status: "joined",
  savedRevision: 0,
  persistenceState: "dirty",
  snapshot: expect.objectContaining({ revision: 1 }),
});
```

- [ ] backend에서 wrapper로 `pnpm exec vitest run tests/whiteboard-room-manager.test.ts tests/whiteboard-collaboration.test.ts`를 실행해 신규 assertion 실패를 확인한다.
- [ ] Room 결과 생성 시 `savedRevision: room.scene.persistedRevision`, `persistenceState: room.persistenceState`를 반환한다. collaboration adapter와 이벤트 타입으로 그대로 전달한다. sync-required도 DB 저장 완료 전임을 드러내도록 같은 필드를 전달한다.
- [ ] 같은 테스트를 실행해 통과를 확인한다. 기존 저장 debounce·retry·revision 의미를 바꾸지 않는다.

## 작업 2: 상세 조회와 순수 동기화 로직

변경:

- `frontend/src/entities/whiteboard-document/api/whiteboard-document.ts`
- `frontend/src/entities/whiteboard-document/api/whiteboard-document.test.ts`
- `frontend/src/entities/whiteboard-document/index.ts`

추가:

- `frontend/src/features/whiteboard-editor/model/protocol.ts`: 현재 서버 이벤트의 클라이언트용 타입. backend 런타임 모듈을 import하지 않는다.
- `frontend/src/features/whiteboard-editor/model/scene-sync.ts`
- `frontend/src/features/whiteboard-editor/model/scene-sync.test.ts`

인터페이스:

```ts
type CanvasContent = { elements: WhiteboardElement[]; files?: Record<string, WhiteboardFile> };
type SceneDelta = { elements: WhiteboardElement[]; fileUpdates?: Record<string, WhiteboardFile> };
// WhiteboardElement/File은 현재 서버 계약의 필수 필드와 추가 JSON 필드를 가진다.
// 상세 타입은 기존 문서 메타데이터에 canvasContent/revision/lastSavedAt을 포함한다.
getWhiteboardDocumentRequest(workspaceId: string, projectId: string, documentId: string, accessToken: string): Promise<WhiteboardDocumentDetail>;
diffScene(base: CanvasContent, next: CanvasContent): SceneDelta;
mergeScene(base: CanvasContent, delta: SceneDelta): CanvasContent;
```

- [ ] 상세 응답 파싱·인증 헤더·정확한 경로와 실패 전파 테스트를 추가한다.
- [ ] diff·병합 테스트에 서로 다른 요소, version/nonce 충돌, tombstone, 동일 binary의 lastRetrieved 변경, 이미지 추가, 오래된 ack 이후 신규 로컬 편집을 넣는다.

```ts
const newer = { id: "shape", version: 3, versionNonce: 1, isDeleted: false };
const older = { ...newer, version: 2 };
expect(
  mergeScene({ elements: [newer] }, { elements: [older] }).elements,
).toEqual([newer]);
expect(
  diffScene({ elements: [newer] }, { elements: [newer] }).elements,
).toEqual([]);
```

- [ ] 해당 API·scene-sync 테스트의 신규 실패를 확인한다.
- [ ] GET 상세 함수와 최소 순수 함수를 구현한다. 병합은 서버의 높은 nonce 규칙을 따르고, Excalidraw 내부의 다른 충돌 정책을 임의로 적용하지 않는다.
- [ ] JSON payload byte 제한·2,000요소 제한에 맞는 배치 분할 검증을 추가한다. 단일 초과 파일은 명시적 오류로 반환한다.
- [ ] 해당 테스트를 통과시키고 타입 오류를 확인한다.

## 작업 3: 실시간 협업 훅과 인증·저장 상태

추가:

- `frontend/src/features/whiteboard-editor/model/use-whiteboard-editor.ts`
- `frontend/src/features/whiteboard-editor/model/use-whiteboard-editor.test.tsx`

변경: `frontend/package.json`, `frontend/pnpm-lock.yaml`에 서버 호환 `socket.io-client` 직접 의존성 추가.

인터페이스:

```ts
type EditorStatus =
  "connecting" | "saved" | "saving" | "disconnected" | "error";
useWhiteboardEditor({
  workspaceId,
  projectId,
  documentId,
  accessToken,
  userId,
});
// 반환: scene, participants, status, readOnly, error, hasUnsavedChanges,
// onSceneChange(canvasContent), onPresenceChange(cursor, activeElementIds), retry().
```

- [ ] Socket.IO client mock과 fake timers로 연결→join→장면 변경→ack→saved 테스트를 작성한다. ack만 받은 상태는 저장 중이고 savedRevision이 따라잡아야 저장됨인지 검증한다.
- [ ] dirty/blocked join, sync-required, save-failed/recovered, disconnect/reconnect, timeout 동일 update ID 재시도, token refresh 실패를 검증한다.
- [ ] 문서 ID 전환·unmount 뒤 이전 callback과 timer가 무시되는 테스트를 추가하고 실패를 확인한다.
- [ ] 작업 2의 타입과 순수 함수를 사용해 문서별 state/ref를 구현한다. 100ms coalescing과 단일 in-flight 배치, ack timeout 5초·동일 payload 최대 3회 시도를 사용한다. pending 변경은 별도 보존한다.
- [ ] REST 완료보다 socket join을 우선하며, join 이후 늦게 도착한 상세 응답은 무시한다. remote 장면 적용과 onChange 간 echo를 막는다.
- [ ] 기존 `refreshAccessToken()`을 재사용하고 stale refresh 결과가 다른 문서·로그아웃 후 세션을 다시 활성화하지 않게 한다. 자동 재연결 종료 조건을 명시한다.
- [ ] 50ms presence 제한, disconnect 편집 잠금, 재입장 후 pending 병합·재전송, 오류 상태·재시도를 구현한다.
- [ ] 훅 테스트를 실행하고 통과를 확인한다.

## 작업 4: 편집 페이지·문서 진입·저장 상태 UI

추가:

- `frontend/src/pages/whiteboard-editor/ui/WhiteboardEditorPage.tsx`
- `frontend/src/pages/whiteboard-editor/ui/WhiteboardEditorPage.test.tsx`
- `frontend/src/pages/whiteboard-editor/index.ts`
- `frontend/src/routes/workspaces/$workspaceId/projects_.$projectId.whiteboard-documents_.$documentId.tsx`

변경:

- `frontend/src/pages/project-detail/ui/ProjectDetailPage.tsx`
- `frontend/src/routes/workspaces/$workspaceId/projects_.$projectId.tsx`
- `frontend/src/features/whiteboard-document/ui/WhiteboardDocumentListContent.tsx`
- `frontend/src/features/whiteboard-document/ui/WhiteboardDocumentTable.tsx`
- `frontend/src/shared/ui/whiteboard-card.tsx`
- `frontend/src/shared/ui/canvas-top-bar.tsx`
- 관련 기존 테스트 및 생성 라우트 트리(도구 생성만 사용).

인터페이스: 목록·상세 페이지에 `onDocumentOpen(documentId: string)`을 전달한다. 상단바 SaveStatus에 connecting/error 상태를 추가하고 오류 설명·재시도 액션을 노출한다.

- [ ] 카드·표의 문서 열기, 메뉴 클릭의 이동 방지, 딥링크 인증 가드 테스트를 추가하고 실패를 확인한다.
- [ ] Excalidraw를 mock한 화면 테스트에서 loading/404/error/readOnly, 상태 문구, 참여자, 뒤로가기와 미저장 이탈 경고를 검증한다.
- [ ] 문서 경로 상수를 추가하고 카드·표의 명시적 링크 또는 버튼에서 navigate를 연결한다. nested interactive 요소를 만들지 않는다.
- [ ] 전체 화면 페이지에 CanvasTopBar와 lazy Excalidraw/CSS를 배치한다. 문서명·참여자·저장 상태·이전 프로젝트 이동을 연결한다.
- [ ] Excalidraw `onChange`→onSceneChange, `onPointerUpdate`→onPresenceChange, 원격 scene→`updateScene`/`addFiles`, collaborators와 readOnly를 연결한다. 프로그램적 scene 적용이 사용자 undo 이력을 오염시키지 않도록 설치된 API 계약을 확인한다.
- [ ] 미저장 이탈은 TanStack Router blocker와 beforeunload를 사용한다. 거부된 변경은 화면에 유지하고 내보내기·재시도·명시적 되돌리기를 제공한다.
- [ ] 페이지·목록·공통 UI 테스트 및 접근성 기본 동작을 검증한다. 기존 메뉴 테스트 실패가 재현되면 관련 범위의 root cause를 확인한 후 최소 회귀 수정만 한다.

## 작업 5: 실제 백엔드 통합·브라우저 검증

추가:

- `backend/tests/whiteboard-editor.integration.test.ts`

기존 참고: `backend/tests/project-detail.integration.test.ts`의 격리 PostgreSQL/migration 구성, `backend/tests/whiteboard-collaboration.test.ts`의 실제 Socket.IO 연결·ack helper.

- [ ] Testcontainers DB에 임시 사용자 2명·workspace memberships·project·document/content를 준비하고 실제 HTTP server, createApp, collaboration을 결합한다. 저장 서비스를 mock하지 않는다.
- [ ] 상세 조회로 initial snapshot을 확인하고 두 실제 socket client를 join한다. 각각 다른 요소 변경을 보내고 peer broadcast·ack를 검증한다.
- [ ] 저장 이벤트를 기다린 후 DB를 조회해 두 요소와 revision이 저장됐는지 검증한다. 고정 sleep 대신 event/조건 timeout을 사용한다.
- [ ] 파일 추가·요소 tombstone을 전송하고 저장된 JSON을 확인한다. socket을 닫고 다시 만들어 REST·join 스냅샷 복원을 확인한다.
- [ ] 무권한 join·문서 삭제 후 소켓 종료·상세 404를 검증한다. 삭제 후 stale join 회귀도 기존 테스트와 함께 실행한다.
- [ ] afterAll에서 sockets·collaboration·DB client·container를 순서대로 종료한다. 실패 경로에서도 정리한다.
- [ ] 브라우저 두 세션에서 문서 진입, 그리기, 이미지, 동기화, 저장 후 새로고침, 재접속·미저장 이탈 경고를 확인한다. 브라우저 접근이 불가능하면 미검증으로 기록하고 완료로 선언하지 않는다.

## 최종 검증·리뷰

- [ ] 작업 시작 전 양쪽 test/lint/build를 실행하고 기존 실패를 기록한다. dev에서 확인했던 메뉴 실패 4개는 작업 worktree에서 재현 여부를 별도로 확인한다.
- [ ] 각 작업별 RED→GREEN 결과를 남긴다. 프론트 상태 전이 및 새 서버 필드의 타입·동작을 집중 리뷰한다.
- [ ] backend: `pnpm test`, `RUN_DATABASE_INTEGRATION_TESTS=1 pnpm exec vitest run tests/whiteboard-editor.integration.test.ts tests/project-detail.integration.test.ts tests/whiteboard-migration.integration.test.ts`, `pnpm lint`, `pnpm build`.
- [ ] frontend: `pnpm test`, `pnpm lint`, `pnpm build`. 실제 브라우저 검증과 별개로 실행한다.
- [ ] 변경 파일 포맷과 `git diff --check`, 의존성 diff, 무관 변경·민감정보 여부를 확인한다.
- [ ] `requesting-code-review`와 `verification-before-completion`을 적용한다. 가능한 독립 리뷰 수단을 사용하고, 사용할 수 없으면 자체 리뷰 한계를 명시한다.
- [ ] Implementation Results에 실제 변경·계획 차이·검증 명령/종료 코드·미해결 항목을 기록한다.

## Implementation Results

### 실제 변경 내용

- 프론트: 상세 GET, 카드·표 진입, 인증된 전체 화면 편집기, lazy Excalidraw, 도형·텍스트·이미지·삭제 동기화, 참여자·커서, DB 저장 상태, 내보내기, 미저장 이탈 보호를 연결했다.
- 협업 훅: 100ms 전송 병합, 단일 in-flight, 동일 update ID 최대 3회 재시도, 미확인 변경 보존·재접속, 저장 장애·복구·문서 삭제·인증 실패 처리를 구현했다.
- 장면: 서버와 같은 version/nonce 우선순위, index 기준 앞뒤 순서 복원, 장면 교체 시 빠진 요소의 tombstone, 파일 버전 충돌·크기 제한 처리를 연결했다.
- 백엔드: join과 sync-required에 실제 savedRevision/persistenceState를 추가했다. dirty·blocked 입장과 재동기화 상태를 기존 테스트에서 검증한다.
- 실제 PostgreSQL 통합 테스트를 추가해 기본 Socket.IO polling 연결, 두 사용자 편집, 이미지·삭제, DB 저장, REST·재입장 복원, 무권한·삭제 문서 접근을 검증했다.

### 계획과 달라진 점 및 리뷰 조치

- FSD 의존 방향을 유지하도록 기본 콘텐츠 타입을 entities/whiteboard-document/model/content.ts에 배치했다.
- 실제 파일 라우트는 projects_.$projectId_.whiteboard-documents.$documentId.tsx이다. 프로젝트 상세 레이아웃에 종속되지 않도록 경로 이스케이프를 사용했고 사용자 URL은 설계와 동일하다.
- 브라우저에서 기존 HTTP 서버의 Express/Socket.IO request listener 등록 순서 문제가 드러났다. 기본 polling 통합 테스트 2개가 ERR_HTTP_HEADERS_SENT로 실패하는 것을 확인한 후, src/server-app.ts의 공통 서버 조립 함수에서 Express를 먼저 연결했다. 운영 진입점과 테스트가 동일한 조립 경로를 사용한다.
- 일시적 join 실패의 영구 차단, 반복 토큰 갱신, 정상 재동기화 후 오류 잔류를 회귀 테스트 3개로 재현하고 수정했다.
- 독립 리뷰의 재조회 실패에 의한 편집기 unmount, 요소 앞뒤 순서 누락, 장면 불러오기 후 이전 도형 부활을 각각 RED→GREEN으로 수정했다.
- REST 인증 실패로 세션이 초기화돼도 기존 편집기와 미확인 장면을 보존한다. 현재 인증과 일치하지 않으면 소켓을 종료하고 읽기 전용으로 제한한다. 신규 진입 가드는 유지하며 기존 미저장 이탈 경고와 내보내기를 사용할 수 있다. 관련 회귀 테스트 2개의 실패·통과를 확인했다.
- 명시적 되돌리기에서 resetScene 호출을 제거했다. 양방향 diff와 요소 순서 비교로 낮은 서버 버전도 적용하며, 프로그램적 초기화를 삭제 이벤트로 보내지 않도록 UI 회귀 테스트로 검증했다.
- 로컬 수동 검증에서 재진입 후 장면이 비는 문제를 재현했다. DB에는 revision과 요소 JSON이 저장됐지만 Excalidraw의 초기·지연 빈 onChange를 전체 삭제로 오인해 모든 요소가 tombstone으로 저장된 것이 원인이었다. 최초 서버 장면 적용 전 이벤트와 현재 Excalidraw API 장면에 맞지 않는 stale 이벤트를 차단하고, 정상 전체 삭제는 허용하는 UI 회귀 테스트를 RED→GREEN으로 확인했다.
- 전체 테스트와 빌드에서 확인된 테스트 fixture의 creatorId 누락, 실제 상세 응답에 없는 creator 타입, Hook ref 선언 순서 린트 오류를 수정했다.
- 원본 dev의 메뉴 실패 4건은 pnpm 8 잠금 파일을 사용한 작업 트리 기준선에서는 재현되지 않았다. 원본 dev의 ignore·lockfile·workspace 파일을 변경하지 않았다.

### 실행한 검증과 결과

잠금 파일 버전 호환을 위해 아래 모든 pnpm 명령은 npx --yes pnpm@8.15.9로 실행했다. 일반 테스트는 /Users/nandev/.agents/skills/nandev-workflow/scripts/rtk-filtered-test.sh wrapper를 사용했고 원래 종료 코드를 확인했다.

| 작업 위치 | 명령                                                                                                                                                                                      | 최종 결과                                     |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| frontend  | pnpm test                                                                                                                                                                                 | 종료 0, 66개 파일·353개 테스트 통과           |
| frontend  | pnpm lint                                                                                                                                                                                 | 종료 0, 오류 0·기존 react-refresh 경고 4      |
| frontend  | pnpm build                                                                                                                                                                                | 종료 0, TypeScript/Vite 빌드 통과             |
| backend   | pnpm test                                                                                                                                                                                 | 종료 0, 543개 통과·DB opt-in 16개 skip        |
| backend   | RUN_DATABASE_INTEGRATION_TESTS=1 pnpm exec vitest run tests/whiteboard-editor.integration.test.ts tests/project-detail.integration.test.ts tests/whiteboard-migration.integration.test.ts | 종료 0, 실제 PostgreSQL 통합 테스트 16개 통과 |
| backend   | pnpm lint                                                                                                                                                                                 | 종료 0                                        |
| backend   | pnpm build                                                                                                                                                                                | 종료 0                                        |
| 작업 루트 | git diff --check                                                                                                                                                                          | 종료 0                                        |

- frontend 기준선은 326개 통과였다. 최종 신규 검증은 상세 API·진입·동기화·상태 전이·오류 보존·되돌리기 UI를 포함한다.
- DB 테스트는 기존 데이터베이스를 사용하지 않고 Testcontainers PostgreSQL과 실제 migration·서비스·Socket.IO를 사용했다.
- 브라우저: 격리 PostgreSQL/Valkey, API 4100, frontend 5175에서 로그인→프로젝트→문서 진입, 두 사용자 도형·커서 실시간 전달, 저장됨 표시, 새로고침 후 두 도형 복원을 확인했다.
- 이미지: 실제 편집기 drop 입력으로 프로젝트의 테스트용 로고를 추가했다. 상세 API 200에서 revision 6, rectangle·ellipse·image, 파일 1개가 저장됐음을 확인했다. 두 사용자 이미지·tombstone·재입장 복원은 실제 DB 통합 테스트도 통과했다.
- 서버 중단 후 브라우저에서 동기화 단절·편집 잠금·재연결 안내·내보내기 유지가 표시됨을 확인했다.
- 독립 리뷰를 두 차례 반영하고 최종 소스 재검토에서 알려진 중요 이슈가 모두 해소됐음을 확인했다.
- 브라우저 검증용 임시 스크립트 .verify-browser.ts를 삭제했다. 종료 후 org.testcontainers=true 컨테이너가 0개임을 확인했으며 원본 프로젝트 데이터는 건드리지 않았다.
- 테스트에는 기존 jsdom scrollTo 진단이 남으며, Vite는 Excalidraw/Mermaid 관련 대형 청크 경고를 낸다. 테스트·빌드 실패는 아니다.
- 로컬 DB에서 문제를 재현한 두 문서의 요소 payload는 남아 있지만 모두 isDeleted=true이다. 실제 사용자 삭제와 버그로 인한 삭제를 자동 판별할 수 없어 데이터 복구는 사용자 확인 전 수행하지 않았다.

### 검증 한계와 남은 후속 작업

- 브라우저 탭 두 개는 같은 쿠키 프로필이었다. 서로 다른 사용자 토큰으로 동시 편집을 확인했지만 장시간 인증 갱신 격리는 별도 프로필 E2E로 확인할 수 있다.
- 브라우저의 인증 만료+REST 실패+자동 로그인 이동 취소 결합, native beforeunload 대화상자는 수동 종단 검증하지 않았다. 해당 장면 보존·소켓 차단은 자동 회귀 테스트, 이탈 경고 연결은 코드 리뷰로 검증했다.
- 이미지 추가 후 마지막 화면 캡처는 Orca의 비가시 탭 screenshot timeout으로 확보하지 못했다. 이미지 저장·복원 근거는 실제 REST 응답과 DB/Socket.IO 통합 테스트이다.
- 단일 서버·온라인 편집 전제를 유지한다. 다중 서버, 오프라인 신규 편집, 브라우저 종료 후 미전송 복구, 대용량 이미지 저장소는 이번 범위가 아니다.
- 커밋·push·PR·dev 병합은 사용자 후속 요청 시에만 수행한다. 원본 dev에 별도 미커밋 변경이 있으므로 병합 시 보존해야 한다.

### 재진입 데이터 유실 후속 수정 (2026-09-21)

- 실제 저장 실패가 아니라 Excalidraw의 초기·이전 장면 `onChange`를 로컬 전체 삭제로 오인해 tombstone을 저장한 경쟁 조건이었다.
- 계획 대비 `WhiteboardCanvas`에 마지막으로 적용 완료한 서버 장면 경계를 추가했다. 새 원격 장면 적용 전 이전 장면 이벤트와 현재 API 장면에 맞지 않는 stale 이벤트는 저장하지 않는다.
- 회귀 테스트는 최초 빈 이벤트, 지연 빈 이벤트, 원격 장면 전환 직전 이전 이벤트를 검증하며 모두 통과했다.
- 검증: frontend 전체 test·lint(오류 0, 기존 경고 4)·build, 실제 PostgreSQL/Socket.IO 저장·재조회 통합 테스트, `git diff --check`를 실행했다.
- 기존 두 문서의 요소 payload는 DB에 남아 있으나 모두 `isDeleted=true`이다. 실제 삭제와 버그 삭제를 자동 판별할 수 없어 사용자 확인 전 복구하지 않는다.

### 다중 사용자 도형 삭제 오인 후속 수정 (2026-09-21)

- 실제 로컬 DB에서 협업 테스트 문서의 revision이 31까지 증가했지만 14개 요소가 모두 tombstone으로 저장된 상태를 확인했다.
- 서버의 두 사용자 join, scene update ACK, 상대 사용자 broadcast, PostgreSQL 저장, REST 재조회는 정상 동작했다.
- 프론트가 부분·빈 장면에서 누락된 기존 요소를 삭제로 합성하던 로직을 제거했다. 새 버전 요소와 명시적인 tombstone만 기존 장면에 병합한다.
- 회귀 테스트를 RED→GREEN으로 확인했고 frontend 66개 파일·354개 테스트, lint 오류 0개, build를 통과했다.
- 기존 손상 문서는 자동 복구하지 않았다. 실제 사용자 삭제와 버그 삭제를 구분할 수 없어 사용자 확인이 필요하다.
