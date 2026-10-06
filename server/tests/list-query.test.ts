import { describe, expect, it } from "vitest";
import { listQuerySchema, paginationQuerySchema } from "@/schemas/list-query.schema";

describe("페이지네이션 query 스키마", () => {
  it("query 값이 없으면 페이지 1과 페이지 크기 20을 사용한다", () => {
    expect(paginationQuerySchema.parse({})).toEqual({ page: 1, limit: 20 });
  });

  it("숫자 query 문자열을 숫자로 변환한다", () => {
    expect(paginationQuerySchema.parse({ page: "2", limit: "10" })).toEqual({
      page: 2,
      limit: 10,
    });
  });

  it.each([
    { page: "0", limit: "20" },
    { page: "1.5", limit: "20" },
    { page: "1", limit: "0" },
    { page: "1", limit: "101" },
    { page: "not-a-number", limit: "20" },
  ])("잘못된 페이지네이션 값을 거부한다: %j", (query) => {
    expect(() => paginationQuerySchema.parse(query)).toThrow();
  });
});

describe("목록 query 스키마", () => {
  it("검색어의 앞뒤 공백을 제거하고 빈 검색어를 undefined로 변환한다", () => {
    expect(listQuerySchema.parse({ search: "  Brand  " })).toEqual({
      search: "Brand",
      page: 1,
      limit: 20,
    });
    expect(listQuerySchema.parse({ search: "   " })).toEqual({
      search: undefined,
      page: 1,
      limit: 20,
    });
  });

  it("100자를 초과하는 검색어를 거부한다", () => {
    expect(() => listQuerySchema.parse({ search: "a".repeat(101) })).toThrow();
  });
});
