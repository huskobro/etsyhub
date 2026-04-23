import { config } from "dotenv";
import path from "node:path";

config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const { startWorkers } = await import("../src/server/workers/bootstrap");
  startWorkers();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
