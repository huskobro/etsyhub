// Pass 65 — image-prompt URL paste probe (read-only — describe değil; Discord
// pattern'inin MJ web V8'de hâlâ çalışıp çalışmadığını anlamak için).
//
// MJ Discord'da prompt başına HTTPS URL yapıştırmak image-prompt olarak işlerdi.
// MJ web V8'de hâlâ aynı davranış mı, yoksa "Add Images" menüsü mecburi mi?
//
// Bu script SADECE imagine bar'a "https://example.com/test.png prompt text"
// yazıp 1 saniye bekler — submit YAPMAZ, render etmez. Sadece DOM'un nasıl
// reaksiyon verdiğine bakar (URL'i parse edip mini önizleme thumb gösteriyor mu?).

import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";

const CDP_URL = process.env["MJ_BRIDGE_CDP_URL"] ?? "http://127.0.0.1:9222";
const OUTPUT_PATH = "/tmp/mj-image-prompt-url-probe.json";

// Public, küçük, MJ-friendly bir referans URL — sadece probe içindir.
const TEST_URL = "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/280px-PNG_transparency_demonstration_1.png";

async function main() {
  const browser = await chromium.connectOverCDP(CDP_URL, { timeout: 10_000 });
  const ctx = browser.contexts()[0];
  if (!ctx) throw new Error("CDP context yok");
  const pages = ctx.pages();
  let page = pages.find((p) => p.url().includes("midjourney.com")) ?? pages[0];
  if (!page) page = await ctx.newPage();
  await page.goto("https://www.midjourney.com/imagine", {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  await page.waitForTimeout(3000);

  const bar = page.locator("#desktop_input_bar").first();
  await bar.click();
  await bar.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await bar.press("Delete");
  // URL + boşluk + prompt text
  await bar.type(`${TEST_URL} test pattern probe`, { delay: 30 });
  // Submit ETME — sadece bekle ve DOM'a bak
  await page.waitForTimeout(2500);

  const snapshot = await page.evaluate((testUrl) => {
    const bar = document.querySelector("#desktop_input_bar") as HTMLTextAreaElement | null;
    const barValue = bar?.value ?? null;
    // Bar etrafındaki yapıyı incele — url thumbnail'a dönüşmüş mü?
    const form = bar?.closest("form,section,div[class*='imagine' i]") ?? bar?.parentElement;
    const formImgs = form
      ? Array.from(form.querySelectorAll("img")).slice(0, 10).map((img) => ({
          src: img.getAttribute("src")?.slice(0, 200) ?? null,
          alt: img.getAttribute("alt"),
          classes: img.className.slice(0, 100),
        }))
      : [];
    const formText = form?.textContent?.trim().slice(0, 500) ?? null;
    const previewElems = Array.from(document.querySelectorAll("[class*='thumbnail' i], [class*='preview' i], [class*='attach' i], [data-testid*='image' i]"))
      .slice(0, 10)
      .map((el) => ({
        tag: el.tagName.toLowerCase(),
        classes: el.className.slice(0, 100),
        testid: el.getAttribute("data-testid"),
      }));
    return { barValue, formImgs, formText, previewElems };
  }, TEST_URL);

  // Temizle (artık etkilemesin)
  await bar.click().catch(() => undefined);
  await bar.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await bar.press("Delete");

  await writeFile(OUTPUT_PATH, JSON.stringify({
    cdpUrl: CDP_URL,
    timestamp: new Date().toISOString(),
    testUrl: TEST_URL,
    snapshot,
  }, null, 2));
  // eslint-disable-next-line no-console
  console.log(`[pass65] image-prompt URL probe → ${OUTPUT_PATH}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[pass65] probe FAIL:", err);
  process.exit(1);
});
