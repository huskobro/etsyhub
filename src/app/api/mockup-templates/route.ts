/**
 * Phase 64 — User-scope mockup template catalog (GET only).
 *
 * Templated.io modeli:
 *   - Operatör kendi mockup template'lerini tutabilir (userId set)
 *   - Aynı zamanda admin'in global catalog'una erişebilir (userId NULL)
 *   - Bu endpoint ikisini merge eder: global (NULL) + own (userId == current)
 *
 * Cross-user izolasyon: başka kullanıcıların template'leri ASLA dönülmez
 * (where: OR [userId NULL, userId currentUser]).
 *
 * Auth: requireUser (USER veya ADMIN — admin de kendi user-scope view'ini
 * görür; admin global catalog'u admin endpoint'inden yönetir).
 *
 * Response shape (her item):
 *   {
 *     id, categoryId, name, status, thumbKey, aspectRatios, tags,
 *     estimatedRenderMs, archivedAt, createdAt, updatedAt,
 *     ownership: "global" | "own",  // Phase 64 — UI badge için
 *     bindings: [{ id, providerId, status, version, estimatedRenderMs }],
 *   }
 *
 * Filter: categoryId opsiyonel; status opsiyonel (default ACTIVE — operatör
 * yalnız kullanılabilir template'leri görsün).
 *
 * V1: write yok (POST/PATCH/DELETE Phase 65 candidate). Bu endpoint
 * READ-ONLY canlı catalog read.
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
