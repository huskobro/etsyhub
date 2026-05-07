// Pass 63 — Filter + Batch + Downloaded badge browser smoke.
//
// Akış:
//   1. /admin/midjourney aç (default)
//   2. Filter chips görünür mü, "Bugün" tıklayınca URL ?days=today
//   3. Keyword input "pass51" yazınca ?q=pass51 (sonuç filter)
//   4. List row downloaded badge (Pass 62'de export edilen Pass 51 job için)
//   5. Detail page aç (Pass 51 c2edd80b)
//   6. AssetBatchPanel görünür, 4 checkbox + 3 ZIP buton
//   7. Per-thumb "↓ N" badge (Pass 62'de 3 export edildi)
//   8. "Hepsini seç" tıkla → 4/4 seçili
//   9. PNG ZIP buton → Network response application/zip + Content-Disposition

import { chromium } from "playwright";
const cdpUrl = "http://127.0.0.1:9222";
const adminBase = "http://localhost:3000";
const TARGET_JOB = "cmouwn0xn000a149lhkosthsn";

async function main(): Promise<void> {
  const browser = await chromium.connectOverCDP(cdpUrl);
  const ctx = browser.contexts()[0]!;
  const pages = ctx.pages();
  let page = pages.find((p) => p.url().includes("localhost:3000"));
  if (!page) page = await ctx.newPage();
  await page.bringToFront();

  // 1. List page
  await page.goto(`${adminBase}/admin/midjourney`, { waitUntil: "networkidle", timeout: 30_000 });
  await page.waitForTimeout(1500);

  // 2. Filter chips
  const filtersVisible = await page.locator('[data-testid="mj-list-filters"]').isVisible({ timeout: 3000 }).catch(() => false);
  console.log("[pass63] filters visible:", filtersVisible);

  // "Bugün" chip
  await page.locator('[data-testid="mj-filter-day-today"]').click();
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
  console.log("[pass63] after 'today' click URL:", page.url());

  // Reset
  await page.locator('[data-testid="mj-filter-day-all"]').click();
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);

  // 3. Keyword
  await page.locator('[data-testid="mj-filter-q-input"]').fill("pass51");
  await page.locator('[data-testid="mj-filter-q-submit"]').click();
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
  console.log("[pass63] after keyword 'pass51' URL:", page.url());

  // 4. Downloaded badge in list (Pass 62'de export edilen Pass 51 job)
  const downloadedBadge = await page.locator(`[data-testid="mj-list-downloaded-${TARGET_JOB}"]`).isVisible({ timeout: 3000 }).catch(() => false);
  console.log("[pass63] list downloaded badge for Pass 51 job:", downloadedBadge);
  if (downloadedBadge) {
    const txt = await page.locator(`[data-testid="mj-list-downloaded-${TARGET_JOB}"]`).innerText();
    console.log("[pass63]   badge text:", txt);
  }

  // Reset filter
  await page.locator('[data-testid="mj-filter-clear"]').click();
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);

  // 5. Detail page
  await page.goto(`${adminBase}/admin/midjourney/${TARGET_JOB}`, { waitUntil: "networkidle", timeout: 30_000 });
  await page.waitForTimeout(2000);

  // 6. AssetBatchPanel
  const batchVisible = await page.locator('[data-testid="mj-asset-batch-panel"]').isVisible({ timeout: 3000 }).catch(() => false);
  console.log("[pass63] batch panel visible:", batchVisible);
  const checkboxCount = await page.locator('[data-testid^="mj-batch-checkbox-"]').count();
  console.log("[pass63] checkbox count:", checkboxCount);
  const zipButtons = await page.locator('[data-testid^="mj-batch-export-"]').count();
  console.log("[pass63] zip buton count:", zipButtons);

  // Pass 60 placeholder
  const upscalePlaceholder = await page.locator('[data-testid="mj-batch-upscale-placeholder"]').isVisible().catch(() => false);
  console.log("[pass63] toplu upscale placeholder visible:", upscalePlaceholder);

  // 7. Per-thumb downloaded badge (Pass 62'de Pass 51 grid 0 için 3 export var)
  const TARGET_ASSET_ID = "cmouwobgf00032hm3do5nb2r6";
  const perThumbBadge = await page.locator(`[data-testid="mj-asset-downloaded-${TARGET_ASSET_ID}"]`).isVisible({ timeout: 2000 }).catch(() => false);
  console.log("[pass63] per-thumb downloaded badge:", perThumbBadge);
  if (perThumbBadge) {
    const txt = await page.locator(`[data-testid="mj-asset-downloaded-${TARGET_ASSET_ID}"]`).innerText();
    console.log("[pass63]   badge text:", txt);
  }

  // 8. Hepsini seç
  await page.locator('[data-testid="mj-batch-select-all"]').click();
  await page.waitForTimeout(500);
  const selectAfter = await page.locator('[data-testid^="mj-batch-checkbox-"]:checked').count();
  console.log("[pass63] selected after 'hepsini seç':", selectAfter);

  // 9. PNG ZIP — direct fetch (browser session)
  const ALL_ASSETS = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('[data-testid^="mj-batch-checkbox-"]'))
      .map((el) => el.getAttribute("data-testid")?.replace("mj-batch-checkbox-", "") ?? "");
  });
  console.log("[pass63] asset ids for ZIP:", ALL_ASSETS.length);

  const zipRes = await page.evaluate(async (ids: string[]) => {
    const r = await fetch("/api/admin/midjourney/asset/bulk-export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ midjourneyAssetIds: ids, format: "png", size: "full" }),
    });
    const buf = await r.arrayBuffer();
    return {
      status: r.status,
      contentType: r.headers.get("content-type") ?? "",
      contentDisposition: r.headers.get("content-disposition") ?? "",
      bytes: buf.byteLength,
    };
  }, ALL_ASSETS);
  console.log("[pass63] ZIP response:", zipRes);

  // Screenshot
  await page.screenshot({ path: "/tmp/mj-pass63-batch.png", fullPage: true });
  console.log("[pass63] screenshot /tmp/mj-pass63-batch.png");
  await browser.close();
  console.log("[pass63] DONE");
}

main().catch((err) => { console.error("FATAL:", err); process.exit(1); });
