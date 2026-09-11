import { describe, expect, it } from "vitest";
import { TokenBucket } from "@/realtime/whiteboard-rate-limiter";

describe("TokenBucket", () => {
  it("allows the burst and rejects the next event", () => {
    let now = 1_000;
    const bucket = new TokenBucket({
      ratePerSecond: 20,
      burst: 40,
      now: () => now,
    });

    expect(Array.from({ length: 40 }, () => bucket.consume()).every(Boolean)).toBe(true);
    expect(bucket.consume()).toBe(false);

    now += 50;
    expect(bucket.consume()).toBe(true);
  });

  it("refills only up to the configured burst", () => {
    let now = 0;
    const bucket = new TokenBucket({ ratePerSecond: 2, burst: 3, now: () => now });

    expect([bucket.consume(), bucket.consume(), bucket.consume(), bucket.consume()]).toEqual([
      true,
      true,
      true,
      false,
    ]);
    now += 10_000;
    expect([bucket.consume(), bucket.consume(), bucket.consume(), bucket.consume()]).toEqual([
      true,
      true,
      true,
      false,
    ]);
  });

  it("does not mint tokens when the clock moves backwards", () => {
    let now = 1_000;
    const bucket = new TokenBucket({ ratePerSecond: 1, burst: 1, now: () => now });

    expect(bucket.consume()).toBe(true);
    now = 500;
    expect(bucket.consume()).toBe(false);
    now = 1_500;
    expect(bucket.consume()).toBe(false);
    now = 2_000;
    expect(bucket.consume()).toBe(true);
  });
});
