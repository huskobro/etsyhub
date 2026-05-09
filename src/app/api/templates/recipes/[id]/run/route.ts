// R8 — POST /api/templates/recipes/[id]/run
//
// Recipe run = audit + destination. Tam orchestration engine değil; UI
// destination'a göre operatörü doğru üretim sayfasına yönlendirir.

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { audit } from "@/server/audit";
import { planRecipeChainRun } from "@/server/services/templates/recipes.service";

const InputSchema = z.object({
  overrides: z
    .object({
      promptTemplateId: z.string().nullable().optional(),
      stylePresetKey: z.string().nullable().optional(),
      mockupTemplateId: z.string().nullable().optional(),
      productTypeKey: z.string().nullable().optional(),
      referenceId: z.string().optional(),
      variationCount: z.number().int().min(1).max(48).optional(),
    })
    .optional(),
});

export const POST = withErrorHandling(
  async (req: Request, ctx: { params: { id: string } }) => {
    const user = await requireUser();
    const json = await req.json().catch(() => ({}));
    const parsed = InputSchema.safeParse(json);
    if (!parsed.success) {
      throw new ValidationError("Geçersiz run girişi", parsed.error.flatten());
    }

    const result = await planRecipeChainRun({
      recipeId: ctx.params.id,
      overrides: parsed.data.overrides,
    });

    await audit({
      actor: user.id,
      action: "RECIPE_RUN_PLANNED",
      targetType: "Recipe",
      targetId: result.audit.recipeId,
      metadata: {
        recipeKey: result.audit.recipeKey,
        recipeName: result.audit.recipeName,
        destination: result.destination,
        chosenLinks: result.audit.chosenLinks,
      },
    });

    return NextResponse.json(result);
  },
);
