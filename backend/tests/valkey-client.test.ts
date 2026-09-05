import { afterAll, describe, expect, it } from "vitest";
import { valkey } from "@/cache/valkey";

describe("valkey client", () => {
  it("creates a lazy client without connecting", () => {
    expect(valkey.status).toBe("wait");
  });

  afterAll(() => {
    valkey.disconnect();
  });
});
