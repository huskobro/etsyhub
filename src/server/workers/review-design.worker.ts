import type { Job } from "bullmq";
import { Prisma, ProviderKind, ReviewStatus, ReviewStatusSource } from "@prisma/client";
import { db } from "@/server/db";
import { logger } from "@/lib/logger";
import { getReviewProvider } from "@/providers/review/registry";
import { runAlphaChecks } from "@/server/services/review/alpha-checks";
import {
  computeScoringBreakdown,
  decideReviewStatusFromBreakdown,
} from "@/server/services/review/decision";
import {
  applyReviewDecisionWithSticky,
  isAlreadyScoredBySystem,
} from "@/server/services/review/sticky";
import { buildProviderSnapshot } from "@/providers/review/snapshot";
import { REVIEW_PROMPT_VERSION } from "@/providers/review/prompt";
import { composeReviewSystemPrompt } from "@/providers/review/criteria";
import { getResolvedReviewConfig } from "@/server/services/settings/review.service";
import { readRiskFlagKind } from "@/providers/review/types";
import type { ReviewRiskFlag, ImageInput } from "@/providers/review/types";
import { getStorage } from "@/providers/storage";
import { getUserAiModeSettings } from "@/features/settings/ai-mode/service";
import { assertWithinDailyBudget } from "@/server/services/cost/budget";
import { recordCostUsage } from "@/server/services/cost/track-usage";

/**
 * REVIEW_DESIGN worker — Phase 6 review pipeline orkestrasyon.
 *
 * Tek worker, iki kaynak: AI generated designs (cloud asset) ve local
 * library assets (disk'te dosya). Discriminated union payload `scope`
 * field'ı ile ayrılır; tek `JobType.REVIEW_DESIGN` enum'ı kullanılır.
 *
 * Pipeline:
 *   1. Job al → kayıt fetch + ownership doğrula
 *   2. Sticky check (USER source ⇒ skip + log "user_sticky")
 *   3. Provider + apiKey resolve (per-user settings, encrypted at rest)
 *   4. Image input hazırla (remote signed URL veya local file path)
 *   5. Product-type gate (TRANSPARENT_TARGET_TYPES)
 *   6. Alpha checks (sadece local + transparent — AI mode'da ATLA)
 *   7. LLM review (selectable: kie-gemini-flash | google-gemini-flash)
 *   8. Merge alpha + LLM flags
 *   9. Decision (Task 6 deterministic kural)
 *  10. Persist (transaction): scope'a göre design veya local asset
 *
 * Kararlar:
 * - AI mode'da alpha-checks atlanır: cloud asset'in lokal path'i yok ve
 *   LLM zaten alpha kalitesini değerlendirir.
 * - DesignReview audit trail SADECE scope=design'da yazılır.
 *   LocalLibraryAsset için audit trail yok; review alanları satırın
 *   üstünde tutulur.
 * - reviewIssues legacy alanı YAZILMAZ — canonical alan reviewRiskFlags.
 *
 * Phase 6 Aşama 1 — Provider seçimi:
 * - settings.reviewProvider ("kie" default | "google-gemini") runtime'da
 *   resolve edilir; hardcoded provider id YASAK.
 * - "kie" ⇒ kieApiKey + provider id "kie-gemini-flash" (STUB; Aşama 2)
 * - "google-gemini" ⇒ geminiApiKey + provider id "google-gemini-flash"
 *   (mock-tested direct Google API)
 * - DesignReview audit + CostUsage `providerKey` runtime providerId yazar.
 *
 * BullMQ retry: bootstrap'ta blanket retry YOK (default 1 attempt).
 * Permanent error'lar (api key yok, image too large, Zod fail) tek seferde
 * fail; transient retry policy ayrı follow-up'a bırakıldı.
 */

const TRANSPARENT_TARGET_TYPES = new Set(["clipart", "sticker", "transparent_png"]);

/** Signed URL TTL (saniye): provider tek seferlik fetch yapar; 1 saat fazlasıyla yeter. */
const SIGNED_URL_TTL_SECONDS = 60 * 60;

/**
 * Provider response `costCents` taşımıyorsa (örn. mock test) defansif fallback.
 * Conservative estimate: 1 cent. Gerçek faturalama değil; real-time pricing
 * carry-forward (`cost-real-time-pricing` Phase 7+).
 */
const REVIEW_ESTIMATED_COST_CENTS_FALLBACK = 1;

export type ReviewDesignJobPayload = {
  scope: "design";
  generatedDesignId: string;
  userId: string;
};

/**
 * Task 10 — local batch endpoint payload'ında `productTypeKey` ZORUNLU.
 * Sessiz default YASAK: çağrı tarafı (örn. POST /api/review/local-batch) Zod
 * ile required field olarak validate eder; gelmezse 400 döner. Worker burada
 * fallback yapmaz — payload'da yoksa TypeScript zaten compile time'da
 * yakalar; runtime'da herhangi bir caller bypass ederse ilk `productKey`
 * kullanımında crash olur (beklenen davranış: kontrolsüz default yok).
 */
export type ReviewLocalAssetJobPayload = {
  scope: "local";
  localAssetId: string;
  userId: string;
  productTypeKey: string;
};

export type ReviewJobPayload = ReviewDesignJobPayload | ReviewLocalAssetJobPayload;

export type ReviewJobResult = {
  skipped: boolean;
  reason?: string;
  status?: ReviewStatus;
  score?: number;
};

export async function handleReviewDesign(
  job: Job<ReviewJobPayload>,
): Promise<ReviewJobResult> {
  const payload = job.data;
  if (payload.scope === "design") {
    return await handleDesignReview(job, payload);
  }
  return await handleLocalAssetReview(job, payload);
}

async function handleDesignReview(
  job: Job<ReviewJobPayload>,
  payload: ReviewDesignJobPayload,
): Promise<ReviewJobResult> {
  const design = await db.generatedDesign.findUnique({
    where: { id: payload.generatedDesignId },
    include: { asset: true, productType: true },
  });
  if (!design) {
    throw new Error(`generatedDesign not found: ${payload.generatedDesignId}`);
  }
  if (design.userId !== payload.userId) {
    throw new Error(
      `ownership mismatch for generatedDesign ${payload.generatedDesignId}`,
    );
  }

  // Sticky check (R12): USER yazdıysa SYSTEM dokunamaz.
  // systemDecision burada placeholder; gerçek karar aşağıda decision'dan gelir.
  // Helper sadece "yazma izni" sinyali için kullanılıyor.
  const stickyGate = applyReviewDecisionWithSticky({
    current: { status: design.reviewStatus, source: design.reviewStatusSource },
    systemDecision: ReviewStatus.PENDING,
  });
  if (!stickyGate.shouldUpdate) {
    logger.info(
      { jobId: job.id, designId: design.id, scope: "design" },
      "review skipped — user_sticky",
    );
    return { skipped: true, reason: "user_sticky" };
  }

  // Already-scored guard (CLAUDE.md Madde N — scoring cost disiplini).
  // SYSTEM tarafından zaten dolu bir snapshot + reviewedAt varsa ikinci
  // kez Gemini çağrısı yapmıyoruz. Re-score için PATCH route'u snapshot'ları
  // null'lar (reset) veya invalidation helper karar resetler — ikisi de
  // bu guard'ı doğal olarak açar (reviewedAt = null sonrası yeniden
  // skor verilebilir). Defansif olarak hem snapshot hem reviewedAt
  // kontrol eder.
  if (
    isAlreadyScoredBySystem({
      reviewedAt: design.reviewedAt,
      reviewProviderSnapshot: design.reviewProviderSnapshot,
      source: design.reviewStatusSource,
    })
  ) {
    logger.info(
      {
        jobId: job.id,
        designId: design.id,
        scope: "design",
        existingScore: design.reviewScore,
        existingStatus: design.reviewStatus,
      },
      "review skipped — already_scored (reset to re-score)",
    );
    return { skipped: true, reason: "already_scored", status: design.reviewStatus, score: design.reviewScore ?? undefined };
  }

  // Daily budget guardrail (Task 18) — sticky'den sonra, provider resolve'dan
  // önce. USER sticky early-return üstte yer aldığı için override edilmiş
  // kayıtlar budget tüketmez. Limit aşılırsa explicit throw (sessiz skip YASAK);
  // kullanıcı UI'da error görür.
  await assertWithinDailyBudget(payload.userId, ProviderKind.AI);

  // Phase 6 Aşama 1 — Provider + apiKey resolve (settings.reviewProvider).
  // "kie" ⇒ kie-gemini-flash + kieApiKey (STUB throw); "google-gemini" ⇒
  // google-gemini-flash + geminiApiKey (mock-tested).
  const { providerId, apiKey } = await resolveReviewProviderConfig(payload.userId);

  // Image input — AI mode: cloud asset; signed URL üret.
  const signedUrl = await getStorage().signedUrl(
    design.asset.storageKey,
    SIGNED_URL_TTL_SECONDS,
  );
  const image: ImageInput = { kind: "remote-url", url: signedUrl };

  // Product type gate — AI mode'da alpha-checks ATLA (cloud asset, LLM yeterli).
  const productKey = design.productType.key;
  const isTransparent = TRANSPARENT_TARGET_TYPES.has(productKey);
  const alphaFlags: ReviewRiskFlag[] = []; // AI mode: skip

  // LLM review (selectable provider)
  const provider = getReviewProvider(providerId);
  const llm = await provider.review(
    { image, productType: productKey, isTransparentTarget: isTransparent },
    { apiKey },
  );

  // Merge alpha + LLM flags
  const allFlags: ReviewRiskFlag[] = [...alphaFlags, ...llm.riskFlags];

  // IA Phase 17 (Madde O) — admin-resolved review config drives compose
  // and scoring math. coreMasterPrompt override + per-criterion override
  // (label / weight / severity / applicability) merge done in
  // getResolvedReviewConfig.
  const reviewConfig = await getResolvedReviewConfig(payload.userId);
  const ctx = {
    productType: productKey,
    format: design.asset.mimeType.replace("image/", "").toLowerCase(),
    hasAlpha: design.asset.hasAlpha,
    sourceKind: "design" as const,
    transformsApplied: [] as string[],
  };
  const composed = composeReviewSystemPrompt(ctx, {
    coreMasterPrompt: reviewConfig.settings.coreMasterPrompt ?? undefined,
    criteria: reviewConfig.criteria,
  });

  // Weighted scoring math (CLAUDE.md Madde O — score is explainable).
  const flagKinds = allFlags
    .map((f) => readRiskFlagKind(f))
    .filter((k): k is string => k !== null);
  const breakdown = computeScoringBreakdown({
    providerRaw: llm.score,
    riskFlagKinds: flagKinds,
    criteria: reviewConfig.criteria.filter((c) =>
      composed.selectedCriterionIds.includes(c.id),
    ),
  });
  const decision = decideReviewStatusFromBreakdown(breakdown);

  const providerSnapshot = buildProviderSnapshot(providerId, new Date());
  const promptSnapshot = `${REVIEW_PROMPT_VERSION}\nfingerprint=${composed.fingerprint}\n${composed.systemPrompt}`;

  // Persist (K2 — sticky TOCTOU race fix):
  //   T1 sticky read + T2 Gemini fetch (1-30sn) arasında USER "Approve anyway"
  //   yazabilir. updateMany + conditional WHERE (`reviewStatusSource ≠ USER`)
  //   atomik bir last-write guard sağlar. count===0 ⇒ USER araya girdi,
  //   audit insert YAPMA, skip log + return.
  //
  //   K1 — DesignReview rerun crash fix:
  //   `generatedDesignId @unique` nedeniyle ikinci başarılı SYSTEM run'unda
  //   create P2002 atıyordu (Task 9 auto-enqueue / Task 11 reset rerun).
  //   upsert ile create dalı ilk review'da, update dalı sonraki review'larda
  //   son review snapshot ile audit row'u override eder.
  //
  //   updateMany ve audit upsert artık **iki ayrı çağrı** — atomik tek
  //   transaction içinde count check + conditional yapamıyoruz (Prisma fluent
  //   $transaction array bağlantı kuramaz). Pratikte mini-pencere
  //   (MS-aralığı) kabul edilebilir; design kaydında zaten tüm review state
  //   var (reviewProviderSnapshot/reviewPromptSnapshot) — audit "best effort".
  const updateResult = await db.generatedDesign.updateMany({
    where: {
      id: design.id,
      reviewStatusSource: { not: ReviewStatusSource.USER },
    },
    data: {
      reviewStatus: decision,
      reviewStatusSource: ReviewStatusSource.SYSTEM,
      // IA Phase 17 — reviewScore artık policy-adjusted final score.
      // Provider raw + breakdown audit row'da (DesignReview.responseSnapshot).
      reviewScore: breakdown.finalScore,
      reviewSummary: llm.summary,
      reviewRiskFlags: allFlags as unknown as Prisma.InputJsonValue,
      textDetected: llm.textDetected,
      gibberishDetected: llm.gibberishDetected,
      reviewedAt: new Date(),
      reviewProviderSnapshot: providerSnapshot,
      reviewPromptSnapshot: promptSnapshot,
    },
  });

  if (updateResult.count === 0) {
    logger.warn(
      { jobId: job.id, designId: design.id, scope: "design" },
      "review skipped — user_sticky_race (USER wrote during Gemini call)",
    );
    return { skipped: true, reason: "user_sticky_race" };
  }

  // K1 — upsert: ikinci başarılı review'da DesignReview row override edilir.
  // Audit semantik "son review snapshot'ı" — zaman serisi audit Phase 7+ follow-up.
  // Phase 6 Aşama 2A: audit.model = provider.modelId (gerçek model string;
  // provider id ↔ model id ayrımı reviewer Ö4 carry-forward kapanışı).
  // IA Phase 17 — audit'e provider raw skor + breakdown + fingerprint
  // birlikte yazılır. UI/admin "neden bu skor?" sorusuna provider raw
  // ile policy-adjusted final arasındaki delta'yı görerek cevap verir.
  const auditData = {
    reviewer: "system",
    score: breakdown.finalScore,
    decision,
    provider: providerId,
    model: provider.modelId,
    promptSnapshot: composed.systemPrompt,
    responseSnapshot: {
      ...llm,
      _breakdown: breakdown,
      _fingerprint: composed.fingerprint,
      _providerRaw: llm.score,
    } as unknown as Prisma.InputJsonValue,
  };
  await db.designReview.upsert({
    where: { generatedDesignId: design.id },
    create: { generatedDesignId: design.id, ...auditData },
    update: auditData,
  });

  // Best-effort cost insert (Task 18). Review state primary truth — cost
  // tracking fail review state'i bozmamalı; cross-job rollback YOK. Fail
  // durumunda log + devam.
  try {
    await recordCostUsage({
      userId: payload.userId,
      providerKind: ProviderKind.AI,
      providerKey: providerId,
      model: provider.modelId,
      units: 1,
      costCents: llm.costCents ?? REVIEW_ESTIMATED_COST_CENTS_FALLBACK,
    });
  } catch (costErr) {
    logger.error(
      {
        jobId: job.id,
        designId: design.id,
        userId: payload.userId,
        err: costErr instanceof Error ? costErr.message : String(costErr),
      },
      "cost tracking failed; review state committed",
    );
  }

  logger.info(
    {
      jobId: job.id,
      designId: design.id,
      providerId,
      status: decision,
      score: llm.score,
      flagCount: allFlags.length,
    },
    "review_design completed",
  );
  return { skipped: false, status: decision, score: llm.score };
}

async function handleLocalAssetReview(
  job: Job<ReviewJobPayload>,
  payload: ReviewLocalAssetJobPayload,
): Promise<ReviewJobResult> {
  const asset = await db.localLibraryAsset.findUnique({
    where: { id: payload.localAssetId },
  });
  if (!asset) {
    throw new Error(`localLibraryAsset not found: ${payload.localAssetId}`);
  }
  if (asset.userId !== payload.userId) {
    throw new Error(
      `ownership mismatch for localLibraryAsset ${payload.localAssetId}`,
    );
  }

  // Sticky check
  const stickyGate = applyReviewDecisionWithSticky({
    current: { status: asset.reviewStatus, source: asset.reviewStatusSource },
    systemDecision: ReviewStatus.PENDING,
  });
  if (!stickyGate.shouldUpdate) {
    logger.info(
      { jobId: job.id, assetId: asset.id, scope: "local" },
      "review skipped — user_sticky",
    );
    return { skipped: true, reason: "user_sticky" };
  }

  // Already-scored guard (CLAUDE.md Madde N) — design branch ile aynı.
  if (
    isAlreadyScoredBySystem({
      reviewedAt: asset.reviewedAt,
      reviewProviderSnapshot: asset.reviewProviderSnapshot,
      source: asset.reviewStatusSource,
    })
  ) {
    logger.info(
      {
        jobId: job.id,
        assetId: asset.id,
        scope: "local",
        existingScore: asset.reviewScore,
        existingStatus: asset.reviewStatus,
      },
      "review skipped — already_scored (reset to re-score)",
    );
    return { skipped: true, reason: "already_scored", status: asset.reviewStatus, score: asset.reviewScore ?? undefined };
  }

  // Daily budget guardrail (Task 18) — design branch ile aynı sıra; DRY refactor
  // Dalga B reviewer Ö1 carry-forward, bu dalgada paralel implementasyon.
  await assertWithinDailyBudget(payload.userId, ProviderKind.AI);

  // Phase 6 Aşama 1 — Provider + apiKey resolve (settings.reviewProvider).
  const { providerId, apiKey } = await resolveReviewProviderConfig(payload.userId);

  // Image input — Local mode: disk path
  const image: ImageInput = { kind: "local-path", filePath: asset.filePath };

  // Product type — Task 10 kararı: payload'dan ZORUNLU okunur, sessiz default
  // yok. Caller (batch endpoint) Zod ile validate ediyor; gelmezse 400.
  const productKey = payload.productTypeKey;
  const isTransparent = TRANSPARENT_TARGET_TYPES.has(productKey);

  // Local mode + transparent ⇒ alpha-checks ÇALIŞTIR; aksi halde skip.
  const alphaFlags: ReviewRiskFlag[] = isTransparent
    ? await runAlphaChecks(asset.filePath)
    : [];

  // LLM review (selectable provider)
  const provider = getReviewProvider(providerId);
  const llm = await provider.review(
    { image, productType: productKey, isTransparentTarget: isTransparent },
    { apiKey },
  );

  const allFlags: ReviewRiskFlag[] = [...alphaFlags, ...llm.riskFlags];

  // IA Phase 17 — admin-resolved review config + weighted scoring math
  // (design branch ile aynı pipeline).
  const reviewConfig = await getResolvedReviewConfig(payload.userId);
  const ctx = {
    productType: productKey,
    format: asset.mimeType.replace("image/", "").toLowerCase(),
    hasAlpha: asset.hasAlpha,
    sourceKind: "local-library" as const,
    transformsApplied: [] as string[],
  };
  const composed = composeReviewSystemPrompt(ctx, {
    coreMasterPrompt: reviewConfig.settings.coreMasterPrompt ?? undefined,
    criteria: reviewConfig.criteria,
  });
  const flagKinds = allFlags
    .map((f) => readRiskFlagKind(f))
    .filter((k): k is string => k !== null);
  const breakdown = computeScoringBreakdown({
    providerRaw: llm.score,
    riskFlagKinds: flagKinds,
    criteria: reviewConfig.criteria.filter((c) =>
      composed.selectedCriterionIds.includes(c.id),
    ),
  });
  const decision = decideReviewStatusFromBreakdown(breakdown);
  const providerSnapshot = buildProviderSnapshot(providerId, new Date());
  const promptSnapshot = `${REVIEW_PROMPT_VERSION}\nfingerprint=${composed.fingerprint}\n${composed.systemPrompt}`;

  // Persist — LocalLibraryAsset; audit trail YOK (DesignReview yalnız scope=design).
  // K2 — sticky TOCTOU race guard: updateMany + conditional WHERE.
  // count===0 ⇒ USER araya girdi (Gemini fetch sırasında) ⇒ skip + log.
  const updateResult = await db.localLibraryAsset.updateMany({
    where: {
      id: asset.id,
      reviewStatusSource: { not: ReviewStatusSource.USER },
    },
    data: {
      reviewStatus: decision,
      reviewStatusSource: ReviewStatusSource.SYSTEM,
      // IA Phase 17 — policy-adjusted final score (provider raw audit'te).
      reviewScore: breakdown.finalScore,
      reviewSummary: llm.summary,
      reviewRiskFlags: allFlags as unknown as Prisma.InputJsonValue,
      reviewedAt: new Date(),
      reviewProviderSnapshot: providerSnapshot,
      reviewPromptSnapshot: promptSnapshot,
    },
  });

  if (updateResult.count === 0) {
    logger.warn(
      { jobId: job.id, assetId: asset.id, scope: "local" },
      "review skipped — user_sticky_race (USER wrote during Gemini call)",
    );
    return { skipped: true, reason: "user_sticky_race" };
  }

  // Best-effort cost insert (Task 18). Aynı pattern — cost tracking fail
  // local asset review state'i bozmaz.
  // Phase 6 Aşama 2A: model = provider.modelId (gerçek model string).
  try {
    await recordCostUsage({
      userId: payload.userId,
      providerKind: ProviderKind.AI,
      providerKey: providerId,
      model: provider.modelId,
      units: 1,
      costCents: llm.costCents ?? REVIEW_ESTIMATED_COST_CENTS_FALLBACK,
    });
  } catch (costErr) {
    logger.error(
      {
        jobId: job.id,
        assetId: asset.id,
        userId: payload.userId,
        err: costErr instanceof Error ? costErr.message : String(costErr),
      },
      "cost tracking failed; review state committed",
    );
  }

  logger.info(
    {
      jobId: job.id,
      assetId: asset.id,
      providerId,
      status: decision,
      score: llm.score,
      flagCount: allFlags.length,
    },
    "review_local_asset completed",
  );
  return { skipped: false, status: decision, score: llm.score };
}

/**
 * Per-user review provider + apiKey resolve. Phase 6 Aşama 1.
 *
 * `settings.reviewProvider` ("kie" default | "google-gemini") runtime'da
 * provider id ve ilgili apiKey'i döner. Eksik key durumunda explicit throw
 * (sessiz fallback YASAK); kullanıcı UI'da "Settings → AI Mode" yön mesajı görür.
 *
 * - "kie" ⇒ kieApiKey + provider id "kie-gemini-flash" (Aşama 2'de impl)
 * - "google-gemini" ⇒ geminiApiKey + provider id "google-gemini-flash"
 *   (mock-tested direct Google API)
 */
async function resolveReviewProviderConfig(
  userId: string,
): Promise<{ providerId: string; apiKey: string }> {
  const settings = await getUserAiModeSettings(userId);
  const choice = settings.reviewProvider;

  if (choice === "kie") {
    const key = settings.kieApiKey;
    if (!key || key.trim() === "") {
      throw new Error(
        `kie review provider seçili ama kieApiKey ayarlanmamış (Settings → AI Mode); userId=${userId}`,
      );
    }
    return { providerId: "kie-gemini-flash", apiKey: key };
  }

  // choice === "google-gemini"
  const key = settings.geminiApiKey;
  if (!key || key.trim() === "") {
    throw new Error(
      `google-gemini review provider seçili ama geminiApiKey ayarlanmamış (Settings → AI Mode); userId=${userId}`,
    );
  }
  return { providerId: "google-gemini-flash", apiKey: key };
}
