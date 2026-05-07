// Pass 62 — Export endpoint + UI butonları smoke.
//
// Akış:
//   1. /admin/midjourney/{COMPLETED} aç
//   2. Per-thumb ExportButtons görünür mü
//   3. Browser session'da fetch /export?format=png|jpeg|webp
//   4. HTTP 200 + content-type doğru + bytes>0
//   5. Content-Disposition attachment header doğru

import { chromium, type Page } from "playwright";
const cdpUrl = "http://127.0.0.1:9222";
const adminBase = "http://localhost:3000";
const TARGET_JOB = "cmouwn0xn000a149lhkosthsn";
const TARGET_ASSET = "cmouwobgf00032hm3do5nb2r6";

async function main(): Promise<void> {
  const browser = await chromium.connectOverCDP(cdpUrl);
  const ctx = browser.contexts()[0]!;
  const pages = ctx.pages();
  let page = pages.find(p => p.url().includes("localhost:3000"));
  if (!page) page = await ctx.newPage();
  await page.bringToFront();

  await page.goto(`${adminBase}/admin/midjourney/${TARGET_JOB}`, { waitUntil: "networkidle", timeout: 30_000 });
  await page.waitForTimeout(1500);

  // ExportButtons görünür mü
  const pngBtn = page.locator(`[data-testid="mj-export-png-${TARGET_ASSET}"]`);
  const jpegBtn = page.locator(`[data-testid="mj-export-jpeg-${TARGET_ASSET}"]`);
  const webpBtn = page.locator(`[data-testid="mj-export-webp-${TARGET_ASSET}"]`);
  console.log("PNG buton:", await pngBtn.isVisible({ timeout: 3_000 }).catch(() => false));
  console.log("JPEG buton:", await jpegBtn.isVisible({ timeout: 1_000 }).catch(() => false));
  console.log("WebP buton:", await webpBtn.isVisible({ timeout: 1_000 }).catch(() => false));

  // Direct fetch — browser session cookie ile
  for (const fmt of ["png", "jpeg", "webp"]) {
    const res = await page.evaluate(async ({ a, f }: { a: string; f: string }) => {
      const r = await fetch(`/api/admin/midjourney/asset/${a}/export?format=${f}&size=full`);
      const buf = await r.arrayBuffer();
      return {
        status: r.status,
        contentType: r.headers.get("content-type") ?? "",
        contentDisposition: r.headers.get("content-disposition") ?? "",
        bytes: buf.byteLength,
      };
    }, { a: TARGET_ASSET, f: fmt });
    console.log(`\n[${fmt}] status=${res.status} ctype=${res.contentType} bytes=${res.bytes}`);
    console.log(`  disposition: ${res.contentDisposition}`);
  }

  await browser.close();
  console.log("\n[pass62] DONE");
}

main().catch((err) => { console.error("FATAL:", err); process.exit(1); });
