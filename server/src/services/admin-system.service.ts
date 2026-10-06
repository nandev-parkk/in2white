import { sql } from "drizzle-orm";
import { valkey } from "@/cache/valkey";
import { db } from "@/db/client";
import type { WhiteboardRealtimeStats } from "@/realtime/whiteboard-room-manager";
import { logger } from "@/utils/logger";

/*
 * 운영 상태 화면은 "지금 무엇이 죽었는지"를 보여준다. 의존성이 죽어도 응답 자체는 200이어야
 * 한다 — 500으로 끊으면 어드민이 상태를 볼 수 없다.
 */

export type DependencyHealth = "up" | "down";
const PROBE_TIMEOUT_MS = 3_000;

export interface AdminDependencyStatus {
  status: DependencyHealth;
  latencyMs: number;
}

export interface AdminSystemStatus {
  checkedAt: Date;
  database: AdminDependencyStatus;
  cache: AdminDependencyStatus;
  /** 소켓 서버 없이 HTTP 앱만 띄운 구성에서는 알 수 없다. */
  realtime: WhiteboardRealtimeStats | null;
}

export interface GetSystemStatusOptions {
  realtimeStats?: () => WhiteboardRealtimeStats;
}

/*
 * 드라이버 오류 메시지에는 `DATABASE_URL`·`VALKEY_URL`의 접속 문자열이 그대로 들어 있다.
 * 비밀번호가 응답에 섞이지 않도록 원문은 서버 로그에만 남기고 상태와 응답 시간만 돌려준다.
 */
async function probe(name: string, check: () => Promise<unknown>): Promise<AdminDependencyStatus> {
  const startedAt = performance.now();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      check(),
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error("Health check timed out")), PROBE_TIMEOUT_MS);
      }),
    ]);
    return { status: "up", latencyMs: Math.round(performance.now() - startedAt) };
  } catch (err) {
    logger.warn({ err, dependency: name }, "Admin system status check failed");
    return { status: "down", latencyMs: Math.round(performance.now() - startedAt) };
  } finally {
    clearTimeout(timeout);
  }
}

export async function getSystemStatus({
  realtimeStats,
}: GetSystemStatusOptions): Promise<AdminSystemStatus> {
  const [database, cache] = await Promise.all([
    probe("database", () => db.execute(sql`select 1`)),
    probe("cache", () => valkey.ping()),
  ]);

  return {
    checkedAt: new Date(),
    database,
    cache,
    realtime: readRealtimeStats(realtimeStats),
  };
}

function readRealtimeStats(
  realtimeStats: GetSystemStatusOptions["realtimeStats"],
): WhiteboardRealtimeStats | null {
  if (!realtimeStats) return null;

  try {
    return realtimeStats();
  } catch (err) {
    /* 실시간 통계는 보조 정보다. 읽지 못해도 DB·캐시 상태는 보여준다. */
    logger.warn({ err }, "Whiteboard realtime stats unavailable");
    return null;
  }
}
