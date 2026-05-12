// Phase 5 §4 — variation-jobs orchestration service.
//
// Sözleşme:
//   - createVariationJobs: N design + N job + N enqueue (R17.4 paralel kuyruk)
//   - capability decision route'ta yapılır (R17.1); service prop olarak alır
//   - promptSnapshot create anında lock'lanır (R15 snapshot kuralı)
//   - aspectRatio + quality persist edilir (sessiz default fallback engelle)
//   - Worker (Task 10) bu rows'u UPDATE eder; create burada
//
// Atomicity (R17.1, fail-fast):
//   - design + job DB writes tek `db.$transaction` içinde commit edilir
//     (kısmi DB tutarsızlığı YOK)
//   - enqueue dış kaynak — transaction'a sokulmaz; commit sonrası ayrı
//     try/catch'le çağrılır. Bir enqueue fail ederse o design + job
//     FAIL'a düşürülür (silent stuck QUEUED YASAK). Diğerleri korunur —
//     kısmi başarı meşru.
//
// Reference.asset.sourceUrl → i2i için public URL kaynağı (schema cross-check
// not: Reference'ta imageUrl alanı YOK; truth Asset.sourceUrl).
//
// Phase 5 closeout hotfix (2026-04-29): per-user `kieApiKey` settings'ten
// resolve edilir ve enqueue payload'una eklenir. Eksik key durumunda explicit
// throw — sessiz fallback YASAK. Phase 6 review provider ile simetrik pattern.
import { db } from "@/server/db";
import {
  JobType,
  JobStatus,
  VariationCapability,
  VariationState,
  type Reference,
} from "@prisma/client";
import { enqueue } from "@/server/queue";
import { buildImagePrompt } from "@/features/variation-generation/prompt-builder";
import type { ImageGenerateInput, ImageCapability } from "@/providers/image/types";
import { getUserAiModeSettings } from "@/features/settings/ai-mode/service";
import {
  BudgetExceededError,
  assertWithinBudget,
  resolveTaskModel,
} from "@/server/services/settings/budget-guard.service";
import { logger } from "@/lib/logger";

export type CreateVariationJobsInput = {
  userId: string;
  reference: Reference;
  /** i2i için public URL — route'ta Asset.sourceUrl üzerinden geçirilir. */
  referenceImageUrl?: string;
  providerId: string;
  /** Route'ta karar verilir (R17.1). */
  capability: ImageCapability;
  aspectRatio: ImageGenerateInput["aspectRatio"];
  quality?: "medium" | "high";
  brief?: string;
  count: number;
  systemPrompt: string;
  promptVersionId?: string | null;
};

export type CreateVariationJobsOutput = {
  /** Enqueue başarısı sonrası QUEUED kalan design id'ler. */
  designIds: string[];
  /** Enqueue fail edip FAIL'a düşürülen design id'ler. */
  failedDesignIds: string[];
  /**
   * Batch-first Phase 2 — bu çağrıdan oluşan batchId.
   * UI variation submit sonrası "View Batch" handoff CTA'sında kullanır.
   * batchId canonical olarak Job.metadata içinde durmaya devam eder
   * (schema-zero); bu alan yalnız response payload'da yüzeye çıkar.
   */
  batchId: string;
};

export async function createVariationJobs(
  input: CreateVariationJobsInput,
): Promise<CreateVariationJobsOutput> {
  // Phase 5 closeout hotfix: per-user `kieApiKey` resolve. Eksik key
  // durumunda enqueue ÖNCE explicit throw — sessiz fallback YASAK; kullanıcı
  // UI'da "Settings → AI Mode" yön mesajı görür. Phase 6 review provider'ıyla
  // simetrik (`resolveReviewProviderConfig` patterni).
  const settings = await getUserAiModeSettings(input.userId);
  const kieApiKey = settings.kieApiKey;
  if (!kieApiKey || kieApiKey.trim() === "") {
    throw new Error(
      `kieApiKey ayarlanmamış (Settings → AI Mode'dan KIE anahtarı girin); userId=${input.userId}`,
    );
  }

  // R10 — Workspace task assignment + budget guard.
  // Variation üretimi pre-flight cost estimate: KIE midjourney ~$0.024/call.
  // N-count toplam estimate UserSetting key=aiProviders.spendLimits.kie
  // ile karşılaştırılır. Aşılırsa BudgetExceededError.
  const taskAssignment = await resolveTaskModel({
    userId: input.userId,
    taskKey: "variation",
  });
  const VARIATION_CALL_COST_CENTS = 24; // KIE midjourney baseline
  const totalCostCents = VARIATION_CALL_COST_CENTS * input.count;
  try {
    await assertWithinBudget({
      userId: input.userId,
      providerKey: taskAssignment.providerKey,
      costEstimateCents: totalCostCents,
    });
  } catch (err) {
    if (err instanceof BudgetExceededError) {
      logger.warn(
        {
          userId: input.userId,
          providerKey: err.providerKey,
          window: err.window,
          spent: err.spentCents,
          limit: err.limitCents,
          requested: totalCostCents,
        },
        "variation enqueue blocked by budget guard",
      );
      throw new Error(
        `Bütçe aşımı (${err.window}): ${err.providerKey} provider için ` +
          `${(err.limitCents / 100).toFixed(2)}$ limit, harcanmış ` +
          `${(err.spentCents / 100).toFixed(2)}$. Settings → AI Providers ` +
          `→ spend limits.`,
      );
    }
    throw err;
  }

  const prompt = buildImagePrompt({
    systemPrompt: input.systemPrompt,
    brief: input.brief,
    capability: input.capability,
  });

  const dbCapability =
    input.capability === "image-to-image"
      ? VariationCapability.IMAGE_TO_IMAGE
      : VariationCapability.TEXT_TO_IMAGE;

  // IA-37 — Batch lineage. Bu çağrıdan oluşan tüm N variation job
  // aynı `batchId`'yi paylaşır; review queue scope priority bu kimliği
  // batch > reference baskınlığına göre kullanır (CLAUDE.md Madde G,
  // schema-zero pattern). cuid2 ile generate ederiz; ileride
  // `WorkflowRun` tablosu canonical lineage'ı taşıdığında bu alan
  // o tabloyla mapping'lenir.
  const { createId } = await import("@paralleldrive/cuid2");
  const batchId = createId();

  // Transaction: N design + N job atomik commit. Hiçbiri yarıda kalmaz.
  // designId ↔ jobId eşlemesi index'le korunur (transaction içinde job
  // create design'a ait metadata.designId set eder).
  const created = await db.$transaction(async (tx) => {
    const designs = await Promise.all(
      Array.from({ length: input.count }).map(() =>
        tx.generatedDesign.create({
          data: {
            userId: input.userId,
            referenceId: input.reference.id,
            assetId: input.reference.assetId,
            productTypeId: input.reference.productTypeId,
            providerId: input.providerId,
            capabilityUsed: dbCapability,
            promptSnapshot: prompt,
            briefSnapshot: input.brief ?? null,
            promptVersionId: input.promptVersionId ?? null,
            state: VariationState.QUEUED,
            aspectRatio: input.aspectRatio,
            quality: input.quality ?? null,
          },
        }),
      ),
    );
    // Sıralı pair'ler: tx.job.create ile design.id'yi metadata'ya
    // koyuyoruz; her design için 1 job. for-of ile pair tutmak indexing
    // tipini undefined'lamadan korur.
    const pairs: Array<{ design: typeof designs[number]; job: Awaited<ReturnType<typeof tx.job.create>> }> = [];
    for (const d of designs) {
      const job = await tx.job.create({
        data: {
          type: JobType.GENERATE_VARIATIONS,
          status: JobStatus.QUEUED,
          userId: input.userId,
          progress: 0,
          // IA-37 — batchId share'lenir; review scope priority
          // (batch > reference) bu alandan beslenir.
          metadata: {
            designId: d.id,
            referenceId: input.reference.id,
            batchId,
          },
        },
      });
      pairs.push({ design: d, job });
    }
    return pairs;
  });

  // Enqueue: dış kaynak — transaction sonrası ayrı çağrılır. Bir tanesi
  // fail ederse o design+job FAIL'a düşürülür; diğerleri korunur.
  const designIds: string[] = [];
  const failedDesignIds: string[] = [];

  await Promise.all(
    created.map(async ({ design, job }) => {
      try {
        await enqueue(JobType.GENERATE_VARIATIONS, {
          jobId: job.id,
          userId: input.userId,
          designId: design.id,
          providerId: input.providerId,
          prompt,
          referenceUrls:
            input.capability === "image-to-image" && input.referenceImageUrl
              ? [input.referenceImageUrl]
              : undefined,
          aspectRatio: input.aspectRatio,
          quality: input.quality,
          // Phase 5 closeout hotfix: per-user kieApiKey worker'a iletilir.
          // BullMQ Redis'e plain text yazılır (Phase 6 review patterniyle aynı);
          // queue payload encryption Phase 7+ hardening carry-forward.
          kieApiKey,
        });
        designIds.push(design.id);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "enqueue failed";
        await failDesignAndJob(design.id, job.id, `enqueue failed: ${msg}`);
        failedDesignIds.push(design.id);
      }
    }),
  );

  // Batch-first Phase 2 — `batchId` API response'a çıkar. Variation submit
  // sonrası UI "View Batch" handoff CTA'sı için gerekli; kullanıcı bağlamı
  // batch'e taşır. batchId hâlâ Job.metadata içinde canonical kalır (schema-
  // zero); response sadece o kimliği yüzeye çıkarır.
  return { designIds, failedDesignIds, batchId };
}

/**
 * Enqueue başarısız olduğunda design + job tutarlı şekilde FAIL'a düşürür.
 * Worker'daki `failDesign` ile aynı sözleşme: job.error ve design.errorMessage
 * AYNI mesaj — debugging tek truth.
 */
export async function failDesignAndJob(
  designId: string,
  jobId: string,
  msg: string,
): Promise<void> {
  await db.generatedDesign.update({
    where: { id: designId },
    data: { state: VariationState.FAIL, errorMessage: msg },
  });
  await db.job.update({
    where: { id: jobId },
    data: { status: JobStatus.FAILED, error: msg, finishedAt: new Date() },
  });
}
