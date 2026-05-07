// Pass 65 — "Add Images" tıkla + DOM'da NEREDE file input olabilir
// derinlemesine probe (visible/hidden/inside-iframe).
//
// Önceki probe başarılıydı çünkü popover MENÜ olabilir (Image Prompts /
// Style References / Omni Reference seçimi GEREKLİ olabilir; sadece "Add
// Images" tıklamak yetmiyor). Buna bakmamız lazım.

import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";

const CDP_URL = process.env["MJ_BRIDGE_CDP_URL"] ?? "http://127.0.0.1:9222";
const OUTPUT = "/tmp/mj-add-images-deep.json";

async function main() {
  const browser = await chromium.connectOverCDP(CDP_URL, { timeout: 10_000 });
  const ctx = browser.contexts()[0];
  if (!ctx) throw new Error("CDP yok");
  const pages = ctx.pages();
  let page = pages.find((p) => p.url().includes("midjourney.com")) ?? pages[0];
  if (!page) page = await ctx.newPage();
  await page.goto("https://www.midjourney.com/imagine", {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  await page.waitForTimeout(3500);

  const before = await page.evaluate(() => ({
    fileInputs: document.querySelectorAll('input[type="file"]').length,
    body: document.body.innerText.slice(0, 600),
  }));

  // 1) Add Images tıkla
  const addBtn = page.locator('button[aria-label="Add Images" i]').first();
  await addBtn.click({ timeout: 5_000 });
  await page.waitForTimeout(1500);

  const afterClick = await page.evaluate(() => {
    const allInputs = Array.from(document.querySelectorAll("input")).map((el) => ({
      type: el.getAttribute("type"),
      accept: el.getAttribute("accept"),
      multiple: el.hasAttribute("multiple"),
      style: el.getAttribute("style"),
      classes: el.className.slice(0, 100),
    }));
    const fileInputs = Array.from(document.querySelectorAll('input[type="file"]'));
    const popoverContent = Array.from(
      document.querySelectorAll(
        '[role="dialog"], [role="menu"], [class*="popover" i], [class*="modal" i], [class*="dialog" i], [class*="menu" i]'
      ),
    )
      .slice(0, 8)
      .map((el) => ({
        tag: el.tagName.toLowerCase(),
        role: el.getAttribute("role"),
        text: (el.textContent ?? "").trim().slice(0, 200),
        classes: el.className.slice(0, 100),
      }));
    return {
      allInputCount: allInputs.length,
      allInputs: allInputs.slice(0, 30),
      fileInputCount: fileInputs.length,
      popoverContent,
      bodyText: document.body.innerText.slice(0, 1500),
    };
  });

  // 2) Eğer "Image Prompts" yazısı varsa onu da tıkla
  let afterImagePrompts = null;
  try {
    const imgPromptsBtn = page.getByText(/^Image Prompts$/i).first();
    const visible = await imgPromptsBtn.isVisible({ timeout: 2000 }).catch(() => false);
    if (visible) {
      await imgPromptsBtn.click({ timeout: 3_000 });
      await page.waitForTimeout(1500);
      afterImagePrompts = await page.evaluate(() => {
        const fileInputs = Array.from(document.querySelectorAll('input[type="file"]')).map((el) => ({
          accept: el.getAttribute("accept"),
          multiple: el.hasAttribute("multiple"),
          style: el.getAttribute("style"),
          parentTag: el.parentElement?.tagName.toLowerCase(),
          parentClasses: el.parentElement?.className.slice(0, 100),
        }));
        return {
          fileInputCount: fileInputs.length,
          fileInputs,
          bodyText: document.body.innerText.slice(0, 800),
        };
      });
    }
  } catch (err) {
    afterImagePrompts = { err: err instanceof Error ? err.message : String(err) };
  }

  await writeFile(
    OUTPUT,
    JSON.stringify({ timestamp: new Date().toISOString(), before, afterClick, afterImagePrompts }, null, 2),
  );
  // eslint-disable-next-line no-console
  console.log(`[pass65 deep] → ${OUTPUT}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
