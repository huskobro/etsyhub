// Pass 88 — Asset Library V1 — list endpoint.
//
// Sözleşme:
//   GET /api/admin/midjourney/library?variantKind=...&batchId=...&templateId=...&days=...&q=...&cursorId=...&limit=...
//
// Auth: requireAdmin — listLibraryAssets içinde de userId scope uygulanır
// (cross-user erişim engeli ikinci katman).
//
// Cevap:
//   {
//     cards: LibraryCard[],
//     nextCursor: string | null,
//     totalCount: number  // 1000+ ise -1
//   }
//
// İleride lineage detayı için aynı dosyaya alt route eklenmiyor; Card
// detail modalı ihtiyaç duyarsa /api/admin/midjourney/library/[id]/lineage
// olarak ayrılır (V2). V1'de Card itself parentAssetId taşıyor — UI
// "Parent" rozetine tıklayınca filter ile direkt parent karta geçer.

import { NextResponse } from "next/server";
import { z } from "zod";
import { MJVariantKind } from "@prisma/client";
import { requireAdmin } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import {
  listLibraryAssets,
  type LibraryDayFilter,
} from "@/server/services/midjourney/library";

const query = z.object({
  variantKind: z
    .enum(["GRID", "UPSCALE", "VARIATION", "DESCRIBE"])
    .optional(),
  batchId: z.string().min(1).max(100).optional(),
  templateId: z.string().min(1).max(100).optional(),
  parentAssetId: z.string().min(1).max(100).optional(),
  days: z.enum(["recent", "7d", "30d", "all"]).optional(),
  q: z.string().max(200).optional(),
  cursorId: z.string().min(1).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const GET = withErrorHandling(async (req: Request) => {
  const admin = await requireAdmin();

  const url = new URL(req.url);
  const raw = Object.fromEntries(url.searchParams.entries());
  const parsed = query.safeParse(raw);
  if (!parsed.success) {
    throw new ValidationError(
      "Geçersiz library query",
      parsed.error.flatten().fieldErrors,
    );
  }

  const page = await listLibraryAssets(admin.id, {
    variantKind: parsed.data.variantKind as MJVariantKind | undefined,
    batchId: parsed.data.batchId,
    templateId: parsed.data.templateId,
    parentAssetId: parsed.data.parentAssetId,
    dayFilter: parsed.data.days as LibraryDayFilter | undefined,
    search: parsed.data.q,
    cursorId: parsed.data.cursorId,
    limit: parsed.data.limit,
  });

  return NextResponse.json(page);
});
