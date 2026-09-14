# 화이트보드 문서 이름 변경 백엔드 설계

## 상태

설계 승인 완료 · 문서화 완료

## 목표

인증된 워크스페이스 Owner 또는 화이트보드 문서 생성자가 문서 이름을 변경할 수 있는 PATCH API를 추가한다. 이름 변경 응답은 캔버스 데이터가 포함된 전체 문서를 반환하지 않고, 변경 결과에 필요한 식별자·이름·수정 시각만 반환한다.

## 근거 문서

- [`PRODUCT.md`](../../../PRODUCT.md)
  - 화이트보드 문서의 캔버스 콘텐츠는 모든 워크스페이스 멤버가 실시간으로 편집한다.
  - 문서 이름 변경과 삭제는 워크스페이스 Owner 또는 해당 문서를 생성한 멤버 본인만 수행한다.
  - 캔버스 자동 저장과 문서 이름 변경은 별도의 사용자 흐름이다.
- [`2026-09-09-whiteboard-document-list-backend-design.md`](./2026-09-09-whiteboard-document-list-backend-design.md)
  - 문서 상세·실시간 편집·자동 저장은 목록 API와 별도 기능으로 분리한다.
  - `canvasContent`는 목록 응답에 포함하지 않는다.
- 기존 프로젝트 수정 API
  - `routes → controllers → services → db/schema` 계층을 유지한다.
  - 멤버십을 먼저 확인하고, Owner 또는 리소스 생성자에게만 수정 권한을 준다.
  - 수정 시 `updatedAt`을 현재 시각으로 갱신한다.

## 범위

### 포함

- `PATCH /workspaces/:workspaceId/projects/:projectId/whiteboard-documents/:documentId` API
- 화이트보드 문서 `name` 변경
- 이름 trim 및 1~50자 검증
- 워크스페이스 멤버십 확인
- 요청 프로젝트가 활성 상태이고 워크스페이스에 속하는지 확인
- 문서가 요청 프로젝트에 속하는지 확인
- Owner 또는 문서 Creator 권한 확인
- `updatedAt` 갱신
- `id`, `name`, `updatedAt`만 포함한 성공 응답
- 인증·입력·권한·미존재·DB 오류 테스트

### 제외

- `canvasContent` 수정 및 자동 저장
- 실시간 협업·Presence·동시성 제어
- 화이트보드 문서 상세 조회
- 화이트보드 문서 삭제
- 문서 생성자 변경
- DB schema 또는 migration 변경
- 프론트엔드 수정 화면 구현

## API 계약

### 요청

```http
PATCH /workspaces/:workspaceId/projects/:projectId/whiteboard-documents/:documentId
Authorization: Bearer <access-token>
Content-Type: application/json
```

```json
{
  "name": "  변경된 문서 이름  "
}
```

### 경로 파라미터

| 필드 | 규칙 |
| --- | --- |
| `workspaceId` | UUID |
| `projectId` | UUID |
| `documentId` | UUID |

### 본문 규칙

| 필드 | 규칙 | 정규화 |
| --- | --- | --- |
| `name` | 문자열, 1~50자 | 앞뒤 공백 제거 |

`name`은 필수다. 누락·null·공백 문자열·문자열이 아닌 값·51자 이상인 값은 `400 VALIDATION_ERROR`다. 요청에서 반영하는 필드는 `name`뿐이며, 캔버스 데이터는 이 API에서 받지 않는다.

### 성공 응답

HTTP `200 OK`를 반환한다.

```json
{
  "whiteboardDocument": {
    "id": "document-uuid",
    "name": "변경된 문서 이름",
    "updatedAt": "2026-09-09T00:05:00.000Z"
  }
}
```

성공 응답과 DB `returning()` projection에는 `canvasContent`, `projectId`, `creatorId`, `createdAt`을 포함하지 않는다. 클라이언트가 이미 알고 있는 문서의 변경 결과만 전달해 캔버스 JSONB가 이름 변경 응답에 섞이지 않도록 한다.

이름이 기존 값과 같아도 유효한 수정 요청으로 처리하며 `updatedAt`은 현재 시각으로 갱신한다.

## 권한 및 오류 계약

### 권한 규칙

1. `authenticate` middleware가 Access Token을 검증하고 `req.user`를 설정한다.
2. controller가 `requireUser(req)`로 인증 사용자 ID를 가져온다.
3. service가 `workspace_memberships`에서 `workspaceId`와 사용자 ID를 조회한다.
4. 멤버십이 없으면 문서나 프로젝트를 조회하기 전에 `404 WORKSPACE_NOT_FOUND`를 반환한다.
5. 멤버십이 있으면 활성 프로젝트를 `projectId`와 `workspaceId`로 확인한다.
6. 프로젝트가 없거나 다른 워크스페이스에 속하거나 삭제된 경우 `404 PROJECT_NOT_FOUND`를 반환한다.
7. 문서를 `documentId`와 `projectId`로 확인한다. 문서가 없거나 다른 프로젝트에 속하면 `404 WHITEBOARD_DOCUMENT_NOT_FOUND`를 반환한다.
8. 멤버십 role이 `owner`이거나 문서의 `creatorId`가 현재 사용자 ID와 같으면 수정할 수 있다.
9. 그 외의 `member`는 `403 WHITEBOARD_DOCUMENT_UPDATE_FORBIDDEN`을 반환한다.

멤버십·프로젝트·문서 확인과 update는 하나의 `db.transaction` 안에서 수행한다. 비멤버는 프로젝트와 문서의 존재 여부를 확인할 수 없도록 멤버십을 가장 먼저 검사한다.

### 오류 응답

기존 `errorHandlerMiddleware` 형식을 사용한다.

| 상황 | 상태 | 코드 |
| --- | ---: | --- |
| 인증 헤더가 없거나 유효하지 않음 | 401 | `UNAUTHORIZED` |
| UUID 또는 name 검증 실패 | 400 | `VALIDATION_ERROR` |
| 사용자가 워크스페이스 멤버가 아님 | 404 | `WORKSPACE_NOT_FOUND` |
| 프로젝트가 없거나 다른 워크스페이스에 속하거나 삭제됨 | 404 | `PROJECT_NOT_FOUND` |
| 문서가 없거나 요청 프로젝트에 속하지 않음 | 404 | `WHITEBOARD_DOCUMENT_NOT_FOUND` |
| Owner도 아니고 문서 Creator도 아님 | 403 | `WHITEBOARD_DOCUMENT_UPDATE_FORBIDDEN` |
| 예상하지 못한 DB 오류 | 500 | `INTERNAL_SERVER_ERROR` |

### 오류 메시지

기존 메시지 상수 패턴에 다음 문구를 추가한다.

```ts
WHITEBOARD_DOCUMENT_ID_INVALID: "유효하지 않은 화이트보드 문서 ID입니다",
WHITEBOARD_DOCUMENT_NOT_FOUND: "화이트보드 문서를 찾을 수 없습니다",
WHITEBOARD_DOCUMENT_UPDATE_FORBIDDEN: "화이트보드 문서를 수정할 권한이 없습니다",
```

이름 누락·공백·길이 초과는 기존 `WHITEBOARD_DOCUMENT_NAME_REQUIRED`, `WHITEBOARD_DOCUMENT_NAME_TOO_LONG`을 재사용한다.

## 아키텍처 및 데이터 흐름

1. `whiteboardDocumentRouter`의 `PATCH /:documentId` route가 `authenticate` middleware를 실행한다.
2. controller가 `requireUser(req)`를 호출한다.
3. controller가 `whiteboardDocumentUpdateParamsSchema`로 세 경로 UUID를 파싱한다.
4. controller가 `updateWhiteboardDocumentSchema`로 body의 name을 trim·검증한다.
5. controller가 `updateWhiteboardDocument({ workspaceId, projectId, documentId, userId, name })`을 호출한다.
6. service가 transaction 안에서 멤버십을 조회한다.
7. service가 활성 프로젝트를 조회한다.
8. service가 해당 프로젝트에 속한 문서의 `creatorId`를 조회한다.
9. service가 Owner 또는 Creator 권한을 확인한다.
10. service가 `name`, `updatedAt`만 update하고 `id`, `name`, `updatedAt`만 `returning()`한다.
11. controller가 `{ whiteboardDocument }`를 HTTP 200으로 반환한다.

수정 query의 조건은 문서 ID와 프로젝트 ID를 함께 사용한다.

```ts
and(
  eq(whiteboardDocuments.id, documentId),
  eq(whiteboardDocuments.projectId, projectId),
)
```

update projection은 다음 필드로 제한한다.

```ts
.returning({
  id: whiteboardDocuments.id,
  name: whiteboardDocuments.name,
  updatedAt: whiteboardDocuments.updatedAt,
})
```

## 모듈 경계 및 변경 범위

- 수정: `backend/src/constants/messages.ts`
  - 문서 ID·미존재·수정 권한 오류 메시지를 추가한다.
- 수정: `backend/src/schemas/whiteboard-document.schema.ts`
  - 수정용 세 경로 UUID schema와 name body schema를 추가한다.
- 수정: `backend/src/services/whiteboard-document.service.ts`
  - `UpdateWhiteboardDocumentInput`과 `updateWhiteboardDocument` 유스케이스를 추가한다.
  - transaction, 멤버십, 프로젝트, 문서, 권한, 최소 반환 projection을 담당한다.
- 수정: `backend/src/controllers/whiteboard-document.controller.ts`
  - 수정 handler를 추가해 params/body 파싱과 200 응답을 담당한다.
- 수정: `backend/src/routes/whiteboard-document.routes.ts`
  - 인증된 `PATCH /:documentId` route를 추가한다.
- 수정: `backend/tests/whiteboard-document.test.ts`
  - 성공·정규화·projection·권한·입력·미존재·DB 오류 계약을 검증한다.

기존 화이트보드 생성·목록 route와 응답, `whiteboard-documents` schema/migration, `routes/index.ts`, 공통 오류 처리 계층은 변경하지 않는다.

## 검증 계획

`backend/tests/whiteboard-document.test.ts`에 기존 Supertest, Vitest, Drizzle mock 패턴으로 다음을 검증한다.

1. Owner가 다른 Creator의 문서 이름을 변경할 수 있다.
2. Member가 자신이 생성한 문서 이름을 변경할 수 있다.
3. 이름 앞뒤 공백이 제거되고 200 응답이 `id`, `name`, `updatedAt`만 반환한다.
4. 응답과 update returning projection에 `canvasContent`가 포함되지 않는다.
5. 비멤버는 404 `WORKSPACE_NOT_FOUND`이고 project/document/update query를 실행하지 않는다.
6. 프로젝트 없음·타 워크스페이스·삭제 프로젝트는 404 `PROJECT_NOT_FOUND`이고 document/update를 실행하지 않는다.
7. 문서 없음·타 프로젝트 문서는 404 `WHITEBOARD_DOCUMENT_NOT_FOUND`이고 update를 실행하지 않는다.
8. Creator가 아닌 Member는 403 `WHITEBOARD_DOCUMENT_UPDATE_FORBIDDEN`이고 update를 실행하지 않는다.
9. 인증 없음은 401, UUID·name 오류는 400이며 DB transaction을 호출하지 않는다.
10. 멤버십·프로젝트·문서·update query 오류는 500으로 변환된다.
11. 기존 화이트보드 생성·목록 테스트가 계속 통과한다.

구현 후 다음 명령을 실행한다.

```bash
pnpm --dir backend test -- tests/whiteboard-document.test.ts
pnpm --dir backend test
pnpm --dir backend lint
pnpm --dir backend build
pnpm --dir backend exec prettier --check src tests
git diff --check
```

## 결정 사항

- 이번 수정 기능은 이름 변경만 포함하며 캔버스 자동 저장은 별도 기능으로 둔다.
- API는 `PATCH /workspaces/:workspaceId/projects/:projectId/whiteboard-documents/:documentId`로 한다.
- 수정 권한은 워크스페이스 Owner 또는 문서 Creator에게만 부여한다.
- 멤버십 → 활성 프로젝트 → 프로젝트 소속 문서 → 권한 순서로 확인한다.
- 성공 응답은 `{ whiteboardDocument: { id, name, updatedAt } }`로 최소화한다.
- `canvasContent`는 select/update returning/HTTP 응답 어느 곳에도 포함하지 않는다.
- DB schema와 migration은 변경하지 않는다.
- Git commit·push·merge·PR은 사용자의 별도 요청 없이는 실행하지 않는다.
