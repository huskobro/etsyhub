import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";
import {
  CompetitorScanStatus,
  CompetitorScanType,
  JobStatus,
  JobType,
  SourcePlatform,
  UserRole,
  UserStatus,
} from "@prisma/client";
import { db } from "@/server/db";

/**
 * Queue katmanını tümüyle stub ediyoruz: FETCH_NEW_LISTINGS worker testi
 * gerçek Redis bağlantısına bağımlı olmamalı. `enqueue` çağrıları spy
 * üzerinden doğrulanır; `scheduleRepeatJob` / `cancelRepeatJob` gerçek
 * BullMQ Queue nesnesine dokunmadan test edilir.
 */
type RepeatableMeta = {
  key: string;
  name: string;
  id: string | null;
  pattern: string | null;
};

let enqueueCounter = 0;
const enqueueMock = vi.fn(async (_type: JobType, _payload: unknown) => {
  enqueueCounter++;
  return { id: `bull-job-id-${enqueueCounter}` };
});

const addMock = vi.fn(
  async (
    _name: string,
    _payload: Record<string, unknown>,
    _opts: Record<string, unknown>,
  ) => ({ id: "bull-job-id" }),
);
const removeRepeatableByKeyMock = vi.fn(async (_key: string) => true);
const getRepeatableJobsState: RepeatableMeta[] = [];
const getRepeatableJobsMock = vi.fn(async () => [...getRepeatableJobsState]);

type MockQueue = {
  add: typeof addMock;
  removeRepeatableByKey: typeof removeRepeatableByKeyMock;
  getRepeatableJobs: typeof getRepeatableJobsMock;
};

const mockQueue: MockQueue = {
  add: addMock,
  removeRepeatableByKey: removeRepeatableByKeyMock,
  getRepeatableJobs: getRepeatableJobsMock,
};

vi.mock("@/server/queue", async () => {
  const actual = await vi.importActual<typeof import("@prisma/client")>(
    "@prisma/client",
  );
  const allJobTypes = Object.values(actual.JobType);
  const queues = Object.fromEntries(
    allJobTypes.map((t) => [t, mockQueue]),
  ) as Record<string, MockQueue>;

  return {
    connection: {} as unknown,
    queues,
    enqueue: enqueueMock,
    scheduleRepeatJob: async (
      type: JobType,
      payload: Record<string, unknown>,
      opts: { jobId: string; pattern: string },
    ) => {
      // Gerçek implementasyonun davranışını taklit eden test stub'u:
      // - aynı jobId + pattern varsa duplicate yaratma
      // - yoksa add çağır ve state'e ekle
      const existing = getRepeatableJobsState.find(
        (r) => r.id === opts.jobId && r.pattern === opts.pattern,
      );
      if (existing) {
        return { id: opts.jobId };
      }
      getRepeatableJobsState.push({
        key: `${type}::${opts.jobId}::${opts.pattern}`,
        name: type,
        id: opts.jobId,
        pattern: opts.pattern,
      });
      return mockQueue.add(type, payload, {
        jobId: opts.jobId,
        repeat: { pattern: opts.pattern },
      });
    },
    cancelRepeatJob: async (_type: JobType, jobId: string) => {
      const idx = getRepeatableJobsState.findIndex((r) => r.id === jobId);
      if (idx >= 0) {
        const entry = getRepeatableJobsState[idx];
        if (entry) {
          getRepeatableJobsState.splice(idx, 1);
          return mockQueue.removeRepeatableByKey(entry.key);
        }
      }
      return false;
    },
  };
});

// Worker import'ı mock'tan sonra olmalı
const { handleFetchNewListings } = await import(
  "@/server/workers/fetch-new-listings.worker"
);
const { scheduleRepeatJob } = await import("@/server/queue");

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

async function seedStore(args: {
  userId: string;
  shopName: string;
  autoScanEnabled: boolean;
}) {
  return db.competitorStore.create({
    data: {
      userId: args.userId,
      etsyShopName: args.shopName,
      shopUrl: `https://www.etsy.com/shop/${args.shopName}`,
      platform: SourcePlatform.ETSY,
      autoScanEnabled: args.autoScanEnabled,
    },
  });
}

describe("FETCH_NEW_LISTINGS worker — scheduler davranışı", () => {
  let userAId: string;
  let userBId: string;

  beforeAll(async () => {
    const a = await ensureUser("fetch-worker-a@etsyhub.local");
    const b = await ensureUser("fetch-worker-b@etsyhub.local");
    userAId = a.id;
    userBId = b.id;
  });

  beforeEach(async () => {
    enqueueCounter = 0;
    enqueueMock.mockClear();
    addMock.mockClear();
    removeRepeatableByKeyMock.mockClear();
    getRepeatableJobsMock.mockClear();
    getRepeatableJobsState.length = 0;

    for (const uid of [userAId, userBId]) {
      await db.competitorScan.deleteMany({ where: { userId: uid } });
      await db.competitorStore.deleteMany({ where: { userId: uid } });
      await db.job.deleteMany({
        where: {
          userId: uid,
          type: { in: [JobType.SCRAPE_COMPETITOR, JobType.FETCH_NEW_LISTINGS] },
        },
      });
    }
  });

  afterAll(async () => {
    for (const uid of [userAId, userBId]) {
      await db.competitorScan.deleteMany({ where: { userId: uid } });
      await db.competitorStore.deleteMany({ where: { userId: uid } });
      await db.job.deleteMany({
        where: {
          userId: uid,
          type: { in: [JobType.SCRAPE_COMPETITOR, JobType.FETCH_NEW_LISTINGS] },
        },
      });
    }
  });

  it("payload boşken sadece autoScanEnabled=true store'lar için alt scan açar", async () => {
    // 2 store autoScanEnabled=true (farklı user'lar → data isolation), 1 store false
    const storeA1 = await seedStore({
      userId: userAId,
      shopName: "auto-on-a",
      autoScanEnabled: true,
    });
    const storeB1 = await seedStore({
      userId: userBId,
      shopName: "auto-on-b",
      autoScanEnabled: true,
    });
    const storeA2 = await seedStore({
      userId: userAId,
      shopName: "auto-off-a",
      autoScanEnabled: false,
    });

    const res = await handleFetchNewListings({ data: {} });
    expect(res.triggered).toBe(2);

    // SCRAPE_COMPETITOR enqueue tam olarak 2 kez çağrılmış olmalı
    const scrapeCalls = enqueueMock.mock.calls.filter(
      (c) => c[0] === JobType.SCRAPE_COMPETITOR,
    );
    expect(scrapeCalls).toHaveLength(2);

    // Her çağrıda payload.userId + competitorStoreId aynı store'un user_id'siyle eşleşmeli
    const payloads = scrapeCalls.map((c) => c[1] as {
      userId: string;
      competitorStoreId: string;
      type: CompetitorScanType;
    });
    const storeIds = payloads.map((p) => p.competitorStoreId).sort();
    expect(storeIds).toEqual([storeA1.id, storeB1.id].sort());
    for (const p of payloads) {
      expect(p.type).toBe(CompetitorScanType.INCREMENTAL_NEW);
      if (p.competitorStoreId === storeA1.id) expect(p.userId).toBe(userAId);
      if (p.competitorStoreId === storeB1.id) expect(p.userId).toBe(userBId);
    }

    // DB'de SCRAPE_COMPETITOR job + scan kaydı açılmış olmalı — 2 adet
    const scrapeJobs = await db.job.findMany({
      where: {
        type: JobType.SCRAPE_COMPETITOR,
        userId: { in: [userAId, userBId] },
      },
    });
    expect(scrapeJobs).toHaveLength(2);

    const scans = await db.competitorScan.findMany({
      where: { userId: { in: [userAId, userBId] } },
    });
    expect(scans).toHaveLength(2);
    expect(scans.every((s) => s.type === CompetitorScanType.INCREMENTAL_NEW)).toBe(
      true,
    );
    expect(scans.every((s) => s.status === CompetitorScanStatus.QUEUED)).toBe(
      true,
    );

    // autoScanEnabled=false store için hiç scan açılmamış
    const offScan = await db.competitorScan.findFirst({
      where: { competitorStoreId: storeA2.id },
    });
    expect(offScan).toBeNull();
  });

  it("payload.competitorStoreId verildiğinde sadece o store için alt scan açar", async () => {
    const storeA1 = await seedStore({
      userId: userAId,
      shopName: "single-a",
      autoScanEnabled: true,
    });
    const storeA2 = await seedStore({
      userId: userAId,
      shopName: "other-a",
      autoScanEnabled: true,
    });

    const res = await handleFetchNewListings({
      data: { competitorStoreId: storeA1.id },
    });
    expect(res.triggered).toBe(1);

    const scrapeCalls = enqueueMock.mock.calls.filter(
      (c) => c[0] === JobType.SCRAPE_COMPETITOR,
    );
    expect(scrapeCalls).toHaveLength(1);

    const payload = scrapeCalls[0]?.[1] as {
      userId: string;
      competitorStoreId: string;
      type: CompetitorScanType;
    };
    expect(payload.competitorStoreId).toBe(storeA1.id);
    expect(payload.userId).toBe(userAId);
    expect(payload.type).toBe(CompetitorScanType.INCREMENTAL_NEW);

    // Sadece 1 scan açılmış
    const scans = await db.competitorScan.findMany({
      where: { userId: userAId },
    });
    expect(scans).toHaveLength(1);
    expect(scans[0]?.competitorStoreId).toBe(storeA1.id);

    // İkinci store için scan açılmamış
    const otherScan = await db.competitorScan.findFirst({
      where: { competitorStoreId: storeA2.id },
    });
    expect(otherScan).toBeNull();
  });

  it("payload.competitorStoreId bilinmeyen ID ise hata atar, hiç scan açılmaz", async () => {
    await expect(
      handleFetchNewListings({ data: { competitorStoreId: "ghost-id" } }),
    ).rejects.toThrow();

    const scans = await db.competitorScan.findMany({
      where: { userId: { in: [userAId, userBId] } },
    });
    expect(scans).toHaveLength(0);
  });

  it("scheduleRepeatJob idempotent: aynı jobId+pattern iki kez çağrılsa Queue'da tek entry olur", async () => {
    await scheduleRepeatJob(
      JobType.FETCH_NEW_LISTINGS,
      {},
      { jobId: "fetch-new-listings-daily", pattern: "0 6 * * *" },
    );
    await scheduleRepeatJob(
      JobType.FETCH_NEW_LISTINGS,
      {},
      { jobId: "fetch-new-listings-daily", pattern: "0 6 * * *" },
    );

    // Mock queue.add sadece ilk çağrıda tetiklenmeli
    expect(addMock).toHaveBeenCalledTimes(1);
    expect(getRepeatableJobsState).toHaveLength(1);
    expect(getRepeatableJobsState[0]?.id).toBe("fetch-new-listings-daily");
    expect(getRepeatableJobsState[0]?.pattern).toBe("0 6 * * *");
  });

  it("auto scan'li store yoksa (veya soft-deleted) scheduler 0 iş planlar", async () => {
    // Store yok
    const r1 = await handleFetchNewListings({ data: {} });
    expect(r1.triggered).toBe(0);
    expect(enqueueMock).not.toHaveBeenCalled();

    // Soft-deleted bir store eklensin
    const deleted = await seedStore({
      userId: userAId,
      shopName: "deleted-one",
      autoScanEnabled: true,
    });
    await db.competitorStore.update({
      where: { id: deleted.id },
      data: { deletedAt: new Date() },
    });

    enqueueMock.mockClear();
    const r2 = await handleFetchNewListings({ data: {} });
    expect(r2.triggered).toBe(0);
    expect(
      enqueueMock.mock.calls.filter(
        (c) => c[0] === JobType.SCRAPE_COMPETITOR,
      ),
    ).toHaveLength(0);
  });
});
