// Pass 56 — Test Render Reference picker + auto-promote smoke.
//
// Akış:
//   1. /admin/midjourney aç
//   2. Test Render formunda Reference picker görünür mü, ilk option seç
//   3. Submit → yeni job
//   4. Yeni job sayfasını aç, render bitene kadar polling (~90sn)
//   5. Tamamlandığında PromoteToReview panel "✓ Tüm asset'ler Review'da"
//      (auto-promote çalışmış olmalı; manuel buton gerekmez)
//   6. 4 thumb altında "✓ Review" badge görünür

import { chromium, type Page } from "playwright";

const cdpUrl = process.env["MJ_BRIDGE_CDP_URL"] ?? "http://127.0.0.1:9222";
const adminBase = process.env["ADMIN_BASE"] ?? "http://localhost:3000";

async function main(): Promise<void> {
  const browser = await chromium.connectOverCDP(cdpUrl, { timeout: 10_000 });
  const ctx = browser.contexts()[0]!;
  const pages = ctx.pages();
  let page = pages.find((p) => p.url().includes("localhost:3000"));
  if (!page) page = await ctx.newPage();
  await page.bringToFront().catch(() => undefined);

  // 1) /admin/midjourney
  await page.goto(`${adminBase}/admin/midjourney`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);

  // 2) Reference picker görünüyor mu, lookup yüklensin
  const refSelect = page.locator('[data-testid="mj-test-render-ref"]');
  await refSelect.waitFor({ timeout: 5_000 });
  // Lookup için ekstra bekleme
  for (let i = 0; i < 20; i++) {
    const optCount = await refSelect.locator("option").count();
    if (optCount > 1) break;
    await page.waitForTimeout(300);
  }
  const optionCount = await refSelect.locator("option").count();
  console.log("[pass56] reference picker option count:", optionCount);
  if (optionCount < 2) throw new Error("Reference yüklenemedi (en az 1 ref + 'yok' option beklenir)");

  // İlk gerçek reference'ı seç (index 1; index 0 = "— yok —")
  const firstRefId = await refSelect
    .locator("option")
    .nth(1)
    .getAttribute("value");
  if (!firstRefId) throw new Error("First reference id null");
  await refSelect.selectOption(firstRefId);
  console.log("[pass56] selected reference:", firstRefId.slice(0, 12));

  // Prompt unique etiket
  const promptInput = page.locator('input[type="text"]').first();
  const uniqueTag = `pass56-${Date.now()}`;
  await promptInput.fill(`pass56 auto-promote test ${uniqueTag}`);
  console.log("[pass56] prompt set:", uniqueTag);

  // 3) Submit
  const submit = page.locator('[data-testid="mj-test-render-submit"]');
  await submit.click();
  console.log("[pass56] submit clicked");

  // Success wait
  const success = page.locator('[data-testid="mj-test-render-success"]');
  await success.waitFor({ timeout: 15_000 });
  const msg = await success.innerText();
  console.log("[pass56] form success:", msg);

  // Yeni job tablo ilk satırı
  await page.waitForTimeout(1500);
  const firstHref = await page
    .locator("table tbody tr")
    .first()
    .locator("a")
    .first()
    .getAttribute("href");
  console.log("[pass56] new job detail href:", firstHref);
  if (!firstHref) throw new Error("Yeni job tabloda yok");

  // 4) Detail sayfasında render bekle (90sn polling)
  await page.goto(`${adminBase}${firstHref}`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  let stateText = "";
  for (let i = 0; i < 24; i++) {
    await page.waitForTimeout(5000);
    await page.reload({ waitUntil: "domcontentloaded", timeout: 15_000 }).catch(() => undefined);
    stateText = await page
      .locator("h1 + div span, h1 ~ div span")
      .first()
      .innerText()
      .catch(() => "?");
    console.log(`[pass56] [+${(i + 1) * 5}s] state: ${stateText}`);
    if (stateText.includes("Tamamlandı") || stateText.includes("Başarısız") || stateText.includes("İptal")) break;
  }

  if (!stateText.includes("Tamamlandı")) {
    throw new Error(`Render Tamamlandı'ya ulaşmadı (final state: ${stateText})`);
  }

  // 5) Auto-promote sonucu: "✓ Tüm asset'ler Review'da" badge
  await page.waitForTimeout(2000);
  const allDone = await page
    .locator('[data-testid="mj-promote-all-done"]')
    .isVisible({ timeout: 3_000 })
    .catch(() => false);
  console.log("[pass56] all-promoted badge visible:", allDone);
  if (!allDone) {
    console.warn("[pass56] ⚠ all-promoted badge yok — auto-promote çalışmamış olabilir");
  }

  // 6) Per-thumb "✓ Review" badge
  const reviewBadges = await page.locator('a:has-text("✓ Review")').count();
  console.log("[pass56] ✓ Review badge count:", reviewBadges);
  if (reviewBadges < 4) {
    throw new Error(`En az 4 review badge beklenir, ${reviewBadges} bulundu`);
  }

  await page.screenshot({ path: "/tmp/mj-pass56-auto-promote.png", fullPage: true });
  console.log("[pass56] screenshot /tmp/mj-pass56-auto-promote.png");
  console.log("[pass56] DONE");
  await browser.close();
}

main().catch((err) => {
  console.error("[pass56] FATAL:", err instanceof Error ? err.message : err);
  process.exit(1);
});
