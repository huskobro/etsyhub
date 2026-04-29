import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { ProviderKind } from "@prisma/client";
import { db } from "@/server/db";
import {
  assertWithinDailyBudget,
  DAILY_REVIEW_BUDGET_CENTS,
} from "@/server/services/cost/budget";
import { dailyPeriodKey } from "@/server/services/cost/period-key";

const USER_A = "cost-budget-test-user-a";
const USER_B = "cost-budget-test-user-b";

beforeEach(async () => {
  await db.costUsage.deleteMany({ where: { userId: { in: [USER_A, USER_B] } } });
  await db.user.upsert({
    where: { id: USER_A },
    update: {},
    create: { id: USER_A, email: "cost-budget-a@test.local", passwordHash: "x" },
  });
  await db.user.upsert({
    where: { id: USER_B },
    update: {},
    create: { id: USER_B, email: "cost-budget-b@test.local", passwordHash: "x" },
  });
});

afterAll(async () => {
  await db.costUsage.deleteMany({ where: { userId: { in: [USER_A, USER_B] } } });
  await db.user.deleteMany({ where: { id: { in: [USER_A, USER_B] } } });
});

async function seedSpend(userId: string, costCents: number, periodKey?: string): Promise<void> {
  await db.costUsage.create({
    data: {
      userId,
      providerKind: ProviderKind.AI,
      providerKey: "gemini-2-5-flash",
      model: "gemini-2-5-flash",
      units: 1,
      costCents,
      periodKey: periodKey ?? dailyPeriodKey(),
    },
  });
}

describe("assertWithinDailyBudget", () => {
  it("spent < limit ⇒ no throw (içeride)", async () => {
    await seedSpend(USER_A, 500);
    await expect(
      assertWithinDailyBudget(USER_A, ProviderKind.AI),
    ).resolves.toBeUndefined();
  });

  it("spent === limit ⇒ throw (>= kontrolü; eşit aşıldı sayılır)", async () => {
    await seedSpend(USER_A, DAILY_REVIEW_BUDGET_CENTS);
    await expect(
      assertWithinDailyBudget(USER_A, ProviderKind.AI),
    ).rejects.toThrow(/daily review budget exceeded/i);
  });

  it("spent > limit ⇒ throw", async () => {
    await seedSpend(USER_A, DAILY_REVIEW_BUDGET_CENTS + 50);
    await expect(
      assertWithinDailyBudget(USER_A, ProviderKind.AI),
    ).rejects.toThrow(/daily review budget exceeded/i);
  });

  it("dünkü kayıt bugünkü budget'ı etkilemez (period scope)", async () => {
    // Yapay olarak periodKey="2020-01-01" — geçmiş gün.
    await seedSpend(USER_A, DAILY_REVIEW_BUDGET_CENTS + 1000, "2020-01-01");
    await expect(
      assertWithinDailyBudget(USER_A, ProviderKind.AI),
    ).resolves.toBeUndefined();
  });

  it("multi-tenant: user A 500 spent ⇒ user B'nin budget'ı etkilenmez", async () => {
    await seedSpend(USER_A, 500);
    // User B için hiç kayıt yok ⇒ spent=0, limit=1000 ⇒ pass.
    await expect(
      assertWithinDailyBudget(USER_B, ProviderKind.AI),
    ).resolves.toBeUndefined();

    // Şimdi user B kendi kotasını doldursun ⇒ user A hâlâ pass.
    await seedSpend(USER_B, DAILY_REVIEW_BUDGET_CENTS);
    await expect(
      assertWithinDailyBudget(USER_B, ProviderKind.AI),
    ).rejects.toThrow(/daily review budget exceeded/i);
    await expect(
      assertWithinDailyBudget(USER_A, ProviderKind.AI),
    ).resolves.toBeUndefined();
  });
});
