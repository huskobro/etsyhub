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

const USER_TEMPLATE_CATEGORY = "user";
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
  const finalTags = Array.from(new Set([...tags, ...inferredTags]));

  const tpl = await db.mockupTemplate.create({
    data: {
      categoryId: USER_TEMPLATE_CATEGORY,
      name: trimmedName,
      status: "DRAFT",
      thumbKey,
      tags: finalTags,
      aspectRatios,
      estimatedRenderMs:
        input.estimatedRenderMs ?? DEFAULT_ESTIMATED_RENDER_MS,
    },
  });

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
  return { id: updated.id, status: updated.status };
}
