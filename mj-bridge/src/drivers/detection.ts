// Pass 43 — Login + challenge detection helpers.
//
// İlke (Pass 41 doc §4):
//   • Auto-solve YOK
//   • Detect → state'e yansıt → caller (job manager) UI'a sinyal gönderir
//   • Resume otomatik (DOM polling iframe kayboldu mu)
//
// Detection iki katmanlıdır:
//   1. URL pattern (hızlı, login/challenge sayfasında ana ipucu)
//   2. DOM selector (URL match olmadığında: Cloudflare ara fragment,
//      hCaptcha modal, login banner)
//
// `wait*` fonksiyonları polling pattern'inde — UI bridge state'lerinden
// `WAITING_FOR_RENDER`/`AWAITING_LOGIN`/`AWAITING_CHALLENGE` gibi
// state'lere bunları çağırır.

import type { Page } from "playwright";
import type { MJSelectorKey } from "./selectors.js";

/**
 * Sayfanın login gerektirip gerektirmediği — URL + DOM heuristic.
 */
export async function detectLoginRequired(
  page: Page,
  selectors: Record<MJSelectorKey, string>,
): Promise<{ loginRequired: boolean; reason: string }> {
  const url = page.url();

  // URL pattern — MJ login/auth sayfaları.
  if (url.includes("/auth/")) {
    return { loginRequired: true, reason: `URL pattern /auth/: ${url}` };
  }
  if (url.includes("accounts.google.com")) {
    return {
      loginRequired: true,
      reason: "Google OAuth redirect (login akışı)",
    };
  }
  if (url.includes("discord.com/oauth2")) {
    return {
      loginRequired: true,
      reason: "Discord OAuth redirect (login akışı)",
    };
  }
  if (!url.includes("midjourney.com")) {
    return {
      loginRequired: true,
      reason: `Beklenmeyen URL (MJ dışı): ${url}`,
    };
  }

  // DOM heuristic — Sign In linki var mı (yoksa login indicator var mı).
  const signInVisible = await page
    .locator(selectors.signInLink)
    .first()
    .isVisible()
    .catch(() => false);
  if (signInVisible) {
    return {
      loginRequired: true,
      reason: "Sign In linki görünür (logged out)",
    };
  }

  const loggedIn = await page
    .locator(selectors.loginIndicator)
    .first()
    .isVisible()
    .catch(() => false);
  if (loggedIn) {
    return { loginRequired: false, reason: "Login indicator görünür" };
  }

  // Belirsiz — promptInput görünüyor mu? Görünüyorsa logged-in say.
  const promptVisible = await page
    .locator(selectors.promptInput)
    .first()
    .isVisible()
    .catch(() => false);
  if (promptVisible) {
    return { loginRequired: false, reason: "Prompt input görünür (logged in)" };
  }

  return {
    loginRequired: true,
    reason: "Belirsiz state — Sign In yok, login indicator yok, prompt yok",
  };
}

/**
 * Cloudflare / hCaptcha challenge sayfasında mıyız?
 *
 * Pass 44 — kapsam genişletildi:
 *   1. URL pattern (challenges.cloudflare.com, /cdn-cgi/challenge)
 *   2. Iframe selector (Pass 43 — embedded challenge için)
 *   3. **Whole-page Cloudflare interstitial** — DOM body içinde
 *      "verify you are human" / "Just a moment" / "Ray ID" pattern.
 *      Pass 44 audit'inde MJ tarafı her sayfada full-page CF
 *      interstitial gösterdi (Türkçe lokalize: "Bir dakika lütfen…"
 *      + "Güvenlik doğrulaması yapılıyor"); iframe yoktu, eski
 *      detection bunu yakalamadı.
 *   4. Title pattern (interstitial title kısa + lokalize "Just a
 *      moment" / "Bir dakika lütfen" / "Ein Moment bitte" gibi).
 *
 * Lokalizasyon: Cloudflare interstitial kullanıcının Accept-Language'ına
 * göre değişir. Body'deki "cloudflare" string'i ve `cf-` class'lı
 * elementler genelde sabit kalır — onlar primary anchor.
 */
export async function detectChallengeRequired(
  page: Page,
  selectors: Record<MJSelectorKey, string>,
): Promise<{ challengeRequired: boolean; reason?: string }> {
  const url = page.url();

  // 1. URL pattern.
  if (url.includes("challenges.cloudflare.com")) {
    return { challengeRequired: true, reason: "Cloudflare challenge URL" };
  }
  if (url.includes("/cdn-cgi/challenge")) {
    return {
      challengeRequired: true,
      reason: "Cloudflare /cdn-cgi/challenge URL",
    };
  }

  // 2. Iframe selectors (Pass 43 — embedded challenge).
  const cfIframe = await page
    .locator(selectors.cloudflareChallenge)
    .first()
    .isVisible()
    .catch(() => false);
  if (cfIframe) {
    return {
      challengeRequired: true,
      reason: "Cloudflare iframe görünür",
    };
  }
  const hcIframe = await page
    .locator(selectors.hcaptchaChallenge)
    .first()
    .isVisible()
    .catch(() => false);
  if (hcIframe) {
    return { challengeRequired: true, reason: "hCaptcha iframe görünür" };
  }

  // 3. Whole-page interstitial — Pass 44 yeni detection.
  // Cloudflare full-page Ray ID + body lokalize "verify you are human"
  // pattern'ini içerir. cf- prefix'li selector'lar genelde sabit.
  // `script[src*="cloudflare"]` veya `link[href*="cloudflare"]` head'de
  // de var olabilir ama interstitial'a özel: body içinde "cf-mitigated"
  // veya benzer.
  const interstitial = await page.evaluate(() => {
    // Title — kısa ve lokalize "moment / dakika" pattern
    const titleLower = document.title.toLowerCase();
    const titlePattern = /just a moment|bir dakika|moment bitte|momento por favor|un moment|поддерживается|wait/i;
    const titleMatch = titlePattern.test(titleLower);

    // Body — Cloudflare branded pattern (Ray ID, cloudflare.com link,
    // "verify" lokalize text). Ray ID format: `Ray ID: <hex>`.
    const bodyText = document.body?.innerText ?? "";
    const rayIdMatch = /ray id[:\s]*[0-9a-f]+/i.test(bodyText);
    const cloudflareLink = document.querySelector(
      'a[href*="cloudflare.com"]',
    );
    const verifyText =
      /verify you are human|verify human|güvenlik doğrulaması|sicherheitsüberprüfung|verificación de seguridad|vérification de sécurité/i.test(
        bodyText,
      );

    // cf- class'ları (Cloudflare interstitial template'i)
    const cfClass = !!document.querySelector(
      '[class*="cf-"], #cf-spinner, #cf-bubbles',
    );

    return {
      titleMatch,
      rayIdMatch,
      hasCloudflareLink: !!cloudflareLink,
      verifyText,
      cfClass,
      bodyTextSample: bodyText.slice(0, 200),
      title: document.title,
    };
  });

  // İki güçlü sinyal: (Ray ID + cloudflare link) veya (title + verify).
  // Tek başına title zayıf (rastgele yan sayfada da olabilir); kombine güvenli.
  if (interstitial.rayIdMatch && interstitial.hasCloudflareLink) {
    return {
      challengeRequired: true,
      reason: `Cloudflare full-page interstitial (Ray ID + cloudflare link). Title: "${interstitial.title}"`,
    };
  }
  if (interstitial.verifyText && interstitial.hasCloudflareLink) {
    return {
      challengeRequired: true,
      reason: `Cloudflare full-page interstitial (verify text + cloudflare link). Title: "${interstitial.title}"`,
    };
  }
  if (interstitial.titleMatch && interstitial.cfClass) {
    return {
      challengeRequired: true,
      reason: `Cloudflare interstitial (title pattern + cf-class). Title: "${interstitial.title}"`,
    };
  }

  return { challengeRequired: false };
}

/**
 * Polling — challenge çözülünceye kadar bekle.
 *
 * Caller (executeJob) bu fonksiyonu AWAITING_CHALLENGE state'inde çağırır.
 * Çözülünce true; timeout'ta false. Kullanıcı manuel doğrulama yapar; bu
 * fonksiyon SADECE bekler (auto-solve YOK).
 */
export async function waitForChallengeCleared(
  page: Page,
  selectors: Record<MJSelectorKey, string>,
  options: {
    timeoutMs: number;
    pollIntervalMs?: number;
    onPoll?: (elapsedMs: number) => void;
  },
): Promise<{ cleared: boolean; elapsedMs: number }> {
  const start = Date.now();
  const interval = options.pollIntervalMs ?? 2000;
  while (Date.now() - start < options.timeoutMs) {
    const result = await detectChallengeRequired(page, selectors);
    if (!result.challengeRequired) {
      return { cleared: true, elapsedMs: Date.now() - start };
    }
    if (options.onPoll) options.onPoll(Date.now() - start);
    await new Promise((r) => setTimeout(r, interval));
  }
  return { cleared: false, elapsedMs: Date.now() - start };
}

/**
 * Polling — login olunca devam et.
 *
 * Caller AWAITING_LOGIN state'inde. Kullanıcı browser'da login eder.
 */
export async function waitForLogin(
  page: Page,
  selectors: Record<MJSelectorKey, string>,
  options: {
    timeoutMs: number;
    pollIntervalMs?: number;
    onPoll?: (elapsedMs: number) => void;
  },
): Promise<{ loggedIn: boolean; elapsedMs: number }> {
  const start = Date.now();
  const interval = options.pollIntervalMs ?? 3000;
  while (Date.now() - start < options.timeoutMs) {
    const result = await detectLoginRequired(page, selectors);
    if (!result.loginRequired) {
      return { loggedIn: true, elapsedMs: Date.now() - start };
    }
    if (options.onPoll) options.onPoll(Date.now() - start);
    await new Promise((r) => setTimeout(r, interval));
  }
  return { loggedIn: false, elapsedMs: Date.now() - start };
}

/**
 * Boot-time selector smoke — bridge başlatıldığında ana sayfada
 * promptInput bulunabiliyor mu?
 *
 * Kullanıcı logged-out ise promptInput zaten görünmez (login gerek);
 * bu fonksiyon **logged-in kullanıcı için** kalibre testi.
 *
 * Caller real driver init() içinde çağırır; fail durumunda warning
 * loglar (FAIL etmez — kullanıcı login etmeden bridge çalışmalı).
 */
export async function smokeCheckSelectors(
  page: Page,
  selectors: Record<MJSelectorKey, string>,
): Promise<{
  promptInputFound: boolean;
  loginIndicatorFound: boolean;
  signInLinkFound: boolean;
}> {
  const promptInputFound = await page
    .locator(selectors.promptInput)
    .first()
    .isVisible({ timeout: 1000 })
    .catch(() => false);
  const loginIndicatorFound = await page
    .locator(selectors.loginIndicator)
    .first()
    .isVisible({ timeout: 1000 })
    .catch(() => false);
  const signInLinkFound = await page
    .locator(selectors.signInLink)
    .first()
    .isVisible({ timeout: 1000 })
    .catch(() => false);
  return {
    promptInputFound,
    loginIndicatorFound,
    signInLinkFound,
  };
}
