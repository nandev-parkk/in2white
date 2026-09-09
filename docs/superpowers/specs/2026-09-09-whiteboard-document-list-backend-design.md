# 화이트보드 문서 목록 조회 백엔드 설계

## 상태

설계 승인 완료 · 구현 및 최종 리뷰 수정 반영 완료 · 자체 검토 완료

## 목표

인증된 워크스페이스 멤버가 활성 프로젝트의 화이트보드 문서를 이름으로 검색하고 페이지 단위로 조회할 수 있도록 `GET /workspaces/:workspaceId/projects/:projectId/whiteboard-documents` API를 추가한다.

## 근거 문서

- [`PRODUCT.md`](../../../PRODUCT.md)
  - 프로젝트 상세 페이지는 화이트보드 문서 이름, 생성자, 생성일, 최종 수정 시각을 보여준다.
  - 워크스페이스에 소속된 사용자만 프로젝트와 화이트보드 문서 목록에 접근할 수 있다.
  - 프로젝트 내 화이트보드 문서는 이름으로 검색할 수 있다.
- [`DESIGN.md`](../../../DESIGN.md)
  - 프로젝트 상세의 검색은 현재 프로젝트 안의 화이트보드 문서만 대상으로 한다.
  - Whiteboard Card의 캔버스 미리보기 영역은 Excalidraw 점선 그리드를 차용한 시각적 표현이며, 목록 API가 저장된 캔버스 JSON을 반환해야 한다는 계약은 없다.
- 기존 목록 공통 계약
  - `backend/src/schemas/list-query.schema.ts`
  - `backend/src/utils/pagination.ts`
  - `backend/src/utils/search.ts`
- 기존 프로젝트 목록 구현
  - `backend/src/services/project.service.ts`
  - `backend/src/controllers/project.controller.ts`
  - `backend/src/routes/project.routes.ts`
  - `docs/superpowers/plans/2026-09-08-project-list-backend.md`
- 기존 화이트보드 문서 생성 구현
  - `backend/src/services/whiteboard-document.service.ts`
  - `backend/src/controllers/whiteboard-document.controller.ts`
  - `backend/src/routes/whiteboard-document.routes.ts`

## 범위

### 포함

- 인증된 사용자의 화이트보드 문서 목록 조회 API
- 워크스페이스 멤버십 확인
- 프로젝트가 요청 워크스페이스에 속하고 삭제되지 않았는지 확인
- `search`, `page`, `limit` query 파싱·정규화·검증
- 문서명에 대한 대소문자 구분 없는 포함 검색과 LIKE wildcard escape
- 생성자 이름을 포함한 문서 메타데이터 목록 조회
- 결정적 정렬과 페이지네이션 메타데이터
- 성공, 인증 실패, 입력 오류, 비멤버, 프로젝트 없음·타 워크스페이스·삭제 프로젝트, DB 오류 테스트

### 제외

- `canvasContent` 반환 및 캔버스 미리보기 이미지/JSON 생성
- 화이트보드 문서 상세·생성·수정·삭제 API
- Excalidraw 실시간 동기화와 자동 저장
- 프로젝트 상세 정보(이름·설명·생성자) 조회
- 문서명 중복 방지 또는 검색 인덱스 migration
- 기존 공통 query·pagination·search 모듈 변경

## 접근법 비교

### 1. 기존 공통 목록 계약과 전용 문서 query 사용 — 채택

`GET /workspaces/:workspaceId/projects/:projectId/whiteboard-documents?search=&page=&limit=`

- `listQuerySchema`, `buildContainsSearchPattern`, `getPaginationOffset`, `createPaginationMeta`를 재사용한다.
- 화이트보드 문서 서비스만 `whiteboardDocuments.name` 검색과 creator join을 소유한다.
- 프로젝트 목록 API와 query·응답·정렬 규칙이 일관되어 프런트엔드가 같은 페이지네이션 처리를 사용할 수 있다.
- 목록 응답에는 메타데이터만 포함하고 `canvasContent`는 제외해 JSONB payload와 DB 전송량을 제한한다.

### 2. 문서 목록 전용 query·페이지네이션 계약 추가

- 현재 공통 계약과 중복되는 `page`, `limit`, `search` 검증 로직이 생긴다.
- 도메인마다 기본값·최대값이 달라져야 할 근거가 없으므로 유지보수 비용만 늘어난다.

### 3. 프로젝트 조회와 문서 목록을 한 번의 집계 query로 통합

- 프로젝트 존재 확인과 count/rows를 SQL join으로 줄일 수 있다.
- 멤버십·상위 프로젝트 비노출 오류와 목록 query가 강하게 결합되고, 기존 프로젝트 목록의 단순한 단계별 패턴과 달라진다.
- 이번 기능에서는 명확한 오류 계약과 재사용 가능한 목록 구조가 더 중요하므로 채택하지 않는다.

## API 계약

### 요청

```http
GET /workspaces/:workspaceId/projects/:projectId/whiteboard-documents?search=brand&page=1&limit=20
Authorization: Bearer <access-token>
```

경로의 `workspaceId`와 `projectId`는 UUID여야 한다. query 규칙은 기존 `listQuerySchema`를 그대로 사용한다.

| Query    | 타입   | 기본값 | 규칙                                                      |
| -------- | ------ | -----: | --------------------------------------------------------- |
| `search` | string |   없음 | 앞뒤 공백 제거 후 최대 100자, 빈 문자열은 미지정으로 처리 |
| `page`   | 정수   |    `1` | 1 이상                                                    |
| `limit`  | 정수   |   `20` | 1 이상 100 이하                                           |

검색어는 화이트보드 문서 이름에 대해 대소문자 구분 없는 포함 검색을 수행한다. `%`, `_`, `\\`는 wildcard가 아닌 문자로 취급한다.

### 성공 응답

HTTP `200 OK`를 반환한다.

```json
{
  "whiteboardDocuments": [
    {
      "id": "whiteboard-document-uuid",
      "projectId": "project-uuid",
      "name": "Brand Campaign",
      "creatorId": "user-uuid",
      "creator": {
        "id": "user-uuid",
        "name": "홍길동"
      },
      "createdAt": "2026-09-09T00:00:00.000Z",
      "updatedAt": "2026-09-09T00:05:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

목록 항목은 문서 식별자·프로젝트 식별자·이름·생성자 정보·생성/수정 시각만 반환한다. `canvasContent`는 반환하지 않는다. 결과는 `updatedAt DESC`, `createdAt DESC`, `id ASC` 순으로 정렬해 페이지 사이의 순서를 결정적으로 유지한다. 검색 결과가 없거나 `page`가 전체 페이지보다 크면 오류가 아니라 빈 배열을 반환한다. `total`이 0이면 `totalPages`는 0이다.

### 오류 응답

기존 `errorHandlerMiddleware` 형식을 사용한다.

| 상황                                                    | 상태 | 코드                    |
| ------------------------------------------------------- | ---: | ----------------------- |
| 인증 헤더가 없거나 유효하지 않음                        |  401 | `UNAUTHORIZED`          |
| 경로 UUID 또는 `search`·`page`·`limit` 검증 실패        |  400 | `VALIDATION_ERROR`      |
| 사용자가 해당 워크스페이스의 멤버가 아님                |  404 | `WORKSPACE_NOT_FOUND`   |
| 프로젝트가 없거나, 다른 워크스페이스에 속하거나, 삭제됨 |  404 | `PROJECT_NOT_FOUND`     |
| 예상하지 못한 DB 오류                                   |  500 | `INTERNAL_SERVER_ERROR` |

멤버십을 프로젝트 조회보다 먼저 확인해 비멤버에게 워크스페이스나 프로젝트 존재 여부를 노출하지 않는다. 멤버십을 통과한 사용자의 잘못된 프로젝트 대상은 모두 `PROJECT_NOT_FOUND`로 처리한다.

## 아키텍처 및 데이터 흐름

1. `whiteboardDocumentRouter`의 `GET /` 라우트가 `authenticate` 미들웨어를 실행한다.
2. 컨트롤러가 `requireUser(req)`로 인증 사용자를 가져온다.
3. 컨트롤러가 `whiteboardDocumentParamsSchema`로 `workspaceId`, `projectId`를 검증하고 `listQuerySchema`로 query를 파싱한다.
4. 컨트롤러가 `listWhiteboardDocuments({ workspaceId, projectId, userId, search, page, limit })` 서비스를 호출한다.
5. 서비스가 워크스페이스 멤버십을 조회한다. 없으면 `404 WORKSPACE_NOT_FOUND`를 발생시킨다.
6. 서비스가 `projects.id`, `projects.workspaceId`, `projects.deletedAt IS NULL` 조건으로 활성 프로젝트를 확인한다. 없으면 `404 PROJECT_NOT_FOUND`를 발생시킨다.
7. 서비스가 같은 문서 조건으로 count query와 creator join이 포함된 rows query를 병렬 실행한다.
8. rows query는 `whiteboardDocuments.projectId`, 선택적 `ilike(whiteboardDocuments.name, pattern)`, 결정적 정렬, limit, offset을 사용한다.
9. 서비스가 count 결과를 숫자로 변환하고 공통 `createPaginationMeta`로 메타데이터를 만든다.
10. 컨트롤러가 `{ whiteboardDocuments, pagination }`를 HTTP 200으로 응답한다.

프로젝트 활성 상태 확인과 문서 목록 query는 기존 프로젝트 목록 서비스와 같은 읽기 전용 query 흐름을 따른다. 문서 목록 query는 `projectId`로 범위가 고정되며, 프로젝트가 삭제된 경우 사전 검사에서 즉시 종료한다. `canvasContent`는 select projection에 포함하지 않는다.

## 모듈 경계와 변경 범위

- 수정: `backend/src/services/whiteboard-document.service.ts`
  - 문서 생성 서비스와 같은 도메인 모듈에 목록 입력·항목·결과 타입과 `listWhiteboardDocuments` 유스케이스를 추가한다.
- 수정: `backend/src/controllers/whiteboard-document.controller.ts`
  - 목록 handler를 추가해 path/query 파싱과 200 응답을 담당한다.
- 수정: `backend/src/routes/whiteboard-document.routes.ts`
  - 인증된 `GET /` 라우트를 추가한다.
- 수정: `backend/tests/whiteboard-document.test.ts`
  - 목록 API의 성공·검색·페이지네이션·권한·오류·projection 계약을 검증한다.

`backend/src/schemas/list-query.schema.ts`, `backend/src/utils/pagination.ts`, `backend/src/utils/search.ts`, `backend/src/db/schema/whiteboard-documents.ts`, migration SQL은 변경하지 않는다. 기존 생성 API와 응답은 그대로 유지한다.

## 오류 및 경계 조건

- 인증되지 않은 요청과 입력 오류는 서비스·DB를 호출하지 않는다.
- 비멤버 요청은 프로젝트 조회, count, rows query를 실행하지 않는다.
- 프로젝트가 다른 워크스페이스에 속하거나 삭제된 경우 문서 query를 실행하지 않는다.
- 빈 검색어는 검색 조건 없이 전체 활성 문서 목록을 조회한다.
- 검색어의 `%`, `_`, `\\`는 literal 문자로 escape한다.
- count가 0이면 `whiteboardDocuments: []`, `total: 0`, `totalPages: 0`을 반환한다.
- page가 범위를 벗어나도 400/404가 아니라 빈 rows와 계산된 pagination을 반환한다.
- creator가 cascade 삭제된 비정상 데이터는 inner join 특성상 목록에서 제외된다. 현재 FK cascade 정책과 일관된다.
- DB 오류는 기존 오류 처리 계층을 통해 500으로 반환한다.
- 목록에서는 `canvasContent`를 읽지 않으므로 대용량 JSONB 전송을 피한다.

## 검증 계획

`backend/tests/whiteboard-document.test.ts`에서 기존 생성 테스트와 같은 Supertest, Vitest, Drizzle mock 패턴으로 다음을 검증한다.

1. 멤버가 기본 query로 목록을 조회하면 200, 문서 메타데이터, creator, 기본 pagination을 반환한다.
2. Owner와 Member 모두 조회할 수 있다.
3. `search`, trim, wildcard escape, page/limit, deterministic order, offset이 count와 rows query에 동일하게 적용된다.
4. 응답과 select projection에 `canvasContent`가 포함되지 않는다.
5. 빈 결과와 page 초과가 200과 빈 배열·pagination으로 반환된다.
6. 인증 없음, 잘못된 UUID, 잘못된 search/page/limit은 401/400이고 DB를 호출하지 않는다.
7. 비멤버는 404 `WORKSPACE_NOT_FOUND`, 프로젝트 없음·타 워크스페이스·삭제 프로젝트는 404 `PROJECT_NOT_FOUND`이며 문서 query를 호출하지 않는다.
8. 멤버십·프로젝트·count·rows query 오류는 500으로 변환된다.

구현 후 다음 검증을 수행한다.

```bash
pnpm --dir backend test -- tests/whiteboard-document.test.ts
pnpm --dir backend test
pnpm --dir backend lint
pnpm --dir backend build
pnpm --dir backend exec prettier --check src tests
```

## 결정 사항

- API 경로는 `GET /workspaces/:workspaceId/projects/:projectId/whiteboard-documents`로 한다.
- 기존 `listQuerySchema`의 `search`, `page`, `limit` 계약과 공통 pagination/search 유틸리티를 재사용한다.
- Owner와 Member 모두 목록을 조회할 수 있다.
- 비멤버는 `404 WORKSPACE_NOT_FOUND`, 유효하지 않은 프로젝트 대상은 `404 PROJECT_NOT_FOUND`로 응답한다.
- 목록 항목에는 `canvasContent`를 포함하지 않고 문서 메타데이터와 creator만 반환한다.
- 검색은 문서명에 대한 대소문자 구분 없는 literal contains 검색이다.
- 정렬은 `updatedAt DESC`, `createdAt DESC`, `id ASC`다.
- 기존 DB 스키마·migration·공통 query 모듈은 변경하지 않는다.
- 문서 상세·실시간 편집·자동 저장은 별도 기능으로 분리한다.
