// Pass 65 — describe alternative entry-point probe (read-only).
//
// inspect-describe-dom.ts /describe → 404 ve /imagine'da file input yok bildirdi.
// Bu v2 daha derin tarar: Explore/Create alt URL'leri, Imagine bar drag-drop
// davranışı, "Conversational Mode", account menü, /docs URL'i (describe
// rehberi), nav linkleri.

import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";

const CDP_URL = process.env["MJ_BRIDGE_CDP_URL"] ?? "http://127.0.0.1:9222";
const OUTPUT_PATH = "/tmp/mj-describe-inspect-v2.json";

const URLS = [
  "https://www.midjourney.com/explore",
  "https://www.midjourney.com/create",
  "https://www.midjourney.com/edit",
  "https://www.midjourney.com/personalize",
  "https://www.midjourney.com/account",
];

async function probe(page: import("playwright").Page) {
  return await page.evaluate(() => {
    const fileInputs = Array.from(
      document.querySelectorAll("input[type=file]"),
    ).map((el) => ({
      id: el.getAttribute("id"),
      accept: el.getAttribute("accept"),
      ariaLabel: el.getAttribute("aria-label"),
    }));
    const dragLanguage = Array.from(document.querySelectorAll("*"))
      .filter((el) => {
        if (el.children.length > 1) return false;
        const t = (el.textContent ?? "").trim();
        return (
          t.length > 0 &&
          t.length < 200 &&
          (/drag/i.test(t) ||
            /drop/i.test(t) ||
            /upload/i.test(t) ||
            /describe/i.test(t))
        );
      })
      .slice(0, 30)
      .map((el) => ({
        tag: el.tagName.toLowerCase(),
        text: (el.textContent ?? "").trim().slice(0, 120),
      }));
    const navLinks = Array.from(document.querySelectorAll("a"))
      .map((a) => ({
        text: (a.textContent ?? "").trim().slice(0, 40),
        href: a.getAttribute("href"),
      }))
      .filter((l) => l.text || l.href)
      .slice(0, 50);
    return {
      finalUrl: window.location.href,
      title: document.title,
      hasFileInput: fileInputs.length > 0,
      fileInputs,
      dragLanguage,
      navLinks,
      bodyTextSample: document.body.innerText.slice(0, 1500),
    };
  });
}

async function main() {
  const browser = await chromium.connectOverCDP(CDP_URL, { timeout: 10_000 });
  const ctx = browser.contexts()[0];
  if (!ctx) throw new Error("CDP context yok");
  const pages = ctx.pages();
  let page = pages.find((p) => p.url().includes("midjourney.com")) ?? pages[0];
  if (!page) page = await ctx.newPage();

  const results: Array<{ url: string; report: unknown }> = [];

  for (const url of URLS) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.waitForTimeout(3000);
      results.push({ url, report: await probe(page) });
    } catch (err) {
      results.push({
        url,
        report: { error: err instanceof Error ? err.message : String(err) },
      });
    }
  }

  // Imagine bar üzerinde paste/drop davranış probe — MJ V8'de imagine bar'a
  // görsel "drop" ya da clipboard paste ile image-prompt kabul ediyor mu?
  try {
    await page.goto("https://www.midjourney.com/imagine", {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await page.waitForTimeout(3000);
    const imagineBarBehavior = await page.evaluate(() => {
      const bar = document.querySelector("#desktop_input_bar");
      if (!bar) return { found: false };
      const parent = bar.closest('form,section,div[class*="imagine" i]') ?? bar.parentElement;
      const siblings = parent
        ? Array.from(parent.querySelectorAll("button,input,div"))
            .slice(0, 30)
            .map((el) => ({
              tag: el.tagName.toLowerCase(),
              text: (el.textContent ?? "").trim().slice(0, 50),
              ariaLabel: el.getAttribute("aria-label"),
              testid: el.getAttribute("data-testid"),
              type: el.getAttribute("type"),
              classes: ((el.className && typeof el.className === "string") ? el.className : "").slice(0, 100),
            }))
        : [];
      return {
        found: true,
        siblings,
        parentTag: parent?.tagName.toLowerCase(),
        parentClasses: parent?.className.slice(0, 200),
      };
    });
    results.push({ url: "imagine-bar-context", report: imagineBarBehavior });
  } catch (err) {
    results.push({
      url: "imagine-bar-context",
      report: { error: err instanceof Error ? err.message : String(err) },
    });
  }

  await writeFile(OUTPUT_PATH, JSON.stringify({
    cdpUrl: CDP_URL,
    timestamp: new Date().toISOString(),
    results,
  }, null, 2));
  // eslint-disable-next-line no-console
  console.log(`[pass65v2] inspect → ${OUTPUT_PATH}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[pass65v2] FAIL:", err);
  process.exit(1);
});
