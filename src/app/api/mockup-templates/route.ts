/**
 * Phase 64 — User-scope mockup template catalog (GET).
 * Phase 65 — User-scope create (POST) — first user-upload path.
 *
 * Templated.io modeli:
 *   - Operatör kendi mockup template'lerini tutabilir (userId set)
 *   - Aynı zamanda admin'in global catalog'una erişebilir (userId NULL)
 *   - GET endpoint ikisini merge eder: global (NULL) + own (userId == current)
 *   - POST endpoint operator'un kendi DRAFT template'ini oluşturur
 *     (userId currentUser; status DRAFT default)
 *
 * Cross-user izolasyon: başka kullanıcıların template'leri ASLA dönülmez
 * (where: OR [userId NULL, userId currentUser]).
 *
 * Auth: requireUser (USER veya ADMIN — admin de kendi user-scope view'ini
 * görür; admin global catalog'u admin endpoint'inden yönetir).
 *
 * GET response shape (her item):
 *   {
 *     id, categoryId, name, status, thumbKey, aspectRatios, tags,
 *     estimatedRenderMs, archivedAt, createdAt, updatedAt,
 *     ownership: "global" | "own",  // Phase 64 — UI badge için
 *     bindings: [{ id, providerId, status, version, estimatedRenderMs }],
 *   }
 *
 * POST body (Phase 65):
 *   {
 *     categoryId, name, thumbKey, aspectRatios, tags?, estimatedRenderMs?
 *   }
 *
 * POST behavior:
 *   - status = DRAFT (operator publishes via PATCH later, Phase 66)
 *   - userId = currentUser (cross-user isolation enforced)
 *   - thumbKey caller-provided (operator önce /api/admin/mockup-templates/
 *     upload-asset ile MinIO key alır VEYA Phase 66 user-scope upload
 *     endpoint açıldığında oradan)
 *   - bindings empty (binding create ayrı endpoint, Phase 66)
 *
 * Filter (GET): categoryId opsiyonel; status opsiyonel (default ACTIVE).
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { MockupCategorySchema } from "@/features/mockups/schemas";

const listQuerySchema = z.object({
  categoryId: MockupCategorySchema.optional(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).default("ACTIVE"),
  /** "all" | "global" | "own" — default "all" (global + own merge) */
  scope: z.enum(["all", "global", "own"]).default("all"),
});

const createBodySchema = z.object({
  categoryId: MockupCategorySchema,
  name: z.string().min(1).max(120),
  thumbKey: z.string().min(1).max(500),
  aspectRatios: z.array(z.string().min(1).max(10)).min(1).max(8),
  tags: z.array(z.string().min(1).max(40)).max(20).default([]),
  estimatedRenderMs: z.number().int().min(100).max(60_000).default(2000),
});

export const GET = withErrorHandling(async (req: Request) => {
  const user = await requireUser();
  const url = new URL(req.url);
  const parsed = listQuerySchema.safeParse({
    categoryId: url.searchParams.get("categoryId") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    scope: url.searchParams.get("scope") ?? undefined,
  });
  if (!parsed.success) {
    throw new ValidationError("Invalid query", parsed.error.flatten());
  }
  const { categoryId, status, scope } = parsed.data;

  /* Phase 64 — Ownership scope filter.
   * "all"    → global (userId NULL) + own (userId == currentUser)
   * "global" → only global catalog
   * "own"    → only user's own templates
   *
   * Cross-user isolation guaranteed: never returns rows where userId is
   * set but != currentUser. */
  const ownershipWhere =
    scope === "global"
      ? { userId: null }
      : scope === "own"
        ? { userId: user.id }
        : {
            OR: [{ userId: null }, { userId: user.id }],
          };

  const rows = await db.mockupTemplate.findMany({
    where: {
      ...ownershipWhere,
      status,
      ...(categoryId ? { categoryId } : {}),
    },
    orderBy: [
      // Own templates first (operator sees their library top), then alphabetical
      { userId: { sort: "desc", nulls: "last" } },
      { name: "asc" },
    ],
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

  // Project `ownership` field for UI consumption (no row leak — userId stripped
  // from response; only public ownership signal sent to client).
  const items = rows.map((t) => ({
    id: t.id,
    categoryId: t.categoryId,
    name: t.name,
    status: t.status,
    thumbKey: t.thumbKey,
    aspectRatios: t.aspectRatios,
    tags: t.tags,
    estimatedRenderMs: t.estimatedRenderMs,
    archivedAt: t.archivedAt,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    ownership: (t.userId === null ? "global" : "own") as "global" | "own",
    bindings: t.bindings,
  }));

  return NextResponse.json({ items });
});

/**
 * Phase 65 — POST /api/mockup-templates (user-scope create).
 *
 * First user-upload path. Operator creates a DRAFT template; binding
 * (provider config) ayrı endpoint (Phase 66 candidate). Asset upload
 * (thumbKey) Phase 66 user-scope upload endpoint açıldığında bağlanır;
 * Phase 65 baseline: caller-provided thumbKey (admin upload-asset
 * endpoint zaten requireUser değil — Phase 66'da user-scope upload
 * endpoint açılır).
 *
 * Cross-user isolation: userId hard-coded currentUser.id (caller body
 * userId override edemez).
 *
 * Response: created template (ownership="own", bindings=[]).
 */
export const POST = withErrorHandling(async (req: Request) => {
  const user = await requireUser();
  const parsed = createBodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    throw new ValidationError("Invalid input", parsed.error.flatten());
  }

  const created = await db.mockupTemplate.create({
    data: {
      categoryId: parsed.data.categoryId,
      name: parsed.data.name,
      thumbKey: parsed.data.thumbKey,
      aspectRatios: parsed.data.aspectRatios,
      tags: parsed.data.tags,
      estimatedRenderMs: parsed.data.estimatedRenderMs,
      userId: user.id,
      // status default DRAFT (Prisma schema)
    },
  });

  return NextResponse.json(
    {
      id: created.id,
      categoryId: created.categoryId,
      name: created.name,
      status: created.status,
      thumbKey: created.thumbKey,
      aspectRatios: created.aspectRatios,
      tags: created.tags,
      estimatedRenderMs: created.estimatedRenderMs,
      archivedAt: created.archivedAt,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
      ownership: "own" as const,
      bindings: [],
    },
    { status: 201 },
  );
});
