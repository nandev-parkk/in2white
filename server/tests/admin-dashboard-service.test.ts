import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import { getDashboardMetrics } from "@/services/admin-dashboard.service";

vi.mock("@/db/client", () => ({ db: { select: vi.fn() } }));

/*
 * 집계 쿼리는 체이닝 끝에서 await된다. 다른 어드민 서비스 테스트와 같은 스텁을 쓰고,
 * 서비스가 실제로 호출한 체인만 통과하게 둔다.
 */
function queryStub(methods: string[], rows: unknown[]) {
  const stub: Record<string, unknown> = {};
  methods.forEach((method, index) => {
    stub[method] =
      index < methods.length - 1 ? vi.fn().mockReturnValue(stub) : vi.fn().mockResolvedValue(rows);
  });
  return stub;
}

const TOTAL_CHAIN = ["from"];
const TREND_CHAIN = ["from", "where", "groupBy"];

/*
 * 서비스는 총계 4개와 추이 3개를 정해진 순서로 조회한다. 순서를 테스트에 적어두면
 * 쿼리를 더하거나 뺄 때 이 목록이 먼저 깨진다.
 */
function mockMetricQueries({
  userTotals,
  workspaceTotals,
  projectTotals,
  documentTotals,
  userTrend,
  projectTrend,
  documentTrend,
}: {
  userTotals: unknown[];
  workspaceTotals: unknown[];
  projectTotals: unknown[];
  documentTotals: unknown[];
  userTrend: unknown[];
  projectTrend: unknown[];
  documentTrend: unknown[];
}) {
  const mock = vi.mocked(db.select);
  [userTotals, workspaceTotals, projectTotals, documentTotals].forEach((rows) => {
    mock.mockReturnValueOnce(queryStub(TOTAL_CHAIN, rows) as never);
  });
  [userTrend, projectTrend, documentTrend].forEach((rows) => {
    mock.mockReturnValueOnce(queryStub(TREND_CHAIN, rows) as never);
  });
}

const now = new Date("2026-10-01T09:30:00.000Z");

beforeEach(() => {
  vi.mocked(db.select).mockReset();
});

describe("getDashboardMetrics", () => {
  it("총계와 비활성·삭제 수를 함께 반환한다", async () => {
    mockMetricQueries({
      userTotals: [{ total: 12, deactivated: 2 }],
      workspaceTotals: [{ total: 15 }],
      projectTotals: [{ total: 30, deleted: 3 }],
      documentTotals: [{ total: 80, deleted: 5 }],
      userTrend: [],
      projectTrend: [],
      documentTrend: [],
    });

    const metrics = await getDashboardMetrics(now);

    expect(metrics.totals).toEqual({
      users: { total: 12, deactivated: 2 },
      workspaces: { total: 15 },
      projects: { total: 30, deleted: 3 },
      whiteboardDocuments: { total: 80, deleted: 5 },
    });
  });

  /* 집계 함수는 드라이버에 따라 문자열로 내려온다. 화면에서 더하거나 비교하므로 숫자로 고친다. */
  it("문자열로 내려온 집계 값을 숫자로 바꾼다", async () => {
    mockMetricQueries({
      userTotals: [{ total: "12", deactivated: "2" }],
      workspaceTotals: [{ total: "15" }],
      projectTotals: [{ total: "30", deleted: "3" }],
      documentTotals: [{ total: "80", deleted: "5" }],
      userTrend: [{ date: "2026-10-01", total: "4" }],
      projectTrend: [],
      documentTrend: [],
    });

    const metrics = await getDashboardMetrics(now);

    expect(metrics.totals.users).toEqual({ total: 12, deactivated: 2 });
    expect(metrics.trend.at(-1)).toEqual({
      date: "2026-10-01",
      users: 4,
      projects: 0,
      whiteboardDocuments: 0,
    });
  });

  /* 빈 날이 빠지면 그래프가 날짜를 건너뛰어 추이가 실제보다 완만해 보인다. */
  it("최근 7일을 오름차순으로 빠짐없이 채운다", async () => {
    mockMetricQueries({
      userTotals: [{ total: 0, deactivated: 0 }],
      workspaceTotals: [{ total: 0 }],
      projectTotals: [{ total: 0, deleted: 0 }],
      documentTotals: [{ total: 0, deleted: 0 }],
      userTrend: [{ date: "2026-09-28", total: 2 }],
      projectTrend: [{ date: "2026-09-25", total: 1 }],
      documentTrend: [{ date: "2026-10-01", total: 7 }],
    });

    const metrics = await getDashboardMetrics(now);

    expect(metrics.trend.map((day) => day.date)).toEqual([
      "2026-09-25",
      "2026-09-26",
      "2026-09-27",
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
    ]);
    expect(metrics.trend[0]).toEqual({
      date: "2026-09-25",
      users: 0,
      projects: 1,
      whiteboardDocuments: 0,
    });
    expect(metrics.trend[3]).toEqual({
      date: "2026-09-28",
      users: 2,
      projects: 0,
      whiteboardDocuments: 0,
    });
  });

  /* 조회 범위를 벗어난 날짜가 섞여 들어오면 7일 배열이 길어지거나 어긋난다. */
  it("조회 범위 밖의 날짜는 버린다", async () => {
    mockMetricQueries({
      userTotals: [{ total: 0, deactivated: 0 }],
      workspaceTotals: [{ total: 0 }],
      projectTotals: [{ total: 0, deleted: 0 }],
      documentTotals: [{ total: 0, deleted: 0 }],
      userTrend: [
        { date: "2026-09-24", total: 9 },
        { date: "2026-09-26", total: 1 },
      ],
      projectTrend: [],
      documentTrend: [],
    });

    const metrics = await getDashboardMetrics(now);

    expect(metrics.trend).toHaveLength(7);
    expect(metrics.trend.map((day) => day.users)).toEqual([0, 1, 0, 0, 0, 0, 0]);
  });

  it("행이 없으면 총계를 0으로 둔다", async () => {
    mockMetricQueries({
      userTotals: [],
      workspaceTotals: [],
      projectTotals: [],
      documentTotals: [],
      userTrend: [],
      projectTrend: [],
      documentTrend: [],
    });

    const metrics = await getDashboardMetrics(now);

    expect(metrics.totals).toEqual({
      users: { total: 0, deactivated: 0 },
      workspaces: { total: 0 },
      projects: { total: 0, deleted: 0 },
      whiteboardDocuments: { total: 0, deleted: 0 },
    });
  });
});
