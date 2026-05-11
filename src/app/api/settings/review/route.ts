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
import { watcherRegistry } from "@/server/services/local-library/watcher-registry";
import { listPendingScopes } from "@/server/services/review/next-scope";
import { scheduleRepeatJob, cancelRepeatJob } from "@/server/queue";
import { getUserLocalLibrarySettings } from "@/features/settings/local-library/service";
import { logger } from "@/lib/logger";

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

  const resolved = await getResolvedReviewConfig(user.id);
  // Watcher runs in the same process (instrumentation.ts), so we can read
  // its state directly from the chokidar-free registry module.
  const watcherEntry = watcherRegistry.get(user.id)?.entry;
  const [opsCounts, folderScopes, batchScopes, referenceScopes] =
    await Promise.all([
      getReviewOpsCounts(user.id, {
        localScanIntervalMinutes: resolved.automation.localScanIntervalMinutes,
        watcherInfo: watcherEntry
          ? {
              active: true,
              triggerCount: watcherEntry.triggerCount,
              lastTriggerAt: watcherEntry.lastTriggerAt,
            }
          : undefined,
      }),
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

/** Stable repeat job ID for a user's local scan schedule. */
function localScanRepeatJobId(userId: string) {
  return `local-scan-periodic-${userId}`;
}

/**
 * IA-39 — sync local scan periodic schedule when automation settings change.
 * interval=0 → cancel any existing repeat. interval>0 → upsert BullMQ repeat.
 * Best-effort; failure is logged but does NOT roll back the settings save.
 */
async function syncLocalScanSchedule(userId: string, intervalMinutes: number) {
  const jobId = localScanRepeatJobId(userId);
  try {
    if (intervalMinutes <= 0) {
      await cancelRepeatJob("SCAN_LOCAL_FOLDER", jobId);
      logger.info({ userId, jobId }, "local scan periodic schedule removed");
      return;
    }
    // BullMQ cron expression: every N minutes.
    const pattern = `*/${intervalMinutes} * * * *`;
    const localSettings = await getUserLocalLibrarySettings(userId);
    const rootFolderPath = localSettings.rootFolderPath;
    if (!rootFolderPath) {
      logger.info(
        { userId, intervalMinutes },
        "local scan periodic schedule skipped: no root folder set",
      );
      return;
    }
    const result = await scheduleRepeatJob(
      "SCAN_LOCAL_FOLDER",
      {
        jobId: `${jobId}-run`,
        userId,
        rootFolderPath,
        targetResolution: localSettings.targetResolution,
        targetDpi: localSettings.targetDpi,
      },
      { jobId, pattern },
    );
    logger.info(
      { userId, pattern, alreadyScheduled: result.alreadyScheduled },
      "local scan periodic schedule synced",
    );
  } catch (err) {
    logger.error(
      { userId, intervalMinutes, err: err instanceof Error ? err.message : String(err) },
      "local scan periodic schedule sync failed (non-fatal)",
    );
  }
}

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
  // IA-39 — sync periodic local scan schedule if automation was changed.
  if (parsed.data.automation?.localScanIntervalMinutes !== undefined) {
    await syncLocalScanSchedule(user.id, settings.automation.localScanIntervalMinutes);
  }
  // Note: chokidar file watcher lives in the worker process only —
  // API routes must not import watcher.ts (native binary incompatible
  // with Next.js webpack). The worker process re-checks settings on
  // next restart or periodic sync.
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

