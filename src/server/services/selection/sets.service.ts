// Phase 7 Task 3 — SelectionSet service (CRUD + read).
//
// Sözleşmeler (design Section 3.1 + 4.1 + 4.3):
//   - createSet: manuel set yaratma; status default `draft`; name trim sonrası
//     non-empty (zod CreateSelectionSetInputSchema route boundary'sinde de
//     enforce edilir; service kendi içinde de check eder — defense in depth).
//   - listSets: index için; userId filter zorunlu; status filter opsiyonel;
//     updatedAt desc sort.
//   - getSet: single set + items; ownership `requireSetOwnership` üzerinden
//     (cross-user / yok → NotFoundError, 404 disiplini). Items `position asc`.
//   - archiveSet: draft|ready → archived geçişi + archivedAt now(). Tam state
//     machine guard (assertCanArchive vs.) Task 4'te; bu task'te basit
//     "archived → archived" reject yeterli.
//
// Phase 7 Task 15 — quickStartFromBatch:
//   Reference batch'ten otomatik SelectionSet + items oluştur (Quick start
//   canonical entry point). Atomik transaction: set + items birlikte ya hep
//   ya hiç. batchId === GeneratedDesign.jobId (Phase 5 GENERATE_VARIATIONS).
//   Boş batch reject (uyarısız set kötü UX, design Section 2.1).
//   Cross-user 404 disiplini Phase 6 paterniyle her ownership kontrolünde.
//
// Phase 6 paterni: Phase 6 review service'lerinde olduğu gibi DB roundtrip'i
// minimize et — `requireSetOwnership` zaten set entity'yi döner; getSet
// içinde tekrar fetch yapmak yerine helper'ın dönen entity'yi reuse ediyoruz
// ve items'ı ayrı (ama ucuz) bir query ile çekiyoruz.

import type { SelectionItem, SelectionSet } from "@prisma/client";
import { JobType } from "@prisma/client";
import { db } from "@/server/db";
import { NotFoundError } from "@/lib/errors";
import { type ActiveExport, getActiveExport } from "./active-export";
import { requireSetOwnership } from "./authz";
import { mapReviewToView } from "./review-mapper";
import { assertCanArchive } from "./state";
import type { ReviewView } from "./types";

/**
 * Manuel set yarat. status default `draft`.
 *
 * `name` trim sonrası non-empty olmalı. Route boundary'de
 * `CreateSelectionSetInputSchema` (zod) zaten enforce eder; service kendi
 * içinde de check yapar (defense in depth — internal caller'lar zod by-pass
 * edebilir).
 */
export async function createSet(input: {
  userId: string;
  name: string;
}): Promise<SelectionSet> {
  const trimmed = input.name.trim();
  if (trimmed.length === 0) {
    throw new Error("name boş olamaz");
  }
  return db.selectionSet.create({
    data: {
      userId: input.userId,
      name: trimmed,
      status: "draft",
    },
  });
}

/**
 * Kullanıcının set'lerini listele. updatedAt desc.
 *
 * `status` opsiyonel — verilmezse tüm statüler döner. Index ekranı için
 * statü tab'lerine göre filtre uygulanır.
 */
export async function listSets(input: {
  userId: string;
  status?: "draft" | "ready" | "archived";
}): Promise<SelectionSet[]> {
  return db.selectionSet.findMany({
    where: {
      userId: input.userId,
      ...(input.status ? { status: input.status } : {}),
    },
    orderBy: { updatedAt: "desc" },
  });
}

/**
 * Single set + items detayı.
 *
 * Ownership önce `requireSetOwnership` ile (cross-user / yok → NotFoundError).
 * Helper set entity'yi döndüğü için ikinci `findUnique` çekmiyoruz; items
 * ayrı `findMany` (`position asc`).
 *
 * Phase 7 Task 16 — Review mapper integration:
 *   Items fetch'inde `generatedDesign.review` join edilir; her item için
 *   `mapReviewToView` ile view-model üretilir. Review yok ise `review: null`.
 *   Mapper Phase 6 entity'lerini SADECE OKUR (read-only köprü).
 */
export async function getSet(input: {
  userId: string;
  setId: string;
}): Promise<
  SelectionSet & {
    items: (SelectionItem & { review: ReviewView | null })[];
    activeExport: ActiveExport | null;
  }
> {
  const set = await requireSetOwnership(input);
  const rows = await db.selectionItem.findMany({
    where: { selectionSetId: input.setId },
    orderBy: { position: "asc" },
    include: {
      generatedDesign: {
        include: { review: true },
      },
    },
  });
  // Mapper sonucu inject; raw `generatedDesign` payload'ı API yanıtında
  // sızdırılmaz — yalnız `review` (view) eklenir, eklenen include kalkar.
  const items = rows.map(({ generatedDesign, ...item }) => ({
    ...item,
    review: mapReviewToView({
      generatedDesign,
      designReview: generatedDesign.review,
    }),
  }));
  // Phase 7 Task 14 — activeExport (Set GET payload genişletme, design Section 6.6).
  // Additive alan: BullMQ queue'dan en son EXPORT_SELECTION_SET job'unun durumu.
  // Job yoksa null. UI bu objeye bakarak "İndir hazır" / "İşleniyor" /
  // "Tekrar dene" buton state'ini render eder.
  const activeExport = await getActiveExport(input);
  return { ...set, items, activeExport };
}

/**
 * Set'i archive et. draft|ready → archived geçişi.
 *
 * Task 4 (state machine guards):
 *   - cross-user / yok → NotFoundError (Task 17 `requireSetOwnership`)
 *   - archived → archived → InvalidStateTransitionError (`assertCanArchive`)
 *   - draft|ready geçer
 *
 * archivedAt: now() set edilir (audit/UX için).
 *
 * Tek public API yüzeyi: tüm archive girişimleri bu fonksiyondan geçer;
 * state.ts içindeki `assertCanArchive` ortak invariant.
 */
export async function archiveSet(input: {
  userId: string;
  setId: string;
}): Promise<SelectionSet> {
  const set = await requireSetOwnership(input);
  assertCanArchive(set);
  return db.selectionSet.update({
    where: { id: input.setId },
    data: {
      status: "archived",
      archivedAt: new Date(),
    },
  });
}

// ────────────────────────────────────────────────────────────
// Phase 7 Task 15 — quickStartFromBatch
// ────────────────────────────────────────────────────────────

/**
 * Quick start input — design Section 7.2 endpoint kontratı:
 *   `POST /api/selection/sets/quick-start
 *    { source: "variation-batch", referenceId, batchId, productTypeId }`
 *
 * batchId = `GeneratedDesign.jobId` (Phase 5 GENERATE_VARIATIONS Job.id).
 * Bir kullanıcının bir batch'inin tüm variantları aynı sete getirilir.
 */
export type QuickStartFromBatchInput = {
  userId: string;
  referenceId: string;
  batchId: string;
  productTypeId: string;
};

export type QuickStartFromBatchOutput = {
  set: SelectionSet;
  items: SelectionItem[];
};

/**
 * Türkçe ay isimleri — locale-independent (test determinizmi için).
 *
 * `Intl.DateTimeFormat("tr-TR", { month: "short" })` Node sürümüne göre
 * "Oca" / "Ocak" değiştirebilir; bu nedenle hard-coded array kullanıyoruz.
 */
const TR_MONTHS_SHORT = [
  "Oca",
  "Şub",
  "Mar",
  "Nis",
  "May",
  "Haz",
  "Tem",
  "Ağu",
  "Eyl",
  "Eki",
  "Kas",
  "Ara",
];

function formatTrShortDate(date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mon = TR_MONTHS_SHORT[date.getMonth()];
  const yyyy = date.getFullYear();
  return `${dd} ${mon} ${yyyy}`;
}

/**
 * Reference batch'ten otomatik SelectionSet + items oluştur.
 *
 * Akış (design Section 2.1 + 4.1):
 *   1. Reference ownership doğrula → cross-user / yok → NotFoundError
 *   2. ProductType doğrula → yok → NotFoundError
 *   3. Job (batch) ownership + type=GENERATE_VARIATIONS doğrula →
 *      cross-user / yok / yanlış type → NotFoundError ("variation batch")
 *   4. Batch'in design'larını fetch (createdAt asc; userId+referenceId+
 *      productTypeId defensive filter)
 *   5. Boş batch → reject ("variant yok") — uyarısız set kötü UX
 *   6. Auto-name: `{Reference.notes ya da productType.displayName} —
 *      {DD MMM YYYY}` (Türkçe ay, hard-coded)
 *   7. Atomic tx: SelectionSet create + tüm items create. Tx içinde herhangi
 *      bir await throw → rollback (Prisma callback `$transaction` semantiği).
 *
 * sourceMetadata (Section 4.1):
 *   {
 *     kind: "variation-batch",
 *     referenceId, batchId, productTypeId,
 *     batchCreatedAt: ISO string (Job.createdAt),
 *     originalCount: number (batch'teki design sayısı)
 *   }
 *
 * Items (Section 4.4):
 *   - status default `pending` (opt-in select; explicit user action gerekir)
 *   - position deterministic (createdAt asc → 0..N)
 *   - sourceAssetId design.assetId (immutable)
 *
 * Duplicate import policy: aynı batch'ten ikinci kez çağrılırsa iki ayrı set
 * oluşur (uyarı yok — `selection-quick-start-duplicate-warning` ileride).
 */
export async function quickStartFromBatch(
  input: QuickStartFromBatchInput,
): Promise<QuickStartFromBatchOutput> {
  const { userId, referenceId, batchId, productTypeId } = input;

  // 1) Reference ownership — cross-user 404 disiplini.
  const reference = await db.reference.findFirst({
    where: { id: referenceId, userId },
  });
  if (!reference) {
    throw new NotFoundError("Reference bulunamadı");
  }

  // 2) ProductType doğrulama (system-scope; userId yok).
  const productType = await db.productType.findUnique({
    where: { id: productTypeId },
  });
  if (!productType) {
    throw new NotFoundError("ProductType bulunamadı");
  }

  // 3) Batch (job) ownership + type filter — cross-user / yanlış type 404.
  const job = await db.job.findFirst({
    where: {
      id: batchId,
      userId,
      type: JobType.GENERATE_VARIATIONS,
    },
  });
  if (!job) {
    throw new NotFoundError("Variation batch bulunamadı");
  }

  // 4) Batch'in design'larını fetch (createdAt asc; defensive multi-filter).
  const designs = await db.generatedDesign.findMany({
    where: { jobId: batchId, userId, referenceId, productTypeId },
    orderBy: { createdAt: "asc" },
  });

  // 5) Boş batch reject — uyarısız set kötü UX.
  if (designs.length === 0) {
    throw new Error("Bu batch'te variant yok; quick start yapılamaz");
  }

  // 6) Auto-name: notes (trim non-empty) > productType.displayName.
  const trimmedNotes = reference.notes?.trim() ?? "";
  const namePrefix =
    trimmedNotes.length > 0 ? trimmedNotes : productType.displayName;
  const now = new Date();
  const autoName = `${namePrefix} — ${formatTrShortDate(now)}`;

  // 7) Atomic transaction — set + items birlikte ya hep ya hiç.
  return db.$transaction(async (tx) => {
    const set = await tx.selectionSet.create({
      data: {
        userId,
        name: autoName,
        status: "draft",
        sourceMetadata: {
          kind: "variation-batch",
          referenceId,
          batchId,
          productTypeId,
          batchCreatedAt: job.createdAt.toISOString(),
          originalCount: designs.length,
        },
      },
    });

    const items: SelectionItem[] = [];
    for (let idx = 0; idx < designs.length; idx++) {
      const design = designs[idx]!;
      const item = await tx.selectionItem.create({
        data: {
          selectionSetId: set.id,
          generatedDesignId: design.id,
          sourceAssetId: design.assetId,
          status: "pending",
          position: idx,
        },
      });
      items.push(item);
    }

    return { set, items };
  });
}
