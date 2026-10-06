import { beforeEach, describe, expect, it, vi } from "vitest";
import { valkey } from "@/cache/valkey";
import { db } from "@/db/client";
import { getSystemStatus } from "@/services/admin-system.service";

vi.mock("@/db/client", () => ({ db: { execute: vi.fn() } }));
vi.mock("@/cache/valkey", () => ({ valkey: { ping: vi.fn() } }));
vi.mock("@/utils/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const realtimeStats = {
  documentCount: 2,
  participantCount: 5,
  socketCount: 6,
};

beforeEach(() => {
  vi.mocked(db.execute)
    .mockReset()
    .mockResolvedValue([] as never);
  vi.mocked(valkey.ping).mockReset().mockResolvedValue("PONG");
});

describe("getSystemStatus", () => {
  it("캐시가 응답하지 않아도 제한 시간 안에 나머지 상태를 돌려준다", async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(valkey.ping).mockImplementation(() => new Promise(() => {}));

      const statusPromise = getSystemStatus({ realtimeStats: () => realtimeStats });
      await vi.advanceTimersByTimeAsync(3_000);
      const status = await statusPromise;

      expect(status.database.status).toBe("up");
      expect(status.cache.status).toBe("down");
      expect(status.realtime).toEqual(realtimeStats);
    } finally {
      vi.useRealTimers();
    }
  });

  it("의존성이 응답하면 up과 측정 시간을 반환한다", async () => {
    const status = await getSystemStatus({ realtimeStats: () => realtimeStats });

    expect(db.execute).toHaveBeenCalledTimes(1);
    expect(valkey.ping).toHaveBeenCalledTimes(1);
    expect(status.database.status).toBe("up");
    expect(status.cache.status).toBe("up");
    expect(status.database.latencyMs).toBeGreaterThanOrEqual(0);
    expect(status.cache.latencyMs).toBeGreaterThanOrEqual(0);
    expect(status.realtime).toEqual(realtimeStats);
    expect(status.checkedAt).toBeInstanceOf(Date);
  });

  /*
   * DATABASE_URL·VALKEY_URL에는 비밀번호가 들어 있고 드라이버 오류 메시지는 접속 문자열을
   * 그대로 붙여준다. 원문을 응답에 담지 않는다.
   */
  it("점검이 실패해도 원본 오류 메시지를 응답에 담지 않는다", async () => {
    vi.mocked(db.execute).mockRejectedValue(
      new Error("connect ECONNREFUSED postgres://admin:secret@localhost:5432"),
    );
    vi.mocked(valkey.ping).mockRejectedValue(
      new Error("Stream isn't writeable: redis://:secret@localhost:6379"),
    );

    const status = await getSystemStatus({ realtimeStats: () => realtimeStats });

    expect(status.database.status).toBe("down");
    expect(status.cache.status).toBe("down");
    expect(JSON.stringify(status)).not.toContain("secret");
  });

  it("한쪽이 실패해도 다른 쪽 점검 결과를 그대로 준다", async () => {
    vi.mocked(valkey.ping).mockRejectedValue(new Error("down"));

    const status = await getSystemStatus({ realtimeStats: () => realtimeStats });

    expect(status.database.status).toBe("up");
    expect(status.cache.status).toBe("down");
  });

  /* HTTP 서버만 띄운 테스트·헬스체크 환경에는 소켓 서버가 없다. */
  it("실시간 통계를 받을 수 없으면 realtime을 null로 둔다", async () => {
    const status = await getSystemStatus({});

    expect(status.realtime).toBeNull();
  });

  it("실시간 통계 조회가 실패하면 realtime을 null로 둔다", async () => {
    const status = await getSystemStatus({
      realtimeStats: () => {
        throw new Error("socket server not ready");
      },
    });

    expect(status.realtime).toBeNull();
    expect(status.database.status).toBe("up");
  });
});
