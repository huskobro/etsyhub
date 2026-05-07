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
 * Render polling — Pass 49 yeniden yazım: image-URL-based detection.
 *
 * MJ web 2026-05-07 logged-in DOM gözleminde görüldü ki:
 *   • `data-job-id` attribute'u DOM'da YOK (eski Pass 43 stratejisi
 *     yanlıştı — sadece `data-active` var, başka data-* attr yok)
 *   • Render edilen 4 grid image'ı `cdn.midjourney.com/<UUID>/0_<n>_640_N.webp`
 *     pattern'inde geliyor (`<n>` = 0..3)
 *   • Bu UUID = MJ Job ID (kart attr'ı yerine URL'den parse edilir)
 *
 * Yeni strateji:
 *   1. Submit ÖNCESİ tüm `cdn.midjourney.com/<UUID>/...` URL'lerinden
 *      mevcut UUID set'ini topla — "baseline UUIDs"
 *   2. Submit sonrası polling — DOM'daki tüm renderImage src'lerini
 *      tarayıp UUID'leri çıkar
 *   3. Yeni bir UUID'nin 4 farklı index'i (`0_0`, `0_1`, `0_2`, `0_3`)
 *      hepsi görünene kadar bekle
 *   4. O UUID = mjJobId; o 4 src = imageUrls
 *
 * Avantaj:
 *   • DOM yapısına değil, MJ CDN URL pattern'ine bağlı (daha kararlı)
 *   • Job kart hiyerarşisi DOM'da değişse bile çalışır
 *   • mjJobId direkt URL'den parse edilir (no data-attr dependency)
 *
 * NOTE: Pass 43-48 `submitBaselineCount` parametresi geriye uyumlu
 * tutuldu (caller değişmesin); ama mantık image URL set bazlı.
 */
export type RenderResult = {
  jobCardSelector: string;
  mjJobId: string | null;
  imageUrls: string[];
};

const MJ_CDN_UUID_RE =
  /https?:\/\/cdn\.midjourney\.com\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/(\d+)_(\d+)_/i;

type CdnImage = { url: string; uuid: string; outerIdx: number; gridIdx: number };

async function collectCdnImages(
  page: Page,
  selectors: Record<MJSelectorKey, string>,
): Promise<CdnImage[]> {
  const imgs = page.locator(selectors.renderImage);
  const count = await imgs.count().catch(() => 0);
  const out: CdnImage[] = [];
  for (let i = 0; i < count; i++) {
    const src = await imgs
      .nth(i)
      .getAttribute("src")
      .catch(() => null);
    if (!src) continue;
    const m = MJ_CDN_UUID_RE.exec(src);
    if (!m) continue;
    out.push({
      url: src,
      uuid: m[1]!,
      outerIdx: Number(m[2]),
      gridIdx: Number(m[3]),
    });
  }
  return out;
}

export async function captureBaselineUuids(
  page: Page,
  selectors: Record<MJSelectorKey, string>,
): Promise<Set<string>> {
  const imgs = await collectCdnImages(page, selectors);
  return new Set(imgs.map((i) => i.uuid));
}

export async function waitForRender(
  page: Page,
  selectors: Record<MJSelectorKey, string>,
  options: {
    /**
     * @deprecated Pass 49 — image-URL-based polling kullanılıyor.
     * Geriye uyumlu tutuluyor; opts.baselineUuids verilmezse
     * polling submitBaselineCount > 0 ise eski davranışa düşer
     * (ama Pass 49 sonrası caller `baselineUuids` vermelidir).
     */
    submitBaselineCount?: number;
    /** Pass 49 — submit öncesi yakalanan UUID set'i. */
    baselineUuids?: Set<string>;
    timeoutMs: number;
    pollIntervalMs?: number;
    onPoll?: (elapsedMs: number, newImageCount: number) => void;
  },
): Promise<RenderResult> {
  const start = Date.now();
  const interval = options.pollIntervalMs ?? 3000;
  const baseline = options.baselineUuids ?? new Set<string>();

  while (Date.now() - start < options.timeoutMs) {
    const imgs = await collectCdnImages(page, selectors);
    // Yeni UUID'leri grup'la (UUID -> grid index'lerine map'le)
    const byUuid = new Map<string, Map<number, string>>();
    for (const img of imgs) {
      if (baseline.has(img.uuid)) continue;
      let m = byUuid.get(img.uuid);
      if (!m) {
        m = new Map();
        byUuid.set(img.uuid, m);
      }
      // outerIdx 0 = ilk render grid (upscale'lerde 1+); generate akışında
      // outerIdx=0 + gridIdx 0..3 hepsi gelmeli.
      if (img.outerIdx === 0) m.set(img.gridIdx, img.url);
    }
    if (options.onPoll) {
      const total = Array.from(byUuid.values()).reduce(
        (a, m) => a + m.size,
        0,
      );
      options.onPoll(Date.now() - start, total);
    }

    // 4 grid index'i (0,1,2,3) hepsi olan ilk yeni UUID'i seç.
    for (const [uuid, gridMap] of byUuid) {
      if (
        gridMap.has(0) &&
        gridMap.has(1) &&
        gridMap.has(2) &&
        gridMap.has(3)
      ) {
        const imageUrls = [0, 1, 2, 3].map((g) => gridMap.get(g)!);
        return {
          jobCardSelector: selectors.renderImage,
          mjJobId: uuid,
          imageUrls,
        };
      }
    }

    await new Promise((r) => setTimeout(r, interval));
  }

  throw new Error(
    `Render timeout (${options.timeoutMs}ms) — yeni UUID için 4 grid image bulunamadı`,
  );
}

/**
 * Pass 60 — Upscale tetikleme: parent /jobs/UUID?index=N sayfasında
 * "Upscale Subtle" veya "Upscale Creative" butonuna tıkla.
 *
 * Sayfa zaten parent'ın detail sayfasındaysa direkt buton click; değilse
 * caller önce navigasyon yapmalı (`page.goto(/jobs/UUID?index=N)`).
 *
 * UI feedback: tıklamadan sonra sayfa upscale render başlatır; URL aynı
 * kalır ama yeni bir UUID başlar. Sonuç polling için `waitForUpscaleResult`.
 */
export async function triggerUpscale(
  page: Page,
  selectors: Record<MJSelectorKey, string>,
  mode: "subtle" | "creative",
): Promise<void> {
  const selectorKey: MJSelectorKey =
    mode === "subtle" ? "upscaleSubtle" : "upscaleCreative";
  const button = page.locator(selectors[selectorKey]);

  // Pass 60 — React lazy mount: button DOM'a domcontentloaded sonrası
  // geç gelebilir. Timeout uzun + scroll into view + click retry.
  try {
    await button.first().waitFor({ state: "visible", timeout: 15_000 });
  } catch {
    throw new SelectorMismatchError(selectorKey, selectors[selectorKey]);
  }
  await button.first().scrollIntoViewIfNeeded().catch(() => undefined);
  // Click retry — overlay/popup intercept sorunlarına karşı (Pass 49 audit
  // notu: overflow-y-hidden div pointer events intercept ediyor).
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await button.first().click({ timeout: 5_000 });
      return;
    } catch (err) {
      lastErr = err;
      await page.waitForTimeout(500);
    }
  }
  throw new Error(
    `Upscale button click fail after 3 retries: ${
      lastErr instanceof Error ? lastErr.message : String(lastErr)
    }`,
  );
}

/**
 * Pass 60-61 — Upscale render polling.
 *
 * Pass 60 öğrenme: V7 alpha'da upscale tetiklendiğinde MJ web tarayıcı
 * **kullanıcıyı otomatik olarak yeni job sayfasına yönlendiriyor**:
 *   /jobs/<PARENT_UUID>?index=N → /jobs/<NEW_UUID>?index=N
 *
 * Yani upscale çıktı discovery'si **DOM'daki yeni img değil, page.url()
 * change** ile yapılır. Bu çok daha hızlı + güvenilir (DOM mutation
 * polling yok, native browser navigation event'i).
 *
 * Strateji (Pass 61):
 *   1. Submit öncesi parent URL'sini sakla
 *   2. Polling: page.url() farklı bir UUID içeriyorsa → çıktı UUID'i o
 *   3. Çıktı UUID bulunduktan sonra ilgili `/UUID/0_0_*.webp` URL'i
 *      DOM'da bekle (image lazy load için ek wait)
 *   4. Fallback: page.url() değişmezse mevcut DOM'da yeni baseline-dışı
 *      UUID ara (eski Pass 60 mantığı)
 *
 * Caller submit ÖNCESİ baselineUuids + parentMjJobId yakalamalı.
 */
export type UpscaleResult = {
  mjJobId: string; // yeni UUID
  imageUrl: string;
  gridIndex: number;
};

const MJ_URL_UUID_RE =
  /\/jobs\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

export async function waitForUpscaleResult(
  page: Page,
  selectors: Record<MJSelectorKey, string>,
  options: {
    parentMjJobId: string;
    baselineUuids: Set<string>;
    timeoutMs: number;
    pollIntervalMs?: number;
    onPoll?: (elapsedMs: number, currentUrl: string) => void;
  },
): Promise<UpscaleResult> {
  const start = Date.now();
  const interval = options.pollIntervalMs ?? 2000;

  while (Date.now() - start < options.timeoutMs) {
    const currentUrl = page.url();
    if (options.onPoll) options.onPoll(Date.now() - start, currentUrl);

    // Sinyal 1: page.url() yeni UUID'e yönlendi mi
    const urlMatch = MJ_URL_UUID_RE.exec(currentUrl);
    const urlUuid = urlMatch?.[1];
    if (urlUuid && urlUuid !== options.parentMjJobId) {
      // Yeni UUID URL'de, image DOM'da hazırlansın diye 1 polling daha
      // (image lazy load için)
      const imgs = await collectCdnImages(page, selectors);
      const matching = imgs.find(
        (img) => img.uuid === urlUuid && img.gridIdx === 0,
      );
      if (matching) {
        return {
          mjJobId: urlUuid,
          imageUrl: matching.url,
          gridIndex: matching.gridIdx,
        };
      }
      // URL var ama image henüz mount olmadı — bir sonraki tick'te dene
    }

    // Sinyal 2 (fallback): DOM'da yeni baseline-dışı UUID + 0_0
    const imgs = await collectCdnImages(page, selectors);
    for (const img of imgs) {
      if (options.baselineUuids.has(img.uuid)) continue;
      if (img.uuid === options.parentMjJobId) continue;
      if (img.outerIdx === 0 && img.gridIdx === 0) {
        return {
          mjJobId: img.uuid,
          imageUrl: img.url,
          gridIndex: img.gridIdx,
        };
      }
    }

    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error(
    `Upscale timeout (${options.timeoutMs}ms) — page.url() veya DOM'da yeni UUID bulunamadı (parent=${options.parentMjJobId})`,
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
/**
 * Pass 62 — MJ CDN URL'i full-res canonical URL'e çevir.
 *
 * MJ CDN her grid için 3 native format expose ediyor:
 *   `0_<n>.png`   — lossless, ~1MB, 1024×1024 (canonical baskı/clipart)
 *   `0_<n>.jpeg`  — lossy ~200KB, 1024×1024 (Etsy listing default)
 *   `0_<n>.webp`  — lossy ~200KB, 1024×1024 (modern web preview)
 *
 * Pass 49'dan beri ingest ettiğimiz `_640_N.webp` PREVIEW QUALITY
 * (640×640, ~50KB). Pass 62: ingest **canonical PNG** olarak yapılır;
 * derived format'lar (jpeg/webp) export endpoint'inde sharp ile üretilir.
 *
 * Pattern: `cdn.midjourney.com/{UUID}/0_<n>_640_N.webp?method=shortest`
 *        → `cdn.midjourney.com/{UUID}/0_<n>.png`
 *
 * Upscale (kind=UPSCALE) çıktıları aynı pattern'i kullanır.
 */
export function toCanonicalFullResUrl(previewUrl: string): string {
  // /UUID/<outerIdx>_<gridIdx>_640_N.webp?... → /UUID/<outerIdx>_<gridIdx>.png
  return previewUrl.replace(
    /\/(\d+)_(\d+)_\d+_N\.webp(\?[^/]*)?$/i,
    "/$1_$2.png",
  );
}

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

  // Pass 49 — MJ CDN download stratejisi:
  //
  // ÖĞRENME (Pass 49 audit): Cloudflare CDN, Playwright APIRequestContext'i
  // (`page.request.get`) bot olarak görüp 403 + "Just a moment" interstitial
  // döner — explicit Referer/Cookie header ekleyerek bile. Browser'ın
  // gerçek navigation request'i (page.goto) ise CF tarafından OK'lanır
  // çünkü TLS fingerprint + tüm browser header set'i tam.
  //
  // Çözüm: yeni tab aç, image URL'ine goto et, response.body() ile
  // bytes'ı yakala, tab'ı kapat. Yeni tab session ve cookie'leri context
  // ile paylaşır; CF challenge tetiklenmez.
  //
  // Pass 62 — preview `_640_N.webp` URL'lerini full-res `.png`'ye çevir
  // (canonical kayıt). Fail → preview URL'e fallback (ingest yine de
  // çalışır, ama canonical kalite kaybolur).
  const ctx = page.context();
  for (let i = 0; i < imageUrls.length && i < 4; i++) {
    const previewUrl = imageUrls[i]!;
    const canonicalUrl = toCanonicalFullResUrl(previewUrl);
    const tryUrls = canonicalUrl !== previewUrl ? [canonicalUrl, previewUrl] : [previewUrl];
    let saved: { body: Buffer; usedUrl: string; mime: string } | null = null;
    for (const url of tryUrls) {
      const dlPage = await ctx.newPage();
      try {
        const resp = await dlPage.goto(url, {
          waitUntil: "load",
          timeout: 30_000,
        });
        if (resp && resp.ok()) {
          saved = {
            body: await resp.body(),
            usedUrl: url,
            mime: resp.headers()["content-type"] ?? "",
          };
          break;
        }
      } catch {
        // try next URL
      } finally {
        await dlPage.close().catch(() => undefined);
      }
    }
    if (!saved) {
      throw new Error(
        `Image download fail for grid ${i}: ${tryUrls.join(", ")}`,
      );
    }
    const ext = guessImageExtension(saved.usedUrl, saved.mime);
    const localPath = join(jobDir, `${i}${ext}`);
    await mkdir(dirname(localPath), { recursive: true });
    await writeFile(localPath, saved.body);
    // sourceUrl olarak preview URL'i kaydet (debug + admin link için);
    // localPath canonical full-res içerir.
    results.push({ gridIndex: i, localPath, sourceUrl: previewUrl });
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
