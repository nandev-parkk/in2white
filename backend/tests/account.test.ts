import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { accountRouter } from "@/routes/account.routes";
import { errorHandlerMiddleware } from "@/middlewares/error-handler.middleware";
import { signAccessToken } from "@/lib/jwt";
import * as accountService from "@/services/account.service";
import { HttpError } from "@/utils/http-error";

vi.mock("@/services/account.service");

const accountUser = { id: "user-1", name: "Test User", email: "user@example.com" };

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/account", accountRouter);
  app.use(errorHandlerMiddleware);
  return app;
}

async function authHeader() {
  const token = await signAccessToken({
    sub: "user-1",
    email: "user@example.com",
    sid: "sid-current",
    ver: 0,
  });
  return `Bearer ${token}`;
}

describe("account API", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 401 for account requests without authentication", async () => {
    const response = await request(buildTestApp()).get("/account");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns safe account data", async () => {
    vi.mocked(accountService.getAccount).mockResolvedValue(accountUser);

    const response = await request(buildTestApp())
      .get("/account")
      .set("Authorization", await authHeader());

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ user: accountUser });
    expect(JSON.stringify(response.body)).not.toContain("passwordHash");
    expect(JSON.stringify(response.body)).not.toContain("sessionVersion");
  });

  it("trims the name before calling the account service", async () => {
    vi.mocked(accountService.updateAccount).mockResolvedValue({ ...accountUser, name: "새 이름" });

    const response = await request(buildTestApp())
      .patch("/account")
      .set("Authorization", await authHeader())
      .send({ name: "  새 이름  " });

    expect(response.status).toBe(200);
    expect(accountService.updateAccount).toHaveBeenCalledWith({
      userId: "user-1",
      name: "새 이름",
    });
  });

  it("rejects an invalid account name without calling the service", async () => {
    const response = await request(buildTestApp())
      .patch("/account")
      .set("Authorization", await authHeader())
      .send({ name: "   " });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(accountService.updateAccount).not.toHaveBeenCalled();
  });

  it("returns a new access token and refresh cookie after changing the password", async () => {
    vi.mocked(accountService.changeAccountPassword).mockResolvedValue({
      accessToken: "access-new",
      refreshToken: "refresh-new",
      user: accountUser,
    });

    const response = await request(buildTestApp())
      .patch("/account/password")
      .set("Authorization", await authHeader())
      .send({ currentPassword: "Old123!", newPassword: "New12345!" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ accessToken: "access-new", user: accountUser });
    expect(response.body.refreshToken).toBeUndefined();
    expect(response.headers["set-cookie"]).toEqual(
      expect.arrayContaining([expect.stringMatching(/refreshToken=.*HttpOnly/i)]),
    );
    expect(response.headers["set-cookie"]).toEqual(
      expect.arrayContaining([expect.stringMatching(/Path=\/auth\/refresh/i)]),
    );
  });

  it("returns the current password mismatch without clearing the refresh cookie", async () => {
    vi.mocked(accountService.changeAccountPassword).mockRejectedValue(
      new HttpError(400, "CURRENT_PASSWORD_MISMATCH", "현재 비밀번호가 올바르지 않습니다"),
    );

    const response = await request(buildTestApp())
      .patch("/account/password")
      .set("Authorization", await authHeader())
      .send({ currentPassword: "Wrong123!", newPassword: "New12345!" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("CURRENT_PASSWORD_MISMATCH");
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it("clears the refresh cookie when the new session cannot be created", async () => {
    vi.mocked(accountService.changeAccountPassword).mockRejectedValue(
      new HttpError(
        503,
        "PASSWORD_CHANGED_REAUTH_REQUIRED",
        "비밀번호는 변경되었지만 로그인 갱신에 실패했습니다. 다시 로그인해주세요",
      ),
    );

    const response = await request(buildTestApp())
      .patch("/account/password")
      .set("Authorization", await authHeader())
      .send({ currentPassword: "Old123!", newPassword: "New12345!" });

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe("PASSWORD_CHANGED_REAUTH_REQUIRED");
    expect(response.headers["set-cookie"]).toEqual(
      expect.arrayContaining([expect.stringMatching(/refreshToken=;/i)]),
    );
  });
});
