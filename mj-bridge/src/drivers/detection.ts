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
 * URL pattern + iframe selector.
 */
export async function detectChallengeRequired(
  page: Page,
  selectors: Record<MJSelectorKey, string>,
): Promise<{ challengeRequired: boolean; reason?: string }> {
  const url = page.url();

  // URL pattern.
  if (url.includes("challenges.cloudflare.com")) {
    return { challengeRequired: true, reason: "Cloudflare challenge URL" };
  }
  if (url.includes("/cdn-cgi/challenge")) {
    return {
      challengeRequired: true,
      reason: "Cloudflare /cdn-cgi/challenge URL",
    };
  }

  // DOM iframe.
  const cf = await page
    .locator(selectors.cloudflareChallenge)
    .first()
    .isVisible()
    .catch(() => false);
  if (cf) {
    return {
      challengeRequired: true,
      reason: "Cloudflare iframe görünür",
    };
  }

  const hc = await page
    .locator(selectors.hcaptchaChallenge)
    .first()
    .isVisible()
    .catch(() => false);
  if (hc) {
    return { challengeRequired: true, reason: "hCaptcha iframe görünür" };
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
