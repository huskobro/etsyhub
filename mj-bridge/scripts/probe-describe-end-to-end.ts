// Pass 66 — describe end-to-end probe (real flow, real result scrape).
//
// Probe v2 keşfi: hover sonrası thumbnail üstünde 4 küçük buton var:
// Rerun / TextIcon / Trash / **Vertical-dots (More)**. Vertical-dots SVG
// path'i: `M12 5v.01M12 12v.01M12 19v.01...`.
//
// Bu probe:
//   1. Add Images popover aç + Image Prompts tab seç
//   2. Image yükle
//   3. Yüklü thumbnail'i bul + hover et
//   4. Vertical-dots butonunu tıkla (More menüsü açılır)
//   5. "Describe" menü öğesini tıkla
//   6. Sonuçların (4 prompt) DOM'a gelmesini bekle, scrape et

import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";

const CDP_URL = process.env["MJ_BRIDGE_CDP_URL"] ?? "http://127.0.0.1:9222";
const OUT = "/tmp/mj-describe-e2e.json";
// Pass 66 — farklı tema test görseli ("abstract test pattern minimalist"
// prompt'undan üretilmiş ui-e2e pass 51 image). Önceki run "happy new year"
// çıktısı verdi — kullanıcı bildirdi ki Chrome eklentisi describe'ı
// background'da otomatik tetikliyor olabilir; eklenti çıktısıyla
// karışmamak için farklı bir tema seç.
const TEST_URL =
  "https://cdn.midjourney.com/c2edd80b-b2ad-48a3-83e5-5de828aae580/0_0.png";

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
  let alreadyOpen = false;
  const fileInput0 = page.locator('input[type="file"][accept*="image" i]').first();
  try {
    await fileInput0.waitFor({ state: "attached", timeout: 500 });
    alreadyOpen = true;
  } catch {
    await page.locator('button[aria-label="Add Images" i]').first().click();
    await page.waitForTimeout(1500);
  }

  // 2) Image Prompts tab
  await page
    .locator(
      'xpath=//div[contains(@class, "border-r") and contains(., "Image Prompts") and contains(., "Use the elements of an image")]',
    )
    .first()
    .click({ force: true, timeout: 5_000 });
  await page.waitForTimeout(800);

  // 3) Image yükle
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
  await page.waitForTimeout(3500);

  // 4) Yüklü thumbnail koordinatını bul. Önceki probe'dan biliyoruz:
  // popover içindeki thumbnail src'leri `s.mj.run/...?thumb=true` veya
  // `cdn.midjourney.com/u/.../...png` pattern'i. Yeni eklenenler s.mj.run.
  const thumb = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll("img"))
      .filter((img) => {
        const r = img.getBoundingClientRect();
        const src = img.getAttribute("src") ?? "";
        // Yeni yüklenen image popover thumbnail — s.mj.run/X?thumb=true
        return /s\.mj\.run\/.+thumb/.test(src) && r.width > 30 && r.width < 100;
      })
      .sort((a, b) => {
        // En son eklenen genelde en sağda/altta
        const ar = a.getBoundingClientRect();
        const br = b.getBoundingClientRect();
        return br.x + br.y - ar.x - ar.y;
      });
    if (imgs.length === 0) return null;
    const r = imgs[0]!.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, src: imgs[0]!.getAttribute("src") };
  });
  if (!thumb) throw new Error("Yüklü thumbnail bulunamadı");
  // eslint-disable-next-line no-console
  console.log("[probe] thumb at", thumb);

  // 5) Hover thumbnail
  await page.mouse.move(thumb.x, thumb.y);
  await page.waitForTimeout(800);

  // 6) Vertical-dots butonunu bul ve tıkla.
  // Strategy v2: thumbnail src'sinden DOM'da img element'i bul, ardından
  // en yakın wrapper'a (closest figure / li / div with role) çık,
  // o wrapper içinde M12 5v.01 path'li button ara. Koordinat tolerance
  // güvenilir değil (scroll/sticky etkileyebilir).
  const dotsClicked = await page.evaluate((thumbSrc: string | null) => {
    if (!thumbSrc) return { clicked: false, reason: "no thumb src" };
    const img = Array.from(document.querySelectorAll("img")).find(
      (i) => i.getAttribute("src") === thumbSrc,
    );
    if (!img) return { clicked: false, reason: "thumb img not found" };
    // Yukarı doğru max 8 ata seviyesi tara, M12 5v.01 path'li button ara
    let cur: HTMLElement | null = img.parentElement;
    for (let i = 0; i < 8 && cur; i++) {
      const buttons = Array.from(cur.querySelectorAll("button"));
      for (const b of buttons) {
        const svg = b.querySelector("svg");
        if (!svg) continue;
        const path = svg.querySelector("path");
        const d = path?.getAttribute("d") ?? "";
        if (/M12\s*5v\.?01.*M12\s*12v\.?01.*M12\s*19v\.?01/.test(d)) {
          (b as HTMLElement).click();
          return { clicked: true, climbDepth: i };
        }
      }
      cur = cur.parentElement;
    }
    // Fallback: tüm sayfada M12 5v.01 path'li butonları topla,
    // thumbnail rect'ine en yakını seç
    const tr = img.getBoundingClientRect();
    const candidates = Array.from(document.querySelectorAll("button"))
      .filter((b) => {
        const svg = b.querySelector("svg");
        const d = svg?.querySelector("path")?.getAttribute("d") ?? "";
        return /M12\s*5v\.?01.*M12\s*12v\.?01.*M12\s*19v\.?01/.test(d);
      })
      .map((b) => {
        const r = b.getBoundingClientRect();
        const dist = Math.hypot(
          r.x + r.width / 2 - (tr.x + tr.width / 2),
          r.y + r.height / 2 - (tr.y + tr.height / 2),
        );
        return { btn: b as HTMLElement, dist };
      })
      .sort((a, b) => a.dist - b.dist);
    if (candidates.length > 0 && candidates[0]!.dist < 200) {
      candidates[0]!.btn.click();
      return { clicked: true, fallback: true, dist: candidates[0]!.dist };
    }
    return { clicked: false, reason: "no dots btn", candidatesCount: candidates.length };
  }, thumb.src ?? null);
  if (!dotsClicked.clicked) {
    throw new Error(`Vertical-dots butonu bulunamadı: ${JSON.stringify(dotsClicked)}`);
  }
  await page.waitForTimeout(800);

  // 7) Describe menü öğesini tıkla. Dropdown menüde "Describe" görünür olmalı
  const describeMenuItem = page.locator('text=/^Describe$/').first();
  await describeMenuItem.waitFor({ state: "visible", timeout: 5_000 });
  await describeMenuItem.click({ timeout: 5_000 });
  // eslint-disable-next-line no-console
  console.log("[probe] Describe menu clicked");

  // 8) Sonuç beklenir — 4 prompt sayfada görünmeli (60sn timeout)
  let result = null;
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(2000);
    const snap = await page.evaluate(() => {
      // Numeric prefix (1. 2. 3. 4.) içeren prompt-uzunluğunda metinler
      const numericList = Array.from(document.querySelectorAll("p, div, li, span"))
        .filter((el) => {
          if (el.children.length > 3) return false;
          const t = (el.textContent ?? "").trim();
          return /^\s*[1-4][.):]\s/.test(t) && t.length > 30 && t.length < 800;
        })
        .slice(0, 10)
        .map((el) => ({
          tag: el.tagName.toLowerCase(),
          text: (el.textContent ?? "").trim().slice(0, 600),
        }));
      // MJ-style flag işaretli paragraf prompt
      const promptish = Array.from(document.querySelectorAll("p, div, span"))
        .filter((el) => {
          if (el.children.length > 1) return false;
          const t = (el.textContent ?? "").trim();
          return t.length > 60 && t.length < 800 && /--ar|--v|::|stylize|cinematic|hyper-realistic|abstract|illustration/i.test(t);
        })
        .slice(0, 10)
        .map((el) => ({
          tag: el.tagName.toLowerCase(),
          text: (el.textContent ?? "").trim().slice(0, 500),
        }));
      // /describe/UUID pattern altındaki "use" butonları (MJ describe sonuç UI)
      const useButtons = Array.from(document.querySelectorAll("button"))
        .filter((b) => /^Use|^Imagine|^Try/.test((b.textContent ?? "").trim()))
        .slice(0, 10)
        .map((b) => ({ text: (b.textContent ?? "").trim().slice(0, 60) }));
      return {
        numericListCount: numericList.length,
        numericList,
        promptishCount: promptish.length,
        promptish,
        useButtons,
        currentUrl: window.location.href,
      };
    });
    // eslint-disable-next-line no-console
    console.log(`[i=${i}] numeric=${snap.numericListCount} promptish=${snap.promptishCount} url=${snap.currentUrl.slice(-50)}`);
    if (snap.numericListCount >= 4 || snap.promptishCount >= 4) {
      result = snap;
      break;
    }
    result = snap;
  }

  await writeFile(OUT, JSON.stringify({ thumb, dotsClicked, result }, null, 2));
  // eslint-disable-next-line no-console
  console.log(`[pass66 e2e] → ${OUT}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("FAIL:", err);
  process.exit(1);
});
