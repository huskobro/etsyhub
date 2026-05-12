// Batch-first Phase 3 — POST /api/batches/[batchId]/create-selection
//
// Batch detail "Create Selection" CTA'sının server endpoint'i. Batch'in
// tüm KEPT MidjourneyAsset'leri için yeni SelectionSet yaratır
// (downstream gate: CLAUDE.md Madde V'' — operator-only kept zinciri).
//
// Sözleşme:
//   - Auth: requireUser (Phase 5)
//   - Path param: batchId (Job.metadata.batchId — MJ_BRIDGE batch grouping)
//   - Body: none (auto-resolve reference + productType from MJ jobs;
//     auto-name from reference.notes + date)
//   - Success: 201 + { setId, name, itemsAdded }
//   - Cross-user / olmayan batch → 404 (BATCH_NOT_FOUND)
//   - KEPT asset yok → 400 (NO_KEPT_ASSETS — operatör önce review yapmalı)
//   - Reference / ProductType resolve edilemedi → 400 (lineage missing)
//
// Pattern: aynı /api/selection/sets/quick-start route'undaki gibi
// withErrorHandling typed AppError'ları HTTP'ye map eder. Yeni route
// MJ pipeline için (quick-start GENERATE_VARIATIONS pipeline'ı için).

import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { NotFoundError, ValidationError } from "@/lib/errors";
import {
  createSelectionFromMjBatch,
  MjBatchSelectionError,
} from "@/server/services/midjourney/kept";

export const POST = withErrorHandling(
  async (
    _req: Request,
    ctx: { params: Promise<{ batchId: string }> | { batchId: string } },
  ) => {
    const user = await requireUser();
    const params = await Promise.resolve(ctx.params);
    const batchId = params.batchId;

    if (!batchId || typeof batchId !== "string" || batchId.length === 0) {
      throw new ValidationError("batchId zorunlu");
    }

    try {
      const result = await createSelectionFromMjBatch({
        userId: user.id,
        batchId,
      });
      return NextResponse.json(
        {
          setId: result.selectionSetId,
          name: result.selectionSetName,
          itemsAdded: result.itemsAdded,
          promotedCreated: result.promotedCreated,
        },
        { status: 201 },
      );
    } catch (err) {
      if (err instanceof MjBatchSelectionError) {
        if (err.code === "BATCH_NOT_FOUND") {
          throw new NotFoundError(err.message);
        }
        // NO_KEPT_ASSETS / REFERENCE_NOT_RESOLVED / PRODUCT_TYPE_NOT_RESOLVED
        // → 400 (operator action / lineage gap, not internal error)
        throw new ValidationError(err.message);
      }
      throw err;
    }
  },
);
