// Pass 43 — MJ web DOM selector kontratı.
//
// Bu dosya MJ web UI'sının değişimine en kırılgan parçadır. Selector'lar:
//   1. Tek dosyada toplandı (Pass 41 doc §8.1)
//   2. ARIA-based ve text-based çoklu fallback (DOM yapısı değişimine
//      dayanıklı)
//   3. Config-driven: kullanıcı `MJ_SELECTOR_OVERRIDES` env'iyle JSON
//      verirse runtime'da merge edilir (üyelik aldıktan sonra
//      kalibre etmek için)
//   4. Boot-time smoke: real driver başlatıldığında ana sayfada
//      `promptInput` bulunabiliyor mu kontrol eder; yoksa selector
//      versiyonu uyumsuz hata verir (sessiz fail değil)
//
// Selector'lar Playwright'ın **CSS + :has + :has-text** sözdizimine
// uyar (https://playwright.dev/docs/selectors). Birden fazla candidate
// virgülle "veya" anlamı taşır — Playwright ilk eşleşeni seçer.

export type MJSelectorKey =
  | "promptInput"
  | "submitButton"
  | "renderGrid"
  | "renderJobCard"
  | "renderImage"
  | "upscaleU1"
  | "upscaleU2"
  | "upscaleU3"
  | "upscaleU4"
  | "variationV1"
  | "variationV2"
  | "variationV3"
  | "variationV4"
  | "cloudflareChallenge"
  | "hcaptchaChallenge"
  | "loginIndicator"
  | "signInLink"
  | "userAvatar";

/**
 * Default selector seti — MJ V8 Alpha + V7 web UI gözlem ve docs (2026
 * Mayıs). Üyelik aldıktan sonra ilk gerçek kalibre edilen tur'da
 * güncellenir.
 *
 * Sözleşme:
 *   • virgülle ayrılmış candidate'lar — Playwright ilk eşleşeni seçer
 *   • ARIA / role / aria-label öncelikli (DOM yapı değişimine dayanıklı)
 *   • :has-text ikinci tercih (i18n'a duyarlı; MJ default English)
 */
export const DEFAULT_SELECTORS: Record<MJSelectorKey, string> = {
  // Imagine bar / prompt input. MJ docs "Imagine bar" der.
  // Adaylar: textarea[placeholder*="prompt"] | role=textbox aria-label
  // | id="imagine-bar".
  promptInput:
    'textarea[placeholder*="prompt" i], ' +
    '[role="textbox"][aria-label*="prompt" i], ' +
    'textarea[aria-label*="imagine" i], ' +
    '#imagine-bar textarea, ' +
    'textarea[name="prompt"]',

  // Submit button — Imagine bar'ın yanında. Genelde icon button.
  // Ana yol Enter tuşu (MJ docs); fallback olarak buton.
  submitButton:
    'button[aria-label*="submit" i], ' +
    'button[aria-label*="generate" i], ' +
    'button[aria-label*="send" i], ' +
    'button[type="submit"]',

  // Render grid container — yeni job render edildiğinde DOM'a eklenen
  // kart. Adaylar: data-job-id attr | class*="job" | role grid.
  renderGrid:
    '[data-job-id], ' +
    '[data-testid*="job" i], ' +
    'div[class*="job-card" i], ' +
    'article[class*="job" i]',

  // Tek job kartı — render grid içinde. UpscaleU1...U4 + variation
  // V1...V4 butonları bu kartın içinde.
  renderJobCard:
    '[data-job-id], ' +
    '[data-testid*="job-result" i], ' +
    'article[class*="job" i]',

  // Job kartı içindeki 4 grid image. Render tamamlandığında 4 thumbnail
  // gösterilir.
  renderImage:
    'img[src*="midjourney" i], ' +
    'img[data-testid*="grid" i], ' +
    '[data-testid*="image-result" i] img, ' +
    'img[alt*="generated" i]',

  // Upscale U1-U4 butonları — render tamamlanan job kartının altında.
  // MJ V7+ "Upscale (Subtle)" / "Upscale (Creative)" varyantları.
  upscaleU1: 'button[aria-label*="U1" i], button[aria-label*="upscale 1" i]',
  upscaleU2: 'button[aria-label*="U2" i], button[aria-label*="upscale 2" i]',
  upscaleU3: 'button[aria-label*="U3" i], button[aria-label*="upscale 3" i]',
  upscaleU4: 'button[aria-label*="U4" i], button[aria-label*="upscale 4" i]',

  // Variation V1-V4 butonları.
  variationV1:
    'button[aria-label*="V1" i], button[aria-label*="variation 1" i]',
  variationV2:
    'button[aria-label*="V2" i], button[aria-label*="variation 2" i]',
  variationV3:
    'button[aria-label*="V3" i], button[aria-label*="variation 3" i]',
  variationV4:
    'button[aria-label*="V4" i], button[aria-label*="variation 4" i]',

  // Cloudflare challenge iframe — URL pattern kontrol.
  cloudflareChallenge: 'iframe[src*="challenges.cloudflare.com"]',

  // hCaptcha challenge iframe.
  hcaptchaChallenge: 'iframe[src*="hcaptcha.com"]',

  // Login indicator — kullanıcı oturumu olduğunu gösteren element.
  // Adaylar: kullanıcı avatarı, "Settings" linki, profile menu.
  loginIndicator:
    '[data-testid*="user-avatar" i], ' +
    'button[aria-label*="account" i], ' +
    'a[href="/settings"], ' +
    'a[href*="/profile"]',

  // Sign In linki — yokluğu logged-in heuristic'i.
  signInLink:
    'a[href*="auth"]:has-text("Sign In"), ' +
    'a[href*="login"]:has-text("Sign In"), ' +
    'button:has-text("Sign In"), ' +
    'button:has-text("Log In")',

  // User avatar — login indicator'ın spesifik versiyonu.
  userAvatar:
    'img[alt*="avatar" i], ' +
    '[data-testid*="user-avatar" i], ' +
    'button[aria-label*="profile" i] img',
};

/**
 * Runtime override merge.
 *
 * Env: `MJ_SELECTOR_OVERRIDES='{"promptInput": "textarea#new-mj-input", ...}'`
 *
 * Kullanıcı MJ üyelik alıp ilk gerçek tur'da selector'ları kalibre eder
 * (eski default'lar 8 ay sonra çalışmıyor olabilir). Override env'le
 * gelirse default'a merge edilir (key bazlı override).
 */
export function loadSelectors(): Record<MJSelectorKey, string> {
  const raw = process.env["MJ_SELECTOR_OVERRIDES"];
  if (!raw) return { ...DEFAULT_SELECTORS };
  try {
    const parsed = JSON.parse(raw) as Partial<Record<MJSelectorKey, string>>;
    return { ...DEFAULT_SELECTORS, ...parsed };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      "[mj-bridge] MJ_SELECTOR_OVERRIDES parse fail; default'a düşülüyor:",
      err instanceof Error ? err.message : String(err),
    );
    return { ...DEFAULT_SELECTORS };
  }
}

/**
 * MJ web URL'leri.
 *
 * V8 Alpha alpha.midjourney.com'da; production www.midjourney.com.
 * Default production; override için env.
 */
export type MJUrls = {
  base: string;
  imagine: string;
  archive: string;
};

export function loadUrls(): MJUrls {
  const base = process.env["MJ_BASE_URL"] ?? "https://www.midjourney.com";
  return {
    base,
    imagine: `${base}/imagine`,
    archive: `${base}/archive`,
  };
}
