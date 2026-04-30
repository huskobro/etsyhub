// Phase 7 Task 14 — getActiveExport retrieval integration testleri.
//
// Sözleşme (plan Task 14, design Section 6.6):
//   - Set GET payload'ında `activeExport` alanını besleyen helper.
//   - BullMQ queue üzerindeki en son `EXPORT_SELECTION_SET` job'u bulunur,
//     state'i 4'lü mapping ile döndürülür.
//   - Completed durumda 24h TTL kontrolü → expired → downloadUrl/expiresAt
//     UNDEFINED ama status hala "completed" döner.
//   - Cross-user filter: queue payload'undaki userId tutmuyorsa null.
//
// Test stratejisi:
//   - BullMQ Queue ve Worker GERÇEK (test env Redis var; .env.local).
//   - Storage signedUrl GERÇEK (Task 13 helper, MinIO local).
//   - Queued state: `queue.add` ile push edilir, Worker yok → `getJobs(["waiting"])`
//     queued olarak döner.
//   - Completed/failed state: tek-shot Worker spin-up ile gerçek state geçişi
//     üretilir (BullMQ test pattern'i; `moveToCompleted` token'ı atomik
//     yönetilir). Worker test sonunda `close()` ile kapatılır.
//   - Test izolasyonu: `queue.obliterate({ force: true })` her test öncesi
//     queue'yi temizler.

import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  afterEach,
} from "vitest";
import { Worker } from "bullmq";
import { JobType } from "@prisma/client";
import { connection, queues } from "@/server/queue";
import { getStorage } from "@/providers/storage";
import { ensureBucket } from "@/providers/storage/init";
import { env } from "@/lib/env";
import { newId } from "@/lib/id";
import { getActiveExport } from "@/server/services/selection/active-export";
import { EXPORT_SIGNED_URL_TTL_SECONDS } from "@/server/services/selection/export/signed-url";

const QUEUE_NAME = JobType.EXPORT_SELECTION_SET;
const queue = queues[QUEUE_NAME];

// Test fixture id'leri — gerçek user/set DB row'una gerek yok; getActiveExport
// yalnız BullMQ queue üzerinde filter yapıyor (DB query yok).
const userA = "active-export-user-A";
const userB = "active-export-user-B";
const setA = "active-export-set-A";
const setB = "active-export-set-B";

const createdStorageKeys: string[] = [];

async function clearQueue() {
  // Force queue'yi tamamen sıfırla (waiting/delayed/active/completed/failed hepsi).
  await queue.obliterate({ force: true });
}

async function uploadDummyZip(storageKey: string): Promise<void> {
  const storage = getStorage();
  // Minik ZIP-benzeri buffer (signed URL üretebilmek için key'in storage'da
  // var olması gerekir; presigned URL HEAD için provider bazlı değişir, ama
  // generateExportSignedUrl yalnız URL döndürür — gerçek nesne olması
  // istenmiyor. Yine de safe yapalım).
  await storage.upload(storageKey, Buffer.from("dummy-zip-content"), {
    contentType: "application/zip",
  });
  createdStorageKeys.push(storageKey);
}

/**
 * Worker spin-up ile bir job'u gerçek "completed" state'e taşır.
 *
 * `processor` parametresine göre:
 *   - returnValue → completed
 *   - throw → failed
 *
 * Sonra worker kapatılır; job artık DB'de completed/failed olarak kalır.
 */
async function processNextJob(processor: () => Promise<unknown>): Promise<void> {
  const worker = new Worker(
    QUEUE_NAME,
    async () => {
      return processor();
    },
    { connection: connection.duplicate(), autorun: true },
  );
  // Job'un işlenmesini bekle. Tek shot — bir job görür görmez kapatacağız.
  await new Promise<void>((resolve, reject) => {
    const onCompleted = () => {
      worker.off("completed", onCompleted);
      worker.off("failed", onFailed);
      resolve();
    };
    const onFailed = (_job: unknown, _err: unknown) => {
      worker.off("completed", onCompleted);
      worker.off("failed", onFailed);
      // Failed beklenen bir state — `throw` olarak yapılandırıldıysa
      // resolve. (Test caller bilir.)
      resolve();
    };
    worker.on("completed", onCompleted);
    worker.on("failed", onFailed);
    setTimeout(() => reject(new Error("worker timed out")), 10000);
  });
  await worker.close();
}

beforeAll(async () => {
  await ensureBucket();
});

beforeEach(async () => {
  await clearQueue();
});

afterEach(async () => {
  // Storage temizliği
  const storage = getStorage();
  for (const key of createdStorageKeys.splice(0)) {
    await storage.delete(key).catch(() => {});
  }
});

afterAll(async () => {
  await clearQueue();
});

// ────────────────────────────────────────────────────────────
// Job yok
// ────────────────────────────────────────────────────────────

describe("getActiveExport — job yok", () => {
  it("queue boş → null", async () => {
    const result = await getActiveExport({ userId: userA, setId: setA });
    expect(result).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────
// Queued (waiting state)
// ────────────────────────────────────────────────────────────

describe("getActiveExport — queued", () => {
  it("queue.add sonrası worker yok → status 'queued', downloadUrl/expiresAt undefined", async () => {
    const job = await queue.add(QUEUE_NAME, { userId: userA, setId: setA });

    const result = await getActiveExport({ userId: userA, setId: setA });
    expect(result).not.toBeNull();
    expect(result!.jobId).toBe(String(job.id));
    expect(result!.status).toBe("queued");
    expect(result!.downloadUrl).toBeUndefined();
    expect(result!.expiresAt).toBeUndefined();
    expect(result!.failedReason).toBeUndefined();
  });
});

// ────────────────────────────────────────────────────────────
// Completed within 24h
// ────────────────────────────────────────────────────────────

describe("getActiveExport — completed within 24h", () => {
  it("returnvalue.storageKey + finishedOn taze → status 'completed' + downloadUrl + expiresAt", async () => {
    const storageKey = `exports/${userA}/${setA}/${newId()}.zip`;
    await uploadDummyZip(storageKey);

    await queue.add(QUEUE_NAME, { userId: userA, setId: setA });
    await processNextJob(async () => ({
      storageKey,
      jobId: "ignored-handler-only-passes-through",
    }));

    const result = await getActiveExport({ userId: userA, setId: setA });
    expect(result).not.toBeNull();
    expect(result!.status).toBe("completed");
    expect(result!.downloadUrl).toBeDefined();
    expect(typeof result!.downloadUrl).toBe("string");
    expect(result!.downloadUrl!.length).toBeGreaterThan(0);
    expect(result!.expiresAt).toBeDefined();
    // expiresAt > now
    expect(new Date(result!.expiresAt!).getTime()).toBeGreaterThan(Date.now());
    // expiresAt yaklaşık now + 24h
    const expected = Date.now() + EXPORT_SIGNED_URL_TTL_SECONDS * 1000;
    const diff = Math.abs(new Date(result!.expiresAt!).getTime() - expected);
    expect(diff).toBeLessThan(60_000); // ±1dk tolerans
    expect(result!.failedReason).toBeUndefined();
  });
});

// ────────────────────────────────────────────────────────────
// Completed but URL expired (>24h ago)
// ────────────────────────────────────────────────────────────

describe("getActiveExport — completed but expired", () => {
  it("finishedOn 25h önce → status 'completed' ama downloadUrl/expiresAt undefined", async () => {
    const storageKey = `exports/${userA}/${setA}/${newId()}.zip`;
    await uploadDummyZip(storageKey);

    await queue.add(QUEUE_NAME, { userId: userA, setId: setA });
    await processNextJob(async () => ({
      storageKey,
      jobId: "ignored",
    }));

    // Job'u bul ve finishedOn'u 25 saat öncesine çek (Redis hash'i direkt
    // patch et — BullMQ Job.update() yalnız `data`yı günceller, `finishedOn`
    // için `client.hset` kullanılmalı).
    const jobs = await queue.getJobs(["completed"], 0, 10);
    expect(jobs.length).toBe(1);
    const completedJob = jobs[0]!;
    const expiredFinishedOn = Date.now() - 25 * 3600 * 1000;
    const client = await queue.client;
    await client.hset(
      `${queue.toKey(completedJob.id!)}`,
      "finishedOn",
      String(expiredFinishedOn),
    );

    const result = await getActiveExport({ userId: userA, setId: setA });
    expect(result).not.toBeNull();
    expect(result!.status).toBe("completed");
    expect(result!.downloadUrl).toBeUndefined();
    expect(result!.expiresAt).toBeUndefined();
  });
});

// ────────────────────────────────────────────────────────────
// Failed
// ────────────────────────────────────────────────────────────

describe("getActiveExport — failed", () => {
  it("worker throw → status 'failed' + failedReason populate, downloadUrl undefined", async () => {
    await queue.add(QUEUE_NAME, { userId: userA, setId: setA });
    await processNextJob(async () => {
      throw new Error("Storage upload reddedildi (test)");
    });

    const result = await getActiveExport({ userId: userA, setId: setA });
    expect(result).not.toBeNull();
    expect(result!.status).toBe("failed");
    expect(result!.failedReason).toBeDefined();
    expect(result!.failedReason).toContain("Storage upload reddedildi");
    expect(result!.downloadUrl).toBeUndefined();
    expect(result!.expiresAt).toBeUndefined();
  });
});

// ────────────────────────────────────────────────────────────
// Cross-user
// ────────────────────────────────────────────────────────────

describe("getActiveExport — cross-user", () => {
  it("User A'nın job'u User B için null döner (queue payload userId filter)", async () => {
    await queue.add(QUEUE_NAME, { userId: userA, setId: setA });

    const resultB = await getActiveExport({ userId: userB, setId: setA });
    expect(resultB).toBeNull();

    // User A için bulunmalı (sanity)
    const resultA = await getActiveExport({ userId: userA, setId: setA });
    expect(resultA).not.toBeNull();
  });
});

// ────────────────────────────────────────────────────────────
// Multiple exports same set — en yeni seçilir
// ────────────────────────────────────────────────────────────

describe("getActiveExport — multiple exports same set", () => {
  it("aynı set için 2 job — en son enqueue edilen seçilir", async () => {
    const j1 = await queue.add(QUEUE_NAME, { userId: userA, setId: setA });
    // Küçük gecikme: timestamp farkı garantisi
    await new Promise((r) => setTimeout(r, 10));
    const j2 = await queue.add(QUEUE_NAME, { userId: userA, setId: setA });

    const result = await getActiveExport({ userId: userA, setId: setA });
    expect(result).not.toBeNull();
    expect(result!.jobId).toBe(String(j2.id));
    expect(result!.jobId).not.toBe(String(j1.id));
  });
});

// ────────────────────────────────────────────────────────────
// Multiple sets same user — set filter
// ────────────────────────────────────────────────────────────

describe("getActiveExport — multiple sets same user", () => {
  it("setA için yalnız setA job'u dönmeli (setB job'u izole)", async () => {
    const jA = await queue.add(QUEUE_NAME, { userId: userA, setId: setA });
    await queue.add(QUEUE_NAME, { userId: userA, setId: setB });

    const resultA = await getActiveExport({ userId: userA, setId: setA });
    expect(resultA).not.toBeNull();
    expect(resultA!.jobId).toBe(String(jA.id));

    const resultB = await getActiveExport({ userId: userA, setId: setB });
    expect(resultB).not.toBeNull();
    expect(resultB!.jobId).not.toBe(String(jA.id));
  });
});
