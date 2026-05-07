// Pass 65 — "Add Images" popover içindeki sekme/segment yapısını incele.
// User feedback: setInputFiles "Image Prompts" yerine "Start Frame"
// (animate için) slot'una düşüyor. "Image Prompts" sekmesi seçilmeli.
//
// Audit hedefi:
//   - Add Images popover içinde "Image Prompts" tab/segment NEREDE
//   - Tıklanabilir DOM elementi NEDIR (button/role=tab/checkbox?)
//   - Aktif tab nasıl ayırt ediliyor (data-state, aria-selected, class?)

import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";

const CDP_URL = process.env["MJ_BRIDGE_CDP_URL"] ?? "http://127.0.0.1:9222";
const OUTPUT = "/tmp/mj-add-images-tabs.json";

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

  // Add Images tıkla
  await page.locator('button[aria-label="Add Images" i]').first().click();
  await page.waitForTimeout(1500);

  // 4 kategori metninin DOM yapısını incele.
  const categories = ["Start Frame", "Image Prompts", "Style References", "Omni Reference"];
  const probe: Record<string, unknown> = {};
  for (const cat of categories) {
    probe[cat] = await page.evaluate((catName) => {
      const all = Array.from(document.querySelectorAll("*"))
        .filter((el) => {
          const t = (el.textContent ?? "").trim();
          return t.startsWith(catName) && t.length < 250;
        });
      // Aday element (in-leaf, içinde başka category ismi yok)
      const candidates = all
        .filter((el) => {
          const t = (el.textContent ?? "").trim();
          // Diğer category isimlerinden hiçbiri içermesin
          const otherCats = ["Start Frame", "Image Prompts", "Style References", "Omni Reference"]
            .filter((c) => c !== catName);
          return !otherCats.some((c) => t.includes(c));
        })
        .slice(0, 5);
      return candidates.map((el) => {
        // Yakın atalardan tıklanabilirlerini bul
        const climb: Array<{ tag: string; role: string | null; testid: string | null; ariaSelected: string | null; classes: string }> = [];
        let cur: Element | null = el;
        for (let i = 0; i < 8 && cur; i++) {
          climb.push({
            tag: cur.tagName.toLowerCase(),
            role: cur.getAttribute("role"),
            testid: cur.getAttribute("data-testid"),
            ariaSelected: cur.getAttribute("aria-selected"),
            classes: (cur.className && typeof cur.className === "string" ? cur.className : "").slice(0, 100),
          });
          cur = cur.parentElement;
        }
        return {
          tag: el.tagName.toLowerCase(),
          text: (el.textContent ?? "").trim().slice(0, 120),
          classes: (el.className && typeof el.className === "string" ? el.className : "").slice(0, 100),
          parentClimb: climb,
        };
      });
    }, cat);
  }

  // Tıklanabilir elementlerin coords + visibility
  const visualMap = await page.evaluate(() => {
    const cats = ["Start Frame", "Image Prompts", "Style References", "Omni Reference"];
    return cats.map((cat) => {
      const els = Array.from(document.querySelectorAll("*"))
        .filter((el) => {
          const t = (el.textContent ?? "").trim();
          return t === cat || t.startsWith(`${cat}Use `) || t.startsWith(`${cat}Animate`) || t.startsWith(`${cat}Use a `);
        });
      return {
        cat,
        count: els.length,
        sample: els.slice(0, 3).map((el) => {
          const r = el.getBoundingClientRect();
          return {
            tag: el.tagName.toLowerCase(),
            visible: r.width > 0 && r.height > 0,
            rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
            text: (el.textContent ?? "").trim().slice(0, 100),
            classes: (el.className && typeof el.className === "string" ? el.className : "").slice(0, 80),
          };
        }),
      };
    });
  });

  await writeFile(OUTPUT, JSON.stringify({ timestamp: new Date().toISOString(), probe, visualMap }, null, 2));
  // eslint-disable-next-line no-console
  console.log(`[pass65 tabs] → ${OUTPUT}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
