# 프로젝트 목록 조회 백엔드 구현 계획

> **에이전트 작업자용:** 이 계획을 실행할 때는 `superpowers:subagent-driven-development`(권장) 또는 `superpowers:executing-plans`를 사용한다. 단계는 체크박스(`- [ ]`)로 추적하며, 각 구현 단계는 테스트를 먼저 작성하고 실패를 확인한 뒤 production code를 작성한다.

**목표:** 인증된 워크스페이스 멤버가 프로젝트 이름으로 검색하고 페이지 단위로 프로젝트 목록을 조회할 수 있는 `GET /workspaces/:workspaceId/projects` API와 재사용 가능한 목록 query·페이지네이션 모듈을 추가한다.

**아키텍처:** 기존 `routes → controllers → services → db/schema` MVC 구조를 유지한다. 공통 모듈은 목록 query 파싱·정규화, `LIKE` 검색 패턴 이스케이프, offset·페이지네이션 메타데이터 계산만 담당하고, 프로젝트 서비스는 워크스페이스 멤버십 확인과 `projects.name` 검색 조건·Drizzle 조회를 소유한다. 공통 모듈의 인터페이스를 작게 유지해 이후 워크스페이스·화이트보드 문서·멤버 목록에서도 같은 query 계약과 메타데이터 계산을 재사용한다.

**기술 스택:** Node.js 20+, TypeScript, Express, Drizzle ORM/PostgreSQL, Zod, Vitest, Supertest, pnpm.

**근거 문서:**

- [`PRODUCT.md`](../../../PRODUCT.md) §5 Project, §9 워크스페이스 홈(프로젝트 목록), §10 검색 및 프로젝트 관리
- [`DESIGN.md`](../../../DESIGN.md) §8.20 Search, §8.22 Pagination, §9.2 List
- [`docs/superpowers/specs/2026-09-08-project-creation-backend-design.md`](../specs/2026-09-08-project-creation-backend-design.md)의 기존 Project 스키마·멤버십·응답 관례
- [`backend/README.md`](../../../backend/README.md)의 MVC 계층 및 검증 명령

## 전역 제약

- API 경로는 `GET /workspaces/:workspaceId/projects`로 고정한다.
- 인증은 기존 `authenticate` 미들웨어와 `requireUser(req)`를 사용한다.
- `workspaceId`는 기존 `projectParamsSchema`로 UUID 검증하고, 실패 시 `400 VALIDATION_ERROR`를 반환한다.
- 워크스페이스 멤버십이 없는 사용자는 워크스페이스 존재 여부를 노출하지 않도록 `404 WORKSPACE_NOT_FOUND`를 반환한다.
- 검색 query parameter 이름은 `search`로 고정하고 프로젝트 이름에 대해서만 대소문자 구분 없는 포함 검색을 수행한다.
- `search`는 앞뒤 공백을 제거하며 빈 문자열은 검색 조건이 없는 것으로 처리한다.
- `page`는 1부터 시작하고 기본값은 `1`, `limit` 기본값은 `20`, 최대값은 `100`으로 한다.
- 잘못된 `search`, `page`, `limit`은 `400 VALIDATION_ERROR`를 반환하고 DB를 호출하지 않는다.
- 응답은 `{ projects, pagination }` 형태로 반환하며 `pagination`은 `page`, `limit`, `total`, `totalPages`를 포함한다.
- 프로젝트는 `updatedAt DESC`, `createdAt DESC`, `id ASC` 순으로 정렬해 페이지 간 순서를 결정적으로 유지한다.
- 프로젝트 목록 항목은 `id`, `workspaceId`, `name`, `description`, `creatorId`, `creator: { id, name }`, `createdAt`, `updatedAt`을 포함한다.
- 검색 결과가 없거나 프로젝트가 없는 경우 오류가 아니라 `200`과 빈 `projects` 배열을 반환한다. `totalPages`는 `0`으로 계산한다.
- `page`가 전체 페이지보다 크면 오류가 아니라 해당 페이지의 빈 배열과 계산된 pagination을 반환한다.
- 공통 모듈은 프로젝트 테이블이나 특정 검색 컬럼을 알지 않는다. 각 도메인 서비스가 검색 대상 컬럼을 선택한다.
- 기존 `POST /workspaces/:workspaceId/projects` 동작과 테스트를 변경하지 않는다.
- 기존 프로젝트·사용자·워크스페이스 스키마와 migration SQL은 변경하지 않는다.
- 실제 DB migration 실행은 하지 않는다.
- 모든 문서·테스트 설명·사용자-facing 오류 메시지는 한국어로 작성한다.
- 사용자가 요청하기 전에는 Git commit, push, merge를 실행하지 않는다.

## 공통 모듈 설계

공통 목록 기능의 seam은 “HTTP query를 안정적인 값으로 바꾸고, 조회 결과를 페이지 메타데이터로 감싸는 지점”으로 둔다. 검색 컬럼과 SQL 조회는 리소스마다 다르므로 공통 모듈에 Drizzle 테이블이나 `ilike(projects.name, ...)`를 넣지 않는다.

### 공통 query 인터페이스

`backend/src/schemas/list-query.schema.ts`에 다음 두 스키마를 둔다.

```ts
export const paginationQuerySchema = z.object({
  page: z.coerce
    .number({ error: ERROR_MESSAGES.PAGE_INVALID })
    .int(ERROR_MESSAGES.PAGE_INVALID)
    .min(1, ERROR_MESSAGES.PAGE_INVALID)
    .default(1),
  limit: z.coerce
    .number({ error: ERROR_MESSAGES.LIMIT_INVALID })
    .int(ERROR_MESSAGES.LIMIT_INVALID)
    .min(1, ERROR_MESSAGES.LIMIT_INVALID)
    .max(100, ERROR_MESSAGES.LIMIT_TOO_LARGE)
    .default(20),
});

export const listQuerySchema = paginationQuerySchema.extend({
  search: z
    .string({ error: ERROR_MESSAGES.SEARCH_INVALID })
    .trim()
    .max(100, ERROR_MESSAGES.SEARCH_TOO_LONG)
    .optional()
    .transform((value) => value || undefined),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
export type ListQuery = z.infer<typeof listQuerySchema>;
```

`paginationQuerySchema`는 검색이 없는 목록에도 재사용하고, `listQuerySchema`는 검색 가능한 목록의 기본 계약으로 사용한다. `parseOrThrow(listQuerySchema, req.query)` 이후의 호출자는 `page`와 `limit`이 양의 정수이고, `search`가 trim된 문자열 또는 `undefined`라는 불변식을 얻는다.

### 공통 페이지네이션 인터페이스

`backend/src/utils/pagination.ts`는 다음만 노출한다.

```ts
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function getPaginationOffset(
  input: Pick<PaginationMeta, "page" | "limit">,
): number;

export function createPaginationMeta(input: {
  page: number;
  limit: number;
  total: number;
}): PaginationMeta;
```

`getPaginationOffset`은 `(page - 1) * limit`을 반환하고, `createPaginationMeta`는 `Math.ceil(total / limit)`을 사용한다. `total`이 `0`이면 `totalPages`는 `0`이다. DB의 `count()` 결과가 `bigint`인 경우 변환은 도메인 서비스에서 `Number()`로 수행한 뒤 이 모듈에 전달한다.

### 공통 검색 패턴 인터페이스

`backend/src/utils/search.ts`는 SQL 컬럼을 받지 않고, 사용자 입력을 PostgreSQL `LIKE` 패턴으로 변환하는 작은 함수만 제공한다.

```ts
export function buildContainsSearchPattern(value: string): string {
  const escaped = value.replace(/[\\%_]/g, "\\$&");
  return `%${escaped}%`;
}
```

이렇게 하면 `%`, `_`, `\\`가 사용자의 검색어에서 wildcard로 오인되지 않는다. 실제 `ilike(column, pattern)` 호출은 프로젝트 서비스가 담당하므로 다른 목록은 이름·이메일·문서명 등 각자 필요한 컬럼을 선택할 수 있다.

## 파일 경계

다음 파일을 추가하거나 수정한다.

- 추가: `backend/src/schemas/list-query.schema.ts`
  - pagination-only 및 search-enabled 목록 query 스키마와 타입을 정의한다.
- 추가: `backend/src/utils/pagination.ts`
  - offset과 공통 pagination metadata를 계산한다.
- 추가: `backend/src/utils/search.ts`
  - literal contains 검색용 `LIKE` pattern을 만든다.
- 수정: `backend/src/constants/messages.ts`
  - 공통 query 검증 메시지를 추가한다.
- 수정: `backend/src/services/project.service.ts`
  - 멤버십 확인, 이름 검색, count, creator join, limit/offset 조회를 구현한다.
- 수정: `backend/src/controllers/project.controller.ts`
  - path/query 파싱과 목록 응답을 연결한다.
- 수정: `backend/src/routes/project.routes.ts`
  - 인증된 `GET /` 라우트를 추가한다.
- 수정: `backend/tests/project.test.ts`
  - 프로젝트 목록 API의 HTTP 계약과 Drizzle query 호출 순서를 검증한다.
- 추가: `backend/tests/list-query.test.ts`
  - 공통 query 스키마를 검증한다.
- 추가: `backend/tests/pagination.test.ts`
  - offset 및 pagination metadata를 검증한다.
- 추가: `backend/tests/search.test.ts`
  - wildcard escape와 contains pattern을 검증한다.

## 구현 계획

### Task 1: 공통 query 검증과 pagination/search 모듈의 실패 테스트 작성

**Files:**

- Create: `backend/tests/list-query.test.ts`
- Create: `backend/tests/pagination.test.ts`
- Create: `backend/tests/search.test.ts`

**Interfaces:**

- Consumes: 아직 구현되지 않은 `listQuerySchema`, `paginationQuerySchema`, `getPaginationOffset`, `createPaginationMeta`, `buildContainsSearchPattern`
- Produces: 공통 모듈이 제공해야 하는 입력 정규화·오류·계산 계약

- [ ] **Step 1: 목록 query 스키마 실패 테스트를 작성한다.**

`backend/tests/list-query.test.ts`에 다음 테스트를 작성한다.

```ts
import { describe, expect, it } from "vitest";
import {
  listQuerySchema,
  paginationQuerySchema,
} from "@/schemas/list-query.schema";

describe("페이지네이션 query 스키마", () => {
  it("query 값이 없으면 페이지 1과 페이지 크기 20을 사용한다", () => {
    expect(paginationQuerySchema.parse({})).toEqual({ page: 1, limit: 20 });
  });

  it("숫자 query 문자열을 숫자로 변환한다", () => {
    expect(paginationQuerySchema.parse({ page: "2", limit: "10" })).toEqual({
      page: 2,
      limit: 10,
    });
  });

  it.each([
    { page: "0", limit: "20" },
    { page: "1.5", limit: "20" },
    { page: "1", limit: "0" },
    { page: "1", limit: "101" },
    { page: "not-a-number", limit: "20" },
  ])("잘못된 페이지네이션 값을 거부한다: %j", (query) => {
    expect(() => paginationQuerySchema.parse(query)).toThrow();
  });
});

describe("목록 query 스키마", () => {
  it("검색어의 앞뒤 공백을 제거하고 빈 검색어를 undefined로 변환한다", () => {
    expect(listQuerySchema.parse({ search: "  Brand  " })).toEqual({
      search: "Brand",
      page: 1,
      limit: 20,
    });
    expect(listQuerySchema.parse({ search: "   " })).toEqual({
      search: undefined,
      page: 1,
      limit: 20,
    });
  });

  it("100자를 초과하는 검색어를 거부한다", () => {
    expect(() => listQuerySchema.parse({ search: "a".repeat(101) })).toThrow();
  });
});
```

- [ ] **Step 2: pagination helper 실패 테스트를 작성한다.**

`backend/tests/pagination.test.ts`에 다음 계약을 작성한다.

```ts
import { describe, expect, it } from "vitest";
import { createPaginationMeta, getPaginationOffset } from "@/utils/pagination";

describe("페이지네이션 offset 계산", () => {
  it("1부터 시작하는 페이지에서 0부터 시작하는 offset을 계산한다", () => {
    expect(getPaginationOffset({ page: 1, limit: 20 })).toBe(0);
    expect(getPaginationOffset({ page: 3, limit: 20 })).toBe(40);
  });
});

describe("페이지네이션 메타데이터 생성", () => {
  it.each([
    { total: 0, limit: 20, totalPages: 0 },
    { total: 1, limit: 20, totalPages: 1 },
    { total: 40, limit: 20, totalPages: 2 },
    { total: 41, limit: 20, totalPages: 3 },
  ])(
    "$total개 항목의 전체 페이지 수를 계산한다",
    ({ total, limit, totalPages }) => {
      expect(createPaginationMeta({ page: 2, limit, total })).toEqual({
        page: 2,
        limit,
        total,
        totalPages,
      });
    },
  );
});
```

- [ ] **Step 3: 검색 pattern helper 실패 테스트를 작성한다.**

`backend/tests/search.test.ts`에 다음 테스트를 작성한다.

```ts
import { describe, expect, it } from "vitest";
import { buildContainsSearchPattern } from "@/utils/search";

describe("포함 검색 패턴 생성", () => {
  it("검색어 앞뒤에 포함 검색 와일드카드를 붙인다", () => {
    expect(buildContainsSearchPattern("Brand")).toBe("%Brand%");
  });

  it("LIKE 와일드카드 문자를 escape한다", () => {
    expect(buildContainsSearchPattern("100%_done\\now")).toBe(
      "%100\\%\\_done\\\\now%",
    );
  });
});
```

- [ ] **Step 4: 공통 테스트가 구현 부재로 실패하는지 확인한다.**

실행:

```bash
pnpm --dir backend exec vitest run tests/list-query.test.ts tests/pagination.test.ts tests/search.test.ts
```

기대 결과: 모듈 또는 export가 아직 없어 import/실행이 실패한다. 이 단계에서 테스트 자체의 문법 오류가 아니라 기능 부재로 실패하는지 확인한다.

### Task 2: 공통 query·pagination·search 모듈 구현

**Files:**

- Create: `backend/src/schemas/list-query.schema.ts`
- Create: `backend/src/utils/pagination.ts`
- Create: `backend/src/utils/search.ts`
- Modify: `backend/src/constants/messages.ts`
- Test: `backend/tests/list-query.test.ts`
- Test: `backend/tests/pagination.test.ts`
- Test: `backend/tests/search.test.ts`

**Interfaces:**

- Consumes: Task 1의 failing tests와 기존 `ERROR_MESSAGES`/`parseOrThrow` 규칙
- Produces: 이후 도메인 목록이 공유할 `paginationQuerySchema`, `listQuerySchema`, `PaginationQuery`, `ListQuery`, `PaginationMeta`, `getPaginationOffset`, `createPaginationMeta`, `buildContainsSearchPattern`

- [ ] **Step 1: 공통 검증 메시지를 추가한다.**

`backend/src/constants/messages.ts`의 `ERROR_MESSAGES`에 다음 항목을 추가한다.

```ts
SEARCH_INVALID: "검색어는 문자열이어야 합니다",
SEARCH_TOO_LONG: "검색어는 100자 이내로 입력해주세요",
PAGE_INVALID: "페이지는 1 이상의 정수여야 합니다",
LIMIT_INVALID: "페이지 크기는 1 이상의 정수여야 합니다",
LIMIT_TOO_LARGE: "페이지 크기는 100 이하로 입력해주세요",
```

- [ ] **Step 2: query schema를 구현한다.**

`backend/src/schemas/list-query.schema.ts`에 `z.coerce.number()`를 사용해 Express query string을 숫자로 변환하고, `search`는 trim 후 빈 문자열을 `undefined`로 정규화한다. 공통 pagination-only schema와 search-enabled schema를 분리해 검색이 없는 목록에서도 pagination 부분만 재사용할 수 있게 한다.

- [ ] **Step 3: pagination helper를 구현한다.**

`backend/src/utils/pagination.ts`에 Task 1의 인터페이스를 구현한다.

```ts
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function getPaginationOffset({
  page,
  limit,
}: Pick<PaginationMeta, "page" | "limit">) {
  return (page - 1) * limit;
}

export function createPaginationMeta({
  page,
  limit,
  total,
}: {
  page: number;
  limit: number;
  total: number;
}): PaginationMeta {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}
```

- [ ] **Step 4: literal contains 검색 pattern helper를 구현한다.**

`backend/src/utils/search.ts`에서 `\\`, `%`, `_`를 역슬래시로 escape한 뒤 앞뒤에 `%`를 붙인다. 프로젝트 서비스는 이 반환값을 Drizzle `ilike`에 전달한다.

- [ ] **Step 5: 공통 테스트를 GREEN으로 확인한다.**

실행:

```bash
pnpm --dir backend exec vitest run tests/list-query.test.ts tests/pagination.test.ts tests/search.test.ts
```

기대 결과: query 기본값·정규화·검증, offset·페이지 수 계산, wildcard escape 테스트가 모두 통과한다.

### Task 3: 프로젝트 목록 API의 failing 통합 테스트 작성

**Files:**

- Modify: `backend/tests/project.test.ts`

**Interfaces:**

- Consumes: Task 2의 공통 query/pagination/search 계약, 기존 `createApp`, `signAccessToken`, 프로젝트·멤버십·사용자 스키마
- Produces: `GET /workspaces/:workspaceId/projects`가 제공해야 하는 인증·검색·페이지네이션·권한·DB 오류 계약

- [ ] **Step 1: DB mock에 `select`를 추가하고 매 테스트마다 초기화한다.**

기존 mock을 다음처럼 확장한다. 기존 `transaction` mock과 POST 테스트 동작은 그대로 유지한다.

```ts
vi.mock("@/db/client", () => ({
  db: {
    transaction: vi.fn(),
    select: vi.fn(),
  },
}));

beforeEach(() => {
  vi.mocked(db.transaction).mockReset();
  vi.mocked(db.select).mockReset();
});
```

- [ ] **Step 2: 목록 query chain mock helper를 추가한다.**

`membershipQuery`, `countQuery`, `projectQuery`를 분리해 멤버십 조회 후 count와 목록 조회가 각각 필요한 메서드를 호출하는지 확인할 수 있게 한다.

```ts
function mockProjectListQueries({
  membershipRows = [{ id: "membership-1" }],
  countRows = [{ total: 3 }],
  projectRows = [
    {
      ...createdProject,
      creator: { id: "user-1", name: "작성자" },
    },
  ],
  membershipError,
  countError,
  projectError,
}: {
  membershipRows?: unknown[];
  countRows?: unknown[];
  projectRows?: unknown[];
  membershipError?: Error;
  countError?: Error;
  projectError?: Error;
} = {}) {
  const membershipQuery = {
    from: vi.fn().mockReturnThis(),
    where: membershipError
      ? vi.fn().mockRejectedValue(membershipError)
      : vi.fn().mockResolvedValue(membershipRows),
  };
  const countQuery = {
    from: vi.fn().mockReturnThis(),
    where: countError
      ? vi.fn().mockRejectedValue(countError)
      : vi.fn().mockResolvedValue(countRows),
  };
  const projectQuery = {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: projectError
      ? vi.fn().mockRejectedValue(projectError)
      : vi.fn().mockResolvedValue(projectRows),
  };

  vi.mocked(db.select)
    .mockReturnValueOnce(membershipQuery as never)
    .mockReturnValueOnce(countQuery as never)
    .mockReturnValueOnce(projectQuery as never);

  return { membershipQuery, countQuery, projectQuery };
}
```

`projectQuery.where`는 마지막 Promise를 `offset`에서 기다리는 체인을 제공한다. 실제 구현이 `where` 이후 `limit`과 `offset`을 호출한다는 계약을 테스트에서 고정한다.

- [ ] **Step 3: 검색·페이지네이션 성공 테스트를 추가한다.**

기존 POST describe 바깥에 `GET /workspaces/:workspaceId/projects` describe를 추가한다. `search=Brand`, `page=2`, `limit=2` 요청이 이름 검색과 offset을 적용하고 pagination metadata와 creator 정보를 반환하는지 검증한다.

```ts
import { and, asc, desc, eq, ilike } from "drizzle-orm";

describe("GET /workspaces/:workspaceId/projects", () => {
  it("검색된 프로젝트와 페이지네이션 메타데이터를 반환한다", async () => {
    const createdAt = new Date("2026-09-08T00:00:00.000Z");
    const updatedAt = new Date("2026-09-08T00:05:00.000Z");
    const { membershipQuery, countQuery, projectQuery } =
      mockProjectListQueries({
        countRows: [{ total: 5 }],
        projectRows: [
          {
            id: "project-3",
            workspaceId,
            name: "Brand Campaign",
            description: "설명",
            creatorId: "user-2",
            creator: { id: "user-2", name: "홍길동" },
            createdAt,
            updatedAt,
          },
        ],
      });

    const response = await request(createApp())
      .get(`/workspaces/${workspaceId}/projects`)
      .query({ search: "  Brand  ", page: "2", limit: "2" })
      .set("Authorization", `Bearer ${await createAccessToken()}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      projects: [
        {
          id: "project-3",
          workspaceId,
          name: "Brand Campaign",
          description: "설명",
          creatorId: "user-2",
          creator: { id: "user-2", name: "홍길동" },
          createdAt: createdAt.toISOString(),
          updatedAt: updatedAt.toISOString(),
        },
      ],
      pagination: { page: 2, limit: 2, total: 5, totalPages: 3 },
    });
    expect(membershipQuery.where).toHaveBeenCalledOnce();
    expect(countQuery.where).toHaveBeenCalledOnce();
    expect(projectQuery.innerJoin).toHaveBeenCalledOnce();
    expect(membershipQuery.where).toHaveBeenCalledWith(
      and(
        eq(workspaceMemberships.workspaceId, workspaceId),
        eq(workspaceMemberships.userId, "user-1"),
      ),
    );
    expect(countQuery.where).toHaveBeenCalledWith(
      and(
        eq(projects.workspaceId, workspaceId),
        ilike(projects.name, "%Brand%"),
      ),
    );
    expect(projectQuery.where).toHaveBeenCalledWith(
      and(
        eq(projects.workspaceId, workspaceId),
        ilike(projects.name, "%Brand%"),
      ),
    );
    expect(projectQuery.orderBy).toHaveBeenCalledWith(
      desc(projects.updatedAt),
      desc(projects.createdAt),
      asc(projects.id),
    );
    expect(projectQuery.limit).toHaveBeenCalledWith(2);
    expect(projectQuery.offset).toHaveBeenCalledWith(2);
  });
});
```

실제 fixture의 `createdAt`과 `updatedAt`은 서로 다른 날짜를 사용해 JSON 응답의 두 필드를 정확히 검증한다.

- [ ] **Step 4: 기본값·빈 목록·검색 결과 없음 테스트를 추가한다.**

다음 계약을 각각 테스트한다.

```ts
it("query 값이 없으면 페이지 1과 페이지 크기 20을 사용한다", async () => {
  const { countQuery, projectQuery } = mockProjectListQueries({
    countRows: [{ total: 0 }],
    projectRows: [],
  });

  const response = await request(createApp())
    .get(`/workspaces/${workspaceId}/projects`)
    .set("Authorization", `Bearer ${await createAccessToken()}`);

  expect(response.status).toBe(200);
  expect(response.body).toEqual({
    projects: [],
    pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
  });
  expect(countQuery.where).toHaveBeenCalledOnce();
  expect(projectQuery.limit).toHaveBeenCalledWith(20);
  expect(projectQuery.offset).toHaveBeenCalledWith(0);
});

it("검색 결과가 없으면 빈 페이지를 반환한다", async () => {
  mockProjectListQueries({ countRows: [{ total: 0 }], projectRows: [] });

  const response = await request(createApp())
    .get(`/workspaces/${workspaceId}/projects`)
    .query({ search: "missing" })
    .set("Authorization", `Bearer ${await createAccessToken()}`);

  expect(response.status).toBe(200);
  expect(response.body.projects).toEqual([]);
  expect(response.body.pagination).toEqual({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
});
```

- [ ] **Step 5: 인증·query 검증·비멤버 경계 테스트를 추가한다.**

```ts
it("인증이 없으면 401을 반환하고 DB 조회를 건너뛴다", async () => {
  const response = await request(createApp()).get(
    `/workspaces/${workspaceId}/projects`,
  );

  expect(response.status).toBe(401);
  expect(response.body.error.code).toBe("UNAUTHORIZED");
  expect(db.select).not.toHaveBeenCalled();
});

it.each([
  { workspaceId: "not-a-uuid", query: {} },
  { workspaceId, query: { page: "0" } },
  { workspaceId, query: { limit: "101" } },
  { workspaceId, query: { search: "a".repeat(101) } },
])(
  "잘못된 목록 입력이면 400을 반환한다: $query",
  async ({ workspaceId: pathWorkspaceId, query }) => {
    const response = await request(createApp())
      .get(`/workspaces/${pathWorkspaceId}/projects`)
      .query(query)
      .set("Authorization", `Bearer ${await createAccessToken()}`);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(db.select).not.toHaveBeenCalled();
  },
);

it("비멤버면 404를 반환하고 프로젝트 조회를 건너뛴다", async () => {
  const { countQuery, projectQuery } = mockProjectListQueries({
    membershipRows: [],
  });

  const response = await request(createApp())
    .get(`/workspaces/${workspaceId}/projects`)
    .set("Authorization", `Bearer ${await createAccessToken()}`);

  expect(response.status).toBe(404);
  expect(response.body.error.code).toBe("WORKSPACE_NOT_FOUND");
  expect(countQuery.where).not.toHaveBeenCalled();
  expect(projectQuery.where).not.toHaveBeenCalled();
});
```

- [ ] **Step 6: 멤버십·count·목록 DB 오류 테스트를 추가한다.**

각 query의 Promise가 거부될 때 공통 에러 핸들러를 통해 `500 INTERNAL_SERVER_ERROR`가 반환되는지 확인한다. 멤버십 오류에서는 count/list query가 호출되지 않아야 하며, count 또는 목록 오류에서는 인증과 멤버십 확인 이후 `500`이 반환되어야 한다.

```ts
it.each([
  {
    label: "membership",
    options: { membershipError: new Error("membership failed") },
  },
  { label: "count", options: { countError: new Error("count failed") } },
  {
    label: "projects",
    options: { projectError: new Error("projects failed") },
  },
])("$label 조회가 실패하면 500을 반환한다", async ({ options }) => {
  mockProjectListQueries(options);

  const response = await request(createApp())
    .get(`/workspaces/${workspaceId}/projects`)
    .set("Authorization", `Bearer ${await createAccessToken()}`);

  expect(response.status).toBe(500);
  expect(response.body.error.code).toBe("INTERNAL_SERVER_ERROR");
});
```

- [ ] **Step 7: 목록 테스트가 기능 부재로 실패하는지 확인한다.**

실행:

```bash
pnpm --dir backend exec vitest run tests/project.test.ts
```

기대 결과: 기존 POST 테스트는 통과하고 새 GET 테스트는 아직 목록 route/service가 없어 실패한다. 404가 아닌 mock helper·fixture·테스트 import 오류로 실패하면 먼저 테스트를 수정한다.

### Task 4: 프로젝트 목록 서비스·controller·route 구현

**Files:**

- Modify: `backend/src/services/project.service.ts`
- Modify: `backend/src/controllers/project.controller.ts`
- Modify: `backend/src/routes/project.routes.ts`
- Test: `backend/tests/project.test.ts`

**Interfaces:**

- Consumes: `ListQuery`의 `search`, `page`, `limit`; `getPaginationOffset`; `createPaginationMeta`; `buildContainsSearchPattern`; 기존 `projects`, `users`, `workspaceMemberships` schema
- Produces: `listProjects(input: ListProjectsInput): Promise<ListProjectsResult>`, `listProjectsHandler`, 인증된 `GET /workspaces/:workspaceId/projects`

- [ ] **Step 1: 목록 타입과 입력 타입을 추가한다.**

`backend/src/services/project.service.ts`에 다음 타입을 추가한다.

```ts
import type { PaginationMeta } from "@/utils/pagination";

export interface ListProjectsInput {
  workspaceId: string;
  userId: string;
  search?: string;
  page: number;
  limit: number;
}

export interface ProjectListItem {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  creatorId: string;
  creator: { id: string; name: string };
  createdAt: Date;
  updatedAt: Date;
}

export interface ListProjectsResult {
  projects: ProjectListItem[];
  pagination: PaginationMeta;
}
```

- [ ] **Step 2: 멤버십 확인을 구현한다.**

`listProjects`의 첫 query는 `workspace_memberships`에서 `workspaceId`와 `userId`를 함께 조건으로 조회한다. 결과가 없으면 기존 프로젝트 생성 서비스와 동일하게 다음 오류를 던진다.

```ts
const [membership] = await db
  .select({ id: workspaceMemberships.id })
  .from(workspaceMemberships)
  .where(
    and(
      eq(workspaceMemberships.workspaceId, workspaceId),
      eq(workspaceMemberships.userId, userId),
    ),
  );

if (!membership) {
  throw new HttpError(
    404,
    "WORKSPACE_NOT_FOUND",
    ERROR_MESSAGES.WORKSPACE_NOT_FOUND,
  );
}
```

멤버십이 확인되기 전에는 count나 프로젝트 목록 query를 실행하지 않는다.

- [ ] **Step 3: 프로젝트 검색 조건과 count/list query를 구현한다.**

멤버십 확인 이후 공통 검색 pattern을 사용해 프로젝트 이름만 필터링한다. count와 목록 query는 동일한 `whereCondition`을 공유해 pagination total과 실제 결과의 범위가 어긋나지 않게 한다.

```ts
const whereCondition = and(
  eq(projects.workspaceId, workspaceId),
  search ? ilike(projects.name, buildContainsSearchPattern(search)) : undefined,
);

const [countRows, projectRows] = await Promise.all([
  db.select({ total: count() }).from(projects).where(whereCondition),
  db
    .select({
      id: projects.id,
      workspaceId: projects.workspaceId,
      name: projects.name,
      description: projects.description,
      creatorId: projects.creatorId,
      creator: { id: users.id, name: users.name },
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
    })
    .from(projects)
    .innerJoin(users, eq(projects.creatorId, users.id))
    .where(whereCondition)
    .orderBy(
      desc(projects.updatedAt),
      desc(projects.createdAt),
      asc(projects.id),
    )
    .limit(limit)
    .offset(getPaginationOffset({ page, limit })),
]);

const total = Number(countRows[0]?.total ?? 0);

return {
  projects: projectRows,
  pagination: createPaginationMeta({ page, limit, total }),
};
```

`count`와 `projectRows`는 `Promise.all`로 병렬 실행하되, 두 query 모두 membership 확인 이후에 생성한다. `users`는 `creatorId` foreign key와 cascade 규칙으로 프로젝트와 함께 유효한 행만 남으므로 inner join을 사용한다.

- [ ] **Step 4: controller에 목록 handler를 추가한다.**

`backend/src/controllers/project.controller.ts`에서 기존 생성 handler를 유지하면서 목록 schema와 서비스를 import한다.

```ts
import { listQuerySchema } from "@/schemas/list-query.schema";
import { createProject, listProjects } from "@/services/project.service";

export async function listProjectsHandler(req: Request, res: Response) {
  const user = requireUser(req);
  const { workspaceId } = parseOrThrow(projectParamsSchema, req.params);
  const { search, page, limit } = parseOrThrow(listQuerySchema, req.query);

  const result = await listProjects({
    workspaceId,
    userId: user.sub,
    search,
    page,
    limit,
  });

  res.status(200).json(result);
}
```

인증 확인과 입력 파싱이 끝나기 전에는 서비스를 호출하지 않는다. query 값은 schema가 정규화하므로 controller에서 다시 trim하거나 숫자로 변환하지 않는다.

- [ ] **Step 5: project router에 GET 라우트를 등록한다.**

`backend/src/routes/project.routes.ts`에서 handler를 import하고 기존 POST 라우트와 동일한 인증·비동기 wrapper를 사용한다.

```ts
import {
  createProjectHandler,
  listProjectsHandler,
} from "@/controllers/project.controller";

projectRouter.get("/", authenticate, asyncHandler(listProjectsHandler));
projectRouter.post("/", authenticate, asyncHandler(createProjectHandler));
```

기존 `router.use("/workspaces/:workspaceId/projects", projectRouter)`와 `mergeParams: true`는 그대로 유지한다. 별도 route index 변경은 필요하지 않다.

- [ ] **Step 6: API focused test를 GREEN으로 확인한다.**

실행:

```bash
pnpm --dir backend exec vitest run tests/project.test.ts
```

기대 결과: 기존 POST 테스트와 새 GET 테스트가 모두 통과한다. 특히 검색어 trim·이름 `ilike`, count/list query의 동일한 filter, `limit`·`offset`, creator join, non-member 404, 빈 결과, DB 오류를 확인한다.

### Task 5: 전체 품질 검증과 변경 범위 점검

**Files:**

- Verify: `backend/src/schemas/list-query.schema.ts`
- Verify: `backend/src/utils/pagination.ts`
- Verify: `backend/src/utils/search.ts`
- Verify: `backend/src/constants/messages.ts`
- Verify: `backend/src/services/project.service.ts`
- Verify: `backend/src/controllers/project.controller.ts`
- Verify: `backend/src/routes/project.routes.ts`
- Verify: `backend/tests/list-query.test.ts`
- Verify: `backend/tests/pagination.test.ts`
- Verify: `backend/tests/search.test.ts`
- Verify: `backend/tests/project.test.ts`

- [ ] **Step 1: 공통 모듈과 프로젝트 focused test를 다시 실행한다.**

```bash
pnpm --dir backend exec vitest run \
  tests/list-query.test.ts \
  tests/pagination.test.ts \
  tests/search.test.ts \
  tests/project.test.ts
```

기대 결과: 공통 모듈과 기존 POST·새 GET 테스트가 모두 통과한다.

- [ ] **Step 2: 전체 백엔드 테스트를 실행한다.**

```bash
pnpm --dir backend test
```

기대 결과: 기존 인증·워크스페이스·DB·미들웨어 테스트와 새 테스트가 모두 통과한다.

- [ ] **Step 3: lint와 build를 실행한다.**

```bash
pnpm --dir backend lint
pnpm --dir backend build
```

기대 결과: ESLint 오류가 없고 TypeScript 컴파일 및 alias 후처리가 성공한다.

- [ ] **Step 4: 변경 파일의 포맷과 공백을 검사한다.**

```bash
pnpm --dir backend exec prettier --check \
  src/constants/messages.ts \
  src/schemas/list-query.schema.ts \
  src/utils/pagination.ts \
  src/utils/search.ts \
  src/services/project.service.ts \
  src/controllers/project.controller.ts \
  src/routes/project.routes.ts \
  tests/list-query.test.ts \
  tests/pagination.test.ts \
  tests/search.test.ts \
  tests/project.test.ts
git diff --check
```

기대 결과: Prettier 오류와 whitespace 오류가 없다.

- [ ] **Step 5: 계획 범위와 최종 API 계약을 점검한다.**

다음을 read-only 확인한다.

```bash
git status --short
git diff --stat
rg -n "search|page|limit|pagination|ilike|offset|totalPages" \
  backend/src/schemas/list-query.schema.ts \
  backend/src/utils/pagination.ts \
  backend/src/utils/search.ts \
  backend/src/services/project.service.ts \
  backend/src/controllers/project.controller.ts \
  backend/src/routes/project.routes.ts \
  backend/tests/project.test.ts
```

최종 확인 항목은 다음과 같다.

- `GET /workspaces/:workspaceId/projects`가 실제 `projectRouter`에 연결되어 있다.
- 공통 query schema와 pagination/search helper가 프로젝트 서비스 밖에 있다.
- 프로젝트 서비스는 검색 컬럼을 `projects.name`으로만 선택하고, 공통 모듈은 Drizzle 테이블을 참조하지 않는다.
- count와 목록 query가 같은 workspace/search 조건을 사용한다.
- 멤버십 없는 사용자는 count/list query에 도달하지 않는다.
- 기존 POST 프로젝트 생성 기능과 schema/migration 파일은 변경되지 않는다.
- 실제 DB migration, Git commit, push, merge는 실행하지 않는다.

## 계획 자체 점검

- **문서 커버리지:** Project 목록의 required information과 멤버 접근 규칙은 Task 3~5에서, Search의 현재 범위 검색 규칙은 Task 2·4에서, Pagination의 page 단위 목록 규칙은 Task 1·2·4에서 반영한다.
- **재사용성:** pagination-only schema, search-enabled list schema, offset/meta helper, literal LIKE pattern helper를 별도 module로 둔다. 도메인별 검색 컬럼을 공통 module에 넣지 않아 다른 목록이 같은 interface를 사용하면서도 자체 조건을 선택할 수 있다.
- **보안:** path UUID 검증, 인증 middleware, membership 조건, non-member 404를 모두 테스트한다.
- **경계 조건:** 기본값, 빈 검색어, wildcard 문자, total 0, page 초과, invalid query, DB 오류를 테스트한다.
- **회귀 방지:** 기존 `POST /workspaces/:workspaceId/projects` 테스트를 유지하고 전체 backend test/lint/build를 실행한다.
- **placeholder 검사:** `TBD`, `TODO`, 미정 파일, “적절히 처리” 같은 미완성 지시를 포함하지 않는다.
- **사용자 규칙:** 문서·메시지는 한국어로 작성하고, 사용자의 요청 전에는 commit을 만들지 않는다.

## 실행 방식

이 계획은 테스트 우선으로 Task 1부터 순서대로 실행한다. 각 Task는 실패 테스트 작성 → 실패 확인 → 최소 구현 → focused test 통과 순서로 진행한다. 구현을 시작할 때는 `superpowers:subagent-driven-development` 또는 `superpowers:executing-plans` 중 하나를 선택하며, Git commit은 별도 요청이 있을 때만 실행한다.
