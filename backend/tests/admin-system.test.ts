import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "@/app";
import { useTestServer } from "./test-server";
import { db } from "@/db/client";
import { signAdminAccessToken } from "@/lib/admin-jwt";
import { signAccessToken } from "@/lib/jwt";
import { recordAuditLog } from "@/services/admin-audit-log.service";
import * as adminSystemService from "@/services/admin-system.service";

vi.mock("@/db/client", () => ({
  db: { select: vi.fn(), transaction: vi.fn() },
}));
vi.mock("@/services/admin-system.service");
vi.mock("@/services/admin-audit-log.service");

const realtimeStats = { documentCount: 2, participantCount: 5, socketCount: 6 };

const appUrl = useTestServer(() => createApp({ whiteboardRealtimeStats: () => realtimeStats }));
/* 소켓 서버 없이 HTTP 앱만 띄우는 구성도 돌아가야 한다 — 테스트와 헬스체크가 그렇게 쓴다. */
const appWithoutRealtimeUrl = useTestServer(() => createApp());

const checkedAt = new Date("2026-10-01T09:30:00.000Z");

const status = {
  checkedAt,
  database: { status: "up" as const, latencyMs: 3 },
  cache: { status: "up" as const, latencyMs: 1 },
  realtime: realtimeStats,
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

describe("GET /admin/system/status", () => {
  it("의존성 상태와 실시간 세션 수를 반환하며 감사 로그를 남기지 않는다", async () => {
    vi.mocked(adminSystemService.getSystemStatus).mockResolvedValue(status);

    const response = await request(appUrl())
      .get("/admin/system/status")
      .set("Authorization", await adminAuthHeader());

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ...status,
      checkedAt: checkedAt.toISOString(),
    });
    expect(recordAuditLog).not.toHaveBeenCalled();
    expect(db.transaction).not.toHaveBeenCalled();
  });

  /*
   * HTTP 앱이 소켓 서버보다 먼저 만들어지므로 실시간 통계는 호출 시점에 읽는 함수로 받는다.
   * 미리 읽어두면 서버가 뜬 직후의 0이 계속 남는다.
   */
  it("실시간 통계는 요청 시점에 읽는 함수로 서비스에 넘긴다", async () => {
    vi.mocked(adminSystemService.getSystemStatus).mockResolvedValue(status);

    await request(appUrl())
      .get("/admin/system/status")
      .set("Authorization", await adminAuthHeader());

    const [options] = vi.mocked(adminSystemService.getSystemStatus).mock.calls[0]!;
    expect(options.realtimeStats?.()).toEqual(realtimeStats);
  });

  it("실시간 통계를 주입하지 않으면 서비스도 받지 않는다", async () => {
    vi.mocked(adminSystemService.getSystemStatus).mockResolvedValue({
      ...status,
      realtime: null,
    });

    const response = await request(appWithoutRealtimeUrl())
      .get("/admin/system/status")
      .set("Authorization", await adminAuthHeader());

    expect(response.status).toBe(200);
    expect(response.body.realtime).toBeNull();
    const [options] = vi.mocked(adminSystemService.getSystemStatus).mock.calls[0]!;
    expect(options.realtimeStats).toBeUndefined();
  });

  /* 의존성이 죽어도 어드민은 상태를 봐야 한다 — 200으로 down을 알린다. */
  it("의존성이 죽어도 200으로 down 상태를 알린다", async () => {
    vi.mocked(adminSystemService.getSystemStatus).mockResolvedValue({
      ...status,
      database: { status: "down", latencyMs: 2000 },
      cache: { status: "down", latencyMs: 2000 },
    });

    const response = await request(appUrl())
      .get("/admin/system/status")
      .set("Authorization", await adminAuthHeader());

    expect(response.status).toBe(200);
    expect(response.body.database.status).toBe("down");
    expect(response.body.cache.status).toBe("down");
  });

  it("인증이 없으면 401이며 서비스를 호출하지 않는다", async () => {
    const response = await request(appUrl()).get("/admin/system/status");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
    expect(adminSystemService.getSystemStatus).not.toHaveBeenCalled();
  });

  it("제품 Access Token은 401이며 서비스를 호출하지 않는다", async () => {
    const response = await request(appUrl())
      .get("/admin/system/status")
      .set("Authorization", await productAuthHeader());

    expect(response.status).toBe(401);
    expect(adminSystemService.getSystemStatus).not.toHaveBeenCalled();
  });
});
