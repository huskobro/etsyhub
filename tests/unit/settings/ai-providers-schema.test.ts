// R11 — AI Providers settings schema testleri.

import { describe, it, expect } from "vitest";
import {
  AiProvidersSettingsSchema,
  ProviderSpendSchema,
  TaskTypeEnum,
} from "@/server/services/settings/ai-providers.service";

describe("AiProvidersSettingsSchema", () => {
  it("applies sensible defaults", () => {
    const parsed = AiProvidersSettingsSchema.parse({});
    expect(parsed.spendLimits.kie?.dailyLimitUsd).toBe(50);
    expect(parsed.spendLimits.kie?.monthlyLimitUsd).toBe(800);
    expect(parsed.spendLimits.gemini?.dailyLimitUsd).toBe(30);
    expect(parsed.taskAssignments.variation).toBe("kie/midjourney-v7");
    expect(parsed.taskAssignments.review).toBe("kie/qc-vision-2");
  });

  it("ProviderSpendSchema rejects negative limits", () => {
    expect(() =>
      ProviderSpendSchema.parse({ dailyLimitUsd: -1, monthlyLimitUsd: 100 }),
    ).toThrow();
  });

  it("ProviderSpendSchema accepts 0 (no enforcement)", () => {
    const parsed = ProviderSpendSchema.parse({
      dailyLimitUsd: 0,
      monthlyLimitUsd: 0,
    });
    expect(parsed.dailyLimitUsd).toBe(0);
  });

  it("TaskTypeEnum is exhaustive", () => {
    expect(TaskTypeEnum.options).toEqual([
      "variation",
      "review",
      "listingCopy",
      "bgRemoval",
      "mockup",
    ]);
  });

  it("merges custom limits over defaults", () => {
    const parsed = AiProvidersSettingsSchema.parse({
      spendLimits: {
        kie: { dailyLimitUsd: 200, monthlyLimitUsd: 5000 },
        custom: { dailyLimitUsd: 10, monthlyLimitUsd: 100 },
      },
    });
    expect(parsed.spendLimits.kie?.dailyLimitUsd).toBe(200);
    expect(parsed.spendLimits.custom?.monthlyLimitUsd).toBe(100);
  });
});
