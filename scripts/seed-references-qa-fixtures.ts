// References family QA fixtures — minimum dolu state için.
//
// R11.14.13 — Kullanıcı feedback'i: "/bookmarks /collections /trend-stories
// boş yüzeyleri parity'yi saklıyor". Bu seed sadece Bookmarks + Collections
// alt route'larında dolu state göstermek için minimal kayıt ekler. Production
// behavior değiştirmez; sadece admin user için 3 bookmark + 2 collection.
//
// Notlar:
//   - TrendCluster fixture eklemek için CompetitorListing zinciri lazım,
//     bu turun scope'unda yok. /trend-stories empty state korunur.
//   - Tüm kayıtlar açık [QA] prefix'iyle markalı, kolayca silinebilir.
//   - Idempotent: notes alanına marker yazıp re-run'da skip eder.
//
// Çağrı:
//   npx tsx scripts/seed-references-qa-fixtures.ts            # ekle
//   npx tsx scripts/seed-references-qa-fixtures.ts --reset    # sil
//
// Etiket: notes alanında "qa-references-v1" marker.
//
// CLAUDE.md uyumu:
//   - Production behavior dokunulmaz
//   - Admin user scope'u dışına çıkılmaz
//   - Silme her zaman idempotent (--reset)

import "./_bootstrap-env";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const MARKER = "qa-references-v1";
const SLUG_PREFIX = "qa-ref-";

async function main() {
  const reset = process.argv.includes("--reset");
  // R11.14.13 — `--email=...` flag ile target user override; default
  // `admin@etsyhub.local` (mevcut browser oturumunun primary admin'i).
  const emailArg = process.argv.find((a) => a.startsWith("--email="));
  const targetEmail = emailArg
    ? emailArg.replace("--email=", "")
    : "admin@etsyhub.local";

  const admin = await prisma.user.findFirst({
    where: { email: targetEmail },
  });
  if (!admin) {
    console.error(
      `[seed-references-qa] User '${targetEmail}' bulunamadı. --email=<email> ile override edebilirsin.`,
    );
    process.exit(1);
  }
  console.log(`[seed-references-qa] Target user: ${admin.email}`);

  if (reset) {
    const delBookmarks = await prisma.bookmark.deleteMany({
      where: {
        userId: admin.id,
        notes: { contains: MARKER },
      },
    });
    const delCollections = await prisma.collection.deleteMany({
      where: {
        userId: admin.id,
        slug: { startsWith: SLUG_PREFIX },
      },
    });
    console.log(
      `[seed-references-qa] reset: ${delBookmarks.count} bookmarks, ${delCollections.count} collections silindi.`,
    );
    return;
  }

  // 1) Collections (2 adet) — slug ile idempotent
  const colls = [
    {
      slug: `${SLUG_PREFIX}boho-wall-art`,
      name: "[QA] Boho Wall Art",
      description: "Test fixture for Collections sub-view",
      kind: "REFERENCE" as const,
    },
    {
      slug: `${SLUG_PREFIX}clipart-ideas`,
      name: "[QA] Clipart Ideas",
      description: "Test fixture for Collections sub-view",
      kind: "BOOKMARK" as const,
    },
  ];

  for (const c of colls) {
    await prisma.collection.upsert({
      where: { userId_slug: { userId: admin.id, slug: c.slug } },
      create: {
        userId: admin.id,
        slug: c.slug,
        name: c.name,
        description: c.description,
        kind: c.kind,
      },
      update: { name: c.name, kind: c.kind },
    });
  }

  // 2) Bookmarks (3 adet) — sourceUrl unique olmadığı için marker ile idempotent
  const existing = await prisma.bookmark.findMany({
    where: { userId: admin.id, notes: { contains: MARKER } },
    select: { id: true },
  });
  if (existing.length >= 3) {
    console.log(
      `[seed-references-qa] Skip: ${existing.length} mevcut [QA] bookmark var (idempotent).`,
    );
  } else {
    const inboxColl = await prisma.collection.findFirst({
      where: { userId: admin.id, slug: `${SLUG_PREFIX}clipart-ideas` },
    });
    const bookmarks = [
      {
        title: "[QA] Boho line art bundle",
        sourceUrl: "https://www.etsy.com/listing/qa-fixture-1/boho-line-art",
        sourcePlatform: "ETSY" as const,
        status: "INBOX" as const,
      },
      {
        title: "[QA] Nursery animal clipart",
        sourceUrl: "https://www.pinterest.com/pin/qa-fixture-2",
        sourcePlatform: "PINTEREST" as const,
        status: "INBOX" as const,
      },
      {
        title: "[QA] Christmas wall art set",
        sourceUrl: "https://www.etsy.com/listing/qa-fixture-3/holiday-wall-art",
        sourcePlatform: "ETSY" as const,
        status: "RISKY" as const,
        riskLevel: "MEDIUM" as const,
      },
    ];
    for (const bm of bookmarks) {
      await prisma.bookmark.create({
        data: {
          userId: admin.id,
          ...bm,
          notes: `${MARKER} :: ${bm.title}`,
          collectionId: inboxColl?.id,
        },
      });
    }
    console.log(
      `[seed-references-qa] Created: 2 collections, ${bookmarks.length} bookmarks.`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
