// Local Library File Watcher — Event-driven discovery layer.
//
// CLAUDE.md Madde U: automation must be visible and provable.
// This module provides event-driven discovery on top of the periodic
// scan (SCAN_LOCAL_FOLDER BullMQ repeat). Together they form the hybrid
// model:
//
//   Event-driven (this module):
//     - chokidar FSWatcher on user's rootFolderPath
//     - fires on: add / addDir / change
//     - debounces per-user (1s window) → enqueues SCAN_LOCAL_FOLDER
//     - fast: user drops a file → scan triggers in ~1s
//
//   Periodic fallback (BullMQ repeat):
//     - localScanIntervalMinutes in Settings → Review → Automation
//     - catches edge cases: network mount, rename without add event,
//       initial bootstrap state sync
//     - 0 = disabled (event-driven only)
//
//   Manual trigger:
//     - Settings → Local Library → "Scan now" button
//     - always available regardless of automation toggles
//
// Watcher lifecycle:
//   - startLocalLibraryWatcher(userId, rootPath) → registers a per-user
//     chokidar instance. Replaces the previous instance for the same user.
//   - stopLocalLibraryWatcher(userId) → closes the watcher.
//   - stopAllLocalLibraryWatchers() → graceful shutdown (called from
//     dev-worker.ts on SIGINT/SIGTERM).
//   - getWatcherStatus() → observable state map for admin panel ops.
//
// Activation: dev-worker.ts calls syncWatchersForAllUsers() at startup
// if localAutoEnqueue is enabled (per-user) and rootFolderPath is set.
// Settings PUT handler calls start/stop when rootFolderPath or the
// localAutoEnqueue toggle changes.
//
// Already-scored guard: scan worker skips never-triggered-before path.
// Watcher triggering a scan does NOT bypass the already-scored guard
// in the scan worker; it is purely a "kick the scanner" signal.
//
// Test isolation: WATCHER_DISABLED env var disables chokidar
// instantiation in tests (no FS side-effects).

import chokidar from "chokidar";
import { JobType } from "@prisma/client";
import { db } from "@/server/db";
import { enqueue } from "@/server/queue";
import { getUserLocalLibrarySettings } from "@/features/settings/local-library/service";
import { getReviewSettings } from "@/server/services/settings/review.service";
import { logger } from "@/lib/logger";
import { type WatcherEntry, watcherRegistry } from "./watcher-registry";

export type { WatcherEntry };

const DEBOUNCE_MS = 1000;

const watchers = new Map<string, { watcher: chokidar.FSWatcher; entry: WatcherEntry }>();
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Starts a chokidar watcher for userId/rootPath. Replaces any existing
 * watcher for the same user. No-op when WATCHER_DISABLED env is set.
 */
export async function startLocalLibraryWatcher(
  userId: string,
  rootPath: string,
): Promise<void> {
  if (process.env.WATCHER_DISABLED === "1") return;

  // Close previous watcher for this user if any.
  await stopLocalLibraryWatcher(userId);

  const entry: WatcherEntry = {
    userId,
    rootPath,
    startedAt: new Date(),
    triggerCount: 0,
    lastTriggerAt: null,
  };

  const watcher = chokidar.watch(rootPath, {
    // Watch root + first-level (mirrors discoverFolders depth=1 contract).
    depth: 1,
    // Ignore hidden files and macOS resource fork junk.
    ignored: /(^|[/\\])\.|__MACOSX|\.DS_Store/,
    // Wait for file to be fully written before emitting.
    awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 },
    // Don't emit initial scan events — only react to changes.
    ignoreInitial: true,
    persistent: true,
  });

  const trigger = (eventPath: string) => {
    entry.triggerCount += 1;
    entry.lastTriggerAt = new Date();
    logger.info(
      { userId, eventPath, triggerCount: entry.triggerCount },
      "local-library watcher: change detected, scheduling scan",
    );

    // Debounce: clear any pending timer for this user.
    const prev = debounceTimers.get(userId);
    if (prev) clearTimeout(prev);

    debounceTimers.set(
      userId,
      setTimeout(() => {
        debounceTimers.delete(userId);
        void enqueueScanFromWatcher(userId, rootPath);
      }, DEBOUNCE_MS),
    );
  };

  watcher.on("add", trigger);
  watcher.on("addDir", trigger);
  watcher.on("change", trigger);
  watcher.on("error", (err) => {
    logger.error({ userId, rootPath, err: String(err) }, "local-library watcher error");
  });

  watchers.set(userId, { watcher, entry });
  watcherRegistry.set(userId, { entry });
  logger.info({ userId, rootPath }, "local-library watcher started");
}

/**
 * Stops and removes the watcher for a given user. No-op if not watching.
 */
export async function stopLocalLibraryWatcher(userId: string): Promise<void> {
  const existing = watchers.get(userId);
  if (!existing) return;
  const timer = debounceTimers.get(userId);
  if (timer) {
    clearTimeout(timer);
    debounceTimers.delete(userId);
  }
  await existing.watcher.close();
  watchers.delete(userId);
  watcherRegistry.delete(userId);
  logger.info({ userId }, "local-library watcher stopped");
}

/** Stops all watchers — call on SIGINT/SIGTERM from dev-worker. */
export async function stopAllLocalLibraryWatchers(): Promise<void> {
  const ids = [...watchers.keys()];
  await Promise.all(ids.map((id) => stopLocalLibraryWatcher(id)));
  logger.info({ count: ids.length }, "all local-library watchers stopped");
}

/**
 * Returns a snapshot of all active watcher entries for ops visibility.
 * Reads from the shared registry (also accessible without chokidar import
 * via watcher-registry.ts for API routes).
 */
export function getWatcherStatusMap(): Map<string, WatcherEntry> {
  const out = new Map<string, WatcherEntry>();
  for (const [uid, { entry }] of watcherRegistry) {
    out.set(uid, { ...entry });
  }
  return out;
}

/** True if there is an active watcher for userId. */
export function isWatcherActive(userId: string): boolean {
  return watchers.has(userId);
}

/**
 * Called from dev-worker startup: starts watchers for all users that have
 * rootFolderPath set AND localAutoEnqueue enabled.
 */
export async function syncWatchersForAllUsers(): Promise<void> {
  if (process.env.WATCHER_DISABLED === "1") return;
  // Find all userSetting rows with key="localLibrary" that have a rootFolderPath.
  const localSettings = await db.userSetting.findMany({
    where: { key: "localLibrary" },
    select: { userId: true, value: true },
  });

  for (const row of localSettings) {
    const val = row.value as Record<string, unknown>;
    const rootFolderPath = typeof val.rootFolderPath === "string" ? val.rootFolderPath : null;
    if (!rootFolderPath) continue;

    const reviewSettings = await getReviewSettings(row.userId);
    if (!reviewSettings.automation.localAutoEnqueue) continue;

    try {
      await startLocalLibraryWatcher(row.userId, rootFolderPath);
    } catch (err) {
      logger.error(
        { userId: row.userId, rootFolderPath, err: String(err) },
        "syncWatchersForAllUsers: failed to start watcher",
      );
    }
  }
}

/**
 * Internal: enqueue a SCAN_LOCAL_FOLDER job triggered by file watcher.
 * Reads current settings fresh so rootFolderPath / targetResolution are up-to-date.
 * Best-effort: if settings changed or root is gone, logs and skips.
 */
async function enqueueScanFromWatcher(userId: string, rootPath: string): Promise<void> {
  try {
    const settings = await getUserLocalLibrarySettings(userId);
    if (!settings.rootFolderPath) {
      logger.warn({ userId }, "watcher: rootFolderPath cleared, skipping scan");
      return;
    }
    const jobId = `watcher-scan-${userId}-${Date.now()}`;
    const dbJob = await db.job.create({
      data: {
        id: jobId,
        userId,
        type: JobType.SCAN_LOCAL_FOLDER,
        status: "QUEUED",
        metadata: { trigger: "watcher", watchedPath: rootPath },
        progress: 0,
      },
    });
    await enqueue(JobType.SCAN_LOCAL_FOLDER, {
      jobId: dbJob.id,
      userId,
      rootFolderPath: settings.rootFolderPath,
      targetResolution: settings.targetResolution,
      targetDpi: settings.targetDpi,
    });
    logger.info({ userId, jobId: dbJob.id }, "watcher: SCAN_LOCAL_FOLDER enqueued");
  } catch (err) {
    logger.error(
      { userId, rootPath, err: err instanceof Error ? err.message : String(err) },
      "watcher: failed to enqueue scan",
    );
  }
}
