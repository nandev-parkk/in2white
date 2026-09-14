# 워크스페이스 멤버 목록 조회 백엔드 설계

## 상태

설계 승인 완료 · 자체 검토 완료 · 사용자 검토 완료

## 목표

인증된 워크스페이스 Owner 또는 Member가 해당 워크스페이스에 소속된 사용자 목록을 이름이나 이메일로 검색하고 페이지 단위로 조회할 수 있는 API를 추가한다.

## 근거 문서와 기존 구현

- `PRODUCT.md` 멤버 목록 페이지
  - 이름, 이메일, 역할, 합류일을 표시한다.
  - 워크스페이스 Owner와 Member 모두 목록을 조회할 수 있다.
  - 멤버 검색을 제공한다.
- `PRODUCT.md` 멤버 관리
  - 역할은 `owner | member` 두 단계다.
  - 멤버 추가와 내보내기는 Owner 전용이지만 목록 조회는 전체 멤버에게 허용한다.
- `DESIGN.md` List Cell 및 Badge
  - 멤버 목록은 읽기 쉬운 단일 목록이며 역할과 합류일을 메타 정보로 표시한다.
- 기존 프로젝트 목록 백엔드
  - `GET /workspaces/:workspaceId/projects`
  - `authenticate`, `requireUser`, UUID 검증, 공통 `listQuerySchema`, 검색 패턴 escape, 페이지네이션 유틸리티를 재사용한다.
  - 비멤버에게 `404 WORKSPACE_NOT_FOUND`를 반환해 워크스페이스 존재를 숨긴다.
- 기존 데이터 모델
  - `workspace_memberships`가 워크스페이스, 사용자, 역할, 합류 시각을 가진다.
  - `users`가 사용자 이름과 이메일을 가진다.

## 범위

### 포함

- `GET /workspaces/:workspaceId/members` API
- 이름 또는 이메일의 대소문자 무시 부분 일치 검색
- `page`, `limit` 기반 페이지네이션
- Owner 우선의 안정적인 정렬
- 요청자의 워크스페이스 멤버십 확인
- 사용자 ID, 이름, 이메일, 역할, 합류일 응답
- 인증, 입력, 권한, 검색, 페이지네이션, 빈 결과, DB 오류 테스트

### 제외

- 전체 사용자 검색 API
- 워크스페이스 멤버 추가 및 내보내기 API
- 역할 변경
- 멤버 프로필 상세 조회
- `currentRole`, `canManageMembers` 등 요청자 권한 정보의 중복 응답
- 데이터베이스 스키마 또는 마이그레이션 변경
- 프론트엔드 멤버 목록 화면

## 검토한 접근법

### 1. 멤버 전용 모듈 추가 — 선택

`member.routes.ts`, `member.controller.ts`, `member.service.ts`, `member.schema.ts`로 멤버 조회 책임을 분리한다. 이후 멤버 추가와 내보내기도 같은 경계 안에서 확장할 수 있고, 워크스페이스 자체 CRUD와 멤버 관리가 섞이지 않는다.

### 2. 기존 workspace 모듈에 추가

새 파일 수는 줄지만 워크스페이스 생성·조회·수정·삭제와 멤버 관리 책임이 한 서비스에 누적된다. 향후 멤버 추가와 내보내기를 구현하면 모듈 경계가 더 흐려진다.

### 3. 범용 목록 조회 추상화 도입

프로젝트 목록과 일부 검색·페이지네이션 흐름을 추상화할 수 있지만, 도메인별 권한과 조인 대상이 달라 추상화의 이점보다 결합 비용이 크다. 공통 스키마와 유틸리티만 재사용한다.

## API 계약

### 요청

~~~http
GET /workspaces/:workspaceId/members?search=kim&page=1&limit=20
Authorization: Bearer <access-token>
~~~

### 입력 규칙

| 입력 | 규칙 | 기본값 |
|---|---|---:|
| `workspaceId` | UUID | 없음 |
| `search` | trim 후 최대 100자, 빈 문자열은 미지정으로 처리 | 미지정 |
| `page` | 1 이상의 정수 | 1 |
| `limit` | 1 이상 100 이하의 정수 | 20 |

검색어는 이름과 이메일에 동일하게 적용한다. 기존 `buildContainsSearchPattern`으로 `\\`, `%`, `_`를 escape하고 PostgreSQL `ILIKE`를 사용해 대소문자를 구분하지 않는 부분 일치를 수행한다.

### 성공 응답

HTTP 200을 반환한다.

~~~json
{
  "members": [
    {
      "userId": "user-uuid",
      "name": "홍길동",
      "email": "user@example.com",
      "role": "owner",
      "joinedAt": "2026-09-10T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
~~~

- `userId`는 `users.id`다. 멤버십 ID와 혼동되는 일반적인 `id` 필드를 사용하지 않는다.
- `joinedAt`은 `workspace_memberships.created_at`이며 Express JSON 직렬화로 ISO 문자열이 된다.
- Owner도 실제 `workspace_memberships` 행으로 반환한다. `workspaces.owner_id`를 이용해 별도 항목을 합성하지 않는다.
- 검색 결과가 없거나 `page`가 마지막 페이지를 초과하면 `200`, 빈 `members`, 실제 전체 건수를 반영한 `pagination`을 반환한다.
- 응답에는 비밀번호 해시를 포함하지 않으며 서비스의 select 대상에도 `passwordHash`를 넣지 않는다.

### 정렬

다음 순서를 고정한다.

1. `owner` 역할 우선
2. `workspace_memberships.created_at ASC`
3. `users.id ASC`

역할 enum의 문자열 정렬에 의존하지 않고 SQL `CASE` 우선순위 표현식을 사용한다. 사용자 ID를 최종 tie-breaker로 사용해 페이지 간 순서를 안정적으로 유지한다.

## 권한 및 오류 계약

### 권한 규칙

1. `authenticate`가 Access Token을 검증하고 `req.user`를 설정한다.
2. controller가 `requireUser(req)`로 인증 주체를 가져온다.
3. service가 `workspace_memberships`에서 `workspaceId`와 요청자 `userId`가 모두 일치하는 행을 조회한다.
4. 역할이 `owner` 또는 `member`이면 동일하게 목록 조회를 허용한다.
5. 멤버십이 없으면 사용자 목록 쿼리 전에 `404 WORKSPACE_NOT_FOUND`를 반환한다.

멤버십 확인 이후의 count와 목록 쿼리는 모두 요청 경로의 `workspaceId`를 필수 조건으로 사용한다. 다른 워크스페이스의 사용자 또는 멤버십은 반환하지 않는다. 권한 판단 시점과 동시에 발생하는 멤버십 변경은 요청 시점의 조회 결과를 기준으로 처리하며, 강한 직렬화나 잠금은 이번 읽기 전용 API 범위에 포함하지 않는다.

### 오류 응답

기존 `errorHandlerMiddleware` 형식을 사용한다.

| 상황 | 상태 | 코드 | 메시지 |
|---|---:|---|---|
| 인증 실패 | 401 | `UNAUTHORIZED` | 기존 인증 오류 메시지 |
| 잘못된 `workspaceId` | 400 | `VALIDATION_ERROR` | 유효하지 않은 워크스페이스 ID입니다 |
| 잘못된 `search`, `page`, `limit` | 400 | `VALIDATION_ERROR` | 기존 목록 입력 오류 메시지 |
| 워크스페이스 비멤버 | 404 | `WORKSPACE_NOT_FOUND` | 워크스페이스를 찾을 수 없습니다 |
| 예상하지 못한 DB 오류 | 500 | `INTERNAL_SERVER_ERROR` | 기존 내부 오류 메시지 |

비멤버에게 403이 아닌 404를 반환해 워크스페이스 존재와 멤버 정보를 노출하지 않는다. 입력 검증은 DB 접근 전에 완료한다.

## 아키텍처와 데이터 흐름

### 계층별 책임

- routes
  - `memberRouter`를 `Router({ mergeParams: true })`로 생성한다.
  - `GET /`에 `authenticate`와 `asyncHandler(listMembersHandler)`를 등록한다.
  - route index에서 `/workspaces/:workspaceId/members`에 마운트한다.
  - 구체적인 member 경로를 일반 `/workspaces` 라우터보다 먼저 등록해 `/:workspaceId`와의 경로 충돌을 방지한다.
- controller
  - 인증 사용자, path parameter, query를 검증한다.
  - service 결과를 HTTP 200으로 반환한다.
- schema
  - `memberParamsSchema`가 `workspaceId` UUID를 검증한다.
  - 검색과 페이지네이션은 기존 `listQuerySchema`를 재사용한다.
- service
  - 요청자의 멤버십을 확인한다.
  - 동일한 workspace/search 조건으로 count와 목록을 조회한다.
  - 페이지네이션 메타데이터를 조립한다.
- db/schema
  - 기존 `workspace_memberships`와 `users`를 사용하며 스키마를 변경하지 않는다.

### 요청 흐름

1. 요청이 `/workspaces/:workspaceId/members`의 `memberRouter`에 도달한다.
2. `authenticate`가 Access Token을 검증한다.
3. controller가 `requireUser`, `memberParamsSchema`, `listQuerySchema`를 실행한다.
4. service가 요청자의 워크스페이스 멤버십을 조회한다.
5. 멤버십이 없으면 `WORKSPACE_NOT_FOUND`로 종료한다.
6. 검색어가 있으면 이름 또는 이메일 `ILIKE` 조건을 구성한다.
7. service가 같은 조건을 사용하는 count와 목록 쿼리를 병렬 실행한다.
8. 목록 쿼리가 역할 우선순위, 합류일, 사용자 ID로 정렬한 뒤 limit과 offset을 적용한다.
9. service가 `members`와 `pagination`을 반환한다.
10. controller가 HTTP 200으로 응답한다.

## 쿼리 설계

요청자 권한 확인은 대상 멤버 조회와 분리한다. 권한 확인이 성공한 뒤 count와 목록 조회를 시작하므로 비멤버 요청은 사용자 테이블 조인에 도달하지 않는다.

count와 목록의 공통 조건은 다음 의미를 가진다.

~~~text
workspace_memberships.workspace_id = :workspaceId
AND (
  users.name ILIKE :escapedSearchPattern
  OR users.email ILIKE :escapedSearchPattern
)
~~~

검색어가 없으면 괄호 안 조건 전체를 생략한다. count와 목록 모두 `workspace_memberships INNER JOIN users`를 사용해 같은 검색 집합을 보장한다. 데이터베이스 외래키가 사용자 존재를 보장하므로 누락 사용자에 대한 별도 보정은 하지 않는다.

count와 목록은 멤버십 확인 후 `Promise.all`로 실행한다. 두 쿼리가 동일한 조건을 공유하도록 서비스 내부에서 단일 `whereCondition`을 구성한다.

## 서비스 인터페이스

~~~ts
export interface ListMembersInput {
  workspaceId: string;
  requesterId: string;
  search?: string;
  page: number;
  limit: number;
}

export interface MemberListItem {
  userId: string;
  name: string;
  email: string;
  role: "owner" | "member";
  joinedAt: Date;
}

export interface ListMembersResult {
  members: MemberListItem[];
  pagination: PaginationMeta;
}

export async function listMembers(input: ListMembersInput): Promise<ListMembersResult>;
~~~

`requesterId`는 조회되는 멤버의 ID가 아니라 API를 호출한 인증 사용자의 ID임을 이름으로 드러낸다.

## 파일 경계

### 추가 파일

- `backend/src/schemas/member.schema.ts`
  - workspace path UUID 검증
- `backend/src/services/member.service.ts`
  - 멤버십 확인, 검색, count, 목록, 페이지네이션
- `backend/src/controllers/member.controller.ts`
  - 요청 검증과 응답
- `backend/src/routes/member.routes.ts`
  - 인증된 GET 라우트
- `backend/tests/member.test.ts`
  - API와 서비스 쿼리 계약 테스트

### 수정 파일

- `backend/src/routes/index.ts`
  - `/workspaces/:workspaceId/members` 라우터 등록

### 변경하지 않는 파일

- `backend/src/db/schema/**`
- `backend/src/db/migrations/**`
- 기존 workspace/project API 구현과 테스트
- `frontend/**`
- `PRODUCT.md`
- `DESIGN.md`

## 테스트 전략

Vitest, Supertest, 기존 DB mock 패턴으로 다음을 Red-Green-Refactor 순서로 검증한다.

1. Owner가 Owner와 Member를 함께 조회한다.
2. Member도 같은 목록을 조회할 수 있다.
3. 각 항목이 `userId`, `name`, `email`, `role`, `joinedAt`만 포함한다.
4. 이름 검색과 이메일 검색이 대소문자 무시 부분 일치 조건을 사용한다.
5. `%`, `_`, `\\`가 포함된 검색어를 기존 검색 escape 규칙으로 처리한다.
6. 검색이 없는 요청과 공백 검색어가 전체 멤버를 조회한다.
7. Owner 우선, 합류일, 사용자 ID 순서의 정렬 계약을 적용한다.
8. `page`, `limit`에 맞는 offset과 pagination metadata를 반환한다.
9. 검색 결과가 없거나 범위를 초과한 page는 빈 목록을 반환한다.
10. 인증이 없거나 토큰이 유효하지 않으면 401이며 DB를 호출하지 않는다.
11. 잘못된 UUID와 query는 400이며 DB를 호출하지 않는다.
12. 비멤버는 404이며 count와 목록 쿼리를 실행하지 않는다.
13. 멤버십 확인, count, 목록 쿼리 오류는 500 공통 오류 응답으로 변환된다.
14. 기존 백엔드 전체 테스트, lint, build, 변경 파일 Prettier 검사가 통과한다.

## 완료 기준

- 인증된 Owner와 Member가 멤버 목록을 조회할 수 있다.
- 이름 또는 이메일 검색과 페이지네이션이 API 계약대로 동작한다.
- 응답에 사용자 ID, 이름, 이메일, 역할, 합류일만 포함된다.
- 비멤버에게 워크스페이스와 멤버 정보가 노출되지 않는다.
- 정렬과 페이지 경계가 결정적으로 처리된다.
- 스키마와 마이그레이션 변경 없이 구현된다.
- 관련 테스트와 전체 백엔드 테스트, lint, build, formatting 검사가 통과한다.
- 구현 계획 문서에 실제 변경, 계획과의 차이, 검증 결과, 후속 작업을 기록한다.
