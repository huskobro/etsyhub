import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/server/db";
import {
  getUserLocalLibrarySettings,
  updateUserLocalLibrarySettings,
} from "@/features/settings/local-library/service";

const TEST_USER_ID = "test-user-settings";

beforeEach(async () => {
  await db.userSetting.deleteMany({ where: { userId: TEST_USER_ID } });
  await db.user.upsert({
    where: { id: TEST_USER_ID },
    update: {},
    create: { id: TEST_USER_ID, email: "settings@test.local", passwordHash: "x" },
  });
});

describe("local-library settings", () => {
  it("returns null defaults when not set", async () => {
    const s = await getUserLocalLibrarySettings(TEST_USER_ID);
    expect(s.rootFolderPath).toBeNull();
    expect(s.targetDpi).toBe(300);
  });

  it("persists rootFolderPath + target", async () => {
    await updateUserLocalLibrarySettings(TEST_USER_ID, {
      rootFolderPath: "/Users/x/resimler",
      targetResolution: { width: 4000, height: 4000 },
      targetDpi: 300,
    });
    const s = await getUserLocalLibrarySettings(TEST_USER_ID);
    expect(s.rootFolderPath).toBe("/Users/x/resimler");
    expect(s.targetResolution).toEqual({ width: 4000, height: 4000 });
  });

  it("rejects invalid path (not absolute)", async () => {
    await expect(
      updateUserLocalLibrarySettings(TEST_USER_ID, {
        rootFolderPath: "relative/path",
        targetResolution: { width: 4000, height: 4000 },
        targetDpi: 300,
      }),
    ).rejects.toThrow(/absolute path/i);
  });
});
