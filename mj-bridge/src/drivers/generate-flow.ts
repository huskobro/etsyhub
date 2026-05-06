// Pass 43 — Generate flow real implementation helpers.
//
// MJ web tarafı sözleşmesi (resmi docs + topluluk gözlemleri):
//   1. /imagine sayfasında "Imagine bar" prompt textarea'sı var
//   2. Prompt + Enter → render başlar
//   3. Render ~30-90 sn; tamamlandığında 4-grid render kartı görünür
//   4. Kartta job ID DOM attribute (data-job-id) veya URL fragment'ında
//   5. 4 grid item'ın img.src MJ CDN URL (img-stage*.midjourneyusercontent.com
//      gibi pattern)
//
// Pass 43 V1 hedefi:
//   ✓ Prompt input bul + temizle + doldur (typing jitter)
//   ✓ Submit (Enter)
//   ✓ Render polling (DOM mutation observer + img selector)
//   ✓ MJ Job ID parse (data-job-id veya URL'den)
//   ✓ Grid img URL'leri capture
//   ✓ Download (page.request.get → Buffer; aynı session cookie)
//
// Honest sınır:
//   • Selector'lar üyelik aldıktan sonra ilk gerçek tur'da kalibre edilir.
//     Default'lar 2026 Mayıs MJ docs/community gözlemine göre yazıldı.
//   • Driver `executeJob` BU helper'ları orchestre eder; helper'ların
//     kendisi state machine bilmez (caller raporlar).

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Page } from "playwright";
import type { MJSelectorKey } from "./selectors.js";
import type { MjGenerateParams } from "../types.js";

/**
 * Prompt'u MJ flag formatına dönüştür.
 *
 * MJ web prompt'a `--ar 2:3 --v 8.1 --style raw --stylize 100` flag'lerini
 * tek satırda kabul eder (Discord pattern'iyle uyumlu).
 *
 * Pass 43 V1: aspect-ratio + version + style raw + stylize + chaos.
 * V1.x: omni-ref / style-ref / image-prompt URL'leri.
 */
export function buildMJPromptString(params: MjGenerateParams): string {
  const parts: string[] = [params.prompt.trim()];

  // Image prompt URL'leri prompt başına gelir (MJ kuralı).
  if (params.imagePromptUrls && params.imagePromptUrls.length > 0) {
    // URL'leri başa al; prompt textini sona koy.
    parts.unshift(...params.imagePromptUrls);
  }

  // Param flag'leri.
  parts.push(`--ar ${params.aspectRatio}`);
  if (params.version) parts.push(`--v ${params.version}`);
  if (params.styleRaw) parts.push("--style raw");
  if (typeof params.stylize === "number") {
    parts.push(`--stylize ${params.stylize}`);
  }
  if (typeof params.chaos === "number") {
    parts.push(`--chaos ${params.chaos}`);
  }
  if (params.styleReferenceUrls && params.styleReferenceUrls.length > 0) {
    parts.push(`--sref ${params.styleReferenceUrls.join(" ")}`);
  }
  if (params.omniReferenceUrl) {
    parts.push(`--oref ${params.omniReferenceUrl}`);
    if (typeof params.omniWeight === "number") {
      parts.push(`--ow ${params.omniWeight}`);
    }
  }

  return parts.join(" ");
}

/**
 * Random integer [min, max]. Typing jitter için.
 */
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() + min + Math.random() * (max - min));
}

/**
 * Prompt'u Imagine bar'a yaz + Enter.
 *
 * - Mevcut text'i temizle (Cmd+A → Delete)
 * - Karakter karakter type (jitter 30-80ms) — kaba paste yerine doğal
 * - Enter ile submit
 *
 * Selector bulunamazsa SelectorMismatchError fırlatır.
 */
export class SelectorMismatchError extends Error {
  constructor(public selectorKey: MJSelectorKey, public selector: string) {
    super(
      `Selector eşleşmedi: ${selectorKey} (${selector}) — MJ web değişmiş olabilir`,
    );
    this.name = "SelectorMismatchError";
  }
}

export async function submitPrompt(
  page: Page,
  selectors: Record<MJSelectorKey, string>,
  promptString: string,
  options: { typingJitterMs?: [number, number] } = {},
): Promise<void> {
  const [minMs, maxMs] = options.typingJitterMs ?? [30, 80];

  const inputLocator = page.locator(selectors.promptInput).first();
  const visible = await inputLocator
    .isVisible({ timeout: 5000 })
    .catch(() => false);
  if (!visible) {
    throw new SelectorMismatchError("promptInput", selectors.promptInput);
  }

  // Click + select-all + delete (önceki içeriği sil).
  await inputLocator.click();
  await inputLocator.press(
    process.platform === "darwin" ? "Meta+A" : "Control+A",
  );
  await inputLocator.press("Delete");

  // Karakter karakter type (jitter ile).
  for (const ch of promptString) {
    await inputLocator.type(ch, { delay: randInt(minMs, maxMs) });
  }

  // Submit — Enter (MJ docs ana yol).
  await inputLocator.press("Enter");
}

/**
 * Render polling — yeni job kartı görünene kadar bekle.
 *
 * MJ web rendering 30-90 sn. Polling 3sn aralıkla; max 180 sn (3 dk).
 *
 * Strateji:
 *   1. Submit'ten önce mevcut renderJobCard sayısını kaydet
 *   2. Submit sonrası DOM polling — yeni kart sayısı eski + 1?
 *   3. Yeni kart bulunduğunda kart içinde 4 img bekle (loading
 *      → ready)
 *   4. 4 img URL'lerini topla
 *
 * Pass 43 V1 NOTE: Bu helper `data-job-id` selector'ına bağlı; gerçek
 * üyelik testinde MJ DOM'unu inspect edip selector'ları kalibre etmek
 * gerek. Bulunamazsa SelectorMismatchError + caller AWAITING state.
 */
export type RenderResult = {
  jobCardSelector: string;
  mjJobId: string | null;
  imageUrls: string[];
  /** DOM'dan parse edilen sourceUrl'ler — debug için. */
  rawHtml?: string;
};

export async function waitForRender(
  page: Page,
  selectors: Record<MJSelectorKey, string>,
  options: {
    submitBaselineCount: number;
    timeoutMs: number;
    pollIntervalMs?: number;
    onPoll?: (elapsedMs: number, currentCount: number) => void;
  },
): Promise<RenderResult> {
  const start = Date.now();
  const interval = options.pollIntervalMs ?? 3000;

  while (Date.now() - start < options.timeoutMs) {
    const cards = page.locator(selectors.renderJobCard);
    const count = await cards.count().catch(() => 0);
    if (options.onPoll) options.onPoll(Date.now() - start, count);

    if (count > options.submitBaselineCount) {
      // Yeni kart eklendi — ilk yeni kartı al (genelde DOM order'da yeni
      // en üstte).
      const newCard = cards.first();
      // Kart içindeki 4 img bekle.
      const imgs = newCard.locator(selectors.renderImage);
      const imgCount = await imgs.count().catch(() => 0);
      if (imgCount >= 4) {
        const imageUrls: string[] = [];
        for (let i = 0; i < 4; i++) {
          const src = await imgs
            .nth(i)
            .getAttribute("src")
            .catch(() => null);
          if (src) imageUrls.push(src);
        }
        if (imageUrls.length === 4) {
          // MJ Job ID — data-job-id attr veya URL fragment.
          const mjJobId = await newCard
            .getAttribute("data-job-id")
            .catch(() => null);
          return {
            jobCardSelector: selectors.renderJobCard,
            mjJobId,
            imageUrls,
          };
        }
      }
    }

    await new Promise((r) => setTimeout(r, interval));
  }

  throw new Error(
    `Render timeout (${options.timeoutMs}ms) — yeni job kartı veya 4 img bulunamadı`,
  );
}

/**
 * Grid img URL'lerinden full-resolution image indir.
 *
 * MJ web img tag'leri **thumbnail** olabilir (e.g. `_N.webp` suffix'i).
 * Full-res URL pattern'i MJ'ye özel — `_N.webp` → `.png` veya `?w=2048`
 * gibi transform'lar gerek. Pass 43 V1: olduğu gibi indir; full-res
 * upgrade V1.1 carry-forward.
 *
 * `page.request.get(url)` aynı session cookie'siyle çalışır (login
 * gerektirir).
 */
export async function downloadGridImages(
  page: Page,
  imageUrls: string[],
  outputsDir: string,
  jobId: string,
): Promise<
  Array<{
    gridIndex: number;
    localPath: string;
    sourceUrl: string;
  }>
> {
  const jobDir = join(outputsDir, jobId);
  await mkdir(jobDir, { recursive: true });

  const results: Array<{
    gridIndex: number;
    localPath: string;
    sourceUrl: string;
  }> = [];

  for (let i = 0; i < imageUrls.length && i < 4; i++) {
    const url = imageUrls[i]!;
    const res = await page.request.get(url);
    if (!res.ok()) {
      throw new Error(`Image download fail (${res.status()}): ${url}`);
    }
    const body = await res.body();
    const ext = guessImageExtension(url, res.headers()["content-type"]);
    const localPath = join(jobDir, `${i}${ext}`);
    await mkdir(dirname(localPath), { recursive: true });
    await writeFile(localPath, body);
    results.push({ gridIndex: i, localPath, sourceUrl: url });
  }

  return results;
}

function guessImageExtension(url: string, contentType?: string): string {
  if (url.endsWith(".png")) return ".png";
  if (url.endsWith(".webp")) return ".webp";
  if (url.endsWith(".jpg") || url.endsWith(".jpeg")) return ".jpg";
  if (contentType?.includes("png")) return ".png";
  if (contentType?.includes("webp")) return ".webp";
  if (contentType?.includes("jpeg")) return ".jpg";
  return ".png"; // default safe
}
