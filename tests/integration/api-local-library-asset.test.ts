// IA-33 — GET /api/local-library/asset (focus mode full-resolution).
//
// Sözleşme:
//   - ?hash=<hash> ile owner asset'inin orijinal/full-resolution dosyasını
//     stream eder. Content-Type asset.mimeType (jpeg/png/webp).
//   - Cross-user / missing hash / filePath null / soft-deleted / active root
//     dışı tüm durumlar için 404 (varlık sızıntısı YOK).
//   - 401 sadece auth fail için.
//
// QueueReviewWorkspace focus stage bu endpoint'i `fullResolutionUrl` ile
// kullanır; grid thumbnail endpoint'i (`/api/local-library/thumbnail`) ile
// karışmamalı.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/server/db";

vi.mock("@/server/session", () => ({ requireUser: vi.fn() }));
vi.mock("node:fs/promises", async (orig) => {
  const actual = await orig<typeof import("node:fs/promises")>();
  return { ...actual, readFile: vi.fn() };
});

import { GET as assetGet } from "@/app/api/local-library/asset/route";
import { requireUser } from "@/server/session";
import { readFile } from "node:fs/promises";

const USER_A = "asset-user-a";
const USER_B = "asset-user-b";

async function ensureUser(userId: string) {
  await db.user.upsert({
    where: { id: userId },
    update: {},
    create: {
      id: userId,
      email: `${userId}@example.test`,
      passwordHash: "test-hash",
      role: "ADMIN" as never,
    },
  });
}

async function makeAsset(
  userId: string,
  overrides?: Partial<{
    hash: string;
    filePath: string | null;
    folderPath: string;
    isUserDeleted: boolean;
    deletedAt: Date | null;
    mimeType: string;
  }>,
) {
  await ensureUser(userId);
  return db.localLibraryAsset.create({
    data: {
      userId,
      folderName: "f",
      folderPath: overrides?.folderPath ?? "/active-root/sub",
      fileName: "x.jpg",
      filePath: overrides?.filePath ?? "/active-root/sub/x.jpg",
      hash: overrides?.hash ?? `h-${Math.random()}`,
      mimeType: overrides?.mimeType ?? "image/jpeg",
      fileSize: 1024,
      width: 4096,
      height: 4096,
      thumbnailPath: "/tmp/thumb.webp",
      isUserDeleted: overrides?.isUserDeleted ?? false,
      deletedAt: overrides?.deletedAt ?? null,
    },
  });
}

async function setActiveRoot(userId: string, rootFolderPath: string) {
  // FK constraint var (UserSetting.userId → User.id). Test User'ı
  // yarat veya zaten varsa idempotent geç.
  await db.user.upsert({
    where: { id: userId },
    update: {},
    create: {
      id: userId,
      email: `${userId}@example.test`,
      passwordHash: "test-hash",
      role: "ADMIN" as never,
    },
  });
  const value = {
    rootFolderPath,
    targetResolution: { width: 4096, height: 4096 },
    targetDpi: 300,
  } as never;
  await db.userSetting.upsert({
    where: { userId_key: { userId, key: "localLibrary" } },
    update: { value },
    create: {
      userId,
      key: "localLibrary",
      value,
    },
  });
}

function buildReq(hash?: string) {
  const url = hash
    ? `http://localhost/api/local-library/asset?hash=${encodeURIComponent(hash)}`
    : `http://localhost/api/local-library/asset`;
  return new Request(url);
}

describe("GET /api/local-library/asset — IA-33 focus full-resolution", () => {
  beforeEach(async () => {
    vi.mocked(requireUser).mockReset();
    vi.mocked(readFile).mockReset();
    // Default — testler explicit ihtiyaç duyana kadar readFile'ı
    // çağırmasın diye reject. Stream success kuran testler explicit
    // mockResolvedValue ile override eder.
    vi.mocked(readFile).mockRejectedValue(new Error("not-mocked"));
    // Test DB clean (best-effort)
    await db.userSetting
      .deleteMany({ where: { userId: { in: [USER_A, USER_B] } } })
      .catch(() => undefined);
    await db.localLibraryAsset
      .deleteMany({ where: { userId: { in: [USER_A, USER_B] } } })
      .catch(() => undefined);
  });

  it("401 auth eksikse", async () => {
    vi.mocked(requireUser).mockRejectedValue(new Error("unauthorized"));
    const res = await assetGet(buildReq("any"));
    expect(res.status).toBe(401);
  });

  it("hash query eksik → 404", async () => {
    vi.mocked(requireUser).mockResolvedValue({ id: USER_A } as never);
    const res = await assetGet(buildReq(undefined));
    expect(res.status).toBe(404);
  });

  it("owner asset → stream + content-type asset.mimeType", async () => {
    vi.mocked(requireUser).mockResolvedValue({ id: USER_A } as never);
    await setActiveRoot(USER_A, "/active-root");
    const a = await makeAsset(USER_A, {
      hash: "owned-1",
      mimeType: "image/jpeg",
    });
    vi.mocked(readFile).mockResolvedValue(Buffer.from([0xff, 0xd8, 0xff]));
    const res = await assetGet(buildReq(a.hash));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/jpeg");
    expect(res.headers.get("Cache-Control")).toContain("private");
  });

  it("cross-user → 404 (varlık sızıntısı YOK)", async () => {
    vi.mocked(requireUser).mockResolvedValue({ id: USER_A } as never);
    await setActiveRoot(USER_A, "/active-root");
    const a = await makeAsset(USER_B, { hash: "other-user" });
    const res = await assetGet(buildReq(a.hash));
    expect(res.status).toBe(404);
    expect(readFile).not.toHaveBeenCalled();
  });

  it("soft-deleted (isUserDeleted) → 404", async () => {
    vi.mocked(requireUser).mockResolvedValue({ id: USER_A } as never);
    await setActiveRoot(USER_A, "/active-root");
    const a = await makeAsset(USER_A, {
      hash: "soft-del",
      isUserDeleted: true,
    });
    const res = await assetGet(buildReq(a.hash));
    expect(res.status).toBe(404);
  });

  it("soft-deleted (deletedAt) → 404", async () => {
    vi.mocked(requireUser).mockResolvedValue({ id: USER_A } as never);
    await setActiveRoot(USER_A, "/active-root");
    const a = await makeAsset(USER_A, {
      hash: "tombstoned",
      deletedAt: new Date(),
    });
    const res = await assetGet(buildReq(a.hash));
    expect(res.status).toBe(404);
  });

  it("active root dışı asset → 404 (CLAUDE.md Madde V)", async () => {
    vi.mocked(requireUser).mockResolvedValue({ id: USER_A } as never);
    // Active root değişti — eski root'taki asset bu endpoint'ten
    // stream edilmemeli.
    await setActiveRoot(USER_A, "/new-active-root");
    const a = await makeAsset(USER_A, {
      hash: "old-root-asset",
      folderPath: "/old-root/sub",
      filePath: "/old-root/sub/x.jpg",
    });
    const res = await assetGet(buildReq(a.hash));
    expect(res.status).toBe(404);
  });

  it("disk read fail → 500 (gerçek hata)", async () => {
    vi.mocked(requireUser).mockResolvedValue({ id: USER_A } as never);
    await setActiveRoot(USER_A, "/active-root");
    const a = await makeAsset(USER_A, { hash: "io-fail" });
    vi.mocked(readFile).mockRejectedValue(new Error("ENOENT"));
    const res = await assetGet(buildReq(a.hash));
    expect(res.status).toBe(500);
  });
});
