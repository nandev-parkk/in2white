import { count, gte, sql } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import { projects, users, whiteboardDocuments, workspaces } from "@/db/schema";

/*
 * 대시보드 첫 화면의 숫자만 만든다. 어드민이 매일 보는 화면이라 쿼리는 집계뿐이고
 * 개별 행은 읽지 않는다 — 상세는 각 목록 화면이 담당한다.
 */

const TREND_DAYS = 7;

export interface AdminDashboardTotals {
  users: { total: number; deactivated: number };
  workspaces: { total: number };
  projects: { total: number; deleted: number };
  whiteboardDocuments: { total: number; deleted: number };
}

export interface AdminDashboardTrendDay {
  /** UTC 기준 `YYYY-MM-DD`. */
  date: string;
  users: number;
  projects: number;
  whiteboardDocuments: number;
}

export interface AdminDashboardMetrics {
  totals: AdminDashboardTotals;
  trend: AdminDashboardTrendDay[];
}

interface TrendRow {
  date: string;
  total: number | string;
}

/*
 * 집계 함수는 드라이버에 따라 문자열로 내려온다. 화면에서 더하고 비교하는 값이라
 * 서비스 경계에서 숫자로 맞춘다.
 */
function toCount(value: unknown): number {
  return Number(value ?? 0);
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function toUtcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/* 서버 타임존에 따라 그래프의 날짜 경계가 달라지지 않도록 UTC로 자른다. */
function utcDayExpression(column: AnyPgColumn) {
  return sql<string>`to_char(date_trunc('day', ${column} at time zone 'UTC'), 'YYYY-MM-DD')`;
}

function trendDateKeys(now: Date): string[] {
  const firstDay = startOfUtcDay(now);
  firstDay.setUTCDate(firstDay.getUTCDate() - (TREND_DAYS - 1));
  return Array.from({ length: TREND_DAYS }, (_unused, offset) => {
    const day = new Date(firstDay);
    day.setUTCDate(day.getUTCDate() + offset);
    return toUtcDateKey(day);
  });
}

function countByDay(table: PgTable, createdAt: AnyPgColumn, since: Date) {
  const day = utcDayExpression(createdAt);
  return db
    .select({ date: day, total: count() })
    .from(table)
    .where(gte(createdAt, since))
    .groupBy(day);
}

function toCountsByDate(rows: TrendRow[]): Map<string, number> {
  return new Map(rows.map((row) => [row.date, toCount(row.total)]));
}

export async function getDashboardMetrics(now = new Date()): Promise<AdminDashboardMetrics> {
  const dateKeys = trendDateKeys(now);
  const since = new Date(`${dateKeys[0]}T00:00:00.000Z`);

  const [
    userTotals,
    workspaceTotals,
    projectTotals,
    documentTotals,
    userTrend,
    projectTrend,
    documentTrend,
  ] = await Promise.all([
    /* 정지·삭제 수는 `count(컬럼)`이 NULL을 세지 않는 성질로 한 번에 구한다. */
    db.select({ total: count(), deactivated: count(users.deactivatedAt) }).from(users),
    db.select({ total: count() }).from(workspaces),
    db.select({ total: count(), deleted: count(projects.deletedAt) }).from(projects),
    db
      .select({ total: count(), deleted: count(whiteboardDocuments.deletedAt) })
      .from(whiteboardDocuments),
    countByDay(users, users.createdAt, since),
    countByDay(projects, projects.createdAt, since),
    countByDay(whiteboardDocuments, whiteboardDocuments.createdAt, since),
  ]);

  const userCounts = toCountsByDate(userTrend as TrendRow[]);
  const projectCounts = toCountsByDate(projectTrend as TrendRow[]);
  const documentCounts = toCountsByDate(documentTrend as TrendRow[]);

  return {
    totals: {
      users: {
        total: toCount(userTotals[0]?.total),
        deactivated: toCount(userTotals[0]?.deactivated),
      },
      workspaces: { total: toCount(workspaceTotals[0]?.total) },
      projects: {
        total: toCount(projectTotals[0]?.total),
        deleted: toCount(projectTotals[0]?.deleted),
      },
      whiteboardDocuments: {
        total: toCount(documentTotals[0]?.total),
        deleted: toCount(documentTotals[0]?.deleted),
      },
    },
    /* 빈 날을 채워 둔다. 날짜를 건너뛰면 그래프가 실제보다 완만해 보인다. */
    trend: dateKeys.map((date) => ({
      date,
      users: userCounts.get(date) ?? 0,
      projects: projectCounts.get(date) ?? 0,
      whiteboardDocuments: documentCounts.get(date) ?? 0,
    })),
  };
}
