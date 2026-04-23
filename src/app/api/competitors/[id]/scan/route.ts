import { NextResponse } from "next/server";
import { CompetitorScanType } from "@prisma/client";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { triggerScanInput } from "@/features/competitors/schemas";
import { triggerScan } from "@/features/competitors/services/competitor-service";
import { audit } from "@/server/audit";

type Ctx = { params: { id: string } };

export const POST = withErrorHandling(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();

  // Body opsiyonel: tamamen boşsa default type'a düş.
  let rawBody: unknown = {};
  try {
    rawBody = await req.json();
  } catch {
    rawBody = {};
  }

  const parsed = triggerScanInput.safeParse(rawBody);
  if (!parsed.success) {
    throw new ValidationError("Geçersiz istek", parsed.error.flatten());
  }

  const scanType = CompetitorScanType[parsed.data.type];
  const result = await triggerScan({
    userId: user.id,
    competitorStoreId: ctx.params.id,
    type: scanType,
  });

  await audit({
    actor: user.id,
    userId: user.id,
    action: "competitor.scan.trigger",
    targetType: "CompetitorStore",
    targetId: ctx.params.id,
    metadata: {
      scanType,
      scanId: result.scanId,
      jobId: result.jobId,
    },
  });

  return NextResponse.json(result, { status: 202 });
});
