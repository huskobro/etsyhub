// R8 — GET /api/templates/recipes (chain-only) + POST create

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import {
  createRecipeChain,
  listRecipeChains,
} from "@/server/services/templates/recipes.service";

export const GET = withErrorHandling(async () => {
  await requireUser();
  const recipes = await listRecipeChains();
  return NextResponse.json({ recipes });
});

const InputSchema = z.object({
  name: z.string().min(1).max(160),
  productTypeId: z.string().max(80).nullable().optional(),
  links: z.object({
    promptTemplateId: z.string().nullable().optional(),
    stylePresetKey: z.string().nullable().optional(),
    mockupTemplateId: z.string().nullable().optional(),
    productTypeKey: z.string().nullable().optional(),
  }),
  settings: z
    .object({
      variationCount: z.number().int().min(1).max(48).optional(),
      aspectRatio: z.enum(["square", "portrait", "landscape"]).optional(),
      similarity: z.enum(["subtle", "medium", "heavy"]).optional(),
      notes: z.string().max(500).optional(),
    })
    .optional(),
});

export const POST = withErrorHandling(async (req: Request) => {
  await requireAdmin();
  const json = await req.json().catch(() => null);
  const parsed = InputSchema.safeParse(json);
  if (!parsed.success) {
    throw new ValidationError("Geçersiz recipe girişi", parsed.error.flatten());
  }
  const recipe = await createRecipeChain(parsed.data);
  return NextResponse.json({ recipe }, { status: 201 });
});
