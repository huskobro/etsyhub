/**
 * Phase 31 — bookmark.title backfill (one-shot).
 *
 * Phase 30 server-side `deriveTitleFromUrl` fallback chain devreye girdi
 * (yeni bookmark create'lerde title null kalmaz). Bu script Phase 30
 * **öncesi** yazılmış legacy bookmark'ları temizler.
 *
 * Hedef tablo: `Bookmark` (deletedAt IS NULL)
 *
 * Update kuralları (defansif — operatör niyetini bozmaz):
 *   - `title IS NULL` veya `title = ""` veya `title = "Untitled"`:
 *     `sourceUrl` varsa `deriveTitleFromUrl(sourceUrl)` ile yazılır;
 *     yoksa olduğu gibi bırakılır (asset-only upload bookmark'ları
 *     için title üretilemez — manuel edit operatörün işi)
 *   - `title` `http(s)://` ile başlıyor (raw URL stuck):
 *     `deriveTitleFromUrl(sourceUrl ?? title)` ile yazılır
 *   - Diğer tüm bookmark'lar: dokunulmaz (operatörün yazdığı title
 *     korunur, "[QA] Nursery animal clipart" gibi explicit kayıtlar)
 *
 * `--dry-run` flag ile preview yapılır (DB'ye yazmaz).
 */

import { db } from "../src/server/db";
import { deriveTitleFromUrl } from "../src/lib/derive-title-from-url";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  console.log(`Backfill mode: ${dryRun ? "DRY RUN (no writes)" : "APPLY"}`);

  // Find dirty candidates
  const candidates = await db.bookmark.findMany({
    where: {
      deletedAt: null,
      OR: [
        { title: null },
        { title: "" },
        { title: "Untitled" },
        { title: { startsWith: "https://" } },
        { title: { startsWith: "http://" } },
      ],
    },
    select: { id: true, title: true, sourceUrl: true, sourcePlatform: true },
  });

  console.log(`Found ${candidates.length} candidate bookmark(s).`);

  let updated = 0;
  let skipped = 0;
  for (const b of candidates) {
    // Resolve source for title derivation: prefer sourceUrl; fallback to
    // the existing raw URL stuck in title.
    const urlForDerivation =
      b.sourceUrl ??
      (b.title && /^https?:\/\//i.test(b.title) ? b.title : null);

    if (!urlForDerivation) {
      console.log(
        `  SKIP ${b.id.slice(0, 10)} (no URL, src=${b.sourcePlatform})`,
      );
      skipped++;
      continue;
    }

    const derived = deriveTitleFromUrl(urlForDerivation);
    if (!derived) {
      console.log(`  SKIP ${b.id.slice(0, 10)} (derive failed)`);
      skipped++;
      continue;
    }

    console.log(
      `  UPDATE ${b.id.slice(0, 10)}: ${JSON.stringify(b.title?.slice(0, 40) ?? null)} → ${JSON.stringify(derived.slice(0, 40))}`,
    );

    if (!dryRun) {
      await db.bookmark.update({
        where: { id: b.id },
        data: { title: derived },
      });
    }
    updated++;
  }

  console.log(`\nResult: updated=${updated} skipped=${skipped}`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
