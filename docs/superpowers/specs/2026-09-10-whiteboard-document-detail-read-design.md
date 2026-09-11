# 화이트보드 문서 상세 조회 백엔드 설계

## 상태

- 승인 상태: 사용자 승인
- 승인된 방향: 목록 조회는 메타데이터만 반환하고, 단건 상세 조회에서 `canvasContent`를 반환한다.

## 목표

화이트보드 목록에서 선택한 문서를 새로고침·딥링크·다른 사용자 세션에서도 열 수 있도록, 저장된 `canvasContent`를 포함한 인증 단건 조회 API를 제공한다.

## 배경과 현재 제약

현재 화이트보드 문서 목록 API는 페이지네이션과 검색을 위해 문서 메타데이터만 반환하며 `canvasContent`는 제외한다. 생성 API는 생성 직후 응답에 내용을 포함하지만, 기존 문서를 다시 열거나 브라우저를 새로고침했을 때 사용할 전용 조회 API는 없다.

목록 응답에 `canvasContent`를 넣으면 여러 문서의 전체 JSON을 목록 요청마다 전송하게 되어 문서 크기와 문서 수에 따라 응답·파싱 비용이 커진다. 따라서 목록 계약은 유지하고 단건 조회에만 전체 내용을 포함한다.

## API 계약

### 상세 조회

```http
GET /workspaces/:workspaceId/projects/:projectId/whiteboard-documents/:documentId
Authorization: Bearer <access-token>
```

성공 응답:

```http
200 OK
```

```json
{
  "whiteboardDocument": {
    "id": "document-uuid",
    "projectId": "project-uuid",
    "name": "기획 보드",
    "creatorId": "user-uuid",
    "canvasContent": {},
    "createdAt": "2026-09-10T00:00:00.000Z",
    "updatedAt": "2026-09-10T00:00:00.000Z"
  }
}
```

`deletedAt`은 내부 soft-delete 상태값이므로 응답에 포함하지 않는다.

## 접근 제어와 오류 계약

기존 목록·이름 변경·삭제 API의 리소스 검증 순서를 유지한다.

1. 인증 middleware가 유효한 access token을 확인한다.
2. `workspaceId`와 현재 사용자의 멤버십을 확인한다. 없으면 `404 WORKSPACE_NOT_FOUND`를 반환한다.
3. `projectId`가 해당 workspace에 속하고 `projects.deletedAt IS NULL`인지 확인한다. 아니면 `404 PROJECT_NOT_FOUND`를 반환한다.
4. `documentId`가 해당 project에 속하고 `whiteboardDocuments.deletedAt IS NULL`인지 확인한다. 아니면 `404 WHITEBOARD_DOCUMENT_NOT_FOUND`를 반환한다.
5. 조회 결과를 명시적인 응답 projection으로 반환한다.

추가 오류 계약:

- 인증 누락·실패: 기존 인증 middleware 계약에 따라 `401`
- UUID 파라미터 오류: 기존 schema/parser 계약에 따라 `400`
- 데이터베이스 조회 실패: 기존 error handler 계약에 따라 `500`

삭제된 문서는 일반 미존재 문서와 동일하게 `404`로 처리해 soft-delete 상태와 문서 존재 여부를 노출하지 않는다.

## 구현 구조와 데이터 흐름

기존 경계를 유지한다.

```text
route GET /:documentId
  → controller: params 파싱·현재 사용자 추출
  → service: membership → project → active document 조회
  → controller: { whiteboardDocument } JSON 응답
```

- route는 기존 `Router({ mergeParams: true })`, `authenticate`, `asyncHandler` 패턴을 재사용한다.
- controller는 기존 `whiteboardDocumentUpdateParamsSchema`를 재사용한다.
- service는 읽기 전용 조회이므로 기존 목록 service와 같은 `db.select` 접근 패턴을 사용한다.
- 서비스의 문서 select는 `id`, `projectId`, `name`, `creatorId`, `canvasContent`, `createdAt`, `updatedAt`만 명시한다.
- 목록 조회, 생성, 이름 변경, soft delete 동작은 변경하지 않는다.

## 범위

포함:

- 상세 조회 service·controller·route
- 인증·파라미터·workspace/project/document 오류 처리
- `canvasContent`와 `deletedAt` 비노출을 검증하는 테스트
- 설계·구현 계획 문서

제외:

- 목록 API에 `canvasContent` 추가
- `canvasContent` 수정·자동 저장 API
- 복구·영구 삭제 API
- 프론트엔드 라우팅·에디터 구현
- 데이터베이스 migration

## 검증 계획

- 성공 시 full document payload와 HTTP `200`을 검증한다.
- `canvasContent`가 응답에 포함되고 `deletedAt`은 포함되지 않는지 검증한다.
- 인증 실패, 잘못된 UUID, workspace/project/document 미존재, 삭제 문서, DB 오류 경계를 검증한다.
- 기존 전체 backend 테스트, lint, TypeScript build, 변경 파일 Prettier, `git diff --check`를 실행한다.
- 실제 데이터베이스 migration은 필요하지 않으므로 실행하지 않는다.

## 결정 이유

단건 상세 조회는 문서 하나를 여는 순간에만 전체 canvas 상태를 가져오므로 목록 응답의 크기를 안정적으로 유지한다. 또한 응답 projection을 명시하면 내부 `deletedAt` 컬럼이나 이후 추가되는 스키마 필드가 외부 API 계약에 우연히 노출되는 것을 막을 수 있다.
