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
  it("returns null defaults when not set", async () => {
    const s = await getUserAiModeSettings(TEST_USER_ID);
    expect(s.kieApiKey).toBeNull();
    expect(s.geminiApiKey).toBeNull();
  });

  it("round-trip: set plain → get plain", async () => {
    await updateUserAiModeSettings(TEST_USER_ID, {
      kieApiKey: "k_real_secret_xxx",
      geminiApiKey: null,
    });
    const s = await getUserAiModeSettings(TEST_USER_ID);
    expect(s.kieApiKey).toBe("k_real_secret_xxx");
    expect(s.geminiApiKey).toBeNull();
  });

  it("encryption verification: DB raw value plain text DEĞİL (cipher)", async () => {
    await updateUserAiModeSettings(TEST_USER_ID, {
      kieApiKey: "k_real_secret_xxx",
      geminiApiKey: null,
    });
    const row = await db.userSetting.findUnique({
      where: { userId_key: { userId: TEST_USER_ID, key: "aiMode" } },
    });
    expect(row).not.toBeNull();
    const raw = row!.value as { kieApiKey: string | null };
    expect(raw.kieApiKey).not.toBe("k_real_secret_xxx");
    expect(typeof raw.kieApiKey).toBe("string");
    expect(raw.kieApiKey!.length).toBeGreaterThan(0);
  });
});
