// Phase 5 Gap B — GET /api/local-library/thumbnail integration testleri.
//
// Sözleşme:
//   - ?hash=<hash> ile owner asset'inin thumbnail'ini stream eder (Content-Type
//     image/webp; thumbnail.service .webp üretir).
//   - başka user'ın hash'i için 404 (varlık sızıntısı yok)
//   - missing hash → 404
//   - thumbnailPath null → 404 (Local mode UI bu durumda thumb göstermez)
//
// LocalAssetCard (Task 13) bu endpoint'i `<img src=".../thumbnail?hash=...">`
// olarak kullanır.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/server/db";

vi.mock("@/server/session", () => ({ requireUser: vi.fn() }));
vi.mock("node:fs/promises", async (orig) => {
  const actual = await orig<typeof import("node:fs/promises")>();
  return { ...actual, readFile: vi.fn() };
});

import { GET as thumbGet } from "@/app/api/local-library/thumbnail/route";
import { requireUser } from "@/server/session";
import { readFile } from "node:fs/promises";

const USER_A = "thumb-user-a";
const USER_B = "thumb-user-b";

async function makeAsset(
  userId: string,
  overrides?: Partial<{ hash: string; thumbnailPath: string | null }>,
) {
  return db.localLibraryAsset.create({
    data: {
      userId,
      folderName: "f",
      folderPath: "/p",
      fileName: "x.png",
      filePath: "/p/x.png",
      hash: overrides?.hash ?? `h-${Math.random()}`,
      mimeType: "image/png",
      fileSize: 1,
      width: 1,
      height: 1,
      thumbnailPath:
        overrides?.thumbnailPath !== undefined
          ? overrides.thumbnailPath
          : "/tmp/thumb.webp",
    },
  });
}

beforeEach(async () => {
  await db.localLibraryAsset.deleteMany({
    where: { userId: { in: [USER_A, USER_B] } },
  });
  await db.user.upsert({
    where: { id: USER_A },
    update: {},
    create: { id: USER_A, email: "a@thumb.local", passwordHash: "x" },
  });
  await db.user.upsert({
    where: { id: USER_B },
    update: {},
    create: { id: USER_B, email: "b@thumb.local", passwordHash: "x" },
  });
  (requireUser as ReturnType<typeof vi.fn>).mockReset();
  (readFile as ReturnType<typeof vi.fn>).mockReset();
});

describe("GET /api/local-library/thumbnail", () => {
  it("owner + thumbnailPath set → 200 image/webp", async () => {
    const a = await makeAsset(USER_A, { hash: "thumb-hash-1" });
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: USER_A });
    (readFile as ReturnType<typeof vi.fn>).mockResolvedValue(
      Buffer.from("fake-webp"),
    );
    const res = await thumbGet(
      new Request(`http://localhost/api/local-library/thumbnail?hash=${a.hash}`),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/image\//);
  });

  it("başka user → 404", async () => {
    const a = await makeAsset(USER_A, { hash: "thumb-hash-cross" });
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: USER_B });
    const res = await thumbGet(
      new Request(`http://localhost/api/local-library/thumbnail?hash=${a.hash}`),
    );
    expect(res.status).toBe(404);
  });

  it("missing hash query → 404", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: USER_A });
    const res = await thumbGet(
      new Request("http://localhost/api/local-library/thumbnail"),
    );
    expect(res.status).toBe(404);
  });

  it("thumbnailPath null → 404", async () => {
    const a = await makeAsset(USER_A, {
      hash: "thumb-hash-null-path",
      thumbnailPath: null,
    });
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: USER_A });
    const res = await thumbGet(
      new Request(`http://localhost/api/local-library/thumbnail?hash=${a.hash}`),
    );
    expect(res.status).toBe(404);
  });
});
