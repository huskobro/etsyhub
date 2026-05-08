// R4 — POST /api/selection/sets/[setId]/items/from-library
//
// Library bulk-bar / detail-panel "Add to Selection" hand-off endpoint'i.
// Body: { midjourneyAssetIds: string[] }.
// Mevcut sete user-scope KEPT asset'leri promote edip ekler — set'in
// `sourceMetadata.mjOrigin.referenceId/productTypeId` blob'unu kullanır.
//
// Status mapping:
//   200 — success
//   400 — invalid body / NO_ASSETS
//   404 — set yok / cross-user
//   409 — set ready/archived (read-only)
//   422 — set hand-off destekli değil (mjOrigin yok)
//
// Audit: HANDOFF_LIBRARY_TO_SELECTION_SET (R4 yeni event tipi).

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import {
  ValidationError,
  SetReadOnlyError,
} from "@/lib/errors";
import { audit } from "@/server/audit";
import {
  addLibraryAssetsToExistingSet,
} from "@/server/services/midjourney/handoff-existing";
import { HandoffError } from "@/server/services/midjourney/kept";

const body = z.object({
  midjourneyAssetIds: z.array(z.string().min(1)).min(1).max(200),
});

export const POST = withErrorHandling(
  async (req: Request, ctx: { params: { setId: string } }) => {
    const user = await requireUser();

    const parsed = body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      throw new ValidationError(
        "Geçersiz hand-off isteği",
        parsed.error.flatten().fieldErrors,
      );
    }

    try {
      const result = await addLibraryAssetsToExistingSet({
        userId: user.id,
        setId: ctx.params.setId,
        midjourneyAssetIds: parsed.data.midjourneyAssetIds,
      });

      await audit({
        actor: user.id,
        action: "HANDOFF_LIBRARY_TO_SELECTION_SET",
        targetType: "SelectionSet",
        targetId: result.setId,
        metadata: {
          assetCount: parsed.data.midjourneyAssetIds.length,
          itemsAdded: result.itemsAdded,
          itemsAlreadyInSet: result.itemsAlreadyInSet,
          promotedCreated: result.promotedCreated,
          promotedAlready: result.promotedAlready,
        },
      });

      return NextResponse.json(result);
    } catch (err) {
      if (err instanceof HandoffError) {
        if (err.code === "NO_ASSETS") {
          throw new ValidationError(err.message);
        }
        if (err.code === "FORBIDDEN") {
          // Boundary: set hand-off destekli değilse 422 — operatör legacy
          // quick-start akışına yönlendirilir.
          return NextResponse.json(
            { error: err.message },
            { status: 422 },
          );
        }
      }
      if (err instanceof SetReadOnlyError) {
        return NextResponse.json(
          { error: err.message },
          { status: 409 },
        );
      }
      throw err;
    }
  },
);
