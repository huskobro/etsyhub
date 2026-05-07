// Pass 49 — Download retry script.
//
// Az önceki gerçek generate'in 4 image URL'ini browser-context fetch
// (Referer + cookie) ile indirmeyi test eder. CDN 403 fix'inin gerçekten
// çalışıp çalışmadığını canlı doğrular — yeni MJ credit harcamaz.
//
// Çalıştır:
//   $ npx tsx scripts/redownload-test.ts

import { chromium } from "playwright";
import { downloadGridImages } from "../src/drivers/generate-flow.js";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const cdpUrl = process.env["MJ_BRIDGE_CDP_URL"] ?? "http://127.0.0.1:9222";
const jobUuid = "a93d7f4f-93dd-4196-8477-779d582af1d2";

const imageUrls = [0, 1, 2, 3].map(
  (n) => `https://cdn.midjourney.com/${jobUuid}/0_${n}_640_N.webp?method=shortest`,
);

async function main(): Promise<void> {
  const browser = await chromium.connectOverCDP(cdpUrl, { timeout: 10_000 });
  const ctx = browser.contexts()[0]!;
  const pages = ctx.pages();
  const mjPage = pages.find((p) => p.url().includes("midjourney.com"));
  if (!mjPage) {
    console.error("MJ tab bulunamadı");
    process.exit(1);
  }

  const outDir = join(process.cwd(), "data", "calibrate-outputs");
  await mkdir(outDir, { recursive: true });

  console.log("Downloading 4 grid images for job:", jobUuid);
  const downloaded = await downloadGridImages(mjPage, imageUrls, outDir, jobUuid);
  for (const d of downloaded) {
    console.log(`  [grid ${d.gridIndex}] ${d.localPath}`);
  }
  await browser.close();
  console.log("DONE");
}

main().catch((err) => {
  console.error("FATAL:", err instanceof Error ? err.message : err);
  process.exit(1);
});
