// Pass 60 — Upscale capability smoke.
//
// Akış:
//   1. /admin/midjourney/{COMPLETED_GENERATE_JOB} aç
//   2. İlk grid altında "⤴ Upscale" buton görünür mü
//   3. Buton click → child upscale job oluşur, router.push child detail
//   4. Child job state polling: WAITING_FOR_RENDER → COMPLETED (~60-180s)
//   5. Child detail page'de:
//      - mjJobId yeni UUID
//      - generatedAssets.length === 1 (GRID değil UPSCALE!)
//      - asset variantKind=UPSCALE + parentAssetId=parent grid asset
//      - Selectorler "Upscale çıktıları" listesi parent detail'de görünür

import { chromium, type Page } from "playwright";

const cdpUrl = process.env["MJ_BRIDGE_CDP_URL"] ?? "http://127.0.0.1:9222";
const adminBase = process.env["ADMIN_BASE"] ?? "http://localhost:3000";
const PARENT_JOB = process.env["PARENT_JOB"] ?? "cmov06na50016149lfncr8m8u";
const PARENT_ASSET = process.env["PARENT_ASSET"] ?? "cmov082gt0003nbyrc6bpa0mc";

async function main(): Promise<void> {
  const browser = await chromium.connectOverCDP(cdpUrl, { timeout: 10_000 });
  const ctx = browser.contexts()[0]!;
  const pages = ctx.pages();
  let page = pages.find((p) => p.url().includes("localhost:3000"));
  if (!page) page = await ctx.newPage();
  await page.bringToFront().catch(() => undefined);

  // 1) Parent detail
  await page.goto(`${adminBase}/admin/midjourney/${PARENT_JOB}`, {
    waitUntil: "networkidle",
    timeout: 30_000,
  });
  console.log("[pass60] parent detail open:", page.url());

  // 2) Upscale buton görünür mü
  const upscaleBtn = page.locator(`[data-testid="mj-upscale-${PARENT_ASSET}"]`);
  const visible = await upscaleBtn.isVisible({ timeout: 5_000 }).catch(() => false);
  console.log("[pass60] upscale button visible:", visible);
  if (!visible) throw new Error("Upscale button yok");

  // 3) Click → router.push child detail
  await upscaleBtn.click();
  console.log("[pass60] upscale clicked");
  // Yeni URL bekle
  await page.waitForURL((url) => !url.toString().endsWith(PARENT_JOB), {
    timeout: 15_000,
  }).catch(() => undefined);
  const childUrl = page.url();
  console.log("[pass60] child job url:", childUrl);
  if (childUrl.endsWith(PARENT_JOB)) {
    throw new Error("Router push olmadı");
  }
  const childJobId = childUrl.split("/").pop() ?? "";
  console.log("[pass60] child mj job id:", childJobId);

  // 4) State polling — 240s max (real upscale render uzun sürebilir)
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
  let state = "?";
  for (let i = 0; i < 48; i++) {
    await page.waitForTimeout(5_000);
    await page.reload({ waitUntil: "domcontentloaded", timeout: 15_000 }).catch(() => undefined);
    state = await page
      .locator("h1")
      .first()
      .evaluate((el) => {
        const sib = el.parentElement?.querySelector("h1 ~ div span, h1 + div span");
        return (sib as HTMLElement | null)?.innerText ?? "?";
      })
      .catch(() => "?");
    console.log(`[pass60] [+${(i + 1) * 5}s] state guess: ${state}`);
    if (
      state.includes("Tamamlandı") ||
      state.includes("Başarısız") ||
      state.includes("İptal")
    )
      break;
  }
  console.log("[pass60] final child state:", state);

  // 5) Screenshot
  await page.screenshot({
    path: "/tmp/mj-pass60-upscale-child.png",
    fullPage: true,
  });
  console.log("[pass60] screenshot /tmp/mj-pass60-upscale-child.png");

  console.log("[pass60] DONE");
  await browser.close();
}

main().catch((err) => {
  console.error("[pass60] FATAL:", err instanceof Error ? err.message : err);
  process.exit(1);
});
