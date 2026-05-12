import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { ProviderKind } from "@prisma/client";
import { db } from "@/server/db";
import {
  getBatchCostBreakdown,
  formatCostUSD,
} from "@/server/services/cost/batch-cost-breakdown";

const USER_ID = "batch-cost-breakdown-test-user";
const JOB_ID_A = "batch-cost-job-a";
const JOB_ID_B = "batch-cost-job-b";
const JOB_ID_OTHER = "batch-cost-job-other";

async function seedJob(id: string) {
  await db.job.upsert({
    where: { id },
    update: {},
    create: {
      id,
      userId: USER_ID,
      type: "GENERATE_VARIATIONS",
      status: "SUCCESS",
      metadata: { batchId: "test-batch-1" },
    },
  });
}

beforeEach(async () => {
  await db.costUsage.deleteMany({ where: { userId: USER_ID } });
  await db.job.deleteMany({
    where: { id: { in: [JOB_ID_A, JOB_ID_B, JOB_ID_OTHER] } },
  });
  await db.user.upsert({
    where: { id: USER_ID },
    update: {},
    create: {
      id: USER_ID,
      email: "batch-cost-breakdown@test.local",
      passwordHash: "x",
    },
  });
  await seedJob(JOB_ID_A);
  await seedJob(JOB_ID_B);
  await seedJob(JOB_ID_OTHER);
});

afterAll(async () => {
  await db.costUsage.deleteMany({ where: { userId: USER_ID } });
  await db.job.deleteMany({
    where: { id: { in: [JOB_ID_A, JOB_ID_B, JOB_ID_OTHER] } },
  });
  await db.user.deleteMany({ where: { id: USER_ID } });
});

describe("getBatchCostBreakdown", () => {
  it("empty job list → zeroed breakdown (defensive, no DB read)", async () => {
    const result = await getBatchCostBreakdown([]);
    expect(result).toEqual({
      totalCents: 0,
      totalUnits: 0,
      rowCount: 0,
      breakdown: [],
    });
  });

  it("no CostUsage rows for given jobs → empty breakdown", async () => {
    const result = await getBatchCostBreakdown([JOB_ID_A, JOB_ID_B]);
    expect(result.totalCents).toBe(0);
    expect(result.rowCount).toBe(0);
    expect(result.breakdown).toEqual([]);
  });

  it("aggregates cost rows scoped to jobIds; ignores out-of-scope jobs", async () => {
    // 2 rows for job A (kie midjourney) — should sum
    await db.costUsage.createMany({
      data: [
        {
          userId: USER_ID,
          providerKind: ProviderKind.AI,
          providerKey: "kie",
          model: "kie/midjourney-v7",
          jobId: JOB_ID_A,
          units: 1,
          costCents: 24,
          periodKey: "2026-05",
        },
        {
          userId: USER_ID,
          providerKind: ProviderKind.AI,
          providerKey: "kie",
          model: "kie/midjourney-v7",
          jobId: JOB_ID_A,
          units: 1,
          costCents: 24,
          periodKey: "2026-05",
        },
        // 1 row for job B (different model)
        {
          userId: USER_ID,
          providerKind: ProviderKind.AI,
          providerKey: "kie-gemini-flash",
          model: "gemini-2-5-flash",
          jobId: JOB_ID_B,
          units: 1,
          costCents: 1,
          periodKey: "2026-05",
        },
        // 1 row for an out-of-scope job — should NOT appear in breakdown
        {
          userId: USER_ID,
          providerKind: ProviderKind.AI,
          providerKey: "other-provider",
          model: null,
          jobId: JOB_ID_OTHER,
          units: 5,
          costCents: 100,
          periodKey: "2026-05",
        },
      ],
    });

    const result = await getBatchCostBreakdown([JOB_ID_A, JOB_ID_B]);
    expect(result.totalCents).toBe(48 + 1); // 49¢
    expect(result.totalUnits).toBe(3);
    expect(result.rowCount).toBe(3);
    expect(result.breakdown).toHaveLength(2);

    // costCents DESC — kie (48¢) önce, gemini-flash (1¢) sonra
    expect(result.breakdown[0]!.providerKey).toBe("kie");
    expect(result.breakdown[0]!.costCents).toBe(48);
    expect(result.breakdown[0]!.units).toBe(2);
    expect(result.breakdown[0]!.rowCount).toBe(2);
    expect(result.breakdown[0]!.model).toBe("kie/midjourney-v7");

    expect(result.breakdown[1]!.providerKey).toBe("kie-gemini-flash");
    expect(result.breakdown[1]!.costCents).toBe(1);
    expect(result.breakdown[1]!.units).toBe(1);
    expect(result.breakdown[1]!.model).toBe("gemini-2-5-flash");
  });
});

describe("formatCostUSD", () => {
  it("0¢ → $0.00", () => {
    expect(formatCostUSD(0)).toBe("$0.00");
  });

  it("24¢ → $0.24", () => {
    expect(formatCostUSD(24)).toBe("$0.24");
  });

  it("192¢ → $1.92", () => {
    expect(formatCostUSD(192)).toBe("$1.92");
  });

  it("4560¢ → $45.60", () => {
    expect(formatCostUSD(4560)).toBe("$45.60");
  });

  it("negatif/NaN → '—' (defensive — track-usage guard zaten engellesin)", () => {
    expect(formatCostUSD(-1)).toBe("—");
    expect(formatCostUSD(NaN)).toBe("—");
  });
});
