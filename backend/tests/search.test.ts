import { describe, expect, it } from "vitest";
import { buildContainsSearchPattern } from "@/utils/search";

describe("포함 검색 패턴 생성", () => {
  it("검색어 앞뒤에 포함 검색 와일드카드를 붙인다", () => {
    expect(buildContainsSearchPattern("Brand")).toBe("%Brand%");
  });

  it("LIKE 와일드카드 문자를 escape한다", () => {
    expect(buildContainsSearchPattern("100%_done\\now")).toBe("%100\\%\\_done\\\\now%");
  });
});
