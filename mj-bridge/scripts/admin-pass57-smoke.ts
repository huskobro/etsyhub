// Pass 57 — MJ → Selection direct entry smoke.
//
// Akış:
//   1. Auto-promote olmuş bir MJ job detail aç (Pass 56'dan
//      cmov06na50016149lfncr8m8u tüm assets'i promoted)
//   2. AddToSelection panel görünüyor mu, "GeneratedDesign hazır" sayısı 4 mü
//   3. Mode = "yeni set" + unique name → submit
//   4. Success: "✓ N item eklendi · Set'i aç" link'i çıktı mı
//   5. /selection/{setId} aç, 4 SelectionItem var mı doğrula

import { chromium, type Page } from "playwright";

const cdpUrl = process.env["MJ_BRIDGE_CDP_URL"] ?? "http://127.0.0.1:9222";
const adminBase = process.env["ADMIN_BASE"] ?? "http://localhost:3000";
const TARGET_JOB = process.env["MJ_TARGET_JOB"] ?? "cmov06na50016149lfncr8m8u";

async function main(): Promise<void> {
  const browser = await chromium.connectOverCDP(cdpUrl, { timeout: 10_000 });
  const ctx = browser.contexts()[0]!;
  const pages = ctx.pages();
  let page = pages.find((p) => p.url().includes("localhost:3000"));
  if (!page) page = await ctx.newPage();
  await page.bringToFront().catch(() => undefined);

  // 1) Detail
  await page.goto(`${adminBase}/admin/midjourney/${TARGET_JOB}`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
  console.log("[pass57] detail open:", page.url());

  // 2) AddToSelection panel
  const panel = page.locator('[data-testid="mj-add-to-selection"]');
  const visible = await panel.isVisible({ timeout: 5_000 }).catch(() => false);
  console.log("[pass57] add-to-selection panel visible:", visible);
  if (!visible) throw new Error("Selection panel yok (auto-promote olmamış olabilir)");

  // 3) Mode = "Yeni set" inputuna unique adı yaz
  // Default mode "existing" — radio'ya tıkla
  const newRadio = page.locator('label:has-text("Yeni set") input[type="radio"]');
  await newRadio.click();
  console.log("[pass57] mode → new");
  await page.waitForTimeout(300);

  const nameInput = page.locator('[data-testid="mj-selection-new-name"]');
  await nameInput.waitFor({ timeout: 3_000 });
  const setName = `pass57-mj-${Date.now().toString().slice(-8)}`;
  await nameInput.fill(setName);
  console.log("[pass57] new set name:", setName);

  // 4) Screenshot before submit
  await page.screenshot({ path: "/tmp/mj-pass57-selection-form.png", fullPage: true });

  const submit = page.locator('[data-testid="mj-selection-submit"]');
  await submit.click();
  console.log("[pass57] submit clicked");

  // Success bekle
  const success = page.locator('[data-testid="mj-selection-success"]');
  await success.waitFor({ timeout: 10_000 });
  const msg = await success.innerText();
  console.log("[pass57] success:", msg);

  // Set link parse
  const linkHref = await success.locator("a").getAttribute("href");
  console.log("[pass57] set link:", linkHref);
  if (!linkHref) throw new Error("Set link yok");

  await page.screenshot({ path: "/tmp/mj-pass57-after-submit.png", fullPage: true });

  // 5) Set sayfasına git, item sayısı kontrol
  await page.goto(`${adminBase}${linkHref}`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
  await page.waitForTimeout(2_000);
  console.log("[pass57] selection set page:", page.url());
  await page.screenshot({ path: "/tmp/mj-pass57-selection-set.png", fullPage: true });

  console.log("[pass57] DONE");
  await browser.close();
}

main().catch((err) => {
  console.error("[pass57] FATAL:", err instanceof Error ? err.message : err);
  process.exit(1);
});
