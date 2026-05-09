// R9 — GET /api/templates/recipes/[id]/runs — recent run history (audit log)

import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { getRecipeRunHistory } from "@/server/services/templates/recipes.service";

export const GET = withErrorHandling(
  async (_req: Request, ctx: { params: { id: string } }) => {
    await requireUser();
    const runs = await getRecipeRunHistory({
      recipeId: ctx.params.id,
      limit: 10,
    });
    return NextResponse.json({ runs });
  },
);
