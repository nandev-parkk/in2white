import { describe, expect, it } from "vitest";
import { createPaginationMeta, getPaginationOffset } from "@/utils/pagination";

describe("페이지네이션 offset 계산", () => {
  it("1부터 시작하는 페이지에서 0부터 시작하는 offset을 계산한다", () => {
    expect(getPaginationOffset({ page: 1, limit: 20 })).toBe(0);
    expect(getPaginationOffset({ page: 3, limit: 20 })).toBe(40);
  });
});

describe("페이지네이션 메타데이터 생성", () => {
  it.each([
    { total: 0, limit: 20, totalPages: 0 },
    { total: 1, limit: 20, totalPages: 1 },
    { total: 40, limit: 20, totalPages: 2 },
    { total: 41, limit: 20, totalPages: 3 },
  ])("$total개 항목의 전체 페이지 수를 계산한다", ({ total, limit, totalPages }) => {
    expect(createPaginationMeta({ page: 2, limit, total })).toEqual({
      page: 2,
      limit,
      total,
      totalPages,
    });
  });
});
