import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";
import { UserRole, UserStatus, CompetitorScanType } from "@prisma/client";
import { db } from "@/server/db";
import {
  addCompetitor,
  deleteCompetitor,
  getCompetitor,
  listCompetitors,
  triggerScan,
} from "@/features/competitors/services/competitor-service";
import { ConflictError, NotFoundError } from "@/lib/errors";

// enqueue gerçek Redis'e dokunmaması için mock
// Her çağrıda unique ID üretilmeli (bullJobId unique constraint nedeniyle)
let _mockBullCounter = 0;
vi.mock("@/server/queue", () => ({
  enqueue: vi.fn().mockImplementation(() => {
    _mockBullCounter += 1;
    return Promise.resolve({ id: `bull-mock-${_mockBullCounter}` });
  }),
}));

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

describe("competitor-service", () => {
  let userAId: string;
  let userBId: string;

  beforeAll(async () => {
    const userA = await ensureUser("comp-a@etsyhub.local");
    const userB = await ensureUser("comp-b@etsyhub.local");
    userAId = userA.id;
    userBId = userB.id;

    // Temizle
    await db.competitorScan.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await db.competitorListing.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await db.competitorStore.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await db.job.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
  });

  afterAll(async () => {
    await db.competitorScan.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await db.competitorListing.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await db.competitorStore.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await db.job.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
  });

  describe("addCompetitor", () => {
    it("temel alanlarla store oluşturur", async () => {
      const store = await addCompetitor(userAId, {
        shopIdentifier: "TestShopAlpha", // canonical → testshopalpha
        platform: "ETSY",
        autoScanEnabled: false,
      });

      expect(store.userId).toBe(userAId);
      // canonical normalization: lowercase
      expect(store.etsyShopName).toBe("testshopalpha");
    });

    it("canonical normalization: URL ile eklenen shop, düz isimle aynı canonical → ConflictError", async () => {
      await addCompetitor(userBId, {
        shopIdentifier: "UniqueShopZeta",
        platform: "ETSY",
        autoScanEnabled: false,
      });

      // Aynı mağazayı URL formatıyla tekrar ekle
      await expect(
        addCompetitor(userBId, {
          shopIdentifier: "https://www.etsy.com/shop/UniqueShopZeta",
          platform: "ETSY",
          autoScanEnabled: false,
        }),
      ).rejects.toThrow(ConflictError);
    });

    it("aynı shop name (farklı case) → ConflictError", async () => {
      // İlk ekleme yukarıda zaten yapıldı: "uniqueshopzeta" canonical
      await expect(
        addCompetitor(userBId, {
          shopIdentifier: "uniqueshopzeta",
          platform: "ETSY",
          autoScanEnabled: false,
        }),
      ).rejects.toThrow(ConflictError);
    });

    it("farklı user aynı shop name → ConflictError yok, iki ayrı kayıt", async () => {
      const shopName = "SharedShopOmega";

      const storeA = await addCompetitor(userAId, {
        shopIdentifier: shopName,
        platform: "ETSY",
        autoScanEnabled: false,
      });

      // userB aynı mağazayı ekleyebilmeli
      const storeB = await addCompetitor(userBId, {
        shopIdentifier: shopName,
        platform: "ETSY",
        autoScanEnabled: false,
      });

      expect(storeA.userId).toBe(userAId);
      expect(storeB.userId).toBe(userBId);
      expect(storeA.id).not.toBe(storeB.id);
    });
  });

  describe("listCompetitors — data isolation", () => {
    it("userA sadece kendi mağazalarını görür", async () => {
      const listA = await listCompetitors(userAId);
      expect(listA.items.every((s) => s.userId === userAId)).toBe(true);
    });

    it("userB sadece kendi mağazalarını görür", async () => {
      const listB = await listCompetitors(userBId);
      expect(listB.items.every((s) => s.userId === userBId)).toBe(true);
    });
  });

  describe("getCompetitor", () => {
    it("sahibi store'u getirebilir", async () => {
      const stores = await listCompetitors(userAId);
      const first = stores.items[0];
      if (!first) throw new Error("Store yok");

      const store = await getCompetitor(userAId, first.id);
      expect(store.id).toBe(first.id);
    });

    it("başka user'ın store'u → NotFoundError", async () => {
      const storesA = await listCompetitors(userAId);
      const first = storesA.items[0];
      if (!first) throw new Error("Store yok");

      await expect(getCompetitor(userBId, first.id)).rejects.toThrow(NotFoundError);
    });
  });

  describe("triggerScan", () => {
    it("Job + CompetitorScan kaydı oluşturur", async () => {
      const stores = await listCompetitors(userAId);
      const first = stores.items[0];
      if (!first) throw new Error("Store yok");

      const { jobId, scanId } = await triggerScan({
        userId: userAId,
        competitorStoreId: first.id,
        type: CompetitorScanType.MANUAL_REFRESH,
      });

      const job = await db.job.findUnique({ where: { id: jobId } });
      expect(job).not.toBeNull();
      expect(job?.userId).toBe(userAId);
      expect(job?.bullJobId).toMatch(/^bull-mock-\d+$/);

      const scan = await db.competitorScan.findUnique({ where: { id: scanId } });
      expect(scan).not.toBeNull();
      expect(scan?.competitorStoreId).toBe(first.id);
      expect(scan?.type).toBe(CompetitorScanType.MANUAL_REFRESH);
    });

    it("başka user'ın store'una triggerScan → NotFoundError", async () => {
      const storesA = await listCompetitors(userAId);
      const first = storesA.items[0];
      if (!first) throw new Error("Store yok");

      await expect(
        triggerScan({
          userId: userBId,
          competitorStoreId: first.id,
          type: CompetitorScanType.MANUAL_REFRESH,
        }),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("deleteCompetitor", () => {
    it("sahibi soft delete yapabilir", async () => {
      const store = await addCompetitor(userAId, {
        shopIdentifier: "SoftDeleteTestShop",
        platform: "ETSY",
        autoScanEnabled: false,
      });

      await deleteCompetitor(userAId, store.id);

      // deletedAt set edilmiş olmalı
      const deleted = await db.competitorStore.findUnique({ where: { id: store.id } });
      expect(deleted?.deletedAt).not.toBeNull();

      // getCompetitor artık NotFoundError vermeli
      await expect(getCompetitor(userAId, store.id)).rejects.toThrow(NotFoundError);
    });

    it("başka user'ın store'unu silmeye çalışınca NotFoundError", async () => {
      const stores = await listCompetitors(userAId);
      const active = stores.items.find((s) => s.deletedAt === null);
      if (!active) throw new Error("Aktif store yok");

      await expect(deleteCompetitor(userBId, active.id)).rejects.toThrow(NotFoundError);
    });
  });
});
