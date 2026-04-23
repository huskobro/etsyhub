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
import { ForbiddenError, NotFoundError } from "@/lib/errors";

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

describe("bookmark-service", () => {
  let userA: string;
  let userB: string;

  beforeAll(async () => {
    const a = await ensureUser("bookmark-a@etsyhub.local");
    const b = await ensureUser("bookmark-b@etsyhub.local");
    userA = a.id;
    userB = b.id;
    await db.bookmark.deleteMany({ where: { userId: { in: [userA, userB] } } });
  });

  it("createBookmark minimum alanlarla çalışır (INBOX)", async () => {
    const bm = await createBookmark({
      userId: userA,
      input: { title: "Test 1", sourceUrl: "https://example.com/a" },
    });
    expect(bm.status).toBe("INBOX");
    expect(bm.userId).toBe(userA);
  });

  it("data isolation: userB, userA'nın bookmark'ını listede göremez", async () => {
    await createBookmark({
      userId: userA,
      input: { title: "SadeceA" },
    });
    const { items } = await listBookmarks({
      userId: userB,
      query: { limit: 50 },
    });
    expect(items.every((i) => i.userId === userB)).toBe(true);
    expect(items.find((i) => i.title === "SadeceA")).toBeUndefined();
  });

  it("getBookmark başka kullanıcının kaydına ForbiddenError", async () => {
    const bm = await createBookmark({
      userId: userA,
      input: { title: "Private" },
    });
    await expect(
      getBookmark({ userId: userB, id: bm.id }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("updateBookmark başka kullanıcı için ForbiddenError", async () => {
    const bm = await createBookmark({
      userId: userA,
      input: { title: "Owned" },
    });
    await expect(
      updateBookmark({
        userId: userB,
        id: bm.id,
        input: { title: "Hacked" },
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("softDeleteBookmark sahibi için ARCHIVED+deletedAt atar", async () => {
    const bm = await createBookmark({
      userId: userA,
      input: { title: "Kaldırılacak" },
    });
    const deleted = await softDeleteBookmark({ userId: userA, id: bm.id });
    expect(deleted.status).toBe("ARCHIVED");
    expect(deleted.deletedAt).not.toBeNull();
    await expect(
      getBookmark({ userId: userA, id: bm.id }),
    ).rejects.toThrow(NotFoundError);
  });
});
