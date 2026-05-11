import { config } from "dotenv";
import path from "node:path";
config({ path: path.resolve(process.cwd(), ".env.local") });

import { db } from "@/server/db";

async function main() {
  const r = await db.generatedDesign.deleteMany({
    where: { reviewSummary: { startsWith: "Seed: " } },
  });
  console.log("Deleted seed rows:", r.count);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
