// R7 — POST /api/templates/prompts/[id]/versions/[versionId]/activate
// Eski version'a rollback (admin scope).

import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { activatePromptVersion } from "@/server/services/templates/prompts.service";

export const POST = withErrorHandling(
  async (
    _req: Request,
    ctx: { params: { id: string; versionId: string } },
  ) => {
    await requireAdmin();
    const tpl = await activatePromptVersion({
      templateId: ctx.params.id,
      versionId: ctx.params.versionId,
    });
    return NextResponse.json({ template: tpl });
  },
);
