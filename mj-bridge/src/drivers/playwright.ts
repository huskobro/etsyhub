// Playwright driver — V1 SHELL.
//
// Gerçek MJ web otomasyonu BU dosyada yer alır. Kullanıcının üyeliği
// olmadığı için Pass 42'de yalnız:
//   - Persistent context bootstrap (browser launch + profile dir)
//   - Health: launched / pageCount / activeUrl / mjLikelyLoggedIn heuristic
//   - Selector kontratı placeholder (selectors.ts ayrı dosya)
//
// V1.x'te eklenecek (ban-aware sırasıyla):
//   1. Login state detection (URL pattern: */join | session cookie)
//   2. Prompt submit (input fill + Enter; jitter 800-1500ms typing)
//   3. Render polling (DOM mutation observer; max 120sn)
//   4. Grid output capture (img selectors → URL)
//   5. Download (HTTP fetch via page request — same session cookies)
//   6. Challenge detect (Cloudflare iframe + URL pattern)
//   7. Upscale/variation button click
//
// Pass 41 doc §8.1: selector versioning kritik. Tüm DOM selector'ları
// `selectors.ts` içinde toplanır; MJ web değişiminde tek dosya update.
//
// Pass 41 doc §8.2: TOS uyumu için:
//   • headless: false (görünür browser)
//   • Persistent profile (yeni session değil)
//   • Throughput 1 paralel + 10sn min interval
//   • Manuel intervention'a açık (kullanıcı browser'a girip oynatabilir)
//   • Stealth plugin YOK, fingerprint manipulation YOK

import { chromium, type BrowserContext, type Page } from "playwright";
import { mkdir } from "node:fs/promises";
import type { BridgeDriver, DriverProgressCallback } from "./types.js";
import type { CreateJobRequest } from "../types.js";

export type PlaywrightDriverConfig = {
  /** Persistent profile path — kullanıcının MJ session/cookie burada saklanır. */
  profileDir: string;
  /** Output dosyaları için disk yolu. */
  outputsDir: string;
  /**
   * Browser görünür mu — production'da MUTLAKA false (yani headless: false
   * = görünür). True yaparsanız TOS açıkça ihlal — kasıtlı olarak default
   * görünür.
   */
  headless?: false;
  /** Job-arası min interval (ms) — rate limit önleme. */
  minJobIntervalMs?: number;
};

/**
 * V1 SHELL — gerçek MJ otomasyonu yok. Bridge'i Playwright ile başlatır
 * ama job execute mock cevap verir + sebep belirtir.
 *
 * Kullanıcının MJ üyeliği geldiğinde bu sınıf doldurulur (Pass 42 carry).
 */
export class PlaywrightDriverShell implements BridgeDriver {
  readonly id = "playwright-shell";
  private context: BrowserContext | null = null;
  private startedAt = new Date();
  private lastSessionCheck = new Date();
  private mjLikelyLoggedIn = false;
  private cfg: PlaywrightDriverConfig;

  constructor(cfg: PlaywrightDriverConfig) {
    this.cfg = cfg;
  }

  async init(): Promise<void> {
    await mkdir(this.cfg.profileDir, { recursive: true });
    await mkdir(this.cfg.outputsDir, { recursive: true });

    // Playwright launchPersistentContext — kullanıcı session'ını profile dir
    // içinde tutar. headless: false zorunlu (TOS uyumu — design doc §8.2).
    this.context = await chromium.launchPersistentContext(this.cfg.profileDir, {
      headless: false,
      viewport: { width: 1280, height: 900 },
      // Pass 42 V1: ekstra arg yok. Stealth plugin / fingerprint manipulation
      // TOS bypass kokar — KASITLI olarak eklenmez.
    });

    // Default page açık tutulur — kullanıcı bu pencerede MJ ile etkileşir.
    const pages = this.context.pages();
    if (pages.length === 0) {
      const page = await this.context.newPage();
      await page.goto("https://www.midjourney.com", {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
    }

    await this.refreshSessionHeuristic();
  }

  async shutdown(): Promise<void> {
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
  }

  async health() {
    await this.refreshSessionHeuristic();
    const pages = this.context?.pages() ?? [];
    return {
      launched: this.context !== null,
      profileDir: this.cfg.profileDir,
      pageCount: pages.length,
      activeUrl: pages[0]?.url(),
      mjLikelyLoggedIn: this.mjLikelyLoggedIn,
      lastChecked: this.lastSessionCheck.toISOString(),
    };
  }

  async focusBrowser(): Promise<void> {
    const page = this.context?.pages()[0];
    if (page) await page.bringToFront();
  }

  /**
   * V1 SHELL — gerçek otomasyon yok.
   *
   * Şu an: state'i AWAITING_LOGIN'e çek + "Manual implementation pending"
   * mesajı + FAILED. Bu kasıtlı — gerçek hesap geldiğinde adım adım
   * doldurulacak (Pass 41 doc §10 rollout adım 2-6).
   */
  async executeJob(
    job: { id: string; request: CreateJobRequest },
    onProgress: DriverProgressCallback,
    _signal: AbortSignal,
  ): Promise<void> {
    onProgress({
      state: "OPENING_BROWSER",
      message: "Playwright context aktif (V1 shell)",
    });
    await this.refreshSessionHeuristic();

    if (!this.mjLikelyLoggedIn) {
      onProgress({
        state: "AWAITING_LOGIN",
        blockReason: "login-required",
        message:
          "MJ login bulunamadı. Bridge browser penceresinde login yapın; sonra job tekrar enqueue edilmeli.",
      });
      return;
    }

    onProgress({
      state: "FAILED",
      blockReason: "internal-error",
      message:
        "Playwright driver V1 shell — gerçek prompt submit / render polling / download akışı henüz implement edilmedi. " +
        "Pass 41 doc §10 rollout adım 3-6'da eklenecek. Şimdilik mock driver kullanın.",
    });
    void job;
  }

  /**
   * MJ login heuristic — sayfa URL'i + cookie kontrol.
   *
   * V1 yalnız URL pattern; V1.x'te:
   *   - Cookie `__session` veya benzeri presence
   *   - Header `authorization` request interception
   *   - DOM "Sign In" linki yokluğu
   */
  private async refreshSessionHeuristic(): Promise<void> {
    this.lastSessionCheck = new Date();
    const page = this.context?.pages()[0];
    if (!page) {
      this.mjLikelyLoggedIn = false;
      return;
    }
    const url = page.url();
    // Login sayfaları MJ'de "/auth" veya OAuth provider'a redirect oluyor.
    // Logged-in kullanıcı genelde "/imagine" veya "/explore" url'lerinde.
    this.mjLikelyLoggedIn =
      !url.includes("/auth") &&
      !url.includes("accounts.google.com") &&
      !url.includes("discord.com") &&
      url.includes("midjourney.com");
  }
}

/**
 * V2 carry-forward — DOM selector kontratı.
 *
 * Pass 41 doc §8.1: selector versioning. MJ web UI değişiminde tek dosya
 * update. ARIA / role-based selector tercih.
 *
 * Şu an placeholder — kullanıcı üyelik aldığında selector'lar gerçek
 * DOM inspection ile doldurulur.
 */
export const MJ_SELECTORS = {
  // Prompt input — tahmini ARIA label.
  promptInput: 'textarea[aria-label*="prompt" i], textarea[placeholder*="prompt" i]',
  // Render grid container — yeni job grid'i append ediyor.
  renderGrid: '[role="grid"], [data-testid*="grid" i]',
  // Cloudflare challenge iframe.
  cloudflareChallenge: 'iframe[src*="challenges.cloudflare.com"]',
  // hCaptcha challenge iframe.
  hcaptchaChallenge: 'iframe[src*="hcaptcha.com"]',
  // Sign In button — yokluğu logged-in heuristic'i.
  signInButton: 'a[href*="auth"], button:has-text("Sign In")',
} as const;
