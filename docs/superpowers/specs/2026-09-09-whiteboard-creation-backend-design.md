# 화이트보드 문서 생성 백엔드 설계

## 상태

설계 승인 완료 · 구현 및 최종 리뷰 수정 반영 완료 · 자체 검토 완료

## 목표

인증된 워크스페이스 Owner 또는 Member가 활성 프로젝트 안에 화이트보드 문서를 생성할 수 있도록 `POST /workspaces/:workspaceId/projects/:projectId/whiteboard-documents` API를 추가한다.

## 근거 문서

- [`PRODUCT.md`](../../../PRODUCT.md)
  - Whiteboard Document는 프로젝트에 속하며 이름, 생성자, 캔버스 콘텐츠, 생성일, 최종 수정일을 가진다.
  - Owner와 Member 모두 화이트보드 문서를 생성할 수 있다.
  - 워크스페이스 비멤버는 하위 프로젝트와 화이트보드 문서에 접근할 수 없다.
- [`DESIGN.md`](../../../DESIGN.md)
  - 화이트보드 생성 시 사용자가 직접 입력하는 값은 이름 하나뿐이다.
- 기존 프로젝트 API 구현
  - `backend/src/routes/project.routes.ts`
  - `backend/src/controllers/project.controller.ts`
  - `backend/src/services/project.service.ts`
  - `backend/src/schemas/project.schema.ts`
- 프로젝트 삭제 설계
  - 삭제된 프로젝트는 활성 리소스 조회·수정·삭제 대상에서 제외한다.
  - 하위 화이트보드 문서는 보존되지만 이후 화이트보드 문서 API는 상위 프로젝트의 활성 상태를 확인해야 한다.

## 범위

### 포함

- 인증된 사용자의 화이트보드 문서 생성 API
- `workspaceId`, `projectId`, 문서 이름 입력값 검증 및 정규화
- 요청 사용자의 워크스페이스 멤버십 확인
- 프로젝트가 요청 워크스페이스에 속하며 삭제되지 않았는지 확인
- 빈 Excalidraw 캔버스 콘텐츠를 가진 문서 생성
- 생성 결과 응답
- 성공, 인증 실패, 입력 오류, 비멤버, 프로젝트 없음, 삭제된 프로젝트, DB 오류 테스트

### 제외

- 화이트보드 문서 목록·상세·수정·삭제 API
- Excalidraw 캔버스 데이터 저장·자동 저장 API
- WebSocket 기반 실시간 동기화 및 Presence
- 문서 미리보기 생성
- 문서명 중복 방지
- `whiteboard_documents` 테이블 또는 마이그레이션 변경
- 프런트엔드 생성 화면과 API 연동

## 접근법 비교

### 1. 워크스페이스와 프로젝트를 모두 포함한 중첩 경로 — 채택

`POST /workspaces/:workspaceId/projects/:projectId/whiteboard-documents`

- 기존 프로젝트 API의 `/workspaces/:workspaceId/projects` 계층과 일관된다.
- 멤버십과 프로젝트 소속 관계를 요청 경로에서 명확하게 표현한다.
- 서비스가 워크스페이스 비멤버와 다른 워크스페이스의 프로젝트를 구분하지 않고 안전하게 숨길 수 있다.
- 경로가 길어지지만 현재 도메인의 `Workspace → Project → Whiteboard Document` 계층을 가장 정확하게 반영한다.

### 2. 프로젝트만 포함한 중첩 경로

`POST /projects/:projectId/whiteboard-documents`

- 경로는 짧지만 워크스페이스 컨텍스트를 프로젝트 조회로 복원해야 한다.
- 기존 `/workspaces/:workspaceId/projects` API와 라우팅 규칙이 달라진다.
- 비멤버 오류를 워크스페이스 기준으로 일관되게 처리하기 어렵다.

### 3. 최상위 컬렉션 경로

`POST /whiteboard-documents`와 본문의 `projectId`

- 리소스 생성 자체는 단순하지만 계층 관계가 경로에 드러나지 않는다.
- 잘못된 프로젝트 ID와 권한 검증 책임이 본문 계약에 섞인다.
- 현재 저장소의 계층형 API 스타일과 맞지 않는다.

## API 계약

### 요청

```http
POST /workspaces/:workspaceId/projects/:projectId/whiteboard-documents
Authorization: Bearer <access-token>
Content-Type: application/json
```

```json
{
  "name": "아이디어 스케치"
}
```

경로의 `workspaceId`와 `projectId`는 UUID여야 한다.

| 필드 | 타입 | 필수 | 규칙 |
|---|---|---:|---|
| `name` | string | 예 | 앞뒤 공백 제거 후 1~50자 |

동일 프로젝트 안에서 같은 이름의 문서를 여러 개 생성할 수 있다. `creatorId`는 인증 토큰의 사용자 ID로 설정한다. `canvasContent`는 DB 기본값인 빈 객체 `{}`를 사용하며 클라이언트 입력을 받지 않는다.

### 성공 응답

HTTP `201 Created`를 반환한다.

```json
{
  "whiteboardDocument": {
    "id": "whiteboard-document-uuid",
    "projectId": "project-uuid",
    "name": "아이디어 스케치",
    "creatorId": "user-uuid",
    "canvasContent": {},
    "createdAt": "2026-09-09T00:00:00.000Z",
    "updatedAt": "2026-09-09T00:00:00.000Z"
  }
}
```

응답은 Drizzle이 반환한 `whiteboard_documents` 행을 사용하고 날짜는 Express JSON 직렬화에 따라 ISO 문자열로 전달한다.

### 오류 응답

기존 `errorHandlerMiddleware` 형식을 사용한다.

| 상황 | 상태 | 코드 |
|---|---:|---|
| 인증 헤더가 없거나 유효하지 않음 | 401 | `UNAUTHORIZED` |
| `workspaceId` 또는 `projectId`가 UUID가 아님 | 400 | `VALIDATION_ERROR` |
| 이름이 없거나 공백뿐이거나 50자를 초과함 | 400 | `VALIDATION_ERROR` |
| 사용자가 해당 워크스페이스의 멤버가 아님 | 404 | `WORKSPACE_NOT_FOUND` |
| 프로젝트가 없거나, 다른 워크스페이스에 속하거나, 삭제됨 | 404 | `PROJECT_NOT_FOUND` |
| 예상하지 못한 DB 오류 | 500 | `INTERNAL_SERVER_ERROR` |

비멤버에게는 워크스페이스와 하위 리소스의 존재 여부를 노출하지 않기 위해 프로젝트 조회보다 멤버십 검사를 먼저 수행한다. 멤버십을 통과한 사용자에게도 다른 워크스페이스의 프로젝트나 삭제된 프로젝트는 `404 PROJECT_NOT_FOUND`로 동일하게 처리한다. Owner와 Member 모두 생성할 수 있으므로 별도의 `403` 생성 권한 오류는 없다.

## 아키텍처 및 데이터 흐름

1. `authenticate` 미들웨어가 Access Token을 검증하고 `req.user`를 설정한다.
2. 컨트롤러가 `requireUser(req)`로 인증 사용자를 가져온다.
3. 컨트롤러가 경로 파라미터와 요청 본문을 Zod 스키마로 검증한다.
4. 컨트롤러가 `createWhiteboardDocument({ workspaceId, projectId, name, creatorId })` 서비스를 호출한다.
5. 서비스는 하나의 DB 트랜잭션 안에서 요청자의 워크스페이스 멤버십을 확인한다.
6. 멤버십이 없으면 `404 WORKSPACE_NOT_FOUND`를 발생시킨다.
7. 서비스는 `projects.id`, `projects.workspaceId`, `projects.deletedAt IS NULL` 조건으로 활성 프로젝트를 확인한다.
8. 프로젝트가 없거나 요청 워크스페이스에 속하지 않거나 삭제되었으면 `404 PROJECT_NOT_FOUND`를 발생시킨다.
9. 서비스는 `whiteboard_documents`에 `projectId`, 정규화된 `name`, `creatorId`를 삽입한다. `canvasContent`, `createdAt`, `updatedAt`은 DB 기본값을 사용한다.
10. 컨트롤러가 `{ whiteboardDocument }`를 HTTP 201로 응답한다.

멤버십 확인, 활성 프로젝트 확인, 문서 삽입은 하나의 트랜잭션으로 묶는다. 이는 검증 이후 상위 리소스 상태가 바뀌는 경쟁 조건을 줄이고 기존 프로젝트 생성 서비스의 트랜잭션 패턴을 유지한다.

## 모듈 경계와 변경 범위

- 추가: `backend/src/schemas/whiteboard-document.schema.ts`
  - 경로 파라미터와 생성 본문 스키마를 정의한다.
- 추가: `backend/src/services/whiteboard-document.service.ts`
  - 멤버십 확인, 활성 프로젝트 확인, 문서 생성을 하나의 유스케이스로 제공한다.
- 추가: `backend/src/controllers/whiteboard-document.controller.ts`
  - 인증 사용자 추출, 입력 검증, 응답 직렬화를 담당한다.
- 추가: `backend/src/routes/whiteboard-document.routes.ts`
  - `POST /`를 인증 라우트로 연결한다.
- 수정: `backend/src/routes/index.ts`
  - `/workspaces/:workspaceId/projects/:projectId/whiteboard-documents`에 라우터를 마운트한다.
- 수정: `backend/src/constants/messages.ts`
  - 문서 이름과 식별자 검증 메시지를 추가한다.
- 추가: `backend/tests/whiteboard-document.test.ts`
  - API 계약과 서비스 DB 호출 경계를 검증한다.

`backend/src/db/schema/whiteboard-documents.ts`에는 필요한 컬럼, 기본값, 외래키가 이미 있으므로 변경하지 않는다. 기존 프로젝트 모듈에 문서 생성 책임을 추가하지 않고 별도 화이트보드 문서 모듈로 분리해 이후 목록·상세·수정·삭제 기능이 같은 경계 안에서 확장되도록 한다.

## 오류 및 경계 조건

- 인증되지 않은 요청은 입력 이후의 서비스와 DB를 호출하지 않는다.
- 이름의 앞뒤 공백을 제거한 결과가 빈 값이면 `400 VALIDATION_ERROR`다.
- 이름이 50자를 초과하면 `400 VALIDATION_ERROR`다.
- 알 수 없는 본문 필드는 현재 프로젝트 생성 스키마와 같은 Zod 기본 동작에 따라 제거하며 저장하지 않는다.
- 비멤버 요청은 프로젝트 조회와 문서 삽입을 수행하지 않는다.
- 프로젝트가 다른 워크스페이스에 속하거나 삭제되었으면 문서 삽입을 수행하지 않는다.
- 문서 insert가 행을 반환하지 않으면 예상하지 못한 서버 오류로 처리한다.
- DB 오류는 기존 오류 처리 계층을 통해 `500 INTERNAL_SERVER_ERROR`로 변환한다.
- 문서명 중복은 검사하지 않는다.

## 검증 계획

`backend/tests/whiteboard-document.test.ts`에서 기존 `project.test.ts`와 같은 Supertest, Vitest, Drizzle DB mock 패턴으로 다음 시나리오를 TDD로 구현한다.

1. 워크스페이스 멤버가 활성 프로젝트에 문서를 생성하면 201과 전체 문서 행을 반환한다.
2. 이름 앞뒤 공백을 제거하고 저장한다.
3. Owner와 Member 모두 생성할 수 있다.
4. 인증되지 않은 요청은 401이고 트랜잭션을 호출하지 않는다.
5. 이름 누락, 비문자열, 공백, 51자 입력은 400이다.
6. 잘못된 `workspaceId` 또는 `projectId`는 400이다.
7. 비멤버 요청은 404 `WORKSPACE_NOT_FOUND`이며 프로젝트 조회와 insert를 호출하지 않는다.
8. 존재하지 않는 프로젝트는 404 `PROJECT_NOT_FOUND`이며 insert를 호출하지 않는다.
9. 다른 워크스페이스의 프로젝트는 404 `PROJECT_NOT_FOUND`이며 insert를 호출하지 않는다.
10. 삭제된 프로젝트는 404 `PROJECT_NOT_FOUND`이며 insert를 호출하지 않는다.
11. 문서 insert가 행을 반환하지 않거나 DB가 실패하면 500으로 변환된다.
12. insert에는 `projectId`, 정규화된 `name`, `creatorId`만 전달되어 DB의 빈 캔버스 기본값을 사용한다.

구현 후 다음 검증을 수행한다.

```bash
pnpm --dir backend test -- tests/whiteboard-document.test.ts
pnpm --dir backend test
pnpm --dir backend lint
pnpm --dir backend build
pnpm --dir backend exec prettier --check src tests
```

## 결정 사항

- API 경로는 `POST /workspaces/:workspaceId/projects/:projectId/whiteboard-documents`로 한다.
- 생성 입력은 이름 하나만 받으며, 앞뒤 공백 제거 후 1~50자로 제한한다.
- Owner와 Member 모두 생성할 수 있다.
- 비멤버는 `404 WORKSPACE_NOT_FOUND`로 응답한다.
- 없거나 다른 워크스페이스에 속하거나 삭제된 프로젝트는 `404 PROJECT_NOT_FOUND`로 응답한다.
- 초기 캔버스 콘텐츠는 DB 기본값 `{}`를 사용하고 요청 본문에서 받지 않는다.
- 문서명 중복은 허용한다.
- 기존 DB 스키마와 마이그레이션은 변경하지 않는다.
- 실시간 편집과 자동 저장은 별도 기능으로 분리한다.
- 사용자 요청 전에는 Git commit, push, migration 적용, 외부 환경 변경을 수행하지 않는다.
