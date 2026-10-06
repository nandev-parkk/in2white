import type { Request, Response } from "express";
import type { WhiteboardRealtimeStats } from "@/realtime/whiteboard-room-manager";
import { getSystemStatus } from "@/services/admin-system.service";
import { requireAdmin } from "@/utils/require-admin";

/*
 * 실시간 통계는 소켓 서버가 가지고 있고, HTTP 앱은 소켓 서버보다 먼저 만들어진다. 그래서
 * 값이 아니라 호출 시점에 읽는 함수를 주입받는다 — 화이트보드 삭제 훅과 같은 방식이다.
 */
export interface SystemStatusHandlerDependencies {
  realtimeStats?: () => WhiteboardRealtimeStats;
}

export function createSystemStatusHandler(dependencies: SystemStatusHandlerDependencies = {}) {
  return async function getSystemStatusHandler(req: Request, res: Response) {
    requireAdmin(req);

    const status = await getSystemStatus({ realtimeStats: dependencies.realtimeStats });

    res.status(200).json(status);
  };
}
