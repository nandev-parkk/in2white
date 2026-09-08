# 프로젝트 생성 백엔드 설계

## 상태

설계 검토 중

## 목표

인증된 워크스페이스 소유자 또는 멤버가 워크스페이스 안에 프로젝트를 생성할 수 있도록 `POST /workspaces/:workspaceId/projects` API를 추가한다.

## 근거 문서

- [`PRODUCT.md`](../../../PRODUCT.md)
  - Project 도메인 모델: 워크스페이스에 속하고 생성자를 기록한다.
  - 프로젝트 생성 흐름: 이름은 필수이고 설명은 선택이며, 워크스페이스의 모든 멤버가 접근한다.
  - 프로젝트 관리 요구사항 및 권한 규칙: Owner와 Member 모두 프로젝트를 생성할 수 있고, 비멤버는 워크스페이스 리소스에 접근할 수 없다.
- [`backend/README.md`](../../../backend/README.md)
  - `routes → controllers → services → db/schema` MVC 계층을 따른다.
  - Node.js 20+, TypeScript, Express, Drizzle ORM, Vitest, pnpm을 사용한다.
- 기존 Workspace 생성 구현 및 계획
  - `backend/src/services/workspace.service.ts`
  - `backend/src/controllers/workspace.controller.ts`
  - `backend/src/routes/workspace.routes.ts`
  - `docs/superpowers/plans/2026-09-07-workspace-creation-backend.md`

## 범위

### 포함

- 인증된 사용자의 프로젝트 생성 API
- 워크스페이스 멤버십 확인
- 프로젝트 이름·설명 입력값 검증 및 정규화
- 프로젝트 생성 결과 응답
- 성공·인증 실패·입력 오류·비멤버·예상하지 못한 DB 오류에 대한 테스트

### 제외

- 프로젝트 목록·상세·수정·삭제 API
- 프로젝트명 중복 방지
- `projects` 테이블 또는 마이그레이션 변경
- 프로젝트 생성 후 기본 화이트보드 문서 자동 생성
- 멤버십 관리 기능

## API 계약

### 요청

```http
POST /workspaces/:workspaceId/projects
Authorization: Bearer <access-token>
Content-Type: application/json
```

```json
{
  "name": "Brand Campaign",
  "description": "브랜드 캠페인 아이디어를 정리하는 프로젝트"
}
```

경로의 `workspaceId`는 UUID여야 한다. 요청 본문 규칙은 다음과 같다.

| 필드 | 타입 | 필수 | 규칙 |
|---|---|---:|---|
| `name` | string | 예 | 앞뒤 공백 제거 후 1~50자 |
| `description` | string 또는 null | 아니오 | 앞뒤 공백 제거 후 최대 200자, 빈 문자열은 `null` |

`description`이 누락되거나 `null`이면 `null`로 저장한다. 프로젝트명은 별도 unique 제약을 두지 않으므로 같은 워크스페이스 안에서 이름이 같은 프로젝트도 생성할 수 있다.

### 성공 응답

HTTP `201 Created`를 반환한다.

```json
{
  "project": {
    "id": "project-uuid",
    "workspaceId": "workspace-uuid",
    "name": "Brand Campaign",
    "description": "브랜드 캠페인 아이디어를 정리하는 프로젝트",
    "creatorId": "user-uuid",
    "createdAt": "2026-09-08T00:00:00.000Z",
    "updatedAt": "2026-09-08T00:00:00.000Z"
  }
}
```

응답은 Drizzle이 반환한 `projects` 행을 사용하고, 날짜 필드는 Express JSON 직렬화에 따라 ISO 문자열로 전달한다.

### 오류 응답

기존 `errorHandlerMiddleware` 형식을 사용한다.

| 상황 | 상태 | 코드 |
|---|---:|---|
| 인증 헤더가 없거나 유효하지 않음 | 401 | `UNAUTHORIZED` |
| `workspaceId`가 UUID가 아니거나 본문 검증 실패 | 400 | `VALIDATION_ERROR` |
| 사용자가 해당 워크스페이스의 멤버가 아님 | 404 | `WORKSPACE_NOT_FOUND` |
| 예상하지 못한 DB 오류 | 500 | `INTERNAL_SERVER_ERROR` |

비멤버 요청을 `404 WORKSPACE_NOT_FOUND`로 처리해 워크스페이스 존재 여부를 외부에 노출하지 않는다. 프로젝트 생성 자체의 별도 권한 오류 코드는 추가하지 않는다. Owner와 Member 모두 생성 권한을 갖기 때문이다.

## 아키텍처 및 데이터 흐름

1. `authenticate` 미들웨어가 Access Token을 검증하고 `req.user`를 설정한다.
2. 컨트롤러가 `requireUser(req)`로 인증 사용자를 가져온다.
3. 컨트롤러가 경로 파라미터와 요청 본문을 Zod 스키마로 검증한다.
4. 컨트롤러가 `createProject({ workspaceId, name, description, creatorId })` 서비스를 호출한다.
5. 서비스는 트랜잭션 안에서 `workspace_memberships`를 `workspaceId`와 `creatorId`로 조회한다.
6. 멤버십이 없으면 `HttpError(404, "WORKSPACE_NOT_FOUND", ...)`를 발생시킨다.
7. 멤버십이 있으면 `projects`에 `workspaceId`, 정규화된 `name`, 정규화된 `description`, `creatorId`를 삽입하고 생성 행을 반환한다.
8. 컨트롤러가 `{ project }`를 HTTP 201로 응답한다.

멤버십 확인과 프로젝트 삽입은 같은 트랜잭션으로 묶는다. 이번 기능은 단일 프로젝트 생성만 다루므로 별도의 권한 미들웨어를 만들지 않고 프로젝트 서비스가 워크스페이스 접근 규칙을 소유한다.

## 파일 경계

다음 파일을 추가하거나 수정한다.

- 추가: `backend/src/schemas/project.schema.ts`
  - `workspaceId` 경로 파라미터와 프로젝트 생성 본문 스키마를 정의한다.
- 추가: `backend/src/services/project.service.ts`
  - 멤버십 확인과 프로젝트 생성 유스케이스를 구현한다.
- 추가: `backend/src/controllers/project.controller.ts`
  - 인증 사용자·입력 검증·응답 직렬화를 담당한다.
- 추가: `backend/src/routes/project.routes.ts`
  - `POST /`를 인증 라우트로 연결한다.
- 수정: `backend/src/routes/index.ts`
  - `/workspaces/:workspaceId/projects`에 프로젝트 라우터를 마운트한다.
- 수정: `backend/src/constants/messages.ts`
  - 프로젝트 이름·설명 검증 메시지를 추가한다.
- 추가: `backend/tests/project.test.ts`
  - API 계약과 서비스의 DB 호출 경계를 검증한다.

`backend/src/db/schema/projects.ts`와 기존 마이그레이션에는 필요한 컬럼과 외래키가 이미 있으므로 변경하지 않는다.

## 오류 및 경계 조건

- 이름이 없거나 공백뿐이면 `400 VALIDATION_ERROR`로 처리한다.
- 이름이 50자를 초과하면 `400 VALIDATION_ERROR`로 처리한다.
- 설명이 200자를 초과하면 `400 VALIDATION_ERROR`로 처리한다.
- 설명 앞뒤 공백은 저장하지 않으며, 정규화 결과가 빈 값이면 `null`로 저장한다.
- 인증되지 않은 요청은 서비스와 DB를 호출하지 않는다.
- 비멤버 요청은 프로젝트 insert를 수행하지 않는다.
- 프로젝트 insert가 실패하면 기존 오류 처리 계층을 통해 500을 반환한다.
- 프로젝트 생성은 이름 중복을 검사하지 않는다.

## 테스트 전략

`backend/tests/project.test.ts`에서 기존 `workspace.test.ts`와 동일한 Supertest·Vitest·DB mock 패턴을 사용한다.

필수 시나리오는 다음과 같다.

1. 멤버가 이름과 설명으로 프로젝트를 생성하면 201과 전체 프로젝트 행을 반환한다.
2. 설명이 누락되거나 공백이면 서비스 insert에 `description: null`이 전달된다.
3. Owner와 Member 모두 생성할 수 있다.
4. 인증되지 않은 요청은 401이고 트랜잭션을 호출하지 않는다.
5. 이름 누락·공백·51자 입력은 400이다.
6. 설명 201자 입력은 400이다.
7. 잘못된 `workspaceId`는 400이다.
8. 비멤버 요청은 404이고 프로젝트 insert를 호출하지 않는다.
9. 프로젝트 insert 실패는 500으로 변환된다.

구현 후 다음 검증을 수행한다.

```bash
pnpm --dir backend test -- tests/project.test.ts
pnpm --dir backend test
pnpm --dir backend lint
pnpm --dir backend build
pnpm --dir backend exec prettier --check src tests
```

## 결정 사항

- API 경로는 계층 구조를 반영한 `POST /workspaces/:workspaceId/projects`로 한다.
- Owner와 Member 모두 생성할 수 있다.
- 비멤버는 `404 WORKSPACE_NOT_FOUND`로 응답한다.
- 이름 최대 길이는 50자다.
- 설명 최대 길이는 200자다.
- 설명의 빈 값은 `null`로 정규화한다.
- 이름 중복은 허용한다.
- 기존 DB 스키마·마이그레이션은 변경하지 않는다.
- 사용자 요청 전에는 Git commit, 실제 DB migration 실행, 외부 환경 변경을 하지 않는다.
