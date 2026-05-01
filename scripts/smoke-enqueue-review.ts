import { config } from "dotenv";
import path from "node:path";
config({ path: path.resolve(process.cwd(), ".env.local") });

import { PrismaClient, JobType } from "@prisma/client";
import { enqueue } from "@/server/queue";

async function main() {
  const db = new PrismaClient();
  try {
    const admin = await db.user.findUnique({ where: { email: "admin@etsyhub.local" } });
    if (!admin) throw new Error("no admin");
    const designId = "cmoklo1hi0006xn3w7554cwud";
    const job = await enqueue(JobType.REVIEW_DESIGN, {
      scope: "design",
      generatedDesignId: designId,
      userId: admin.id,
    });
    console.log("Enqueued REVIEW_DESIGN job id:", job.id, "for design:", designId);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
