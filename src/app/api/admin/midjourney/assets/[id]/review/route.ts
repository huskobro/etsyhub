// Pass 89 — Batch Review Studio V1: tek asset karar set.
//
// Sözleşme:
//   PUT /api/admin/midjourney/assets/[id]/review
//   body: { decision: "UNDECIDED" | "KEPT" | "REJECTED" }
//
// Auth: requireAdmin + service'te user-scope check (Asset.userId).
// Idempotent: aynı decision'ı tekrar set etmek hata değil.
// Audit: action=MIDJOURNEY_REVIEW_DECISION.

import { NextResponse } from "next/server";
import { z } from "zod";
import { MJReviewDecision } from "@prisma/client";
import { requireAdmin } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError, NotFoundError } from "@/lib/errors";
import { audit } from "@/server/audit";
import {
  setMidjourneyAssetReview,
  ReviewError,
} from "@/server/services/midjourney/review";

const body = z.object({
  decision: z.enum(["UNDECIDED", "KEPT", "REJECTED"]),
});

export const PUT = withErrorHandling(
  async (req: Request, { params }: { params: { id: string } }) => {
    const admin = await requireAdmin();

    const parsed = body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      throw new ValidationError(
        "Geçersiz review kararı",
        parsed.error.flatten().fieldErrors,
      );
    }

    try {
      const result = await setMidjourneyAssetReview(
        params.id,
        admin.id,
        parsed.data.decision as MJReviewDecision,
      );

      await audit({
        actor: admin.id,
        action: "MIDJOURNEY_REVIEW_DECISION",
        targetType: "MidjourneyAsset",
        targetId: params.id,
        metadata: { decision: parsed.data.decision },
      });

      return NextResponse.json(result);
    } catch (err) {
      if (err instanceof ReviewError && err.code === "ASSET_NOT_FOUND") {
        throw new NotFoundError(err.message);
      }
      throw err;
    }
  },
);
