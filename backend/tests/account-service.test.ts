import { describe, expect, it, vi, beforeEach } from "vitest";
import * as jwtLib from "@/lib/jwt";
import * as passwordLib from "@/lib/password";
import * as sessionService from "@/services/session.service";
import * as userService from "@/services/user.service";
import { logger } from "@/utils/logger";
import { changeAccountPassword, getAccount, updateAccount } from "@/services/account.service";

vi.mock("@/lib/jwt");
vi.mock("@/lib/password");
vi.mock("@/services/session.service");
vi.mock("@/services/user.service");
vi.mock("@/utils/logger", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const mockUser = {
  id: "user-1",
  name: "Test User",
  email: "user@example.com",
  passwordHash: "old-hash",
  sessionVersion: 3,
  createdAt: new Date(),
};

describe("account.service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(sessionService.saveRefreshSession).mockResolvedValue(undefined);
    vi.mocked(sessionService.deleteOtherRefreshSessions).mockResolvedValue(undefined);
  });

  it("returns only safe account fields", async () => {
    vi.mocked(userService.getUserById).mockResolvedValue(mockUser);

    await expect(getAccount("user-1")).resolves.toEqual({
      id: "user-1",
      name: "Test User",
      email: "user@example.com",
    });
  });

  it("throws ACCOUNT_NOT_FOUND when the account does not exist", async () => {
    vi.mocked(userService.getUserById).mockResolvedValue(undefined);

    await expect(getAccount("missing-user")).rejects.toMatchObject({
      status: 404,
      code: "ACCOUNT_NOT_FOUND",
    });
  });

  it("updates a name and returns safe account fields", async () => {
    vi.mocked(userService.updateUserName).mockResolvedValue({ ...mockUser, name: "새 이름" });

    await expect(updateAccount({ userId: "user-1", name: "새 이름" })).resolves.toEqual({
      id: "user-1",
      name: "새 이름",
      email: "user@example.com",
    });
    expect(userService.updateUserName).toHaveBeenCalledWith({ userId: "user-1", name: "새 이름" });
  });

  it("rejects a wrong current password without changing the account or sessions", async () => {
    vi.mocked(userService.getUserById).mockResolvedValue(mockUser);
    vi.mocked(passwordLib.comparePassword).mockResolvedValue(false);

    await expect(
      changeAccountPassword({
        userId: "user-1",
        currentPassword: "Wrong123!",
        newPassword: "New12345!",
      }),
    ).rejects.toMatchObject({ status: 400, code: "CURRENT_PASSWORD_MISMATCH" });

    expect(passwordLib.hashPassword).not.toHaveBeenCalled();
    expect(userService.updateUserPasswordAndIncrementSessionVersion).not.toHaveBeenCalled();
    expect(sessionService.saveRefreshSession).not.toHaveBeenCalled();
  });

  it("changes the password and rotates the current session with the new version", async () => {
    const updatedUser = { ...mockUser, passwordHash: "new-hash", sessionVersion: 4 };
    vi.mocked(userService.getUserById).mockResolvedValue(mockUser);
    vi.mocked(passwordLib.comparePassword).mockResolvedValue(true);
    vi.mocked(passwordLib.hashPassword).mockResolvedValue("new-hash");
    vi.mocked(userService.updateUserPasswordAndIncrementSessionVersion).mockResolvedValue(
      updatedUser,
    );
    vi.mocked(jwtLib.signAccessToken).mockResolvedValue("access-new");
    vi.mocked(jwtLib.signRefreshToken).mockResolvedValue("refresh-new");

    await expect(
      changeAccountPassword({
        userId: "user-1",
        currentPassword: "Old123!",
        newPassword: "New12345!",
      }),
    ).resolves.toEqual({
      accessToken: "access-new",
      refreshToken: "refresh-new",
      user: { id: "user-1", name: "Test User", email: "user@example.com" },
    });

    expect(userService.updateUserPasswordAndIncrementSessionVersion).toHaveBeenCalledWith({
      userId: "user-1",
      passwordHash: "new-hash",
    });
    expect(jwtLib.signAccessToken).toHaveBeenCalledWith({
      sub: "user-1",
      email: "user@example.com",
      sid: expect.any(String),
      ver: 4,
    });
    expect(jwtLib.signRefreshToken).toHaveBeenCalledWith({
      sub: "user-1",
      sid: expect.any(String),
      ver: 4,
    });
    expect(sessionService.saveRefreshSession).toHaveBeenCalledWith(
      "user-1",
      expect.any(String),
      "refresh-new",
    );
    expect(sessionService.deleteOtherRefreshSessions).toHaveBeenCalledWith(
      "user-1",
      expect.any(String),
    );
  });

  it("keeps the password change successful when old session cleanup fails", async () => {
    const updatedUser = { ...mockUser, passwordHash: "new-hash", sessionVersion: 4 };
    vi.mocked(userService.getUserById).mockResolvedValue(mockUser);
    vi.mocked(passwordLib.comparePassword).mockResolvedValue(true);
    vi.mocked(passwordLib.hashPassword).mockResolvedValue("new-hash");
    vi.mocked(userService.updateUserPasswordAndIncrementSessionVersion).mockResolvedValue(
      updatedUser,
    );
    vi.mocked(jwtLib.signAccessToken).mockResolvedValue("access-new");
    vi.mocked(jwtLib.signRefreshToken).mockResolvedValue("refresh-new");
    vi.mocked(sessionService.deleteOtherRefreshSessions).mockRejectedValue(
      new Error("cleanup failed"),
    );

    await expect(
      changeAccountPassword({
        userId: "user-1",
        currentPassword: "Old123!",
        newPassword: "New12345!",
      }),
    ).resolves.toMatchObject({ accessToken: "access-new", refreshToken: "refresh-new" });
    expect(logger.warn).toHaveBeenCalledWith(
      { err: expect.any(Error) },
      "Old refresh session cleanup failed after password change",
    );
  });

  it("requires reauthentication when the new session cannot be stored", async () => {
    const updatedUser = { ...mockUser, passwordHash: "new-hash", sessionVersion: 4 };
    vi.mocked(userService.getUserById).mockResolvedValue(mockUser);
    vi.mocked(passwordLib.comparePassword).mockResolvedValue(true);
    vi.mocked(passwordLib.hashPassword).mockResolvedValue("new-hash");
    vi.mocked(userService.updateUserPasswordAndIncrementSessionVersion).mockResolvedValue(
      updatedUser,
    );
    vi.mocked(jwtLib.signAccessToken).mockResolvedValue("access-new");
    vi.mocked(jwtLib.signRefreshToken).mockResolvedValue("refresh-new");
    vi.mocked(sessionService.saveRefreshSession).mockRejectedValue(new Error("valkey down"));

    await expect(
      changeAccountPassword({
        userId: "user-1",
        currentPassword: "Old123!",
        newPassword: "New12345!",
      }),
    ).rejects.toMatchObject({ status: 503, code: "PASSWORD_CHANGED_REAUTH_REQUIRED" });
    expect(logger.error).toHaveBeenCalledWith(
      { err: expect.any(Error) },
      "Current session transition failed after password change",
    );
    expect(sessionService.deleteOtherRefreshSessions).not.toHaveBeenCalled();
  });
});
