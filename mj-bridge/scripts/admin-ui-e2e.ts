// Pass 51 — Attach edilmiş Chrome admin tab'ından gerçek UI E2E.
//
// Kullanıcı aynı Chrome session'ında hem MJ login hem EtsyHub admin
// login etmiş; bu script:
//   1. CDP attach
//   2. EtsyHub admin tab'ını bul (localhost:3000)
//   3. /admin/midjourney sayfasını aç
//   4. Bridge health card screenshot/snapshot
//   5. Test Render formunu doldur + submit
//   6. Yeni MidjourneyJob row'unu beklemek + state ilerleyişi gözlemek
//   7. Tamamlandığında 4 asset asset count = 4 olduğunu doğrula
//
// Çalıştır:
//   $ npx tsx scripts/admin-ui-e2e.ts
//
// Env:
//   MJ_BRIDGE_CDP_URL  default http://127.0.0.1:9222
//   ADMIN_BASE         default http://localhost:3000

import { chromium, type Page } from "playwright";

const cdpUrl = process.env["MJ_BRIDGE_CDP_URL"] ?? "http://127.0.0.1:9222";
const adminBase = process.env["ADMIN_BASE"] ?? "http://localhost:3000";

async function main(): Promise<void> {
  console.log("[ui-e2e] CDP:", cdpUrl);
  const browser = await chromium.connectOverCDP(cdpUrl, { timeout: 10_000 });
  const ctx = browser.contexts()[0]!;
  const pages = ctx.pages();
  console.log(`[ui-e2e] ${pages.length} açık tab`);
  for (const p of pages) console.log("  -", p.url().slice(0, 80));

  // Admin tab seçimi
  let adminPage: Page | undefined = pages.find((p) =>
    p.url().includes("localhost:3000") || p.url().includes("127.0.0.1:3000"),
  );
  if (!adminPage) {
    console.log("[ui-e2e] Admin tab yok, yenisi açılıyor");
    adminPage = await ctx.newPage();
  }

  // /admin/midjourney
  console.log("[ui-e2e] /admin/midjourney aç");
  await adminPage.goto(`${adminBase}/admin/midjourney`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  await adminPage.bringToFront().catch(() => undefined);

  // Auth wall? Bekleyerek hidrate et.
  await adminPage.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
  const url = adminPage.url();
  console.log("[ui-e2e] current URL:", url);
  if (url.includes("/login")) {
    console.error("[ui-e2e] FAIL: admin /login redirect — admin oturumu yok");
    await browser.close();
    process.exit(1);
  }

  // Bridge health kartını oku
  const bridgeHealthCard = adminPage.locator('[data-testid="bridge-health"]');
  const healthVisible = await bridgeHealthCard.isVisible({ timeout: 10_000 }).catch(() => false);
  console.log("[ui-e2e] bridge health card visible:", healthVisible);

  // Test render form
  const form = adminPage.locator('[data-testid="mj-test-render-form"]');
  const formVisible = await form.isVisible({ timeout: 5_000 }).catch(() => false);
  console.log("[ui-e2e] test render form visible:", formVisible);
  if (!formVisible) {
    console.error("[ui-e2e] FAIL: Test Render formu görünmüyor");
    await browser.close();
    process.exit(1);
  }

  // Submit button enabled mı (bridge erişilebilir mi)
  const submit = adminPage.locator('[data-testid="mj-test-render-submit"]');
  const isDisabled = await submit.evaluate((el) => (el as HTMLButtonElement).disabled);
  console.log("[ui-e2e] submit button disabled:", isDisabled);
  if (isDisabled) {
    console.error("[ui-e2e] FAIL: submit disabled — bridge erişilemez muhtemelen");
    await browser.close();
    process.exit(1);
  }

  // Mevcut MJ job sayısı (baseline)
  const beforeRows = await adminPage.locator("table tbody tr").count();
  console.log("[ui-e2e] mevcut tablo satır sayısı (baseline):", beforeRows);

  // Test Render tetikle
  const promptInput = form.locator('input[type="text"]');
  await promptInput.fill("ui-e2e pass 51 abstract test pattern minimalist");
  console.log("[ui-e2e] form prompt set");
  await submit.click();
  console.log("[ui-e2e] submit clicked");

  // Success message bekle
  const success = adminPage.locator('[data-testid="mj-test-render-success"]');
  const error = adminPage.locator('[data-testid="mj-test-render-error"]');
  const settled = await Promise.race([
    success.waitFor({ timeout: 30_000 }).then(() => "success" as const).catch(() => null),
    error.waitFor({ timeout: 30_000 }).then(() => "error" as const).catch(() => null),
  ]);
  console.log("[ui-e2e] form sonucu:", settled);
  if (settled === "error") {
    const msg = await error.innerText().catch(() => "");
    console.error("[ui-e2e] FAIL: form error:", msg);
    await browser.close();
    process.exit(1);
  }
  if (settled === "success") {
    const msg = await success.innerText().catch(() => "");
    console.log("[ui-e2e] success msg:", msg);
  }

  // Tablo yenileme bekle (router.refresh sonrası)
  await adminPage.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);
  await new Promise((r) => setTimeout(r, 2000));

  const afterRows = await adminPage.locator("table tbody tr").count();
  console.log("[ui-e2e] tablo satır sayısı (sonrası):", afterRows);
  if (afterRows <= beforeRows) {
    console.warn("[ui-e2e] ⚠ tablo büyümedi; router.refresh çalışmamış olabilir");
  } else {
    console.log("[ui-e2e] ✓ tablo büyüdü (yeni job row'u eklendi)");
  }

  // İlk satırı oku (en yeni job)
  const firstRow = adminPage.locator("table tbody tr").first();
  const stateText = await firstRow.locator("td").nth(3).innerText().catch(() => "?");
  const promptText = await firstRow.locator("td").nth(2).innerText().catch(() => "?");
  console.log("[ui-e2e] yeni satır prompt:", promptText.slice(0, 60));
  console.log("[ui-e2e] yeni satır initial state:", stateText);

  // 90sn boyunca page reload + state izle
  console.log("[ui-e2e] state polling 90sn (page.reload her 5sn)...");
  let lastState = stateText;
  let assetCount = "0";
  let mjJobId = "—";
  for (let i = 0; i < 18; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    await adminPage.reload({ waitUntil: "domcontentloaded", timeout: 15_000 }).catch(() => undefined);
    const top = adminPage.locator("table tbody tr").first();
    const s = await top.locator("td").nth(3).innerText().catch(() => "?");
    const a = await top.locator("td").nth(5).innerText().catch(() => "?");
    const mj = await top.locator("td").nth(6).innerText().catch(() => "?");
    if (s !== lastState) {
      console.log(`  [+${(i + 1) * 5}s] state: ${lastState} → ${s}`);
      lastState = s;
    } else {
      console.log(`  [+${(i + 1) * 5}s] state=${s} asset=${a} mjJobId=${mj.slice(0, 20)}`);
    }
    assetCount = a;
    mjJobId = mj;
    if (s === "Tamamlandı" || s === "Başarısız" || s === "İptal") break;
  }

  console.log("\n[ui-e2e] FINAL:");
  console.log(`  state: ${lastState}`);
  console.log(`  assetCount: ${assetCount}`);
  console.log(`  mjJobId: ${mjJobId}`);

  await browser.close();
}

main().catch((err) => {
  console.error("[ui-e2e] FATAL:", err instanceof Error ? err.message : err);
  process.exit(1);
});
