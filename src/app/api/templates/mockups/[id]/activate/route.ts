// R9 — POST /api/templates/mockups/[id]/activate (admin scope)
//
// DRAFT → ACTIVE transition + audit + inbox notify.

import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { audit } from "@/server/audit";
import { activateMockupTemplate } from "@/server/services/templates/mockups.service";
import { notifyUser } from "@/server/services/settings/notifications-inbox.service";

export const POST = withErrorHandling(
  async (_req: Request, ctx: { params: { id: string } }) => {
    const admin = await requireAdmin();
    const result = await activateMockupTemplate({ templateId: ctx.params.id });
    await Promise.all([
      audit({
        actor: admin.id,
        action: "MOCKUP_TEMPLATE_ACTIVATED",
        targetType: "MockupTemplate",
        targetId: result.id,
      }),
      notifyUser({
        userId: admin.id,
        kind: "mockupActivated",
        title: "Mockup template activated",
        body: `Template ${result.id.slice(0, 8)} → ACTIVE — visible in Apply Mockups.`,
        href: `/templates?sub=mockups`,
      }),
    ]);
    return NextResponse.json(result);
  },
);
