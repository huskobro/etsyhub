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

  // Pass 65 — Image-prompt URL'leri ARTIK prompt textine eklenmiyor.
  // MJ V8 web'de "URL'i textarea'ya yazınca image-prompt'a dönüşür"
  // davranışı kalmadı (Pass 65 audit canlı doğrulaması: URL plain text
  // olarak gidiyor, thumbnail oluşmuyor). Bunun yerine driver
  // executeJob ÖNCESİ "Add Images → Image Prompts" popover'ından
  // file input'a upload eder (attachImagePrompts helper). Bu fonksiyon
  // sadece prompt text + flag'lerini birleştirir.
  // Eski Discord-uyumlu davranış buildMJPromptString içinde DEĞİL,
  // attachImagePrompts içinde mantığa yerleştirildi.

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
 * Pass 68 — Describe via MJ internal API (eklenti audit'ten öğrenildi).
 *
 * Pass 67 araştırması: AutoSail/AutoJourney eklentisi MJ describe'ı tek
 * `fetch("/api/describe")` ile yapıyor. PoC bridge tarafında 4 saniyede
 * 4 prompt doğruladı (DOM yolu ~26 saniye → 6.6× hızlı).
 *
 * Akış:
 *   1. `cdn.midjourney.com` veya `s.mj.run` URL'i ise upload bypass
 *   2. Aksi halde `/api/storage-upload-file` (multipart) ile MJ kendi
 *      storage'a yükle, `bucketPathname` al, `cdn.midjourney.com/u/<path>`
 *      formatında URL üret
 *   3. `POST /api/describe` body `{ image_url, channelId: "picread" }`
 *      headers `X-Csrf-Protection: 1`. Cookie auth attach context'inden.
 *   4. Synchronous response: `{ success, data: { descriptions: [4] } }`
 *
 * Avantajlar:
 *   - DOM hiç dokunulmuyor (popover yok, hover yok, tıklama yok)
 *   - 4 saniye (DOM yolu ~26 saniye)
 *   - Sayfa user'ın açık tab'ında olduğu gibi kalıyor
 *   - Bot algı riski çok daha düşük
 *
 * Hata davranışı:
 *   - Network fail / status !== 200 / response.success !== true → throw
 *   - Caller (executeDescribeJob) yakalayıp DOM fallback'a düşer
 *
 * 3rd-party servis YOK — describe MJ kendi domain'inde, kullanıcının
 * MJ aboneliği yeterli (Pass 67 audit doğrulaması).
 */
export type DescribeApiResult = {
  prompts: string[];
  /** Yüklü görselin MJ tarafındaki URL'i (cdn.midjourney.com/u/...). */
  resolvedImageUrl: string;
  /** Hangi yol kullanıldı: "api". DOM yolu için "dom". */
  method: "api";
};

export async function describeImageViaApi(
  page: Page,
  imageUrl: string,
  options: { fetchTimeoutMs?: number } = {},
): Promise<DescribeApiResult> {
  const fetchTimeoutMs = options.fetchTimeoutMs ?? 60_000;

  // 1) Image URL hazır mı? cdn.midjourney.com / s.mj.run zaten MJ kendi
  // storage'da; upload bypass. Aksi halde upload gerek (Pass 68 V1
  // scope: upload PATH'i implement edilmiş ama bizim use case'imizde
  // (EtsyHub generate çıktıları zaten cdn.midjourney.com'da) upload
  // bypass çalışacak — ekstra HTTP yok).
  //
  // NOT: page.evaluate body'sinde tsx/esbuild "named helper" üretmez
  // (`__name`/`__defProp` Node-side helper'ları sayfa context'ine
  // serialize edilemez); bu yüzden BU HELPER İÇİNDE NAMED INNER
  // FUNCTION YAZMA — sadece arrow body inline expression'lar.
  const resolvedImageUrl = await page.evaluate(
    async (input: { url: string; timeoutMs: number }) => {
      // tsx/esbuild __name helper sayfa context'inde tanımsız;
      // serialize edilirken transformer arada Reference üretiyor.
      // Stub ekle ki "ReferenceError: __name is not defined" gelmesin.
      // (no-op identity function)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).__name = (globalThis as any).__name ?? ((x: unknown) => x);
      const url = input.url;
      const timeoutMs = input.timeoutMs;

      // cdn.midjourney.com veya s.mj.run → upload skip
      if (
        /^https?:\/\/(cdn\.midjourney\.com|s\.mj\.run)\//i.test(url)
      ) {
        return url;
      }

      // Upload gerekli — görseli fetch et → blob → multipart form-data →
      // POST /api/storage-upload-file
      const dlCtrl = new AbortController();
      const dlT = setTimeout(() => dlCtrl.abort(), timeoutMs);
      let dl: Response;
      try {
        dl = await fetch(url, { signal: dlCtrl.signal });
      } finally {
        clearTimeout(dlT);
      }
      if (!dl.ok) {
        throw new Error(`Image fetch ${url} → HTTP ${dl.status}`);
      }
      const blob = await dl.blob();
      const ext =
        blob.type.includes("png")
          ? "png"
          : blob.type.includes("webp")
            ? "webp"
            : "jpg";
      const filename = `describe-source-${Date.now()}.${ext}`;
      const file = new File([blob], filename, {
        type: blob.type || "image/png",
      });
      const fd = new FormData();
      fd.append("file", file);
      const upCtrl = new AbortController();
      const upT = setTimeout(() => upCtrl.abort(), timeoutMs);
      let up: Response;
      try {
        up = await fetch(
          `${window.location.origin}/api/storage-upload-file`,
          {
            method: "POST",
            headers: {
              "X-Csrf-Protection": "1",
              // version header eklenti capture'ında görüldü; MJ tarafı
              // string '2' bekliyor (live capture).
              version: "2",
            },
            credentials: "include",
            body: fd,
            signal: upCtrl.signal,
          },
        );
      } finally {
        clearTimeout(upT);
      }
      if (!up.ok) {
        throw new Error(
          `Upload fail ${up.status}: ${(await up.text()).slice(0, 200)}`,
        );
      }
      const upJson = (await up.json()) as {
        shortUrl?: string;
        bucketPathname?: string;
      };
      if (!upJson.bucketPathname) {
        throw new Error(
          `Upload response: bucketPathname yok — ${JSON.stringify(upJson).slice(0, 200)}`,
        );
      }
      // bucketPathname = "<userId>/<sha>.jpg" → cdn URL
      return `https://cdn.midjourney.com/u/${upJson.bucketPathname}`;
    },
    { url: imageUrl, timeoutMs: fetchTimeoutMs },
  );

  // 2) /api/describe çağrısı (synchronous — polling yok)
  const result = await page.evaluate(
    async (input: { url: string; timeoutMs: number }) => {
      // tsx/esbuild __name helper stub
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).__name = (globalThis as any).__name ?? ((x: unknown) => x);
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), input.timeoutMs);
      try {
        const res = await fetch(`${window.location.origin}/api/describe`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Csrf-Protection": "1",
          },
          credentials: "include",
          body: JSON.stringify({
            image_url: input.url,
            channelId: "picread",
          }),
          signal: ctrl.signal,
        });
        const text = await res.text();
        return { status: res.status, ok: res.ok, body: text };
      } finally {
        clearTimeout(t);
      }
    },
    { url: resolvedImageUrl, timeoutMs: fetchTimeoutMs },
  );

  if (!result.ok) {
    throw new Error(
      `/api/describe HTTP ${result.status}: ${result.body.slice(0, 200)}`,
    );
  }

  let parsed: { success?: boolean; data?: { descriptions?: string[] } };
  try {
    parsed = JSON.parse(result.body);
  } catch {
    throw new Error(
      `/api/describe JSON parse fail: ${result.body.slice(0, 200)}`,
    );
  }
  if (!parsed.success || !Array.isArray(parsed.data?.descriptions)) {
    throw new Error(
      `/api/describe success=false veya descriptions array değil: ${result.body.slice(0, 200)}`,
    );
  }
  const prompts = parsed.data.descriptions.filter(
    (p): p is string => typeof p === "string" && p.trim().length > 0,
  );
  if (prompts.length < 1) {
    throw new Error(
      `/api/describe descriptions array boş: ${result.body.slice(0, 200)}`,
    );
  }

  return { prompts, resolvedImageUrl, method: "api" };
}

/**
 * Pass 66 — Describe akışı (MJ V8 web) — DOM fallback.
 *
 * Pass 65 audit "describe yok" sonucu YANLIŞTI — kullanıcı ekran görüntüleri
 * (Desktop/describe_three-dots.png + describe_surukle_bırak.png) ve canlı
 * probe'lar gösterdi:
 *   1. Drop zone synthetic event'leri trust filtreliyor → güvenilmez
 *   2. **Three-dots menü %100 çalışıyor**: yüklü thumbnail HOVER → vertical
 *      dots tıkla → "Describe" menü öğesi → 4 prompt aynı sayfada inline
 *
 * Pass 68'den itibaren bu helper SADECE FALLBACK olarak kullanılır.
 * Birincil yol `describeImageViaApi` (yukarıda).
 *
 * Akış:
 *   1. Add Images popover aç (idempotent) + Image Prompts tab seç
 *   2. URL'den image indir (Pass 49 yeni-tab pattern; CF-safe)
 *   3. setInputFiles ile yükle
 *   4. Yüklü thumbnail koordinatını bul (s.mj.run thumbnail src pattern)
 *   5. Thumbnail'e mouse hover (vertical-dots butonu hover-state'te görünür)
 *   6. Vertical-dots SVG path'iyle butonu bul (thumbnail img'den DOM
 *      ata-traverse) ve tıkla → dropdown menü açılır
 *   7. "Describe" menü öğesini tıkla
 *   8. 4 prompt önerisi inline gelene kadar bekle (60sn)
 *   9. `<p>` tag'lerinden prompt'ları scrape (MJ-flag içeren, dedupe)
 *
 * Çıktı: 4 prompt string. Caller (job manager) bunları
 * `mjMetadata.describePrompts[]` olarak kaydeder.
 */
export async function describeImage(
  page: Page,
  selectors: Record<MJSelectorKey, string>,
  imageUrl: string,
  options: { resultTimeoutMs?: number } = {},
): Promise<{ prompts: string[]; thumbSrc: string }> {
  const resultTimeoutMs = options.resultTimeoutMs ?? 90_000;

  // 1) Add Images popover idempotent open
  let fileInput = page.locator(selectors.addImagesFileInput).first();
  let alreadyOpen = false;
  try {
    await fileInput.waitFor({ state: "attached", timeout: 500 });
    alreadyOpen = true;
  } catch {
    alreadyOpen = false;
  }
  if (!alreadyOpen) {
    const addBtn = page.locator(selectors.addImagesButton).first();
    const visible = await addBtn
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    if (!visible) {
      throw new SelectorMismatchError(
        "addImagesButton",
        selectors.addImagesButton,
      );
    }
    await addBtn.click();
    await page.waitForTimeout(1500);
    fileInput = page.locator(selectors.addImagesFileInput).first();
    try {
      await fileInput.waitFor({ state: "attached", timeout: 8_000 });
    } catch {
      throw new SelectorMismatchError(
        "addImagesFileInput",
        selectors.addImagesFileInput,
      );
    }
  }

  // 2) Image Prompts tab seç (Start Frame değil — describe için image
  // tipi prompt slot'a yüklenir; tab seçimi describe sonucunu etkilemez
  // ama Start Frame'de yüklü görsel three-dots menüsü farklı olabilir;
  // Image Prompts en güvenilir).
  const tab = page.locator(selectors.addImagesTabImagePrompts).first();
  try {
    await tab.waitFor({ state: "visible", timeout: 5_000 });
    await tab.click({ timeout: 5_000, force: true });
    await page.waitForTimeout(500);
  } catch {
    throw new SelectorMismatchError(
      "addImagesTabImagePrompts",
      selectors.addImagesTabImagePrompts,
    );
  }

  // 3) URL'den image indir (Pass 49 pattern: yeni tab + page.goto;
  // CF korumalı endpoint'lerde ctx.request.get 403 döner)
  const ctx = page.context();
  const dlPage = await ctx.newPage();
  let buf: Buffer;
  let mime = "image/png";
  try {
    const resp = await dlPage.goto(imageUrl, {
      waitUntil: "load",
      timeout: 30_000,
    });
    if (!resp || !resp.ok()) {
      throw new Error(
        `Describe image fetch ${imageUrl} → HTTP ${resp?.status() ?? "no resp"}`,
      );
    }
    buf = Buffer.from(await resp.body());
    const ct = resp.headers()["content-type"]?.split(";")[0]?.trim();
    if (ct && /^image\//.test(ct)) mime = ct;
  } finally {
    await dlPage.close().catch(() => undefined);
  }
  // Magic bytes fallback (Content-Type yoksa)
  if (mime === "image/png") {
    if (buf[0] === 0xff && buf[1] === 0xd8) mime = "image/jpeg";
    else if (
      buf[0] === 0x52 &&
      buf[1] === 0x49 &&
      buf[2] === 0x46 &&
      buf[3] === 0x46
    )
      mime = "image/webp";
  }
  const ext =
    mime === "image/jpeg"
      ? "jpg"
      : mime === "image/webp"
        ? "webp"
        : "png";

  // 4) setInputFiles
  await fileInput.setInputFiles({
    name: `describe-source.${ext}`,
    mimeType: mime,
    buffer: buf,
  });
  // MJ React state'in image'ı işlemesi + popover'da thumbnail'in
  // belirmesi için bekleme. Probe gözlemi: 2.5sn yeterli.
  await page.waitForTimeout(3000);

  // 5) Yüklü thumbnail'i bul. Probe v2/v3 öğrenmesi: yeni yüklenen image
  // popover'da `s.mj.run/<id>?thumb=true` URL pattern'iyle 48-64×48-64
  // boyutunda görünür (cdn.midjourney.com değil — MJ kendi proxy'sine
  // upload eder ve `s.mj.run` ile expose eder).
  const thumb = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll("img"))
      .filter((img) => {
        const r = img.getBoundingClientRect();
        const src = img.getAttribute("src") ?? "";
        return (
          /s\.mj\.run\/[^?]+(\?|$)/.test(src) &&
          r.width >= 30 &&
          r.width <= 100
        );
      })
      .sort((a, b) => {
        // En son eklenen genelde en altta/sağda
        const ar = a.getBoundingClientRect();
        const br = b.getBoundingClientRect();
        return br.y - ar.y || br.x - ar.x;
      });
    if (imgs.length === 0) return null;
    const r = imgs[0]!.getBoundingClientRect();
    return {
      src: imgs[0]!.getAttribute("src") ?? "",
      cx: r.x + r.width / 2,
      cy: r.y + r.height / 2,
    };
  });
  if (!thumb) {
    throw new Error(
      "Describe yüklü thumbnail bulunamadı (s.mj.run pattern eşleşmedi)",
    );
  }

  // 6) Hover thumbnail (vertical-dots hover-state'te görünür hale gelir)
  await page.mouse.move(thumb.cx, thumb.cy);
  await page.waitForTimeout(800);

  // 7) Vertical-dots butonunu bul ve tıkla. Strategy: thumbnail img'den
  // DOM ata traverse (climbDepth max 8); fallback en yakın koordinattaki
  // dots-path'li button.
  const dotsClicked = await page.evaluate((thumbSrc: string) => {
    const img = Array.from(document.querySelectorAll("img")).find(
      (i) => i.getAttribute("src") === thumbSrc,
    );
    if (!img) return { ok: false, reason: "thumb img not found" };
    let cur: HTMLElement | null = img.parentElement;
    for (let i = 0; i < 8 && cur; i++) {
      const buttons = Array.from(cur.querySelectorAll("button"));
      for (const b of buttons) {
        const path = b.querySelector("svg path");
        const d = path?.getAttribute("d") ?? "";
        if (
          /M12\s*5v\.?01.*M12\s*12v\.?01.*M12\s*19v\.?01/.test(d)
        ) {
          (b as HTMLElement).click();
          return { ok: true, climbDepth: i };
        }
      }
      cur = cur.parentElement;
    }
    // Fallback: tüm sayfada thumbnail rect'ine en yakın
    const tr = img.getBoundingClientRect();
    const candidates = Array.from(document.querySelectorAll("button"))
      .filter((b) => {
        const d = b.querySelector("svg path")?.getAttribute("d") ?? "";
        return /M12\s*5v\.?01.*M12\s*12v\.?01.*M12\s*19v\.?01/.test(d);
      })
      .map((b) => {
        const r = b.getBoundingClientRect();
        return {
          btn: b as HTMLElement,
          dist: Math.hypot(
            r.x + r.width / 2 - (tr.x + tr.width / 2),
            r.y + r.height / 2 - (tr.y + tr.height / 2),
          ),
        };
      })
      .sort((a, b) => a.dist - b.dist);
    if (candidates.length > 0 && candidates[0]!.dist < 200) {
      candidates[0]!.btn.click();
      return { ok: true, fallback: true };
    }
    return { ok: false, reason: "no dots btn near thumb" };
  }, thumb.src);
  if (!dotsClicked.ok) {
    throw new SelectorMismatchError(
      "thumbnailMenuVerticalDots",
      selectors.thumbnailMenuVerticalDots,
    );
  }
  await page.waitForTimeout(800);

  // 8) "Describe" menü öğesini tıkla
  const describeMenuItem = page.locator(selectors.menuItemDescribe).first();
  try {
    await describeMenuItem.waitFor({ state: "visible", timeout: 5_000 });
    await describeMenuItem.click({ timeout: 5_000 });
  } catch {
    throw new SelectorMismatchError(
      "menuItemDescribe",
      selectors.menuItemDescribe,
    );
  }

  // 9) 4 prompt sonucu beklenir (inline aynı sayfada). MJ describe
  // tipik olarak 4 farklı prompt önerisi üretir; her birinin sonunda
  // `--ar W:H` flag'i bulunur. Probe v3'ün gerçek çıktısı: her prompt
  // hem `<div>` hem `<p>` olarak iki kere geçiyor (dedupe gerek).
  const startedAt = Date.now();
  let prompts: string[] = [];
  while (Date.now() - startedAt < resultTimeoutMs) {
    await page.waitForTimeout(2000);
    const found = await page.evaluate(() => {
      const seen = new Set<string>();
      const out: string[] = [];
      const candidates = Array.from(document.querySelectorAll("p"));
      for (const el of candidates) {
        if (el.children.length > 1) continue;
        const t = (el.textContent ?? "").trim();
        if (t.length < 60 || t.length > 1500) continue;
        // MJ describe çıktısı genelde `--ar W:H` ile biter.
        if (!/--ar\s+\d+:\d+/.test(t)) continue;
        if (seen.has(t)) continue;
        seen.add(t);
        out.push(t);
      }
      return out;
    });
    if (found.length >= 4) {
      prompts = found.slice(0, 4);
      break;
    }
  }
  if (prompts.length < 4) {
    throw new Error(
      `Describe sonucu timeout: ${resultTimeoutMs / 1000}s içinde 4 prompt bulunamadı (gelen: ${prompts.length})`,
    );
  }

  return { prompts, thumbSrc: thumb.src };
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

/**
 * Pass 65 — Image-prompt attachment (MJ V8 web).
 *
 * MJ V8 web'de prompt textarea'ya URL paste ETMEK image-prompt'a dönüşmüyor
 * (Pass 65 audit canlı doğrulama). Gerçek yol: imagine bar yanındaki
 * "Add Images" butonuna tıkla → popover açıl → file input'a image
 * buffer'larını set et → popover'ı kapatmaya GEREK YOK (file ilave
 * edildikten sonra arka planda persist olur, prompt submit'te image-prompt
 * olarak job'a eklenir).
 *
 * URL'den indirme: bridge `page.context().request` API'si — auth/cookie
 * gerektirmez (R17.2 contract: HTTPS public URL only). Indirilen buffer
 * `setInputFiles` ile file input'a yazılır (Playwright accepts buffer
 * via {name, mimeType, buffer} payload).
 *
 * Hata davranışı:
 *   • addImagesButton görünmüyor → SelectorMismatchError("addImagesButton")
 *   • file input set edilemiyor → SelectorMismatchError("addImagesFileInput")
 *   • URL fetch fail → throw Error (caller blockReason="internal-error")
 */
export async function attachImagePrompts(
  page: Page,
  selectors: Record<MJSelectorKey, string>,
  imageUrls: string[],
  options: { perImageTimeoutMs?: number } = {},
): Promise<{ attachedCount: number }> {
  if (imageUrls.length === 0) return { attachedCount: 0 };
  const perImageTimeoutMs = options.perImageTimeoutMs ?? 15_000;

  // Idempotent open: File input zaten DOM'da varsa popover hâlâ açık;
  // tekrar tıklamak popover'ı KAPATIR. Önce var mı kontrol et.
  let fileInput = page.locator(selectors.addImagesFileInput).first();
  let alreadyOpen = false;
  try {
    await fileInput.waitFor({ state: "attached", timeout: 500 });
    alreadyOpen = true;
  } catch {
    alreadyOpen = false;
  }

  if (!alreadyOpen) {
    // 1) Add Images popover'ını aç.
    const addBtn = page.locator(selectors.addImagesButton).first();
    const visible = await addBtn
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    if (!visible) {
      throw new SelectorMismatchError(
        "addImagesButton",
        selectors.addImagesButton,
      );
    }
    await addBtn.click();
    // Popover'ın render olması için bekleme — file input lazy mount.
    // Pass 65 audit: 1500ms typical; 3000ms üstü güvenlik payı.
    await page.waitForTimeout(1500);
    fileInput = page.locator(selectors.addImagesFileInput).first();
    try {
      await fileInput.waitFor({ state: "attached", timeout: 8_000 });
    } catch {
      throw new SelectorMismatchError(
        "addImagesFileInput",
        selectors.addImagesFileInput,
      );
    }
  }

  // Pass 65 v2 — "Image Prompts" tab'ını seç. DEFAULT AÇILIŞTA "Start Frame"
  // (animate için video) seçili; tab seçimi yapılmazsa upload Start Frame
  // slot'una düşer ve render-timeout olur (kullanıcı feedback Pass 65
  // smoke v1). Pattern Pass 60 Upscale/Vary stratejisinin aynısı:
  // outer container'a click (force=true ile inner overlay'leri bypass).
  const imagePromptsTab = page
    .locator(selectors.addImagesTabImagePrompts)
    .first();
  try {
    await imagePromptsTab.waitFor({ state: "visible", timeout: 5_000 });
    await imagePromptsTab.click({ timeout: 5_000, force: true });
    // Tab seçiminin DOM state'ine işlemesi için kısa bekleme.
    await page.waitForTimeout(500);
  } catch {
    throw new SelectorMismatchError(
      "addImagesTabImagePrompts",
      selectors.addImagesTabImagePrompts,
    );
  }

  // 3) URL'leri buffer'a indir + setInputFiles ile yükle.
  //
  // Pass 49 audit'inden öğrenme: CF korumalı endpoint'ler (cdn.midjourney.com,
  // bazı CDN'ler) Playwright APIRequestContext (`ctx.request.get`) request'lerini
  // BOT olarak görüp 403 döner. Çözüm: yeni tab aç + `page.goto` ile indir.
  // Browser'ın gerçek navigation request'inde TLS fingerprint + tüm header
  // set'i tam — CF challenge tetiklenmez.
  //
  // downloadGridImages aynı pattern'i kullanır (Pass 49+).
  const ctx = page.context();
  const filePayloads: Array<{
    name: string;
    mimeType: string;
    buffer: Buffer;
  }> = [];
  for (const url of imageUrls) {
    const dlPage = await ctx.newPage();
    let buf: Buffer | null = null;
    let mime: string | undefined;
    try {
      const resp = await dlPage.goto(url, {
        waitUntil: "load",
        timeout: perImageTimeoutMs,
      });
      if (!resp || !resp.ok()) {
        throw new Error(
          `Image-prompt URL fetch ${url} → HTTP ${resp?.status() ?? "no response"}`,
        );
      }
      buf = Buffer.from(await resp.body());
      mime = resp.headers()["content-type"]?.split(";")[0]?.trim();
    } finally {
      await dlPage.close().catch(() => undefined);
    }
    if (!buf) {
      throw new Error(`Image-prompt URL fetch ${url} → no body`);
    }
    if (!mime || !/^image\//.test(mime)) {
      // Magic bytes fallback
      if (buf[0] === 0x89 && buf[1] === 0x50) mime = "image/png";
      else if (buf[0] === 0xff && buf[1] === 0xd8) mime = "image/jpeg";
      else if (
        buf[0] === 0x52 &&
        buf[1] === 0x49 &&
        buf[2] === 0x46 &&
        buf[3] === 0x46
      )
        mime = "image/webp";
      else mime = "image/png";
    }
    const ext =
      mime === "image/jpeg"
        ? "jpg"
        : mime === "image/webp"
          ? "webp"
          : "png";
    // Filename — MJ side'da log'a yansır; URL'den son segment.
    const tail =
      url.split("/").pop()?.split("?")[0]?.slice(0, 60) ?? `ref.${ext}`;
    const name = /\.[a-z0-9]{2,5}$/i.test(tail) ? tail : `${tail}.${ext}`;
    filePayloads.push({ name, mimeType: mime, buffer: buf });
  }

  // setInputFiles tek seferde tüm payload'ları kabul eder (multiple).
  await fileInput.setInputFiles(filePayloads);

  // MJ React app'inin file'ı state'e işlemesi için kısa buffer.
  await page.waitForTimeout(1_500);

  return { attachedCount: filePayloads.length };
}

/**
 * Pass 71 — Generate via MJ internal API (eklentiden öğrenildi,
 * Pass 69 live capture ile contract çıkartıldı).
 *
 * Pass 69 capture (kullanıcı MJ tab'ında "pass69 audit test minimal"
 * + Enter):
 *   POST https://www.midjourney.com/api/submit-jobs
 *   Headers: X-Csrf-Protection: 1, Content-Type: application/json
 *   Body: {
 *     f: { mode: "relaxed" | "fast", private: false },
 *     channelId: "singleplayer_<userId>",
 *     metadata: { isMobile, imagePrompts, imageReferences,
 *                 characterReferences, depthReferences, lightboxOpen },
 *     t: "imagine",
 *     prompt: "..."
 *   }
 *   Response (sync): { success: [{ job_id, prompt, batch_size, ... }],
 *                      failure: [] }
 *
 * Pass 71 ek keşif: window.mjUserDefer.promise (sayfa-state'inde MJ
 * kullanıcının kendi user objesi: { id, name, email, ... }). channelId
 * = "singleplayer_${user.id}". /api/auth/session bu kullanıcıyı
 * vermiyor (401), ama mjUserDefer cookie session'ından yine kendisi
 * resolve ediyor. Bu sayfa zaten authenticated olduğu için stable.
 *
 * Avantajlar (DOM submit'e göre):
 *   - DOM typing yok (60+ char × 50ms ≈ 3-5sn kazanım)
 *   - Synchronous job_id response → waitForRender targetMjJobId
 *     optimizasyonu (Pass 71) ile baseline UUID gereksiz
 *   - image-prompt'lı job'larda Pass 65 baseline stuck bug bypass
 *   - Görünmez (sayfa user'ın açık tab'ında değişmiyor)
 *
 * Hata davranışı:
 *   - mjUserDefer çözülmediyse / userId yoksa → throw (caller fallback'a
 *     düşer)
 *   - HTTP non-200 / response.failure[].length > 0 → throw
 *   - Network fail → throw
 */
export type SubmitPromptApiResult = {
  /** MJ tarafı job UUID — `cdn.midjourney.com/<jobId>/...` URL pattern'i. */
  mjJobId: string;
  /** MJ tarafı parse ettiği prompt (--v 7 vs gibi MJ tarafı eklemeleri görünür). */
  mjPrompt: string;
  /** Submit eden user'ın MJ id'si (channelId resolution için kullanıldı). */
  userId: string;
  /** Method işareti — caller mjMetadata'da işaret eder. */
  method: "api";
};

export async function submitPromptViaApi(
  page: Page,
  promptString: string,
  options: {
    /** Pass 71 — relaxed (free) / fast (paid) mode. Default "relaxed". */
    mode?: "relaxed" | "fast";
    /** Pass 71 — image prompt sayısı (metadata.imagePrompts). 0 default. */
    imagePromptCount?: number;
    /** sref count (metadata.imageReferences). 0 default. */
    imageReferenceCount?: number;
    /** cref count (metadata.characterReferences). 0 default. */
    characterReferenceCount?: number;
    /** Network/page.evaluate timeout. Default 30sn. */
    fetchTimeoutMs?: number;
  } = {},
): Promise<SubmitPromptApiResult> {
  const fetchTimeoutMs = options.fetchTimeoutMs ?? 30_000;
  const mode = options.mode ?? "relaxed";
  const imagePromptCount = options.imagePromptCount ?? 0;
  const imageReferenceCount = options.imageReferenceCount ?? 0;
  const characterReferenceCount = options.characterReferenceCount ?? 0;

  const result = await page.evaluate(
    async (input: {
      promptString: string;
      mode: "relaxed" | "fast";
      imagePromptCount: number;
      imageReferenceCount: number;
      characterReferenceCount: number;
      timeoutMs: number;
    }) => {
      // tsx/esbuild __name helper stub (Pass 68 keşfi).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).__name = (globalThis as any).__name ?? ((x: unknown) => x);
      // 1) Sayfa state'inden user resolution. mjUserDefer.promise sayfa
      // hidratlandıktan sonra MJ kullanıcı user objesi döner.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const defer = (window as any).mjUserDefer;
      if (!defer || typeof defer.promise?.then !== "function") {
        throw new Error(
          "window.mjUserDefer yok — MJ sayfa state'i hazır değil",
        );
      }
      const userPromise: Promise<{ id?: string }> = defer.promise;
      let user: { id?: string };
      try {
        user = await Promise.race([
          userPromise,
          new Promise<{ id?: string }>((_, rej) =>
            setTimeout(() => rej(new Error("mjUserDefer timeout 8sn")), 8000),
          ),
        ]);
      } catch (err) {
        throw new Error(
          `mjUserDefer resolve fail: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      const userId = user?.id;
      if (typeof userId !== "string" || userId.length === 0) {
        throw new Error("mjUserDefer.promise resolved ama user.id boş");
      }
      // 2) Submit fetch
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), input.timeoutMs);
      try {
        const res = await fetch(`${window.location.origin}/api/submit-jobs`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Csrf-Protection": "1",
          },
          credentials: "include",
          body: JSON.stringify({
            f: { mode: input.mode, private: false },
            channelId: `singleplayer_${userId}`,
            metadata: {
              isMobile: null,
              imagePrompts: input.imagePromptCount,
              imageReferences: input.imageReferenceCount,
              characterReferences: input.characterReferenceCount,
              depthReferences: 0,
              lightboxOpen: null,
            },
            t: "imagine",
            prompt: input.promptString,
          }),
          signal: ctrl.signal,
        });
        const text = await res.text();
        return { ok: res.ok, status: res.status, body: text, userId };
      } finally {
        clearTimeout(t);
      }
    },
    {
      promptString,
      mode,
      imagePromptCount,
      imageReferenceCount,
      characterReferenceCount,
      timeoutMs: fetchTimeoutMs,
    },
  );

  if (!result.ok) {
    throw new Error(
      `/api/submit-jobs HTTP ${result.status}: ${result.body.slice(0, 300)}`,
    );
  }
  let parsed: {
    success?: Array<{ job_id?: string; prompt?: string }>;
    failure?: Array<{ reason?: string; error?: string }>;
  };
  try {
    parsed = JSON.parse(result.body);
  } catch {
    throw new Error(
      `/api/submit-jobs JSON parse fail: ${result.body.slice(0, 300)}`,
    );
  }
  if (parsed.failure && parsed.failure.length > 0) {
    throw new Error(
      `/api/submit-jobs failure[]: ${JSON.stringify(parsed.failure).slice(0, 300)}`,
    );
  }
  const success = parsed.success?.[0];
  if (!success || typeof success.job_id !== "string") {
    throw new Error(
      `/api/submit-jobs success[].job_id beklenmiyor: ${result.body.slice(0, 300)}`,
    );
  }
  return {
    mjJobId: success.job_id,
    mjPrompt: success.prompt ?? promptString,
    userId: result.userId,
    method: "api",
  };
}

/**
 * Pass 72 — Job render tamamlanma polling'i (DOM-bağımsız).
 *
 * Pass 71 ghost-job kök neden tespiti:
 *   - API submit (`POST /api/submit-jobs`) MJ tarafında job kabul + render
 *     ediyor (Pass 72 audit: Pass 71 stuck UUID'lerin `cdn.midjourney.com`
 *     image'ları 200 OK)
 *   - AMA kullanıcının açık MJ tab'ı kendi optimistic state'ini
 *     güncellemediği için yeni job'u bilmiyor → DOM'a hiç yansımıyor
 *   - Pass 71 `waitForRender targetMjJobId` DOM-bağımlı, yakalayamıyor
 *
 * Pass 72 çözümü: **CDN HEAD polling**. MJ render bittiğinde
 * `cdn.midjourney.com/<jobId>/0_<n>_640_N.webp` (preview webp) erişilebilir.
 *
 * NOT: Pass 72 ilk denemesi `/api/get-seed?id=<jobId>` polling'i denedi.
 * Bu endpoint kabul edilen job için seed döner AMA render tamamlanma
 * sinyali DEĞİL — submit edildiği anda seed pre-allocate ediliyor; image
 * CDN'e push edilmemiş olabilir. Bu yüzden CDN HEAD daha güvenilir
 * sinyal: image gerçekten erişilebilir olduğunda 200 döner.
 *
 * Hata davranışı:
 *   - Network fail → caller'a yansıt
 *   - timeout → throw "render-timeout"
 */
export type WaitForJobApiResult = {
  mjJobId: string;
  /** Pass 72 — tutarlı imageUrls dönüş tipi (RenderResult ile uyum). */
  imageUrls: string[];
};

export async function waitForJobReadyViaApi(
  page: Page,
  mjJobId: string,
  options: {
    timeoutMs: number;
    pollIntervalMs?: number;
    onPoll?: (elapsedMs: number, status: string) => void;
  },
): Promise<WaitForJobApiResult> {
  const start = Date.now();
  const interval = options.pollIntervalMs ?? 4000;
  // 4 grid index'inin hepsi mevcut olduğunda render tamamlanmış sayılır.
  // İlk grid (0_0) tipik olarak diğerlerinden 1-2sn önce CDN'e push edilir;
  // hepsini beklemek tutarlı bir tamamlanma sinyali.
  const indices = [0, 1, 2, 3];

  while (Date.now() - start < options.timeoutMs) {
    const probe = await page.evaluate(
      async (input: { jobId: string; indices: number[]; timeoutMs: number }) => {
        // tsx/esbuild __name helper stub (Pass 68 keşfi)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).__name = (globalThis as any).__name ?? ((x: unknown) => x);
        const checks: Array<{ idx: number; status: number }> = [];
        for (const n of input.indices) {
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), input.timeoutMs);
          try {
            const r = await fetch(
              `https://cdn.midjourney.com/${input.jobId}/0_${n}_640_N.webp`,
              { method: "HEAD", signal: ctrl.signal },
            );
            checks.push({ idx: n, status: r.status });
          } catch {
            checks.push({ idx: n, status: 0 });
          } finally {
            clearTimeout(t);
          }
        }
        return checks;
      },
      { jobId: mjJobId, indices, timeoutMs: 8_000 },
    );
    const ready = probe.filter((p) => p.status === 200).length;
    if (options.onPoll) {
      options.onPoll(
        Date.now() - start,
        ready === indices.length ? "READY" : `${ready}/${indices.length}`,
      );
    }
    if (ready === indices.length) {
      // Render hazır — CDN URL'leri inşa et.
      //
      // Pass 72 audit (live probe): MJ /jobs/<id> route'unu fetch ettim,
      // HTML'de servis edilen tek URL pattern:
      //   cdn.midjourney.com/<jobId>/0_<n>_640_N.webp (640px preview)
      // Yeni job'larda full-res `0_<n>.png` mevcut DEĞİL (404).
      //
      // imageUrls[] => webp preview URL'leri. Caller (executeJob) bu
      // URL'leri downloadGridImages helper'ına geçirir; helper yeni-tab
      // + page.goto ile bytes alır (Pass 49 pattern, CF-safe).
      const imageUrls = indices.map(
        (n) => `https://cdn.midjourney.com/${mjJobId}/0_${n}_640_N.webp`,
      );
      return { mjJobId, imageUrls };
    }
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error(
    `CDN polling timeout (${options.timeoutMs}ms): Job ${mjJobId} 4 grid hazır olmadı`,
  );
}

/**
 * Pass 72 — CDN'den direkt grid image bytes indirme (DOM-bağımsız).
 *
 * Pass 49 download pattern'i (yeni tab + page.goto, CF-safe + cookie
 * paylaşımı) kullanılır. waitForJobReadyViaApi sonrası `imageUrls`
 * (4 entry, `cdn.midjourney.com/<jobId>/0_<n>.png`) ile çağrılır.
 *
 * Eski `downloadGridImages` aynı işi yapıyor zaten (pure URL bazlı);
 * Pass 72 tutarlı API yüzeyi için yeni isim altında reuse edilir.
 */

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
    /**
     * Pass 71 — bilinen target MJ job UUID. API-first submit
     * (`POST /api/submit-jobs` response → `job_id`) bu UUID'yi sağlar
     * ve render polling sadece bu UUID için 4 grid bekler. Baseline
     * gereksiz hale gelir; image-prompt'ta yaşanan stuck bug
     * (Pass 65'ten devralınmıştı) bu yolla çözülür.
     */
    targetMjJobId?: string;
    timeoutMs: number;
    pollIntervalMs?: number;
    onPoll?: (elapsedMs: number, newImageCount: number) => void;
  },
): Promise<RenderResult> {
  const start = Date.now();
  const interval = options.pollIntervalMs ?? 3000;
  const baseline = options.baselineUuids ?? new Set<string>();
  const target = options.targetMjJobId?.toLowerCase();

  while (Date.now() - start < options.timeoutMs) {
    const imgs = await collectCdnImages(page, selectors);
    // Pass 71 — Target UUID modu: bilinen job_id varsa o UUID için
    // 4 grid bekle (baseline ignore). API-first submit'ten sonra
    // submit response'undan gelen job_id geçirilir.
    if (target) {
      const gridMap = new Map<number, string>();
      for (const img of imgs) {
        if (img.uuid.toLowerCase() === target && img.outerIdx === 0) {
          gridMap.set(img.gridIdx, img.url);
        }
      }
      if (options.onPoll) options.onPoll(Date.now() - start, gridMap.size);
      if (
        gridMap.has(0) &&
        gridMap.has(1) &&
        gridMap.has(2) &&
        gridMap.has(3)
      ) {
        return {
          jobCardSelector: selectors.renderImage,
          mjJobId: options.targetMjJobId!,
          imageUrls: [0, 1, 2, 3].map((g) => gridMap.get(g)!),
        };
      }
      await new Promise((r) => setTimeout(r, interval));
      continue;
    }
    // Klasik baseline modu (DOM submit yolu için).
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
    target
      ? `Render timeout (${options.timeoutMs}ms) — target UUID ${target} için 4 grid image bulunamadı`
      : `Render timeout (${options.timeoutMs}ms) — yeni UUID için 4 grid image bulunamadı`,
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
