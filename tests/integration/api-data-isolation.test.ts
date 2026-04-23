import { beforeAll, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { UserRole, UserStatus } from "@prisma/client";
import { db } from "@/server/db";
import {
  createBookmark,
  getBookmark,
  listBookmarks,
  softDeleteBookmark,
  updateBookmark,
} from "@/features/bookmarks/services/bookmark-service";
import { ForbiddenError } from "@/lib/errors";

async function ensureUser(email: string) {
  return db.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash: await bcrypt.hash("password-test", 10),
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
    },
    update: {},
  });
}

describe("bookmarks data isolation", () => {
  let userA: string;
  let userB: string;

  beforeAll(async () => {
    const a = await ensureUser("isolation-a@etsyhub.local");
    const b = await ensureUser("isolation-b@etsyhub.local");
    userA = a.id;
    userB = b.id;
    await db.bookmark.deleteMany({
      where: { userId: { in: [userA, userB] } },
    });
  });

  it("userA'nın bookmark'ı userB'nin listesinde görünmez", async () => {
    const owned = await createBookmark({
      userId: userA,
      input: { title: "SadeceUserA-Isolation", sourceUrl: "https://example.com/a" },
    });
    const { items } = await listBookmarks({
      userId: userB,
      query: { limit: 50 },
    });
    expect(items.some((i) => i.id === owned.id)).toBe(false);
    expect(items.every((i) => i.userId === userB)).toBe(true);
  });

  it("userB, userA'nın bookmark'ını getBookmark ile alamaz", async () => {
    const owned = await createBookmark({
      userId: userA,
      input: { title: "Gizli" },
    });
    await expect(
      getBookmark({ userId: userB, id: owned.id }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("userB, userA'nın bookmark'ını update edemez", async () => {
    const owned = await createBookmark({
      userId: userA,
      input: { title: "Korumalı" },
    });
    await expect(
      updateBookmark({
        userId: userB,
        id: owned.id,
        input: { title: "Hacked" },
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("userB, userA'nın bookmark'ını silemez", async () => {
    const owned = await createBookmark({
      userId: userA,
      input: { title: "Silinemez" },
    });
    await expect(
      softDeleteBookmark({ userId: userB, id: owned.id }),
    ).rejects.toThrow(ForbiddenError);
  });
});
