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

import { db } from "@/server/db";
import { getStorage } from "@/providers/storage";
import { logger } from "@/lib/logger";

const USER_TEMPLATE_CATEGORY = "user";
const DEFAULT_ESTIMATED_RENDER_MS = 4000;
const DEFAULT_ASPECT_RATIOS = ["1:1", "2:3", "3:4"];

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
  const storageKey = `mockup-templates/user/${slug || "template"}-${ts}-${safeFilename}`;

  const storage = getStorage();
  await storage.upload(storageKey, input.file.bytes, {
    contentType: input.file.contentType || "application/octet-stream",
  });

  const aspectRatios =
    input.aspectRatios && input.aspectRatios.length > 0
      ? input.aspectRatios
      : DEFAULT_ASPECT_RATIOS;
  const tags = input.tags
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  // PSD ise smart-obj tag'i eklensin (operatöre ipucu).
  const hasSmartObj =
    /\.psd$/i.test(input.file.filename) || tags.includes("psd");
  const finalTags = Array.from(
    new Set([...tags, ...(hasSmartObj ? ["psd", "smart-obj"] : [])]),
  );

  const tpl = await db.mockupTemplate.create({
    data: {
      categoryId: USER_TEMPLATE_CATEGORY,
      name: trimmedName,
      status: "DRAFT",
      thumbKey: storageKey,
      tags: finalTags,
      aspectRatios,
      estimatedRenderMs:
        input.estimatedRenderMs ?? DEFAULT_ESTIMATED_RENDER_MS,
    },
  });

  logger.info(
    {
      templateId: tpl.id,
      storageKey,
      bytes: input.file.bytes.length,
      tags: finalTags,
    },
    "user mockup template uploaded",
  );

  return {
    id: tpl.id,
    categoryId: tpl.categoryId,
    name: tpl.name,
    thumbKey: tpl.thumbKey,
    tags: tpl.tags,
    aspectRatios: tpl.aspectRatios,
    status: tpl.status,
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
