import { config } from "dotenv";
import path from "node:path";
config({ path: path.resolve(process.cwd(), ".env.local") });

import { db } from "@/server/db";
import { ReviewStatus, ReviewStatusSource } from "@prisma/client";

async function main() {
  // Find a real existing design to clone its required FKs
  const template = await db.generatedDesign.findFirst({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!template) throw new Error("no template design found");

  console.log("Cloning from template:", template.id);

  const seedScenarios = [
    { score: 95, status: ReviewStatus.APPROVED, label: "high-score auto-approve" },
    { score: 92, status: ReviewStatus.APPROVED, label: "edge auto-approve" },
    { score: 70, status: ReviewStatus.NEEDS_REVIEW, label: "mid-band needs-review" },
    { score: 45, status: ReviewStatus.NEEDS_REVIEW, label: "low-score needs-review" },
    { score: 50, status: ReviewStatus.PENDING, label: "fresh pending (no source decision)" },
  ];

  for (const s of seedScenarios) {
    const created = await db.generatedDesign.create({
      data: {
        userId: template.userId,
        referenceId: template.referenceId,
        assetId: template.assetId,
        productTypeId: template.productTypeId,
        promptVersionId: template.promptVersionId,
        jobId: template.jobId,
        similarity: template.similarity,
        // Review fields under test
        reviewStatus: s.status,
        reviewStatusSource: s.status === ReviewStatus.PENDING ? ReviewStatusSource.SYSTEM : ReviewStatusSource.SYSTEM,
        reviewScore: s.score,
        reviewSummary: `Seed: ${s.label}`,
        reviewProviderSnapshot: s.status === ReviewStatus.PENDING ? null : `seed-test@${new Date().toISOString().slice(0, 10)}`,
        reviewedAt: s.status === ReviewStatus.PENDING ? null : new Date(),
        reviewRiskFlags: [],
        // Variation generation fields
        capabilityUsed: template.capabilityUsed,
        aspectRatio: template.aspectRatio,
        quality: template.quality,
      },
    });
    console.log(`+ ${s.label.padEnd(40)} id=${created.id} score=${s.score} status=${s.status} source=SYSTEM`);
  }

  // Snapshot final state
  const all = await db.generatedDesign.findMany({
    where: { userId: template.userId, deletedAt: null },
    select: { reviewStatus: true, reviewStatusSource: true },
  });
  const buckets: Record<string, number> = {};
  for (const r of all) {
    const k = `${r.reviewStatus}/${r.reviewStatusSource}`;
    buckets[k] = (buckets[k] || 0) + 1;
  }
  console.log("\nFinal buckets (status/source):");
  console.log(buckets);
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
