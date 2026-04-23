import { beforeAll, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { UserRole, UserStatus } from "@prisma/client";
import { db } from "@/server/db";
import {
  createCollection,
  getCollection,
  listCollections,
  softDeleteCollection,
  updateCollection,
} from "@/features/collections/services/collection-service";
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

describe("collection-service", () => {
  let userA: string;
  let userB: string;

  beforeAll(async () => {
    const a = await ensureUser("col-a@etsyhub.local");
    const b = await ensureUser("col-b@etsyhub.local");
    userA = a.id;
    userB = b.id;
    await db.collection.deleteMany({ where: { userId: { in: [userA, userB] } } });
  });

  it("collection oluşturur ve slug türetir", async () => {
    const c = await createCollection({
      userId: userA,
      input: { name: "Nursery Wall Art", kind: "MIXED" },
    });
    expect(c.name).toBe("Nursery Wall Art");
    expect(c.slug).toBe("nursery-wall-art");
    expect(c.userId).toBe(userA);
  });

  it("aynı isimli ikinci koleksiyon ConflictError döner", async () => {
    await createCollection({
      userId: userA,
      input: { name: "Duplicate Test", kind: "MIXED" },
    });
    await expect(
      createCollection({
        userId: userA,
        input: { name: "Duplicate Test", kind: "MIXED" },
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("aynı kullanıcı farklı isimle başka koleksiyon açabilir", async () => {
    const c1 = await createCollection({
      userId: userA,
      input: { name: "Halloween 2026", kind: "BOOKMARK" },
    });
    const c2 = await createCollection({
      userId: userA,
      input: { name: "Halloween-2026", kind: "BOOKMARK" },
    });
    expect(c1.slug).not.toBe(c2.slug);
  });

  it("farklı kullanıcılar aynı ismi kullanabilir", async () => {
    await createCollection({
      userId: userA,
      input: { name: "Boho Canvas", kind: "MIXED" },
    });
    const b = await createCollection({
      userId: userB,
      input: { name: "Boho Canvas", kind: "MIXED" },
    });
    expect(b.userId).toBe(userB);
  });

  it("listCollections sadece kendi koleksiyonlarını döner", async () => {
    const aList = await listCollections({ userId: userA, query: { limit: 50 } });
    const bList = await listCollections({ userId: userB, query: { limit: 50 } });
    for (const c of aList) expect(c.userId).toBe(userA);
    for (const c of bList) expect(c.userId).toBe(userB);
  });

  it("diğer kullanıcının koleksiyonunu getiremez", async () => {
    const c = await createCollection({
      userId: userA,
      input: { name: "Private A", kind: "MIXED" },
    });
    await expect(
      getCollection({ userId: userB, id: c.id }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("update ile açıklama değiştirilir", async () => {
    const c = await createCollection({
      userId: userA,
      input: { name: "Editable Coll", kind: "MIXED" },
    });
    const updated = await updateCollection({
      userId: userA,
      id: c.id,
      input: { description: "Yeni açıklama" },
    });
    expect(updated.description).toBe("Yeni açıklama");
  });

  it("softDelete sonrası NotFoundError", async () => {
    const c = await createCollection({
      userId: userA,
      input: { name: "Soft Delete Target", kind: "MIXED" },
    });
    await softDeleteCollection({ userId: userA, id: c.id });
    await expect(
      getCollection({ userId: userA, id: c.id }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
