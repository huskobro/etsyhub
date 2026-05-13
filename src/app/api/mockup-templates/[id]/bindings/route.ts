/**
 * Phase 66 — User-scope MockupTemplateBinding create endpoint.
 *
 * Templated.io clone yazma yolunun ikinci yarısı (Phase 65 first user
 * write endpoint POST /api/mockup-templates'i tamamlar):
 *   1. POST /api/mockup-templates → template create (Phase 65)
 *   2. POST /api/mockup-templates/[id]/bindings → render config bind
 *      (Phase 66 — this)
 *   3. PATCH /api/mockup-templates/[id] → status DRAFT → ACTIVE publish
 *      (Phase 66, ayrı endpoint)
 *
 * Auth: requireUser
 *
 * Ownership invariant:
 *   - Template userId currentUser olmalı (cross-user binding YASAK)
 *   - Global (userId NULL) template'lere user binding eklenemez (admin
 *     scope only — admin endpoint /api/admin/mockup-templates/[id]/
 *     bindings ayrı)
 *
 * Provider config disipline:
 *   - LOCAL_SHARP → LocalSharpConfigSchema (Sharp pipeline, Phase 8+63)
 *   - DYNAMIC_MOCKUPS user-scope KABUL EDİLMEZ (paid external API; user
 *     opt-in flow ayrı; Phase 66 scope dışı)
 *
 * Uniqueness: (templateId, providerId) unique (DB constraint); aynı
 * binding ikinci kez create denenirse ConflictError.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";
import { ProviderConfigSchema } from "@/features/mockups/schemas";

const ParamsSchema = z.object({ id: z.string().cuid() });

const createBody = z.object({
  /** Phase 66 user-scope: only LOCAL_SHARP allowed (no paid externals). */
  providerId: z.literal("LOCAL_SHARP"),
  config: z.unknown(),
  estimatedRenderMs: z.number().int().min(100).max(60_000).default(2000),
});

export const POST = withErrorHandling(
  async (req: Request, ctx: { params: { id: string } }) => {
    const user = await requireUser();
    const params = ParamsSchema.safeParse(ctx.params);
    if (!params.success) {
      throw new ValidationError("Invalid id", params.error.flatten());
    }

    const parsed = createBody.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      throw new ValidationError("Invalid body", parsed.error.flatten());
    }

    /* Phase 66 — Ownership check. User can only bind to their own
     * templates; global (admin) templates require admin scope. */
    const template = await db.mockupTemplate.findUnique({
      where: { id: params.data.id },
      select: { id: true, userId: true, status: true },
    });
    if (!template) throw new NotFoundError("MockupTemplate not found");
    if (template.userId === null) {
      throw new ForbiddenError(
        "This is a global admin template; user-scope binding endpoint is for your own templates. Use admin endpoint to manage global bindings.",
      );
    }
    if (template.userId !== user.id) {
      throw new NotFoundError("MockupTemplate not found"); // cross-user → 404
    }

    /* Provider config discriminated union parse */
    const cfgWithDiscriminator = {
      ...(parsed.data.config as Record<string, unknown>),
      providerId: "local-sharp",
    };
    const cfgParsed = ProviderConfigSchema.safeParse(cfgWithDiscriminator);
    if (!cfgParsed.success) {
      throw new ValidationError(
        "Provider config invalid (LOCAL_SHARP)",
        cfgParsed.error.flatten(),
      );
    }

    /* Uniqueness check (templateId, providerId) */
    const existing = await db.mockupTemplateBinding.findUnique({
      where: {
        templateId_providerId: {
          templateId: params.data.id,
          providerId: parsed.data.providerId,
        },
      },
    });
    if (existing) {
      throw new ConflictError(
        `LOCAL_SHARP binding already exists for this template (id=${existing.id}). Update existing binding or remove first.`,
      );
    }

    /* Phase 66 — User-created binding default ACTIVE.
     * Operator's intent: bind = make renderable. Template stays DRAFT
     * until separate publish (PATCH endpoint); binding being ACTIVE on
     * DRAFT template is fine — apply view filters by template.status=
     * ACTIVE. So binding ACTIVE here doesn't leak; just makes template
     * publishable in one PATCH (no second binding-publish step). */
    const created = await db.mockupTemplateBinding.create({
      data: {
        templateId: params.data.id,
        providerId: parsed.data.providerId,
        config: cfgParsed.data as object,
        estimatedRenderMs: parsed.data.estimatedRenderMs,
        version: 1,
        status: "ACTIVE",
      },
    });

    return NextResponse.json({ item: created }, { status: 201 });
  },
);
