// Phase 6 Task 11 — POST + PATCH /api/review/decisions integration testleri.
//
// USER karar API'si — "Approve anyway" UX kontratının kod düzeyinde doğrulaması.
//
// Sözleşme:
//   - Auth: requireUser mock'lanır.
//   - POST body Zod: { scope: "design"|"local", id: cuid, decision: APPROVED|REJECTED }
//     - decision PENDING ya da NEEDS_REVIEW gelirse 400 (USER bu state'leri yazamaz).
//   - PATCH body Zod (discriminated union):
//     - scope=design: { scope, id }
//     - scope=local: { scope, id, productTypeKey: string min(1) } — productTypeKey ZORUNLU
//   - Ownership: tek findFirst (id + userId + soft-delete filter); dönmediyse 404
//     (Karar 1: 403 değil 404 — varlık sızıntısı yok).
//   - PATCH response shape (Karar 2):
//     - reset: true (her zaman, state commit oldu)
//     - rerunEnqueued: boolean (enqueue try/catch sonucu)
//     - rerunError?: string (sadece rerunEnqueued=false ise)
//
// Sticky kontratı (R12): POST yazımı USER damgasını koyar; worker'ın
// race-safe `updateMany WHERE not USER` guard'ı SYSTEM yazısını engeller.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { JobType, ReviewStatus, ReviewStatusSource } from "@prisma/client";
import { db } from "@/server/db";

vi.mock("@/server/session", () => ({ requireUser: vi.fn() }));

const enqueueMock = vi.fn();
vi.mock("@/server/queue", async () => {
  const actual = await vi.importActual<typeof import("@/server/queue")>(
    "@/server/queue",
  );
  return {
    ...actual,
    enqueue: (...args: unknown[]) => enqueueMock(...args),
  };
});

import { POST, PATCH } from "@/app/api/review/decisions/route";
import { requireUser } from "@/server/session";

const USER_A = "rev-dec-user-a";
const USER_B = "rev-dec-user-b";

function makeRequest(method: "POST" | "PATCH", body: unknown): Request {
  return new Request("http://localhost/api/review/decisions", {
    method,
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

async function ensureUser(id: string, email: string) {
  await db.user.upsert({
    where: { id },
    update: {},
    create: { id, email, passwordHash: "x" },
  });
}

async function ensureProductType(key: string) {
  return db.productType.upsert({
    where: { key },
    update: {},
    create: { key, displayName: key, isSystem: false },
  });
}

type DesignFixture = {
  designId: string;
  productTypeKey: string;
};

async function createDesignFixture(userId: string): Promise<DesignFixture> {
  const productTypeKey = "rev-dec-canvas";
  const productType = await ensureProductType(productTypeKey);

  const uniq = `${Date.now()}-${Math.random()}`;
  const refAsset = await db.asset.create({
    data: {
      userId,
      storageProvider: "local",
      storageKey: `rev-dec/ref-${uniq}`,
      bucket: "test",
      mimeType: "image/png",
      sizeBytes: 1,
      hash: `rev-dec-ref-${uniq}`,
    },
  });
  const designAsset = await db.asset.create({
    data: {
      userId,
      storageProvider: "local",
      storageKey: `rev-dec/asset-${uniq}`,
      bucket: "test",
      mimeType: "image/png",
      sizeBytes: 1,
      hash: `rev-dec-asset-${uniq}`,
    },
  });
  const reference = await db.reference.create({
    data: { userId, assetId: refAsset.id, productTypeId: productType.id },
  });
  const design = await db.generatedDesign.create({
    data: {
      userId,
      referenceId: reference.id,
      assetId: designAsset.id,
      productTypeId: productType.id,
    },
  });
  return { designId: design.id, productTypeKey };
}

async function createLocalAssetFixture(userId: string): Promise<{ assetId: string }> {
  const uniq = `${Date.now()}-${Math.random()}`;
  const asset = await db.localLibraryAsset.create({
    data: {
      userId,
      folderName: "f",
      folderPath: "/p",
      fileName: `f-${uniq}.png`,
      filePath: `/p/f-${uniq}.png`,
      hash: `rev-dec-${uniq}`,
      mimeType: "image/png",
      fileSize: 1,
      width: 1,
      height: 1,
    },
  });
  return { assetId: asset.id };
}

beforeEach(async () => {
  enqueueMock.mockReset();
  enqueueMock.mockResolvedValue({ id: "fake-job-id" });
  (requireUser as ReturnType<typeof vi.fn>).mockReset();

  // Bağımlılık sırası: designReview -> generatedDesign -> reference -> asset
  await db.designReview.deleteMany({
    where: { generatedDesign: { userId: { in: [USER_A, USER_B] } } },
  });
  await db.generatedDesign.deleteMany({
    where: { userId: { in: [USER_A, USER_B] } },
  });
  await db.reference.deleteMany({
    where: { userId: { in: [USER_A, USER_B] } },
  });
  await db.asset.deleteMany({
    where: { userId: { in: [USER_A, USER_B] } },
  });
  await db.localLibraryAsset.deleteMany({
    where: { userId: { in: [USER_A, USER_B] } },
  });

  await ensureUser(USER_A, "rev-dec-a@test.local");
  await ensureUser(USER_B, "rev-dec-b@test.local");
});

// =============================================================================
// POST /api/review/decisions — USER override
// =============================================================================

describe("POST /api/review/decisions — USER override", () => {
  it("design + APPROVED happy: status APPROVED + source USER + SYSTEM alanları KORUNUR", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: USER_A });
    const { designId } = await createDesignFixture(USER_A);

    // Önce SYSTEM bir review yazsın (score, summary, snapshot dolu)
    await db.generatedDesign.update({
      where: { id: designId },
      data: {
        reviewStatus: ReviewStatus.NEEDS_REVIEW,
        reviewStatusSource: ReviewStatusSource.SYSTEM,
        reviewScore: 70,
        reviewSummary: "watermark detected",
        reviewProviderSnapshot: "gemini-2-5-flash@2026-04-28",
        reviewPromptSnapshot: "v1.0\nsystem prompt",
        reviewedAt: new Date(),
      },
    });

    const res = await POST(
      makeRequest("POST", { scope: "design", id: designId, decision: "APPROVED" }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.status).toBe("APPROVED");
    expect(data.source).toBe("USER");

    // SYSTEM alanları KORUNDU
    const updated = await db.generatedDesign.findUnique({ where: { id: designId } });
    expect(updated?.reviewStatus).toBe(ReviewStatus.APPROVED);
    expect(updated?.reviewStatusSource).toBe(ReviewStatusSource.USER);
    expect(updated?.reviewScore).toBe(70);
    expect(updated?.reviewSummary).toBe("watermark detected");
    expect(updated?.reviewProviderSnapshot).toBe("gemini-2-5-flash@2026-04-28");
    expect(updated?.reviewPromptSnapshot).toBe("v1.0\nsystem prompt");
    expect(updated?.reviewedAt).not.toBeNull();

    // Audit (DesignReview) — USER override
    const audit = await db.designReview.findUnique({
      where: { generatedDesignId: designId },
    });
    expect(audit?.reviewer).toBe(USER_A);
    expect(audit?.decision).toBe(ReviewStatus.APPROVED);
  });

  it("local + REJECTED happy", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: USER_A });
    const { assetId } = await createLocalAssetFixture(USER_A);

    const res = await POST(
      makeRequest("POST", { scope: "local", id: assetId, decision: "REJECTED" }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.status).toBe("REJECTED");
    expect(data.source).toBe("USER");

    const updated = await db.localLibraryAsset.findUnique({ where: { id: assetId } });
    expect(updated?.reviewStatus).toBe(ReviewStatus.REJECTED);
    expect(updated?.reviewStatusSource).toBe(ReviewStatusSource.USER);
    expect(updated?.reviewedAt).not.toBeNull();
  });

  it("design + APPROVED audit upsert update dalı: SYSTEM provider/model/snapshot KORUNUR", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: USER_A });
    const { designId } = await createDesignFixture(USER_A);

    // Önce SYSTEM audit row'u yazılmış olsun (worker üretmiş gibi)
    await db.designReview.create({
      data: {
        generatedDesignId: designId,
        reviewer: "system",
        score: 70,
        decision: ReviewStatus.NEEDS_REVIEW,
        provider: "gemini-2-5-flash",
        model: "gemini-2-5-flash",
        promptSnapshot: "system prompt v1",
        responseSnapshot: { score: 70, riskFlags: [] },
      },
    });

    await POST(
      makeRequest("POST", { scope: "design", id: designId, decision: "APPROVED" }),
    );

    const audit = await db.designReview.findUnique({
      where: { generatedDesignId: designId },
    });
    // USER override sonrası reviewer + decision güncel
    expect(audit?.reviewer).toBe(USER_A);
    expect(audit?.decision).toBe(ReviewStatus.APPROVED);
    // SYSTEM audit alanları KORUNUR (eski snapshot)
    expect(audit?.provider).toBe("gemini-2-5-flash");
    expect(audit?.model).toBe("gemini-2-5-flash");
    expect(audit?.promptSnapshot).toBe("system prompt v1");
    expect(audit?.score).toBe(70);
  });

  it("decision PENDING ⇒ 400 (USER bu state'i yazamaz)", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: USER_A });
    const { designId } = await createDesignFixture(USER_A);

    const res = await POST(
      makeRequest("POST", { scope: "design", id: designId, decision: "PENDING" }),
    );
    expect(res.status).toBe(400);
  });

  it("decision NEEDS_REVIEW ⇒ 400", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: USER_A });
    const { designId } = await createDesignFixture(USER_A);

    const res = await POST(
      makeRequest("POST", { scope: "design", id: designId, decision: "NEEDS_REVIEW" }),
    );
    expect(res.status).toBe(400);
  });

  it("scope='other' ⇒ 400 (Zod enum)", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: USER_A });
    const res = await POST(
      makeRequest("POST", { scope: "other", id: "cabcdefghijklmnopqrstuvwx", decision: "APPROVED" }),
    );
    expect(res.status).toBe(400);
  });

  it("ownership başka user ⇒ 404 (Karar 1: varlık sızıntısı yok, 403 değil)", async () => {
    const { designId } = await createDesignFixture(USER_A);
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: USER_B });

    const res = await POST(
      makeRequest("POST", { scope: "design", id: designId, decision: "APPROVED" }),
    );
    expect(res.status).toBe(404);

    // State değişmemiş olmalı
    const unchanged = await db.generatedDesign.findUnique({ where: { id: designId } });
    expect(unchanged?.reviewStatusSource).toBe(ReviewStatusSource.SYSTEM);
    expect(unchanged?.reviewStatus).toBe(ReviewStatus.PENDING);
  });

  it("design soft-delete (deletedAt) ⇒ 404", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: USER_A });
    const { designId } = await createDesignFixture(USER_A);
    await db.generatedDesign.update({
      where: { id: designId },
      data: { deletedAt: new Date() },
    });

    const res = await POST(
      makeRequest("POST", { scope: "design", id: designId, decision: "APPROVED" }),
    );
    expect(res.status).toBe(404);
  });

  it("local soft-delete (isUserDeleted=true) ⇒ 404", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: USER_A });
    const { assetId } = await createLocalAssetFixture(USER_A);
    await db.localLibraryAsset.update({
      where: { id: assetId },
      data: { isUserDeleted: true },
    });

    const res = await POST(
      makeRequest("POST", { scope: "local", id: assetId, decision: "APPROVED" }),
    );
    expect(res.status).toBe(404);
  });

  it("auth eksik ⇒ 401", async () => {
    const { UnauthorizedError } = await import("@/lib/errors");
    (requireUser as ReturnType<typeof vi.fn>).mockRejectedValue(
      new UnauthorizedError(),
    );
    const res = await POST(
      makeRequest("POST", {
        scope: "design",
        id: "cabcdefghijklmnopqrstuvwx",
        decision: "APPROVED",
      }),
    );
    expect(res.status).toBe(401);
  });
});

// =============================================================================
// PATCH /api/review/decisions — Reset to system + rerun (best-effort)
// =============================================================================

describe("PATCH /api/review/decisions — Reset to system + rerun", () => {
  it("design reset: USER damgası silinir, SYSTEM PENDING + REVIEW_DESIGN job enqueue", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: USER_A });
    const { designId } = await createDesignFixture(USER_A);

    // Önce USER override yazılmış olsun
    await db.generatedDesign.update({
      where: { id: designId },
      data: {
        reviewStatus: ReviewStatus.APPROVED,
        reviewStatusSource: ReviewStatusSource.USER,
        reviewScore: 70,
        reviewSummary: "previous review",
        reviewProviderSnapshot: "gemini-2-5-flash@2026-04-28",
        reviewPromptSnapshot: "v1.0\nsystem prompt",
        textDetected: true,
        gibberishDetected: true,
        reviewedAt: new Date(),
      },
    });

    const res = await PATCH(makeRequest("PATCH", { scope: "design", id: designId }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.reset).toBe(true);
    expect(data.rerunEnqueued).toBe(true);
    expect(data.rerunError).toBeUndefined();

    // Reset state commit edildi
    const updated = await db.generatedDesign.findUnique({ where: { id: designId } });
    expect(updated?.reviewStatus).toBe(ReviewStatus.PENDING);
    expect(updated?.reviewStatusSource).toBe(ReviewStatusSource.SYSTEM);
    expect(updated?.reviewScore).toBeNull();
    expect(updated?.reviewSummary).toBeNull();
    expect(updated?.reviewProviderSnapshot).toBeNull();
    expect(updated?.reviewPromptSnapshot).toBeNull();
    expect(updated?.reviewRiskFlags).toBeNull();
    expect(updated?.textDetected).toBe(false);
    expect(updated?.gibberishDetected).toBe(false);
    expect(updated?.reviewedAt).toBeNull();

    // REVIEW_DESIGN job enqueued
    expect(enqueueMock).toHaveBeenCalledTimes(1);
    expect(enqueueMock).toHaveBeenCalledWith(
      JobType.REVIEW_DESIGN,
      expect.objectContaining({
        scope: "design",
        generatedDesignId: designId,
        userId: USER_A,
      }),
    );
  });

  it("local reset: USER damgası silinir + productTypeKey enqueue payload'da görünür", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: USER_A });
    const { assetId } = await createLocalAssetFixture(USER_A);

    // Önce USER override + SYSTEM alanları yazılmış olsun
    await db.localLibraryAsset.update({
      where: { id: assetId },
      data: {
        reviewStatus: ReviewStatus.APPROVED,
        reviewStatusSource: ReviewStatusSource.USER,
        reviewScore: 80,
        reviewSummary: "user override",
        reviewProviderSnapshot: "gemini-2-5-flash@2026-04-28",
        reviewedAt: new Date(),
      },
    });

    const res = await PATCH(
      makeRequest("PATCH", { scope: "local", id: assetId, productTypeKey: "wall_art" }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.reset).toBe(true);
    expect(data.rerunEnqueued).toBe(true);

    const updated = await db.localLibraryAsset.findUnique({ where: { id: assetId } });
    expect(updated?.reviewStatus).toBe(ReviewStatus.PENDING);
    expect(updated?.reviewStatusSource).toBe(ReviewStatusSource.SYSTEM);
    expect(updated?.reviewScore).toBeNull();
    expect(updated?.reviewSummary).toBeNull();
    expect(updated?.reviewProviderSnapshot).toBeNull();
    expect(updated?.reviewedAt).toBeNull();

    expect(enqueueMock).toHaveBeenCalledWith(
      JobType.REVIEW_DESIGN,
      expect.objectContaining({
        scope: "local",
        localAssetId: assetId,
        userId: USER_A,
        productTypeKey: "wall_art",
      }),
    );
  });

  it("PATCH local + productTypeKey eksik ⇒ 400 (Karar 3: zorunlu)", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: USER_A });
    const { assetId } = await createLocalAssetFixture(USER_A);

    const res = await PATCH(
      makeRequest("PATCH", { scope: "local", id: assetId }),
    );
    expect(res.status).toBe(400);
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it("PATCH local + productTypeKey boş string ⇒ 400 (min(1))", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: USER_A });
    const { assetId } = await createLocalAssetFixture(USER_A);

    const res = await PATCH(
      makeRequest("PATCH", { scope: "local", id: assetId, productTypeKey: "" }),
    );
    expect(res.status).toBe(400);
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it("PATCH ownership başka user ⇒ 404 (Karar 1)", async () => {
    const { designId } = await createDesignFixture(USER_A);
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: USER_B });

    const res = await PATCH(makeRequest("PATCH", { scope: "design", id: designId }));
    expect(res.status).toBe(404);
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it("PATCH rerun fail: reset commit edilir + rerunEnqueued=false + rerunError var (Karar 2)", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: USER_A });
    const { designId } = await createDesignFixture(USER_A);

    // Önce USER override yazılmış olsun
    await db.generatedDesign.update({
      where: { id: designId },
      data: {
        reviewStatus: ReviewStatus.APPROVED,
        reviewStatusSource: ReviewStatusSource.USER,
        reviewedAt: new Date(),
      },
    });

    // Enqueue throw simüle et
    enqueueMock.mockRejectedValueOnce(new Error("redis connection refused"));

    const res = await PATCH(makeRequest("PATCH", { scope: "design", id: designId }));
    expect(res.status).toBe(200); // 500 değil — reset commit oldu
    const data = await res.json();
    expect(data.reset).toBe(true);
    expect(data.rerunEnqueued).toBe(false);
    expect(typeof data.rerunError).toBe("string");
    expect(data.rerunError).toMatch(/redis|connection/i);

    // Reset state commit edildi
    const updated = await db.generatedDesign.findUnique({ where: { id: designId } });
    expect(updated?.reviewStatusSource).toBe(ReviewStatusSource.SYSTEM);
    expect(updated?.reviewStatus).toBe(ReviewStatus.PENDING);
    expect(updated?.reviewedAt).toBeNull();
  });

  it("PATCH auth eksik ⇒ 401", async () => {
    const { UnauthorizedError } = await import("@/lib/errors");
    (requireUser as ReturnType<typeof vi.fn>).mockRejectedValue(
      new UnauthorizedError(),
    );
    const res = await PATCH(
      makeRequest("PATCH", { scope: "design", id: "cabcdefghijklmnopqrstuvwx" }),
    );
    expect(res.status).toBe(401);
  });
});
