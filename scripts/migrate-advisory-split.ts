// IA-29 one-shot data migration: SYSTEM-yazılı reviewStatus rows'ları
// reviewSuggestedStatus'a taşı; status'ü PENDING'e döndür.
// USER-source rows'lara dokunma (operatör damgası canonical).
import { config } from "dotenv";
import path from "node:path";
config({ path: path.resolve(process.cwd(), ".env.local") });

import { db } from "@/server/db";
import { ReviewStatus, ReviewStatusSource } from "@prisma/client";

async function migrateDesigns() {
  const targets = await db.generatedDesign.findMany({
    where: {
      reviewStatusSource: ReviewStatusSource.SYSTEM,
      reviewStatus: { in: [ReviewStatus.APPROVED, ReviewStatus.NEEDS_REVIEW, ReviewStatus.REJECTED] },
      reviewSuggestedStatus: null,
    },
    select: { id: true, reviewStatus: true, reviewScore: true },
  });
  for (const d of targets) {
    await db.generatedDesign.update({
      where: { id: d.id },
      data: {
        reviewSuggestedStatus: d.reviewStatus,
        reviewProviderRawScore: d.reviewScore,
        reviewStatus: ReviewStatus.PENDING,
      },
    });
  }
  return targets.length;
}

async function migrateLocal() {
  const targets = await db.localLibraryAsset.findMany({
    where: {
      reviewStatusSource: ReviewStatusSource.SYSTEM,
      reviewStatus: { in: [ReviewStatus.APPROVED, ReviewStatus.NEEDS_REVIEW, ReviewStatus.REJECTED] },
      reviewSuggestedStatus: null,
    },
    select: { id: true, reviewStatus: true, reviewScore: true },
  });
  for (const a of targets) {
    await db.localLibraryAsset.update({
      where: { id: a.id },
      data: {
        reviewSuggestedStatus: a.reviewStatus,
        reviewProviderRawScore: a.reviewScore,
        reviewStatus: ReviewStatus.PENDING,
      },
    });
  }
  return targets.length;
}

async function main() {
  const d = await migrateDesigns();
  const l = await migrateLocal();
  console.log(`Migrated ${d} designs + ${l} local assets to advisory layer.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
