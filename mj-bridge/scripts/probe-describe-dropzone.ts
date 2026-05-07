// Pass 66 — Describe drop zone probe (read-only).
//
// Kullanıcı feedback: "Add Images tuşuna basmadan da sürükle bırakırsan
// describe zone açılıyor". Yani /imagine sayfasında dosya drag-over
// edildiğinde describe drop zone DOM'a geliyor. Bu probe:
//   1. /imagine'i yükle
//   2. dragover event simüle et
//   3. DOM'da yeni "Describe" drop zone elementini bul
//   4. Yapısını JSON'a kaydet — driver helper için selector kalibrasyonu

import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";

const CDP_URL = process.env["MJ_BRIDGE_CDP_URL"] ?? "http://127.0.0.1:9222";
const OUT = "/tmp/mj-describe-dropzone.json";

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

  // Önceki state — describe zone DOM'da var mı?
  const before = await page.evaluate(() => ({
    describeWords: Array.from(document.querySelectorAll("*"))
      .filter((el) => {
        if (el.children.length > 1) return false;
        const t = (el.textContent ?? "").trim();
        return /^Describe$/i.test(t) || /Describe[a-z]/i.test(t);
      })
      .slice(0, 10)
      .map((el) => ({
        tag: el.tagName.toLowerCase(),
        text: (el.textContent ?? "").trim().slice(0, 80),
        classes: ((el.className && typeof el.className === "string") ? el.className : "").slice(0, 100),
      })),
    fileInputCount: document.querySelectorAll('input[type="file"]').length,
  }));

  // Dragenter / dragover event simüle — Playwright'ın dispatchEvent ile.
  // Sayfa-wide drop overlay tetikleniyor mu?
  await page.evaluate(() => {
    // Drag-and-drop simülasyonu için DataTransfer + dragenter event
    const dt = new DataTransfer();
    // Sahte file ekle (image MIME) — MJ sadece dragenter'da overlay açar mı bak
    const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "probe.png", {
      type: "image/png",
    });
    dt.items.add(file);
    const event = new DragEvent("dragenter", {
      bubbles: true,
      cancelable: true,
      dataTransfer: dt,
    });
    document.body.dispatchEvent(event);
    // dragover devam — overlay'in kalması için
    const event2 = new DragEvent("dragover", {
      bubbles: true,
      cancelable: true,
      dataTransfer: dt,
    });
    document.body.dispatchEvent(event2);
  });
  await page.waitForTimeout(2000);

  // Sonraki state — Describe drop zone DOM'a geldi mi?
  const after = await page.evaluate(() => {
    const describeEls = Array.from(document.querySelectorAll("*"))
      .filter((el) => {
        if (el.children.length > 2) return false;
        const t = (el.textContent ?? "").trim();
        return /^Describe$/i.test(t) && t.length < 50;
      })
      .slice(0, 10)
      .map((el) => {
        const climb: Array<{ tag: string; text: string; classes: string }> = [];
        let cur: Element | null = el;
        for (let i = 0; i < 6 && cur; i++) {
          climb.push({
            tag: cur.tagName.toLowerCase(),
            text: (cur.textContent ?? "").trim().slice(0, 80),
            classes: ((cur.className && typeof cur.className === "string") ? cur.className : "").slice(0, 100),
          });
          cur = cur.parentElement;
        }
        const r = el.getBoundingClientRect();
        return {
          tag: el.tagName.toLowerCase(),
          text: (el.textContent ?? "").trim().slice(0, 80),
          classes: ((el.className && typeof el.className === "string") ? el.className : "").slice(0, 100),
          rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
          parents: climb,
        };
      });
    const dropZones = Array.from(document.querySelectorAll('[class*="drop" i], [class*="dashed" i], [class*="dropzone" i]'))
      .slice(0, 10)
      .map((el) => ({
        tag: el.tagName.toLowerCase(),
        classes: ((el.className && typeof el.className === "string") ? el.className : "").slice(0, 150),
        text: (el.textContent ?? "").trim().slice(0, 200),
      }));
    return {
      describeEls,
      dropZones,
      fileInputCount: document.querySelectorAll('input[type="file"]').length,
      fileInputs: Array.from(document.querySelectorAll('input[type="file"]')).map((el) => ({
        accept: el.getAttribute("accept"),
        multiple: el.hasAttribute("multiple"),
      })),
      bodyTextSnap: document.body.innerText.slice(0, 1500),
    };
  });

  // Cleanup: dragleave gönder
  await page.evaluate(() => {
    const event = new DragEvent("dragleave", { bubbles: true, cancelable: true });
    document.body.dispatchEvent(event);
  });

  await writeFile(OUT, JSON.stringify({ timestamp: new Date().toISOString(), before, after }, null, 2));
  // eslint-disable-next-line no-console
  console.log(`[pass66] describe dropzone probe → ${OUT}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
