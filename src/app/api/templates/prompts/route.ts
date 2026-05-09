// R7 — POST /api/templates/prompts (admin scope)
//
// Generic prompt template create. Mevcut MJ-spesifik servis bypass edilir;
// caller taskType verir, schema dokunmaz.

import { NextResponse } from "next/server";
import { z } from "zod";
import { ProviderKind } from "@prisma/client";
import { requireAdmin } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { createPromptTemplate } from "@/server/services/templates/prompts.service";

const InputSchema = z.object({
  name: z.string().min(1).max(200),
  taskType: z.string().min(1).max(80),
  productTypeKey: z.string().max(80).nullable().optional(),
  providerKind: z.nativeEnum(ProviderKind),
  model: z.string().max(160).nullable().optional(),
  description: z.string().max(1000).nullable().optional(),
  systemPrompt: z.string().max(4000).optional(),
  userPromptTemplate: z.string().min(1).max(8000),
});

export const POST = withErrorHandling(async (req: Request) => {
  await requireAdmin();
  const json = await req.json().catch(() => null);
  const parsed = InputSchema.safeParse(json);
  if (!parsed.success) {
    throw new ValidationError(
      "Geçersiz template girişi",
      parsed.error.flatten(),
    );
  }
  const tpl = await createPromptTemplate(parsed.data);
  return NextResponse.json({ template: tpl }, { status: 201 });
});
