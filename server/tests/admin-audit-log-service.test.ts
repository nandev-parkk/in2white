import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import { adminAuditLogs } from "@/db/schema";
import { listAuditLogs, recordAuditLog } from "@/services/admin-audit-log.service";

vi.mock("@/db/client", () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
  },
}));

const insertedRow = { id: "log-1" };

/** `db.insert(...).values(...).returning()` 체인을 흉내내는 가짜 트랜잭션 핸들. */
function createTxStub() {
  const returning = vi.fn().mockResolvedValue([insertedRow]);
  const values = vi.fn().mockReturnValue({ returning });
  const insert = vi.fn().mockReturnValue({ values });
  return { insert, values, returning } as unknown as {
    insert: ReturnType<typeof vi.fn>;
    values: ReturnType<typeof vi.fn>;
    returning: ReturnType<typeof vi.fn>;
  };
}

const baseEntry = {
  adminId: "admin-1",
  action: "user.update",
  targetType: "user" as const,
  targetId: "user-1",
  summary: "사용자 이름을 변경했습니다",
};

describe("recordAuditLog", () => {
  beforeEach(() => {
    vi.mocked(db.insert).mockReset();
  });

  /*
   * 대상 변경과 같은 트랜잭션에 기록해야 한다. 전역 `db`를 쓰면 변경은 롤백되고
   * 로그만 남거나, 변경은 성공했는데 로그가 없는 상태가 생긴다.
   */
  it("writes through the given transaction handle, not the global db", async () => {
    const tx = createTxStub();

    await recordAuditLog(tx as never, baseEntry);

    expect(tx.insert).toHaveBeenCalledWith(adminAuditLogs);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("returns the inserted row", async () => {
    const tx = createTxStub();

    await expect(recordAuditLog(tx as never, baseEntry)).resolves.toEqual(insertedRow);
  });

  it("throws when the insert returns no row", async () => {
    const tx = createTxStub();
    tx.returning.mockResolvedValue([]);

    await expect(recordAuditLog(tx as never, baseEntry)).rejects.toThrow();
  });

  it("defaults metadata to an empty object", async () => {
    const tx = createTxStub();

    await recordAuditLog(tx as never, baseEntry);

    expect(tx.values).toHaveBeenCalledWith(expect.objectContaining({ metadata: {} }));
  });

  it("passes the request context through when given", async () => {
    const tx = createTxStub();

    await recordAuditLog(tx as never, {
      ...baseEntry,
      ip: "203.0.113.7",
      userAgent: "Mozilla/5.0",
    });

    expect(tx.values).toHaveBeenCalledWith(
      expect.objectContaining({ ip: "203.0.113.7", userAgent: "Mozilla/5.0" }),
    );
  });

  it("allows a null targetId for actions whose target does not exist yet", async () => {
    const tx = createTxStub();

    await recordAuditLog(tx as never, {
      ...baseEntry,
      action: "user.create",
      targetId: undefined,
    });

    const [values] = tx.values.mock.calls[0] as [Record<string, unknown>];
    expect(values.targetId).toBeUndefined();
  });
});

/*
 * 감사 로그는 조회 UI에 그대로 노출되고 오래 남는다. 비밀번호 해시나 평문이 한 번
 * 들어가면 회수할 방법이 없으므로, 호출자를 믿지 않고 기록 직전에 걸러낸다.
 */
describe("recordAuditLog metadata redaction", () => {
  beforeEach(() => {
    vi.mocked(db.insert).mockReset();
  });

  async function recordedMetadata(metadata: Record<string, unknown>) {
    const tx = createTxStub();
    await recordAuditLog(tx as never, { ...baseEntry, metadata });
    const [values] = tx.values.mock.calls[0] as [{ metadata: Record<string, unknown> }];
    return values.metadata;
  }

  it("drops passwordHash", async () => {
    const metadata = await recordedMetadata({ passwordHash: "$2b$10$abc", name: "Hong" });

    expect(metadata).toEqual({ name: "Hong" });
  });

  it.each(["password", "newPassword", "currentPassword", "password_hash", "plainPassword"])(
    "drops %s",
    async (key) => {
      const metadata = await recordedMetadata({ [key]: "hunter2", name: "Hong" });

      expect(metadata).toEqual({ name: "Hong" });
    },
  );

  it("drops secrets and tokens too", async () => {
    const metadata = await recordedMetadata({
      refreshToken: "abc",
      jwtSecret: "def",
      name: "Hong",
    });

    expect(metadata).toEqual({ name: "Hong" });
  });

  it("drops nested password fields", async () => {
    const metadata = await recordedMetadata({
      before: { name: "Hong", passwordHash: "$2b$10$abc" },
      after: { name: "Kim", passwordHash: "$2b$10$def" },
    });

    expect(metadata).toEqual({ before: { name: "Hong" }, after: { name: "Kim" } });
  });

  it("drops password fields inside arrays", async () => {
    const metadata = await recordedMetadata({
      members: [{ email: "a@example.com", password: "hunter2" }],
    });

    expect(metadata).toEqual({ members: [{ email: "a@example.com" }] });
  });

  /* 설계에서 비밀번호 재설정은 `{ passwordReset: true }`만 남기기로 했다. 이 키는 살려야 한다. */
  it("keeps the passwordReset marker", async () => {
    const metadata = await recordedMetadata({ passwordReset: true });

    expect(metadata).toEqual({ passwordReset: true });
  });

  it("does not mutate the caller's object", async () => {
    const original = { passwordHash: "$2b$10$abc", name: "Hong" };

    await recordedMetadata(original);

    expect(original.passwordHash).toBe("$2b$10$abc");
  });
});

/*
 * 목록은 어드민 계정과 join해서 누가 했는지 함께 보여준다. 어드민 계정이 삭제되지 않도록
 * 참조를 restrict로 둔 덕에 inner join으로 빠지는 행이 없다.
 */
describe("listAuditLogs", () => {
  const adminId = "550e8400-e29b-41d4-a716-446655440001";
  const createdAt = new Date("2026-09-30T10:00:00.000Z");

  /* join 결과는 평평하게 내려온다. 서비스가 중첩 객체로 조립하는지 보려고 그대로 둔다. */
  const logRow = {
    id: "550e8400-e29b-41d4-a716-446655440100",
    action: "user.update",
    targetType: "user",
    targetId: "550e8400-e29b-41d4-a716-446655440200",
    summary: "사용자 이름을 변경했습니다",
    metadata: { before: { name: "Hong" }, after: { name: "Kim" } },
    ip: "203.0.113.7",
    userAgent: "Mozilla/5.0",
    createdAt,
    adminId,
    adminEmail: "admin@example.com",
    adminName: "Kim Admin",
  };

  const COUNT_CHAIN = ["from", "where"];
  const ROWS_CHAIN = ["from", "innerJoin", "where", "orderBy", "limit", "offset"];

  function queryStub(methods: string[], rows: unknown[]) {
    const stub: Record<string, unknown> = {};
    methods.forEach((method, index) => {
      stub[method] =
        index < methods.length - 1
          ? vi.fn().mockReturnValue(stub)
          : vi.fn().mockResolvedValue(rows);
    });
    return stub;
  }

  function mockSelects(...stubs: Record<string, unknown>[]) {
    const mock = vi.mocked(db.select);
    stubs.forEach((stub) => mock.mockReturnValueOnce(stub as never));
  }

  beforeEach(() => {
    vi.mocked(db.select).mockReset();
  });

  it("어드민 정보를 중첩해 담고 페이지 정보를 함께 반환한다", async () => {
    const countStub = queryStub(COUNT_CHAIN, [{ total: 3 }]);
    const rowsStub = queryStub(ROWS_CHAIN, [logRow]);
    mockSelects(countStub, rowsStub);

    await expect(listAuditLogs({ page: 2, limit: 2 })).resolves.toEqual({
      auditLogs: [
        {
          id: logRow.id,
          action: "user.update",
          targetType: "user",
          targetId: logRow.targetId,
          summary: logRow.summary,
          metadata: logRow.metadata,
          ip: "203.0.113.7",
          userAgent: "Mozilla/5.0",
          createdAt,
          admin: { id: adminId, email: "admin@example.com", name: "Kim Admin" },
        },
      ],
      pagination: { page: 2, limit: 2, total: 3, totalPages: 2 },
    });
    expect(rowsStub.limit).toHaveBeenCalledWith(2);
    expect(rowsStub.offset).toHaveBeenCalledWith(2);
  });

  it("조건이 없으면 필터를 걸지 않는다", async () => {
    const countStub = queryStub(COUNT_CHAIN, [{ total: 0 }]);
    mockSelects(countStub, queryStub(ROWS_CHAIN, []));

    await listAuditLogs({ page: 1, limit: 20 });

    expect(countStub.where).toHaveBeenCalledWith(undefined);
  });

  /* 합계와 목록이 다른 조건을 쓰면 페이지 수가 실제 결과와 어긋난다. */
  it("어드민·액션·대상 타입·기간 조건을 두 쿼리에 같이 적용한다", async () => {
    const countStub = queryStub(COUNT_CHAIN, [{ total: 0 }]);
    const rowsStub = queryStub(ROWS_CHAIN, []);
    mockSelects(countStub, rowsStub);

    await listAuditLogs({
      adminId,
      action: "user.",
      targetType: "user",
      from: new Date("2026-09-01T00:00:00.000Z"),
      to: new Date("2026-09-30T23:59:59.000Z"),
      page: 1,
      limit: 20,
    });

    const countWhere = vi.mocked(countStub.where as (condition: unknown) => unknown);
    const rowsWhere = vi.mocked(rowsStub.where as (condition: unknown) => unknown);
    expect(countWhere.mock.calls[0]![0]).toBeDefined();
    expect(rowsWhere.mock.calls[0]![0]).toEqual(countWhere.mock.calls[0]![0]);
  });

  /* 액션은 `user.`처럼 앞부분만 넣어도 묶어서 볼 수 있어야 한다 — 완전 일치로 좁히지 않는다. */
  it("액션은 부분 일치로 찾고 LIKE 특수문자를 이스케이프한다", async () => {
    const countStub = queryStub(COUNT_CHAIN, [{ total: 0 }]);
    mockSelects(countStub, queryStub(ROWS_CHAIN, []));

    await listAuditLogs({ action: "user_", page: 1, limit: 20 });

    const where = vi.mocked(countStub.where as (condition: SQL) => unknown);
    expect(new PgDialect().sqlToQuery(where.mock.calls[0]![0]).params).toContain("%user\\_%");
  });

  it("합계 행이 없으면 총 0건으로 둔다", async () => {
    mockSelects(queryStub(COUNT_CHAIN, []), queryStub(ROWS_CHAIN, []));

    await expect(listAuditLogs({ page: 1, limit: 20 })).resolves.toMatchObject({
      auditLogs: [],
      pagination: { total: 0, totalPages: 0 },
    });
  });
});
