import { describe, expect, it, vi } from "vitest";
import { clearRefreshTokenCookie, setRefreshTokenCookie } from "@/utils/auth-cookie";

describe("auth cookie utilities", () => {
  it("sets the refresh token with the shared secure cookie options", () => {
    const response = { cookie: vi.fn() };

    setRefreshTokenCookie(response as never, "refresh-token");

    expect(response.cookie).toHaveBeenCalledWith(
      "refreshToken",
      "refresh-token",
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
        path: "/auth/refresh",
        maxAge: 14 * 24 * 60 * 60 * 1000,
      }),
    );
  });

  it("clears the refresh token with the same path and security options", () => {
    const response = { clearCookie: vi.fn() };

    clearRefreshTokenCookie(response as never);

    expect(response.clearCookie).toHaveBeenCalledWith(
      "refreshToken",
      expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/auth/refresh" }),
    );
  });
});
