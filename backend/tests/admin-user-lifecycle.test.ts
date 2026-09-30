import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "@/app";
import { useTestServer } from "./test-server";
import { db } from "@/db/client";
import { signAdminAccessToken } from "@/lib/admin-jwt";
import { signAccessToken } from "@/lib/jwt";
import { comparePassword } from "@/lib/password";
import { resetUserPasswordSchema } from "@/schemas/admin-user.schema";
import { recordAuditLog } from "@/services/admin-audit-log.service";
import * as adminUserService from "@/services/admin-user.service";
import { deleteAllRefreshSessions } from "@/services/session.service";
import { HttpError } from "@/utils/http-error";

vi.mock("@/db/client", () => ({
  db: { select: vi.fn(), transaction: vi.fn() },
}));
vi.mock("@/services/admin-user.service");
vi.mock("@/services/admin-audit-log.service");
vi.mock("@/services/session.service");

const appUrl = useTestServer(() => createApp());

const transactionHandle = { handle: "tx" };

const userId = "550e8400-e29b-41d4-a716-446655440001";
const createdAt = new Date("2026-09-20T00:00:00.000Z");
const deactivatedAt = new Date("2026-09-30T00:00:00.000Z");

const activeUser = {
  id: userId,
  name: "Kim User",
  email: "user@example.com",
  deactivatedAt: null,
  createdAt,
};
const deactivatedUser = { ...activeUser, deactivatedAt };

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
  vi.mocked(db.transaction).mockImplementation(async (callback) =>
    callback(transactionHandle as never),
  );
});

describe("resetUserPasswordSchema", () => {
  it("제품과 같은 비밀번호 규칙을 적용한다", () => {
    expect(resetUserPasswordSchema.parse({ newPassword: "Password1!" })).toEqual({
      newPassword: "Password1!",
    });
    expect(() => resetUserPasswordSchema.parse({ newPassword: "weak" })).toThrow();
    expect(() =>
      resetUserPasswordSchema.parse({ newPassword: "Password1!", currentPassword: "Old1!aaa" }),
    ).toThrow();
  });
});

describe("POST /admin/users/:userId/password", () => {
  const body = { newPassword: "Password1!" };

  it("비밀번호를 재설정하고 평문 없이 감사 로그를 남긴 뒤 세션을 정리한다", async () => {
    vi.mocked(adminUserService.resetUserPassword).mockResolvedValue({
      previousUser: activeUser,
      user: activeUser,
    });

    const response = await request(appUrl())
      .post(`/admin/users/${userId}/password`)
      .set("Authorization", await adminAuthHeader())
      .send(body);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      user: { ...activeUser, createdAt: createdAt.toISOString() },
    });

    const [handle, input] = vi.mocked(adminUserService.resetUserPassword).mock.calls[0]!;
    expect(handle).toBe(transactionHandle);
    expect(input.userId).toBe(userId);
    await expect(comparePassword(body.newPassword, input.passwordHash)).resolves.toBe(true);

    expect(recordAuditLog).toHaveBeenCalledOnce();
    expect(recordAuditLog).toHaveBeenCalledWith(
      transactionHandle,
      expect.objectContaining({
        adminId: "admin-1",
        action: "user.password-reset",
        targetType: "user",
        targetId: userId,
        metadata: { passwordReset: true },
      }),
    );
    const [, entry] = vi.mocked(recordAuditLog).mock.calls[0]!;
    expect(JSON.stringify(entry)).not.toContain(body.newPassword);

    expect(deleteAllRefreshSessions).toHaveBeenCalledWith(userId);
  });

  /*
   * 세션 무효화의 실효는 `sessionVersion` 증가가 담당한다. 이미 커밋된 재설정을
   * 캐시 정리 실패로 500으로 뒤집으면 어드민이 성공한 변경을 실패로 읽는다.
   */
  it("세션 키 삭제가 실패해도 재설정 결과를 200으로 응답한다", async () => {
    vi.mocked(adminUserService.resetUserPassword).mockResolvedValue({
      previousUser: activeUser,
      user: activeUser,
    });
    vi.mocked(deleteAllRefreshSessions).mockRejectedValue(new Error("valkey unavailable"));

    const response = await request(appUrl())
      .post(`/admin/users/${userId}/password`)
      .set("Authorization", await adminAuthHeader())
      .send(body);

    expect(response.status).toBe(200);
  });

  it.each([
    { label: "인증 없음", header: undefined },
    { label: "제품 Access Token", header: "product" as const },
  ])("$label 요청은 401이며 트랜잭션을 열지 않는다", async ({ header }) => {
    const httpRequest = request(appUrl()).post(`/admin/users/${userId}/password`);
    if (header === "product") {
      httpRequest.set("Authorization", await productAuthHeader());
    }

    const response = await httpRequest.send(body);

    expect(response.status).toBe(401);
    expect(db.transaction).not.toHaveBeenCalled();
    expect(deleteAllRefreshSessions).not.toHaveBeenCalled();
  });

  it.each([
    { label: "약한 비밀번호", path: userId, payload: { newPassword: "weak" } },
    { label: "UUID가 아닌 userId", path: "not-a-uuid", payload: { newPassword: "Password1!" } },
  ])("$label 요청은 400이며 트랜잭션을 열지 않는다", async ({ path, payload }) => {
    const response = await request(appUrl())
      .post(`/admin/users/${path}/password`)
      .set("Authorization", await adminAuthHeader())
      .send(payload);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("없는 사용자는 404이며 감사 로그와 세션 정리를 하지 않는다", async () => {
    vi.mocked(adminUserService.resetUserPassword).mockRejectedValue(
      new HttpError(404, "USER_NOT_FOUND", "사용자를 찾을 수 없습니다"),
    );

    const response = await request(appUrl())
      .post(`/admin/users/${userId}/password`)
      .set("Authorization", await adminAuthHeader())
      .send(body);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("USER_NOT_FOUND");
    expect(recordAuditLog).not.toHaveBeenCalled();
    expect(deleteAllRefreshSessions).not.toHaveBeenCalled();
  });
});

describe("POST /admin/users/:userId/deactivate", () => {
  it("계정을 정지하고 감사 로그를 남긴 뒤 세션을 정리한다", async () => {
    vi.mocked(adminUserService.deactivateUser).mockResolvedValue({
      previousUser: activeUser,
      user: deactivatedUser,
    });

    const response = await request(appUrl())
      .post(`/admin/users/${userId}/deactivate`)
      .set("Authorization", await adminAuthHeader());

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      user: {
        ...deactivatedUser,
        createdAt: createdAt.toISOString(),
        deactivatedAt: deactivatedAt.toISOString(),
      },
    });
    expect(adminUserService.deactivateUser).toHaveBeenCalledWith(transactionHandle, userId);
    expect(recordAuditLog).toHaveBeenCalledWith(
      transactionHandle,
      expect.objectContaining({
        action: "user.deactivate",
        targetType: "user",
        targetId: userId,
        metadata: {
          before: { deactivatedAt: null },
          after: { deactivatedAt: deactivatedAt.toISOString() },
        },
      }),
    );
    expect(deleteAllRefreshSessions).toHaveBeenCalledWith(userId);
  });

  it.each([
    { label: "인증 없음", header: undefined },
    { label: "제품 Access Token", header: "product" as const },
  ])("$label 요청은 401이며 트랜잭션을 열지 않는다", async ({ header }) => {
    const httpRequest = request(appUrl()).post(`/admin/users/${userId}/deactivate`);
    if (header === "product") {
      httpRequest.set("Authorization", await productAuthHeader());
    }

    const response = await httpRequest.send();

    expect(response.status).toBe(401);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("UUID가 아닌 userId는 400이며 트랜잭션을 열지 않는다", async () => {
    const response = await request(appUrl())
      .post("/admin/users/not-a-uuid/deactivate")
      .set("Authorization", await adminAuthHeader());

    expect(response.status).toBe(400);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("없는 사용자는 404이며 감사 로그를 남기지 않는다", async () => {
    vi.mocked(adminUserService.deactivateUser).mockRejectedValue(
      new HttpError(404, "USER_NOT_FOUND", "사용자를 찾을 수 없습니다"),
    );

    const response = await request(appUrl())
      .post(`/admin/users/${userId}/deactivate`)
      .set("Authorization", await adminAuthHeader());

    expect(response.status).toBe(404);
    expect(recordAuditLog).not.toHaveBeenCalled();
    expect(deleteAllRefreshSessions).not.toHaveBeenCalled();
  });
});

describe("POST /admin/users/:userId/reactivate", () => {
  it("정지를 해제하고 감사 로그를 남기지만 세션은 건드리지 않는다", async () => {
    vi.mocked(adminUserService.reactivateUser).mockResolvedValue({
      previousUser: deactivatedUser,
      user: activeUser,
    });

    const response = await request(appUrl())
      .post(`/admin/users/${userId}/reactivate`)
      .set("Authorization", await adminAuthHeader());

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      user: { ...activeUser, createdAt: createdAt.toISOString() },
    });
    expect(recordAuditLog).toHaveBeenCalledWith(
      transactionHandle,
      expect.objectContaining({
        action: "user.reactivate",
        targetId: userId,
        metadata: {
          before: { deactivatedAt: deactivatedAt.toISOString() },
          after: { deactivatedAt: null },
        },
      }),
    );
    expect(deleteAllRefreshSessions).not.toHaveBeenCalled();
  });

  it.each([
    { label: "인증 없음", header: undefined },
    { label: "제품 Access Token", header: "product" as const },
  ])("$label 요청은 401이며 트랜잭션을 열지 않는다", async ({ header }) => {
    const httpRequest = request(appUrl()).post(`/admin/users/${userId}/reactivate`);
    if (header === "product") {
      httpRequest.set("Authorization", await productAuthHeader());
    }

    const response = await httpRequest.send();

    expect(response.status).toBe(401);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("없는 사용자는 404이며 감사 로그를 남기지 않는다", async () => {
    vi.mocked(adminUserService.reactivateUser).mockRejectedValue(
      new HttpError(404, "USER_NOT_FOUND", "사용자를 찾을 수 없습니다"),
    );

    const response = await request(appUrl())
      .post(`/admin/users/${userId}/reactivate`)
      .set("Authorization", await adminAuthHeader());

    expect(response.status).toBe(404);
    expect(recordAuditLog).not.toHaveBeenCalled();
  });
});

describe("POST /admin/users/:userId/sessions/revoke", () => {
  it("세션 버전을 올리고 저장된 세션 키를 지운다", async () => {
    vi.mocked(adminUserService.revokeUserSessions).mockResolvedValue({
      previousUser: activeUser,
      user: activeUser,
    });

    const response = await request(appUrl())
      .post(`/admin/users/${userId}/sessions/revoke`)
      .set("Authorization", await adminAuthHeader());

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      user: { ...activeUser, createdAt: createdAt.toISOString() },
    });
    expect(adminUserService.revokeUserSessions).toHaveBeenCalledWith(transactionHandle, userId);
    expect(recordAuditLog).toHaveBeenCalledWith(
      transactionHandle,
      expect.objectContaining({
        action: "user.sessions-revoke",
        targetType: "user",
        targetId: userId,
        metadata: { sessionsRevoked: true },
      }),
    );
    expect(deleteAllRefreshSessions).toHaveBeenCalledWith(userId);
  });

  it.each([
    { label: "인증 없음", header: undefined },
    { label: "제품 Access Token", header: "product" as const },
  ])("$label 요청은 401이며 트랜잭션을 열지 않는다", async ({ header }) => {
    const httpRequest = request(appUrl()).post(`/admin/users/${userId}/sessions/revoke`);
    if (header === "product") {
      httpRequest.set("Authorization", await productAuthHeader());
    }

    const response = await httpRequest.send();

    expect(response.status).toBe(401);
    expect(db.transaction).not.toHaveBeenCalled();
    expect(deleteAllRefreshSessions).not.toHaveBeenCalled();
  });

  it("없는 사용자는 404이며 세션 키를 지우지 않는다", async () => {
    vi.mocked(adminUserService.revokeUserSessions).mockRejectedValue(
      new HttpError(404, "USER_NOT_FOUND", "사용자를 찾을 수 없습니다"),
    );

    const response = await request(appUrl())
      .post(`/admin/users/${userId}/sessions/revoke`)
      .set("Authorization", await adminAuthHeader());

    expect(response.status).toBe(404);
    expect(deleteAllRefreshSessions).not.toHaveBeenCalled();
  });
});
