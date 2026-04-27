import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { db } from "@/server/db";
import { handleScanLocalFolder } from "@/server/workers/scan-local-folder.worker";
import type { Job } from "bullmq";

const USER_ID = "scan-test-user";
let root: string;

// Her çağrı farklı bytes üretmeli; aksi halde sharp deterministic =>
// aynı hash => upsert dedupe ile testler yanlış sayıda satır gösterir.
let mkPngCounter = 0;
async function mkPng(p: string) {
  mkPngCounter += 1;
  const tone = (mkPngCounter * 23) % 256;
  const buf = await sharp({
    create: {
      width: 1000,
      height: 1000,
      channels: 3,
      background: { r: tone, g: 255 - tone, b: (tone * 2) % 256 },
    },
  })
    .withMetadata({ density: 300 })
    .png()
    .toBuffer();
  writeFileSync(p, buf);
}

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), "scan-test-"));
  await db.localLibraryAsset.deleteMany({ where: { userId: USER_ID } });
  await db.job.deleteMany({ where: { userId: USER_ID } });
  await db.user.upsert({
    where: { id: USER_ID },
    update: {},
    create: { id: USER_ID, email: "scan@test.local", passwordHash: "x" },
  });
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function fakeJob(jobId: string, data: Record<string, unknown>): Job {
  return { id: jobId, data } as unknown as Job;
}

describe("SCAN_LOCAL_FOLDER worker", () => {
  it("indexes root + first-level folder assets with metadata + thumbnail", async () => {
    mkdirSync(join(root, "horse Q10"));
    await mkPng(join(root, "a.png"));
    await mkPng(join(root, "horse Q10", "h1.png"));

    const job = fakeJob("scan-job-1", {
      jobId: "scan-job-1",
      userId: USER_ID,
      rootFolderPath: root,
      targetResolution: { width: 4000, height: 4000 },
      targetDpi: 300,
    });
    await db.job.create({
      data: { id: "scan-job-1", type: "SCAN_LOCAL_FOLDER", status: "QUEUED", userId: USER_ID, metadata: {}, progress: 0 },
    });

    await handleScanLocalFolder(job);

    const assets = await db.localLibraryAsset.findMany({ where: { userId: USER_ID } });
    expect(assets).toHaveLength(2);
    const folderNames = assets.map((a) => a.folderName).sort();
    expect(folderNames).toEqual(["horse Q10", "root"]);
    for (const a of assets) {
      expect(a.hash).toMatch(/^[a-f0-9]{64}$/);
      expect(a.qualityScore).toBeGreaterThan(0);
      expect(a.thumbnailPath).toBeTruthy();
    }
    const final = await db.job.findUnique({ where: { id: "scan-job-1" } });
    expect(final?.status).toBe("SUCCESS");
    expect(final?.progress).toBe(100);
  });

  it("upsert by (userId, hash) — same file twice → single row", async () => {
    await mkPng(join(root, "a.png"));
    const job = fakeJob("scan-job-2", {
      jobId: "scan-job-2",
      userId: USER_ID,
      rootFolderPath: root,
      targetResolution: { width: 4000, height: 4000 },
      targetDpi: 300,
    });
    await db.job.create({
      data: { id: "scan-job-2", type: "SCAN_LOCAL_FOLDER", status: "QUEUED", userId: USER_ID, metadata: {}, progress: 0 },
    });
    await handleScanLocalFolder(job);

    // İkinci tur için yeni job (her tur kendi job satırını günceller)
    await db.job.create({
      data: { id: "scan-job-2b", type: "SCAN_LOCAL_FOLDER", status: "QUEUED", userId: USER_ID, metadata: {}, progress: 0 },
    });
    const job2 = fakeJob("scan-job-2b", {
      jobId: "scan-job-2b",
      userId: USER_ID,
      rootFolderPath: root,
      targetResolution: { width: 4000, height: 4000 },
      targetDpi: 300,
    });
    await handleScanLocalFolder(job2);

    const assets = await db.localLibraryAsset.findMany({ where: { userId: USER_ID } });
    expect(assets).toHaveLength(1);
  });

  it("bozuk PNG file → asset DB'ye yazılmaz, batch devam, job SUCCESS, metadata.skippedFiles populated", async () => {
    await mkPng(join(root, "good.png"));
    // Bozuk: sharp metadata bunu okurken throw eder
    writeFileSync(join(root, "broken.png"), Buffer.from("not-a-real-png"));

    const job = fakeJob("scan-job-3", {
      jobId: "scan-job-3",
      userId: USER_ID,
      rootFolderPath: root,
      targetResolution: { width: 4000, height: 4000 },
      targetDpi: 300,
    });
    await db.job.create({
      data: { id: "scan-job-3", type: "SCAN_LOCAL_FOLDER", status: "QUEUED", userId: USER_ID, metadata: {}, progress: 0 },
    });

    await handleScanLocalFolder(job);

    const assets = await db.localLibraryAsset.findMany({ where: { userId: USER_ID } });
    expect(assets).toHaveLength(1);
    expect(assets[0]!.fileName).toBe("good.png");

    const final = await db.job.findUnique({ where: { id: "scan-job-3" } });
    expect(final?.status).toBe("SUCCESS");
    expect(final?.progress).toBe(100);
    const meta = final?.metadata as { skippedFiles?: { fileName: string; reason: string }[] };
    expect(meta?.skippedFiles).toBeDefined();
    expect(meta!.skippedFiles!.length).toBe(1);
    expect(meta!.skippedFiles![0]!.fileName).toBe("broken.png");
    expect(typeof meta!.skippedFiles![0]!.reason).toBe("string");
  });

  it("non-existent rootFolderPath → Job FAILED + error mesajı", async () => {
    const ghost = join(tmpdir(), "etsyhub-nonexistent-" + Date.now());
    const job = fakeJob("scan-job-4", {
      jobId: "scan-job-4",
      userId: USER_ID,
      rootFolderPath: ghost,
      targetResolution: { width: 4000, height: 4000 },
      targetDpi: 300,
    });
    await db.job.create({
      data: { id: "scan-job-4", type: "SCAN_LOCAL_FOLDER", status: "QUEUED", userId: USER_ID, metadata: {}, progress: 0 },
    });

    await expect(handleScanLocalFolder(job)).rejects.toThrow();

    const final = await db.job.findUnique({ where: { id: "scan-job-4" } });
    expect(final?.status).toBe("FAILED");
    expect(final?.error).toBeTruthy();
    expect(final?.finishedAt).toBeTruthy();
  });

  it("progress sayacı bozuk dosya atlandığında yine ilerler", async () => {
    await mkPng(join(root, "ok1.png"));
    writeFileSync(join(root, "broken.png"), Buffer.from("xxx"));
    await mkPng(join(root, "ok2.png"));

    const job = fakeJob("scan-job-5", {
      jobId: "scan-job-5",
      userId: USER_ID,
      rootFolderPath: root,
      targetResolution: { width: 4000, height: 4000 },
      targetDpi: 300,
    });
    await db.job.create({
      data: { id: "scan-job-5", type: "SCAN_LOCAL_FOLDER", status: "QUEUED", userId: USER_ID, metadata: {}, progress: 0 },
    });
    await handleScanLocalFolder(job);

    const final = await db.job.findUnique({ where: { id: "scan-job-5" } });
    expect(final?.progress).toBe(100);
    const assets = await db.localLibraryAsset.findMany({ where: { userId: USER_ID } });
    expect(assets).toHaveLength(2); // ok1 + ok2; broken atlandı
  });
});
