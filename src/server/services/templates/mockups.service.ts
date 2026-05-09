// R8 — Mockup Templates upload service.
//
// Operatör kendi PSD/JPG/PNG mockup template'ini sisteme alır:
//   · Storage'a yükle (MinIO/S3 — `storage.upload`)
//   · MockupTemplate row aç: categoryId="user", status=DRAFT, thumbKey,
//     name, tags (operator-input), aspectRatios, estimatedRenderMs
//
// Smart-object deep parsing YOK; metadata + thumbnail only. Render
// pipeline (Phase 8) DRAFT → ACTIVE geçişini admin operatör manuel
// yapar (R9'da binding wizard).

import sharp from "sharp";
import { db } from "@/server/db";
import { getStorage } from "@/providers/storage";
import { logger } from "@/lib/logger";
import { MockupCategorySchema, type MockupCategoryId } from "@/features/mockups/schemas";

/**
 * R11.8 — Operatör upload sırasında product type seçer; categoryId artık
 * MockupCategorySchema enum (canvas/wall_art/printable/clipart/sticker/tshirt/
 * hoodie/dtf). "user-uploaded" sinyali categoryId yerine **`user` tag**'i
 * üzerinden korunur (UI classifier bu tag'i okur). Eski "user" hardcoded
 * categoryId Apply Mockups read endpoint'inden gizliyordu — fix bu engeli
 * kaldırır.
 */
const USER_UPLOAD_TAG = "user";
const DEFAULT_ESTIMATED_RENDER_MS = 4000;
const DEFAULT_ASPECT_RATIOS = ["1:1", "2:3", "3:4"];
const THUMBNAIL_MAX_DIMENSION = 800;

/**
 * R9 — File suitability check.
 *
 * - PNG/JPG/WEBP → sharp ile thumbnail üret, gerçek boyut/aspect ratio extract
 * - PSD → sharp desteklemiyor; ham bytes saklanır + smartObject hint
 * - Diğer → "unsupported" sinyali
 */
type FileSuitability = {
  kind: "raster" | "psd" | "unsupported";
  width: number | null;
  height: number | null;
  detectedAspect: string | null;
  hasSmartObject: boolean;
  /** PNG/JPG için sharp ile küçültülmüş thumb buffer (preview için). */
  thumbnailBytes: Buffer | null;
};

function detectAspectRatio(w: number, h: number): string | null {
  if (w <= 0 || h <= 0) return null;
  const ratio = w / h;
  // Toleranslı yaklaşım — yakın standartları döndür.
  const candidates: Array<[string, number]> = [
    ["1:1", 1],
    ["2:3", 2 / 3],
    ["3:2", 3 / 2],
    ["3:4", 3 / 4],
    ["4:3", 4 / 3],
    ["16:9", 16 / 9],
    ["9:16", 9 / 16],
  ];
  for (const [label, target] of candidates) {
    if (Math.abs(ratio - target) / target < 0.04) return label;
  }
  return `${w}:${h}`;
}

async function inspectFile(input: {
  bytes: Buffer;
  contentType: string;
  filename: string;
}): Promise<FileSuitability> {
  const isPsd =
    /\.psd$/i.test(input.filename) ||
    input.contentType === "image/vnd.adobe.photoshop" ||
    input.bytes.subarray(0, 4).toString("ascii") === "8BPS";

  if (isPsd) {
    // PSD smart-object signature: dosya içinde "Lr16"/"PlLd" descriptor
    // göstergeleri smart-object layer indikatörü. Hızlı hint için bytes
    // içinde "PlcL" (PlaceLayer) string'i ara — exhaustive değil ama
    // "muhtemelen smart-object var" sinyali için yeterli.
    const placedLayer = input.bytes.includes(Buffer.from("PlcL"));
    return {
      kind: "psd",
      width: null,
      height: null,
      detectedAspect: null,
      hasSmartObject: placedLayer,
      thumbnailBytes: null,
    };
  }

  try {
    const meta = await sharp(input.bytes).metadata();
    if (!meta.width || !meta.height) {
      return {
        kind: "unsupported",
        width: null,
        height: null,
        detectedAspect: null,
        hasSmartObject: false,
        thumbnailBytes: null,
      };
    }
    const thumbnail = await sharp(input.bytes)
      .resize(THUMBNAIL_MAX_DIMENSION, THUMBNAIL_MAX_DIMENSION, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .png({ quality: 80 })
      .toBuffer();
    return {
      kind: "raster",
      width: meta.width,
      height: meta.height,
      detectedAspect: detectAspectRatio(meta.width, meta.height),
      hasSmartObject: false,
      thumbnailBytes: thumbnail,
    };
  } catch (err) {
    logger.warn(
      { err: (err as Error).message, filename: input.filename },
      "mockup template inspect failed",
    );
    return {
      kind: "unsupported",
      width: null,
      height: null,
      detectedAspect: null,
      hasSmartObject: false,
      thumbnailBytes: null,
    };
  }
}

export type UploadMockupTemplateInput = {
  /** UI form'dan gelen template adı. */
  name: string;
  /** Operatör tag'leri ("psd", "smart-obj", "frame", vb.). */
  tags: string[];
  /** Aspect ratios — boş gelirse varsayılan kullanılır. */
  aspectRatios?: string[];
  /**
   * R11.8 — Product type / category. MockupCategorySchema enum
   * (canvas / wall_art / printable / clipart / sticker / tshirt /
   * hoodie / dtf). Apply Mockups read endpoint'i bu key üzerinden
   * filter yapıyor; operatör upload sırasında seçer.
   *
   * Backward-compat: belirsizse (eski client) "wall_art" varsayılan
   * (Kivasy scope: digital-only ürünlerin en yaygın hedefi).
   */
  productType?: MockupCategoryId;
  /** Yüklenen dosyanın bytes'ı. */
  file: {
    bytes: Buffer;
    contentType: string;
    filename: string;
  };
  /** Tahmini render süresi (ms). UI default 4000. */
  estimatedRenderMs?: number;
};

export type UploadMockupTemplateResult = {
  id: string;
  categoryId: string;
  name: string;
  thumbKey: string;
  tags: string[];
  aspectRatios: string[];
  status: import("@prisma/client").MockupTemplateStatus;
  /** R9 — file suitability sinyali (UI surfaces it for activation gating). */
  suitability: {
    kind: "raster" | "psd" | "unsupported";
    width: number | null;
    height: number | null;
    detectedAspect: string | null;
    hasSmartObject: boolean;
  };
};

export async function uploadMockupTemplate(
  input: UploadMockupTemplateInput,
): Promise<UploadMockupTemplateResult> {
  const trimmedName = input.name.trim();
  if (!trimmedName) {
    throw new Error("Template adı boş olamaz");
  }
  if (input.file.bytes.length === 0) {
    throw new Error("Boş dosya yüklenemez");
  }
  // 25MB üst limit — PSD'ler büyük olabilir; ham bytes ile gelirse
  // 50MB altına çekiyoruz (bridge upload limiti).
  const MAX_BYTES = 50 * 1024 * 1024;
  if (input.file.bytes.length > MAX_BYTES) {
    throw new Error(
      `Dosya çok büyük (max 50MB, gelen ${(input.file.bytes.length / 1024 / 1024).toFixed(1)}MB)`,
    );
  }

  const safeFilename = input.file.filename
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .slice(0, 80);
  const slug = trimmedName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const ts = Date.now();

  // R9 — file inspection: thumbnail render + suitability signal
  const suitability = await inspectFile({
    bytes: input.file.bytes,
    contentType: input.file.contentType,
    filename: input.file.filename,
  });

  const storage = getStorage();
  const sourceKey = `mockup-templates/user/${slug || "template"}-${ts}-${safeFilename}`;
  await storage.upload(sourceKey, input.file.bytes, {
    contentType: input.file.contentType || "application/octet-stream",
  });

  // Thumbnail upload (raster ise sharp ile küçültülmüş PNG)
  let thumbKey = sourceKey;
  if (suitability.thumbnailBytes) {
    thumbKey = `mockup-templates/user/${slug || "template"}-${ts}-thumb.png`;
    await storage.upload(thumbKey, suitability.thumbnailBytes, {
      contentType: "image/png",
    });
  }

  const aspectRatios =
    input.aspectRatios && input.aspectRatios.length > 0
      ? input.aspectRatios
      : suitability.detectedAspect
        ? [suitability.detectedAspect]
        : DEFAULT_ASPECT_RATIOS;
  const tags = input.tags
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  const inferredTags: string[] = [];
  if (suitability.kind === "psd") {
    inferredTags.push("psd");
    if (suitability.hasSmartObject) inferredTags.push("smart-obj");
  }
  if (suitability.kind === "raster") {
    inferredTags.push("raster");
    if (suitability.hasSmartObject === false && suitability.kind === "raster") {
      // raster mockup'lar smart-object content olamaz; "flat" hint'i.
      inferredTags.push("flat");
    }
  }
  // R11.8 — operator-uploaded sinyali artık tag üzerinden taşınır
  // (categoryId enum'a düştü). UI classifier "user" tag'ini gördüğünde
  // template'i My Templates section'ında render eder.
  inferredTags.push(USER_UPLOAD_TAG);
  const finalTags = Array.from(new Set([...tags, ...inferredTags]));

  // R11.8 — productType validate; verilmezse "wall_art" varsayılan
  // (Kivasy digital-only scope için en yaygın hedef).
  const categoryId: MockupCategoryId = input.productType
    ? MockupCategorySchema.parse(input.productType)
    : "wall_art";

  const tpl = await db.mockupTemplate.create({
    data: {
      categoryId,
      name: trimmedName,
      status: "DRAFT",
      thumbKey,
      tags: finalTags,
      aspectRatios,
      estimatedRenderMs:
        input.estimatedRenderMs ?? DEFAULT_ESTIMATED_RENDER_MS,
    },
  });

  // R11.9 — minimum LOCAL_SHARP binding'i otomatik oluştur (DRAFT).
  // Activate endpoint'i sonrasında ACTIVE'e geçer. Bu sayede operator'un
  // "Activate template" tıklaması yeterlidir; ayrı binding wizard'a gerek
  // kalmaz. PSD/unsupported için binding skipped (raster only).
  if (suitability.kind === "raster" && suitability.width && suitability.height) {
    // Default centered safe area: 70% genişlik/yükseklik (operatör manuel
    // tune edebilir admin editor'da). Smart-object yok, raster composite.
    const defaultBindingConfig = {
      providerId: "local-sharp" as const,
      baseAssetKey: thumbKey,
      baseDimensions: {
        w: suitability.thumbnailBytes
          ? Math.min(suitability.width, THUMBNAIL_MAX_DIMENSION)
          : suitability.width,
        h: suitability.thumbnailBytes
          ? Math.round(
              (suitability.height / suitability.width) *
                Math.min(suitability.width, THUMBNAIL_MAX_DIMENSION),
            )
          : suitability.height,
      },
      safeArea: {
        type: "rect" as const,
        x: 0.15,
        y: 0.15,
        w: 0.7,
        h: 0.7,
      },
      recipe: {
        blendMode: "normal" as const,
      },
      coverPriority: 50,
    };
    try {
      await db.mockupTemplateBinding.create({
        data: {
          templateId: tpl.id,
          providerId: "LOCAL_SHARP",
          config: defaultBindingConfig,
          estimatedRenderMs:
            input.estimatedRenderMs ?? DEFAULT_ESTIMATED_RENDER_MS,
          version: 1,
          // status default DRAFT (Prisma); activate endpoint ACTIVE'e taşır.
        },
      });
    } catch (err) {
      // Unique (templateId, providerId) collision teorik olarak imkansız
      // (template yeni oluşturuldu) ama defansif log.
      logger.warn(
        { templateId: tpl.id, err: (err as Error).message },
        "default LOCAL_SHARP binding create failed (non-blocking)",
      );
    }
  }

  logger.info(
    {
      templateId: tpl.id,
      sourceKey,
      thumbKey,
      bytes: input.file.bytes.length,
      kind: suitability.kind,
      smartObject: suitability.hasSmartObject,
      tags: finalTags,
    },
    "user mockup template uploaded (R9 — inspected)",
  );

  return {
    id: tpl.id,
    categoryId: tpl.categoryId,
    name: tpl.name,
    thumbKey: tpl.thumbKey,
    tags: tpl.tags,
    aspectRatios: tpl.aspectRatios,
    status: tpl.status,
    suitability: {
      kind: suitability.kind,
      width: suitability.width,
      height: suitability.height,
      detectedAspect: suitability.detectedAspect,
      hasSmartObject: suitability.hasSmartObject,
    },
  };
}

export async function archiveMockupTemplate(
  templateId: string,
): Promise<void> {
  await db.mockupTemplate.update({
    where: { id: templateId },
    data: { status: "ARCHIVED", archivedAt: new Date() },
  });
}

/**
 * R9 — DRAFT → ACTIVE geçişi.
 *
 * Activation gating:
 *   · status DRAFT olmalı (ACTIVE/ARCHIVED → no-op throw)
 *   · aspectRatios non-empty
 *   · thumbKey non-empty (upload başarılı)
 *   · raster için detectedAspect ≥ 1 ratio'ya match olmalı (operator
 *     UI'da seçim yaptığı için zorunlu değil — biz template'in "render
 *     edilebilir" olduğunu söyleyemiyoruz, sadece persisted)
 *
 * Provider binding wizard hâlâ R10+ kapsamında; activate sadece "operator
 * artık bu template'i Selection Apply Mockups ekranında görmek istiyor"
 * sinyali. MockupTemplateBinding row'ları ayrı.
 */
export async function activateMockupTemplate(input: {
  templateId: string;
}): Promise<{ id: string; status: import("@prisma/client").MockupTemplateStatus }> {
  const tpl = await db.mockupTemplate.findUnique({
    where: { id: input.templateId },
  });
  if (!tpl) {
    throw new Error("Mockup template bulunamadı");
  }
  if (tpl.status !== "DRAFT") {
    throw new Error(
      `Mockup template "${tpl.status}" — yalnız DRAFT activate edilebilir`,
    );
  }
  if (tpl.aspectRatios.length === 0) {
    throw new Error("Aspect ratios eksik");
  }
  if (!tpl.thumbKey) {
    throw new Error("Thumbnail eksik");
  }
  const updated = await db.mockupTemplate.update({
    where: { id: input.templateId },
    data: { status: "ACTIVE" },
  });
  // R11.9 — auto-binding(s) ACTIVE'e taşı. Apply Mockups read endpoint
  // bindings.status='ACTIVE' filter'ı uyguluyor; template ACTIVE ama
  // binding DRAFT ise template hâlâ visible olmaz. Atomik: template
  // ACTIVE = mockup pipeline ready demek; binding(ler) DRAFT'taysa
  // sweep yapar.
  await db.mockupTemplateBinding.updateMany({
    where: { templateId: input.templateId, status: "DRAFT" },
    data: { status: "ACTIVE" },
  });
  return { id: updated.id, status: updated.status };
}
