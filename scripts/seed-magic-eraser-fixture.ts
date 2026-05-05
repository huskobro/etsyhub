// Pass 30 — Magic Eraser QA fixture seed.
//
// Amaç: Mevcut admin için **draft Selection Set + 1 editable item**
// üretip kullanıcının Magic Eraser akışını uçtan uca smoke edebilmesini
// sağlamak. Mevcut QA fixture (`seed-qa-fixtures.ts`) Phase 8 için
// `ready` set yaratıyor (read-only); Magic Eraser draft set + asset
// gerektirir.
//
// Idempotency:
//   marker = "magic-eraser-qa-v1" (sourceMetadata.marker)
//   tekrar çalıştırıldığında: mevcut set varsa atla (skip)
//   --reset: marker'lı set + items'ı sil (cascade), mevcut Asset
//   row'larına dokunmaz (paylaşımlı asset olabilir).
//
// Asset stratejisi:
//   Mevcut bir reference'ın asset'i reuse edilir (admin'in herhangi
//   bir reference'ı veya generated design asset). Asset üretmek için
//   storage'a yeni dosya yazmak istemiyoruz — fixture lokal kalsın.
//
// Çağrı:
//   npx tsx scripts/seed-magic-eraser-fixture.ts
//   npx tsx scripts/seed-magic-eraser-fixture.ts --reset

import "./_bootstrap-env";
import {
  SelectionSetStatus,
  SelectionItemStatus,
} from "@prisma/client";
import { db } from "@/server/db";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@etsyhub.local";
const MARKER = "magic-eraser-qa-v1";
const SET_NAME = "[QA] Magic Eraser test set";

async function main() {
  const reset = process.argv.includes("--reset");

  const admin = await db.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (!admin) {
    console.error(
      `[seed-magic-eraser] FATAL: admin yok (${ADMIN_EMAIL}). Önce: npx tsx prisma/seed.ts`,
    );
    process.exit(1);
  }

  if (reset) {
    const existing = await db.selectionSet.findMany({
      where: {
        userId: admin.id,
        sourceMetadata: { path: ["marker"], equals: MARKER },
      },
      select: { id: true },
    });
    if (existing.length === 0) {
      console.log("[seed-magic-eraser] reset: marker'lı set yok, atlanıyor");
      return;
    }
    for (const s of existing) {
      await db.selectionItem.deleteMany({ where: { selectionSetId: s.id } });
      await db.selectionSet.delete({ where: { id: s.id } });
      console.log(`[seed-magic-eraser] reset: set silindi (${s.id})`);
    }
    return;
  }

  // Idempotency: mevcut marker'lı set varsa skip
  const existing = await db.selectionSet.findFirst({
    where: {
      userId: admin.id,
      sourceMetadata: { path: ["marker"], equals: MARKER },
    },
    include: { items: { select: { id: true } } },
  });
  if (existing) {
    console.log(
      `[seed-magic-eraser] mevcut: ${existing.id} (${existing.items.length} item) — skip. Reset için: --reset`,
    );
    return;
  }

  // Asset reuse: admin'in herhangi bir aktif GeneratedDesign'ini kullan
  // (asset + productType + generatedDesign id ile birlikte).
  // SelectionItem `generatedDesignId` zorunlu (replay/lineage için).
  const candidate = await db.generatedDesign.findFirst({
    where: { userId: admin.id, deletedAt: null },
    select: { id: true, assetId: true, productTypeId: true },
    orderBy: { createdAt: "desc" },
  });
  if (!candidate) {
    console.error(
      "[seed-magic-eraser] FATAL: admin için GeneratedDesign yok. Önce variation üret veya QA fixture seed çalıştır.",
    );
    process.exit(1);
  }

  // Atomic create — set + item birlikte (validation hatası halinde
  // orphan set kalmaz).
  const { set, item } = await db.$transaction(async (tx) => {
    const set = await tx.selectionSet.create({
      data: {
        userId: admin.id,
        name: SET_NAME,
        status: SelectionSetStatus.draft,
        sourceMetadata: {
          kind: "magic-eraser-qa",
          marker: MARKER,
          productTypeId: candidate.productTypeId,
        },
      },
    });
    const item = await tx.selectionItem.create({
      data: {
        selectionSetId: set.id,
        generatedDesignId: candidate.id,
        sourceAssetId: candidate.assetId,
        editHistoryJson: [],
        status: SelectionItemStatus.pending,
        position: 0,
      },
    });
    return { set, item };
  });

  console.log(
    `[seed-magic-eraser] OK · set ${set.id} (draft) + item ${item.id} (asset ${candidate.assetId})`,
  );
  console.log(
    `  → /selection/sets/${set.id} adresinden Magic Eraser akışını test edebilirsiniz`,
  );
}

main()
  .catch((err) => {
    console.error("[seed-magic-eraser] error:", err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
