import type { Request, Response } from "express";
import { getDashboardMetrics } from "@/services/admin-dashboard.service";
import { requireAdmin } from "@/utils/require-admin";

/* 조회뿐이라 트랜잭션도 감사 로그도 없다 — 대시보드를 열 때마다 기록하면 로그가 조회로 찬다. */
export async function getDashboardMetricsHandler(req: Request, res: Response) {
  requireAdmin(req);

  const metrics = await getDashboardMetrics();

  res.status(200).json(metrics);
}
