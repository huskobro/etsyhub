/**
 * Phase 31 — bookmark title kirliliği audit.
 * One-shot read-only inspect script.
 */
import { db } from "../src/server/db";

async function main() {
  const all = await db.bookmark.count({ where: { deletedAt: null } });
  const nullTitle = await db.bookmark.count({ where: { deletedAt: null, title: null } });
  const emptyTitle = await db.bookmark.count({ where: { deletedAt: null, title: "" } });
  const untitled = await db.bookmark.count({ where: { deletedAt: null, title: "Untitled" } });
  const httpsTitle = await db.bookmark.count({
    where: { deletedAt: null, title: { startsWith: "https://" } }
  });
  const httpTitle = await db.bookmark.count({
    where: { deletedAt: null, title: { startsWith: "http://" } }
  });
  const ok = await db.bookmark.count({
    where: {
      deletedAt: null,
      AND: [
        { title: { not: null } },
        { title: { not: "" } },
        { title: { not: "Untitled" } },
        { title: { not: { startsWith: "https://" } } },
        { title: { not: { startsWith: "http://" } } },
      ],
    },
  });
  console.log("Total active bookmarks:", all);
  console.log("  title NULL:", nullTitle);
  console.log("  title '':", emptyTitle);
  console.log("  title 'Untitled':", untitled);
  console.log("  title starts http(s)://:", httpsTitle + httpTitle);
  console.log("  title OK:", ok);

  const samples = await db.bookmark.findMany({
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
    take: 8,
  });
  console.log("\nSamples (dirty):");
  for (const s of samples) {
    console.log(`  id=${s.id.slice(0,10)} title=${JSON.stringify(s.title?.slice(0,60) ?? null)} src=${s.sourcePlatform} url=${s.sourceUrl?.slice(0,60)}`);
  }
  await db.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
