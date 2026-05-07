// Pass 66 — three-dots probe v2: file upload + hover + DOM dump.
//
// v1 öğrendi: aria-label "more/options" YOK, 3-circle SVG YOK,
// "Describe" text DOM'da YOK (default).
// Hipotez: Three-dots butonu thumbnail HOVER ile görünür hale geliyor.

import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";

const CDP_URL = process.env["MJ_BRIDGE_CDP_URL"] ?? "http://127.0.0.1:9222";
const OUT = "/tmp/mj-describe-three-dots-v2.json";
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

  // Add Images popover aç (idempotent)
  let alreadyOpen = false;
  const fileInput0 = page.locator('input[type="file"][accept*="image" i]').first();
  try {
    await fileInput0.waitFor({ state: "attached", timeout: 500 });
    alreadyOpen = true;
  } catch {
    await page.locator('button[aria-label="Add Images" i]').first().click();
    await page.waitForTimeout(1500);
  }

  // Image Prompts tab seç (Start Frame değil — image-prompt slot'a yükle)
  const ipTab = page
    .locator(
      'xpath=//div[contains(@class, "border-r") and contains(., "Image Prompts") and contains(., "Use the elements of an image")]',
    )
    .first();
  await ipTab.click({ force: true, timeout: 5_000 });
  await page.waitForTimeout(800);

  // Image fetch + setInputFiles
  const dl = await ctx.newPage();
  let buf: Buffer;
  try {
    const r = await dl.goto(TEST_URL, { waitUntil: "load", timeout: 30_000 });
    if (!r || !r.ok()) throw new Error(`fetch ${r?.status()}`);
    buf = Buffer.from(await r.body());
  } finally {
    await dl.close().catch(() => undefined);
  }
  const fi = page.locator('input[type="file"][accept*="image" i]').first();
  await fi.waitFor({ state: "attached", timeout: 5_000 });
  await fi.setInputFiles({ name: "probe.png", mimeType: "image/png", buffer: buf });
  // Popover kapansın diye submit ETMİYORUZ — sadece bekle
  await page.waitForTimeout(3000);

  // Popover'da yüklü thumbnail'i bul. blob: URL ya da yeni cdn.midjourney.com
  // pattern'i (image-prompt yüklendiğinde MJ kendi server'ına replicate ediyor).
  // Selector: image elementlerinden popover'ın içinde olanları (Add Images
  // popover Y aralığında) bul.
  const probe = await page.evaluate(() => {
    const popoverImgs = Array.from(document.querySelectorAll("img"))
      .filter((img) => {
        const r = img.getBoundingClientRect();
        // Add Images popover genelde y < 700, w/h ~80-160 thumbnail
        return r.width > 30 && r.width < 200 && r.y < 700;
      })
      .slice(0, 20)
      .map((img) => ({
        src: (img.getAttribute("src") ?? "").slice(0, 200),
        alt: img.getAttribute("alt"),
        rect: (() => {
          const r = img.getBoundingClientRect();
          return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
        })(),
      }));
    return { popoverImgs };
  });
  // eslint-disable-next-line no-console
  console.log("[probe] popoverImgs:", JSON.stringify(probe.popoverImgs.slice(0, 5)));

  // En küçük (thumbnail boyutunda) yeni eklenen image'ı seç — hover hedef
  const thumb = probe.popoverImgs[0];
  let afterHover = null;
  if (thumb && thumb.rect.w > 0) {
    const cx = thumb.rect.x + thumb.rect.w / 2;
    const cy = thumb.rect.y + thumb.rect.h / 2;
    await page.mouse.move(cx, cy);
    await page.waitForTimeout(800);
    afterHover = await page.evaluate((coords: { cx: number; cy: number }) => {
      // Hover sonrası thumbnail içindeki butonları/SVG'leri bul
      const allButtons = Array.from(document.querySelectorAll("button"))
        .map((b) => {
          const r = b.getBoundingClientRect();
          return { btn: b, r };
        })
        .filter((x) => {
          // Thumbnail merkez koordinatına yakın ve görünür
          return (
            x.r.width > 0 &&
            x.r.height > 0 &&
            Math.abs((x.r.x + x.r.width / 2) - coords.cx) < 100 &&
            Math.abs((x.r.y + x.r.height / 2) - coords.cy) < 100
          );
        })
        .slice(0, 10)
        .map((x) => ({
          ariaLabel: x.btn.getAttribute("aria-label"),
          text: (x.btn.textContent ?? "").trim().slice(0, 40),
          classes: ((x.btn.className && typeof x.btn.className === "string") ? x.btn.className : "").slice(0, 100),
          rect: { x: Math.round(x.r.x), y: Math.round(x.r.y), w: Math.round(x.r.width), h: Math.round(x.r.height) },
          innerHTML: x.btn.innerHTML.slice(0, 200),
        }));
      // Tüm SVG'leri tara — three-dots SVG icon'u
      const svgs = Array.from(document.querySelectorAll("svg"))
        .filter((svg) => {
          const r = svg.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) return false;
          return (
            Math.abs((r.x + r.width / 2) - coords.cx) < 120 &&
            Math.abs((r.y + r.height / 2) - coords.cy) < 120
          );
        })
        .slice(0, 10)
        .map((svg) => ({
          ariaLabel: svg.getAttribute("aria-label"),
          rect: (() => {
            const r = svg.getBoundingClientRect();
            return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
          })(),
          children: svg.children.length,
          firstChildTag: svg.children[0]?.tagName.toLowerCase() ?? null,
          outerHTML: svg.outerHTML.slice(0, 300),
          parentTag: svg.parentElement?.tagName.toLowerCase(),
          parentAriaLabel: svg.parentElement?.getAttribute("aria-label"),
        }));
      return { allButtons, svgs };
    }, { cx, cy });
  }

  await writeFile(OUT, JSON.stringify({ alreadyOpen, popoverImgs: probe.popoverImgs.slice(0, 8), afterHover }, null, 2));
  // eslint-disable-next-line no-console
  console.log(`[pass66 v2] → ${OUT}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
