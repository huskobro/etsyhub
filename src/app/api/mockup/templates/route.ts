// Phase 8 Task 22 — GET /api/mockup/templates route handler.
//
// Spec §4.3: Admin-managed template katalog. Sistem-wide read-only.
//   - Auth: requireUser (auth'lu ama cross-user yok)
//   - Query: categoryId (V1'de "canvas" tek değer)
//   - Filter: status=ACTIVE templates; ACTIVE binding aggregate
//   - Response 200: { templates: MockupTemplateView[] }
//   - Provider-agnostik: providerId, config, binding internal alanları ELENİR
//
// Phase 8 emsali: Task 17 GET /jobs/[id] — direct Prisma, read-only.

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { db } from "@/server/db";

// V1: yalnız "canvas" desteklenir (Spec §9). İleride genişler.
const QuerySchema = z.object({
  categoryId: z.enum(["canvas"]),
});

export const GET = withErrorHandling(async (req: Request) => {
  await requireUser();

  const { searchParams } = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    categoryId: searchParams.get("categoryId"),
  });
  if (!parsed.success) {
    throw new ValidationError(
      "Geçersiz query parametresi",
      parsed.error.flatten(),
    );
  }

  const rows = await db.mockupTemplate.findMany({
    where: {
      categoryId: parsed.data.categoryId,
      status: "ACTIVE",
    },
    include: {
      bindings: {
        where: { status: "ACTIVE" },
        select: { id: true }, // sadece varlık kontrolü; internal alan SIZMAZ
      },
    },
    orderBy: { name: "asc" }, // deterministik sıra (test stability)
  });

  const templates = rows.map((t) => ({
    id: t.id,
    name: t.name,
    thumbKey: t.thumbKey,
    aspectRatios: t.aspectRatios,
    tags: t.tags,
    estimatedRenderMs: t.estimatedRenderMs,
    hasActiveBinding: t.bindings.length > 0,
  }));

  return NextResponse.json({ templates });
});
