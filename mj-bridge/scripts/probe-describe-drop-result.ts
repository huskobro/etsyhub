// Pass 66 — describe drop event simulation + result scrape probe.
//
// Önceki probe (probe-describe-dropzone.ts) doğruladı: dragenter event'i
// "Describe" overlay'ini DOM'a getiriyor (Add Images popover'a gerek yok).
//
// Bu probe drop'u tetikler — gerçek file için describe sonuçlarını yakala.
//
// Strategy:
//   1. Probe input file element oluştur, image buffer set et
//   2. Drop event dispatch et describe drop zone üzerine (rect kullanılır)
//   3. 30sn bekle — describe sonucu DOM'a gelir
//   4. "1.", "2.", "3.", "4." ile başlayan prompt önerilerini bul

import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";

const CDP_URL = process.env["MJ_BRIDGE_CDP_URL"] ?? "http://127.0.0.1:9222";
const OUT = "/tmp/mj-describe-drop-result.json";

// Real MJ CDN image — kullanıcının kendi previous render'ı
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

  // Image'ı yeni tab + page.goto ile indir (Pass 49 pattern)
  const dlPage = await ctx.newPage();
  let buffer: Buffer;
  try {
    const resp = await dlPage.goto(TEST_URL, {
      waitUntil: "load",
      timeout: 30_000,
    });
    if (!resp || !resp.ok()) {
      throw new Error(`Image fetch ${resp?.status()}`);
    }
    buffer = Buffer.from(await resp.body());
  } finally {
    await dlPage.close().catch(() => undefined);
  }
  // eslint-disable-next-line no-console
  console.log(`[probe] image fetched ${buffer.length} bytes`);

  // Drop event simulation: page.evaluate içine buffer base64'lü gönder.
  const base64 = buffer.toString("base64");
  await page.evaluate(
    async ({ b64, mime }) => {
      // Buffer → File
      const byteString = atob(b64);
      const u8 = new Uint8Array(byteString.length);
      for (let i = 0; i < byteString.length; i++) u8[i] = byteString.charCodeAt(i);
      const file = new File([u8], "describe-probe.png", { type: mime });
      // DataTransfer'a ekle
      const dt = new DataTransfer();
      dt.items.add(file);
      // dragenter (overlay'i aç)
      document.body.dispatchEvent(
        new DragEvent("dragenter", {
          bubbles: true,
          cancelable: true,
          dataTransfer: dt,
        }),
      );
      // dragover (overlay'i yerinde tut)
      document.body.dispatchEvent(
        new DragEvent("dragover", {
          bubbles: true,
          cancelable: true,
          dataTransfer: dt,
        }),
      );
      // Kısa bekleme (overlay render olsun)
      await new Promise((r) => setTimeout(r, 800));
      // Describe drop zone'a yönelik drop — element'i bul
      const describeEl = Array.from(document.querySelectorAll("*")).find((el) => {
        if (el.children.length > 1) return false;
        const t = (el.textContent ?? "").trim();
        return /^Describe$/i.test(t) && t.length < 50;
      });
      if (!describeEl) {
        throw new Error("Describe drop zone DOM'da bulunamadı");
      }
      // Drop event'i describe element üzerine
      describeEl.dispatchEvent(
        new DragEvent("drop", {
          bubbles: true,
          cancelable: true,
          dataTransfer: dt,
        }),
      );
      document.body.dispatchEvent(
        new DragEvent("dragleave", { bubbles: true, cancelable: true }),
      );
    },
    { b64: base64, mime: "image/png" },
  );

  // 30 saniye bekle, prompt sonuçlarını ara
  let result: unknown = null;
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(1500);
    const snap = await page.evaluate(() => {
      const numericList = Array.from(document.querySelectorAll("*"))
        .filter((el) => {
          if (el.children.length > 3) return false;
          const t = (el.textContent ?? "").trim();
          return /^\s*[1-4][.):]\s/.test(t) && t.length > 20 && t.length < 800;
        })
        .slice(0, 10)
        .map((el) => ({
          tag: el.tagName.toLowerCase(),
          text: (el.textContent ?? "").trim().slice(0, 600),
          classes: ((el.className && typeof el.className === "string") ? el.className : "").slice(0, 100),
        }));
      const promptish = Array.from(document.querySelectorAll("p, div"))
        .filter((el) => {
          if (el.children.length > 1) return false;
          const t = (el.textContent ?? "").trim();
          return t.length > 60 && t.length < 600 && /--ar|--v|::|stylize/i.test(t);
        })
        .slice(0, 10)
        .map((el) => ({
          tag: el.tagName.toLowerCase(),
          text: (el.textContent ?? "").trim().slice(0, 400),
        }));
      return {
        numericListCount: numericList.length,
        numericListSample: numericList.slice(0, 5),
        promptishCount: promptish.length,
        promptishSample: promptish.slice(0, 5),
        currentUrl: window.location.href,
      };
    });
    // eslint-disable-next-line no-console
    console.log(`[probe ${i}] numeric=${snap.numericListCount} promptish=${snap.promptishCount} url=${snap.currentUrl.slice(-40)}`);
    if (snap.numericListCount >= 4 || snap.promptishCount >= 4) {
      result = snap;
      break;
    }
    result = snap;
  }

  await writeFile(OUT, JSON.stringify({ timestamp: new Date().toISOString(), result }, null, 2));
  // eslint-disable-next-line no-console
  console.log(`[pass66] describe drop result → ${OUT}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
