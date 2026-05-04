// V2 Phase 8 (Pass 15) — Admin existing asset listesi.
//
// Admin'in template authoring'inde önceden yüklediği asset'leri tekrar
// kullanabilmesi için. AssetUploadField "mevcut asset seç" tab'ından
// çağrılır. Storage `list(prefix)` üzerinden çalışır.
//
// Query:
//   - categoryId: 8 ProductType key'inden biri (zorunlu)
//   - purpose: "thumb" | "base" (zorunlu)
//
// Prefix: `templates/{categoryId}/{purpose}/` — yalnız admin asset
// scope'unda. User assets (`u/{userId}/...`) tarafına SIZINTI YOK
// (asset-url endpoint'inin templates/ guard'ı emsali; burada da prefix
// fix admin scope dışına çıkamaz).
//
// Response 200: { items: { key, sizeBytes, lastModified, etag? }[] }
//   - lastModified DESC sırası (yeni yüklenen üstte)
//   - boş döndürmek normal (henüz upload yok)
//
// Auth: requireAdmin
// Audit: log YOK (read-only browse, gürültü)

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { getStorage } from "@/providers/storage";
import { MockupCategorySchema } from "@/features/mockups/schemas";

const QuerySchema = z.object({
  categoryId: MockupCategorySchema,
  purpose: z.enum(["thumb", "base"]),
});

export const GET = withErrorHandling(async (req: Request) => {
  await requireAdmin();

  const { searchParams } = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    categoryId: searchParams.get("categoryId"),
    purpose: searchParams.get("purpose"),
  });
  if (!parsed.success) {
    throw new ValidationError(
      "Geçersiz query (categoryId + purpose zorunlu)",
      parsed.error.flatten(),
    );
  }

  // Prefix admin scope dışına çıkamaz — purpose ve categoryId enum guard'ı
  // schema-level. Template scope'u dışındaki user prefix'ine erişim YOK.
  const prefix = `templates/${parsed.data.categoryId}/${parsed.data.purpose}/`;

  const objects = await getStorage().list(prefix);

  // lastModified DESC (yeni yüklenen üstte). Tarih yoksa key alfabetik fallback.
  const items = objects
    .map((o) => ({
      key: o.key,
      sizeBytes: o.size,
      lastModified: o.lastModified.toISOString(),
    }))
    .sort((a, b) => b.lastModified.localeCompare(a.lastModified));

  return NextResponse.json({ items });
});
