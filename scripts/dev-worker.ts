import { config } from "dotenv";
import path from "node:path";

config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const { startWorkers } = await import("../src/server/workers/bootstrap");
  const { syncWatchersForAllUsers, stopAllLocalLibraryWatchers } = await import(
    "../src/server/services/local-library/watcher"
  );

  await startWorkers();

  // Event-driven local discovery: start per-user chokidar watchers for all
  // users with rootFolderPath set and localAutoEnqueue enabled.
  await syncWatchersForAllUsers();

  // Graceful shutdown: close watchers on SIGINT/SIGTERM.
  const shutdown = async (signal: string) => {
    console.log(`[dev-worker] ${signal} received — shutting down watchers`);
    await stopAllLocalLibraryWatchers();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
