// Phase 5 §4 — variation-jobs API integration testleri (Task 12).
//
// Kapsam:
//   - POST /api/variation-jobs        → createN: N design + N job + enqueue×N
//   - GET  /api/variation-jobs?refId  → user-scoped list
//   - POST /api/variation-jobs/:id/retry → fresh design + new job (R15)
//
// Sözleşmeler doğrulanan testler:
//   - R17.1 capability mismatch → 400 explicit reject (sessiz fallback YOK)
//   - R17.2 local kaynaklı reference (imageUrl null) → 400
//   - R17.4 count clamp (1..6) + sessiz default fallback YOK (aspectRatio retry'da null → 500)
//   - R15  retry yeni design yaratır; eski FAIL row dokunulmaz; snapshot birebir kopya
//   - Q5   public URL doğrulanamadı → 400 with reason
//   - Data isolation: başka user → 404
import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/server/db";
import {
  JobStatus,
  JobType,
  VariationCapability,
  VariationState,
} from "@prisma/client";

const USER_A = "vj-user-a";
const USER_B = "vj-user-b";
const REF_I2I = "vj-ref-i2i"; // imageUrl set + public
const REF_T2I = "vj-ref-t2i"; // imageUrl null (local kaynaklı)

// Mock'lar import'lardan ÖNCE — module evaluation sırasında etkili.
vi.mock("@/server/session", () => ({ requireUser: vi.fn() }));
vi.mock("@/server/queue", () => ({ enqueue: vi.fn(async () => undefined) }));
vi.mock("@/features/variation-generation/url-public-check", () => ({
  checkUrlPublic: vi.fn(async () => ({ ok: true, status: 200 })),
}));

import { POST as createPost, GET as listGet } from "@/app/api/variation-jobs/route";
import { POST as retryPost } from "@/app/api/variation-jobs/[id]/retry/route";
import { requireUser } from "@/server/session";
import { enqueue } from "@/server/queue";
import { checkUrlPublic } from "@/features/variation-generation/url-public-check";

// Asset zorunlu alanları (schema): storageProvider, storageKey, bucket,
// mimeType, sizeBytes, hash. Reference: assetId + productTypeId zorunlu.
async function setupFixtures() {
  await db.user.upsert({
    where: { id: USER_A },
    update: {},
    create: { id: USER_A, email: "a@vj.local", passwordHash: "x" },
  });
  await db.user.upsert({
    where: { id: USER_B },
    update: {},
    create: { id: USER_B, email: "b@vj.local", passwordHash: "x" },
  });

  const pt = await db.productType.upsert({
    where: { key: "vj-wall-art" },
    update: {},
    create: {
      key: "vj-wall-art",
      displayName: "Wall Art (VJ test)",
      isSystem: false,
    },
  });
  const asset = await db.asset.upsert({
    where: { id: "vj-asset-1" },
    update: {},
    create: {
      id: "vj-asset-1",
      userId: USER_A,
      storageProvider: "local",
      storageKey: "vj-test/a.png",
      bucket: "test",
      mimeType: "image/png",
      sizeBytes: 1,
      hash: "vj-asset-1-hash",
    },
  });

  await db.reference.upsert({
    where: { id: REF_I2I },
    update: {},
    create: {
      id: REF_I2I,
      userId: USER_A,
      assetId: asset.id,
      productTypeId: pt.id,
    },
  });
  await db.reference.upsert({
    where: { id: REF_T2I },
    update: {},
    create: {
      id: REF_T2I,
      userId: USER_A,
      assetId: asset.id,
      productTypeId: pt.id,
    },
  });

  // Reference modelinde imageUrl yok — bu schema'da Reference, Asset üzerinden
  // sourceUrl tutar. Test sözleşmesi gereği "imageUrl" Asset.sourceUrl'ye eşlenir.
  // İki ref aynı asset'i paylaşıyor; testte fork edilecek davranış:
  //   - REF_I2I: route Asset.sourceUrl'i public görür
  //   - REF_T2I: route Asset.sourceUrl null gibi davranır
  // Bunun için iki ayrı asset gerekir.
  const assetWithUrl = await db.asset.upsert({
    where: { id: "vj-asset-with-url" },
    update: {},
    create: {
      id: "vj-asset-with-url",
      userId: USER_A,
      storageProvider: "remote",
      storageKey: "vj-test/i2i.png",
      bucket: "test",
      mimeType: "image/png",
      sizeBytes: 1,
      hash: "vj-asset-i2i-hash",
      sourceUrl: "https://example.com/r.jpg",
    },
  });
  const assetNoUrl = await db.asset.upsert({
    where: { id: "vj-asset-no-url" },
    update: {},
    create: {
      id: "vj-asset-no-url",
      userId: USER_A,
      storageProvider: "local",
      storageKey: "vj-test/t2i.png",
      bucket: "test",
      mimeType: "image/png",
      sizeBytes: 1,
      hash: "vj-asset-t2i-hash",
      // sourceUrl: null — local kaynaklı (R17.2 reddedilmeli)
    },
  });

  await db.reference.update({
    where: { id: REF_I2I },
    data: { assetId: assetWithUrl.id },
  });
  await db.reference.update({
    where: { id: REF_T2I },
    data: { assetId: assetNoUrl.id },
  });

  return { ptId: pt.id, assetWithUrlId: assetWithUrl.id, assetNoUrlId: assetNoUrl.id };
}

beforeEach(async () => {
  // FK sırasını koru: design → job; reference → design; asset → reference.
  await db.generatedDesign.deleteMany({
    where: { userId: { in: [USER_A, USER_B] } },
  });
  await db.job.deleteMany({ where: { userId: { in: [USER_A, USER_B] } } });
  (requireUser as any).mockReset();
  (enqueue as any).mockReset();
  (enqueue as any).mockResolvedValue(undefined);
  (checkUrlPublic as any).mockReset();
  (checkUrlPublic as any).mockResolvedValue({ ok: true, status: 200 });
});

describe("POST /api/variation-jobs — createN", () => {
  it("3 design + 3 job + enqueue×3 + snapshot fields populated", async () => {
    await setupFixtures();
    (requireUser as any).mockResolvedValue({ id: USER_A });
    const req = new Request("http://localhost/api/variation-jobs", {
      method: "POST",
      body: JSON.stringify({
        referenceId: REF_I2I,
        providerId: "kie-gpt-image-1.5",
        aspectRatio: "2:3",
        quality: "medium",
        brief: "soft",
        count: 3,
      }),
    });
    const res = await createPost(req);
    expect(res.status).toBe(200);
    const designs = await db.generatedDesign.findMany({
      where: { userId: USER_A, referenceId: REF_I2I },
    });
    expect(designs).toHaveLength(3);
    expect(enqueue).toHaveBeenCalledTimes(3);
    for (const d of designs) {
      expect(d.state).toBe(VariationState.QUEUED);
      expect(d.providerId).toBe("kie-gpt-image-1.5");
      expect(d.capabilityUsed).toBe(VariationCapability.IMAGE_TO_IMAGE);
      expect(d.aspectRatio).toBe("2:3");
      expect(d.quality).toBe("medium");
      expect(d.briefSnapshot).toBe("soft");
      expect(d.promptSnapshot).toBeTruthy();
      // R19 — negative library prompt'a enjekte edildi
      expect(d.promptSnapshot).toContain("Avoid:");
    }
  });

  it("count=7 → 400 (R17.4 max 6)", async () => {
    await setupFixtures();
    (requireUser as any).mockResolvedValue({ id: USER_A });
    const req = new Request("http://localhost/api/variation-jobs", {
      method: "POST",
      body: JSON.stringify({
        referenceId: REF_I2I,
        providerId: "kie-gpt-image-1.5",
        aspectRatio: "1:1",
        count: 7,
      }),
    });
    const res = await createPost(req);
    expect(res.status).toBe(400);
  });

  it("count=0 → 400 (R17.4 min 1)", async () => {
    await setupFixtures();
    (requireUser as any).mockResolvedValue({ id: USER_A });
    const req = new Request("http://localhost/api/variation-jobs", {
      method: "POST",
      body: JSON.stringify({
        referenceId: REF_I2I,
        providerId: "kie-gpt-image-1.5",
        aspectRatio: "1:1",
        count: 0,
      }),
    });
    expect((await createPost(req)).status).toBe(400);
  });

  it("reference imageUrl null + i2i provider → 400 (R17.2 local→AI bridge YOK)", async () => {
    await setupFixtures();
    (requireUser as any).mockResolvedValue({ id: USER_A });
    const req = new Request("http://localhost/api/variation-jobs", {
      method: "POST",
      body: JSON.stringify({
        referenceId: REF_T2I,
        providerId: "kie-gpt-image-1.5",
        aspectRatio: "1:1",
        count: 3,
      }),
    });
    const res = await createPost(req);
    expect(res.status).toBe(400);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("provider capability mismatch → 400 (R17.1 explicit reject; sessiz fallback yok)", async () => {
    // Public URL var → route i2i seçer; kie-z-image yalnız t2i destekliyor.
    // Sessiz fallback olsa "t2i'a düş" derdi; biz 400 atıp enqueue ENGELLİYORUZ.
    await setupFixtures();
    (requireUser as any).mockResolvedValue({ id: USER_A });
    const req = new Request("http://localhost/api/variation-jobs", {
      method: "POST",
      body: JSON.stringify({
        referenceId: REF_I2I,
        providerId: "kie-z-image",
        aspectRatio: "1:1",
        count: 3,
      }),
    });
    const res = await createPost(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/capability|fallback/i);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("URL public check fail → 400 with reason (Q5)", async () => {
    await setupFixtures();
    (checkUrlPublic as any).mockResolvedValueOnce({
      ok: false,
      status: 403,
      reason: "HEAD 403",
    });
    (requireUser as any).mockResolvedValue({ id: USER_A });
    const req = new Request("http://localhost/api/variation-jobs", {
      method: "POST",
      body: JSON.stringify({
        referenceId: REF_I2I,
        providerId: "kie-gpt-image-1.5",
        aspectRatio: "1:1",
        count: 3,
      }),
    });
    const res = await createPost(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/public/i);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("reference başka user → 404", async () => {
    await setupFixtures();
    (requireUser as any).mockResolvedValue({ id: USER_B });
    const req = new Request("http://localhost/api/variation-jobs", {
      method: "POST",
      body: JSON.stringify({
        referenceId: REF_I2I,
        providerId: "kie-gpt-image-1.5",
        aspectRatio: "1:1",
        count: 3,
      }),
    });
    expect((await createPost(req)).status).toBe(404);
  });

  it("unknown provider → 400 (registry throws Unknown image provider)", async () => {
    await setupFixtures();
    (requireUser as any).mockResolvedValue({ id: USER_A });
    const req = new Request("http://localhost/api/variation-jobs", {
      method: "POST",
      body: JSON.stringify({
        referenceId: REF_I2I,
        providerId: "non-existent",
        aspectRatio: "1:1",
        count: 3,
      }),
    });
    const res = await createPost(req);
    expect([400, 404]).toContain(res.status);
  });
});

describe("GET /api/variation-jobs?referenceId=X", () => {
  it("returns user's designs only (createdAt desc)", async () => {
    const { ptId, assetWithUrlId } = await setupFixtures();
    await db.generatedDesign.create({
      data: {
        userId: USER_A,
        referenceId: REF_I2I,
        assetId: assetWithUrlId,
        productTypeId: ptId,
        providerId: "kie-gpt-image-1.5",
        capabilityUsed: VariationCapability.IMAGE_TO_IMAGE,
        promptSnapshot: "p",
        state: VariationState.QUEUED,
        aspectRatio: "1:1",
      },
    });
    (requireUser as any).mockResolvedValue({ id: USER_A });
    const req = new Request(
      `http://localhost/api/variation-jobs?referenceId=${REF_I2I}`,
    );
    const res = await listGet(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.designs).toHaveLength(1);
  });

  it("user B sees empty array for user A's reference (no leakage)", async () => {
    const { ptId, assetWithUrlId } = await setupFixtures();
    await db.generatedDesign.create({
      data: {
        userId: USER_A,
        referenceId: REF_I2I,
        assetId: assetWithUrlId,
        productTypeId: ptId,
        providerId: "kie-gpt-image-1.5",
        capabilityUsed: VariationCapability.IMAGE_TO_IMAGE,
        promptSnapshot: "p",
        state: VariationState.QUEUED,
        aspectRatio: "1:1",
      },
    });
    (requireUser as any).mockResolvedValue({ id: USER_B });
    const req = new Request(
      `http://localhost/api/variation-jobs?referenceId=${REF_I2I}`,
    );
    const res = await listGet(req);
    const body = await res.json();
    expect(body.designs).toHaveLength(0);
  });

  it("missing referenceId → 400", async () => {
    await setupFixtures();
    (requireUser as any).mockResolvedValue({ id: USER_A });
    const req = new Request("http://localhost/api/variation-jobs");
    expect((await listGet(req)).status).toBe(400);
  });
});

describe("POST /api/variation-jobs/[id]/retry", () => {
  async function makeFailedDesign(ptId: string, assetId: string) {
    return db.generatedDesign.create({
      data: {
        userId: USER_A,
        referenceId: REF_I2I,
        assetId,
        productTypeId: ptId,
        providerId: "kie-gpt-image-1.5",
        capabilityUsed: VariationCapability.IMAGE_TO_IMAGE,
        promptSnapshot: "old prompt with Avoid: ...",
        briefSnapshot: "old brief",
        state: VariationState.FAIL,
        errorMessage: "previous fail",
        aspectRatio: "16:9",
        quality: "high",
      },
    });
  }

  it("FAIL design → fresh design + new job + retryOf metadata + birebir alanlar kopyalanır", async () => {
    const { ptId, assetWithUrlId } = await setupFixtures();
    const failed = await makeFailedDesign(ptId, assetWithUrlId);
    (requireUser as any).mockResolvedValue({ id: USER_A });

    const res = await retryPost(new Request("http://localhost/", { method: "POST" }), {
      params: { id: failed.id },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.designId).toBeDefined();
    expect(body.designId).not.toBe(failed.id);

    // Eski FAIL row dokunulmadı (R15 audit)
    const oldRow = await db.generatedDesign.findUnique({
      where: { id: failed.id },
    });
    expect(oldRow?.state).toBe(VariationState.FAIL);
    expect(oldRow?.errorMessage).toBe("previous fail");

    // Yeni row birebir snapshot kopyası
    const fresh = await db.generatedDesign.findUnique({
      where: { id: body.designId },
    });
    expect(fresh?.state).toBe(VariationState.QUEUED);
    expect(fresh?.providerId).toBe("kie-gpt-image-1.5");
    expect(fresh?.capabilityUsed).toBe(VariationCapability.IMAGE_TO_IMAGE);
    expect(fresh?.promptSnapshot).toBe("old prompt with Avoid: ...");
    expect(fresh?.briefSnapshot).toBe("old brief");
    expect(fresh?.aspectRatio).toBe("16:9");
    expect(fresh?.quality).toBe("high");
    expect(fresh?.providerTaskId).toBeNull();
    expect(fresh?.resultUrl).toBeNull();
    expect(fresh?.errorMessage).toBeNull();

    // Yeni job + enqueue
    expect(enqueue).toHaveBeenCalledTimes(1);
    const enqueueCall = (enqueue as any).mock.calls[0];
    expect(enqueueCall[0]).toBe(JobType.GENERATE_VARIATIONS);
    expect(enqueueCall[1].designId).toBe(body.designId);
    expect(enqueueCall[1].aspectRatio).toBe("16:9");
    expect(enqueueCall[1].quality).toBe("high");

    const newJob = await db.job.findFirst({
      where: {
        userId: USER_A,
        type: JobType.GENERATE_VARIATIONS,
        status: JobStatus.QUEUED,
      },
    });
    expect(newJob).toBeTruthy();
    expect((newJob?.metadata as any).retryOf).toBe(failed.id);
    expect((newJob?.metadata as any).designId).toBe(body.designId);
  });

  it("SUCCESS design → 404 (yalnız FAIL retry'lanır)", async () => {
    const { ptId, assetWithUrlId } = await setupFixtures();
    const success = await db.generatedDesign.create({
      data: {
        userId: USER_A,
        referenceId: REF_I2I,
        assetId: assetWithUrlId,
        productTypeId: ptId,
        providerId: "kie-gpt-image-1.5",
        capabilityUsed: VariationCapability.IMAGE_TO_IMAGE,
        promptSnapshot: "p",
        state: VariationState.SUCCESS,
        aspectRatio: "1:1",
      },
    });
    (requireUser as any).mockResolvedValue({ id: USER_A });
    const res = await retryPost(new Request("http://localhost/", { method: "POST" }), {
      params: { id: success.id },
    });
    expect(res.status).toBe(404);
  });

  it("başka user'ın design'i → 404", async () => {
    const { ptId, assetWithUrlId } = await setupFixtures();
    const failed = await makeFailedDesign(ptId, assetWithUrlId);
    (requireUser as any).mockResolvedValue({ id: USER_B });
    const res = await retryPost(new Request("http://localhost/", { method: "POST" }), {
      params: { id: failed.id },
    });
    expect(res.status).toBe(404);
  });

  it("aspectRatio null olan eski FAIL row → 500 fail-fast (sessiz default fallback yok)", async () => {
    const { ptId, assetWithUrlId } = await setupFixtures();
    const oldFailed = await db.generatedDesign.create({
      data: {
        userId: USER_A,
        referenceId: REF_I2I,
        assetId: assetWithUrlId,
        productTypeId: ptId,
        providerId: "kie-gpt-image-1.5",
        capabilityUsed: VariationCapability.IMAGE_TO_IMAGE,
        promptSnapshot: "p",
        state: VariationState.FAIL,
        // aspectRatio: NULL — Phase 5 öncesi row simulation
      },
    });
    (requireUser as any).mockResolvedValue({ id: USER_A });
    const res = await retryPost(new Request("http://localhost/", { method: "POST" }), {
      params: { id: oldFailed.id },
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/aspectRatio|missing/i);
    expect(enqueue).not.toHaveBeenCalled();
  });
});
