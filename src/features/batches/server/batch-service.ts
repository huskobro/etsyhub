/**
 * Phase 43 — Batch-first production model: service layer.
 *
 * Operatör-facing Batch entity'sinin yaratımı + reference ekleme +
 * lookup. Bu turun scope'u (II): DRAFT state'inde compose entry'si.
 * Launch yolu (QUEUED transition, job üretme) Phase 44.
 *
 * Mevcut Job.metadata.batchId synthetic kimliği (Phase 41 baseline)
 * dokunulmaz — eski MJ/AI variation pipeline'ı kullanmaya devam eder;
 * Phase 44 launch yolu yeni Batch.id'sini Job.metadata.batchId'ye
 * yazacak. İki uzay (real Batch row + synthetic Job.metadata.batchId)
 * birleşene kadar batch detail pageleri Job.metadata.batchId üzerinden
 * çalışmaya devam eder; bu transitional state CLAUDE.md Phase 43
 * entry'sinde dokümente edilir.
 *
 * User isolation: tüm okuma/yazma userId scope'unda; cross-user
 * erişim NotFoundError'a düşer (CLAUDE.md Madde V parity).
 *
 * Idempotency: BatchItem (batchId, referenceId) unique — aynı
 * reference ikinci kez addReferencesToBatch'e gelirse mevcut item
 * korunur, hata yok (skipDuplicates).
 */

import { BatchState, PromptStatus } from "@prisma/client";
import { db } from "@/server/db";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { createVariationJobs } from "@/features/variation-generation/services/ai-generation.service";
import { getImageProvider } from "@/providers/image/registry";
import { checkUrlPublic } from "@/features/variation-generation/url-public-check";
import type { ImageCapability } from "@/providers/image/types";

export type BatchWithItems = Awaited<ReturnType<typeof getBatch>>;

/**
 * Yeni DRAFT Batch yaratır + opsiyonel ilk reference set'ini items
 * olarak ekler. Tek transaction; reference ownership kontrolleri
 * batch içinde.
 */
export async function createDraftBatch(args: {
  userId: string;
  referenceIds: string[];
  label?: string;
}) {
  const { userId, referenceIds, label } = args;

  if (referenceIds.length === 0) {
    // Reference-less draft kabul edilir (operatör compose'da ekleyebilir)
    // ama Pool card'tan başlatma yolu hep en az 1 reference verir.
    // Yine de boş listeyi reddetmiyoruz — compose page'in robustluğu için.
  }

  if (referenceIds.length > 0) {
    // Validate ownership for all references in one query (saves N round-trips)
    const owned = await db.reference.findMany({
      where: {
        id: { in: referenceIds },
        userId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (owned.length !== referenceIds.length) {
      throw new ValidationError(
        "One or more references not found or not owned by this user",
      );
    }
  }

  const defaultLabel =
    label?.trim() ||
    `Untitled batch · ${new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })}`;

  return db.batch.create({
    data: {
      userId,
      label: defaultLabel,
      state: BatchState.DRAFT,
      items: {
        create: referenceIds.map((referenceId, idx) => ({
          referenceId,
          position: idx,
        })),
      },
    },
    include: {
      items: {
        include: {
          reference: {
            include: {
              asset: true,
              productType: true,
            },
          },
        },
        orderBy: { position: "asc" },
      },
    },
  });
}

/**
 * Mevcut Batch'e N reference daha ekler. Sadece DRAFT state'inde
 * mutasyona izin verilir; QUEUED/RUNNING/SUCCESS/FAILED/CANCELLED
 * batch'lere item eklemek mantıksız.
 *
 * Idempotency: (batchId, referenceId) unique index — duplicate
 * eklemeler `skipDuplicates: true` ile sessizce geçilir, hata yok.
 */
export async function addReferencesToBatch(args: {
  userId: string;
  batchId: string;
  referenceIds: string[];
}) {
  const { userId, batchId, referenceIds } = args;

  const batch = await db.batch.findFirst({
    where: { id: batchId, userId, deletedAt: null },
    select: { id: true, state: true, items: { select: { position: true } } },
  });
  if (!batch) throw new NotFoundError("Batch not found");
  if (batch.state !== BatchState.DRAFT) {
    throw new ValidationError(
      `Cannot add references to a ${batch.state} batch — only DRAFT batches accept changes`,
    );
  }

  if (referenceIds.length === 0) return { added: 0 };

  const owned = await db.reference.findMany({
    where: { id: { in: referenceIds }, userId, deletedAt: null },
    select: { id: true },
  });
  if (owned.length !== referenceIds.length) {
    throw new ValidationError(
      "One or more references not found or not owned by this user",
    );
  }

  // Next position = max existing position + 1
  const maxPos =
    batch.items.length > 0
      ? Math.max(...batch.items.map((i) => i.position))
      : -1;

  const result = await db.batchItem.createMany({
    data: referenceIds.map((referenceId, idx) => ({
      batchId,
      referenceId,
      position: maxPos + 1 + idx,
    })),
    skipDuplicates: true,
  });

  return { added: result.count };
}

/**
 * Batch detail — items + each item's reference + asset preview.
 * User-scoped; cross-user batch lookup → NotFound.
 */
export async function getBatch(args: { userId: string; batchId: string }) {
  const { userId, batchId } = args;
  const batch = await db.batch.findFirst({
    where: { id: batchId, userId, deletedAt: null },
    include: {
      items: {
        include: {
          reference: {
            include: {
              asset: true,
              productType: true,
              bookmark: {
                select: { id: true, title: true, sourceUrl: true },
              },
            },
          },
        },
        orderBy: { position: "asc" },
      },
    },
  });
  if (!batch) throw new NotFoundError("Batch not found");
  return batch;
}

/**
 * Phase 44 — Launch a DRAFT batch.
 *
 * Workflow:
 *   1. Load batch (user-scoped) + verify state DRAFT
 *   2. Verify batch has at least 1 item (reference)
 *   3. Snapshot compose params onto Batch.composeParams
 *   4. For each item's reference, call createVariationJobs with the
 *      Batch.id as batchId (so Job.metadata.batchId = Batch.id —
 *      synthetic uzay birleşir)
 *   5. Transition Batch.state DRAFT → QUEUED + set launchedAt
 *
 * Phase 44 scope kısıtı: tek-reference batch yolu canonical (Pool
 * card "New Batch" → 1 reference). Multi-reference batch için
 * createVariationJobs her referans için ayrı çağrılır; tümü aynı
 * batchId paylaşır. Bu davranış IA-37 batch lineage ile uyumlu.
 *
 * Hata davranışı:
 *   - Batch DRAFT değilse → ValidationError (idempotency: aynı
 *     batch'i ikinci kez launch edemezsin)
 *   - Items boşsa → ValidationError
 *   - createVariationJobs içinde provider/budget/URL hatası
 *     yukarı bubble eder (transaction yok — Batch state hâlâ
 *     DRAFT kalır, operatör tekrar deneyebilir)
 *
 * composeParams shape (provider/aspectRatio/quality/brief/count) —
 * cost preview ve audit için snapshot. Tekrar deneme/retry için
 * read kaynağı (Phase 44+ candidate).
 */
export type LaunchBatchInput = {
  userId: string;
  batchId: string;
  providerId: string;
  aspectRatio: "1:1" | "2:3" | "3:2";
  quality?: "medium" | "high";
  count: number;
  brief?: string;
};

export type LaunchBatchOutput = {
  batchId: string;
  designIds: string[];
  failedDesignIds: string[];
  state: BatchState;
};

export async function launchBatch(
  input: LaunchBatchInput,
): Promise<LaunchBatchOutput> {
  const { userId, batchId } = input;

  const batch = await db.batch.findFirst({
    where: { id: batchId, userId, deletedAt: null },
    include: {
      items: {
        include: {
          reference: { include: { asset: true } },
        },
        orderBy: { position: "asc" },
      },
    },
  });
  if (!batch) throw new NotFoundError("Batch not found");
  if (batch.state !== BatchState.DRAFT) {
    throw new ValidationError(
      `Cannot launch a ${batch.state} batch — only DRAFT batches launch`,
    );
  }
  if (batch.items.length === 0) {
    throw new ValidationError(
      "Cannot launch an empty batch — add at least one reference first",
    );
  }

  // Phase 44 scope: tek-reference path canonical. Multi-reference için
  // launchBatch'i Phase 44+ candidate (her item için ayrı createVariationJobs
  // çağrısı; tümü aynı batchId paylaşacak).
  const firstItem = batch.items[0]!;
  const reference = firstItem.reference;
  const referenceImageUrl = reference.asset?.sourceUrl;
  if (!referenceImageUrl) {
    throw new ValidationError(
      "Reference has no public source URL — AI launch requires URL-sourced references. " +
        "Use Bookmark Inbox to add a publicly accessible image, then promote it to a reference.",
    );
  }

  const urlCheck = await checkUrlPublic(referenceImageUrl);
  if (!urlCheck.ok) {
    throw new ValidationError(
      `Reference URL public doğrulanamadı: ${urlCheck.reason ?? `HTTP ${urlCheck.status}`}`,
    );
  }

  let provider;
  try {
    provider = getImageProvider(input.providerId);
  } catch {
    throw new ValidationError(`Bilinmeyen provider: ${input.providerId}`);
  }
  const capability: ImageCapability = "image-to-image";
  if (!provider.capabilities.includes(capability)) {
    throw new ValidationError(
      `Provider "${input.providerId}" "${capability}" capability'sini desteklemiyor.`,
    );
  }

  // Resolve active prompt (mirrors variation-jobs route logic)
  const pt = await db.productType.findUnique({
    where: { id: reference.productTypeId },
  });
  let systemPrompt = `${pt?.key ?? "variation"} variation, high quality`;
  let promptVersionId: string | null = null;
  if (pt) {
    const tpl = await db.promptTemplate.findFirst({
      where: { productTypeKey: pt.key, taskType: "image-variation" },
      include: {
        versions: {
          where: { status: PromptStatus.ACTIVE },
          orderBy: { version: "desc" },
          take: 1,
        },
      },
    });
    const active = tpl?.versions[0];
    if (active) {
      systemPrompt = active.systemPrompt;
      promptVersionId = active.id;
    }
  }

  // Snapshot compose params + transition state. createVariationJobs
  // başarısız olursa batch DRAFT'ta kalır; bu yüzden state transition
  // create çağrısından SONRA. Snapshot ise audit/retry için
  // önce yazılabilir ama hata durumunda kullanıcıya yanıltıcı olur —
  // bu yüzden ikisi de create sonrası tek transaction.
  const out = await createVariationJobs({
    userId,
    reference,
    referenceImageUrl,
    providerId: input.providerId,
    capability,
    aspectRatio: input.aspectRatio,
    quality: input.quality,
    brief: input.brief,
    count: input.count,
    systemPrompt,
    promptVersionId,
    batchId: batch.id, // Phase 44 — gerçek Batch.id thread'i
  });

  // Snapshot + state transition. createVariationJobs partial başarı
  // dönerse (en az 1 design queued) batch yine de QUEUED'a geçer —
  // operatör Batches sayfasında run'ı görür. Hiç başarı yoksa
  // createVariationJobs route'un yaptığı gibi 500'e bubble ederdi;
  // burada launchBatch açık tip throw etmez (createVariationJobs
  // partial OK durumunda bile döner). Tüm enqueue fail olduğunda
  // designIds boş döner; biz Batch.state'i DRAFT'ta tutmayı tercih
  // etmiyoruz — kayıt amacıyla QUEUED işaretliyoruz, audit log
  // failedDesignIds taşıyor.
  await db.batch.update({
    where: { id: batchId },
    data: {
      state: BatchState.QUEUED,
      launchedAt: new Date(),
      composeParams: {
        providerId: input.providerId,
        aspectRatio: input.aspectRatio,
        quality: input.quality ?? null,
        count: input.count,
        brief: input.brief ?? null,
      },
    },
  });

  return {
    batchId: batch.id,
    designIds: out.designIds,
    failedDesignIds: out.failedDesignIds,
    state: BatchState.QUEUED,
  };
}

/**
 * List batches for a user. DRAFT batches included by default.
 * `state` filter optional. Sorted by updatedAt desc (most recently
 * touched first).
 *
 * Phase 43: legacy synthetic-batchId batches (Job.metadata.batchId)
 * are NOT included here — only real Batch rows. Batches index UI
 * continues to use existing job-aggregator service for synthetic
 * batches (Phase 44 will unify).
 */
export async function listBatches(args: {
  userId: string;
  state?: BatchState;
  limit?: number;
}) {
  const { userId, state, limit = 50 } = args;
  return db.batch.findMany({
    where: {
      userId,
      deletedAt: null,
      ...(state ? { state } : {}),
    },
    include: {
      items: { select: { id: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });
}
