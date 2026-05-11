// Watcher state registry — no chokidar import, safe for Next.js API routes.
// The actual chokidar watcher lives in watcher.ts (excluded from webpack via
// serverExternalPackages). This module holds only the in-memory state map
// so API routes can read watcher status without importing native binaries.

export type WatcherEntry = {
  userId: string;
  rootPath: string;
  startedAt: Date;
  triggerCount: number;
  lastTriggerAt: Date | null;
};

export const watcherRegistry = new Map<
  string,
  { entry: WatcherEntry }
>();
