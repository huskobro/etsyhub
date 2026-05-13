/**
 * Phase 44 — POST /api/batches/[batchId]/launch
 * Phase 48 — Multi-reference launch ACTIVE.
 * Phase 61 — Midjourney provider dispatch ACTIVE (mjMode/mjPrompt).
 *
 * DRAFT batch'i QUEUED'a transition eder + provider-aware dispatcher ile
 * gerçek jobs üretir. Job.metadata.batchId = Batch.id yazılır (synthetic
 * ve real uzaylar birleşir).
 *
 * Body:
 *   {
 *     providerId: string,
 *     aspectRatio: "1:1" | "2:3" | "3:2",
 *     quality?: "medium" | "high",
 *     count: number (1-6),
 *     brief?: string,
 *     // Phase 61 — Midjourney-only (server validates per provider)
 *     mjMode?: "imagine" | "image-prompt" | "sref" | "oref" | "cref" | "describe",
 *     mjPrompt?: string  // up to 800 chars
 *   }
 *
 * Response: { batchId, designIds, failedDesignIds, state, perReference }
 *
 * Hata davranışları (ValidationError → 400):
 *   - Batch DRAFT değilse (idempotency: zaten launch'lanmış)
 *   - Items boşsa
 *   - Reference URL public değilse (per-item; Phase 48 aggregate)
 *   - Provider i2i desteklemiyorsa (Kie path)
 *   - Provider bilinmiyorsa (non-Midjourney)
 *   - Phase 61: providerId="midjourney" + mjMode eksikse
 *   - Phase 61: imagine/image-prompt mode'unda mjPrompt eksikse
 *   - Phase 61: describe mode'unda mjPrompt verilmişse
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { launchBatch } from "@/features/batches/server/batch-service";

const MidjourneyDispatchModeSchema = z.enum([
  "imagine",
  "image-prompt",
  "sref",
  "oref",
  "cref",
  "describe",
]);

const BodySchema = z.object({
  providerId: z.string().min(1),
  aspectRatio: z.enum(["1:1", "2:3", "3:2"]),
  quality: z.enum(["medium", "high"]).optional(),
  count: z.number().int().min(1).max(6),
  brief: z.string().max(500).optional(),
  // Phase 61 — Midjourney-specific (validated server-side per provider).
  mjMode: MidjourneyDispatchModeSchema.optional(),
  mjPrompt: z.string().max(800).optional(),
});

export const POST = withErrorHandling(
  async (
    req: Request,
    ctx: { params: Promise<{ batchId: string }> | { batchId: string } },
  ) => {
    const user = await requireUser();
    const { batchId } = await Promise.resolve(ctx.params);
    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      throw new ValidationError("Invalid input", parsed.error.flatten());
    }
    const result = await launchBatch({
      userId: user.id,
      batchId,
      ...parsed.data,
    });
    return NextResponse.json(result);
  },
);
