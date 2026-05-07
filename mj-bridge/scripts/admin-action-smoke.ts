// Pass 53 — Detail action bar smoke test.
//
// Akış:
//   1. /admin/midjourney aç → ilk completed row'a git
//   2. Detail sayfasında ActionBar görünüyor mu, Retry butonu var mı?
//   3. Retry'a tıkla → router yeni job sayfasına geçer
//   4. Yeni job sayfasında Cancel butonu görünüyor mu (state in-progress)?
//   5. Cancel'a tıkla (confirm dialog dialog event'iyle bypass)
//   6. State CANCELLED'a düştü mü?
//   7. Tekrar Retry görünüyor mu?

import { chromium, type Page } from "playwright";

const cdpUrl = process.env["MJ_BRIDGE_CDP_URL"] ?? "http://127.0.0.1:9222";
const adminBase = process.env["ADMIN_BASE"] ?? "http://localhost:3000";

async function gotoDetailFromList(page: Page): Promise<string> {
  await page.goto(`${adminBase}/admin/midjourney`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);

  const firstHref = await page
    .locator("table tbody tr")
    .first()
    .locator("a")
    .first()
    .getAttribute("href");
  if (!firstHref) throw new Error("İlk row'da link yok");

  await page.goto(`${adminBase}${firstHref}`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
  return firstHref;
}

async function readState(page: Page): Promise<string> {
  // h1'in yanındaki badge — ilk badge state
  const badge = await page.locator("h1 + div span, h1 ~ div span").first().innerText().catch(() => "?");
  return badge;
}

async function main(): Promise<void> {
  const browser = await chromium.connectOverCDP(cdpUrl, { timeout: 10_000 });
  const ctx = browser.contexts()[0]!;
  const pages = ctx.pages();
  let page = pages.find((p) => p.url().includes("localhost:3000"));
  if (!page) page = await ctx.newPage();
  await page.bringToFront().catch(() => undefined);

  // 1) Liste → detail (en yeni job)
  const initialHref = await gotoDetailFromList(page);
  console.log("[action-smoke] initial detail:", initialHref);

  // 2) ActionBar?
  const actionBar = page.locator('[data-testid="mj-job-action-bar"]');
  const actionBarVisible = await actionBar.isVisible({ timeout: 5_000 }).catch(() => false);
  console.log("[action-smoke] action bar visible:", actionBarVisible);
  if (!actionBarVisible) throw new Error("Action bar yok");

  // En yeni completed olmayabilir; hangi state olduğuna göre rapor.
  const initialState = await readState(page);
  console.log("[action-smoke] initial state:", initialState);

  // 3) Retry butonu var mı (terminal state)?
  const retryBtn = page.locator('[data-testid="mj-action-retry"]');
  const retryVisible = await retryBtn.isVisible({ timeout: 2_000 }).catch(() => false);
  console.log("[action-smoke] retry visible:", retryVisible);

  if (retryVisible) {
    // 4) Retry → yeni job sayfası
    await retryBtn.click();
    console.log("[action-smoke] retry clicked");

    // URL değişimini bekle (router.push)
    await page.waitForURL((u) => u.pathname !== initialHref, { timeout: 10_000 }).catch(() => undefined);
    const newUrl = page.url();
    console.log("[action-smoke] new URL:", newUrl);

    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
    const newState = await readState(page);
    console.log("[action-smoke] new job initial state:", newState);

    // 5) Cancel butonu
    const cancelBtn = page.locator('[data-testid="mj-action-cancel"]');
    const cancelVisible = await cancelBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    console.log("[action-smoke] cancel visible:", cancelVisible);

    if (cancelVisible) {
      // Confirm dialog'u accept et — listener'ı await tutmadan,
      // dialog event'inin kendisi async accept eder.
      page.on("dialog", async (d) => {
        console.log("[action-smoke] dialog:", d.message().slice(0, 50));
        try {
          await d.accept();
        } catch {
          /* dismissed already */
        }
      });
      await cancelBtn.click();
      console.log("[action-smoke] cancel clicked");
      // Success mesajı bekle
      const success = page.locator('[data-testid="mj-action-success"]');
      await success.waitFor({ timeout: 10_000 }).catch(() => undefined);
      const msg = await success.innerText().catch(() => "");
      console.log("[action-smoke] cancel result:", msg);

      await page.waitForTimeout(2000);
      const finalState = await readState(page);
      console.log("[action-smoke] state after cancel:", finalState);

      // 6) Retry tekrar görünür mü
      const retryAgainVisible = await retryBtn.isVisible({ timeout: 5_000 }).catch(() => false);
      console.log("[action-smoke] retry visible after cancel:", retryAgainVisible);
    }
  }

  console.log("[action-smoke] DONE");
  await browser.close();
}

main().catch((err) => {
  console.error("[action-smoke] FATAL:", err instanceof Error ? err.message : err);
  process.exit(1);
});
