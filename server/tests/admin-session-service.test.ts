import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { valkey } from "@/cache/valkey";
import {
  deleteAdminRefreshSession,
  deleteOtherAdminRefreshSessions,
  rotateAdminRefreshSession,
  saveAdminRefreshSession,
} from "@/services/admin-session.service";

vi.mock("@/cache/valkey", () => ({
  valkey: {
    set: vi.fn(),
    get: vi.fn(),
    del: vi.fn(),
    eval: vi.fn(),
    scan: vi.fn(),
  },
}));

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

const ONE_DAY_SECONDS = 60 * 60 * 24;

describe("admin session service", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.mocked(valkey.set).mockReset();
    vi.mocked(valkey.get).mockReset();
    vi.mocked(valkey.del).mockReset();
    vi.mocked(valkey.eval).mockReset();
    vi.mocked(valkey.scan).mockReset();

    vi.mocked(valkey.set).mockImplementation((async (key: string, value: string) => {
      store.set(key, value);
      return "OK";
    }) as typeof valkey.set);

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

  /*
   * 어드민 세션은 제품 세션과 키 공간을 나눈다. 같은 `refresh:` 접두사를 쓰면 제품의
   * `deleteOtherRefreshSessions`가 도는 `refresh:{id}:*` 스캔에 어드민 세션이 걸릴 수
   * 있고, 반대로 어드민 쪽 정리가 제품 세션을 지울 수 있다.
   */
  it("saves a hashed refresh token under admin-refresh:{adminId}:{sid} with a 1-day TTL", async () => {
    await saveAdminRefreshSession("admin-1", "sid-1", "refresh-token-value");

    expect(valkey.set).toHaveBeenCalledWith(
      "admin-refresh:admin-1:sid-1",
      sha256("refresh-token-value"),
      "EX",
      ONE_DAY_SECONDS,
    );
  });

  it("does not collide with the product refresh key space", async () => {
    await saveAdminRefreshSession("admin-1", "sid-1", "refresh-token-value");

    const [key] = [...store.keys()];
    expect(key.startsWith("admin-refresh:")).toBe(true);
    expect(key.startsWith("refresh:")).toBe(false);
  });

  it("stores the token hash, never the token itself", async () => {
    await saveAdminRefreshSession("admin-1", "sid-1", "refresh-token-value");

    expect([...store.values()]).not.toContain("refresh-token-value");
  });

  it("rotates when the presented token matches the currently stored hash", async () => {
    await saveAdminRefreshSession("admin-1", "sid-1", "old-refresh-token");

    const rotated = await rotateAdminRefreshSession(
      "admin-1",
      "sid-1",
      "old-refresh-token",
      "new-refresh-token",
    );

    expect(rotated).toBe(true);
    expect(store.get("admin-refresh:admin-1:sid-1")).toBe(sha256("new-refresh-token"));
    expect(valkey.eval).toHaveBeenCalledWith(
      expect.any(String),
      1,
      "admin-refresh:admin-1:sid-1",
      sha256("old-refresh-token"),
      sha256("new-refresh-token"),
      ONE_DAY_SECONDS,
    );
  });

  it("refuses to rotate a token that was already rotated away", async () => {
    await saveAdminRefreshSession("admin-1", "sid-1", "old-refresh-token");
    await rotateAdminRefreshSession("admin-1", "sid-1", "old-refresh-token", "new-refresh-token");

    const staleRotation = await rotateAdminRefreshSession(
      "admin-1",
      "sid-1",
      "old-refresh-token",
      "yet-another-token",
    );

    expect(staleRotation).toBe(false);
    expect(store.get("admin-refresh:admin-1:sid-1")).toBe(sha256("new-refresh-token"));
  });

  it("refuses to rotate when no session exists", async () => {
    const rotated = await rotateAdminRefreshSession(
      "admin-1",
      "sid-1",
      "any-token",
      "new-refresh-token",
    );

    expect(rotated).toBe(false);
  });

  it("keeps sessions for different sids independent", async () => {
    await saveAdminRefreshSession("admin-1", "sid-1", "device-a-token");
    await saveAdminRefreshSession("admin-1", "sid-2", "device-b-token");

    const rotatedA = await rotateAdminRefreshSession(
      "admin-1",
      "sid-1",
      "device-a-token",
      "device-a-token-2",
    );

    expect(rotatedA).toBe(true);
    expect(store.get("admin-refresh:admin-1:sid-2")).toBe(sha256("device-b-token"));
  });

  it("deletes a session by adminId and sid", async () => {
    await saveAdminRefreshSession("admin-1", "sid-1", "refresh-token-value");

    await deleteAdminRefreshSession("admin-1", "sid-1");

    expect(valkey.del).toHaveBeenCalledWith("admin-refresh:admin-1:sid-1");
    expect(store.has("admin-refresh:admin-1:sid-1")).toBe(false);
  });

  it("deletes other sessions across scan batches while keeping the new sid", async () => {
    vi.mocked(valkey.scan)
      .mockResolvedValueOnce(["7", ["admin-refresh:admin-1:old-a", "admin-refresh:admin-1:keep"]])
      .mockResolvedValueOnce(["0", ["admin-refresh:admin-1:old-b"]]);

    await deleteOtherAdminRefreshSessions("admin-1", "keep");

    expect(valkey.scan).toHaveBeenNthCalledWith(
      1,
      "0",
      "MATCH",
      "admin-refresh:admin-1:*",
      "COUNT",
      100,
    );
    expect(valkey.del).toHaveBeenCalledWith("admin-refresh:admin-1:old-a");
    expect(valkey.del).toHaveBeenCalledWith("admin-refresh:admin-1:old-b");
    expect(valkey.del).not.toHaveBeenCalledWith("admin-refresh:admin-1:keep");
  });

  it("does not call delete when the scan finds no stale keys", async () => {
    vi.mocked(valkey.scan).mockResolvedValueOnce(["0", ["admin-refresh:admin-1:keep"]]);

    await deleteOtherAdminRefreshSessions("admin-1", "keep");

    expect(valkey.del).not.toHaveBeenCalled();
  });
});
