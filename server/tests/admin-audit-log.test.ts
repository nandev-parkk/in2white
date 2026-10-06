import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "@/app";
import { useTestServer } from "./test-server";
import { db } from "@/db/client";
import { signAdminAccessToken } from "@/lib/admin-jwt";
import { signAccessToken } from "@/lib/jwt";
import { adminAuditLogListQuerySchema } from "@/schemas/admin-audit-log.schema";
import * as adminAuditLogService from "@/services/admin-audit-log.service";

vi.mock("@/db/client", () => ({
  db: { select: vi.fn(), transaction: vi.fn() },
}));
vi.mock("@/services/admin-audit-log.service");

const appUrl = useTestServer(() => createApp());

const adminId = "550e8400-e29b-41d4-a716-446655440001";
const targetId = "550e8400-e29b-41d4-a716-446655440002";
const logId = "550e8400-e29b-41d4-a716-446655440100";
const createdAt = new Date("2026-09-30T10:00:00.000Z");

const auditLog = {
  id: logId,
  action: "user.update",
  targetType: "user" as const,
  targetId,
  summary: "사용자 이름을 변경했습니다",
  metadata: { before: { name: "Hong" }, after: { name: "Kim" } },
  ip: "203.0.113.7",
  userAgent: "Mozilla/5.0",
  createdAt,
  admin: { id: adminId, email: "admin@example.com", name: "Kim Admin" },
};

const serializedAuditLog = { ...auditLog, createdAt: createdAt.toISOString() };

async function adminAuthHeader(sub = adminId) {
  const token = await signAdminAccessToken({
    sub,
    email: "admin@example.com",
    sid: "admin-sid-1",
    ver: 0,
  });
  return `Bearer ${token}`;
}

async function productAuthHeader() {
  const token = await signAccessToken({
    sub: "user-1",
    email: "user@example.com",
    sid: "session-1",
    ver: 0,
  });
  return `Bearer ${token}`;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("adminAuditLogListQuerySchema", () => {
  it("기본값을 채우고 빈 필터를 비워둔다", () => {
    expect(adminAuditLogListQuerySchema.parse({})).toEqual({
      page: 1,
      limit: 20,
      adminId: undefined,
      action: undefined,
      targetType: undefined,
      from: undefined,
      to: undefined,
    });
  });

  it("기간을 Date로 바꾼다", () => {
    const query = adminAuditLogListQuerySchema.parse({
      from: "2026-09-01",
      to: "2026-09-30T23:59:59.000Z",
    });

    expect(query.from).toEqual(new Date("2026-09-01T00:00:00.000Z"));
    expect(query.to).toEqual(new Date("2026-09-30T23:59:59.000Z"));
  });

  it("액션 앞뒤 공백을 지운다", () => {
    expect(adminAuditLogListQuerySchema.parse({ action: "  user.  " }).action).toBe("user.");
  });

  it.each([
    { label: "어드민 ID", query: { adminId: "not-a-uuid" } },
    { label: "대상 타입", query: { targetType: "comment" } },
    { label: "기간", query: { from: "not-a-date" } },
    { label: "액션 길이", query: { action: "a".repeat(65) } },
  ])("잘못된 $label을 거부한다", ({ query }) => {
    expect(() => adminAuditLogListQuerySchema.parse(query)).toThrow();
  });

  /* 거꾸로 된 기간은 빈 목록만 돌려주므로, 조건을 잘못 넣었다는 사실을 알려준다. */
  it("시작일이 종료일보다 늦으면 거부한다", () => {
    expect(() =>
      adminAuditLogListQuerySchema.parse({ from: "2026-09-30", to: "2026-09-01" }),
    ).toThrow();
  });

  it("시작일과 종료일이 같은 하루는 허용한다", () => {
    expect(() =>
      adminAuditLogListQuerySchema.parse({ from: "2026-09-01", to: "2026-09-01" }),
    ).not.toThrow();
  });
});

describe("GET /admin/audit-logs", () => {
  const listResult = {
    auditLogs: [auditLog],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
  };

  it("어드민 정보를 포함한 목록을 반환한다", async () => {
    vi.mocked(adminAuditLogService.listAuditLogs).mockResolvedValue(listResult);

    const response = await request(appUrl())
      .get("/admin/audit-logs")
      .set("Authorization", await adminAuthHeader());

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      auditLogs: [serializedAuditLog],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });

  /* 조회는 감사 로그를 남기지 않는다 — 목록을 열 때마다 기록되면 로그가 자기 자신으로 찬다. */
  it("필터를 서비스에 전달하며 감사 로그를 남기지 않는다", async () => {
    vi.mocked(adminAuditLogService.listAuditLogs).mockResolvedValue({
      auditLogs: [],
      pagination: { page: 2, limit: 5, total: 0, totalPages: 0 },
    });

    const response = await request(appUrl())
      .get("/admin/audit-logs")
      .query({
        adminId,
        action: "user.",
        targetType: "user",
        from: "2026-09-01",
        to: "2026-09-30",
        page: 2,
        limit: 5,
      })
      .set("Authorization", await adminAuthHeader());

    expect(response.status).toBe(200);
    expect(adminAuditLogService.listAuditLogs).toHaveBeenCalledWith({
      adminId,
      action: "user.",
      targetType: "user",
      from: new Date("2026-09-01T00:00:00.000Z"),
      to: new Date("2026-09-30T00:00:00.000Z"),
      page: 2,
      limit: 5,
    });
    expect(adminAuditLogService.recordAuditLog).not.toHaveBeenCalled();
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("인증이 없으면 401이며 서비스를 호출하지 않는다", async () => {
    const response = await request(appUrl()).get("/admin/audit-logs");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
    expect(adminAuditLogService.listAuditLogs).not.toHaveBeenCalled();
  });

  it("제품 Access Token은 401이며 서비스를 호출하지 않는다", async () => {
    const response = await request(appUrl())
      .get("/admin/audit-logs")
      .set("Authorization", await productAuthHeader());

    expect(response.status).toBe(401);
    expect(adminAuditLogService.listAuditLogs).not.toHaveBeenCalled();
  });

  it.each([
    { label: "대상 타입", query: { targetType: "comment" } },
    { label: "어드민 ID", query: { adminId: "not-a-uuid" } },
    { label: "기간 순서", query: { from: "2026-09-30", to: "2026-09-01" } },
  ])("잘못된 $label은 400이며 서비스를 호출하지 않는다", async ({ query }) => {
    const response = await request(appUrl())
      .get("/admin/audit-logs")
      .query(query)
      .set("Authorization", await adminAuthHeader());

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(adminAuditLogService.listAuditLogs).not.toHaveBeenCalled();
  });
});
