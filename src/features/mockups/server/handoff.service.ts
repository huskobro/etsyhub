// Phase 8 Task 5 — SelectionSet → MockupJob handoff service.
//
// Spec §3.4 atomic creation. Phase 7 service emsali:
//   src/server/services/selection/sets.service.ts (Prisma transaction,
//   ownership guard, fail-fast hatalar, cross-user 404).
//
// Spec §1.4 contract:
//   - SelectionSet.status === "ready" guard
//   - hero fallback: position 0 (status≠rejected)
//   - aspectRatio fallback chain: generatedDesign → productType → null
//
// Spec §3.4 atomic transaction:
//   1. SelectionSet fetch + ownership guard (cross-user 404)
//   2. Status guard
//   3. templateIds validation (1..8)
//   4. Active templates fetch (status=ACTIVE + categoryId match)
//   5. resolveBinding loop (her template için active binding)
//   6. setSnapshotId hash (§3.3)
//   7. buildPackSelection (deterministik pack — Task 5 stub)
//   8. Prisma $transaction:
//      a. MockupJob create (totalRenders = actualPackSize)
//      b. MockupRender rows eager (PENDING + templateSnapshot)
//      c. coverRenderId update (pack[0].id)
//   9. BullMQ dispatch (Task 5 stub — Task 7'de gerçek implementation)
//   10. Return jobId

import type { MockupTemplate, MockupTemplateBinding } from "@prisma/client";
import { db } from "@/server/db";
import { AppError } from "@/lib/errors";
import { resolveBinding } from "@/providers/mockup";
import {
  buildPackSelection,
  type PackSelectionItem,
} from "./pack-selection.service";
import { queueMockupRenderJobs } from "@/jobs/mockup-render.queue";
import {
  computeSetSnapshotId,
  snapshotForRender,
  resolveAspectRatio,
  type SelectionSetWithItems,
} from "./snapshot.service";

// ────────────────────────────────────────────────────────────
// Custom hata sınıfları (cross-user 404 + 4xx kategorileri).
// Phase 7 emsali: src/lib/errors.ts AppError extend paterni.
// ────────────────────────────────────────────────────────────

/** 404 — set yok veya cross-user (varlık sızıntısı yasak). */
export class SetNotFoundError extends AppError {
  constructor(message = "Selection set bulunamadı") {
    super(message, "SET_NOT_FOUND", 404);
  }
}

/** 409 — set status hazır değil (draft/archived) veya yapısal eksik. */
export class InvalidSetError extends AppError {
  constructor(message = "Set hazır durumda değil") {
    super(message, "INVALID_SET", 409);
  }
}

/** 400 — templateIds eksik / fazla / cap aşımı. */
export class InvalidTemplatesError extends AppError {
  constructor(message = "Template seçimi geçersiz") {
    super(message, "INVALID_TEMPLATES", 400);
  }
}

/** 409 — template aktif binding bulunmuyor / aspect uyumsuz / yok. */
export class TemplateInvalidError extends AppError {
  constructor(message = "Template geçersiz") {
    super(message, "TEMPLATE_INVALID", 409);
  }
}

// ────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────

export type CreateMockupJobInput = {
  userId: string;
  setId: string;
  /** V1: tek kategori. V2'de genişler. */
  categoryId: "canvas";
  templateIds: string[];
};

export type CreateMockupJobOutput = {
  jobId: string;
};

/**
 * SelectionSet → MockupJob atomic handoff.
 *
 * Hata disiplini:
 *   - Cross-user / yok set → SetNotFoundError (404, varlık sızıntısı yok)
 *   - Set status ≠ ready → InvalidSetError (409)
 *   - templateIds 0 veya > 8 → InvalidTemplatesError (400)
 *   - Bulunamayan/inactive template → InvalidTemplatesError (400)
 *   - Template'te active binding yok → TemplateInvalidError (409)
 *   - Pack üretilemedi (compatibility 0) → TemplateInvalidError (409)
 *   - Tüm variant aspect null → InvalidSetError (409, set-level fail)
 */
export async function createMockupJob(
  input: CreateMockupJobInput,
): Promise<CreateMockupJobOutput> {
  // 1) SelectionSet fetch + cross-user 404 disiplini.
  const set = await db.selectionSet.findUnique({
    where: { id: input.setId },
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

  if (!set || set.userId !== input.userId) {
    throw new SetNotFoundError();
  }

  // 2) Status guard.
  if (set.status !== "ready") {
    throw new InvalidSetError(
      "Set 'ready' değil; önce finalize et",
    );
  }

  // 3) templateIds validation (Zod cap'leri burada da elle koru — defense
  //    in depth; route handler zaten Zod parse etmiş olmalı).
  if (input.templateIds.length === 0) {
    throw new InvalidTemplatesError("En az 1 template gerekli");
  }
  if (input.templateIds.length > 8) {
    throw new InvalidTemplatesError("En fazla 8 template seçilebilir");
  }
  // Duplicate id reject (sessiz dedupe yerine fail-fast).
  const uniqueIds = new Set(input.templateIds);
  if (uniqueIds.size !== input.templateIds.length) {
    throw new InvalidTemplatesError("Template id'leri tekrarlı olamaz");
  }

  // 4) Active templates fetch (sadece ACTIVE + categoryId match + active
  //    binding).
  const templates = await db.mockupTemplate.findMany({
    where: {
      id: { in: input.templateIds },
      categoryId: input.categoryId,
      status: "ACTIVE",
    },
    include: { bindings: { where: { status: "ACTIVE" } } },
  });

  if (templates.length !== input.templateIds.length) {
    throw new InvalidTemplatesError(
      "Bazı template'ler bulunamadı veya aktif değil",
    );
  }

  // 5) resolveBinding loop — her template için active binding bul.
  const bindingPairs: {
    template: MockupTemplate;
    binding: MockupTemplateBinding;
  }[] = [];
  for (const tpl of templates) {
    const binding = resolveBinding(tpl);
    if (!binding) {
      throw new TemplateInvalidError(
        `Template ${tpl.id}: aktif binding yok`,
      );
    }
    bindingPairs.push({ template: tpl, binding });
  }

  // 5b) Aspect-resolved item'lar (set-level fail eğer hiç resolved yok).
  const validItems = set.items.filter(
    (item) =>
      item.status !== "rejected" && resolveAspectRatio(item) !== null,
  );
  if (validItems.length === 0) {
    throw new InvalidSetError(
      "Bu set için aspect ratio bilgisi yok; Phase 7'de farklı aspect'lerle hazırla",
    );
  }

  // 6) setSnapshotId — §3.4 deterministik hash.
  const setSnapshotId = computeSetSnapshotId(set as SelectionSetWithItems);

  // 7) Pack selection (Task 8 — gerçek 3-katmanlı algoritma:
  //    aspect filter → cover → template diversity → variant rotation).
  //    Aspect filter için template referansı şart; bindingPairs (template +
  //    binding tuple'ları) doğrudan geçilir.
  const packItems: PackSelectionItem[] = validItems.map((item) => ({
    id: item.id,
    aspectRatio: resolveAspectRatio(item)!,
    position: item.position,
  }));
  const pack = buildPackSelection(packItems, bindingPairs, 10);

  if (pack.slots.length === 0) {
    // Compatibility filter sonrası hiç valid pair yok.
    throw new TemplateInvalidError(
      "Bu set ile uyumlu template yok (aspect ratio uyumsuz)",
    );
  }

  // Helper — slot.binding.id'sinden template'i bul (snapshot için).
  const bindingIdToTemplate = new Map<string, MockupTemplate>();
  for (const { template, binding } of bindingPairs) {
    bindingIdToTemplate.set(binding.id, template);
  }

  // 8) Atomic transaction.
  const jobId = await db.$transaction(async (tx) => {
    const job = await tx.mockupJob.create({
      data: {
        userId: input.userId,
        setId: set.id,
        setSnapshotId,
        categoryId: input.categoryId,
        status: "QUEUED",
        packSize: 10,
        actualPackSize: pack.slots.length,
        totalRenders: pack.slots.length,
        coverRenderId: null, // pack[0] render id'si yaratıldıktan sonra set
      },
    });

    // Render row'larını sırayla yarat — packPosition sırası garantili.
    // (Promise.all ile paralel yaratılırsa packPosition'lar doğru kalır
    // ama deterministiklik açısından sequential daha güvenli.)
    const renders: { id: string; packPosition: number | null }[] = [];
    for (let idx = 0; idx < pack.slots.length; idx++) {
      const slot = pack.slots[idx]!;
      const template = bindingIdToTemplate.get(slot.binding.id);
      if (!template) {
        // Bu durum oluşmamalı — bindingPairs map'i exhaustive.
        throw new TemplateInvalidError(
          `Binding ${slot.binding.id} için template bulunamadı (invariant ihlali)`,
        );
      }
      const render = await tx.mockupRender.create({
        data: {
          jobId: job.id,
          variantId: slot.variantId,
          bindingId: slot.binding.id,
          templateSnapshot: snapshotForRender(
            slot.binding,
            template,
          ) as object,
          packPosition: idx,
          selectionReason: slot.selectionReason,
          status: "PENDING",
        },
      });
      renders.push({ id: render.id, packPosition: render.packPosition });
    }

    // Cover invariant: packPosition=0 render'ın id'si.
    const coverRender = renders[0]!;
    await tx.mockupJob.update({
      where: { id: job.id },
      data: { coverRenderId: coverRender.id },
    });

    return job.id;
  });

  // 9) BullMQ dispatch (Task 5 stub — Task 7'de gerçek implementation).
  const renderRows = await db.mockupRender.findMany({
    where: { jobId },
    select: { id: true },
  });
  await queueMockupRenderJobs(
    jobId,
    renderRows.map((r) => r.id),
  );

  return { jobId };
}
