// Pass 52 — Detail sayfa screenshot (görsel kanıt).
import { chromium } from "playwright";

async function main(): Promise<void> {
  const browser = await chromium.connectOverCDP(
    process.env["MJ_BRIDGE_CDP_URL"] ?? "http://127.0.0.1:9222",
    { timeout: 10_000 },
  );
  const ctx = browser.contexts()[0]!;
  const pages = ctx.pages();
  const page =
    pages.find((p) => p.url().includes("localhost:3000")) ??
    pages[0]!;
  await page.bringToFront().catch(() => undefined);

  // Liste
  await page.goto("http://localhost:3000/admin/midjourney", {
    waitUntil: "networkidle",
    timeout: 20_000,
  });
  await page.waitForTimeout(2_000);
  await page.screenshot({
    path: "/tmp/mj-admin-list.png",
    fullPage: true,
  });
  console.log("[shot] list saved /tmp/mj-admin-list.png");

  // Detail
  const firstHref = await page
    .locator("table tbody tr")
    .first()
    .locator("a")
    .first()
    .getAttribute("href");
  if (firstHref) {
    await page.goto(`http://localhost:3000${firstHref}`, {
      waitUntil: "networkidle",
      timeout: 20_000,
    });
    await page.waitForTimeout(3_000);
    await page.screenshot({
      path: "/tmp/mj-admin-detail.png",
      fullPage: true,
    });
    console.log("[shot] detail saved /tmp/mj-admin-detail.png");
  }
  await browser.close();
}
main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
