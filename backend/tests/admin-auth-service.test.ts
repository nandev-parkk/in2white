import { beforeEach, describe, expect, it, vi } from "vitest";
import * as passwordLib from "@/lib/password";
import * as adminJwtLib from "@/lib/admin-jwt";
import * as adminAccountService from "@/services/admin-account.service";
import * as adminSessionService from "@/services/admin-session.service";
import { adminLogin, adminLogout, adminRefresh } from "@/services/admin-auth.service";

vi.mock("@/lib/password");
vi.mock("@/lib/admin-jwt");
vi.mock("@/services/admin-account.service");
vi.mock("@/services/admin-session.service");

const mockAdmin = {
  id: "admin-1",
  name: "Admin",
  email: "admin@example.com",
  passwordHash: "hashed-value",
  sessionVersion: 0,
  lastLoginAt: null,
  createdAt: new Date(),
};

describe("admin-auth.service adminLogin", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  /*
   * 계정이 없을 때도 bcrypt compare를 한 번 돌린다. 그렇지 않으면 응답 시간 차이로
   * 어느 이메일이 어드민 계정인지 외부에서 가려낼 수 있다.
   */
  it("throws INVALID_CREDENTIALS and runs the dummy compare when the admin does not exist", async () => {
    vi.mocked(adminAccountService.getAdminByEmail).mockResolvedValue(undefined);
    vi.mocked(passwordLib.compareDummyPassword).mockResolvedValue(undefined);

    await expect(adminLogin("missing@example.com", "any-password")).rejects.toMatchObject({
      status: 401,
      code: "INVALID_CREDENTIALS",
    });
    expect(passwordLib.compareDummyPassword).toHaveBeenCalledWith("any-password");
  });

  it("throws INVALID_CREDENTIALS when the password does not match", async () => {
    vi.mocked(adminAccountService.getAdminByEmail).mockResolvedValue(mockAdmin);
    vi.mocked(passwordLib.comparePassword).mockResolvedValue(false);

    await expect(adminLogin("admin@example.com", "wrong")).rejects.toMatchObject({
      status: 401,
      code: "INVALID_CREDENTIALS",
    });
    expect(adminJwtLib.signAdminAccessToken).not.toHaveBeenCalled();
  });

  it("issues admin tokens, saves a session, and records the login time", async () => {
    vi.mocked(adminAccountService.getAdminByEmail).mockResolvedValue(mockAdmin);
    vi.mocked(passwordLib.comparePassword).mockResolvedValue(true);
    vi.mocked(adminJwtLib.signAdminAccessToken).mockResolvedValue("admin-access-token");
    vi.mocked(adminJwtLib.signAdminRefreshToken).mockResolvedValue("admin-refresh-token");
    vi.mocked(adminSessionService.saveAdminRefreshSession).mockResolvedValue(undefined);
    vi.mocked(adminAccountService.touchAdminLastLoginAt).mockResolvedValue(undefined);

    const result = await adminLogin("admin@example.com", "correct");

    expect(result.accessToken).toBe("admin-access-token");
    expect(result.refreshToken).toBe("admin-refresh-token");
    expect(result.admin).toEqual({ id: "admin-1", name: "Admin", email: "admin@example.com" });
    expect(adminSessionService.saveAdminRefreshSession).toHaveBeenCalledWith(
      "admin-1",
      expect.any(String),
      "admin-refresh-token",
    );
    expect(adminJwtLib.signAdminAccessToken).toHaveBeenCalledWith({
      sub: "admin-1",
      email: "admin@example.com",
      sid: expect.any(String),
      ver: 0,
    });
    expect(adminAccountService.touchAdminLastLoginAt).toHaveBeenCalledWith(
      "admin-1",
      expect.any(Date),
    );
  });

  /* 마지막 로그인 시각은 부가 정보다. 그 기록이 실패해도 로그인 자체를 막지 않는다. */
  it("still logs in when recording the login time fails", async () => {
    vi.mocked(adminAccountService.getAdminByEmail).mockResolvedValue(mockAdmin);
    vi.mocked(passwordLib.comparePassword).mockResolvedValue(true);
    vi.mocked(adminJwtLib.signAdminAccessToken).mockResolvedValue("admin-access-token");
    vi.mocked(adminJwtLib.signAdminRefreshToken).mockResolvedValue("admin-refresh-token");
    vi.mocked(adminSessionService.saveAdminRefreshSession).mockResolvedValue(undefined);
    vi.mocked(adminAccountService.touchAdminLastLoginAt).mockRejectedValue(new Error("db down"));

    await expect(adminLogin("admin@example.com", "correct")).resolves.toMatchObject({
      accessToken: "admin-access-token",
    });
  });
});

describe("admin-auth.service adminRefresh", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("throws INVALID_REFRESH_TOKEN when verification fails", async () => {
    vi.mocked(adminJwtLib.verifyAdminRefreshToken).mockRejectedValue(new Error("bad token"));

    await expect(adminRefresh("bad-token")).rejects.toMatchObject({
      status: 401,
      code: "INVALID_REFRESH_TOKEN",
    });
  });

  it("throws INVALID_REFRESH_TOKEN when the admin no longer exists", async () => {
    vi.mocked(adminJwtLib.verifyAdminRefreshToken).mockResolvedValue({
      sub: "admin-1",
      sid: "sid-1",
      ver: 0,
      type: "admin-refresh",
      exp: 0,
    });
    vi.mocked(adminAccountService.getAdminById).mockResolvedValue(undefined);

    await expect(adminRefresh("some-token")).rejects.toMatchObject({
      status: 401,
      code: "INVALID_REFRESH_TOKEN",
    });
  });

  /* `sessionVersion` 증가는 전체 세션 무효화 수단이다. 옛 세대 토큰은 세션까지 지운다. */
  it("rejects a refresh token from an older session version and discards that session", async () => {
    vi.mocked(adminJwtLib.verifyAdminRefreshToken).mockResolvedValue({
      sub: "admin-1",
      sid: "sid-old",
      ver: 2,
      type: "admin-refresh",
      exp: 0,
    });
    vi.mocked(adminAccountService.getAdminById).mockResolvedValue({
      ...mockAdmin,
      sessionVersion: 3,
    });
    vi.mocked(adminSessionService.deleteAdminRefreshSession).mockResolvedValue(undefined);

    await expect(adminRefresh("old-generation-token")).rejects.toMatchObject({
      status: 401,
      code: "INVALID_REFRESH_TOKEN",
    });
    expect(adminSessionService.deleteAdminRefreshSession).toHaveBeenCalledWith(
      "admin-1",
      "sid-old",
    );
    expect(adminJwtLib.signAdminAccessToken).not.toHaveBeenCalled();
    expect(adminSessionService.rotateAdminRefreshSession).not.toHaveBeenCalled();
  });

  it("still returns INVALID_REFRESH_TOKEN when stale-session cleanup fails", async () => {
    vi.mocked(adminJwtLib.verifyAdminRefreshToken).mockResolvedValue({
      sub: "admin-1",
      sid: "sid-old",
      ver: 2,
      type: "admin-refresh",
      exp: 0,
    });
    vi.mocked(adminAccountService.getAdminById).mockResolvedValue({
      ...mockAdmin,
      sessionVersion: 3,
    });
    vi.mocked(adminSessionService.deleteAdminRefreshSession).mockRejectedValue(
      new Error("valkey down"),
    );

    await expect(adminRefresh("old-generation-token")).rejects.toMatchObject({
      status: 401,
      code: "INVALID_REFRESH_TOKEN",
    });
  });

  /*
   * 회전에 실패한 토큰은 이미 회전됐거나 존재하지 않는 세션의 것이다. 재사용(탈취)
   * 신호로 보고 해당 sid를 완전히 폐기한다.
   */
  it("discards the session and throws when rotation fails (stale or reused token)", async () => {
    vi.mocked(adminJwtLib.verifyAdminRefreshToken).mockResolvedValue({
      sub: "admin-1",
      sid: "sid-1",
      ver: 0,
      type: "admin-refresh",
      exp: 0,
    });
    vi.mocked(adminAccountService.getAdminById).mockResolvedValue(mockAdmin);
    vi.mocked(adminJwtLib.signAdminAccessToken).mockResolvedValue("new-access-token");
    vi.mocked(adminJwtLib.signAdminRefreshToken).mockResolvedValue("new-refresh-token");
    vi.mocked(adminSessionService.rotateAdminRefreshSession).mockResolvedValue(false);
    vi.mocked(adminSessionService.deleteAdminRefreshSession).mockResolvedValue(undefined);

    await expect(adminRefresh("stale-token")).rejects.toMatchObject({
      status: 401,
      code: "INVALID_REFRESH_TOKEN",
    });
    expect(adminSessionService.deleteAdminRefreshSession).toHaveBeenCalledWith("admin-1", "sid-1");
  });

  it("rotates both tokens on success", async () => {
    vi.mocked(adminJwtLib.verifyAdminRefreshToken).mockResolvedValue({
      sub: "admin-1",
      sid: "sid-1",
      ver: 0,
      type: "admin-refresh",
      exp: 0,
    });
    vi.mocked(adminAccountService.getAdminById).mockResolvedValue(mockAdmin);
    vi.mocked(adminJwtLib.signAdminAccessToken).mockResolvedValue("new-access-token");
    vi.mocked(adminJwtLib.signAdminRefreshToken).mockResolvedValue("new-refresh-token");
    vi.mocked(adminSessionService.rotateAdminRefreshSession).mockResolvedValue(true);

    const result = await adminRefresh("valid-refresh-token");

    expect(result).toEqual({
      accessToken: "new-access-token",
      refreshToken: "new-refresh-token",
      admin: { id: "admin-1", name: "Admin", email: "admin@example.com" },
    });
    expect(adminSessionService.rotateAdminRefreshSession).toHaveBeenCalledWith(
      "admin-1",
      "sid-1",
      "valid-refresh-token",
      "new-refresh-token",
    );
    expect(adminSessionService.deleteAdminRefreshSession).not.toHaveBeenCalled();
  });
});

describe("admin-auth.service adminLogout", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("deletes the admin refresh session for the given admin and session id", async () => {
    vi.mocked(adminSessionService.deleteAdminRefreshSession).mockResolvedValue(undefined);

    await adminLogout("admin-1", "sid-1");

    expect(adminSessionService.deleteAdminRefreshSession).toHaveBeenCalledWith("admin-1", "sid-1");
  });
});
