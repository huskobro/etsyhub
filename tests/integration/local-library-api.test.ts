import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/server/db";
import { GET as foldersGet } from "@/app/api/local-library/folders/route";
import { GET as assetsGet } from "@/app/api/local-library/assets/route";
import { DELETE as assetDelete } from "@/app/api/local-library/assets/[id]/route";
import { POST as negativePost } from "@/app/api/local-library/assets/[id]/negative/route";
import { POST as urlCheckPost } from "@/app/api/local-library/url-check/route";
import { POST as scanPost } from "@/app/api/local-library/scan/route";

const USER_A = "api-test-a";
const USER_B = "api-test-b";

vi.mock("@/server/session", () => ({ requireUser: vi.fn() }));
vi.mock("@/server/queue", () => ({ enqueue: vi.fn(async () => undefined) }));
vi.mock("node:fs/promises", async (orig) => {
  const actual = await orig<typeof import("node:fs/promises")>();
  return { ...actual, unlink: vi.fn(async () => undefined) };
});
vi.mock("@/features/variation-generation/url-public-check", () => ({
  checkUrlPublic: vi.fn(async () => ({ ok: true, status: 200 })),
}));
vi.mock("@/features/settings/local-library/service", () => ({
  getUserLocalLibrarySettings: vi.fn(),
}));

import { requireUser } from "@/server/session";
import { enqueue } from "@/server/queue";
import { unlink } from "node:fs/promises";
import { checkUrlPublic } from "@/features/variation-generation/url-public-check";
import { getUserLocalLibrarySettings } from "@/features/settings/local-library/service";

beforeEach(async () => {
  await db.localLibraryAsset.deleteMany({
    where: { userId: { in: [USER_A, USER_B] } },
  });
  await db.job.deleteMany({ where: { userId: { in: [USER_A, USER_B] } } });
  await db.user.upsert({
    where: { id: USER_A },
    update: {},
    create: { id: USER_A, email: "a@t.local", passwordHash: "x" },
  });
  await db.user.upsert({
    where: { id: USER_B },
    update: {},
    create: { id: USER_B, email: "b@t.local", passwordHash: "x" },
  });
  (requireUser as any).mockReset();
  (enqueue as any).mockReset();
  (unlink as any).mockReset();
  (unlink as any).mockResolvedValue(undefined);
  (checkUrlPublic as any).mockReset();
  (checkUrlPublic as any).mockResolvedValue({ ok: true, status: 200 });
  (getUserLocalLibrarySettings as any).mockReset();
});

async function makeAsset(
  userId: string,
  overrides?: Partial<{
    folderName: string;
    isNegative: boolean;
    isUserDeleted: boolean;
    hash: string;
  }>,
) {
  return db.localLibraryAsset.create({
    data: {
      userId,
      folderName: overrides?.folderName ?? "f1",
      folderPath: "/p",
      fileName: "x.png",
      filePath: "/p/x.png",
      hash: overrides?.hash ?? `h-${Math.random()}`,
      mimeType: "image/png",
      fileSize: 1,
      width: 1,
      height: 1,
      isNegative: overrides?.isNegative ?? false,
      isUserDeleted: overrides?.isUserDeleted ?? false,
    },
  });
}

describe("POST /api/local-library/assets/[id]/negative — authorization", () => {
  it("user B cannot mark user A's asset (404)", async () => {
    const a = await makeAsset(USER_A);
    (requireUser as any).mockResolvedValue({ id: USER_B });
    const req = new Request(
      `http://localhost/api/local-library/assets/${a.id}/negative`,
      {
        method: "POST",
        body: JSON.stringify({ reason: "yazı var" }),
      },
    );
    const res = await negativePost(req, {
      params: Promise.resolve({ id: a.id }),
    });
    expect(res.status).toBe(404);
  });

  it("user A marks own asset negative (200)", async () => {
    const a = await makeAsset(USER_A);
    (requireUser as any).mockResolvedValue({ id: USER_A });
    const req = new Request(
      `http://localhost/api/local-library/assets/${a.id}/negative`,
      {
        method: "POST",
        body: JSON.stringify({ reason: "yazı var" }),
      },
    );
    const res = await negativePost(req, {
      params: Promise.resolve({ id: a.id }),
    });
    expect(res.status).toBe(200);
    const updated = await db.localLibraryAsset.findUnique({
      where: { id: a.id },
    });
    expect(updated?.isNegative).toBe(true);
    expect(updated?.negativeReason).toBe("yazı var");
  });
});

describe("DELETE /api/local-library/assets/[id]", () => {
  it("user B cannot delete user A's asset (404)", async () => {
    const a = await makeAsset(USER_A);
    (requireUser as any).mockResolvedValue({ id: USER_B });
    const req = new Request(
      `http://localhost/api/local-library/assets/${a.id}`,
      { method: "DELETE" },
    );
    const res = await assetDelete(req, {
      params: Promise.resolve({ id: a.id }),
    });
    expect(res.status).toBe(404);
  });

  it("user A deletes own asset → fs.unlink + dual-flag (R12)", async () => {
    const a = await makeAsset(USER_A);
    (requireUser as any).mockResolvedValue({ id: USER_A });
    const req = new Request(
      `http://localhost/api/local-library/assets/${a.id}`,
      { method: "DELETE" },
    );
    const res = await assetDelete(req, {
      params: Promise.resolve({ id: a.id }),
    });
    expect(res.status).toBe(200);
    expect(unlink).toHaveBeenCalledWith("/p/x.png");
    const updated = await db.localLibraryAsset.findUnique({
      where: { id: a.id },
    });
    expect(updated?.isUserDeleted).toBe(true);
    expect(updated?.deletedAt).not.toBeNull();
  });
});

describe("GET /api/local-library/folders", () => {
  it("returns groupBy with file count, soft-deleted excluded", async () => {
    await makeAsset(USER_A, { folderName: "alpha" });
    await makeAsset(USER_A, { folderName: "alpha" });
    await makeAsset(USER_A, { folderName: "beta", isUserDeleted: true });
    (requireUser as any).mockResolvedValue({ id: USER_A });
    const res = await foldersGet();
    const body = await res.json();
    const alpha = body.folders.find((f: any) => f.name === "alpha");
    expect(alpha?.fileCount).toBe(2);
    expect(body.folders.some((f: any) => f.name === "beta")).toBe(false);
  });

  // Pass 23 — folder card preview strip
  it("coverHashes: ilk 3 asset hash'i + negativeCount", async () => {
    // 4 asset üret. CreatedAt aynı timestamp olabileceği için (test ortamı
    // hızlı), kesin ordering yerine "3 hash döndü, hepsi mevcut asset'lerden"
    // assertion kullan.
    const a1 = await makeAsset(USER_A, { folderName: "gallery" });
    const a2 = await makeAsset(USER_A, { folderName: "gallery" });
    const a3 = await makeAsset(USER_A, { folderName: "gallery" });
    const a4 = await makeAsset(USER_A, { folderName: "gallery" });
    await db.localLibraryAsset.update({
      where: { id: a2.id },
      data: { isNegative: true, negativeReason: "test" },
    });
    (requireUser as any).mockResolvedValue({ id: USER_A });
    const res = await foldersGet();
    const body = await res.json();
    const gallery = body.folders.find((f: any) => f.name === "gallery");
    expect(gallery).toBeTruthy();
    expect(gallery.fileCount).toBe(4);
    expect(gallery.coverHashes).toHaveLength(3);
    const hashes = new Set([a1.hash, a2.hash, a3.hash, a4.hash]);
    for (const h of gallery.coverHashes) {
      expect(hashes.has(h)).toBe(true);
    }
    expect(gallery.negativeCount).toBe(1);
  });

  it("coverHashes: tek asset olan klasörde 1-element array", async () => {
    const single = await makeAsset(USER_A, { folderName: "lonely" });
    (requireUser as any).mockResolvedValue({ id: USER_A });
    const res = await foldersGet();
    const body = await res.json();
    const lonely = body.folders.find((f: any) => f.name === "lonely");
    expect(lonely.coverHashes).toEqual([single.hash]);
    expect(lonely.negativeCount).toBe(0);
  });
});

describe("GET /api/local-library/assets", () => {
  it("?folder=X filters by folderName", async () => {
    await makeAsset(USER_A, { folderName: "alpha" });
    await makeAsset(USER_A, { folderName: "beta" });
    (requireUser as any).mockResolvedValue({ id: USER_A });
    const req = new Request("http://localhost/api/local-library/assets?folder=alpha");
    const res = await assetsGet(req);
    const body = await res.json();
    expect(body.assets).toHaveLength(1);
    expect(body.assets[0].folderName).toBe("alpha");
  });

  it("?negativesOnly=true filters by isNegative", async () => {
    await makeAsset(USER_A, { isNegative: true });
    await makeAsset(USER_A, { isNegative: false });
    (requireUser as any).mockResolvedValue({ id: USER_A });
    const req = new Request(
      "http://localhost/api/local-library/assets?negativesOnly=true",
    );
    const res = await assetsGet(req);
    const body = await res.json();
    expect(body.assets).toHaveLength(1);
    expect(body.assets[0].isNegative).toBe(true);
  });
});

describe("POST /api/local-library/url-check", () => {
  it("delegates to checkUrlPublic and echoes result", async () => {
    (requireUser as any).mockResolvedValue({ id: USER_A });
    (checkUrlPublic as any).mockResolvedValueOnce({
      ok: false,
      status: 403,
      reason: "HEAD 403",
    });
    const req = new Request("http://localhost/api/local-library/url-check", {
      method: "POST",
      body: JSON.stringify({ url: "https://example.com/x.jpg" }),
    });
    const res = await urlCheckPost(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.status).toBe(403);
    expect(checkUrlPublic).toHaveBeenCalledWith("https://example.com/x.jpg");
  });
});

describe("POST /api/local-library/scan", () => {
  it("400 when rootFolderPath not set", async () => {
    (requireUser as any).mockResolvedValue({ id: USER_A });
    (getUserLocalLibrarySettings as any).mockResolvedValue({
      rootFolderPath: null,
      targetResolution: { width: 4000, height: 4000 },
      targetDpi: 300,
    });
    const res = await scanPost();
    expect(res.status).toBe(400);
  });

  it("happy path → Job created + enqueue called with payload", async () => {
    (requireUser as any).mockResolvedValue({ id: USER_A });
    (getUserLocalLibrarySettings as any).mockResolvedValue({
      rootFolderPath: "/Users/x/library",
      targetResolution: { width: 4000, height: 4000 },
      targetDpi: 300,
    });
    const res = await scanPost();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.jobId).toBeDefined();
    const job = await db.job.findUnique({ where: { id: body.jobId } });
    expect(job?.userId).toBe(USER_A);
    expect(job?.status).toBe("QUEUED");
    expect(enqueue).toHaveBeenCalledWith(
      "SCAN_LOCAL_FOLDER",
      expect.objectContaining({
        jobId: body.jobId,
        userId: USER_A,
        rootFolderPath: "/Users/x/library",
        targetResolution: { width: 4000, height: 4000 },
        targetDpi: 300,
      }),
    );
  });
});
