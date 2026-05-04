// V2 Phase 8 — Admin MockupTemplate Management.
//
// Multi-Category Foundation (HEAD `062b7a9`+) ile Phase 8 Apply page
// dinamik kategori filtreleme yapıyor; ama admin'in non-canvas kategoriye
// template ekleme yolu yoktu (sadece DB-direct seed). Bu endpoint admin
// MockupTemplate CRUD'u açar.
//
// V2 scope (V1 kapsamı dışı):
//   - GET list (categoryId/status filter ile)
//   - POST create — DRAFT state'te, admin sonra ACTIVE'e geçirir
//   - PATCH status (DRAFT ↔ ACTIVE ↔ ARCHIVED) [id]/route.ts'de
//   - Binding management ayrı sub-resource (ileride)
//
// V1 lock'a saygı: Phase 8 implementation surface dokunulmadı; sadece admin
// CRUD pattern (ProductType emsali) eklendi. Job/render path'i değişmedi.
//
// Auth: requireAdmin (USER 401, ADMIN olmayan 403).
// Audit: admin.mockupTemplate.create / .update / .delete (audit log).

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { requireAdmin } from "@/server/session";
import { audit } from "@/server/audit";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { MockupCategorySchema } from "@/features/mockups/schemas";

// ────────────────────────────────────────────────────────────
// GET — list (categoryId + status filter optional)
// ────────────────────────────────────────────────────────────

const listQuerySchema = z.object({
  categoryId: MockupCategorySchema.optional(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
});

export const GET = withErrorHandling(async (req: Request) => {
  await requireAdmin();
  const url = new URL(req.url);
  const parsed = listQuerySchema.safeParse({
    categoryId: url.searchParams.get("categoryId") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
  });
  if (!parsed.success) {
    throw new ValidationError("Geçersiz query", parsed.error.flatten());
  }

  const items = await db.mockupTemplate.findMany({
    where: {
      ...(parsed.data.categoryId ? { categoryId: parsed.data.categoryId } : {}),
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
    },
    orderBy: [{ categoryId: "asc" }, { name: "asc" }],
    include: {
      bindings: {
        select: {
          id: true,
          providerId: true,
          status: true,
          version: true,
          estimatedRenderMs: true,
        },
      },
    },
  });

  return NextResponse.json({ items });
});

// ────────────────────────────────────────────────────────────
// POST — create (DRAFT state default; admin sonra ACTIVE'e geçirir)
// ────────────────────────────────────────────────────────────

const createBody = z.object({
  categoryId: MockupCategorySchema,
  name: z.string().min(1).max(120),
  thumbKey: z.string().min(1).max(500),
  aspectRatios: z.array(z.string().min(1).max(10)).min(1).max(8),
  tags: z.array(z.string().min(1).max(40)).max(20).default([]),
  estimatedRenderMs: z.number().int().min(100).max(60_000),
});

export const POST = withErrorHandling(async (req: Request) => {
  const admin = await requireAdmin();
  const parsed = createBody.safeParse(await req.json());
  if (!parsed.success) {
    throw new ValidationError("Geçersiz istek", parsed.error.flatten());
  }

  const created = await db.mockupTemplate.create({
    data: {
      categoryId: parsed.data.categoryId,
      name: parsed.data.name,
      thumbKey: parsed.data.thumbKey,
      aspectRatios: parsed.data.aspectRatios,
      tags: parsed.data.tags,
      estimatedRenderMs: parsed.data.estimatedRenderMs,
      // status default DRAFT (Prisma schema)
    },
  });

  await audit({
    actor: admin.email,
    userId: admin.id,
    action: "admin.mockupTemplate.create",
    targetType: "MockupTemplate",
    targetId: created.id,
    metadata: { categoryId: created.categoryId, name: created.name },
  });

  return NextResponse.json({ item: created }, { status: 201 });
});
