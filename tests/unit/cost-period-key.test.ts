import { describe, it, expect } from "vitest";
import { dailyPeriodKey } from "@/server/services/cost/period-key";

describe("dailyPeriodKey", () => {
  it("YYYY-MM-DD UTC formatında string döner", () => {
    const d = new Date("2026-04-29T12:34:56Z");
    expect(dailyPeriodKey(d)).toBe("2026-04-29");
  });

  it("UTC: yerel timezone gece yarısı offset olsa bile UTC günü kullanılır", () => {
    // 2026-04-30 02:30 Istanbul = 2026-04-29 23:30 UTC ⇒ UTC tarafında 04-29
    const d = new Date("2026-04-29T23:30:00Z");
    expect(dailyPeriodKey(d)).toBe("2026-04-29");
  });
});
