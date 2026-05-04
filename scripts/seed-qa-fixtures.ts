// QA fixture seed — manual QA browser-based smoke için minimum başlangıç
// state'i hazırlar.
//
// Amaç: Phase 6 + Phase 8 manual QA'sının "fixture-blocked" durumunu açmak.
// Üretim akışını taklit ETMEZ — sadece DB seed + MinIO sample PNG yükleme.
//
// Hangi blocker'ları açar:
//   - Phase 8 A-O (S3 Apply → S8 Result + ZIP + cover swap + per-render): admin
//     user için 1 ready SelectionSet + 1 terminal MockupJob (COMPLETED, 10
//     successful renders, cover invariant), MinIO'da 10 cover/grid PNG.
//   - Phase 6 C/D Review Queue UI: admin user için review-state'li (PENDING +
//     APPROVED + NEEDS_REVIEW örnekleri) GeneratedDesign + Asset row'ları.
//
// Çağrı:
//   npx tsx scripts/seed-qa-fixtures.ts
//
// Idempotency: marker tag (`qa-fixture-v1` notes alanı) kullanır, tekrar
// çalıştırıldığında upsert (yeniden create etmez). Reset için:
//   npx tsx scripts/seed-qa-fixtures.ts --reset
//
// CLAUDE.md uyumu:
//   - Production behavior DEĞİŞMEZ
//   - Settings hardcoded değil (zaten DB seed)
//   - Admin scope (end-user üretim akışı korunur)
//   - Sessiz fallback YOK (her seed adımı log emit eder)

import "./_bootstrap-env";
import sharp from "sharp";
import { createHash } from "node:crypto";
import {
  PrismaClient,
  ReviewStatus,
  ReviewStatusSource,
  MockupJobStatus,
  MockupRenderStatus,
  PackSelectionReason,
  SelectionSetStatus,
  SelectionItemStatus,
} from "@prisma/client";
import { getStorage } from "../src/providers/storage";

const db = new PrismaClient();
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@etsyhub.local";
const QA_FIXTURE_MARKER = "qa-fixture-v1";
const PACK_SIZE = 10;

// ────────────────────────────────────────────────────────────
// Sample PNG generator (sharp — deterministic, no external dep)
// ────────────────────────────────────────────────────────────

async function makeSamplePng(label: string, color: { r: number; g: number; b: number }): Promise<Buffer> {
  const svg = Buffer.from(`<svg width="800" height="800" xmlns="http://www.w3.org/2000/svg">
    <rect width="800" height="800" fill="rgb(${color.r},${color.g},${color.b})"/>
    <text x="400" y="420" font-family="sans-serif" font-size="48" fill="white" text-anchor="middle">${label}</text>
  </svg>`);
  return sharp(svg).png().toBuffer();
}

async function uploadAndHash(key: string, buf: Buffer): Promise<string> {
  await getStorage().upload(key, buf, { contentType: "image/png" });
  return createHash("sha256").update(buf).digest("hex");
}

// ────────────────────────────────────────────────────────────
// Reset (--reset flag)
// ────────────────────────────────────────────────────────────

async function reset(adminId: string) {
  console.log("[reset] QA fixture rows + storage keys siliniyor...");
  // FK-safe order: Mockup* → Selection* → GeneratedDesign → Reference → Asset
  // Asset üzerindeki notes alanı yok; storageKey prefix ile ayırt ediyoruz.
  const QA_KEY_PREFIX = "qa-fixture/";
  const fixtureAssets = await db.asset.findMany({
    where: { userId: adminId, storageKey: { startsWith: QA_KEY_PREFIX } },
    select: { id: true, storageKey: true },
  });
  const assetIds = fixtureAssets.map((a) => a.id);
  console.log(`[reset] ${fixtureAssets.length} fixture Asset row'u var`);

  // Selection* + Mockup*
  const sets = await db.selectionSet.findMany({ where: { userId: adminId, name: { startsWith: "[QA] " } }, select: { id: true } });
  const setIds = sets.map((s) => s.id);
  if (setIds.length > 0) {
    const jobs = await db.mockupJob.findMany({ where: { setId: { in: setIds } }, select: { id: true } });
    const jobIds = jobs.map((j) => j.id);
    if (jobIds.length > 0) {
      await db.mockupJob.updateMany({ where: { id: { in: jobIds } }, data: { coverRenderId: null } });
      await db.mockupRender.deleteMany({ where: { jobId: { in: jobIds } } });
      await db.mockupJob.deleteMany({ where: { id: { in: jobIds } } });
    }
    await db.selectionItem.deleteMany({ where: { selectionSetId: { in: setIds } } });
    await db.selectionSet.deleteMany({ where: { id: { in: setIds } } });
  }
  await db.generatedDesign.deleteMany({ where: { userId: adminId, reference: { notes: { startsWith: `[${QA_FIXTURE_MARKER}]` } } } });
  await db.reference.deleteMany({ where: { userId: adminId, notes: { startsWith: `[${QA_FIXTURE_MARKER}]` } } });
  if (assetIds.length > 0) {
    await db.asset.deleteMany({ where: { id: { in: assetIds } } });
    // Storage cleanup best-effort
    for (const a of fixtureAssets) {
      try {
        await getStorage().delete(a.storageKey);
      } catch (e) {
        console.warn(`[reset] storage delete fail (best-effort): ${a.storageKey}`, (e as Error).message);
      }
    }
  }
  console.log("[reset] Bitti.");
}

// ────────────────────────────────────────────────────────────
// Main seed
// ────────────────────────────────────────────────────────────

async function main() {
  const isReset = process.argv.includes("--reset");
  const admin = await db.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (!admin) {
    console.error(`[seed-qa-fixtures] FATAL: admin user yok (${ADMIN_EMAIL}). Önce: npx tsx prisma/seed.ts`);
    process.exit(1);
  }

  if (isReset) {
    await reset(admin.id);
    return;
  }

  // Idempotency: zaten fixture varsa skip
  const existingSet = await db.selectionSet.findFirst({
    where: { userId: admin.id, name: { startsWith: "[QA] " } },
  });
  if (existingSet) {
    console.log(`[seed-qa-fixtures] Mevcut QA fixture bulundu: ${existingSet.id}. Skip. Reset için: --reset`);
    return;
  }

  // Phase 8 için 1 ACTIVE template + 1 ACTIVE binding gerek (canvas kategorisi V1)
  const activeTpl = await db.mockupTemplate.findFirst({ where: { categoryId: "canvas", status: "ACTIVE" }, include: { bindings: { where: { status: "ACTIVE" } } } });
  if (!activeTpl || activeTpl.bindings.length === 0) {
    console.error("[seed-qa-fixtures] FATAL: ACTIVE canvas MockupTemplate veya binding yok. Phase 8 prerequisite eksik.");
    process.exit(1);
  }
  const activeBinding = activeTpl.bindings[0]!;
  // ProductType seçimi: Phase 8 §1.4 quick-pack default için
  // selectionItem.aspectRatio = productType.aspectRatio fallback'ı template
  // aspectRatio'larıyla eşleşmeli (validPairs > 0 — TemplateInvalidError'dan kaçınmak için).
  // Canvas template'lar V1'de `2:3` aspectRatio ile seed'leniyor (admin asset prep);
  // canvas ProductType ise `3:4` (production seed). Bu drift'i seed-time'da
  // çözmek için: template'ın aspectRatio'suna uyan ProductType'ı seç (wall_art "2:3"
  // → match). Canvas ProductType drift'i V1.1 carry-forward (release-readiness.md).
  const tplAspect = activeTpl.aspectRatios[0] ?? "2:3";
  const productPt = await db.productType.findFirst({ where: { aspectRatio: tplAspect, isSystem: true } });
  if (!productPt) {
    console.error(`[seed-qa-fixtures] FATAL: aspectRatio=${tplAspect} ile uyumlu ProductType yok.`);
    process.exit(1);
  }
  console.log(`[seed-qa-fixtures] active template ${activeTpl.id} (aspectRatio=${tplAspect}) + binding ${activeBinding.id}; productType=${productPt.key} (aspectRatio=${productPt.aspectRatio})`);

  // 1. Source asset (reference image) + Reference + GeneratedDesign'ler
  console.log("[seed-qa-fixtures] 1/4 — Reference + GeneratedDesign + Asset row'ları...");
  const refImageBuf = await makeSamplePng("[QA] Reference", { r: 30, g: 80, b: 180 });
  const refKey = `qa-fixture/reference-${Date.now()}.png`;
  const refHash = await uploadAndHash(refKey, refImageBuf);
  const refAsset = await db.asset.create({
    data: {
      userId: admin.id,
      storageProvider: "minio",
      storageKey: refKey,
      bucket: process.env.STORAGE_BUCKET ?? "etsyhub",
      mimeType: "image/png",
      sizeBytes: refImageBuf.length,
      width: 800,
      height: 800,
      hash: refHash,
    },
  });
  const reference = await db.reference.create({
    data: {
      userId: admin.id,
      assetId: refAsset.id,
      productTypeId: productPt.id,
      notes: `[${QA_FIXTURE_MARKER}] QA fixture reference`,
    },
  });

  // 3 GeneratedDesign — Phase 6 review queue için farklı state'ler
  const genDesigns: { id: string; assetId: string; reviewStatus: ReviewStatus; qualityScore: number }[] = [];
  const variants: Array<{ label: string; color: { r: number; g: number; b: number }; reviewStatus: ReviewStatus; reviewStatusSource: ReviewStatusSource; qualityScore: number; reviewSummary: string; flagCount: number }> = [
    { label: "[QA] Variant 1", color: { r: 200, g: 60, b: 60 }, reviewStatus: ReviewStatus.PENDING, reviewStatusSource: ReviewStatusSource.SYSTEM, qualityScore: 70, reviewSummary: "QA fixture — pending review.", flagCount: 0 },
    { label: "[QA] Variant 2", color: { r: 60, g: 200, b: 60 }, reviewStatus: ReviewStatus.APPROVED, reviewStatusSource: ReviewStatusSource.SYSTEM, qualityScore: 95, reviewSummary: "QA fixture — yüksek kaliteli, onaylandı.", flagCount: 0 },
    { label: "[QA] Variant 3", color: { r: 60, g: 60, b: 200 }, reviewStatus: ReviewStatus.NEEDS_REVIEW, reviewStatusSource: ReviewStatusSource.SYSTEM, qualityScore: 60, reviewSummary: "QA fixture — orta kalite, kullanıcı kararı gerek.", flagCount: 1 },
  ];
  for (const v of variants) {
    const genBuf = await makeSamplePng(v.label, v.color);
    const genKey = `qa-fixture/gen-${Date.now()}-${v.label.replace(/\W+/g, "_")}.png`;
    const genHash = await uploadAndHash(genKey, genBuf);
    const genAsset = await db.asset.create({
      data: {
        userId: admin.id,
        storageProvider: "minio",
        storageKey: genKey,
        bucket: process.env.STORAGE_BUCKET ?? "etsyhub",
        mimeType: "image/png",
        sizeBytes: genBuf.length,
        width: 800,
        height: 800,
        hash: genHash,
      },
    });
    const gen = await db.generatedDesign.create({
      data: {
        userId: admin.id,
        referenceId: reference.id,
        assetId: genAsset.id,
        productTypeId: productPt.id,
        similarity: "medium",
        qualityScore: v.qualityScore,
        reviewStatus: v.reviewStatus,
        reviewStatusSource: v.reviewStatusSource,
        reviewSummary: v.reviewSummary,
        reviewProviderSnapshot: "kie-gemini-flash@2026-05-04",
        reviewedAt: v.reviewStatus === ReviewStatus.PENDING ? null : new Date(),
      },
    });
    genDesigns.push({ id: gen.id, assetId: genAsset.id, reviewStatus: v.reviewStatus, qualityScore: v.qualityScore });
  }
  console.log(`  ${genDesigns.length} GeneratedDesign + ${genDesigns.length + 1} Asset row'u oluşturuldu`);

  // 2. SelectionSet (status=ready) + SelectionItem'lar (approved variant'lar)
  console.log("[seed-qa-fixtures] 2/4 — SelectionSet + SelectionItem'lar...");
  // Phase 8 için en az 1 variant lazım — APPROVED ve PENDING ekleyelim (3 toplam selection items)
  const set = await db.selectionSet.create({
    data: {
      userId: admin.id,
      name: "[QA] Phase 8 fixture set",
      status: SelectionSetStatus.ready,
      finalizedAt: new Date(),
      sourceMetadata: {
        kind: "qa-fixture",
        marker: QA_FIXTURE_MARKER,
        productTypeId: productPt.id,
        originalCount: genDesigns.length,
      },
    },
  });
  for (let i = 0; i < genDesigns.length; i++) {
    const gd = genDesigns[i]!;
    await db.selectionItem.create({
      data: {
        selectionSetId: set.id,
        generatedDesignId: gd.id,
        sourceAssetId: gd.assetId,
        editHistoryJson: [],
        status: SelectionItemStatus.pending,
        position: i,
      },
    });
  }
  console.log(`  SelectionSet ${set.id} (status=ready) + ${genDesigns.length} item'lar`);

  // 3. MockupJob (status=COMPLETED) + 10 MockupRender (PACK_SIZE)
  console.log(`[seed-qa-fixtures] 3/4 — MockupJob (terminal) + ${PACK_SIZE} MockupRender...`);
  // setSnapshotId — deterministic hash placeholder
  const setSnapshotId = createHash("sha256").update(`${set.id}:${set.updatedAt.toISOString()}`).digest("hex");
  const job = await db.mockupJob.create({
    data: {
      userId: admin.id,
      setId: set.id,
      setSnapshotId,
      categoryId: "canvas",
      status: MockupJobStatus.COMPLETED,
      packSize: PACK_SIZE,
      actualPackSize: PACK_SIZE,
      totalRenders: PACK_SIZE,
      successRenders: PACK_SIZE,
      failedRenders: 0,
      startedAt: new Date(Date.now() - 60_000),
      completedAt: new Date(),
    },
  });

  // SelectionItem'lardan variantId çekmek için items'ları yeniden çek
  const items = await db.selectionItem.findMany({ where: { selectionSetId: set.id }, orderBy: { position: "asc" } });
  if (items.length === 0) throw new Error("SelectionItem yok — fixture broken");

  // 10 render: cover (packPosition=0) + 9 grid. 3 item'dan rotasyon ile dolduruyoruz.
  // Cover rendered asset ayrıca yükleniyor (Phase 8 cover invariant).
  let coverRenderId: string | null = null;
  for (let pos = 0; pos < PACK_SIZE; pos++) {
    const variantItem = items[pos % items.length]!;
    const renderBuf = await makeSamplePng(`[QA] Mockup ${pos + 1}`, { r: 50 + pos * 15, g: 100, b: 200 - pos * 15 });
    const renderKey = `qa-fixture/mockup-${job.id}-pos-${pos}.png`;
    await getStorage().upload(renderKey, renderBuf, { contentType: "image/png" });
    const thumbKey = `qa-fixture/mockup-${job.id}-pos-${pos}-thumb.png`;
    const thumbBuf = await sharp(renderBuf).resize(200, 200).png().toBuffer();
    await getStorage().upload(thumbKey, thumbBuf, { contentType: "image/png" });

    const render = await db.mockupRender.create({
      data: {
        jobId: job.id,
        variantId: variantItem.id,
        bindingId: activeBinding.id,
        templateSnapshot: {
          templateId: activeTpl.id,
          provider: activeBinding.providerId,
          marker: QA_FIXTURE_MARKER,
        },
        packPosition: pos,
        selectionReason: pos === 0 ? PackSelectionReason.COVER : PackSelectionReason.TEMPLATE_DIVERSITY,
        status: MockupRenderStatus.SUCCESS,
        outputKey: renderKey,
        thumbnailKey: thumbKey,
        startedAt: new Date(Date.now() - 30_000 + pos * 1000),
        completedAt: new Date(Date.now() - 20_000 + pos * 1000),
      },
    });
    if (pos === 0) coverRenderId = render.id;
  }
  await db.mockupJob.update({ where: { id: job.id }, data: { coverRenderId } });
  console.log(`  MockupJob ${job.id} (status=COMPLETED) + ${PACK_SIZE} MockupRender (cover=${coverRenderId})`);

  // 4. Done — özet
  console.log("\n[seed-qa-fixtures] ✅ QA fixture hazır (admin user için).");
  console.log("\nManual QA başlangıç noktaları:");
  console.log(`  Phase 8 — SelectionSet detail: /selection/sets/${set.id}`);
  console.log(`  Phase 8 — Apply: /selection/sets/${set.id}/mockup/apply`);
  console.log(`  Phase 8 — S8 Result: /mockup/jobs/${job.id}/result`);
  console.log(`  Phase 6 — Review queue: /review (3 GeneratedDesign + 3 farklı state)`);
  console.log(`  Phase 9 — Listing draft create: POST /api/listings/draft body { mockupJobId: "${job.id}" }`);
  console.log("\nReset için: npx tsx scripts/seed-qa-fixtures.ts --reset");
}

main()
  .catch((e) => {
    console.error("[seed-qa-fixtures] FATAL:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
