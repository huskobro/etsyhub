import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { ProviderKind } from "@prisma/client";
import { db } from "@/server/db";
import { recordCostUsage } from "@/server/services/cost/track-usage";
import { dailyPeriodKey } from "@/server/services/cost/period-key";

const USER_ID = "cost-track-test-user";

beforeEach(async () => {
  await db.costUsage.deleteMany({ where: { userId: USER_ID } });
  await db.user.upsert({
    where: { id: USER_ID },
    update: {},
    create: { id: USER_ID, email: "cost-track@test.local", passwordHash: "x" },
  });
});

afterAll(async () => {
  await db.costUsage.deleteMany({ where: { userId: USER_ID } });
  await db.user.deleteMany({ where: { id: USER_ID } });
});

describe("recordCostUsage", () => {
  it("happy path: insert sonrası row mevcut, periodKey YYYY-MM-DD", async () => {
    await recordCostUsage({
      userId: USER_ID,
      providerKind: ProviderKind.AI,
      providerKey: "gemini-2-5-flash",
      model: "gemini-2-5-flash",
      units: 1,
      costCents: 1,
    });

    const rows = await db.costUsage.findMany({ where: { userId: USER_ID } });
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row.providerKind).toBe(ProviderKind.AI);
    expect(row.providerKey).toBe("gemini-2-5-flash");
    expect(row.model).toBe("gemini-2-5-flash");
    expect(row.units).toBe(1);
    expect(row.costCents).toBe(1);
    expect(row.periodKey).toBe(dailyPeriodKey());
    expect(row.periodKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("negatif units ⇒ throw (sessiz kabul YASAK)", async () => {
    await expect(
      recordCostUsage({
        userId: USER_ID,
        providerKind: ProviderKind.AI,
        providerKey: "gemini-2-5-flash",
        units: -1,
        costCents: 1,
      }),
    ).rejects.toThrow(/non-negative/);
  });

  it("negatif costCents ⇒ throw", async () => {
    await expect(
      recordCostUsage({
        userId: USER_ID,
        providerKind: ProviderKind.AI,
        providerKey: "gemini-2-5-flash",
        units: 1,
        costCents: -5,
      }),
    ).rejects.toThrow(/non-negative/);
  });

  it("float units ⇒ throw (Int şart, fake precision yok)", async () => {
    await expect(
      recordCostUsage({
        userId: USER_ID,
        providerKind: ProviderKind.AI,
        providerKey: "gemini-2-5-flash",
        units: 1.5,
        costCents: 1,
      }),
    ).rejects.toThrow(/integers/);
  });
});
