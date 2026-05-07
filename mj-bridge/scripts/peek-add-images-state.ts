// Pass 65 — Şu an MJ /imagine sayfasında Add Images popover ne durumda?
// Smoke v2 SUBMITTING_PROMPT'ta 5+ dk takıldı; ne aşamada?

import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";

async function main() {
  const browser = await chromium.connectOverCDP("http://127.0.0.1:9222", { timeout: 10_000 });
  const ctx = browser.contexts()[0];
  if (!ctx) throw new Error("no ctx");
  const pages = ctx.pages();
  const mj = pages.find((p) => p.url().includes("midjourney.com")) ?? pages[0];
  if (!mj) throw new Error("no mj page");

  const peek = await mj.evaluate(() => {
    const fileInputs = Array.from(document.querySelectorAll('input[type="file"]')).map((el) => ({
      accept: el.getAttribute("accept"),
      filesCount: (el as HTMLInputElement).files?.length ?? 0,
    }));
    const tabs = ["Start Frame", "Image Prompts", "Style References", "Omni Reference"].map((cat) => {
      const els = Array.from(document.querySelectorAll('div[class*="border-r"]'))
        .filter((el) => el.textContent?.includes(cat));
      return {
        cat,
        count: els.length,
        firstClasses: els[0]?.className?.slice(0, 200),
      };
    });
    const promptVal = (document.querySelector("#desktop_input_bar") as HTMLTextAreaElement | null)?.value ?? null;
    const selectedImagesDiv = Array.from(document.querySelectorAll("*"))
      .filter((el) => {
        const t = (el.textContent ?? "").trim();
        return /^Selected images/i.test(t) && t.length < 200;
      })
      .slice(0, 3)
      .map((el) => ({ tag: el.tagName.toLowerCase(), text: (el.textContent ?? "").trim().slice(0, 200) }));
    const popoverImgs = Array.from(document.querySelectorAll("img"))
      .map((img) => ({ src: (img.getAttribute("src") ?? "").slice(0, 120), alt: img.getAttribute("alt") }))
      .filter((i) => /blob:|data:image|cdn.midjourney/.test(i.src))
      .slice(0, 10);
    return { fileInputs, tabs, promptVal, selectedImagesDiv, popoverImgs, body: document.body.innerText.slice(0, 500) };
  });

  await writeFile("/tmp/mj-peek-state.json", JSON.stringify(peek, null, 2));
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(peek, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
