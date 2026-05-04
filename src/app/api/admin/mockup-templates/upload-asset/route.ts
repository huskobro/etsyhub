// V2 Phase 8 — Admin asset upload (template authoring için).
//
// Admin yeni MockupTemplate / MockupTemplateBinding oluştururken `thumbKey`
// veya `baseAssetKey` storage path'lerini elle yazmak zorunda kalmadan
// dosya yükleyebilsin. Asset DB row YAZMAZ — bunlar admin-managed
// system asset'ler, user Asset modelinin scope'unda değil. Sadece:
//   1. multipart/form-data file body
//   2. ALLOWED_MIME + size cap (asset-service emsali)
//   3. sharp metadata extract (width/height)
//   4. storage key generate: `templates/{categoryId}/{purpose}/{cuid}.{ext}`
//   5. getStorage().upload (MinIO/S3 abstraction)
//   6. Response: { storageKey, width, height, sizeBytes, mimeType }
//
// Admin form daha sonra dönen storageKey'i thumbKey/baseAssetKey alanına
// auto-fill eder.
//
// Auth: requireAdmin (USER 401/403 — system asset upload admin-only).
// Audit: admin.mockupTemplate.uploadAsset (audit trail).

import { NextResponse } from "next/server";
import { z } from "zod";
import sharp from "sharp";
import { newId } from "@/lib/id";
import { requireAdmin } from "@/server/session";
import { audit } from "@/server/audit";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { getStorage } from "@/providers/storage";
import { MockupCategorySchema } from "@/features/mockups/schemas";

const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);
// Template asset'ler için 25MB cap (asset-service emsali).
const MAX_SIZE_BYTES = 25 * 1024 * 1024;

const PURPOSE_VALUES = ["thumb", "base"] as const;
const PurposeSchema = z.enum(PURPOSE_VALUES);
type Purpose = z.infer<typeof PurposeSchema>;

function extFromMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  return "bin";
}

export const POST = withErrorHandling(async (req: Request) => {
  const admin = await requireAdmin();

  const form = await req.formData().catch(() => null);
  if (!form) {
    throw new ValidationError("multipart/form-data bekleniyordu");
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    throw new ValidationError("Dosya yok (form alanı 'file' olmalı)");
  }

  // categoryId + purpose form fields
  const categoryRaw = form.get("categoryId");
  const purposeRaw = form.get("purpose");

  const categoryParsed = MockupCategorySchema.safeParse(
    typeof categoryRaw === "string" ? categoryRaw : undefined,
  );
  if (!categoryParsed.success) {
    throw new ValidationError(
      "Geçersiz categoryId (V2 enum dışı)",
      categoryParsed.error.flatten(),
    );
  }
  const purposeParsed = PurposeSchema.safeParse(
    typeof purposeRaw === "string" ? purposeRaw : undefined,
  );
  if (!purposeParsed.success) {
    throw new ValidationError(
      "Geçersiz purpose ('thumb' veya 'base')",
      purposeParsed.error.flatten(),
    );
  }
  const categoryId = categoryParsed.data;
  const purpose: Purpose = purposeParsed.data;

  // Mime + size guard
  if (!ALLOWED_MIME.has(file.type)) {
    throw new ValidationError(
      "Desteklenmeyen dosya türü (yalnız png/jpeg/webp)",
    );
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length > MAX_SIZE_BYTES) {
    throw new ValidationError("Dosya çok büyük (maksimum 25MB)");
  }

  // Sharp metadata
  let width: number | null = null;
  let height: number | null = null;
  try {
    const meta = await sharp(buffer).metadata();
    width = meta.width ?? null;
    height = meta.height ?? null;
  } catch {
    throw new ValidationError("Görsel okunamadı (geçersiz/bozuk dosya)");
  }

  // Storage key: templates/{category}/{purpose}/{cuid}.{ext}
  // Bu prefix admin-system asset'leri user Asset'lerinden ayırır
  // (user asset prefix'i `u/{userId}/...`).
  const ext = extFromMime(file.type);
  const id = newId();
  const storageKey = `templates/${categoryId}/${purpose}/${id}.${ext}`;

  const stored = await getStorage().upload(storageKey, buffer, {
    contentType: file.type,
  });

  await audit({
    actor: admin.email,
    userId: admin.id,
    action: "admin.mockupTemplate.uploadAsset",
    targetType: "MockupTemplateAsset",
    targetId: storageKey,
    metadata: {
      categoryId,
      purpose,
      mimeType: file.type,
      sizeBytes: stored.size,
      width,
      height,
    },
  });

  return NextResponse.json({
    storageKey,
    width,
    height,
    sizeBytes: stored.size,
    mimeType: file.type,
  });
});
