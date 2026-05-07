// Pass 65 — "Add Images" buton tıkla + açılan menü/dialog probe (read-only).
//
// MJ V8 imagine bar yanında "Add Images" butonu var. Tıklayınca image-prompt
// veya image upload menüsü açılıyor olabilir. Describe modu da burada
// olabilir (Discord eski /describe komutu yerine entegre upload akışı).

import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";

const CDP_URL = process.env["MJ_BRIDGE_CDP_URL"] ?? "http://127.0.0.1:9222";
const OUTPUT_PATH = "/tmp/mj-add-images-inspect.json";

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

  // Tıkla
  const addBtn = page.locator('button[aria-label="Add Images"]').first();
  let beforeOpenSnapshot;
  let afterOpenSnapshot;
  try {
    beforeOpenSnapshot = await page.evaluate(() => ({
      fileInputCount: document.querySelectorAll("input[type=file]").length,
      bodyTextSnap: document.body.innerText.slice(0, 800),
    }));
    await addBtn.click({ timeout: 5_000 });
    await page.waitForTimeout(1500);
    afterOpenSnapshot = await page.evaluate(() => {
      const fileInputs = Array.from(
        document.querySelectorAll("input[type=file]"),
      ).map((el) => ({
        id: el.getAttribute("id"),
        accept: el.getAttribute("accept"),
        ariaLabel: el.getAttribute("aria-label"),
        multiple: el.hasAttribute("multiple"),
        styleDisplay: window.getComputedStyle(el).display,
        styleOpacity: window.getComputedStyle(el).opacity,
        offsetParent: el instanceof HTMLElement ? !!el.offsetParent : null,
      }));
      const dialogs = Array.from(
        document.querySelectorAll('[role="dialog"], [role="menu"], [class*="modal" i], [class*="popover" i]'),
      )
        .slice(0, 5)
        .map((el) => ({
          tag: el.tagName.toLowerCase(),
          role: el.getAttribute("role"),
          classes: el.className.slice(0, 150),
          text: (el.textContent ?? "").trim().slice(0, 400),
        }));
      const describeWords = Array.from(document.querySelectorAll("*"))
        .filter((el) => {
          if (el.children.length > 1) return false;
          const t = (el.textContent ?? "").trim();
          return /describe/i.test(t) && t.length > 0 && t.length < 200;
        })
        .slice(0, 10)
        .map((el) => ({
          tag: el.tagName.toLowerCase(),
          text: (el.textContent ?? "").trim().slice(0, 150),
        }));
      const imageRefWords = Array.from(document.querySelectorAll("*"))
        .filter((el) => {
          if (el.children.length > 1) return false;
          const t = (el.textContent ?? "").trim();
          return /(image\s*ref|image\s*prompt|style\s*ref|character|moodboard)/i.test(t) && t.length > 0 && t.length < 200;
        })
        .slice(0, 10)
        .map((el) => ({
          tag: el.tagName.toLowerCase(),
          text: (el.textContent ?? "").trim().slice(0, 150),
        }));
      return {
        fileInputCount: fileInputs.length,
        fileInputs,
        dialogs,
        describeWords,
        imageRefWords,
        bodyTextSnap: document.body.innerText.slice(0, 1500),
      };
    });
  } catch (err) {
    afterOpenSnapshot = { error: err instanceof Error ? err.message : String(err) };
  }

  // Screenshot — manuel inceleme için
  try {
    await page.screenshot({ path: "/tmp/mj-add-images-after-click.png", fullPage: false });
  } catch {
    // ignore
  }

  await writeFile(OUTPUT_PATH, JSON.stringify({
    cdpUrl: CDP_URL,
    timestamp: new Date().toISOString(),
    beforeOpenSnapshot,
    afterOpenSnapshot,
  }, null, 2));
  // eslint-disable-next-line no-console
  console.log(`[pass65] add-images probe → ${OUTPUT_PATH}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[pass65] add-images FAIL:", err);
  process.exit(1);
});
