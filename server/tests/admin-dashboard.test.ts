import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "@/app";
import { useTestServer } from "./test-server";
import { db } from "@/db/client";
import { signAdminAccessToken } from "@/lib/admin-jwt";
import { signAccessToken } from "@/lib/jwt";
import { recordAuditLog } from "@/services/admin-audit-log.service";
import * as adminDashboardService from "@/services/admin-dashboard.service";

vi.mock("@/db/client", () => ({
  db: { select: vi.fn(), transaction: vi.fn() },
}));
vi.mock("@/services/admin-dashboard.service");
vi.mock("@/services/admin-audit-log.service");

const appUrl = useTestServer(() => createApp());

const metrics = {
  totals: {
    users: { total: 12, deactivated: 2 },
    workspaces: { total: 15 },
    projects: { total: 30, deleted: 3 },
    whiteboardDocuments: { total: 80, deleted: 5 },
  },
  trend: [
    { date: "2026-09-25", users: 1, projects: 0, whiteboardDocuments: 2 },
    { date: "2026-09-26", users: 0, projects: 0, whiteboardDocuments: 0 },
  ],
};

async function adminAuthHeader() {
  const token = await signAdminAccessToken({
    sub: "admin-1",
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

describe("GET /admin/dashboard/metrics", () => {
  it("총계와 추이를 반환하며 감사 로그를 남기지 않는다", async () => {
    vi.mocked(adminDashboardService.getDashboardMetrics).mockResolvedValue(metrics);

    const response = await request(appUrl())
      .get("/admin/dashboard/metrics")
      .set("Authorization", await adminAuthHeader());

    expect(response.status).toBe(200);
    expect(response.body).toEqual(metrics);
    expect(recordAuditLog).not.toHaveBeenCalled();
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("인증이 없으면 401이며 서비스를 호출하지 않는다", async () => {
    const response = await request(appUrl()).get("/admin/dashboard/metrics");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
    expect(adminDashboardService.getDashboardMetrics).not.toHaveBeenCalled();
  });

  it("제품 Access Token은 401이며 서비스를 호출하지 않는다", async () => {
    const response = await request(appUrl())
      .get("/admin/dashboard/metrics")
      .set("Authorization", await productAuthHeader());

    expect(response.status).toBe(401);
    expect(adminDashboardService.getDashboardMetrics).not.toHaveBeenCalled();
  });

  it("집계가 실패하면 500으로 응답한다", async () => {
    vi.mocked(adminDashboardService.getDashboardMetrics).mockRejectedValue(new Error("db down"));

    const response = await request(appUrl())
      .get("/admin/dashboard/metrics")
      .set("Authorization", await adminAuthHeader());

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("INTERNAL_SERVER_ERROR");
  });
});
