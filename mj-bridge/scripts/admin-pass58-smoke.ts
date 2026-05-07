// Pass 58 — ReferencePicker arama + FailureDetail structured panel smoke.
//
// Akış:
//   1. /admin/midjourney aç
//   2. Test Render formu Reference picker'ı (search input + select) görünür mü
//   3. Search input "wall" yaz, debounce 400ms, sonuç sadece eşleşenler mi
//   4. Search input "asla-yok-xyz" yaz, sonuç boş mu
//   5. CANCELLED job detail aç → FailureDetail görünür mü
//   6. Action hint var mı (blockReason=user-cancelled için)
//   7. Stack collapse mevcut mu (multi-line failedReason için)
//   8. Screenshot

import { chromium, type Page } from "playwright";
import { mkdir } from "node:fs/promises";

const cdpUrl = process.env["MJ_BRIDGE_CDP_URL"] ?? "http://127.0.0.1:9222";
const adminBase = process.env["ADMIN_BASE"] ?? "http://localhost:3000";
const CANCELLED_JOB =
  process.env["CANCELLED_JOB"] ?? "cmouyc0um000g149lvla2eyh4";

async function smokeReferenceSearch(page: Page): Promise<void> {
  await page.goto(`${adminBase}/admin/midjourney`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);

  const search = page.locator('[data-testid="mj-test-render-ref-search"]');
  const select = page.locator('[data-testid="mj-test-render-ref-select"]');

  await search.waitFor({ timeout: 5_000 });
  console.log("[pass58] reference search input visible ✓");

  // İlk option count
  await page.waitForTimeout(700); // initial debounce + fetch
  const initialCount = await select.locator("option").count();
  console.log("[pass58] initial option count:", initialCount);

  // "wall" araması
  await search.fill("wall");
  await page.waitForTimeout(800);
  const wallCount = await select.locator("option").count();
  console.log("[pass58] 'wall' option count:", wallCount);

  // Boş arama
  await search.fill("asla-yok-xyz-42");
  await page.waitForTimeout(800);
  const emptyCount = await select.locator("option").count();
  console.log("[pass58] 'asla-yok' option count:", emptyCount, "(allowEmpty=true → 1 default option)");

  // Search'ı temizle
  await search.fill("");
  await page.waitForTimeout(800);
  const restoredCount = await select.locator("option").count();
  console.log("[pass58] cleared option count:", restoredCount);
  if (restoredCount < initialCount) {
    throw new Error(
      `Search clear sonrası option count azalmış (initial=${initialCount}, cleared=${restoredCount})`,
    );
  }
}

async function smokeFailureDetail(page: Page): Promise<void> {
  await page.goto(`${adminBase}/admin/midjourney/${CANCELLED_JOB}`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);

  const panel = page.locator('[data-testid="mj-job-failed-reason"]');
  const visible = await panel.isVisible({ timeout: 5_000 }).catch(() => false);
  console.log("[pass58] FailureDetail visible:", visible);
  if (!visible) throw new Error("FailureDetail panel yok");

  const hint = page.locator('[data-testid="mj-failure-hint"]');
  const hintVisible = await hint.isVisible({ timeout: 2_000 }).catch(() => false);
  console.log("[pass58] action hint visible:", hintVisible);
  if (hintVisible) {
    const hintText = await hint.innerText();
    console.log("[pass58] hint:", hintText.slice(0, 80));
  }

  // blockReason badge
  const block = await panel
    .locator("span")
    .filter({ hasText: "user-cancelled" })
    .count();
  console.log("[pass58] blockReason badge present:", block > 0);

  await mkdir("/tmp", { recursive: true }).catch(() => undefined);
  await page.screenshot({ path: "/tmp/mj-pass58-failure-detail.png", fullPage: true });
  console.log("[pass58] screenshot /tmp/mj-pass58-failure-detail.png");
}

async function main(): Promise<void> {
  const browser = await chromium.connectOverCDP(cdpUrl, { timeout: 10_000 });
  const ctx = browser.contexts()[0]!;
  const pages = ctx.pages();
  let page = pages.find((p) => p.url().includes("localhost:3000"));
  if (!page) page = await ctx.newPage();
  await page.bringToFront().catch(() => undefined);

  console.log("=== Reference search smoke ===");
  await smokeReferenceSearch(page);

  console.log("\n=== FailureDetail smoke ===");
  await smokeFailureDetail(page);

  console.log("\n[pass58] DONE");
  await browser.close();
}

main().catch((err) => {
  console.error("[pass58] FATAL:", err instanceof Error ? err.message : err);
  process.exit(1);
});
