// Pass 90 — Kept Assets Workspace V1: handoff orchestrator endpoint.
//
// Sözleşme:
//   POST /api/admin/midjourney/kept/handoff
//   body: {
//     midjourneyAssetIds: string[],     // 1..200
//     referenceId: string,
//     productTypeId: string,
//     selectionSetName: string,
//   }
//   200: {
//     selectionSetId, selectionSetName,
//     promotedCreated, promotedAlready,
//     itemsAdded, itemsAlreadyInSet
//   }
//   400: validation
//   403: defansif user-scope guard
//   404: reference/productType yoksa
//
// Auth: requireAdmin + service-level user check.
// Audit: MIDJOURNEY_KEPT_HANDOFF.

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError, NotFoundError, ForbiddenError } from "@/lib/errors";
import { audit } from "@/server/audit";
import {
  handoffKeptAssetsToSelectionSet,
  HandoffError,
} from "@/server/services/midjourney/kept";

const body = z.object({
  midjourneyAssetIds: z.array(z.string().min(1)).min(1).max(200),
  referenceId: z.string().min(1).max(100),
  productTypeId: z.string().min(1).max(100),
  selectionSetName: z.string().min(1).max(200),
});

export const POST = withErrorHandling(async (req: Request) => {
  const admin = await requireAdmin();

  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    throw new ValidationError(
      "Geçersiz handoff isteği",
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const result = await handoffKeptAssetsToSelectionSet({
      userId: admin.id,
      midjourneyAssetIds: parsed.data.midjourneyAssetIds,
      referenceId: parsed.data.referenceId,
      productTypeId: parsed.data.productTypeId,
      selectionSetName: parsed.data.selectionSetName,
    });

    await audit({
      actor: admin.id,
      action: "MIDJOURNEY_KEPT_HANDOFF",
      targetType: "SelectionSet",
      targetId: result.selectionSetId,
      metadata: {
        assetCount: parsed.data.midjourneyAssetIds.length,
        promotedCreated: result.promotedCreated,
        promotedAlready: result.promotedAlready,
        itemsAdded: result.itemsAdded,
      },
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof HandoffError) {
      if (err.code === "REFERENCE_NOT_FOUND" || err.code === "PRODUCT_TYPE_NOT_FOUND") {
        throw new NotFoundError(err.message);
      }
      if (err.code === "FORBIDDEN") {
        throw new ForbiddenError(err.message);
      }
      throw new ValidationError(err.message);
    }
    throw err;
  }
});
