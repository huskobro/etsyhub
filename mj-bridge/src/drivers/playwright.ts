// Pass 43 — Playwright real driver, ilk gerçek implementasyon.
//
// Pass 41 doc §3.2 + §8.2 ilkeleri:
//   • headless: false (görünür browser)
//   • Persistent profile (oturum saklı)
//   • Düşük throughput + jitter (rate limit önleme)
//   • Manuel intervention'a açık (kullanıcı browser'a girip oynatabilir)
//   • Stealth plugin / fingerprint manipulation YOK
//
// Pass 43 V1 hedefi:
//   ✓ launchPersistentContext — visible Chromium
//   ✓ MJ ana sayfa load + login heuristic
//   ✓ Boot-time selector smoke (kalibre uyarısı)
//   ✓ Health surface (browser pid, page count, MJ login, last activity)
//   ✓ executeJob: kind="generate" gerçek akış (login → submit → render
//     → download); challenge/login durumlarında AWAITING state'e geç
//   ✓ focusBrowser: page.bringToFront()
//   ✓ Selector mismatch / login required / challenge required → ayrı
//     blockReason
//
// V1.x carry-forward (capability matrix Pass 43):
//   ◦ kind: describe (image upload + 4 prompt scrape)
//   ◦ kind: upscale / variation (U1-U4 / V1-V4 button click)
//   ◦ image-prompt URL paste DOM action (bridge param zaten kabul ediyor;
//     buildMJPromptString başa ekliyor)
//   ◦ omni-ref drag-drop bin (premium V7+; orta effort)

import { mkdir } from "node:fs/promises";
import { chromium, type BrowserContext, type Page } from "playwright";
import type { BridgeDriver, DriverProgressCallback } from "./types.js";
import type { CreateJobRequest, JobBlockReason } from "../types.js";
import {
  loadSelectors,
  loadUrls,
  type MJSelectorKey,
} from "./selectors.js";
import {
  detectChallengeRequired,
  detectLoginRequired,
  smokeCheckSelectors,
  waitForChallengeCleared,
  waitForLogin,
} from "./detection.js";
import {
  buildMJPromptString,
  downloadGridImages,
  SelectorMismatchError,
  submitPrompt,
  waitForRender,
} from "./generate-flow.js";

export type PlaywrightDriverConfig = {
  /** Persistent profile path. */
  profileDir: string;
  /** Output dosyaları. */
  outputsDir: string;
  /** TOS uyumu — production MUTLAKA görünür. Test için bypass etmek
   * isteyen `MJ_BRIDGE_HEADLESS_TEST=1` env'i kullanır (sadece testler;
   * üretimde verilmez). */
  headlessForTesting?: boolean;
  /** Login bekleme timeout — kullanıcı browser'da MJ'ye login etmesi
   * için süre. Default 5 dk. */
  loginTimeoutMs?: number;
  /** Challenge çözme timeout — Cloudflare/captcha. Default 5 dk. */
  challengeTimeoutMs?: number;
  /** Render polling timeout — MJ render. Default 3 dk. */
  renderTimeoutMs?: number;
};

export class PlaywrightDriver implements BridgeDriver {
  readonly id = "playwright";
  private context: BrowserContext | null = null;
  private startedAt = new Date();
  private lastSessionCheck = new Date();
  private mjLikelyLoggedIn = false;
  private cfg: Required<PlaywrightDriverConfig>;
  private selectors = loadSelectors();
  private urls = loadUrls();
  /** Last selector smoke result — health'te görünür. */
  private lastSelectorSmoke: {
    promptInputFound: boolean;
    loginIndicatorFound: boolean;
    signInLinkFound: boolean;
    at: string;
  } | null = null;

  constructor(cfg: PlaywrightDriverConfig) {
    this.cfg = {
      profileDir: cfg.profileDir,
      outputsDir: cfg.outputsDir,
      headlessForTesting: cfg.headlessForTesting ?? false,
      loginTimeoutMs: cfg.loginTimeoutMs ?? 5 * 60_000,
      challengeTimeoutMs: cfg.challengeTimeoutMs ?? 5 * 60_000,
      renderTimeoutMs: cfg.renderTimeoutMs ?? 3 * 60_000,
    };
  }

  async init(): Promise<void> {
    await mkdir(this.cfg.profileDir, { recursive: true });
    await mkdir(this.cfg.outputsDir, { recursive: true });

    // headless: false — TOS uyumu (Pass 41 doc §8.2). Test ortamı için
    // env override mümkün ama production'da KULLANMA.
    this.context = await chromium.launchPersistentContext(this.cfg.profileDir, {
      headless: this.cfg.headlessForTesting,
      viewport: { width: 1280, height: 900 },
    });

    // Default page açık tutulur — kullanıcı bu pencerede MJ ile etkileşir.
    const pages = this.context.pages();
    let page: Page;
    if (pages.length === 0) {
      page = await this.context.newPage();
    } else {
      page = pages[0]!;
    }
    await page.goto(this.urls.base, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });

    // Boot-time selector smoke — login indicator / prompt input
    // bulunabiliyor mu? Logged-out kullanıcı için promptInput zaten yok.
    const smoke = await smokeCheckSelectors(page, this.selectors);
    this.lastSelectorSmoke = { ...smoke, at: new Date().toISOString() };
    if (
      !smoke.loginIndicatorFound &&
      !smoke.signInLinkFound &&
      !smoke.promptInputFound
    ) {
      // eslint-disable-next-line no-console
      console.warn(
        "[mj-bridge:playwright] selector smoke FAIL — MJ web'de hiçbir " +
          "selector eşleşmedi. MJ_SELECTOR_OVERRIDES env ile kalibrasyon " +
          "gerekebilir. Bridge yine de başlatılır; ilk job'da " +
          "AWAITING_LOGIN/AWAITING_CHALLENGE veya selector-mismatch " +
          "fail olur.",
      );
    }

    await this.refreshSessionHeuristic(page);
  }

  async shutdown(): Promise<void> {
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
  }

  async health() {
    const page = this.context?.pages()[0];
    if (page) await this.refreshSessionHeuristic(page);
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
   * Job execute — generate-first.
   *
   * Pass 43 V1: kind="generate" gerçek akış. Diğer kind'lar
   * "kind not implemented (Pass 43 V1)" FAILED.
   */
  async executeJob(
    job: { id: string; request: CreateJobRequest },
    onProgress: DriverProgressCallback,
    signal: AbortSignal,
  ): Promise<void> {
    if (!this.context) {
      onProgress({
        state: "FAILED",
        blockReason: "browser-crashed",
        message: "Bridge init() henüz çağrılmadı",
      });
      return;
    }

    if (job.request.kind !== "generate") {
      onProgress({
        state: "FAILED",
        blockReason: "internal-error",
        message: `kind="${job.request.kind}" Pass 43 V1'de henüz desteklenmiyor (capability matrix V1.x)`,
      });
      return;
    }

    onProgress({ state: "OPENING_BROWSER", message: "Browser hazırlanıyor" });

    const page = this.context.pages()[0] ?? (await this.context.newPage());
    await page.bringToFront().catch(() => undefined);

    // /imagine sayfasına navigate (login/challenge oluşabilir).
    if (!page.url().startsWith(this.urls.imagine)) {
      try {
        await page.goto(this.urls.imagine, {
          waitUntil: "domcontentloaded",
          timeout: 30_000,
        });
      } catch (err) {
        onProgress({
          state: "FAILED",
          blockReason: "browser-crashed",
          message: `MJ ${this.urls.imagine} navigate fail: ${err instanceof Error ? err.message : "unknown"}`,
        });
        return;
      }
    }

    // Challenge?
    {
      const ch = await detectChallengeRequired(page, this.selectors);
      if (ch.challengeRequired) {
        onProgress({
          state: "AWAITING_CHALLENGE",
          blockReason: "challenge-required",
          message: ch.reason ?? "Challenge tespit edildi",
        });
        const cleared = await waitForChallengeCleared(page, this.selectors, {
          timeoutMs: this.cfg.challengeTimeoutMs,
          onPoll: (ms) => {
            if (signal.aborted) return;
            onProgress({
              state: "AWAITING_CHALLENGE",
              blockReason: "challenge-required",
              message: `Bekliyoruz… ${Math.floor(ms / 1000)}s`,
            });
          },
        });
        if (signal.aborted) return;
        if (!cleared.cleared) {
          onProgress({
            state: "FAILED",
            blockReason: "challenge-required",
            message: `Challenge ${this.cfg.challengeTimeoutMs / 1000}s içinde çözülmedi`,
          });
          return;
        }
      }
    }

    // Login?
    {
      const lg = await detectLoginRequired(page, this.selectors);
      if (lg.loginRequired) {
        onProgress({
          state: "AWAITING_LOGIN",
          blockReason: "login-required",
          message: lg.reason,
        });
        const ok = await waitForLogin(page, this.selectors, {
          timeoutMs: this.cfg.loginTimeoutMs,
          onPoll: (ms) => {
            if (signal.aborted) return;
            onProgress({
              state: "AWAITING_LOGIN",
              blockReason: "login-required",
              message: `Bekliyoruz… ${Math.floor(ms / 1000)}s`,
            });
          },
        });
        if (signal.aborted) return;
        if (!ok.loggedIn) {
          onProgress({
            state: "FAILED",
            blockReason: "login-required",
            message: `Login ${this.cfg.loginTimeoutMs / 1000}s içinde tamamlanmadı`,
          });
          return;
        }
      }
    }

    // Submit prompt.
    onProgress({ state: "SUBMITTING_PROMPT", message: "Prompt gönderiliyor" });

    const baselineCount = await page
      .locator(this.selectors.renderJobCard)
      .count()
      .catch(() => 0);

    const promptString = buildMJPromptString(job.request.params);
    try {
      await submitPrompt(page, this.selectors, promptString);
    } catch (err) {
      const reason: JobBlockReason =
        err instanceof SelectorMismatchError
          ? "selector-mismatch"
          : "internal-error";
      onProgress({
        state: "FAILED",
        blockReason: reason,
        message: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    if (signal.aborted) return;

    // Render polling.
    onProgress({
      state: "WAITING_FOR_RENDER",
      message: "Render bekleniyor (30-90sn)",
    });

    let render;
    try {
      render = await waitForRender(page, this.selectors, {
        submitBaselineCount: baselineCount,
        timeoutMs: this.cfg.renderTimeoutMs,
        onPoll: (ms) => {
          if (signal.aborted) return;
          onProgress({
            state: "WAITING_FOR_RENDER",
            message: `Render bekleniyor… ${Math.floor(ms / 1000)}s`,
          });
        },
      });
    } catch (err) {
      onProgress({
        state: "FAILED",
        blockReason: "render-timeout",
        message: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    if (signal.aborted) return;

    onProgress({
      state: "COLLECTING_OUTPUTS",
      mjJobId: render.mjJobId ?? undefined,
      mjMetadata: {
        prompt: job.request.params.prompt,
        promptString,
        aspectRatio: job.request.params.aspectRatio,
        version: job.request.params.version,
      },
    });

    // Download grid images.
    onProgress({
      state: "DOWNLOADING",
      message: "Grid görselleri indiriliyor",
    });

    let downloaded;
    try {
      downloaded = await downloadGridImages(
        page,
        render.imageUrls,
        this.cfg.outputsDir,
        job.id,
      );
    } catch (err) {
      onProgress({
        state: "FAILED",
        blockReason: "internal-error",
        message: `Download fail: ${err instanceof Error ? err.message : "unknown"}`,
      });
      return;
    }

    if (signal.aborted) return;

    const outputs = downloaded.map((d) => ({
      gridIndex: d.gridIndex,
      localPath: d.localPath,
      fetchUrl: `/jobs/${job.id}/outputs/${d.gridIndex}`,
      sourceUrl: d.sourceUrl,
    }));

    onProgress({
      state: "COMPLETED",
      outputs,
      mjJobId: render.mjJobId ?? undefined,
      message: "Render + download tamamlandı",
    });
  }

  /** Last selector smoke result — debug için health endpoint'inde. */
  getSelectorSmoke() {
    return this.lastSelectorSmoke;
  }

  /**
   * MJ login heuristic — sayfa URL'i + DOM.
   *
   * URL pattern: midjourney.com içi + auth/google/discord değilse OK.
   * DOM: signInLink yokluğu veya loginIndicator varlığı.
   */
  private async refreshSessionHeuristic(page: Page): Promise<void> {
    this.lastSessionCheck = new Date();
    try {
      const result = await detectLoginRequired(page, this.selectors);
      this.mjLikelyLoggedIn = !result.loginRequired;
    } catch {
      this.mjLikelyLoggedIn = false;
    }
  }
}

// Export tüm selector key'leri — debug/admin UI için.
export type { MJSelectorKey };
