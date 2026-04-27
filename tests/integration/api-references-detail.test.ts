// Phase 5 Gap A — GET /api/references/[id] integration testleri.
//
// Sözleşme:
//   - owner → 200 + reference + asset + productType payload
//   - başka user → 404 (varlık sızıntısı yok; cross-user asla 200/403 dönmez)
//   - not found → 404
//
// AI mode (Task 14) UI bu endpoint'i kullanarak `reference.asset.sourceUrl` ve
// `reference.productType.key` okur — payload shape'i bu sözleşmeye sıkı bağlı.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/server/db";

vi.mock("@/server/session", () => ({ requireUser: vi.fn() }));

import { GET as referenceGet } from "@/app/api/references/[id]/route";
import { requireUser } from "@/server/session";

const USER_A = "ref-detail-a";
const USER_B = "ref-detail-b";

async function setupFixtures() {
  await db.user.upsert({
    where: { id: USER_A },
    update: {},
    create: { id: USER_A, email: "a@refdetail.local", passwordHash: "x" },
  });
  await db.user.upsert({
    where: { id: USER_B },
    update: {},
    create: { id: USER_B, email: "b@refdetail.local", passwordHash: "x" },
  });

  const pt = await db.productType.upsert({
    where: { key: "ref-detail-wall-art" },
    update: {},
    create: {
      key: "ref-detail-wall-art",
      displayName: "Wall Art (RefDetail test)",
      isSystem: false,
    },
  });

  const asset = await db.asset.upsert({
    where: { id: "ref-detail-asset-1" },
    update: {},
    create: {
      id: "ref-detail-asset-1",
      userId: USER_A,
      storageProvider: "remote",
      storageKey: "ref-detail/a.png",
      bucket: "test",
      mimeType: "image/png",
      sizeBytes: 1,
      hash: "ref-detail-hash",
      sourceUrl: "https://example.com/x.jpg",
    },
  });

  const ref = await db.reference.upsert({
    where: { id: "ref-detail-ref-1" },
    update: {},
    create: {
      id: "ref-detail-ref-1",
      userId: USER_A,
      assetId: asset.id,
      productTypeId: pt.id,
    },
  });

  return { ref, asset, pt };
}

beforeEach(async () => {
  (requireUser as ReturnType<typeof vi.fn>).mockReset();
});

describe("GET /api/references/[id]", () => {
  it("owner → 200 + reference + asset + productType payload", async () => {
    const { ref } = await setupFixtures();
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: USER_A });
    const res = await referenceGet(
      new Request(`http://localhost/api/references/${ref.id}`),
      { params: { id: ref.id } },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reference).toBeDefined();
    expect(body.reference.id).toBe(ref.id);
    expect(body.reference.asset).toBeDefined();
    expect(body.reference.asset.sourceUrl).toBe("https://example.com/x.jpg");
    expect(body.reference.productType).toBeDefined();
    expect(body.reference.productType.key).toBe("ref-detail-wall-art");
  });

  it("başka user → 404", async () => {
    const { ref } = await setupFixtures();
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: USER_B });
    const res = await referenceGet(
      new Request(`http://localhost/api/references/${ref.id}`),
      { params: { id: ref.id } },
    );
    expect(res.status).toBe(404);
  });

  it("not found → 404", async () => {
    await setupFixtures();
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: USER_A });
    const res = await referenceGet(
      new Request("http://localhost/api/references/does-not-exist"),
      { params: { id: "does-not-exist" } },
    );
    expect(res.status).toBe(404);
  });
});
