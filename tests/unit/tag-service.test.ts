import { beforeAll, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { UserRole, UserStatus } from "@prisma/client";
import { db } from "@/server/db";
import {
  createTag,
  deleteTag,
  getTag,
  listTags,
  updateTag,
} from "@/features/tags/services/tag-service";
import {
  TAG_COLOR_KEYS,
  isTagColorKey,
  tagColorClass,
} from "@/features/tags/color-map";
import { createTagInput } from "@/features/tags/schemas";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";

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

describe("tag-service + color whitelist", () => {
  let userA: string;
  let userB: string;

  beforeAll(async () => {
    const a = await ensureUser("tag-a@etsyhub.local");
    const b = await ensureUser("tag-b@etsyhub.local");
    userA = a.id;
    userB = b.id;
    await db.tag.deleteMany({ where: { userId: { in: [userA, userB] } } });
  });

  const BAD_HEX = "#" + "ff0000";

  it("isTagColorKey whitelist dışındakileri reddeder", () => {
    expect(isTagColorKey("accent")).toBe(true);
    expect(isTagColorKey(BAD_HEX)).toBe(false);
    expect(isTagColorKey("berry")).toBe(false);
  });

  it("tagColorClass whitelist dışındaki değer için muted sınıf döner", () => {
    expect(tagColorClass("accent")).toContain("text-accent");
    expect(tagColorClass(BAD_HEX)).toBe(tagColorClass("muted"));
    expect(tagColorClass(null)).toBe(tagColorClass("muted"));
  });

  it("createTagInput raw hex color'u reddeder (zod)", () => {
    const raw = createTagInput.safeParse({ name: "bad", color: BAD_HEX });
    expect(raw.success).toBe(false);
  });

  it("createTagInput whitelist color'u kabul eder", () => {
    for (const key of TAG_COLOR_KEYS) {
      const ok = createTagInput.safeParse({ name: `t-${key}`, color: key });
      expect(ok.success).toBe(true);
    }
  });

  it("createTag + listTags sadece kendi tag'ini gösterir", async () => {
    await createTag({
      userId: userA,
      input: { name: "mine-a", color: "accent" },
    });
    await createTag({
      userId: userB,
      input: { name: "mine-b", color: "success" },
    });
    const aList = await listTags(userA);
    const bList = await listTags(userB);
    for (const t of aList) expect(t.userId).toBe(userA);
    for (const t of bList) expect(t.userId).toBe(userB);
  });

  it("aynı isimli ikinci tag ConflictError döner", async () => {
    await createTag({
      userId: userA,
      input: { name: "dup-tag", color: "warning" },
    });
    await expect(
      createTag({
        userId: userA,
        input: { name: "dup-tag", color: "warning" },
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("farklı kullanıcılar aynı isimli tag'e sahip olabilir", async () => {
    await createTag({ userId: userA, input: { name: "shared-name" } });
    const b = await createTag({ userId: userB, input: { name: "shared-name" } });
    expect(b.userId).toBe(userB);
  });

  it("diğer kullanıcının tag'ini getiremez", async () => {
    const t = await createTag({
      userId: userA,
      input: { name: "private-a", color: "accent" },
    });
    await expect(getTag({ userId: userB, id: t.id })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("update ile color null'a set edilir", async () => {
    const t = await createTag({
      userId: userA,
      input: { name: "color-clear", color: "danger" },
    });
    const cleared = await updateTag({
      userId: userA,
      id: t.id,
      input: { color: null },
    });
    expect(cleared.color).toBeNull();
  });

  it("deleteTag sonrası NotFoundError", async () => {
    const t = await createTag({
      userId: userA,
      input: { name: "doomed-tag" },
    });
    await deleteTag({ userId: userA, id: t.id });
    await expect(getTag({ userId: userA, id: t.id })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
