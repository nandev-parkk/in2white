# 화이트보드 상세·실시간 편집·콘텐츠 저장 설계

## 상태와 범위

- 작업: Feature / Deep. 설계·계획 승인 후 구현 및 검증 완료. 실제 결과와 검증 한계는 구현 계획의 Implementation Results를 참고한다.
- 기준: `dev`의 `13d518b`. 작업 브랜치: `nandev-parkk/feat-whiteboard-editor`.
- 작업 경로: `/Users/nandev/orca/workspaces/in2white/feat-whiteboard-editor`.
- 기존 dev 작업 트리의 ignore·pnpm 변경은 가져오거나 덮어쓰지 않는다. 커밋·push는 요청 전 실행하지 않는다.
- 사용자는 프론트엔드와 백엔드 모두에서 문서를 열고 공동 편집한 내용을 저장·복원할 수 있는 완결된 기능을 요청했다.

## 목표와 성공 조건

1. 프로젝트 문서 카드·표에서 상세 편집기로 진입한다. 직접 URL 접속과 새로고침에도 문서를 연다.
2. 워크스페이스 멤버 두 명이 같은 문서의 서로 다른 요소를 편집하면 양쪽 화면과 DB에 변경이 남는다.
3. 도형·텍스트·이미지, 요소 삭제, 참여자·커서·선택 요소를 기존 서버 계약으로 동기화한다.
4. 실제 DB 저장 확인을 기준으로 저장 중·저장됨·연결 끊김·저장 실패 상태를 표시한다.
5. 토큰 만료·일시 연결 단절·저장 장애·삭제를 처리하고 미확인 변경을 조용히 버리지 않는다.
6. 페이지를 닫았다가 다시 열면 마지막으로 저장된 내용이 복원된다.

기존 백엔드 단일 인스턴스 전제를 유지한다. 오프라인 신규 편집, 브라우저 종료 후 미전송 데이터 복구, 버전 히스토리, object storage, 다중 서버 동기화는 제외한다. 연결이 끊기기 전에 발생한 미확인 변경의 메모리 보존·재전송은 범위에 포함한다.

## 접근 방식

설치된 Excalidraw 0.18 계열의 캔버스와 기존 Socket.IO 서버를 연결한다. 직접 캔버스 구현은 필요하지 않으며, CRDT 도입은 기존 병합·저장 계약을 불필요하게 교체하므로 하지 않는다. 프론트에는 필요한 `socket.io-client`만 직접 의존성으로 추가한다. 기존 CanvasTopBar·PresenceAvatarStack·세션 갱신 함수를 재사용한다.

기존 backend 설계의 `files` 전송 필드는 hardening 이후 `fileUpdates`로 변경되었다. 구현은 현재 `whiteboard-socket.events.ts`, `whiteboard-protocol.schema.ts`를 기준으로 한다.

## 화면과 상세 조회

- URL: `/workspaces/$workspaceId/projects/$projectId/whiteboard-documents/$documentId`.
- 인증 라우트 보호는 기존 `redirectIfUnauthenticated`를 사용한다.
- 전체 화면 편집기: 상단에 뒤로가기·문서명·저장 상태·참여자, 아래 Excalidraw. 일반 목록 사이드바는 편집 화면에 배치하지 않는다.
- 카드·표의 문서 열기는 키보드 접근 가능한 링크 또는 버튼으로 제공한다. 이름 변경·삭제 메뉴 클릭이 편집기 이동을 발생시키지 않게 한다.
- 기존 생성 후 모달 닫기 동작은 유지하고 목록에서 문서를 열 수 있게 한다.
- REST 상세 조회 함수 `getWhiteboardDocumentRequest(workspaceId, projectId, documentId, accessToken)`를 추가한다.
- 기존 GET 상세 응답의 문서 정보·canvasContent·revision·lastSavedAt을 사용한다. 로딩·재시도 가능한 실패·접근 불가 상태를 각각 렌더링한다.
- REST 스냅샷은 초기 표시용이다. 실시간 입장 ack의 스냅샷을 적용한 뒤에만 편집을 허용한다. 늦게 완료된 REST 요청은 입장 완료 후 장면을 덮어쓰지 않는다.
- Excalidraw와 CSS는 편집 화면에서 로드한다. 연결 대기·단절·저장 차단·삭제 상태에서는 읽기 전용으로 전환한다.

## 클라이언트 상태와 데이터 흐름

편집 상태는 문서별 협업 훅 안에서 관리하고 전역 스토어를 추가하지 않는다. 순수 병합·차이 계산 함수와 React 연결 훅, 편집 UI를 구분한다.

1. 상세 조회 후 동일 API origin에 Socket.IO를 연결한다. handshake는 `auth.accessToken`을 사용한다.
2. `whiteboard:join` ack로 canonical 스냅샷·참여자·저장 상태를 적용한다.
3. Excalidraw `onChange`에서 전체 장면 대신 변경된 요소와 파일만 추출한다. 삭제 요소는 tombstone으로 전송한다. 사용자별 appState는 저장하지 않는다.
4. 요소 병합은 서버와 동일하게 높은 version, 동률이면 높은 versionNonce를 우선한다. 파일은 version 기반이며 같은 version의 다른 바이너리를 임의로 덮어쓰지 않는다.
5. 100ms 단위로 최신 변경을 모으며 in-flight 요청은 하나만 둔다. 동일 요청 재전송은 같은 clientUpdateId를 쓴다. 전송 이후 추가 편집은 다음 배치로 보존한다.
6. `whiteboard:scene:updated`와 ack의 canonical 요소·파일을 적용한다. 서버 반영 때문에 발생한 onChange를 다시 전송하는 루프를 차단한다. 오래된 ack가 더 최신 로컬 편집을 덮어쓰지 않게 한다.
7. presence는 50ms 단위로 제한하고 volatile로 전송한다. 해당 탭의 사용자 자신은 원격 커서로 렌더링하지 않는다.
8. 문서 전환·unmount 시 소켓·이벤트·timer를 해제한다. 이전 문서의 늦은 callback이 새 문서 상태를 바꾸지 못하도록 세대 또는 취소 상태를 검사한다.

## 저장 상태와 백엔드 보완

현재 `revision`은 canonical 장면 번호이며 실제 저장 완료를 의미하지 않는다. 입장 응답은 최신 메모리 장면을 반환할 수 있으므로 다음 필드를 additive하게 추가한다.

- `whiteboard:join` 성공 ack: 최상위 `savedRevision`, `persistenceState`.
- `whiteboard:sync:required`: 최상위 `savedRevision`, `persistenceState`.
- 값은 Room의 `scene.persistedRevision`과 현재 persistence 상태에서 가져온다. 기존 필드와 REST 계약은 유지한다.

프론트는 `revision`, `savedRevision`, 미전송·미확인 로컬 변경을 별개로 관리한다. 저장됨 조건은 연결·입장 완료, 미확인 로컬 변경 없음, savedRevision이 현재 canonical revision 이상인 경우다. 단순 scene ack, presence, recovered만으로 저장됨을 표시하지 않는다.

서버의 기존 500ms quiet/2초 max 자동 저장, 조건부 revision 저장, 저장 실패 재시도·blocked/recovered를 재사용한다. 신규 REST 저장 API와 DB migration은 추가하지 않는다. `sync:required`는 미저장 병합 결과일 수 있으므로 저장 완료 신호로 해석하지 않는다.

## 재접속·오류·권한 계약

- 일반 연결 단절: 편집을 잠그고 현재 장면·pending 변경을 메모리에 유지한다. 자동 재접속 후 join으로 권한과 최신 상태를 확인하고 pending 변경을 기존 병합 규칙으로 반영·재전송한다.
- ack 타임아웃: 동일 clientUpdateId로 최대 3회 재시도한다. 계속 실패하면 재입장해 상태를 동기화하며, timeout을 성공으로 취급하지 않는다.
- 토큰 만료: 기존 single-flight `refreshAccessToken()`을 사용한다. 성공 시 새 토큰으로 연결·입장한다. 실패하면 로그인 필요 상태를 표시하고 편집·자동 재연결을 중지한다.
- 접근 권한: workspace 멤버는 편집 가능하다. 문서 이름 변경·삭제는 기존 owner/creator 규칙을 유지한다. 즉시 멤버 제거 알림은 기존 V1과 같이 제외하고 재입장·토큰 만료 시 재검증한다.
- 삭제·미존재·접근 거부: 재시도 루프를 중지하고 편집을 잠근다. 프로젝트로 돌아갈 수 있게 한다. 미확인 장면은 사용자 이탈 전까지 보존한다.
- 저장 장애: save-failed 또는 PERSISTENCE_UNAVAILABLE에서 저장 실패를 표시하고 편집을 잠근다. recovered 이후에만 해제하며 saved 이벤트의 revision으로 저장 상태를 판단한다.
- payload·파일 충돌·Room 한도: 이해 가능한 오류를 표시한다. 실패 배치를 성공 처리하거나 pending 데이터를 무한 누적하지 않는다. 거부된 로컬 장면을 보존하고 재시도·되돌리기 또는 Excalidraw 파일 내보내기를 제공한다.
- 클라이언트의 배치 크기는 2,000요소·1MiB 아래로 제한한다. 단일 파일이 한도를 넘으면 전송 전 알리고 자동 재전송하지 않는다. 서버의 검증은 그대로 유지한다.
- 서버 draining·무결성 오류: 읽기 전용과 오류 상태를 표시하고 무한 재연결을 막는다.
- 미저장·미확인 변경이 있을 때 SPA 이탈 및 브라우저 닫기 경고를 제공한다. 영구 오프라인 저장을 보장하지 않는다는 한계를 UI에서 숨기지 않는다.
- 사용자 콘텐츠·토큰·비밀번호·이미지 dataURL을 로그에 남기지 않는다.

## 검증과 완료 기준

- 프론트 순수 로직: diff·병합·tombstone·파일 변경·오래된 ack·크기 제한·echo 억제.
- 프론트 훅: 입장/저장 상태, 타임아웃 재시도, reconnect·인증 갱신, save-failed/recovered, 삭제, 문서 전환 cleanup.
- 화면: 카드·표·딥링크, 키보드 이동, 로딩/404/재시도, 상단 상태와 편집 잠금. 기존 메뉴 실패는 기준선과 비교하고 기능 경로를 막으면 원인을 확인해 최소 수정한다.
- 백엔드: dirty/blocked Room 입장 시 실제 savedRevision/persistenceState 계약, sync-required 저장 상태 계약, 기존 socket/Room 회귀 테스트.
- 실제 격리 PostgreSQL + 실제 Socket.IO 클라이언트 두 개: 상세 조회→각각 다른 요소 수정→양쪽 동기화→DB 저장→소켓 재생성→REST·join 복원. 이미지·tombstone과 삭제·권한 거부도 검증한다.
- 브라우저: 두 세션 편집·재접속, 저장 확인 후 새로고침 복원, 메뉴·내비게이션. 실행 불가능한 항목은 완료로 표시하지 않는다.
- 양쪽 test/lint/build 및 git diff --check. 작업 전 기존 테스트 실패와 신규 회귀를 구분한다.

구현 결과와 실제 검증 명령은 대응하는 구현 계획의 Implementation Results에 기록한다.
