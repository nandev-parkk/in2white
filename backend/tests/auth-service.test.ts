import { describe, expect, it, vi, beforeEach } from "vitest";
import * as passwordLib from "@/lib/password";
import * as jwtLib from "@/lib/jwt";
import * as userService from "@/services/user.service";
import * as sessionService from "@/services/session.service";
import { login, logout, refresh } from "@/services/auth.service";

vi.mock("@/lib/password");
vi.mock("@/lib/jwt");
vi.mock("@/services/user.service");
vi.mock("@/services/session.service");

const mockUser = {
  id: "user-1",
  name: "Test User",
  email: "user@example.com",
  passwordHash: "hashed-value",
  sessionVersion: 0,
  createdAt: new Date(),
};

describe("auth.service login", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("throws INVALID_CREDENTIALS and runs the dummy compare when the account does not exist", async () => {
    vi.mocked(userService.getUserByEmail).mockResolvedValue(undefined);
    vi.mocked(passwordLib.compareDummyPassword).mockResolvedValue(undefined);

    await expect(login("missing@example.com", "any-password")).rejects.toMatchObject({
      status: 401,
      code: "INVALID_CREDENTIALS",
    });
    expect(passwordLib.compareDummyPassword).toHaveBeenCalledWith("any-password");
  });

  it("throws INVALID_CREDENTIALS when the password does not match", async () => {
    vi.mocked(userService.getUserByEmail).mockResolvedValue(mockUser);
    vi.mocked(passwordLib.comparePassword).mockResolvedValue(false);

    await expect(login("user@example.com", "wrong")).rejects.toMatchObject({
      status: 401,
      code: "INVALID_CREDENTIALS",
    });
  });

  it("issues tokens and saves a session on success", async () => {
    vi.mocked(userService.getUserByEmail).mockResolvedValue(mockUser);
    vi.mocked(passwordLib.comparePassword).mockResolvedValue(true);
    vi.mocked(jwtLib.signAccessToken).mockResolvedValue("access-token");
    vi.mocked(jwtLib.signRefreshToken).mockResolvedValue("refresh-token");
    vi.mocked(sessionService.saveRefreshSession).mockResolvedValue(undefined);

    const result = await login("user@example.com", "correct");

    expect(result.accessToken).toBe("access-token");
    expect(result.refreshToken).toBe("refresh-token");
    expect(result.user).toEqual({ id: "user-1", name: "Test User", email: "user@example.com" });
    expect(sessionService.saveRefreshSession).toHaveBeenCalledWith(
      "user-1",
      expect.any(String),
      "refresh-token",
    );
    expect(jwtLib.signAccessToken).toHaveBeenCalledWith({
      sub: "user-1",
      email: "user@example.com",
      sid: expect.any(String),
      ver: 0,
    });
    expect(jwtLib.signRefreshToken).toHaveBeenCalledWith({
      sub: "user-1",
      sid: expect.any(String),
      ver: 0,
    });
  });
});

describe("auth.service refresh", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("throws INVALID_REFRESH_TOKEN when verification fails", async () => {
    vi.mocked(jwtLib.verifyRefreshToken).mockRejectedValue(new Error("bad token"));

    await expect(refresh("bad-token")).rejects.toMatchObject({
      status: 401,
      code: "INVALID_REFRESH_TOKEN",
    });
  });

  it("throws INVALID_REFRESH_TOKEN when the user no longer exists", async () => {
    vi.mocked(jwtLib.verifyRefreshToken).mockResolvedValue({
      sub: "user-1",
      sid: "sid-1",
      ver: 0,
      type: "refresh",
    });
    vi.mocked(userService.getUserById).mockResolvedValue(undefined);

    await expect(refresh("some-token")).rejects.toMatchObject({
      status: 401,
      code: "INVALID_REFRESH_TOKEN",
    });
  });

  it("deletes the session and throws INVALID_REFRESH_TOKEN when rotation fails (stale/reused token)", async () => {
    vi.mocked(jwtLib.verifyRefreshToken).mockResolvedValue({
      sub: "user-1",
      sid: "sid-1",
      ver: 0,
      type: "refresh",
    });
    vi.mocked(userService.getUserById).mockResolvedValue(mockUser);
    vi.mocked(jwtLib.signAccessToken).mockResolvedValue("new-access-token");
    vi.mocked(jwtLib.signRefreshToken).mockResolvedValue("new-refresh-token");
    vi.mocked(sessionService.rotateRefreshSession).mockResolvedValue(false);
    vi.mocked(sessionService.deleteRefreshSession).mockResolvedValue(undefined);

    await expect(refresh("stale-token")).rejects.toMatchObject({
      status: 401,
      code: "INVALID_REFRESH_TOKEN",
    });
    expect(sessionService.deleteRefreshSession).toHaveBeenCalledWith("user-1", "sid-1");
  });

  it("rotates both tokens atomically on success", async () => {
    vi.mocked(jwtLib.verifyRefreshToken).mockResolvedValue({
      sub: "user-1",
      sid: "sid-1",
      ver: 0,
      type: "refresh",
    });
    vi.mocked(userService.getUserById).mockResolvedValue(mockUser);
    vi.mocked(jwtLib.signAccessToken).mockResolvedValue("new-access-token");
    vi.mocked(jwtLib.signRefreshToken).mockResolvedValue("new-refresh-token");
    vi.mocked(sessionService.rotateRefreshSession).mockResolvedValue(true);

    const result = await refresh("valid-refresh-token");

    expect(result).toEqual({
      accessToken: "new-access-token",
      refreshToken: "new-refresh-token",
      user: { id: "user-1", name: "Test User", email: "user@example.com" },
    });
    expect(sessionService.rotateRefreshSession).toHaveBeenCalledWith(
      "user-1",
      "sid-1",
      "valid-refresh-token",
      "new-refresh-token",
    );
    expect(sessionService.deleteRefreshSession).not.toHaveBeenCalled();
  });

  it("rejects a refresh token from an older session version", async () => {
    vi.mocked(jwtLib.verifyRefreshToken).mockResolvedValue({
      sub: "user-1",
      sid: "sid-old",
      ver: 2,
      type: "refresh",
    });
    vi.mocked(userService.getUserById).mockResolvedValue({ ...mockUser, sessionVersion: 3 });
    vi.mocked(sessionService.deleteRefreshSession).mockResolvedValue(undefined);

    await expect(refresh("old-generation-token")).rejects.toMatchObject({
      status: 401,
      code: "INVALID_REFRESH_TOKEN",
    });
    expect(sessionService.deleteRefreshSession).toHaveBeenCalledWith("user-1", "sid-old");
    expect(jwtLib.signAccessToken).not.toHaveBeenCalled();
    expect(sessionService.rotateRefreshSession).not.toHaveBeenCalled();
  });

  it("still returns INVALID_REFRESH_TOKEN when stale-session cleanup fails", async () => {
    vi.mocked(jwtLib.verifyRefreshToken).mockResolvedValue({
      sub: "user-1",
      sid: "sid-old",
      ver: 2,
      type: "refresh",
    });
    vi.mocked(userService.getUserById).mockResolvedValue({ ...mockUser, sessionVersion: 3 });
    vi.mocked(sessionService.deleteRefreshSession).mockRejectedValue(new Error("valkey down"));

    await expect(refresh("old-generation-token")).rejects.toMatchObject({
      status: 401,
      code: "INVALID_REFRESH_TOKEN",
    });
  });
});

describe("auth.service logout", () => {
  it("deletes the refresh session for the given user and session id", async () => {
    vi.mocked(sessionService.deleteRefreshSession).mockResolvedValue(undefined);

    await logout("user-1", "sid-1");

    expect(sessionService.deleteRefreshSession).toHaveBeenCalledWith("user-1", "sid-1");
  });
});
