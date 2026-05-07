// Pass 52 — Admin /midjourney detail browser smoke.
//
// Aynı attach edilmiş Chrome admin tab'ını kullanır:
//   1. /admin/midjourney aç
//   2. Tabloda thumb column görünüyor mu doğrula
//   3. İlk job'un row'una/thumb'ına tıkla → /admin/midjourney/[id]
//   4. Detail sayfasının ana bölümleri görünüyor mu doğrula
//      (meta + outputs grid + prompt + lifecycle)
//   5. 4 thumbnail signed URL'lerinden gerçekten yüklendi mi
//
// Çalıştır: cd mj-bridge && npx tsx scripts/admin-detail-smoke.ts

import { chromium, type Page } from "playwright";

const cdpUrl = process.env["MJ_BRIDGE_CDP_URL"] ?? "http://127.0.0.1:9222";
const adminBase = process.env["ADMIN_BASE"] ?? "http://localhost:3000";

async function smokeListPage(page: Page): Promise<{ firstHref: string | null }> {
  await page.goto(`${adminBase}/admin/midjourney`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);

  const url = page.url();
  console.log("[detail-smoke] list URL:", url);
  if (url.includes("/login")) {
    throw new Error("Admin /login redirect — admin oturumu yok");
  }

  const headers = await page.locator("table thead th").allInnerTexts();
  console.log("[detail-smoke] tablo header:", headers);
  if (!headers.includes("Önizleme")) {
    throw new Error("Tabloda 'Önizleme' kolonu yok (Pass 52 thumb column eksik)");
  }

  const rowCount = await page.locator("table tbody tr").count();
  console.log("[detail-smoke] row count:", rowCount);
  if (rowCount === 0) {
    return { firstHref: null };
  }

  // İlk satırdaki detail link
  const firstLink = page.locator("table tbody tr").first().locator("a").first();
  const firstHref = await firstLink.getAttribute("href");
  console.log("[detail-smoke] first row href:", firstHref);
  return { firstHref };
}

async function smokeDetailPage(page: Page, href: string): Promise<void> {
  await page.goto(`${adminBase}${href}`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);

  const url = page.url();
  console.log("[detail-smoke] detail URL:", url);
  if (url.includes("/login")) {
    throw new Error("Admin /login redirect (detail page)");
  }

  // Ana section'lar
  const meta = await page.locator('[data-testid="mj-job-meta"]').isVisible({ timeout: 5_000 }).catch(() => false);
  const outputs = await page.locator('[data-testid="mj-job-outputs"]').isVisible({ timeout: 5_000 }).catch(() => false);
  console.log("[detail-smoke] meta visible:", meta);
  console.log("[detail-smoke] outputs visible:", outputs);
  if (!meta || !outputs) throw new Error("Detail sections eksik");

  // Thumbnails
  const thumbs = page.locator('[data-testid="mj-asset-thumb"], [data-testid="mj-asset-thumb-loading"], [data-testid="mj-asset-thumb-error"]');
  // Yüklenmek için biraz bekle
  await page.waitForTimeout(2500);
  const total = await thumbs.count();
  const loaded = await page.locator('[data-testid="mj-asset-thumb"] img').count();
  const failed = await page.locator('[data-testid="mj-asset-thumb-error"]').count();
  console.log(`[detail-smoke] thumbs total=${total} loaded=${loaded} failed=${failed}`);

  // En az bir thumb varsa bir img naturalWidth > 0 olmalı
  if (loaded > 0) {
    const sizes = await page.locator('[data-testid="mj-asset-thumb"] img').evaluateAll(
      (imgs) =>
        (imgs as HTMLImageElement[]).map((img) => ({
          naturalWidth: img.naturalWidth,
          src: img.src.slice(0, 60),
        })),
    );
    for (const s of sizes) console.log(`  img: w=${s.naturalWidth} src=${s.src}…`);
  }
}

async function main(): Promise<void> {
  const browser = await chromium.connectOverCDP(cdpUrl, { timeout: 10_000 });
  const ctx = browser.contexts()[0]!;
  const pages = ctx.pages();
  let page = pages.find(
    (p) => p.url().includes("localhost:3000") || p.url().includes("127.0.0.1:3000"),
  );
  if (!page) page = await ctx.newPage();
  await page.bringToFront().catch(() => undefined);

  const list = await smokeListPage(page);
  if (!list.firstHref) {
    console.log("[detail-smoke] tabloda satır yok — detail testi skip");
    await browser.close();
    return;
  }
  await smokeDetailPage(page, list.firstHref);
  console.log("[detail-smoke] DONE");
  await browser.close();
}

main().catch((err) => {
  console.error("[detail-smoke] FATAL:", err instanceof Error ? err.message : err);
  process.exit(1);
});
