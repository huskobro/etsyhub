// Pass 80 — MJ Template per-id endpoint.
//
// GET /api/admin/midjourney/templates/[id]
//   → tek template (active version + variables)
//
// PATCH /api/admin/midjourney/templates/[id]
//   body: { promptTemplateText?, description?, changelog? }
//   → eski ACTIVE → ARCHIVED; yeni version ACTIVE

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError, NotFoundError } from "@/lib/errors";
import { audit } from "@/server/audit";
import {
  getMjTemplate,
  updateMjTemplate,
} from "@/server/services/midjourney/templates";

export const GET = withErrorHandling(
  async (
    _req: Request,
    ctx: { params: Promise<{ id: string }> },
  ) => {
    await requireAdmin();
    const { id } = await ctx.params;
    const tpl = await getMjTemplate(id);
    if (!tpl) throw new NotFoundError("MJ template bulunamadı");
    return NextResponse.json({ ok: true, template: tpl });
  },
);

const patchBody = z.object({
  promptTemplateText: z.string().min(3).max(2000),
  description: z.string().max(500).optional(),
  changelog: z.string().max(500).optional(),
});

export const PATCH = withErrorHandling(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const admin = await requireAdmin();
    const { id } = await ctx.params;

    const parsed = patchBody.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      throw new ValidationError(
        "Geçersiz template güncelleme isteği",
        parsed.error.flatten().fieldErrors,
      );
    }

    const updated = await updateMjTemplate({
      templateId: id,
      promptTemplateText: parsed.data.promptTemplateText,
      description: parsed.data.description,
      changelog: parsed.data.changelog,
    });

    await audit({
      actor: admin.id,
      action: "MIDJOURNEY_TEMPLATE_UPDATE",
      targetType: "PromptTemplate",
      targetId: id,
      metadata: {
        version: updated.version,
        promptTemplateText: parsed.data.promptTemplateText.slice(0, 500),
        variables: updated.templateVariables,
        changelog: parsed.data.changelog ?? null,
      },
    });

    return NextResponse.json({ ok: true, template: updated });
  },
);
