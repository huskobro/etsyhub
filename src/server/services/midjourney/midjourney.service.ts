// Midjourney service — yeni job enqueue + bridge ingest orchestration.
//
// Sözleşme:
//   1. createMidjourneyJob: kullanıcıdan gelen prompt+params'ı bridge'e
//      gönderir, EtsyHub `Job` + `MidjourneyJob` row'larını açar, BullMQ
//      MIDJOURNEY_BRIDGE worker'ı tetikler.
//   2. pollAndUpdate: worker'ın çağırdığı; bridge'den state çeker, DB'yi
//      senkronize eder, terminal state'te ingest tetikler.
//   3. ingestOutputs: COLLECTING_OUTPUTS / COMPLETED state'te bridge'den
//      her grid item'ı download eder, MinIO'ya upload eder, Asset +
//      MidjourneyAsset row'larını açar.
//
// Pass 42 V1 SCOPE:
//   - Yalnız `kind: generate`. Describe/Upscale/Variation V1.x carry-forward.
//   - `referenceId` opsiyonel (image-to-image değil; sadece lineage tag).
//   - GeneratedDesign opt-in — default oluşturulmaz; UI'dan "Review'a
//     gönder" tetikler (Pass 42 V1: stub, V1.x'te eklenecek).

import { JobType, JobStatus, MidjourneyJobState, MidjourneyJobKind, MJVariantKind, Prisma, type MidjourneyJob } from "@prisma/client";
import { db } from "@/server/db";
import { logger } from "@/lib/logger";
import { sha256 } from "@/lib/hash";
import { getStorage } from "@/providers/storage";
import { env } from "@/lib/env";
import { enqueue } from "@/server/queue";
import { ensureMidjourneyBridgeWorker } from "@/server/workers/midjourney-bridge.bootstrap";
import type { MidjourneyBridgeJobPayload } from "@/server/workers/midjourney-bridge.worker";
import {
  BridgeUnreachableError,
  getBridgeClient,
  type BridgeClient,
  type BridgeDescribeRequest,
  type BridgeGenerateRequest,
  type BridgeJobSnapshot,
  type BridgeJobState,
} from "./bridge-client";
import { bulkPromoteMidjourneyAssets } from "./promote";

/**
 * Bridge → DB state map (string identical, ama Prisma enum tip'ine cast).
 */
const STATE_MAP: Record<BridgeJobState, MidjourneyJobState> = {
  QUEUED: "QUEUED",
  OPENING_BROWSER: "OPENING_BROWSER",
  AWAITING_LOGIN: "AWAITING_LOGIN",
  AWAITING_CHALLENGE: "AWAITING_CHALLENGE",
  SUBMITTING_PROMPT: "SUBMITTING_PROMPT",
  WAITING_FOR_RENDER: "WAITING_FOR_RENDER",
  COLLECTING_OUTPUTS: "COLLECTING_OUTPUTS",
  DOWNLOADING: "DOWNLOADING",
  IMPORTING: "IMPORTING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
};

const TERMINAL_STATES: ReadonlyArray<MidjourneyJobState> = [
  "COMPLETED",
  "FAILED",
  "CANCELLED",
];

export type CreateMidjourneyJobInput = {
  userId: string;
  prompt: string;
  aspectRatio: BridgeGenerateRequest["params"]["aspectRatio"];
  version?: string;
  referenceId?: string;
  productTypeId?: string;
  /** Ek params — promptParams JSON'a yazılır. */
  styleRaw?: boolean;
  stylize?: number;
  chaos?: number;
  /**
   * Pass 65 — Image-prompt URL'leri. MJ V8 web "Add Images → Image Prompts"
   * popover'ından file input'a upload edilir (driver attachImagePrompts).
   *
   * Sözleşme (R17.2):
   *   - Sadece HTTPS (R17.2: local file path / data: URI yasak)
   *   - Public erişilebilir (bridge browser context'i auth/cookie'siz fetch'ler)
   *   - Max 10 URL (MJ web pratikte 4-5 üstü için backed-up uyarı veriyor)
   *
   * `MidjourneyJob.referenceUrls` Prisma alanına yazılır + bridge'e
   * `imagePromptUrls` olarak iletilir.
   */
  referenceUrls?: string[];
  /**
   * Pass 71/75 — `--sref URL [URL ...]` style reference. Pass 75'te
   * weight desteği eklendi (`URL::N` AutoSail pattern).
   *
   * Backward-compatible:
   *   - `string`: `--sref URL`
   *   - `{ url, weight? }`: weight!=1 ise `--sref URL::N`
   * Service validator HTTPS-only + max 5 + weight 0-1000 kontrol.
   */
  styleReferenceUrls?: Array<string | { url: string; weight?: number }>;
  /**
   * Pass 75.1 — Global `--sw N` style weight (0-1000). Per-URL `::N`
   * weight ile ortogonal — MJ UI'da "Style Weight" etiketi bunu
   * yansıtır. AutoSail main.js literal kanıt:
   * `["ow","sw","cw","chaos","stylize","weird","sv"]`.
   */
  styleWeight?: number;
  /**
   * Pass 71 — `--oref URL` omni reference (V7+ premium). Tek URL.
   * `buildMJPromptString` Pass 65'ten beri destekliyor; sadece UI/service
   * input alanı eksikti (Pass 71'de eklendi).
   */
  omniReferenceUrl?: string;
  /** Pass 71 — `--ow N` omni weight (0-1000). */
  omniWeight?: number;
  /**
   * Pass 73 — Character reference (V6-only) `--cref URL [URL ...]`.
   * AutoSail audit kanıtı: weight yok, max 5 URL pratikte.
   * `omniReferenceUrl` ile mutually-exclusive (V6 vs V7+) — ikisi
   * birden geldiyse service ValidationError.
   */
  characterReferenceUrls?: string[];
  /**
   * Pass 71 — API-first submit opt-in flag.
   * @deprecated Pass 74 — `submitStrategy` field'ı tercih edilir.
   * `preferApiSubmit: true` → `submitStrategy: "api-first"` ile aynı.
   */
  preferApiSubmit?: boolean;
  /**
   * Pass 74 — Submit strategy preference.
   * "auto" (default): bridge capability bazında en sağlam yolu seçer.
   *   Generate için: image-prompt yoksa API-first; varsa DOM (Pass 73
   *   guard mantığı `auto` ile aynı sonuca varır).
   * "api-first": önce API; fail → DOM fallback.
   * "dom-first": önce DOM; fail → API fallback.
   * Kullanıcı UI'dan per-job override eder; preferences.defaultSubmitStrategy
   * varsayılanı belirler.
   */
  submitStrategy?: "auto" | "api-first" | "dom-first";
  /**
   * Pass 84 — Batch lineage. Caller (batch service) bunu set eder; tek
   * job (UI Test Render) için undefined kalır. Job.metadata'ya yazılır
   * → sonradan getBatchSummary(batchId) ile resolve edilir.
   * Schema değişikliği YOK — Job.metadata JSON reuse.
   */
  batchMeta?: {
    batchId: string;
    batchIndex: number;
    batchTotal: number;
    /** UI gösterimi için template snapshot. */
    templateId?: string;
    promptTemplate?: string;
    /** Bu job'un input variables. */
    variables?: Record<string, string>;
  };
};

/** Pass 65 — image-prompt URL kontratı (R17.2). */
const REFERENCE_URLS_MAX = 10;
const STYLE_REFERENCE_URLS_MAX = 5; // MJ pratiği: --sref 5+ URL'de truncate
function validateReferenceUrls(raw: string[] | undefined): string[] {
  if (!raw || raw.length === 0) return [];
  const cleaned = raw.map((u) => u.trim()).filter((u) => u.length > 0);
  if (cleaned.length > REFERENCE_URLS_MAX) {
    throw new Error(
      `referenceUrls max ${REFERENCE_URLS_MAX} (geçen: ${cleaned.length})`,
    );
  }
  for (const u of cleaned) {
    if (!u.startsWith("https://")) {
      throw new Error(
        `referenceUrls SADECE HTTPS kabul eder (R17.2). Hatalı: ${u.slice(0, 80)}`,
      );
    }
  }
  return cleaned;
}
/**
 * Pass 71/75 — Style reference URL kontratı (--sref).
 *
 * Backward-compatible: string veya `{ url, weight? }` mix kabul eder.
 * HTTPS-only + max 5 + weight (verilirse) 0-1000 integer.
 *
 * Output: bridge'e Array<string | { url, weight }> olarak iletilir;
 * weight verilmediyse veya weight=1 ise saf string'e dönüştürülür
 * (bridge buildMJPromptString iki tipi de handle eder ama saflaştırma
 * audit log + DB representation'ı düzgün tutar).
 */
function validateStyleReferenceUrls(
  raw: Array<string | { url: string; weight?: number }> | undefined,
): Array<string | { url: string; weight: number }> {
  if (!raw || raw.length === 0) return [];
  const cleaned: Array<string | { url: string; weight: number }> = [];
  for (const entry of raw) {
    const url = typeof entry === "string" ? entry.trim() : entry.url.trim();
    if (url.length === 0) continue;
    if (!url.startsWith("https://")) {
      throw new Error(
        `styleReferenceUrls SADECE HTTPS kabul eder (R17.2). Hatalı: ${url.slice(0, 80)}`,
      );
    }
    if (typeof entry === "string") {
      cleaned.push(url);
      continue;
    }
    const weight = entry.weight;
    if (typeof weight === "number") {
      if (
        !Number.isInteger(weight) ||
        weight < 0 ||
        weight > 1000
      ) {
        throw new Error(
          `styleReferenceUrls weight 0-1000 arası tam sayı olmalı. Hatalı: ${weight}`,
        );
      }
      // Pass 75 — weight=1 default; saf string'e indir
      if (weight === 1) {
        cleaned.push(url);
      } else {
        cleaned.push({ url, weight });
      }
    } else {
      cleaned.push(url);
    }
  }
  if (cleaned.length > STYLE_REFERENCE_URLS_MAX) {
    throw new Error(
      `styleReferenceUrls max ${STYLE_REFERENCE_URLS_MAX} (geçen: ${cleaned.length})`,
    );
  }
  return cleaned;
}
/** Pass 71 — Omni reference URL kontratı (--oref). Tek HTTPS URL. */
function validateOmniReferenceUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const cleaned = raw.trim();
  if (cleaned.length === 0) return undefined;
  if (!cleaned.startsWith("https://")) {
    throw new Error(
      `omniReferenceUrl SADECE HTTPS kabul eder (R17.2). Hatalı: ${cleaned.slice(0, 80)}`,
    );
  }
  return cleaned;
}
/** Pass 73 — Character reference (V6-only) URL kontratı (--cref).
 * HTTPS-only + max 5 + weight YOK. */
const CHARACTER_REFERENCE_URLS_MAX = 5;
function validateCharacterReferenceUrls(
  raw: string[] | undefined,
): string[] {
  if (!raw || raw.length === 0) return [];
  const cleaned = raw.map((u) => u.trim()).filter((u) => u.length > 0);
  if (cleaned.length > CHARACTER_REFERENCE_URLS_MAX) {
    throw new Error(
      `characterReferenceUrls max ${CHARACTER_REFERENCE_URLS_MAX} (geçen: ${cleaned.length})`,
    );
  }
  for (const u of cleaned) {
    if (!u.startsWith("https://")) {
      throw new Error(
        `characterReferenceUrls SADECE HTTPS kabul eder (R17.2). Hatalı: ${u.slice(0, 80)}`,
      );
    }
  }
  return cleaned;
}

export type CreateMidjourneyJobResult = {
  midjourneyJob: MidjourneyJob;
  /** EtsyHub Job entity id — admin/jobs sayfasında görünür. */
  jobId: string;
  /** Bridge tarafı UUID. */
  bridgeJobId: string;
};

/**
 * Yeni MJ job enqueue.
 *
 * Akış:
 *   1. Bridge'e POST /jobs (sync — bridge anında accept eder, state QUEUED).
 *   2. EtsyHub `Job` row açılır (type: MIDJOURNEY_BRIDGE).
 *   3. EtsyHub `MidjourneyJob` row açılır (bridgeJobId + jobId bağlı).
 *   4. BullMQ MIDJOURNEY_BRIDGE queue'ya polling job ekle.
 *   5. Caller (Variation Atölyesi UI veya admin) snapshot döndürülür.
 */
export async function createMidjourneyJob(
  input: CreateMidjourneyJobInput,
  bridgeClient: BridgeClient = getBridgeClient(),
): Promise<CreateMidjourneyJobResult> {
  // Pass 65 — Image-prompt URL validation (R17.2 HTTPS-only + max 10).
  const referenceUrls = validateReferenceUrls(input.referenceUrls);
  // Pass 71 — Style + Omni reference validation.
  const styleReferenceUrls = validateStyleReferenceUrls(
    input.styleReferenceUrls,
  );
  const omniReferenceUrl = validateOmniReferenceUrl(input.omniReferenceUrl);
  const omniWeight =
    typeof input.omniWeight === "number" &&
    input.omniWeight >= 0 &&
    input.omniWeight <= 1000
      ? Math.round(input.omniWeight)
      : undefined;
  // Pass 75.1 — Global style weight (--sw N), 0-1000 integer.
  const styleWeight =
    typeof input.styleWeight === "number" &&
    input.styleWeight >= 0 &&
    input.styleWeight <= 1000
      ? Math.round(input.styleWeight)
      : undefined;
  // Pass 73 — Character reference (V6-only) validation.
  const characterReferenceUrls = validateCharacterReferenceUrls(
    input.characterReferenceUrls,
  );
  // Pass 73 — cref / oref mutually-exclusive guard. AutoSail audit
  // kanıtı: cref V6-only, oref V7+. MJ tarafı ikisini birden kabul
  // etmez. Frontend pre-validation + service-level redundant check.
  if (characterReferenceUrls.length > 0 && omniReferenceUrl) {
    throw new Error(
      "characterReferenceUrls (--cref) ve omniReferenceUrl (--oref) birlikte gönderilemez. " +
        "cref V6-only, oref V7+; ikisinden birini seç.",
    );
  }

  // 1) Bridge enqueue.
  const bridgeReq: BridgeGenerateRequest = {
    kind: "generate",
    params: {
      prompt: input.prompt,
      aspectRatio: input.aspectRatio,
      version: input.version,
      styleRaw: input.styleRaw,
      stylize: input.stylize,
      chaos: input.chaos,
      // Pass 65 — bridge "Add Images → Image Prompts" popover üzerinden upload eder.
      ...(referenceUrls.length > 0 ? { imagePromptUrls: referenceUrls } : {}),
      // Pass 71 — sref / oref MJ tarafında prompt-string flag (--sref/--oref).
      // bridge `buildMJPromptString` Pass 65'ten beri destekliyor.
      ...(styleReferenceUrls.length > 0
        ? { styleReferenceUrls }
        : {}),
      ...(omniReferenceUrl ? { omniReferenceUrl } : {}),
      ...(omniWeight !== undefined ? { omniWeight } : {}),
      // Pass 75.1 — Global --sw N
      ...(styleWeight !== undefined ? { styleWeight } : {}),
      // Pass 73 — Character reference (V6-only). buildMJPromptString
      // `--cref URL list` flag eklemesi yapar.
      ...(characterReferenceUrls.length > 0
        ? { characterReferenceUrls }
        : {}),
      // Pass 71 — API-first submit opt-in (deprecated, Pass 74 strategy).
      ...(input.preferApiSubmit ? { preferApiSubmit: true } : {}),
      // Pass 74 — Submit strategy. preferApiSubmit ile birlikte verilirse
      // submitStrategy önceliklidir; preferApiSubmit:true + submitStrategy
      // verilmezse "api-first" (geriye uyumlu) olarak yorumlanır.
      ...(input.submitStrategy
        ? { submitStrategy: input.submitStrategy }
        : input.preferApiSubmit
          ? { submitStrategy: "api-first" as const }
          : {}),
    },
  };
  const snapshot = await bridgeClient.enqueueJob(bridgeReq);

  // 2-3) DB rows — atomic.
  const result = await db.$transaction(async (tx) => {
    const job = await tx.job.create({
      data: {
        userId: input.userId,
        type: JobType.MIDJOURNEY_BRIDGE,
        status: JobStatus.QUEUED,
        metadata: {
          bridgeJobId: snapshot.id,
          prompt: input.prompt.slice(0, 200), // truncate (admin display)
          // Pass 84 — Batch lineage (varsa). Sonradan
          // getBatchSummary(batchId) bu field üzerinden query yapar.
          ...(input.batchMeta
            ? {
                batchId: input.batchMeta.batchId,
                batchIndex: input.batchMeta.batchIndex,
                batchTotal: input.batchMeta.batchTotal,
                ...(input.batchMeta.templateId
                  ? { batchTemplateId: input.batchMeta.templateId }
                  : {}),
                ...(input.batchMeta.promptTemplate
                  ? {
                      batchPromptTemplate:
                        input.batchMeta.promptTemplate.slice(0, 500),
                    }
                  : {}),
                ...(input.batchMeta.variables
                  ? { batchVariables: input.batchMeta.variables }
                  : {}),
              }
            : {}),
        },
      },
    });
    const mjJob = await tx.midjourneyJob.create({
      data: {
        userId: input.userId,
        jobId: job.id,
        referenceId: input.referenceId,
        productTypeId: input.productTypeId,
        bridgeJobId: snapshot.id,
        kind: MidjourneyJobKind.GENERATE,
        state: STATE_MAP[snapshot.state],
        prompt: input.prompt,
        promptParams: bridgeReq.params as unknown as Prisma.InputJsonValue,
        // Pass 65 — Prisma referenceUrls alanı (Pass 42'den şemada yer ayrılı).
        referenceUrls,
      },
    });
    return { job, mjJob };
  });

  // Pass 50 — eksik BullMQ enqueue. Bridge job kabul etti; şimdi
  // EtsyHub worker'ı polling'e yönelik tetikle.
  const payload: MidjourneyBridgeJobPayload = {
    userId: input.userId,
    midjourneyJobId: result.mjJob.id,
    jobId: result.job.id,
  };
  // Pass 70 — Lazy worker bootstrap (Pass 69 carry-over bug #1).
  // Idempotent: ilk enqueue'da Worker'ı kayıtla et, sonrakilerde no-op.
  ensureMidjourneyBridgeWorker();
  await enqueue(JobType.MIDJOURNEY_BRIDGE, payload as unknown as Record<string, unknown>);

  logger.info(
    {
      userId: input.userId,
      midjourneyJobId: result.mjJob.id,
      bridgeJobId: snapshot.id,
    },
    "midjourney job created (bridge accepted + worker enqueued)",
  );

  return {
    midjourneyJob: result.mjJob,
    jobId: result.job.id,
    bridgeJobId: snapshot.id,
  };
}

/**
 * Pass 66 — Describe job enqueue (Pass 65 audit'in düzeltmesi).
 *
 * Akış:
 *   1. imageUrl HTTPS validation (R17.2)
 *   2. Bridge'e POST /jobs (kind="describe", imageUrl)
 *   3. EtsyHub Job + MidjourneyJob (kind=DESCRIBE) row açılır
 *   4. BullMQ MIDJOURNEY_BRIDGE worker poll'a alır
 *   5. Driver describe akışını çalıştırır → COMPLETED state'te
 *      mjMetadata.describePrompts[] dolar (pollAndUpdate snapshot'ı yansıtır)
 *
 * Describe çıktısı GÖRSEL DEĞİL prompt — ingestOutputs çağrılmaz
 * (snapshot.outputs boş). MidjourneyAsset row açılmaz.
 *
 * NOT: Pass 42 schema MidjourneyJobKind.DESCRIBE enum'unu zaten içeriyordu;
 * Pass 65 audit'te describe yok sanılmıştı, Pass 66 audit gerçek DOM yolunu
 * doğruladı. mjMetadata.describePrompts[] ile saklanır.
 */
export type CreateMidjourneyDescribeJobInput = {
  userId: string;
  imageUrl: string;
  /** Opsiyonel: hangi MidjourneyAsset'ten describe edildi (lineage). */
  sourceAssetId?: string;
  /**
   * Pass 78 — Universal submit strategy. Describe Pass 68'den beri
   * API + DOM fallback hibrit; bu alan ile kullanıcı strict yol seçebilir.
   * Default "auto" (mevcut Pass 68 davranışı).
   */
  submitStrategy?: "auto" | "api-first" | "dom-first";
};

export type CreateMidjourneyDescribeJobResult = {
  midjourneyJob: MidjourneyJob;
  jobId: string;
  bridgeJobId: string;
};

export async function createMidjourneyDescribeJob(
  input: CreateMidjourneyDescribeJobInput,
  bridgeClient: BridgeClient = getBridgeClient(),
): Promise<CreateMidjourneyDescribeJobResult> {
  // R17.2 — HTTPS only
  const url = input.imageUrl.trim();
  if (!url.startsWith("https://")) {
    throw new Error(
      `Describe imageUrl SADECE HTTPS kabul eder (R17.2). Hatalı: ${url.slice(0, 80)}`,
    );
  }

  // 1) Bridge enqueue
  const bridgeReq: BridgeDescribeRequest = {
    kind: "describe",
    imageUrl: url,
    // Pass 78 — strategy forward (geriye uyumlu, opsiyonel)
    ...(input.submitStrategy ? { submitStrategy: input.submitStrategy } : {}),
  };
  const snapshot = await bridgeClient.enqueueJob(bridgeReq);

  // 2-3) DB rows — atomic
  const result = await db.$transaction(async (tx) => {
    const job = await tx.job.create({
      data: {
        userId: input.userId,
        type: JobType.MIDJOURNEY_BRIDGE,
        status: JobStatus.QUEUED,
        metadata: {
          bridgeJobId: snapshot.id,
          kind: "describe",
          imageUrl: url.slice(0, 200),
          sourceAssetId: input.sourceAssetId ?? null,
        },
      },
    });
    const mjJob = await tx.midjourneyJob.create({
      data: {
        userId: input.userId,
        jobId: job.id,
        bridgeJobId: snapshot.id,
        kind: MidjourneyJobKind.DESCRIBE,
        state: STATE_MAP[snapshot.state],
        // Prompt alanı describe için imageUrl olarak doldurulur (display)
        prompt: `[describe] ${url.slice(0, 200)}`,
        // promptParams: bridge'e iletilen (kind + imageUrl)
        promptParams: bridgeReq as unknown as Prisma.InputJsonValue,
      },
    });
    return { job, mjJob };
  });

  // 4) BullMQ enqueue
  const payload: MidjourneyBridgeJobPayload = {
    userId: input.userId,
    midjourneyJobId: result.mjJob.id,
    jobId: result.job.id,
  };
  // Pass 70 — Lazy worker bootstrap (Pass 69 carry-over bug #1).
  // Idempotent: ilk enqueue'da Worker'ı kayıtla et, sonrakilerde no-op.
  ensureMidjourneyBridgeWorker();
  await enqueue(JobType.MIDJOURNEY_BRIDGE, payload as unknown as Record<string, unknown>);

  logger.info(
    {
      userId: input.userId,
      midjourneyJobId: result.mjJob.id,
      bridgeJobId: snapshot.id,
      sourceAssetId: input.sourceAssetId ?? null,
    },
    "midjourney describe job created",
  );

  return {
    midjourneyJob: result.mjJob,
    jobId: result.job.id,
    bridgeJobId: snapshot.id,
  };
}

// ============================================================================
// Pass 79 — Prompt Template + Variables wrapper.
//
// Domain-bağımsız `expandPromptTemplate` (src/lib/prompt-template.ts)
// üzerine MJ-spesifik wrapper. Operatör template + variables map'ini
// gönderir; service expand eder, sonra mevcut `createMidjourneyJob`'i
// çağırır. Tek yeni fonksiyon — bridge tarafı dokunulmadı.
//
// Tasarım hedefleri:
//   - createMidjourneyJob ile aynı kontrat (sadece prompt = expanded text)
//   - Eksik variable → ValidationError (gümbürtü olmasın)
//   - Audit metadata'ya template + variables yansır (sonradan re-run /
//     re-expand için kanıt)
//   - Provider-bağımsız (yarın DALL-E motorla aynı template)
//   - Geriye uyumlu: createMidjourneyJob hâlâ doğrudan kullanılabilir
//
// Kullanım örneği:
//   await createMidjourneyJobFromTemplate({
//     userId: admin.id,
//     promptTemplate: "{{subject}} in {{style}} style, {{palette}} palette",
//     promptVariables: {
//       subject: "boho mandala",
//       style: "minimalist",
//       palette: "earth tones",
//     },
//     aspectRatio: "1:1",
//     submitStrategy: "api-first",
//   });
//   → expanded: "boho mandala in minimalist style, earth tones palette"
// ============================================================================

export type CreateMidjourneyJobFromTemplateInput = Omit<
  CreateMidjourneyJobInput,
  "prompt"
> & {
  /** Mustache-uyumlu template, `{{variableName}}` syntax. */
  promptTemplate: string;
  /** Template'teki tüm `{{name}}`'ler için string değerler. */
  promptVariables: Record<string, string>;
};

export type CreateMidjourneyJobFromTemplateResult =
  CreateMidjourneyJobResult & {
    /** Expand sonucu (audit + UI gösterimi için). */
    expandedPrompt: string;
    /** Template'te bulunan ve değiştirilen variable'lar. */
    usedVariables: string[];
    /** variables map'inde olup template'te kullanılmamışlar (uyarı). */
    unusedVariables: string[];
  };

/**
 * Prompt template'i variables ile expand eder, sonra normal job oluşturur.
 *
 * Eksik variable → ValidationError (HTTP 400 mantığı).
 * Mevcut `createMidjourneyJob` davranışı aynen korunur (referenceId,
 * styleReferenceUrls, omniReferenceUrl, characterReferenceUrls, vs).
 */
export async function createMidjourneyJobFromTemplate(
  input: CreateMidjourneyJobFromTemplateInput,
  bridgeClient: BridgeClient = getBridgeClient(),
): Promise<CreateMidjourneyJobFromTemplateResult> {
  // Lazy import — domain-bağımsız helper
  const { expandPromptTemplate } = await import("@/lib/prompt-template");

  let expansion;
  try {
    expansion = expandPromptTemplate(
      input.promptTemplate,
      input.promptVariables,
      { onMissing: "throw" },
    );
  } catch (err) {
    throw new Error(
      `Prompt template expansion fail: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // Mevcut createMidjourneyJob'i çağır — diğer tüm field'lar aynen korunur
  const { promptTemplate: _t, promptVariables: _v, ...rest } = input;
  void _t;
  void _v;
  const baseResult = await createMidjourneyJob(
    {
      ...rest,
      prompt: expansion.expanded,
    },
    bridgeClient,
  );

  return {
    ...baseResult,
    expandedPrompt: expansion.expanded,
    usedVariables: expansion.usedVariables,
    unusedVariables: expansion.unusedVariables,
  };
}

// ============================================================================
// Pass 80 — Template Batch Generation V1.
//
// 1 template + N variable sets → N MidjourneyJob (sequential enqueue).
// Pass 79 createMidjourneyJobFromTemplate'in tekil kullanımını batch'e
// çevirir.
//
// Rate-limit / queue güvenliği (audit C):
//   - BullMQ MIDJOURNEY_BRIDGE worker concurrency=1
//   - Bridge job-manager 10sn min interval jobs arası
//   - Yani N job enqueue → bridge tek tek ~10sn aralıklarla işler
//   - Ekstra rate-limit logic GEREKMEZ (mevcut altyapı doğal koruma)
//
// Sözleşme:
//   - templateId verilirse persisted MJ template'i çözülür (Pass 80
//     templates service); aksi halde inline promptTemplate string kabul
//   - variableSets[] her bir entry → 1 job
//   - Tüm job'lar AYNI generate parametrelerini paylaşır (aspectRatio,
//     version, sref/oref/cref, strategy) — variable'lar sadece prompt
//     metnini değiştirir
//   - Tek job fail olsa bile diğerleri devam (best-effort)
//   - Sonuç: { results: PerJobResult[], totalSubmitted, totalFailed }
//
// Provider-bağımsızlık: bu service MJ-spesifik ama core "expand × N"
// pattern'i diğer provider'larda aynen kullanılabilir (DALL-E batch,
// Recraft batch, vs.). Sadece `createMidjourneyJob` çağrısı değişir.
// ============================================================================

export type CreateMidjourneyJobsFromTemplateBatchInput = Omit<
  CreateMidjourneyJobInput,
  "prompt"
> & {
  /**
   * Persisted MJ template id (Pass 80 templates service ile resolve).
   * Verilirse `promptTemplate` ignore edilir.
   */
  templateId?: string;
  /**
   * Inline template (templateId verilmediyse). Pass 79 fonksiyonuyla aynı.
   */
  promptTemplate?: string;
  /**
   * N adet variable set — her biri için ayrı job oluşturulur.
   * Eksik variable → o job ValidationError ile FAIL (diğerleri devam).
   */
  variableSets: Array<Record<string, string>>;
};

export type BatchPerJobResult =
  | {
      ok: true;
      index: number;
      midjourneyJobId: string;
      jobId: string;
      bridgeJobId: string;
      expandedPrompt: string;
      variables: Record<string, string>;
    }
  | {
      ok: false;
      index: number;
      error: string;
      variables: Record<string, string>;
    };

export type CreateMidjourneyJobsFromTemplateBatchResult = {
  /**
   * Pass 84 — Batch identity (cuid). Tüm batch job'larının
   * Job.metadata.batchId field'ında saklanır; sonradan
   * `getBatchSummary(batchId)` ile bu batch'in jobs listesi resolve edilir.
   * Schema değişikliği YAPILMADI — Job.metadata JSON reuse.
   */
  batchId: string;
  /** Pass 84 — batch oluşturma zamanı (UI'da "geçen 5 dakika önce..."). */
  batchCreatedAt: Date;
  templateSnapshot: {
    /** Resolve edilen template metni (persisted veya inline). */
    promptTemplate: string;
    /** Persisted ise template lineage. */
    templateId?: string;
    versionId?: string;
    version?: number;
  };
  totalRequested: number;
  totalSubmitted: number;
  totalFailed: number;
  results: BatchPerJobResult[];
};

/**
 * Batch enqueue: 1 template + N variable sets → N job.
 *
 * Sequential — Promise.all DEĞİL. Sebep: bridge tek tek alır zaten;
 * Promise.all enqueue race-condition + DB constraint riski olmasın diye
 * sıralı çağırırız. Performans kaybı yok — bridge yine 10sn min interval
 * işliyor.
 *
 * Best-effort: tek job fail olursa diğerleri devam eder. results[] ile
 * her job'un sonucu raporlanır. Caller HTTP response'ta totalFailed > 0
 * ise 207 Multi-Status semantik dönebilir (Pass 80 V1: 200 + results).
 */
export async function createMidjourneyJobsFromTemplateBatch(
  input: CreateMidjourneyJobsFromTemplateBatchInput,
  bridgeClient: BridgeClient = getBridgeClient(),
): Promise<CreateMidjourneyJobsFromTemplateBatchResult> {
  // 1) Template resolve (persisted veya inline)
  let promptTemplate: string;
  let templateMeta: { templateId?: string; versionId?: string; version?: number } = {};

  if (input.templateId) {
    const { getMjTemplate } = await import("./templates");
    const resolved = await getMjTemplate(input.templateId);
    if (!resolved) {
      throw new Error(
        `MJ template bulunamadı veya ACTIVE version yok: ${input.templateId}`,
      );
    }
    promptTemplate = resolved.promptTemplateText;
    templateMeta = {
      templateId: resolved.templateId,
      versionId: resolved.versionId,
      version: resolved.version,
    };
  } else if (input.promptTemplate) {
    promptTemplate = input.promptTemplate;
  } else {
    throw new Error(
      "templateId veya promptTemplate'den biri verilmeli",
    );
  }

  // 2) variableSets validation
  if (!Array.isArray(input.variableSets) || input.variableSets.length === 0) {
    throw new Error("variableSets en az 1 entry içermeli");
  }
  if (input.variableSets.length > 50) {
    throw new Error(
      `Batch max 50 variable set (geçen: ${input.variableSets.length}). ` +
        `Daha fazlası için ayrı batch.`,
    );
  }

  // 3) Sequential enqueue — her variable set için 1 job
  const { promptTemplate: _t, templateId: _tid, variableSets, ...rest } = input;
  void _t;
  void _tid;

  // Pass 84 — Batch identity (cuid). Tüm batch job'larının
  // Job.metadata.batchId field'ında saklanır.
  const { createId } = await import("@paralleldrive/cuid2");
  const batchId = createId();
  const batchCreatedAt = new Date();

  const results: BatchPerJobResult[] = [];
  let totalSubmitted = 0;
  let totalFailed = 0;

  for (let i = 0; i < variableSets.length; i++) {
    const variables = variableSets[i] ?? {};
    try {
      const jobResult = await createMidjourneyJobFromTemplate(
        {
          ...rest,
          promptTemplate,
          promptVariables: variables,
          // Pass 84 — Batch lineage Job.metadata'ya yazılır
          batchMeta: {
            batchId,
            batchIndex: i,
            batchTotal: variableSets.length,
            ...(templateMeta.templateId
              ? { templateId: templateMeta.templateId }
              : {}),
            promptTemplate,
            variables,
          },
        },
        bridgeClient,
      );
      results.push({
        ok: true,
        index: i,
        midjourneyJobId: jobResult.midjourneyJob.id,
        jobId: jobResult.jobId,
        bridgeJobId: jobResult.bridgeJobId,
        expandedPrompt: jobResult.expandedPrompt,
        variables,
      });
      totalSubmitted++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({
        ok: false,
        index: i,
        error: msg,
        variables,
      });
      totalFailed++;
    }
  }

  return {
    batchId,
    batchCreatedAt,
    templateSnapshot: {
      promptTemplate,
      ...templateMeta,
    },
    totalRequested: variableSets.length,
    totalSubmitted,
    totalFailed,
    results,
  };
}

/**
 * Worker polling step — bridge state → DB.
 *
 * Worker bunu 3sn aralıkla çağırır. Terminal state'e ulaşıldığında
 * `COMPLETED` ise ingest tetikler.
 *
 * Bridge erişilemez → MidjourneyJob FAILED + blockReason "browser-crashed".
 */
export async function pollAndUpdate(
  midjourneyJobId: string,
  bridgeClient: BridgeClient = getBridgeClient(),
  /**
   * Pass 60 — Upscale lineage. Worker payload'dan iletilir; ingestOutputs
   * yeni asset'i bu parent'la bağlar (variantKind=UPSCALE + parentAssetId).
   */
  upscaleParentAssetId?: string,
  /**
   * Pass 83 — Variation lineage. Worker payload'dan iletilir; ingestOutputs
   * yeni 4 asset'i bu parent'la bağlar (variantKind=VARIATION +
   * parentAssetId). Upscale'in tek asset'inden farklı olarak variation
   * 4 grid → 4 child asset; hepsi aynı parentAssetId'ye bağlanır.
   */
  variationParentAssetId?: string,
): Promise<{ state: MidjourneyJobState; isTerminal: boolean }> {
  const mjJob = await db.midjourneyJob.findUniqueOrThrow({
    where: { id: midjourneyJobId },
  });
  if (TERMINAL_STATES.includes(mjJob.state)) {
    return { state: mjJob.state, isTerminal: true };
  }

  let snapshot: BridgeJobSnapshot;
  try {
    snapshot = await bridgeClient.getJob(mjJob.bridgeJobId);
  } catch (err) {
    if (err instanceof BridgeUnreachableError) {
      const updated = await db.midjourneyJob.update({
        where: { id: midjourneyJobId },
        data: {
          state: MidjourneyJobState.FAILED,
          blockReason: "browser-crashed",
          failedReason: err.message,
          failedAt: new Date(),
        },
      });
      // EtsyHub Job side
      if (mjJob.jobId) {
        await db.job.update({
          where: { id: mjJob.jobId },
          data: {
            status: JobStatus.FAILED,
            error: err.message,
            finishedAt: new Date(),
          },
        });
      }
      return { state: updated.state, isTerminal: true };
    }
    throw err;
  }

  const newState = STATE_MAP[snapshot.state];
  const updates: Prisma.MidjourneyJobUpdateInput = {
    state: newState,
    blockReason: snapshot.blockReason ?? null,
    mjJobId: snapshot.mjJobId ?? mjJob.mjJobId,
    mjMetadata:
      snapshot.mjMetadata as Prisma.InputJsonValue | undefined ??
      (mjJob.mjMetadata as Prisma.InputJsonValue | undefined) ??
      Prisma.JsonNull,
  };
  if (snapshot.startedAt && !mjJob.submittedAt) {
    updates.submittedAt = new Date(snapshot.startedAt);
  }
  if (newState === "COMPLETED" && !mjJob.completedAt) {
    updates.completedAt = new Date();
  }
  if (newState === "FAILED" && !mjJob.failedAt) {
    updates.failedAt = new Date();
    updates.failedReason = snapshot.lastMessage ?? "Bilinmeyen hata";
  }

  await db.midjourneyJob.update({
    where: { id: midjourneyJobId },
    data: updates,
  });

  // EtsyHub Job side senkron.
  if (mjJob.jobId) {
    const jobStatus =
      newState === "COMPLETED"
        ? JobStatus.SUCCESS
        : newState === "FAILED"
          ? JobStatus.FAILED
          : newState === "CANCELLED"
            ? JobStatus.CANCELLED
            : JobStatus.RUNNING;
    await db.job.update({
      where: { id: mjJob.jobId },
      data: {
        status: jobStatus,
        ...(newState === "COMPLETED" || newState === "FAILED"
          ? { finishedAt: new Date() }
          : {}),
        ...(newState === "FAILED" ? { error: updates.failedReason as string | undefined } : {}),
      },
    });
  }

  // Ingest tetikleme — COLLECTING_OUTPUTS state'inde outputs hazır olur.
  // V1: COMPLETED state'inde ingest yap (mock driver COMPLETED öncesi tüm
  // outputs taşır). Real driver: COLLECTING_OUTPUTS'ta ingest mantıklı
  // olabilir — V1.x'te değerlendirilir.
  if (newState === "COMPLETED" && snapshot.outputs && snapshot.outputs.length > 0) {
    try {
      await ingestOutputs(
        midjourneyJobId,
        snapshot,
        bridgeClient,
        upscaleParentAssetId,
        variationParentAssetId,
      );
    } catch (err) {
      logger.error(
        {
          midjourneyJobId,
          err: err instanceof Error ? err.message : String(err),
        },
        "midjourney ingest failed",
      );
      await db.midjourneyJob.update({
        where: { id: midjourneyJobId },
        data: {
          state: MidjourneyJobState.FAILED,
          failedReason: `Ingest hatası: ${err instanceof Error ? err.message : String(err)}`,
          failedAt: new Date(),
        },
      });
    }
  }

  return { state: newState, isTerminal: TERMINAL_STATES.includes(newState) };
}

/**
 * Bridge'den output dosyalarını fetch + MinIO upload + Asset/MidjourneyAsset
 * row'ları yaz.
 *
 * Idempotent: zaten ingest edilmiş job için no-op (MidjourneyAsset row sayısı).
 */
async function ingestOutputs(
  midjourneyJobId: string,
  snapshot: BridgeJobSnapshot,
  bridgeClient: BridgeClient,
  /**
   * Pass 60 — Upscale lineage. Verilirse yeni MidjourneyAsset row'ları
   * variantKind=UPSCALE + parentAssetId ile yazılır. Auto-promote
   * (Reference handoff) upscale'lerde devre dışı (parent zaten promoted).
   */
  upscaleParentAssetId?: string,
  /**
   * Pass 83 — Variation lineage. Verilirse yeni 4 MidjourneyAsset row'ları
   * variantKind=VARIATION + parentAssetId ile yazılır (parent grid'in
   * tek asset'ine 4 variation child bağlanır). Auto-promote variation'da
   * da SKIP (parent zaten Review/promoted akışında).
   */
  variationParentAssetId?: string,
): Promise<void> {
  if (!snapshot.outputs || snapshot.outputs.length === 0) return;

  const mjJob = await db.midjourneyJob.findUniqueOrThrow({
    where: { id: midjourneyJobId },
  });

  const existing = await db.midjourneyAsset.count({
    where: { midjourneyJobId },
  });
  if (existing > 0) {
    logger.info(
      { midjourneyJobId, existing },
      "midjourney ingest skipped — already imported",
    );
    return;
  }

  const storage = getStorage();
  for (const out of snapshot.outputs) {
    const buffer = await bridgeClient.fetchOutput(
      mjJob.bridgeJobId,
      out.gridIndex,
    );

    // Pass 50 — MIME/uzantı dinamik tespit. Pass 49 sonrası bridge
    // outputları .webp formatında geliyor (cdn.midjourney.com webp);
    // mimeType "image/png" hardcode storage policy'lerini ve UI image
    // viewer'ları kırardı.
    const { mime, ext } = inferImageMime(out.localPath, out.sourceUrl, buffer);

    const storageKey = `midjourney/${mjJob.userId}/${mjJob.id}/${out.gridIndex}${ext}`;
    const stored = await storage.upload(storageKey, buffer, {
      contentType: mime,
    });

    // Asset modelinde JSON sourceMetadata yok — `sourceUrl` (MJ CDN) +
    // `sourcePlatform` (OTHER) yazılır. MJ-spesifik lineage MidjourneyAsset
    // tablosunda zaten taşınıyor.
    const asset = await db.asset.create({
      data: {
        userId: mjJob.userId,
        storageProvider: env.STORAGE_PROVIDER,
        storageKey: stored.key,
        bucket: stored.bucket,
        mimeType: mime,
        sizeBytes: stored.size,
        hash: sha256(buffer),
        sourceUrl: out.sourceUrl ?? null,
        sourcePlatform: "OTHER",
      },
    });

    await db.midjourneyAsset.create({
      data: {
        midjourneyJobId,
        gridIndex: out.gridIndex,
        // Pass 60 — Upscale lineage; Pass 83 — Variation lineage:
        // parent kind'a göre variantKind seçilir. Generate (parent yoksa)
        // → GRID. Upscale parent → UPSCALE (1 child). Variation parent →
        // VARIATION (4 child).
        variantKind: upscaleParentAssetId
          ? MJVariantKind.UPSCALE
          : variationParentAssetId
            ? MJVariantKind.VARIATION
            : MJVariantKind.GRID,
        parentAssetId:
          upscaleParentAssetId ?? variationParentAssetId ?? null,
        assetId: asset.id,
        mjImageUrl: out.sourceUrl ?? null,
        mjActionLabel: upscaleParentAssetId
          ? `Upscale (Subtle)`
          : variationParentAssetId
            ? `Variation`
            : null,
      },
    });
  }

  logger.info(
    { midjourneyJobId, count: snapshot.outputs.length },
    "midjourney outputs ingested",
  );

  // Pass 56 — Auto-promote: MJ Job referenceId+productTypeId'liyse
  // 4 MidjourneyAsset'i otomatik GeneratedDesign'a bağla → Review queue'ya
  // doğal akış. Operatör manuel "Review'a gönder" panelinden tasarruf.
  // Reference'sız job'larda (ör. admin Test Render default) atlanır;
  // operatör manuel promote eder.
  // Try/catch — promote fail ingest sonucu bozmasın (manuel promote
  // hâlâ yapılabilir; idempotent).
  // Pass 60 — Upscale ingest'te auto-promote SKIP. Parent zaten Review'a
  // alınmış olabilir; upscale child'ı ayrı GeneratedDesign yapmak Review
  // queue'yu kirletir. Operatör isterse manuel promote panel kullanır.
  if (
    !upscaleParentAssetId &&
    !variationParentAssetId &&
    mjJob.referenceId &&
    mjJob.productTypeId
  ) {
    try {
      const ids = await db.midjourneyAsset.findMany({
        where: { midjourneyJobId },
        select: { id: true },
      });
      const result = await bulkPromoteMidjourneyAssets({
        midjourneyAssetIds: ids.map((a) => a.id),
        referenceId: mjJob.referenceId,
        productTypeId: mjJob.productTypeId,
        actorUserId: mjJob.userId,
      });
      logger.info(
        {
          midjourneyJobId,
          createdCount: result.createdCount,
          alreadyPromotedCount: result.alreadyPromotedCount,
        },
        "midjourney auto-promote OK",
      );
    } catch (err) {
      // Auto-promote opsiyonel — fail ingest'i bozmasın. Operatör
      // detail page'den manuel promote edebilir.
      logger.warn(
        {
          midjourneyJobId,
          err: err instanceof Error ? err.message : String(err),
        },
        "midjourney auto-promote failed (manuel fallback mümkün)",
      );
    }
  }
}

/**
 * Pass 50 — image MIME + uzantı tespiti.
 *
 * Sıralı ipuçları:
 *   1. localPath uzantısı (driver kontrol etti)
 *   2. sourceUrl uzantısı (MJ CDN)
 *   3. Magic bytes (PNG: 89 50, WebP: RIFF...WEBP, JPEG: FF D8)
 *   4. Default png (kontratla uyumlu)
 */
function inferImageMime(
  localPath: string,
  sourceUrl: string | null | undefined,
  buffer: Buffer,
): { mime: string; ext: string } {
  const tryExt = (s: string | null | undefined): string | null => {
    if (!s) return null;
    if (/\.webp(\?|$)/i.test(s)) return "webp";
    if (/\.png(\?|$)/i.test(s)) return "png";
    if (/\.(jpe?g)(\?|$)/i.test(s)) return "jpg";
    return null;
  };
  let kind = tryExt(localPath) ?? tryExt(sourceUrl ?? null);
  if (!kind && buffer.length >= 12) {
    const b = buffer;
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
      kind = "png";
    } else if (
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
    ) {
      kind = "webp";
    } else if (b[0] === 0xff && b[1] === 0xd8) {
      kind = "jpg";
    }
  }
  switch (kind) {
    case "webp":
      return { mime: "image/webp", ext: ".webp" };
    case "jpg":
      return { mime: "image/jpeg", ext: ".jpg" };
    case "png":
    default:
      return { mime: "image/png", ext: ".png" };
  }
}
