// Next.js instrumentation hook — runs once when the server boots.
// Starts BullMQ workers and chokidar local-library watcher automatically
// so the user only needs `npm run dev` or `npm run start`.
//
// Why here instead of a separate `npm run worker`:
//   - BullMQ workers (Redis consumers) have no webpack/bundler constraints.
//   - chokidar/fsevents are excluded from Next.js bundling via
//     serverExternalPackages and are safe to import at runtime.
//   - instrumentation.ts runs in the Node.js server process, not in the
//     browser bundle — native modules are fully available.
//
// Guard: only run in the Node.js runtime (not edge runtime, not browser).
// SKIP_WORKER_BOOT=1 env allows test environments to opt out.
//
// Placement note: must live under src/ when the project uses src/ layout.
// Next.js dev bundler scans path.join(appDir, "..") = src/ for this file.

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.SKIP_WORKER_BOOT === "1") return;
  if (process.env.NODE_ENV === "test") return;

  // Dynamic imports keep these out of the client/edge bundle entirely.
  const { startWorkers } = await import("./server/workers/bootstrap");
  const { syncWatchersForAllUsers, stopAllLocalLibraryWatchers } = await import(
    "./server/services/local-library/watcher"
  );

  await startWorkers();
  await syncWatchersForAllUsers();

  // Graceful shutdown: close watchers when the Next.js process exits.
  const shutdown = async (signal: string) => {
    console.log(`[instrumentation] ${signal} — shutting down watchers`);
    await stopAllLocalLibraryWatchers();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}
