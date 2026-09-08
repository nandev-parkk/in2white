# 프로젝트 수정 백엔드 설계

## 상태

설계 승인 완료 · 자체 검토 완료 · 사용자 검토 완료

## 목표

인증된 사용자가 워크스페이스 프로젝트의 name과 description을 부분 수정할 수 있는 PATCH API를 추가한다.


## 근거 문서

- PRODUCT.md
  - Project는 이름, 선택적 설명, 생성자, 생성일, 수정일을 가진다.
  - 워크스페이스 Owner와 Member가 프로젝트를 조회할 수 있다.
  - 수정과 삭제는 워크스페이스 Owner 또는 프로젝트 Creator만 수행할 수 있다.
- backend/README.md
  - routes → controllers → services → db/schema MVC 계층을 사용한다.
  - Node.js 20+, TypeScript, Express, Drizzle ORM, Vitest, Supertest, pnpm을 사용한다.
- 기존 프로젝트 구현
  - backend/src/schemas/project.schema.ts
  - backend/src/services/project.service.ts
  - backend/src/controllers/project.controller.ts
  - backend/src/routes/project.routes.ts
  - backend/tests/project.test.ts
- 기존 Workspace 수정 구현
  - backend/src/services/workspace.service.ts
  - backend/src/controllers/workspace.controller.ts
  - backend/src/routes/workspace.routes.ts

## 범위

### 포함

- PATCH /workspaces/:workspaceId/projects/:projectId API
- 프로젝트 name 부분 수정
- 프로젝트 description 부분 수정
- name과 description의 trim·길이 검증
- description 생략·초기화 semantics
- 워크스페이스 멤버십 및 프로젝트 소속 확인
- Owner 또는 프로젝트 Creator 권한 확인
- 수정된 프로젝트 전체 응답
- 인증·입력·권한·미존재·DB 오류 테스트

### 제외

- 프로젝트 삭제 API
- 프로젝트 생성자 변경
- 프로젝트 workspace 이동
- 프로젝트명 중복 방지
- 낙관적 잠금 또는 version 컬럼 추가
- DB migration 실행
- 프론트엔드 수정 화면 구현

## API 계약

### 요청

~~~http
PATCH /workspaces/:workspaceId/projects/:projectId
Authorization: Bearer <access-token>
Content-Type: application/json
~~~

요청 본문은 name과 description 중 하나 이상을 포함해야 한다.

~~~json
{
  "name": "  Updated Campaign  ",
  "description": "  최신 캠페인 설명  "
}
~~~

두 필드는 각각 선택 입력이다. 저장 모델에서 name은 필수지만 PATCH에서 생략하면 기존 name을 유지하므로 description만 단독 수정할 수 있다.

### 입력 규칙

| 필드 | PATCH 입력 | 정규화 및 검증 | 생략 의미 |
|---|---|---|---|
| name | string | trim 후 1~50자 | 기존 name 유지 |
| description | string 또는 null | trim 후 최대 200자, 빈 문자열은 null | 기존 description 유지 |

허용하는 요청 예시는 다음과 같다.

~~~json
{ "name": "New Name" }
~~~

~~~json
{ "description": "New description" }
~~~

~~~json
{ "description": null }
~~~

~~~json
{ "description": "   " }
~~~

빈 body, name이 null·공백인 요청, description이 잘못된 타입 또는 201자 이상인 요청은 400 VALIDATION_ERROR다. description이 생략되면 update 객체에 description을 넣지 않아 기존 값을 보존하고, null 또는 공백이면 DB에 null을 저장한다. name이 생략되어도 저장된 프로젝트의 기존 name은 유지되므로 name 필수 조건을 깨지 않는다.

path의 workspaceId와 projectId는 UUID여야 한다. body에서 서비스가 반영하는 필드는 name과 description뿐이다.

### 성공 응답

HTTP 200을 반환한다.

~~~json
{
  "project": {
    "id": "project-uuid",
    "workspaceId": "workspace-uuid",
    "name": "Updated Campaign",
    "description": "최신 캠페인 설명",
    "creatorId": "user-uuid",
    "createdAt": "2026-09-08T00:00:00.000Z",
    "updatedAt": "2026-09-08T00:05:00.000Z"
  }
}
~~~

Drizzle update returning()이 반환한 전체 프로젝트 행을 { project }로 감싸 응답한다. createdAt과 updatedAt은 Express JSON 직렬화로 ISO 문자열이 된다. 성공한 수정은 값이 이전과 같아도 updatedAt을 현재 시각으로 갱신한다.


## 권한 및 오류 계약

### 권한 규칙

1. authenticate middleware가 Access Token을 검증하고 req.user를 설정한다.
2. controller가 requireUser(req)로 인증 사용자를 가져온다.
3. service가 workspace_memberships에서 workspaceId와 userId가 일치하는 멤버십을 조회한다.
4. role이 owner이면 해당 workspace의 모든 project를 수정할 수 있다.
5. role이 member이면 projects.creatorId가 userId와 같은 project만 수정할 수 있다.
6. 멤버십이 없는 사용자는 project 조회 전에 차단한다.

### 오류 응답

기존 errorHandlerMiddleware 형식을 사용한다.

| 상황 | 상태 | 코드 | 메시지 |
|---|---:|---|---|
| 인증 실패 | 401 | UNAUTHORIZED | 기존 인증 오류 메시지 |
| path UUID 또는 body 검증 실패 | 400 | VALIDATION_ERROR | 해당 입력 오류 메시지 |
| name과 description 모두 생략 | 400 | VALIDATION_ERROR | 수정할 프로젝트 정보를 입력해주세요 |
| 워크스페이스 비멤버 | 404 | WORKSPACE_NOT_FOUND | 워크스페이스를 찾을 수 없습니다 |
| project가 없거나 다른 workspace에 속함 | 404 | PROJECT_NOT_FOUND | 프로젝트를 찾을 수 없습니다 |
| 권한 없는 Member | 403 | PROJECT_UPDATE_FORBIDDEN | 프로젝트를 수정할 권한이 없습니다 |
| 예상하지 못한 DB 오류 | 500 | INTERNAL_SERVER_ERROR | 기존 내부 오류 메시지 |

비멤버는 project 조회 전에 WORKSPACE_NOT_FOUND를 받으므로 project 존재 여부가 노출되지 않는다. 멤버가 다른 workspace의 projectId를 전달한 경우 project 조회 조건에 workspaceId가 포함되어 PROJECT_NOT_FOUND를 반환한다.

## 아키텍처 및 데이터 흐름

### 계층별 책임

- routes
  - PATCH /:projectId를 authenticate와 asyncHandler로 등록한다.
  - Router({ mergeParams: true })를 유지해 workspaceId와 projectId를 함께 전달한다.
- controller
  - 인증 사용자, path parameter, partial body를 검증한다.
  - updateProject service를 호출하고 200 { project }를 응답한다.
- schema
  - 기존 projectNameSchema를 생성·수정에서 공유한다.
  - 생성용 description transform과 수정용 description transform을 분리한다.
  - 수정 body에서 최소 한 필드를 요구한다.
- service
  - 하나의 transaction 내부에서 멤버십·project·권한을 확인한다.
  - 요청에 포함된 name, description과 updatedAt만 update한다.
- db/schema
  - 기존 projects 테이블과 컬럼을 그대로 사용한다.

### 요청 흐름

1. PATCH 요청이 projectRouter에 도달한다.
2. authenticate가 토큰을 검증한다.
3. updateProjectHandler가 requireUser를 호출한다.
4. projectUpdateParamsSchema가 두 UUID를 검증한다.
5. updateProjectSchema가 입력을 trim하고 빈 description을 null로 정규화한다.
6. 두 필드가 모두 없으면 VALIDATION_ERROR를 발생시킨다.
7. handler가 정규화된 값과 userId를 updateProject에 전달한다.
8. service가 transaction 안에서 membership을 조회한다.
9. membership이 없으면 WORKSPACE_NOT_FOUND로 종료한다.
10. service가 projectId와 workspaceId가 일치하는 project의 creatorId를 조회한다.
11. project가 없으면 PROJECT_NOT_FOUND로 종료한다.
12. Owner가 아니면서 Creator도 아니면 PROJECT_UPDATE_FORBIDDEN으로 종료한다.
13. 전달된 필드만 updateValues에 넣고 updatedAt을 추가한다.
14. 같은 projectId와 workspaceId 조건으로 update returning()을 실행한다.
15. controller가 반환된 project를 200으로 응답한다.

### 부분 update 객체

service는 다음 형태로 전달된 필드만 update한다.

~~~ts
const updateValues: {
  name?: string;
  description?: string | null;
  updatedAt: Date;
} = {
  updatedAt: new Date(),
};

if (name !== undefined) {
  updateValues.name = name;
}

if (description !== undefined) {
  updateValues.description = description;
}
~~~

update 조건은 다음 두 조건을 함께 사용한다.

~~~ts
and(
  eq(projects.id, projectId),
  eq(projects.workspaceId, workspaceId),
)
~~~

membership 확인, project 조회, 권한 확인, update는 하나의 db.transaction callback 안에서 수행한다. update returning()이 빈 배열이면 PROJECT_NOT_FOUND를 발생시킨다.

## Schema 설계

기존 생성용 description schema는 누락을 null로 바꿔야 하지만, 수정용 schema는 누락을 undefined로 유지해야 한다. 따라서 문자열·trim·길이 검증을 담당하는 base schema와 생성·수정 transform을 분리한다.

~~~ts
const projectDescriptionValueSchema = z
  .string({ error: ERROR_MESSAGES.PROJECT_DESCRIPTION_INVALID })
  .trim()
  .max(200, ERROR_MESSAGES.PROJECT_DESCRIPTION_TOO_LONG)
  .nullable();

const createProjectDescriptionSchema = projectDescriptionValueSchema
  .optional()
  .transform((description) => description || null);

const updateProjectDescriptionSchema = projectDescriptionValueSchema
  .optional()
  .transform((description) => {
    if (description === undefined) {
      return undefined;
    }

    return description || null;
  });

export const projectUpdateParamsSchema = z.object({
  workspaceId: z.uuid({ error: ERROR_MESSAGES.WORKSPACE_ID_INVALID }),
  projectId: z.uuid({ error: ERROR_MESSAGES.PROJECT_ID_INVALID }),
});

export const updateProjectSchema = z
  .object({
    name: projectNameSchema.optional(),
    description: updateProjectDescriptionSchema,
  })
  .refine(
    ({ name, description }) =>
      name !== undefined || description !== undefined,
    {
      message: ERROR_MESSAGES.PROJECT_UPDATE_FIELDS_REQUIRED,
    },
  );
~~~

기존 createProjectSchema는 createProjectDescriptionSchema를 사용해 생성 시 누락·null·빈 설명을 null로 저장한다. updateProjectSchema는 누락된 description을 undefined로 유지해 service가 기존 값을 보존할 수 있게 한다.

## 서비스 인터페이스

~~~ts
export interface UpdateProjectInput {
  workspaceId: string;
  projectId: string;
  userId: string;
  name?: string;
  description?: string | null;
}

export async function updateProject(
  input: UpdateProjectInput,
): Promise<typeof projects.$inferSelect>;
~~~

controller schema가 최소 하나의 필드를 보장한다. service도 transaction을 시작하기 전에 name과 description이 모두 undefined인지 확인하고, 빈 입력이면 HttpError(400, "VALIDATION_ERROR", ERROR_MESSAGES.PROJECT_UPDATE_FIELDS_REQUIRED)를 발생시킨다. 따라서 빈 PATCH와 직접 service 호출 모두 DB query를 실행하지 않는다.


## 파일 경계

### 수정 파일

- backend/src/constants/messages.ts
  - PROJECT_ID_INVALID
  - PROJECT_NOT_FOUND
  - PROJECT_UPDATE_FORBIDDEN
  - PROJECT_UPDATE_FIELDS_REQUIRED
- backend/src/schemas/project.schema.ts
  - description value schema와 create/update transform 분리
  - projectUpdateParamsSchema 추가
  - updateProjectSchema 추가
- backend/src/services/project.service.ts
  - UpdateProjectInput 추가
  - updateProject 추가
- backend/src/controllers/project.controller.ts
  - updateProjectHandler 추가
- backend/src/routes/project.routes.ts
  - PATCH /:projectId 추가
- backend/tests/project.test.ts
  - 성공·부분 수정·정규화·권한·검증·오류 테스트 추가

### 변경하지 않는 파일

- backend/src/db/schema/projects.ts
- backend/src/db/migrations/**
- backend/src/routes/index.ts
- PRODUCT.md
- frontend/**

기존 routes/index.ts의 다음 mount가 workspaceId를 전달하므로 index 변경은 필요하지 않다.

~~~ts
router.use("/workspaces/:workspaceId/projects", projectRouter);
~~~

## 테스트 전략

기존 project.test.ts의 Supertest, Vitest, transaction mock을 확장한다. HTTP 경계에서 실제 schema·controller·service 흐름을 실행하고, 외부 PostgreSQL 연결만 mock한다.

### 성공 시나리오

1. Owner가 다른 사용자가 생성한 프로젝트의 name과 description을 수정한다.
2. Creator Member가 자신의 프로젝트 name을 수정한다.
3. Creator Member가 자신의 프로젝트 description만 수정한다.
4. name만 요청하면 update 값에 name과 updatedAt만 포함된다.
5. description만 요청하면 update 값에 description과 updatedAt만 포함된다.
6. name과 description을 함께 요청하면 두 필드와 updatedAt이 포함된다.
7. name과 description 앞뒤 공백이 정규화된다.
8. description null과 공백이 DB null로 전달된다.
9. 성공 응답이 수정된 전체 프로젝트와 ISO 날짜를 반환한다.

### 실패 시나리오

1. 인증되지 않은 요청은 401이고 transaction을 호출하지 않는다.
2. workspaceId 또는 projectId가 잘못되면 400이고 transaction을 호출하지 않는다.
3. name이 null·공백·길이 초과면 400이고 transaction을 호출하지 않는다.
4. description이 잘못된 타입·길이 초과면 400이고 transaction을 호출하지 않는다.
5. body가 비어 있으면 400이고 transaction을 호출하지 않는다.
6. 워크스페이스 비멤버는 404이며 project query와 update를 실행하지 않는다.
7. 멤버가 다른 workspace의 프로젝트를 요청하면 404이며 update를 실행하지 않는다.
8. 다른 Member의 프로젝트를 요청하면 403이며 update를 실행하지 않는다.
9. membership query·project query·update query가 실패하면 500을 반환한다.
10. update returning()이 비어 있으면 PROJECT_NOT_FOUND를 반환한다.

### 회귀 검증

- 기존 프로젝트 생성 API의 description 누락·null·공백이 계속 null로 저장되는지 확인한다.
- 기존 프로젝트 목록 API와 검색·페이지네이션 동작이 변하지 않는지 확인한다.
- 백엔드 전체 테스트를 실행한다.
- lint, TypeScript build, Prettier check, git diff --check를 실행한다.

## 보안 및 동시성 고려

- 비멤버는 project 조회 전에 차단한다.
- project 조회와 update 모두 workspaceId를 조건에 포함한다.
- controller schema에서 name·description을 정규화하고 service에서도 두 필드만 update한다.
- updatedAt은 서버가 생성하며 클라이언트가 전달한 값은 받지 않는다.
- 낙관적 잠금이나 충돌 감지는 이번 범위에 추가하지 않는다. 동시에 수정된 경우 마지막 update가 최종값이 된다.

## 수용 기준

- 인증된 Owner가 같은 workspace의 임의 project name·description을 수정할 수 있다.
- 인증된 Creator Member가 자신의 project name 또는 description을 단독 수정할 수 있다.
- 다른 Member는 project를 수정할 수 없다.
- description 생략은 기존 값 유지, null·공백은 null 저장으로 동작한다.
- name은 저장 시 항상 1~50자 조건을 유지한다.
- 빈 PATCH body는 거부된다.
- 비멤버는 WORKSPACE_NOT_FOUND, 다른 workspace project는 PROJECT_NOT_FOUND를 반환한다.
- 변경된 project 전체가 200 응답으로 반환된다.
- 기존 프로젝트 생성·목록 기능과 DB schema/migration은 회귀하지 않는다.

## 결정 사항

- PATCH 경로는 /workspaces/:workspaceId/projects/:projectId로 한다.
- name과 description은 PATCH body에서 선택값으로 두되 최소 하나는 필수로 한다.
- name 생략과 description 생략은 각각 기존 값을 유지한다.
- description null·공백은 null로 정규화한다.
- name null·공백은 검증 오류로 처리한다.
- Owner는 모든 workspace project 수정 가능, Member는 본인 Creator project만 수정 가능하다.
- 비멤버는 project 존재 여부를 확인하기 전에 WORKSPACE_NOT_FOUND로 처리한다.
- 다른 workspace의 projectId는 PROJECT_NOT_FOUND로 처리한다.
- 수정은 단일 transaction에서 수행한다.
- update 대상은 name, description, updatedAt으로 제한한다.
- 프로젝트 schema와 migration은 변경하지 않는다.
- 프로젝트 삭제와 프론트엔드 변경은 별도 기능으로 둔다.
- 사용자가 명시적으로 요청하기 전에는 Git commit을 실행하지 않는다.
