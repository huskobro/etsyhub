// Pass 66 — describe via three-dots menu probe (read-only on result side).
//
// Audit'in net sonucu (kullanıcı feedback + drop result probe v1):
//   - Synthetic dragenter overlay'i açıyor ama synthetic drop trust
//     filtreleniyor → 4 prompt çıkmıyor
//   - Three-dots menü doğal click → trust OK → describe tetiklenir
//
// Bu probe:
//   1. Add Images popover'ını aç + Image Prompts tab'ını seç
//   2. setInputFiles ile bir image yükle (Pass 65 pattern)
//   3. Yüklü thumbnail'in üzerine hover et + üç-nokta butonunu BUL
//   4. (Henüz tıklamayız) DOM yapısını dump et — selector kalibrasyonu

import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";

const CDP_URL = process.env["MJ_BRIDGE_CDP_URL"] ?? "http://127.0.0.1:9222";
const OUT = "/tmp/mj-describe-three-dots.json";

const TEST_URL =
  "https://cdn.midjourney.com/5725b749-3706-47ad-9225-219efbd25a7c/0_3.png";

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
  await page.waitForTimeout(3000);

  // 1) Add Images aç (idempotent)
  const fileInput0 = page.locator('input[type="file"][accept*="image" i]').first();
  let alreadyOpen = false;
  try {
    await fileInput0.waitFor({ state: "attached", timeout: 500 });
    alreadyOpen = true;
  } catch {
    await page.locator('button[aria-label="Add Images" i]').first().click();
    await page.waitForTimeout(1500);
  }
  // 2) Image Prompts tab — outer container border-r + text combine
  const ipTab = page
    .locator(
      'xpath=//div[contains(@class, "border-r") and contains(., "Image Prompts") and contains(., "Use the elements of an image")]',
    )
    .first();
  await ipTab.click({ force: true, timeout: 5_000 });
  await page.waitForTimeout(800);

  // 3) Image fetch + setInputFiles
  const dl = await ctx.newPage();
  let buf: Buffer;
  try {
    const r = await dl.goto(TEST_URL, { waitUntil: "load", timeout: 30_000 });
    if (!r || !r.ok()) throw new Error(`fetch ${r?.status()}`);
    buf = Buffer.from(await r.body());
  } finally {
    await dl.close().catch(() => undefined);
  }
  // eslint-disable-next-line no-console
  console.log(`[probe] ${buf.length} bytes fetched`);
  const fi = page.locator('input[type="file"][accept*="image" i]').first();
  await fi.waitFor({ state: "attached", timeout: 5_000 });
  await fi.setInputFiles({ name: "probe.png", mimeType: "image/png", buffer: buf });
  await page.waitForTimeout(2500);

  // 4) Yüklü thumbnail'i bul. Audit (Pass 65 peek): selectedImagesDiv yok
  // ama popover thumbnail'leri "blob:" / data: URL ile DOM'a geliyor.
  // Three-dots butonu thumbnail hover'da görünüyor (kullanıcı screenshot).
  const probe = await page.evaluate(() => {
    // Yeni eklenen image — blob: URL veya filename
    const allImgs = Array.from(document.querySelectorAll("img"))
      .map((img) => ({
        src: (img.getAttribute("src") ?? "").slice(0, 150),
        alt: img.getAttribute("alt"),
        rect: (() => {
          const r = img.getBoundingClientRect();
          return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
        })(),
      }))
      .filter((i) => /blob:|data:image|probe|cdn.midjourney/.test(i.src))
      .slice(0, 15);
    // Three-dots butonları — aria-label "more"/"options" ya da SVG dots icon
    const dotButtons = Array.from(
      document.querySelectorAll(
        'button[aria-label*="more" i], button[aria-label*="options" i], button[aria-label*="menu" i]',
      ),
    )
      .slice(0, 20)
      .map((b) => ({
        ariaLabel: b.getAttribute("aria-label"),
        rect: (() => {
          const r = b.getBoundingClientRect();
          return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
        })(),
        text: (b.textContent ?? "").trim().slice(0, 40),
      }));
    // SVG with 3 circles or dots pattern (heuristic)
    const svgDotButtons = Array.from(document.querySelectorAll("button"))
      .filter((b) => {
        const svg = b.querySelector("svg");
        if (!svg) return false;
        const circles = svg.querySelectorAll("circle");
        return circles.length === 3 || circles.length === 4;
      })
      .slice(0, 20)
      .map((b) => ({
        ariaLabel: b.getAttribute("aria-label"),
        rect: (() => {
          const r = b.getBoundingClientRect();
          return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
        })(),
        circleCount: b.querySelector("svg")?.querySelectorAll("circle").length,
      }));
    // Describe text within DOM (menu açılmamış olabilir, peek için)
    const describeAnywhere = Array.from(document.querySelectorAll("*"))
      .filter((el) => {
        if (el.children.length > 1) return false;
        const t = (el.textContent ?? "").trim();
        return /^Describe$/i.test(t) && t.length < 50;
      })
      .slice(0, 5)
      .map((el) => ({
        tag: el.tagName.toLowerCase(),
        text: (el.textContent ?? "").trim().slice(0, 50),
        rect: (() => {
          const r = el.getBoundingClientRect();
          return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
        })(),
        classes: ((el.className && typeof el.className === "string") ? el.className : "").slice(0, 100),
      }));
    return { allImgs, dotButtons, svgDotButtons, describeAnywhere };
  });

  await writeFile(OUT, JSON.stringify({ alreadyOpen, ...probe }, null, 2));
  // eslint-disable-next-line no-console
  console.log(`[pass66] three-dots probe → ${OUT}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
