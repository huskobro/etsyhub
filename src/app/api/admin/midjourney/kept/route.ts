// Pass 90 — Kept Assets Workspace V1: list endpoint.
//
// Sözleşme:
//   GET /api/admin/midjourney/kept?batchId=...&templateId=...&variantKind=...
//      &q=...&cursorId=...&limit=...
//
// Auth: requireAdmin + service user-scope (Asset.userId).

import { NextResponse } from "next/server";
import { z } from "zod";
import { MJVariantKind } from "@prisma/client";
import { requireAdmin } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { listKeptAssets } from "@/server/services/midjourney/kept";

const query = z.object({
  batchId: z.string().min(1).max(100).optional(),
  templateId: z.string().min(1).max(100).optional(),
  variantKind: z
    .enum(["GRID", "UPSCALE", "VARIATION", "DESCRIBE"])
    .optional(),
  q: z.string().max(200).optional(),
  cursorId: z.string().min(1).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export const GET = withErrorHandling(async (req: Request) => {
  const admin = await requireAdmin();

  const url = new URL(req.url);
  const raw = Object.fromEntries(url.searchParams.entries());
  const parsed = query.safeParse(raw);
  if (!parsed.success) {
    throw new ValidationError(
      "Geçersiz kept query",
      parsed.error.flatten().fieldErrors,
    );
  }

  const page = await listKeptAssets(admin.id, {
    batchId: parsed.data.batchId,
    templateId: parsed.data.templateId,
    variantKind: parsed.data.variantKind as MJVariantKind | undefined,
    search: parsed.data.q,
    cursorId: parsed.data.cursorId,
    limit: parsed.data.limit,
  });

  return NextResponse.json(page);
});
