/**
 * Phase 66 — User-scope MockupTemplate status transition (PATCH).
 *
 * Templated.io clone publish flow:
 *   - DRAFT → ACTIVE (publish; apply view'da görünmeye başlar)
 *   - ACTIVE → ARCHIVED (deprecate; apply view'dan çıkar, mevcut
 *     render'ları bozmaz — Phase 8 baseline)
 *   - DRAFT/ACTIVE → ARCHIVED (revert sırasında ACTIVE'e geri dönüş için
 *     ayrı PATCH gerek; bu turun scope'unda forward-only flow yeter)
 *
 * Auth: requireUser
 *
 * Ownership invariant:
 *   - Template userId currentUser olmalı (cross-user PATCH YASAK)
 *   - Global (userId NULL) template'ler için PATCH burada YASAK (admin
 *     endpoint kullan)
 *
 * Publish guard:
 *   - DRAFT → ACTIVE için en az 1 ACTIVE binding gerek (renderable
 *     guarantee). Binding yoksa ValidationError + actionable hint.
 *
 * Phase 66 scope: DRAFT → ACTIVE + ACTIVE → ARCHIVED. Reverse transitions
 * (ARCHIVED → DRAFT) Phase 67+ candidate.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";

const ParamsSchema = z.object({ id: z.string().cuid() });

const patchBody = z.object({
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]),
});

export const PATCH = withErrorHandling(
  async (req: Request, ctx: { params: { id: string } }) => {
    const user = await requireUser();
    const params = ParamsSchema.safeParse(ctx.params);
    if (!params.success) {
      throw new ValidationError("Invalid id", params.error.flatten());
    }
    const parsed = patchBody.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      throw new ValidationError("Invalid body", parsed.error.flatten());
    }

    const template = await db.mockupTemplate.findUnique({
      where: { id: params.data.id },
      include: {
        bindings: { where: { status: "ACTIVE" }, select: { id: true } },
      },
    });
    if (!template) throw new NotFoundError("MockupTemplate not found");
    if (template.userId === null) {
      throw new ForbiddenError(
        "This is a global admin template. Use the admin endpoint to manage its status.",
      );
    }
    if (template.userId !== user.id) {
      throw new NotFoundError("MockupTemplate not found"); // cross-user
    }

    const nextStatus = parsed.data.status;

    /* Publish guard: DRAFT → ACTIVE requires at least one ACTIVE binding.
     * Without binding, apply view shows the template but render fails
     * (no provider config to dispatch). Reject the publish + tell user
     * what's missing. */
    if (template.status !== "ACTIVE" && nextStatus === "ACTIVE") {
      if (template.bindings.length === 0) {
        throw new ValidationError(
          "Cannot publish: this template has no ACTIVE binding. Add a LOCAL_SHARP binding (POST /api/mockup-templates/[id]/bindings) before publishing.",
        );
      }
    }

    const updated = await db.mockupTemplate.update({
      where: { id: params.data.id },
      data: {
        status: nextStatus,
        archivedAt: nextStatus === "ARCHIVED" ? new Date() : null,
      },
    });

    return NextResponse.json({
      id: updated.id,
      categoryId: updated.categoryId,
      name: updated.name,
      status: updated.status,
      thumbKey: updated.thumbKey,
      aspectRatios: updated.aspectRatios,
      tags: updated.tags,
      estimatedRenderMs: updated.estimatedRenderMs,
      archivedAt: updated.archivedAt,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      ownership: "own" as const,
    });
  },
);
