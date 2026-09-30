import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import { adminAuditLogs } from "@/db/schema";
import { recordAuditLog } from "@/services/admin-audit-log.service";

vi.mock("@/db/client", () => ({
  db: {
    insert: vi.fn(),
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
