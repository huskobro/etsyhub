/**
 * Phase 65 — Test fixture mockup template cleanup.
 *
 * Sebep: Phase 64 audit'inde DB'de 3061 MockupTemplate row'u tespit
 * edildi; tümü test fixture (integration test artifact + Phase 8 swap
 * test seed + QA marker'lar). Operatör admin manager'da bu yapay
 * "katalog"u görüyor → ürün hissi bozuluyor + templated.io ürün modeli
 * (admin catalog vs my templates) anlamsız hale geliyor.
 *
 * Bu script test-fixture pattern'lerini hard-delete eder. Render history
 * ile korunma: MockupRender.templateSnapshot.config field'ı render
 * snapshot'ında template ID + config'i taşır; template silinmesi
 * geçmiş render'ları bozmaz (snapshot self-contained).
 *
 * Cascade davranışı: MockupTemplateBinding `onDelete: Cascade` →
 * binding rows otomatik silinir. MockupRender FK yok (snapshot pattern).
 *
 * Pattern'ler (dahil edilen):
 *   - "Template 0 - Phase8 Swap Test"  (Phase 8 seed)
 *   - "phase8-api-cover-swap-tpl-*"    (integration test orphan)
 *   - "Pass <N>"                        (QA fixture)
 *   - "[V2-test] *"                     (V2 admin endpoint test)
 *   - "[Phase64-test] *"                (Phase 64 user-scope test)
 *   - "[QA] *"                          (general QA marker)
 *   - name CONTAINS "test"|"Test"|"TEST" but NOT in operator-meaningful patterns
 *
 * Pattern'ler (HARİÇ — korunan):
 *   - User-owned (userId IS NOT NULL) — operator'un kendi template'i
 *   - "Bundle Preview *" (gerçek operator-facing surface'in olası seed'i)
 *   - Diğer non-test prefix'li real catalog (varsa; bu run sonrası
 *     manuel kontrol gerekebilir)
 *
 * Kullanım: `npm run cleanup:test-mockup-templates`
 *   --dry-run flag: yalnız silinecekleri listele, asıl silme yapma
 */

import { db } from "@/server/db";

const TEST_NAME_PATTERNS = [
  // Exact prefix patterns (use startsWith)
  "Template 0 - Phase8 Swap Test",
  "phase8-api-cover-swap-tpl-",
  "Pass ",
  "[V2-test]",
  "[Phase64-test]",
  "[QA]",
] as const;

const TEST_NAME_KEYWORDS = ["test", "Test", "TEST", "fixture", "Fixture"] as const;

const PRESERVE_PREFIXES = [
  "Bundle Preview",
] as const;

function isTestFixture(name: string): boolean {
  // Always preserve known operator-facing prefixes
  for (const p of PRESERVE_PREFIXES) {
    if (name.startsWith(p)) return false;
  }
  // Match any prefix
  for (const p of TEST_NAME_PATTERNS) {
    if (name.startsWith(p)) return true;
  }
  // Match keyword anywhere (case-sensitive, narrow set to avoid false positives)
  for (const k of TEST_NAME_KEYWORDS) {
    if (name.includes(k)) return true;
  }
  return false;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  console.log(
    `[cleanup] Phase 65 test-fixture mockup template cleanup ${dryRun ? "(DRY-RUN)" : "(LIVE)"}`,
  );

  // Phase 64 ownership protection: NEVER touch user-owned templates
  const candidates = await db.mockupTemplate.findMany({
    where: { userId: null },
    select: { id: true, name: true, status: true, _count: { select: { bindings: true } } },
  });

  const toDelete: typeof candidates = [];
  const preserved: typeof candidates = [];
  for (const t of candidates) {
    if (isTestFixture(t.name)) toDelete.push(t);
    else preserved.push(t);
  }

  console.log(`[cleanup] Total global (userId NULL) templates: ${candidates.length}`);
  console.log(`[cleanup] To delete (test fixtures): ${toDelete.length}`);
  console.log(`[cleanup] To preserve (real or user-owned): ${preserved.length}`);
  console.log(`[cleanup] Sample preserved names (first 20):`);
  preserved.slice(0, 20).forEach((t) => {
    console.log(`  - ${t.name} (${t.status}, ${t._count.bindings} bindings)`);
  });
  console.log(`[cleanup] Sample deletes (first 10):`);
  toDelete.slice(0, 10).forEach((t) => {
    console.log(`  - ${t.name} (${t.status})`);
  });

  if (dryRun) {
    console.log("[cleanup] DRY-RUN: no rows touched.");
    return;
  }

  // Hard delete in chunks of 100 (cascade handles bindings)
  console.log(`[cleanup] Deleting ${toDelete.length} rows...`);
  let deleted = 0;
  const ids = toDelete.map((t) => t.id);
  // Single deleteMany — Prisma handles batching internally
  const result = await db.mockupTemplate.deleteMany({
    where: { id: { in: ids } },
  });
  deleted = result.count;
  console.log(`[cleanup] Deleted ${deleted} mockup templates (cascade dropped bindings)`);

  // Final state
  const remaining = await db.mockupTemplate.count({ where: { userId: null } });
  const userOwned = await db.mockupTemplate.count({ where: { userId: { not: null } } });
  console.log(`[cleanup] Final: ${remaining} global templates + ${userOwned} user-owned templates remaining`);
}

main()
  .then(() => {
    console.log("[cleanup] DONE");
    return db.$disconnect();
  })
  .catch(async (e) => {
    console.error("[cleanup] FAILED", e);
    await db.$disconnect();
    process.exit(1);
  });
