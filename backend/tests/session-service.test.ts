import { createHash } from "node:crypto";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { valkey } from "@/cache/valkey";
import {
  deleteRefreshSession,
  rotateRefreshSession,
  saveRefreshSession,
} from "@/services/session.service";

vi.mock("@/cache/valkey", () => ({
  valkey: {
    set: vi.fn(),
    get: vi.fn(),
    del: vi.fn(),
    eval: vi.fn(),
  },
}));

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

describe("session service", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.mocked(valkey.set).mockReset();
    vi.mocked(valkey.get).mockReset();
    vi.mocked(valkey.del).mockReset();
    vi.mocked(valkey.eval).mockReset();

    vi.mocked(valkey.set).mockImplementation((async (key: string, value: string) => {
      store.set(key, value);
      return "OK";
    }) as typeof valkey.set);

    vi.mocked(valkey.get).mockImplementation(
      (async (key: string) => store.get(key) ?? null) as typeof valkey.get,
    );

    vi.mocked(valkey.del).mockImplementation((async (key: string) => {
      const existed = store.delete(key);
      return existed ? 1 : 0;
    }) as typeof valkey.del);

    // 실제 Valkey Lua 엔진 없이 CAS 스크립트의 동작을 in-memory Map으로 재현한다.
    vi.mocked(valkey.eval).mockImplementation((async (
      _script: string,
      _numKeys: number,
      key: string,
      expectedHash: string,
      newHash: string,
    ) => {
      if (store.get(key) !== expectedHash) {
        return 0;
      }
      store.set(key, newHash);
      return 1;
    }) as typeof valkey.eval);
  });

  it("saves a hashed refresh token under refresh:{userId}:{sid} with a 2-week TTL", async () => {
    await saveRefreshSession("user-1", "sid-1", "refresh-token-value");

    expect(valkey.set).toHaveBeenCalledWith(
      "refresh:user-1:sid-1",
      sha256("refresh-token-value"),
      "EX",
      60 * 60 * 24 * 14,
    );
  });

  it("rotates when the presented token matches the currently stored hash", async () => {
    await saveRefreshSession("user-1", "sid-1", "old-refresh-token");

    const rotated = await rotateRefreshSession(
      "user-1",
      "sid-1",
      "old-refresh-token",
      "new-refresh-token",
    );

    expect(rotated).toBe(true);
    expect(store.get("refresh:user-1:sid-1")).toBe(sha256("new-refresh-token"));
    expect(valkey.eval).toHaveBeenCalledWith(
      expect.any(String),
      1,
      "refresh:user-1:sid-1",
      sha256("old-refresh-token"),
      sha256("new-refresh-token"),
      60 * 60 * 24 * 14,
    );
  });

  it("fails to rotate when the presented token no longer matches (already rotated/stale)", async () => {
    await saveRefreshSession("user-1", "sid-1", "old-refresh-token");
    await rotateRefreshSession("user-1", "sid-1", "old-refresh-token", "new-refresh-token");

    const staleRotation = await rotateRefreshSession(
      "user-1",
      "sid-1",
      "old-refresh-token",
      "yet-another-token",
    );

    expect(staleRotation).toBe(false);
    expect(store.get("refresh:user-1:sid-1")).toBe(sha256("new-refresh-token"));
  });

  it("fails to rotate when no session exists", async () => {
    const rotated = await rotateRefreshSession("user-1", "sid-1", "any-token", "new-refresh-token");

    expect(rotated).toBe(false);
  });

  it("keeps sessions for different sids independent", async () => {
    await saveRefreshSession("user-1", "sid-1", "device-a-token");
    await saveRefreshSession("user-1", "sid-2", "device-b-token");

    const rotatedA = await rotateRefreshSession(
      "user-1",
      "sid-1",
      "device-a-token",
      "device-a-token-2",
    );

    expect(rotatedA).toBe(true);
    expect(store.get("refresh:user-1:sid-2")).toBe(sha256("device-b-token"));
  });

  it("deletes a session by userId and sid", async () => {
    await saveRefreshSession("user-1", "sid-1", "refresh-token-value");

    await deleteRefreshSession("user-1", "sid-1");

    expect(valkey.del).toHaveBeenCalledWith("refresh:user-1:sid-1");
    expect(store.has("refresh:user-1:sid-1")).toBe(false);
  });
});
