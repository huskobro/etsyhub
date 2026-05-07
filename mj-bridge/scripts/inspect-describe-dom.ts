// Pass 65 — MJ describe DOM audit (read-only).
//
// Amaç: MJ web'de describe akışının gerçek DOM yapısını keşfet.
//   - URL yolu (`/describe` veya `/imagine` modunda toggle?)
//   - Image upload alanı (drag-drop bin / file input)
//   - 4 prompt suggestion çıktısı nerede ve nasıl scrape edilir
//
// Çalıştır:
//   $ cd mj-bridge && npx tsx scripts/inspect-describe-dom.ts
//
// Read-only: hiçbir click / submit yapmaz, sadece DOM probe + screenshot.

import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";

const CDP_URL = process.env["MJ_BRIDGE_CDP_URL"] ?? "http://127.0.0.1:9222";
const OUTPUT_PATH =
  process.env["MJ_DESCRIBE_INSPECT_PATH"] ??
  "/tmp/mj-describe-inspect.json";

async function main() {
  const browser = await chromium.connectOverCDP(CDP_URL, { timeout: 10_000 });
  const ctx = browser.contexts()[0];
  if (!ctx) throw new Error("CDP context yok");
  const pages = ctx.pages();
  let page = pages.find((p) => p.url().includes("midjourney.com")) ?? pages[0];
  if (!page) page = await ctx.newPage();

  // /describe URL'i dene
  const probes: Array<{ url: string; report: unknown }> = [];

  for (const path of ["/describe", "/imagine"]) {
    const url = `https://www.midjourney.com${path}`;
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.waitForTimeout(3000);
      const report = await page.evaluate(() => {
        // Generic scan
        const fileInputs = Array.from(document.querySelectorAll("input[type=file]")).map(
          (el) => ({
            id: el.getAttribute("id"),
            name: el.getAttribute("name"),
            accept: el.getAttribute("accept"),
            multiple: el.hasAttribute("multiple"),
            ariaLabel: el.getAttribute("aria-label"),
            classes: el.className.slice(0, 200),
          }),
        );
        const dropzones = Array.from(
          document.querySelectorAll("[data-testid*='drop' i], [class*='drop' i], [class*='upload' i]"),
        )
          .slice(0, 10)
          .map((el) => ({
            tag: el.tagName.toLowerCase(),
            testid: el.getAttribute("data-testid"),
            ariaLabel: el.getAttribute("aria-label"),
            classes: el.className.slice(0, 200),
            text: (el.textContent ?? "").trim().slice(0, 120),
          }));
        const describeText = Array.from(document.querySelectorAll("*"))
          .filter((el) => {
            const t = (el.textContent ?? "").trim();
            return (
              t.length > 0 &&
              t.length < 200 &&
              /describe/i.test(t) &&
              el.children.length === 0
            );
          })
          .slice(0, 20)
          .map((el) => ({
            tag: el.tagName.toLowerCase(),
            text: (el.textContent ?? "").trim().slice(0, 100),
            classes: (el.className && typeof el.className === "string"
              ? el.className
              : ""
            ).slice(0, 120),
          }));
        const headings = Array.from(document.querySelectorAll("h1,h2,h3"))
          .slice(0, 8)
          .map((el) => ({
            tag: el.tagName.toLowerCase(),
            text: (el.textContent ?? "").trim().slice(0, 100),
          }));
        const buttons = Array.from(document.querySelectorAll("button"))
          .slice(0, 30)
          .map((el) => ({
            ariaLabel: el.getAttribute("aria-label"),
            text: (el.textContent ?? "").trim().slice(0, 60),
            testid: el.getAttribute("data-testid"),
          }))
          .filter((b) => b.text || b.ariaLabel);
        // Numeric prefix lines (1. ... 2. ...) — describe çıktı pattern adayı
        const numericList = Array.from(document.querySelectorAll("*"))
          .filter((el) => {
            if (el.children.length > 2) return false;
            const t = (el.textContent ?? "").trim();
            return /^[1-4][.)]\s/.test(t) && t.length > 5 && t.length < 600;
          })
          .slice(0, 10)
          .map((el) => ({
            tag: el.tagName.toLowerCase(),
            text: (el.textContent ?? "").trim().slice(0, 200),
          }));
        return {
          finalUrl: window.location.href,
          title: document.title,
          fileInputs,
          dropzones,
          describeText,
          headings,
          buttons,
          numericList,
          bodyTextSample: document.body.innerText.slice(0, 1500),
        };
      });
      probes.push({ url, report });
    } catch (err) {
      probes.push({
        url,
        report: { error: err instanceof Error ? err.message : String(err) },
      });
    }
  }

  // Search bar / kbd shortcut sondajı: MJ web'de "/describe" prompt prefix'i
  // imagine bar'da çalışıyor mu (Discord pattern carry-over)?
  await page.goto("https://www.midjourney.com/imagine", {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  await page.waitForTimeout(2000);
  const imagineBarProbe = await page.evaluate(() => {
    const bar = document.querySelector(
      '#desktop_input_bar, textarea[placeholder*="imagine" i]',
    );
    return bar
      ? {
          tag: bar.tagName.toLowerCase(),
          id: bar.getAttribute("id"),
          placeholder: bar.getAttribute("placeholder"),
          ariaLabel: bar.getAttribute("aria-label"),
        }
      : null;
  });

  const result = {
    cdpUrl: CDP_URL,
    timestamp: new Date().toISOString(),
    probes,
    imagineBarProbe,
  };
  await writeFile(OUTPUT_PATH, JSON.stringify(result, null, 2));
  // eslint-disable-next-line no-console
  console.log(`[pass65] describe DOM inspect → ${OUTPUT_PATH}`);
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[pass65] describe inspect FAIL:", err);
  process.exit(1);
});
