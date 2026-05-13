/**
 * Phase 67 — User-scope mockup template asset upload.
 *
 * Templated.io clone visual editor first slice. Phase 66'da operator
 * thumbKey'i text input ile yapıştırmak zorundaydı; Phase 67 gerçek
 * upload yolunu açar:
 *
 *   1. multipart/form-data file body
 *   2. ALLOWED_MIME + size cap (admin upload-asset emsali)
 *   3. sharp metadata extract (width/height — visual editor için zorunlu)
 *   4. storage key generate: `u/{userId}/templates/{categoryId}/{purpose}/{cuid}.{ext}`
 *   5. getStorage().upload (MinIO/S3 abstraction)
 *   6. Response: { storageKey, width, height, sizeBytes, mimeType }
 *
 * Storage key prefix `u/{userId}/templates/...` user-isolation'ı taşır:
 *   - Admin asset path: `templates/{categoryId}/{purpose}/...` (user prefix yok)
 *   - User template asset: `u/{userId}/templates/{categoryId}/{purpose}/...`
 *   - User general asset (Asset row): `u/{userId}/{cuid}` (asset-service emsali)
 *
 * Ayrım önemli: user template asset'i Asset row YAZMAZ (admin upload-asset
 * gibi storage-only). Asset row üretmek selection/library'e karışırdı;
 * template asset'leri ayrı namespace.
 *
 * Auth: requireUser
 * Audit: user.mockupTemplate.uploadAsset
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import sharp from "sharp";
import { newId } from "@/lib/id";
import { requireUser } from "@/server/session";
import { audit } from "@/server/audit";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { getStorage } from "@/providers/storage";
import { MockupCategorySchema } from "@/features/mockups/schemas";

const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_SIZE_BYTES = 25 * 1024 * 1024; // 25MB cap (admin parity)

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
  const user = await requireUser();

  const form = await req.formData().catch(() => null);
  if (!form) {
    throw new ValidationError("multipart/form-data expected");
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    throw new ValidationError("Missing 'file' form field");
  }

  const categoryRaw = form.get("categoryId");
  const purposeRaw = form.get("purpose");

  const categoryParsed = MockupCategorySchema.safeParse(
    typeof categoryRaw === "string" ? categoryRaw : undefined,
  );
  if (!categoryParsed.success) {
    throw new ValidationError(
      "Invalid categoryId",
      categoryParsed.error.flatten(),
    );
  }
  const purposeParsed = PurposeSchema.safeParse(
    typeof purposeRaw === "string" ? purposeRaw : undefined,
  );
  if (!purposeParsed.success) {
    throw new ValidationError(
      "Invalid purpose ('thumb' or 'base')",
      purposeParsed.error.flatten(),
    );
  }
  const categoryId = categoryParsed.data;
  const purpose: Purpose = purposeParsed.data;

  if (!ALLOWED_MIME.has(file.type)) {
    throw new ValidationError(
      "Unsupported file type (png/jpeg/webp only)",
    );
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length > MAX_SIZE_BYTES) {
    throw new ValidationError("File too large (max 25MB)");
  }

  let width: number | null = null;
  let height: number | null = null;
  try {
    const meta = await sharp(buffer).metadata();
    width = meta.width ?? null;
    height = meta.height ?? null;
  } catch {
    throw new ValidationError("Could not read image (invalid/corrupt)");
  }
  if (!width || !height) {
    throw new ValidationError("Image dimensions could not be determined");
  }

  /* User-scope storage prefix:
   *   u/{userId}/templates/{categoryId}/{purpose}/{cuid}.{ext}
   *
   * The user prefix `u/{userId}/` matches the existing user asset
   * isolation pattern (asset-service.ts:37). The `templates/` sub-path
   * separates template authoring assets from regular user uploads.
   * Asset DB row is NOT created — these are template-scope storage
   * assets only, not browseable in Library/Selections. */
  const ext = extFromMime(file.type);
  const id = newId();
  const storageKey = `u/${user.id}/templates/${categoryId}/${purpose}/${id}.${ext}`;

  const stored = await getStorage().upload(storageKey, buffer, {
    contentType: file.type,
  });

  await audit({
    actor: user.email,
    userId: user.id,
    action: "user.mockupTemplate.uploadAsset",
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
