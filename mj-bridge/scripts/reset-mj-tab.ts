// Pass 66 — MJ tab'ı clean state'e reset.
// Eski popover/describe çıktısı state'i temizlemek için sayfayı yeniden yükle.

import { chromium } from "playwright";

async function main() {
  const browser = await chromium.connectOverCDP("http://127.0.0.1:9222", {
    timeout: 10_000,
  });
  const ctx = browser.contexts()[0];
  if (!ctx) throw new Error("CDP yok");
  const pages = ctx.pages();
  const mj = pages.find((p) => p.url().includes("midjourney.com")) ?? pages[0];
  if (!mj) throw new Error("no MJ page");
  await mj.reload({ waitUntil: "domcontentloaded", timeout: 30_000 });
  await mj.waitForTimeout(3000);
  // eslint-disable-next-line no-console
  console.log("MJ tab reset OK:", mj.url());
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
