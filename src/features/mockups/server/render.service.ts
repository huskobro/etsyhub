// Phase 8 Task 18 — Render service (manuel retry + swap).
//
// Spec §4.4 swap + §4.5 retry + §7.1+§7.2 retry policy:
//   - Manuel kullanıcı eylemleri (Task 19 endpoint thin wrapper olarak çağırır).
//   - retryCount cap=3 (V1; Spec §7.2).
//   - retry: yalnız RENDER_TIMEOUT + PROVIDER_DOWN için anlamlı
//     (TEMPLATE_INVALID + SAFE_AREA_OVERFLOW + SOURCE_QUALITY swap-first;
//     retry tekrar fail eder, kullanıcıya yanlış sinyal verir).
//   - swap: pack'te kullanılmamış deterministik (variantId, bindingId) pair seçer;
//     eski render packPosition=null'a (arşivlenir, Spec §3.1); yeni render
//     PENDING + aynı packPosition + aynı selectionReason ile yaratılır.
//
// `executeRender` Task 7 worker (handleMockupRender) sorumluluğu — Task 18'de
// duplicate yazılmaz (scope creep). Task 19 endpoint'leri yalnız retryRender +
// swapRender'ı çağıracak.
//
// Hata disiplini Phase 6/7/8 emsali (src/lib/errors.ts AppError signature
// `(message, code, status)`):
//   - RenderNotFoundError (404)        — yok veya cross-user (varlık sızıntısı yok)
//   - RenderNotFailedError (409)       — retry/swap yalnız FAILED render için
//   - RetryCapExceededError (409)      — retryCount >= 3
//   - RenderNotRetryableError (409)    — errorClass swap-only sınıfta
//   - NoAlternativePairError (409)     — pack'te alternatif pair kalmamış
//
// Phase 7+8 emsali: src/features/mockups/server/job.service.ts (Task 6 atomic
// transaction + AppError extend), src/features/mockups/server/handoff.service.ts
// (Task 5 atomic transaction), src/features/mockups/server/pack-selection.service.ts
// (Task 8 buildPackSelection deterministik algoritma).

import type {
  MockupJob,
  MockupRender,
  MockupTemplate,
  MockupTemplateBinding,
} from "@prisma/client";
import { db } from "@/server/db";
import { AppError } from "@/lib/errors";
import { queueMockupRenderJobs } from "@/jobs/mockup-render.queue";
import {
  resolveAspectRatio,
  snapshotForRender,
  type SelectionSetWithItems,
} from "./snapshot.service";

// ────────────────────────────────────────────────────────────
// Custom hata sınıfları (AppError extend; route boundary auto-map).
// ────────────────────────────────────────────────────────────

/** 404 — render yok veya cross-user (varlık sızıntısı yasak). */
export class RenderNotFoundError extends AppError {
  constructor(message = "Render bulunamadı") {
    super(message, "RENDER_NOT_FOUND", 404);
  }
}

/** 409 — retry/swap yalnız FAILED render için (V1). */
export class RenderNotFailedError extends AppError {
  constructor(message = "Sadece başarısız render'lar retry/swap edilebilir") {
    super(message, "RENDER_NOT_FAILED", 409);
  }
}

/** 409 — retryCount cap aşıldı (Spec §7.2: V1 cap=3). */
export class RetryCapExceededError extends AppError {
  constructor(message = "Retry limiti aşıldı (en fazla 3 kez)") {
    super(message, "RETRY_CAP_EXCEEDED", 409);
  }
}

/**
 * 409 — errorClass swap-only sınıfta (TEMPLATE_INVALID, SAFE_AREA_OVERFLOW,
 * SOURCE_QUALITY). Retry tekrar fail eder; kullanıcı swap kullanmalı.
 */
export class RenderNotRetryableError extends AppError {
  constructor(
    message = "Bu hata sınıfı retry ile çözülemez; swap kullanın",
  ) {
    super(message, "RENDER_NOT_RETRYABLE", 409);
  }
}

/** 409 — pack'te kullanılmamış valid (variantId, bindingId) pair kalmamış. */
export class NoAlternativePairError extends AppError {
  constructor(message = "Swap için alternatif kombinasyon yok") {
    super(message, "NO_ALTERNATIVE_PAIR", 409);
  }
}

// ────────────────────────────────────────────────────────────
// Sabitler
// ────────────────────────────────────────────────────────────

/** Spec §7.2: V1 retry cap (auto-retry yok; manuel kullanıcı eylemi). */
const RETRY_CAP = 3;

/**
 * Spec §7.1+§7.2: retry yalnız transient hata sınıfları için anlamlı.
 * Diğer 3 sınıf (TEMPLATE_INVALID, SAFE_AREA_OVERFLOW, SOURCE_QUALITY)
 * deterministik input/template kaynaklı; retry tekrar fail eder. Kullanıcı
 * swap (alternatif binding/variant) ile çözmeli.
 */
const RETRYABLE_ERROR_CLASSES = ["RENDER_TIMEOUT", "PROVIDER_DOWN"] as const;

// ────────────────────────────────────────────────────────────
// retryRender — Spec §4.5
// ────────────────────────────────────────────────────────────

/**
 * Manuel retry. Yalnız FAILED + retryable errorClass + retryCount<3.
 *
 * 1. Render fetch + ownership guard (cross-user → 404).
 * 2. Status === FAILED guard (409 RenderNotFailed).
 * 3. retryCount < cap guard (409 RetryCapExceeded).
 * 4. errorClass retryable guard (409 RenderNotRetryable).
 * 5. Render reset: status=PENDING, errorClass=null, errorDetail=null,
 *    startedAt=null, completedAt=null, retryCount += 1.
 * 6. BullMQ re-dispatch (queueMockupRenderJobs).
 *
 * Idempotency: BullMQ jobId=renderId (Task 7 producer disiplini); aynı
 * renderId ikinci kez enqueue edilirse mevcut job kullanılır.
 *
 * Aggregate roll-up (job.successRenders/failedRenders/status): Worker render'ı
 * tekrar terminal'e çekince Task 7 `recomputeJobStatus` çağırır. retryRender
 * burada job counter'larına dokunmaz; render FAILED→PENDING geçişi worker'ın
 * sonraki SUCCESS/FAILED transition'ında tutarlı şekilde aggregate edilir.
 */
export async function retryRender(
  renderId: string,
  userId: string,
): Promise<{ renderId: string }> {
  const render = await db.mockupRender.findUnique({
    where: { id: renderId },
    include: { job: { select: { id: true, userId: true } } },
  });

  // 404 disiplini: yok ya da başkasının (varlık sızıntısı yasak).
  if (!render || render.job.userId !== userId) {
    throw new RenderNotFoundError();
  }

  // Status guard.
  if (render.status !== "FAILED") {
    throw new RenderNotFailedError();
  }

  // Retry cap guard (Spec §7.2).
  if (render.retryCount >= RETRY_CAP) {
    throw new RetryCapExceededError();
  }

  // ErrorClass retryable guard (Spec §7.1+§7.2).
  if (
    !render.errorClass ||
    !(RETRYABLE_ERROR_CLASSES as readonly string[]).includes(render.errorClass)
  ) {
    throw new RenderNotRetryableError();
  }

  // Render reset — PENDING + retryCount artır + error alanlarını temizle.
  await db.mockupRender.update({
    where: { id: renderId },
    data: {
      status: "PENDING",
      errorClass: null,
      errorDetail: null,
      startedAt: null,
      completedAt: null,
      retryCount: { increment: 1 },
    },
  });

  // BullMQ re-dispatch (idempotent jobId=renderId).
  await queueMockupRenderJobs(render.jobId, [renderId]);

  return { renderId };
}

// ────────────────────────────────────────────────────────────
// swapRender — Spec §4.4
// ────────────────────────────────────────────────────────────

/**
 * Manuel swap. Eski render arşivlenir (packPosition=null); yeni render
 * deterministik alternatif (variantId, bindingId) ile aynı packPosition'da
 * yaratılır.
 *
 * 1. Render fetch + ownership guard (cross-user → 404).
 * 2. Status === FAILED guard (V1: swap yalnız FAILED için; cover swap Task 20
 *    ayrı endpoint'tir, mevcut SUCCESS render'ı cover'a taşır — bu fonksiyonun
 *    sorumluluğu değil).
 * 3. Job + tüm renders fetch; SelectionSet items + bindings (job'ta kullanılan
 *    aktif binding'ler) yüklenir.
 * 4. pickAlternativeRender helper — kullanılmamış valid pair (yoksa 409).
 * 5. Atomic transaction: eski packPosition=null + yeni render create
 *    (PENDING, aynı packPosition + selectionReason).
 * 6. BullMQ dispatch (yeni renderId).
 *
 * `errorSummary` aggregate roll-up: yeni render PENDING'de iken işlem etkisiz;
 * worker sonraki terminal'de tutarlı şekilde recompute edilir.
 */
export async function swapRender(
  renderId: string,
  userId: string,
): Promise<{ newRenderId: string }> {
  const render = await db.mockupRender.findUnique({
    where: { id: renderId },
    include: { job: { select: { id: true, userId: true } } },
  });

  if (!render || render.job.userId !== userId) {
    throw new RenderNotFoundError();
  }

  if (render.status !== "FAILED") {
    throw new RenderNotFailedError();
  }

  // Job + tüm renders (used pair set için arşiv dahil tüm renderlar gerekli).
  const jobWithRenders = await db.mockupJob.findUniqueOrThrow({
    where: { id: render.jobId },
    include: { renders: true },
  });

  // SelectionSet + items (variant havuzu — pack-selection emsali).
  const set = await db.selectionSet.findUniqueOrThrow({
    where: { id: jobWithRenders.setId },
    include: {
      items: {
        include: {
          generatedDesign: { include: { productType: true } },
          sourceAsset: true,
          editedAsset: true,
        },
      },
    },
  });

  // Job'ta kullanılan ACTIVE binding'ler — job snapshot'ı oluştuğunda
  // hangi binding'ler seçilmişse onlar; yeni binding eklenmemiş varsayımı
  // (Spec §3.4 setSnapshotId immutable; pack-içi swap aynı template havuzunda).
  const usedBindingIds = Array.from(
    new Set(jobWithRenders.renders.map((r) => r.bindingId)),
  );
  const bindingsWithTemplate = await db.mockupTemplateBinding.findMany({
    where: { id: { in: usedBindingIds }, status: "ACTIVE" },
    include: { template: true },
  });

  const alternative = pickAlternativeRender({
    job: jobWithRenders,
    currentRender: render,
    set: set as SelectionSetWithItems,
    bindingsWithTemplate,
  });

  if (!alternative) {
    throw new NoAlternativePairError();
  }

  // Atomic transaction — eski arşivle, yeni create.
  const newRender = await db.$transaction(async (tx) => {
    // Eski render: packPosition=null (arşivlenir; Spec §3.1).
    await tx.mockupRender.update({
      where: { id: renderId },
      data: { packPosition: null },
    });

    // Yeni render PENDING — aynı packPosition + selectionReason korunur.
    const created = await tx.mockupRender.create({
      data: {
        jobId: render.jobId,
        variantId: alternative.variantId,
        bindingId: alternative.binding.id,
        templateSnapshot: alternative.templateSnapshot as object,
        packPosition: render.packPosition,
        selectionReason: render.selectionReason,
        status: "PENDING",
      },
    });

    return created;
  });

  // BullMQ dispatch (yeni render).
  await queueMockupRenderJobs(render.jobId, [newRender.id]);

  return { newRenderId: newRender.id };
}

// ────────────────────────────────────────────────────────────
// pickAlternativeRender — deterministik (variantId, bindingId) pair seçimi
// ────────────────────────────────────────────────────────────

type AlternativeInput = {
  job: MockupJob & { renders: MockupRender[] };
  currentRender: MockupRender;
  set: SelectionSetWithItems;
  bindingsWithTemplate: (MockupTemplateBinding & {
    template: MockupTemplate;
  })[];
};

type AlternativeOutput = {
  variantId: string;
  binding: MockupTemplateBinding;
  templateSnapshot: ReturnType<typeof snapshotForRender>;
};

/**
 * Pack içinde kullanılmamış valid (variantId × bindingId) pair'lerden
 * deterministik (lex tie-break) ilkini seç. Yoksa null.
 *
 * Algoritma (Task 8 emsali, single-render scope):
 *   1. Items: status≠rejected, position ASC stable sort.
 *   2. Bindings: id ASC stable sort.
 *   3. usedKeys: tüm job.renders'ın `${variantId}:${bindingId}` —
 *      packPosition=null arşivlenmiş swap'lar dahil (aynı pair tekrar
 *      seçilmesin).
 *   4. Outer item ASC × inner binding ASC nested loop:
 *      - aspect compatibility filter (variant.aspectRatio
 *        binding.template.aspectRatios içinde mi)
 *      - usedKeys'de değilse → ilk match döner.
 *
 * Determinizm: aynı set + aynı job durumunda her zaman aynı alternative.
 *
 * NOT: export edildi → unit test edilebilir; Task 19 endpoint kullanmaz
 * (yalnız swapRender içinde tüketilir).
 */
export function pickAlternativeRender(
  input: AlternativeInput,
): AlternativeOutput | null {
  // Used pairs Set — tüm renders dahil (arşivlenmiş swap'lar dahil),
  // aynı pair tekrar seçilmesin.
  const usedKeys = new Set(
    input.job.renders.map((r) => `${r.variantId}:${r.bindingId}`),
  );

  // Items: non-rejected, position ASC stable.
  const sortedItems = input.set.items
    .filter((item) => item.status !== "rejected")
    .slice()
    .sort((a, b) => a.position - b.position);

  // Bindings: id ASC stable.
  const sortedBindings = [...input.bindingsWithTemplate].sort((a, b) =>
    a.id.localeCompare(b.id),
  );

  // İlk valid + kullanılmamış pair (deterministik lex tie-break).
  for (const item of sortedItems) {
    const aspectRatio = resolveAspectRatio(item);
    if (!aspectRatio) continue;

    for (const binding of sortedBindings) {
      // Aspect compatibility (template-level filter, Task 8 emsali).
      if (!binding.template.aspectRatios.includes(aspectRatio)) continue;

      const key = `${item.id}:${binding.id}`;
      if (usedKeys.has(key)) continue;

      return {
        variantId: item.id,
        binding,
        templateSnapshot: snapshotForRender(binding, binding.template),
      };
    }
  }

  return null;
}
