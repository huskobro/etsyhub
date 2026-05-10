// IA Phase 17 — GET / PUT / PATCH /api/settings/review
//
// CLAUDE.md Madde O — admin-editable review scoring config endpoint.
//
//   GET   → resolved view: settings + merged criteria list +
//           coreMasterPrompt (override or builtin) + builtinCore.
//           UI'a tek payload yeterli; pane preview + checklist
//           tek round-trip.
//
//   PUT   → upsert settings (full or partial). Body schema permits
//           partial coreMasterPrompt + criterionOverrides updates.
//
//   PATCH → reset a single criterion override (revert to builtin).
//           Body: { criterionId: ReviewRiskFlagType }.
//
// Authorization: requireUser. Multi-tenant — settings keyed per user.
// Admin-only enforcement (page-level Settings shell hides the rail
// item for non-admins) layered on top; defense in depth.

import { NextResponse } from "next/server";
import { z } from "zod";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { requireUser } from "@/server/session";
import {
  getResolvedReviewConfig,
  resetCriterionOverride,
  ReviewSettingsSchema,
  updateReviewSettings,
} from "@/server/services/settings/review.service";
import {
  REVIEW_RISK_FLAG_TYPES,
  TECHNICAL_REVIEW_FLAG_TYPES,
} from "@/providers/review/types";

const ALL_CRITERION_IDS = [
  ...REVIEW_RISK_FLAG_TYPES,
  ...TECHNICAL_REVIEW_FLAG_TYPES,
] as const;
import { composeReviewSystemPrompt } from "@/providers/review/criteria";
import { getReviewOpsCounts } from "@/server/services/review/lifecycle";
import { listPendingScopes } from "@/server/services/review/next-scope";

const PutSchema = ReviewSettingsSchema.partial();

const PatchSchema = z.object({
  criterionId: z.enum(ALL_CRITERION_IDS),
});

export const GET = withErrorHandling(async (req: Request) => {
  const user = await requireUser();
  const url = new URL(req.url);
  // Optional preview context for the master-prompt preview block.
  // Defaults: wall_art / png / no transform — admin can pass query
  // params to preview a different context.
  const productType = url.searchParams.get("productType") ?? "wall_art";
  const format = (url.searchParams.get("format") ?? "png").toLowerCase();
  const sourceKindRaw = url.searchParams.get("sourceKind") ?? "design";
  const sourceKind: "design" | "local-library" =
    sourceKindRaw === "local-library" ? "local-library" : "design";

  const [resolved, opsCounts, folderScopes, batchScopes, referenceScopes] =
    await Promise.all([
      getResolvedReviewConfig(user.id),
      getReviewOpsCounts(user.id),
      listPendingScopes({ userId: user.id, kind: "folder" }),
      listPendingScopes({ userId: user.id, kind: "batch" }),
      listPendingScopes({ userId: user.id, kind: "reference" }),
    ]);
  const compose = composeReviewSystemPrompt(
    {
      productType,
      format,
      hasAlpha: format === "jpeg" || format === "jpg" ? false : null,
      sourceKind,
      transformsApplied: [],
    },
    {
      coreMasterPrompt: resolved.settings.coreMasterPrompt ?? undefined,
      criteria: resolved.criteria,
    },
  );

  return NextResponse.json({
    settings: resolved.settings,
    criteria: resolved.criteria,
    builtinCore: resolved.builtinCore,
    preview: {
      context: { productType, format, sourceKind },
      systemPrompt: compose.systemPrompt,
      selectedCriterionIds: compose.selectedCriterionIds,
      fingerprint: compose.fingerprint,
      coreOverrideRejected: compose.coreOverrideRejected,
    },
    ops: opsCounts,
    pickers: {
      folder: folderScopes,
      batch: batchScopes,
      reference: referenceScopes,
    },
  });
});

export const PUT = withErrorHandling(async (req: Request) => {
  const user = await requireUser();
  const json = await req.json().catch(() => null);
  const parsed = PutSchema.safeParse(json);
  if (!parsed.success) {
    throw new ValidationError(
      "Invalid review settings payload",
      parsed.error.flatten(),
    );
  }
  const settings = await updateReviewSettings(user.id, parsed.data);
  return NextResponse.json({ settings });
});

export const PATCH = withErrorHandling(async (req: Request) => {
  const user = await requireUser();
  const json = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(json);
  if (!parsed.success) {
    throw new ValidationError(
      "Invalid reset payload",
      parsed.error.flatten(),
    );
  }
  const settings = await resetCriterionOverride(user.id, parsed.data.criterionId);
  return NextResponse.json({ settings });
});

