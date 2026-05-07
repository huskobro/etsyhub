// Pass 55 — MJ → Review handoff smoke.
//
// Akış:
//   1. /admin/midjourney aç
//   2. İlk completed job detail aç
//   3. PromoteToReview panel görünüyor mu
//   4. Reference + ProductType select dolu mu
//   5. "Review'a gönder" submit et
//   6. Success message + per-thumb "✓ Review" badge'i çıktı mı
//   7. /api/review/queue endpoint'inde yeni 4 entry var mı
//   8. Screenshot

import { chromium, type Page } from "playwright";

const cdpUrl = process.env["MJ_BRIDGE_CDP_URL"] ?? "http://127.0.0.1:9222";
const adminBase = process.env["ADMIN_BASE"] ?? "http://localhost:3000";

async function gotoFirstCompleted(page: Page): Promise<string> {
  await page.goto(`${adminBase}/admin/midjourney`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);

  const rows = page.locator("table tbody tr");
  const count = await rows.count();
  let target: string | null = null;
  for (let i = 0; i < count; i++) {
    const stateText = await rows.nth(i).locator("td").nth(4).innerText().catch(() => "");
    const assetText = await rows.nth(i).locator("td").nth(6).innerText().catch(() => "");
    if (stateText.includes("Tamamlandı") && assetText.includes("4")) {
      target = await rows.nth(i).locator("a").first().getAttribute("href");
      if (target) break;
    }
  }
  if (!target) throw new Error("Completed job (4 asset) row yok");
  await page.goto(`${adminBase}${target}`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
  return target;
}

async function main(): Promise<void> {
  const browser = await chromium.connectOverCDP(cdpUrl, { timeout: 10_000 });
  const ctx = browser.contexts()[0]!;
  const pages = ctx.pages();
  let page = pages.find((p) => p.url().includes("localhost:3000"));
  if (!page) page = await ctx.newPage();
  await page.bringToFront().catch(() => undefined);

  const detailHref = await gotoFirstCompleted(page);
  console.log("[pass55] detail:", detailHref);

  // Promote panel
  const panel = page.locator('[data-testid="mj-promote-to-review"]');
  const panelVisible = await panel.isVisible({ timeout: 5_000 }).catch(() => false);
  console.log("[pass55] promote panel visible:", panelVisible);
  if (!panelVisible) throw new Error("Promote panel yok");

  // Hepsi promote olmuş mu (ikinci kez koşturulduğunda happy path)
  const allDone = await page
    .locator('[data-testid="mj-promote-all-done"]')
    .isVisible({ timeout: 1_000 })
    .catch(() => false);
  console.log("[pass55] all already promoted:", allDone);

  if (!allDone) {
    // Reference + ProductType select bekle
    await page.waitForSelector('[data-testid="mj-promote-ref"]', { timeout: 5_000 });
    const refSelect = page.locator('[data-testid="mj-promote-ref"]');
    const ptSelect = page.locator('[data-testid="mj-promote-pt"]');
    // Lookup'ların yüklenmesini bekle (ilk option "Yükleniyor…" değil)
    for (let i = 0; i < 20; i++) {
      const refFirst = await refSelect.locator("option").first().innerText();
      if (!refFirst.includes("Yükleniyor")) break;
      await page.waitForTimeout(300);
    }

    const refValue = await refSelect.inputValue();
    const ptValue = await ptSelect.inputValue();
    console.log("[pass55] reference:", refValue.slice(0, 12), "productType:", ptValue.slice(0, 12));
    if (!refValue || !ptValue) {
      throw new Error("Reference/ProductType seçilemedi (lookup boş?)");
    }

    // Screenshot panel açıkken
    await page.screenshot({ path: "/tmp/mj-pass55-promote-panel.png", fullPage: true });
    console.log("[pass55] screenshot /tmp/mj-pass55-promote-panel.png");

    // Submit
    const submit = page.locator('[data-testid="mj-promote-submit"]');
    await submit.click();
    console.log("[pass55] submit clicked");

    // Success bekle
    const success = page.locator('[data-testid="mj-promote-success"]');
    await success.waitFor({ timeout: 15_000 });
    const msg = await success.innerText();
    console.log("[pass55] success:", msg);
  }

  // Per-thumb "✓ Review" badge'leri
  await page.waitForTimeout(2000);
  const reviewBadges = await page.locator('a:has-text("✓ Review")').count();
  console.log("[pass55] ✓ Review badge count:", reviewBadges);
  if (reviewBadges < 4) {
    throw new Error(`En az 4 review badge beklenir, ${reviewBadges} bulundu`);
  }

  // Final screenshot
  await page.screenshot({ path: "/tmp/mj-pass55-promoted.png", fullPage: true });
  console.log("[pass55] screenshot /tmp/mj-pass55-promoted.png");

  // Review queue API direct doğrulama (ilk 50 PENDING içinde MJ asset var mı)
  const reviewCheck = await page.evaluate(async () => {
    const res = await fetch("/api/review/queue?status=PENDING&limit=50");
    if (!res.ok) return { ok: false, status: res.status };
    const j = (await res.json()) as { items?: { id: string }[] };
    return { ok: true, count: j.items?.length ?? 0 };
  });
  console.log("[pass55] review queue PENDING items:", reviewCheck);

  console.log("[pass55] DONE");
  await browser.close();
}

main().catch((err) => {
  console.error("[pass55] FATAL:", err instanceof Error ? err.message : err);
  process.exit(1);
});
