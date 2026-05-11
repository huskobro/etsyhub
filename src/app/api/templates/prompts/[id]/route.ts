// R7 — GET / PATCH /api/templates/prompts/[id]
//
// GET: detail (versions dahil) — auth user
// PATCH: update — admin scope

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { NotFoundError, ValidationError } from "@/lib/errors";
import {
  getPromptTemplateDetail,
  updatePromptTemplate,
} from "@/server/services/templates/prompts.service";

export const GET = withErrorHandling(
  async (_req: Request, ctx: { params: { id: string } }) => {
    await requireUser();
    const tpl = await getPromptTemplateDetail(ctx.params.id);
    if (!tpl) throw new NotFoundError("Template bulunamadı");
    return NextResponse.json({ template: tpl });
  },
);

const PatchSchema = z.object({
  systemPrompt: z.string().max(4000).optional(),
  userPromptTemplate: z.string().min(1).max(8000).optional(),
  description: z.string().max(1000).nullable().optional(),
  productTypeKey: z.string().max(80).nullable().optional(),
  model: z.string().max(160).nullable().optional(),
  changelog: z.string().max(500).nullable().optional(),
});

export const PATCH = withErrorHandling(
  async (req: Request, ctx: { params: { id: string } }) => {
    await requireAdmin();
    const json = await req.json().catch(() => null);
    const parsed = PatchSchema.safeParse(json);
    if (!parsed.success) {
      throw new ValidationError("Geçersiz güncelleme", parsed.error.flatten());
    }
    const tpl = await updatePromptTemplate({
      templateId: ctx.params.id,
      ...parsed.data,
    });
    return NextResponse.json({ template: tpl });
  },
);
