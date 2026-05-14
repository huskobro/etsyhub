// Phase 8 Task 22 — GET /api/mockup/templates route handler.
// Phase 65 — Ownership-aware: returns global (userId NULL) + own (userId
//   == currentUser) merged. Apply view shows admin catalog + user library
//   side-by-side (CLAUDE.md USER_TEMPLATE sözleşmesi karşılığı).
//
// Spec §4.3: Apply page template katalog.
//   - Auth: requireUser (auth'lu)
//   - Query:
//     - categoryId — MockupCategorySchema 8-değer enum
//     - scope (Phase 65) — "all" | "global" | "own" (default "all")
//   - Filter: status=ACTIVE; ACTIVE binding aggregate
//   - Response 200: { templates: MockupTemplateView[] }
//   - Provider-agnostik: providerId, config, binding internal alanları ELENİR
//   - Phase 65: ownership: "global" | "own" projected per item
//
// Cross-user isolation: where filter never matches other users' rows
// (OR [userId NULL, userId currentUser] — Phase 64 baseline).

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { db } from "@/server/db";
import { MockupCategorySchema } from "@/features/mockups/schemas";

const QuerySchema = z.object({
  categoryId: MockupCategorySchema,
  scope: z.enum(["all", "global", "own"]).default("all"),
});

export const GET = withErrorHandling(async (req: Request) => {
  const user = await requireUser();

  const { searchParams } = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    categoryId: searchParams.get("categoryId"),
    scope: searchParams.get("scope") ?? undefined,
  });
  if (!parsed.success) {
    throw new ValidationError(
      "Geçersiz query parametresi",
      parsed.error.flatten(),
    );
  }
  const { categoryId, scope } = parsed.data;

  /* Phase 65 — Ownership scope filter. */
  const ownershipWhere =
    scope === "global"
      ? { userId: null }
      : scope === "own"
        ? { userId: user.id }
        : { OR: [{ userId: null }, { userId: user.id }] };

  const rows = await db.mockupTemplate.findMany({
    where: {
      ...ownershipWhere,
      categoryId,
      status: "ACTIVE",
    },
    include: {
      bindings: {
        where: { status: "ACTIVE" },
        // Phase 76 — `config` JSON select edildi (sadece slot count
        // derive etmek için). Tüm config UI'a sızmaz; aşağıda sadece
        // slotCount projekte edilir (number — operator multi-slot vs
        // single-slot template'i ayırt etsin).
        select: { id: true, config: true },
      },
    },
    orderBy: [
      // Own first (operator's library on top), then alphabetical
      { userId: { sort: "desc", nulls: "last" } },
      { name: "asc" },
    ],
  });

  const templates = rows.map((t) => {
    // Phase 76 — Slot count from active binding config (multi-slot detection).
    // Operator UI apply view'da multi-slot template seçince slot assignment
    // panel açar. Tek-slot template'lerde panel render edilmez.
    // Internal binding.config UI'a SIZMAZ — sadece slotCount projekte edilir.
    let slotCount = 1;
    const firstBinding = t.bindings[0];
    if (firstBinding && firstBinding.config) {
      const cfg = firstBinding.config as { slots?: unknown[] };
      if (Array.isArray(cfg.slots) && cfg.slots.length > 0) {
        slotCount = cfg.slots.length;
      }
    }

    return {
      id: t.id,
      name: t.name,
      thumbKey: t.thumbKey,
      aspectRatios: t.aspectRatios,
      tags: t.tags,
      estimatedRenderMs: t.estimatedRenderMs,
      hasActiveBinding: t.bindings.length > 0,
      // Phase 65 — Ownership signal for UI tabs/badge
      ownership: (t.userId === null ? "global" : "own") as "global" | "own",
      // Phase 76 — Slot count (1 for legacy single-slot; >1 for multi-slot
      // sticker sheet / bundle preview / multi-area templates)
      slotCount,
    };
  });

  return NextResponse.json({ templates });
});
