// Pass 54 — Detail sayfa copy buttons + retry edit modal smoke.
//
// Akış:
//   1. /admin/midjourney aç
//   2. İlk completed job detail aç
//   3. Copy butonları görünüyor mu (en az 4 buton: id/prompt/bridgeJobId/mjJobId)
//   4. "✎ Düzenleyip retry" butonuna tıkla
//   5. Modal görünüyor mu, prompt ve aspect ratio dolu mu
//   6. Promptu modifiye et + submit
//   7. Yeni job sayfasına yönleniyor mu
//   8. Screenshot kaydet

import { chromium, type Page } from "playwright";
import { mkdir } from "node:fs/promises";

const cdpUrl = process.env["MJ_BRIDGE_CDP_URL"] ?? "http://127.0.0.1:9222";
const adminBase = process.env["ADMIN_BASE"] ?? "http://localhost:3000";

async function gotoFirstCompletedDetail(page: Page): Promise<string> {
  await page.goto(`${adminBase}/admin/midjourney`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);

  // İlk Tamamlandı state'li row'u bul.
  const rows = page.locator("table tbody tr");
  const count = await rows.count();
  let targetHref: string | null = null;
  for (let i = 0; i < count; i++) {
    const stateText = await rows.nth(i).locator("td").nth(4).innerText().catch(() => "");
    if (stateText.includes("Tamamlandı")) {
      targetHref = await rows.nth(i).locator("a").first().getAttribute("href");
      if (targetHref) break;
    }
  }
  if (!targetHref) {
    targetHref = await rows.first().locator("a").first().getAttribute("href");
  }
  if (!targetHref) throw new Error("Detay satırı yok");

  await page.goto(`${adminBase}${targetHref}`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
  return targetHref;
}

async function main(): Promise<void> {
  await mkdir("/tmp", { recursive: true }).catch(() => undefined);
  const browser = await chromium.connectOverCDP(cdpUrl, { timeout: 10_000 });
  const ctx = browser.contexts()[0]!;
  const pages = ctx.pages();
  let page = pages.find((p) => p.url().includes("localhost:3000"));
  if (!page) page = await ctx.newPage();
  await page.bringToFront().catch(() => undefined);

  const initialHref = await gotoFirstCompletedDetail(page);
  console.log("[pass54] detail:", initialHref);

  // Copy butonları
  const copyBtns = page.locator('[data-testid="mj-copy-button"]');
  const copyCount = await copyBtns.count();
  console.log("[pass54] copy buttons count:", copyCount);
  if (copyCount < 4) {
    throw new Error(`Az copy button (>=4 beklenir, ${copyCount} bulundu)`);
  }

  // Bir copy click — clipboard fail edebilir CDP içinde; önemsiz, button click'i yeter
  await copyBtns.first().click().catch(() => undefined);

  // Edit retry modal kapağı
  const editBtn = page.locator('[data-testid="mj-action-retry-edit"]');
  const editVisible = await editBtn.isVisible({ timeout: 3_000 }).catch(() => false);
  console.log("[pass54] retry-edit button visible:", editVisible);
  if (!editVisible) throw new Error("Retry edit butonu yok (state terminal değil mi?)");

  await editBtn.click();
  await page.waitForTimeout(500);

  // Modal
  const form = page.locator('[data-testid="mj-action-retry-edit-form"]');
  const formVisible = await form.isVisible({ timeout: 3_000 }).catch(() => false);
  console.log("[pass54] edit form visible:", formVisible);
  if (!formVisible) throw new Error("Edit form açılmadı");

  // Mevcut prompt değerini al + modifiye et
  const textarea = form.locator("textarea");
  const original = (await textarea.inputValue()) ?? "";
  console.log("[pass54] original prompt:", original.slice(0, 50));
  const edited = `${original} pass54-edited`;
  await textarea.fill(edited);

  // Aspect ratio'u 1:1'den 2:3'e değiştir (basit override testi)
  const select = form.locator("select");
  await select.selectOption("2:3");
  console.log("[pass54] aspect ratio → 2:3");

  // Screenshot modal açıkken
  await page.screenshot({ path: "/tmp/mj-pass54-edit-modal.png", fullPage: true });
  console.log("[pass54] screenshot /tmp/mj-pass54-edit-modal.png");

  // Submit
  const submit = form.locator('[data-testid="mj-action-retry-edit-submit"]');
  await submit.click();
  console.log("[pass54] submit clicked");

  // Yeni job URL'ine yönlenir
  await page.waitForURL((u) => u.pathname !== initialHref, { timeout: 15_000 }).catch(() => undefined);
  const newUrl = page.url();
  console.log("[pass54] new URL:", newUrl);
  if (newUrl === `${adminBase}${initialHref}`) {
    throw new Error("URL değişmedi — retry-edit submit beklendiği gibi çalışmadı");
  }

  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
  await page.waitForTimeout(2000);

  // Yeni sayfada prompt edited'i içeriyor mu?
  const newPrompt = await page
    .locator('[data-testid="mj-job-meta"]')
    .first()
    .innerText()
    .catch(() => "");
  const containsEdit = newPrompt.includes("pass54-edited");
  const containsRatio = newPrompt.includes("2:3");
  console.log("[pass54] new job prompt contains 'pass54-edited':", containsEdit);
  console.log("[pass54] new job prompt contains '2:3':", containsRatio);

  await page.screenshot({ path: "/tmp/mj-pass54-new-job.png", fullPage: true });
  console.log("[pass54] screenshot /tmp/mj-pass54-new-job.png");

  console.log("[pass54] DONE");
  await browser.close();
}

main().catch((err) => {
  console.error("[pass54] FATAL:", err instanceof Error ? err.message : err);
  process.exit(1);
});
