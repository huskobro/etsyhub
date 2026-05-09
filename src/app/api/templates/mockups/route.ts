// R8 — POST /api/templates/mockups (multipart upload, admin scope)
//
// Operator PSD / image upload → MockupTemplate row.
// FormData fields: file (binary) + name + tags (csv) + aspectRatios (csv)

import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { uploadMockupTemplate } from "@/server/services/templates/mockups.service";
import { MockupCategorySchema } from "@/features/mockups/schemas";

export const runtime = "nodejs";

export const POST = withErrorHandling(async (req: Request) => {
  await requireAdmin();
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    throw new ValidationError("`file` alanı eksik (multipart upload)");
  }
  const name = (form.get("name") ?? "").toString().trim();
  if (!name) {
    throw new ValidationError("`name` alanı eksik");
  }
  const tags = (form.get("tags") ?? "")
    .toString()
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  const aspectRatios = (form.get("aspectRatios") ?? "")
    .toString()
    .split(",")
    .map((a) => a.trim())
    .filter((a) => a.length > 0);
  // R11.8 — productType (MockupCategorySchema enum). Boş/eksikse service
  // "wall_art" varsayılan kullanır.
  const productTypeRaw = (form.get("productType") ?? "").toString().trim();
  let productType: import("@/features/mockups/schemas").MockupCategoryId | undefined;
  if (productTypeRaw) {
    const parsed = MockupCategorySchema.safeParse(productTypeRaw);
    if (!parsed.success) {
      throw new ValidationError(
        `Geçersiz productType: "${productTypeRaw}" (canvas, wall_art, printable, clipart, sticker, tshirt, hoodie, dtf bekleniyor)`,
      );
    }
    productType = parsed.data;
  }

  const arrayBuffer = await file.arrayBuffer();
  const result = await uploadMockupTemplate({
    name,
    tags,
    aspectRatios: aspectRatios.length > 0 ? aspectRatios : undefined,
    productType,
    file: {
      bytes: Buffer.from(arrayBuffer),
      contentType: file.type,
      filename: file.name,
    },
  });

  return NextResponse.json({ template: result }, { status: 201 });
});
