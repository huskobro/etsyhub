import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/server/db";
import {
  getUserAiModeSettings,
  updateUserAiModeSettings,
} from "@/features/settings/ai-mode/service";

const TEST_USER_ID = "test-user-ai-mode";

beforeEach(async () => {
  await db.userSetting.deleteMany({ where: { userId: TEST_USER_ID } });
  await db.user.upsert({
    where: { id: TEST_USER_ID },
    update: {},
    create: { id: TEST_USER_ID, email: "ai-mode@test.local", passwordHash: "x" },
  });
});

describe("ai-mode settings", () => {
  it("returns null defaults when not set (reviewProvider Aşama 1 default 'kie')", async () => {
    const s = await getUserAiModeSettings(TEST_USER_ID);
    expect(s.kieApiKey).toBeNull();
    expect(s.geminiApiKey).toBeNull();
    // Phase 6 Aşama 1: row yokken default "kie" döner.
    expect(s.reviewProvider).toBe("kie");
  });

  it("round-trip: set plain → get plain (reviewProvider plain string)", async () => {
    await updateUserAiModeSettings(TEST_USER_ID, {
      kieApiKey: "k_real_secret_xxx",
      geminiApiKey: null,
      reviewProvider: "google-gemini",
    });
    const s = await getUserAiModeSettings(TEST_USER_ID);
    expect(s.kieApiKey).toBe("k_real_secret_xxx");
    expect(s.geminiApiKey).toBeNull();
    expect(s.reviewProvider).toBe("google-gemini");
  });

  it("encryption verification: DB raw value plain text DEĞİL (cipher); reviewProvider plain", async () => {
    await updateUserAiModeSettings(TEST_USER_ID, {
      kieApiKey: "k_real_secret_xxx",
      geminiApiKey: null,
      reviewProvider: "kie",
    });
    const row = await db.userSetting.findUnique({
      where: { userId_key: { userId: TEST_USER_ID, key: "aiMode" } },
    });
    expect(row).not.toBeNull();
    const raw = row!.value as { kieApiKey: string | null; reviewProvider: string };
    expect(raw.kieApiKey).not.toBe("k_real_secret_xxx");
    expect(typeof raw.kieApiKey).toBe("string");
    expect(raw.kieApiKey!.length).toBeGreaterThan(0);
    // reviewProvider plain saklanır (sır değil).
    expect(raw.reviewProvider).toBe("kie");
  });

  // Task 12 — parse asimetri kapatma: bozuk persist edilmiş value
  // `as` cast ile sessizce geçemez; zod parse FAIL → throw.
  it("getUserAiModeSettings throws on malformed stored value (parse hardening)", async () => {
    await db.userSetting.create({
      data: {
        userId: TEST_USER_ID,
        key: "aiMode",
        value: { not_a_valid_field: 123 },
      },
    });
    await expect(getUserAiModeSettings(TEST_USER_ID)).rejects.toThrow();
  });

  it("Aşama 1 backwards compat: reviewProvider field'ı eksik eski persist row default 'kie'", async () => {
    // Migration YOK; eski row'larda reviewProvider yok ⇒ Zod parse default "kie".
    await db.userSetting.create({
      data: {
        userId: TEST_USER_ID,
        key: "aiMode",
        value: {
          kieApiKey: null,
          geminiApiKey: null,
        },
      },
    });
    const s = await getUserAiModeSettings(TEST_USER_ID);
    expect(s.reviewProvider).toBe("kie");
  });
});
