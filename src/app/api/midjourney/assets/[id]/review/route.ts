import { NextResponse } from "next/server";
import { z } from "zod";
import { MJReviewDecision } from "@prisma/client";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError, NotFoundError } from "@/lib/errors";
import { audit } from "@/server/audit";
import {
  setMidjourneyAssetReview,
  ReviewError,
} from "@/server/services/midjourney/review";

/**
 * User-scope batch review decision endpoint (rollout-3).
 *
 * Mirrors `/api/admin/midjourney/assets/[id]/review` but uses requireUser
 * instead of requireAdmin, since the Kivasy /batches/[id]/review workspace
 * is a user-facing surface. The underlying service `setMidjourneyAssetReview`
 * already enforces ownership via Asset.userId, so promoting to user-scope is
 * a 1-line change at the auth boundary.
 *
 * Body: { decision: "UNDECIDED" | "KEPT" | "REJECTED" }
 */

const body = z.object({
  decision: z.enum(["UNDECIDED", "KEPT", "REJECTED"]),
});

export const PUT = withErrorHandling(
  async (req: Request, { params }: { params: { id: string } }) => {
    const user = await requireUser();

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
        user.id,
        parsed.data.decision as MJReviewDecision,
      );

      await audit({
        actor: user.id,
        action: "MIDJOURNEY_REVIEW_DECISION",
        targetType: "MidjourneyAsset",
        targetId: params.id,
        metadata: { decision: parsed.data.decision, scope: "user" },
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
