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

import { mkdir, unlink, stat, readdir } from "node:fs/promises";
import { join } from "node:path";
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
  attachImagePrompts,
  buildMJPromptString,
  captureBaselineUuids,
  describeImage,
  downloadGridImages,
  SelectorMismatchError,
  submitPrompt,
  triggerUpscale,
  waitForRender,
  waitForUpscaleResult,
} from "./generate-flow.js";

export type PlaywrightDriverConfig = {
  /**
   * Pass 47 — Browser yaşam döngüsü modu.
   *
   *   "attach":  ✅ Önerilen (Pass 47). Kullanıcının kendi terminal'inde
   *              `--remote-debugging-port=N` ile başlattığı Brave/Chrome'a
   *              `chromium.connectOverCDP(cdpUrl)` ile bağlanır. Bridge
   *              **yeni pencere AÇMAZ**; mevcut pencerede çalışır. Tüm
   *              UI manuel başlatılmış görünür → Cloudflare Turnstile
   *              loop'u en az tetiklenir. Persistent profile kullanıcının
   *              `--user-data-dir` flag'ine bırakılır.
   *
   *   "launch":  Pass 43-46 davranışı. Playwright `launchPersistentContext`
   *              ile yeni Chromium/Chrome açar. CDP otomasyonu CF tarafından
   *              algılanabilir; managed challenge döngüsü riski yüksek.
   *              Test/dev/CI senaryolarında kullanılır.
   *
   * Default "attach" (real production); "launch" explicit env override.
   */
  mode?: "attach" | "launch";
  /**
   * Pass 47 — Attach modunda CDP endpoint'i. Kullanıcı browser'ı şu
   * komutla başlatır:
   *   /Applications/Brave\ Browser.app/Contents/MacOS/Brave\ Browser \
   *     --remote-debugging-port=9222 \
   *     --user-data-dir="$HOME/.mj-bridge-brave-profile"
   *
   * Default `http://127.0.0.1:9222`. Kullanıcı port'u değiştirirse
   * `MJ_BRIDGE_CDP_URL` env ile geçilir.
   */
  cdpUrl?: string;
  /**
   * Pass 47 — Launch modunda hangi browser binary kullanılacak.
   *   "chrome":  Playwright `channel: "chrome"` (system Google Chrome)
   *   "brave":   Playwright `executablePath` ile Brave binary
   *   "chromium": Playwright bundled (test build; CF agresif)
   * Default "chrome". Attach modunda anlamı yok (browser kullanıcı
   * tarafından başlatıldı).
   */
  browserKind?: "chrome" | "brave" | "chromium";
  /** Persistent profile path (yalnız launch modunda kullanılır). */
  profileDir: string;
  /** Output dosyaları. */
  outputsDir: string;
  /**
   * @deprecated Pass 47 — `browserKind` ile değiştirildi.
   * Geriye uyumlu: "chrome" → browserKind="chrome", aksi halde "chromium".
   */
  channel?: "chrome" | "chromium";
  /** TOS uyumu — production MUTLAKA görünür. Test için bypass etmek
   * isteyen `MJ_BRIDGE_HEADLESS_TEST=1` env'i kullanır (sadece testler;
   * üretimde verilmez). Attach modunda anlamı yok. */
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
  /** Pass 45 — gerçekten launch edilen kanal (chrome veya chromium fallback). */
  private launchedChannel: "chrome" | "chromium" = "chromium";
  /** Pass 47 — gerçekleşen mode: launch | attach. */
  private actualMode: "attach" | "launch" = "launch";
  /** Pass 47 — attach durumunda dış browserKind tespiti zor; cfg'den taşı. */
  private actualBrowserKind: "chrome" | "brave" | "chromium" | "external" =
    "chromium";
  /** Pass 45 — profile init anındaki state (fresh/primed). */
  private profileState: "fresh" | "primed" = "fresh";
  /**
   * Pass 46 — son driver mesajı (executeJob içindeki onProgress + init).
   * Health endpoint'inde admin gözlem için görünür.
   */
  private lastDriverMessage: string | null = null;
  /** Pass 46 — son driver hatası (selector-mismatch, render-timeout, vb.). */
  private lastDriverError: string | null = null;
  /**
   * Pass 59 — Session watchdog. Bridge ayakta kaldığı sürece periyodik
   * MJ login probe yapar (default 60sn). Sessiz session düşüşlerini
   * yakalar (kullanıcı MJ'den çıktıysa, CF challenge geldiyse, vs).
   * `lastSessionCheck` zaten her health() çağrısında güncellenir;
   * watchdog **çağrı olmadan** da periyodik probe sağlar → admin live
   * "X dk önce probe" badge'i her zaman güncel kalır.
   */
  private watchdogTimer: NodeJS.Timeout | null = null;
  private watchdogIntervalMs = 60_000;
  /** Pass 59 — Watchdog gözlemi: son N probe sonucu (queue, max 10). */
  private probeHistory: Array<{
    at: string;
    likelyLoggedIn: boolean;
    selectorPromptInputFound: boolean;
  }> = [];

  constructor(cfg: PlaywrightDriverConfig) {
    this.cfg = {
      mode: cfg.mode ?? "attach",
      cdpUrl: cfg.cdpUrl ?? "http://127.0.0.1:9222",
      // browserKind: legacy `channel` field'ından mapping (geriye uyumlu).
      browserKind:
        cfg.browserKind ??
        (cfg.channel === "chromium" ? "chromium" : "chrome"),
      profileDir: cfg.profileDir,
      outputsDir: cfg.outputsDir,
      channel: cfg.channel ?? "chrome",
      headlessForTesting: cfg.headlessForTesting ?? false,
      loginTimeoutMs: cfg.loginTimeoutMs ?? 5 * 60_000,
      challengeTimeoutMs: cfg.challengeTimeoutMs ?? 5 * 60_000,
      renderTimeoutMs: cfg.renderTimeoutMs ?? 3 * 60_000,
    };
  }

  async init(): Promise<void> {
    await mkdir(this.cfg.outputsDir, { recursive: true });

    // Pass 47 — mode dispatch. Attach default; launch legacy/test.
    if (this.cfg.mode === "attach") {
      await this.initAttach();
    } else {
      await this.initLaunch();
    }

    // Pass 59 — Periyodik session probe başlat (default 60sn).
    // Bridge ayakta kaldığı sürece sessiz session düşüşlerini yakalar
    // (kullanıcı MJ logout, CF challenge, vs).
    this.startWatchdog();
  }

  /**
   * Pass 59 — Periyodik MJ login probe loop başlatır.
   *
   * Her tick'te aktif MJ tab'ında login indicator + selector smoke probe.
   * Sonuç `lastSessionCheck` + `probeHistory`'e yazılır → admin sayfada
   * "X dk önce probe" badge canlı görünür.
   *
   * Hata durumunda probe sessiz fail; bir sonraki tick'te tekrar dener
   * (timer iptal edilmez).
   */
  private startWatchdog(): void {
    if (this.watchdogTimer) clearInterval(this.watchdogTimer);
    this.watchdogTimer = setInterval(() => {
      void this.runSessionProbe().catch(() => undefined);
    }, this.watchdogIntervalMs);
    // İlk probe'u init sonrası hemen tetikle (queue history doldurmak için).
    void this.runSessionProbe().catch(() => undefined);
  }

  private async runSessionProbe(): Promise<void> {
    const page = this.pickMjPage();
    if (!page) return;
    try {
      await this.refreshSessionHeuristic(page);
      const smoke = await smokeCheckSelectors(page, this.selectors);
      this.lastSelectorSmoke = { ...smoke, at: new Date().toISOString() };
      this.probeHistory.push({
        at: new Date().toISOString(),
        likelyLoggedIn: this.mjLikelyLoggedIn,
        selectorPromptInputFound: smoke.promptInputFound,
      });
      // FIFO max 10
      if (this.probeHistory.length > 10) this.probeHistory.shift();
    } catch {
      // sessiz fail; bir sonraki tick'te tekrar dener
    }
  }

  /**
   * Pass 47 — Attach modu init. Pass 48 — pre-flight CDP version check.
   *
   * `chromium.connectOverCDP(cdpUrl)` ile kullanıcının kendi terminal'inde
   * başlattığı Brave/Chrome'a bağlanır. Yeni pencere AÇMAZ; mevcut
   * pencerenin tab'larını paylaşır.
   *
   * Sözleşme:
   *   • Kullanıcı browser'ı `--remote-debugging-port=9222` ile başlatmalı.
   *   • Kullanıcı `--user-data-dir=...` ile ayrı profile dir vermeli
   *     (günlük browser'a karışmasın).
   *   • Bridge bağlandıktan sonra context'in default `pages()`'ini alır;
   *     boşsa yeni tab oluşturur.
   *   • Bridge shutdown context'i KAPATMAZ — kullanıcının pencerelerini
   *     etkilemesin (kapatma kullanıcı sorumluluğunda).
   *
   * Pass 48 pre-flight: connectOverCDP'den önce `/json/version` HTTP
   * fetch ile endpoint'in CDP olduğunu doğrula ve Brave/Chrome bilgisini
   * health'e taşı. Endpoint yoksa açık `Connection refused` hatası
   * vermek connectOverCDP'nin generic timeout error'undan iyidir.
   */
  private async initAttach(): Promise<void> {
    this.actualMode = "attach";
    // Profile dizini attach modunda Bridge tarafında manage edilmez —
    // kullanıcı `--user-data-dir` flag'iyle yönetir. Yine de health
    // alanı için "absent" benzeri sinyal:
    this.profileState = "primed"; // attach = mutlaka mevcut çalışan browser
    this.actualBrowserKind = "external";

    // Pass 48 — Pre-flight: /json/version HTTP fetch
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 5_000);
      const res = await fetch(`${this.cfg.cdpUrl}/json/version`, {
        signal: ctrl.signal,
      }).finally(() => clearTimeout(timer));
      if (!res.ok) {
        throw new Error(
          `${this.cfg.cdpUrl}/json/version cevabı ${res.status} ${res.statusText}`,
        );
      }
      const version = (await res.json()) as { Browser?: string };
      this.lastDriverMessage = `CDP pre-flight OK · ${version.Browser ?? "unknown"}`;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Attach modu pre-flight fail: ${this.cfg.cdpUrl} ulaşılamıyor.\n\n` +
          `Browser şu komutla başlatılmalı (Pass 49 — Chrome-first):\n` +
          `  osascript -e 'quit app "Google Chrome"'\n` +
          `  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \\\n` +
          `    --remote-debugging-port=9222 \\\n` +
          `    --user-data-dir="$HOME/.mj-bridge-chrome-profile"\n\n` +
          `Brave alternatifi: --user-data-dir="$HOME/.mj-bridge-brave-profile"\n` +
          `Teşhis: \`npx tsx scripts/check-cdp.ts\` (mj-bridge/ içinde)\n` +
          `Detay: ${msg}`,
      );
    }

    let browser: import("playwright").Browser;
    try {
      browser = await chromium.connectOverCDP(this.cfg.cdpUrl, {
        timeout: 10_000,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Attach modu connectOverCDP fail: ${msg}. CDP endpoint hazır ama ` +
          `Playwright bağlantısı başarısız (firewall, proxy, browser version?).`,
      );
    }

    // İlk context — kullanıcının açtığı pencere(ler)e karşılık gelir.
    const contexts = browser.contexts();
    if (contexts.length === 0) {
      throw new Error(
        "Attach modu: CDP bağlandı ama browser context yok. Browser'da " +
          "en az bir pencere açık olmalı.",
      );
    }
    this.context = contexts[0]!;

    // Default page açık tutulur — yoksa yeni tab.
    const pages = this.context.pages();
    let page: Page;
    if (pages.length === 0) {
      page = await this.context.newPage();
    } else {
      // Mevcut bir MJ tab'ı varsa onu seç; yoksa ilk tab + MJ'ye git.
      const mjPage = pages.find((p) => p.url().includes("midjourney.com"));
      page = mjPage ?? pages[0]!;
    }
    if (!page.url().includes("midjourney.com")) {
      await page
        .goto(this.urls.base, {
          waitUntil: "domcontentloaded",
          timeout: 30_000,
        })
        .catch(() => undefined);
    }

    // Pass 43 — boot smoke + session heuristic.
    const smoke = await smokeCheckSelectors(page, this.selectors);
    this.lastSelectorSmoke = { ...smoke, at: new Date().toISOString() };
    await this.refreshSessionHeuristic(page);

    this.lastDriverMessage = `Attach hazır (CDP ${this.cfg.cdpUrl}, ${pages.length} tab)`;
  }

  /**
   * Pass 47 — Launch modu init (Pass 43-46 davranışı).
   *
   * Playwright launchPersistentContext ile yeni Chromium/Chrome açar.
   * CF managed challenge riski yüksek; sadece test/dev için.
   */
  private async initLaunch(): Promise<void> {
    this.actualMode = "launch";
    await mkdir(this.cfg.profileDir, { recursive: true });

    // Pass 45 — profile state detection.
    this.profileState = await this.detectProfileState();

    // Pass 44 — stale lock cleanup.
    for (const lockFile of [
      "SingletonLock",
      "SingletonCookie",
      "SingletonSocket",
    ]) {
      await unlink(join(this.cfg.profileDir, lockFile)).catch(() => undefined);
    }

    // Browser kind selection (Pass 47).
    let channel: "chrome" | undefined;
    let executablePath: string | undefined;
    const kind = this.cfg.browserKind;
    if (kind === "chrome") {
      channel = "chrome";
      this.actualBrowserKind = "chrome";
    } else if (kind === "brave") {
      // Brave macOS standard path — diğer OS'larda env ile override edilebilir.
      executablePath =
        process.env["MJ_BRIDGE_BRAVE_PATH"] ??
        "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser";
      this.actualBrowserKind = "brave";
    } else {
      this.actualBrowserKind = "chromium";
    }

    try {
      this.context = await chromium.launchPersistentContext(
        this.cfg.profileDir,
        {
          channel,
          executablePath,
          headless: this.cfg.headlessForTesting,
          viewport: { width: 1280, height: 900 },
          ignoreDefaultArgs: ["--enable-automation"],
        },
      );
      this.launchedChannel =
        kind === "chromium" ? "chromium" : kind === "brave" ? "chromium" : "chrome";
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (channel === "chrome" || executablePath) {
        // System Chrome/Brave bulunamadı — bundled Chromium fallback.
        // eslint-disable-next-line no-console
        console.warn(
          `[mj-bridge:playwright] ${kind} bulunamadı (${msg}); ` +
            "bundled Chromium'a düşülüyor. CF managed challenge döngüsü " +
            "olabilir — attach modu önerilir.",
        );
        this.context = await chromium.launchPersistentContext(
          this.cfg.profileDir,
          {
            headless: this.cfg.headlessForTesting,
            viewport: { width: 1280, height: 900 },
            ignoreDefaultArgs: ["--enable-automation"],
          },
        );
        this.launchedChannel = "chromium";
        this.actualBrowserKind = "chromium";
      } else {
        throw err;
      }
    }

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
    // Pass 59 — Watchdog timer'ı temiz kapat (bridge restart sırasında
    // dangling timer kalmasın).
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
      this.watchdogTimer = null;
    }
    if (this.context) {
      // Pass 47 — attach modunda context'i KAPATMA. Kullanıcının kendi
      // browser penceresine bağlıyız; close() pencereyi öldürür ve
      // login session'ı bozar. Sadece referansı bırak.
      if (this.actualMode === "launch") {
        await this.context.close();
      }
      this.context = null;
    }
  }

  /**
   * Pass 51 — MJ tab'ını deterministic seç. Aynı Chrome attach
   * session'ında birden fazla tab açıkken (kullanıcı admin login için
   * EtsyHub tab'ı da açmış olabilir) `pages()[0]` çoğu kez **MJ
   * olmayan** tab döner ve hem `health()` MJ session'ı yanlış raporlar
   * hem de `executeJob` admin tab'da prompt yazmaya çalışır → fail.
   *
   * Sıra:
   *   1. midjourney.com içeren tab (en güvenilir)
   *   2. selectorSmoke promptInput hit'i veren tab (logged-in MJ)
   *   3. ilk açık tab (hiçbiri uygun değilse — fallback)
   */
  private pickMjPage(): import("playwright").Page | undefined {
    const pages = this.context?.pages() ?? [];
    if (pages.length === 0) return undefined;
    const mj = pages.find((p) => p.url().includes("midjourney.com"));
    if (mj) return mj;
    return pages[0];
  }

  async health() {
    const page = this.pickMjPage();
    if (page) await this.refreshSessionHeuristic(page);
    const pages = this.context?.pages() ?? [];
    return {
      launched: this.context !== null,
      profileDir:
        this.actualMode === "attach"
          ? "(attach — kullanıcı --user-data-dir flag'inde manage eder)"
          : this.cfg.profileDir,
      pageCount: pages.length,
      activeUrl: page?.url() ?? pages[0]?.url(),
      mjLikelyLoggedIn: this.mjLikelyLoggedIn,
      lastChecked: this.lastSessionCheck.toISOString(),
      // Pass 45 — browser/profile mode görünürlüğü
      channel: this.launchedChannel,
      profileState:
        this.actualMode === "attach" ? "primed" : this.profileState,
      // Pass 46 — driver gözlem alanları (admin debug için)
      lastDriverMessage: this.lastDriverMessage,
      lastDriverError: this.lastDriverError,
      // Pass 47 — attach/launch mode + cdpUrl + browserKind
      mode: this.actualMode,
      cdpUrl: this.actualMode === "attach" ? this.cfg.cdpUrl : undefined,
      browserKind: this.actualBrowserKind,
      // Pass 59 — Watchdog probe geçmişi (admin canlı badge için).
      // probeHistory FIFO (max 10); en yeni en sonda.
      sessionProbe: {
        intervalMs: this.watchdogIntervalMs,
        probeCount: this.probeHistory.length,
        history: this.probeHistory,
      },
    };
  }

  /**
   * Pass 45 — Profile state detection.
   *
   * Chrome persistent profile dizini ilk kez kullanıldığında boş;
   * launch sonrası `Default/`, `Local State`, `Last Version` gibi
   * dosyalar oluşur. Bu dosyaların varlığı profile'ın "primed"
   * olduğunu gösterir — kullanıcı muhtemelen daha önce burada login
   * olmuştur.
   *
   * Sözleşme: launch ÖNCESİ çağrılır. Profile dizini yok veya boş →
   * "fresh"; içeriği var → "primed".
   */
  private async detectProfileState(): Promise<"fresh" | "primed"> {
    try {
      const stats = await stat(this.cfg.profileDir);
      if (!stats.isDirectory()) return "fresh";
      const entries = await readdir(this.cfg.profileDir);
      // Chrome'un başlatma sonrası bıraktığı tipik dosya/dizinler.
      const primedMarkers = [
        "Default",
        "Local State",
        "Last Version",
        "First Run",
        "Cookies",
      ];
      const hasMarker = entries.some((e) => primedMarkers.includes(e));
      return hasMarker ? "primed" : "fresh";
    } catch {
      // Dizin yoksa fresh.
      return "fresh";
    }
  }

  async focusBrowser(): Promise<void> {
    const page = this.pickMjPage();
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
    onProgressOriginal: DriverProgressCallback,
    signal: AbortSignal,
  ): Promise<void> {
    // Pass 46 — onProgress wrap. Her state transition'ında driver-level
    // lastDriverMessage + lastDriverError set; admin health endpoint'inde
    // görünür. Caller (job manager) kontratı bozulmaz.
    const onProgress: DriverProgressCallback = (update) => {
      if (update.message) this.lastDriverMessage = update.message;
      if (update.state === "FAILED") {
        this.lastDriverError = update.message ?? update.blockReason ?? null;
      } else if (update.state !== "AWAITING_CHALLENGE" && update.state !== "AWAITING_LOGIN") {
        // Geçici block durumlarında error temizleme; ama recoverable
        // state'lerde lastError'u ANADOĞAN tut (kullanıcı sebebi görsün).
        this.lastDriverError = null;
      }
      onProgressOriginal(update);
    };

    if (!this.context) {
      onProgress({
        state: "FAILED",
        blockReason: "browser-crashed",
        message: "Bridge init() henüz çağrılmadı",
      });
      return;
    }

    // Pass 60 — kind="upscale" ayrı executor; kind="generate" mevcut akış.
    if (job.request.kind === "upscale") {
      await this.executeUpscaleJob(job, onProgress, signal);
      return;
    }

    // Pass 66 — kind="describe" (Pass 65 audit'in düzeltmesi). Three-dots
    // menü üzerinden 4 prompt önerisi scrape eder.
    if (job.request.kind === "describe") {
      await this.executeDescribeJob(job, onProgress, signal);
      return;
    }

    if (job.request.kind !== "generate") {
      onProgress({
        state: "FAILED",
        blockReason: "internal-error",
        message: `kind="${job.request.kind}" henüz desteklenmiyor (V1.x)`,
      });
      return;
    }

    onProgress({ state: "OPENING_BROWSER", message: "Browser hazırlanıyor" });

    // Pass 51 — MJ tab'ını deterministic seç (admin/EtsyHub tab'ı
    // varsa ona prompt yazmaya çalışmasın).
    const page = this.pickMjPage() ?? (await this.context.newPage());
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

    // Pass 65 — Image-prompt akışı: submit ÖNCESİ "Add Images → Image
    // Prompts" popover'ından file input'a referans görselleri yükle.
    // MJ V8 web'de URL paste-as-image-prompt çalışmıyor; gerçek upload
    // şart. Reference URL'leri yoksa adım atlanır (no-op).
    const referenceUrls = job.request.params.imagePromptUrls ?? [];
    if (referenceUrls.length > 0) {
      onProgress({
        state: "SUBMITTING_PROMPT",
        message: `${referenceUrls.length} referans görsel yükleniyor`,
      });
      try {
        await attachImagePrompts(page, this.selectors, referenceUrls);
      } catch (err) {
        const reason: JobBlockReason =
          err instanceof SelectorMismatchError
            ? "selector-mismatch"
            : "internal-error";
        onProgress({
          state: "FAILED",
          blockReason: reason,
          message:
            err instanceof Error
              ? `Image-prompt upload fail: ${err.message}`
              : String(err),
        });
        return;
      }
    }

    // Submit prompt.
    onProgress({
      state: "SUBMITTING_PROMPT",
      message:
        referenceUrls.length > 0
          ? `Prompt + ${referenceUrls.length} referans gönderiliyor`
          : "Prompt gönderiliyor",
    });

    // Pass 49 — submit ÖNCESİ mevcut UUID'leri yakala (baseline).
    // waitForRender bu set'in DIŞINDA bir UUID'in 4 grid image'ı görünene
    // kadar bekleyecek. data-job-id artık DOM'da yok (Pass 43 stratejisi
    // geçersiz); image URL pattern'i tek güvenilir yol.
    const baselineUuids = await captureBaselineUuids(
      page,
      this.selectors,
    ).catch(() => new Set<string>());

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
      message: `Render bekleniyor (30-90sn) · baseline=${baselineUuids.size} UUID`,
    });

    let render;
    try {
      render = await waitForRender(page, this.selectors, {
        baselineUuids,
        timeoutMs: this.cfg.renderTimeoutMs,
        onPoll: (ms, n) => {
          if (signal.aborted) return;
          onProgress({
            state: "WAITING_FOR_RENDER",
            message: `Render bekleniyor… ${Math.floor(ms / 1000)}s · ${n} yeni img`,
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

  /**
   * Pass 60 — Upscale executor (kind="upscale").
   *
   * Akış:
   *   1. Parent /jobs/UUID?index=N sayfasına navigate
   *   2. Challenge / login probe (mevcut akış)
   *   3. Baseline UUIDs yakala
   *   4. triggerUpscale("subtle") buton click
   *   5. waitForUpscaleResult — yeni UUID + tek image
   *   6. Download (image-URL-based, browser-context fetch)
   *   7. COMPLETED + outputs (1 entry, gridIndex=0)
   *
   * Çıktı kontratı: outputs.length === 1 (upscale 4 grid değil, 1 image).
   * Caller (EtsyHub ingest) variantKind=UPSCALE + parentAssetId yazar.
   */
  private async executeUpscaleJob(
    job: { id: string; request: CreateJobRequest },
    onProgress: DriverProgressCallback,
    signal: AbortSignal,
  ): Promise<void> {
    if (job.request.kind !== "upscale") return; // type-narrow guard
    if (!this.context) {
      onProgress({
        state: "FAILED",
        blockReason: "browser-crashed",
        message: "Bridge init() henüz çağrılmadı",
      });
      return;
    }
    const { parentMjJobId, gridIndex, mode } = job.request;
    if (gridIndex < 0 || gridIndex > 3) {
      onProgress({
        state: "FAILED",
        blockReason: "internal-error",
        message: `Invalid gridIndex: ${gridIndex} (0..3 beklenir)`,
      });
      return;
    }

    onProgress({ state: "OPENING_BROWSER", message: "Browser hazırlanıyor" });
    const page = this.pickMjPage() ?? (await this.context.newPage());
    await page.bringToFront().catch(() => undefined);

    // Parent /jobs/UUID?index=N sayfasına git
    const parentUrl = `${this.urls.base}/jobs/${parentMjJobId}?index=${gridIndex}`;
    try {
      await page.goto(parentUrl, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      // Pass 60 — React lazy mount: domcontentloaded yetmiyor; networkidle
      // veya minimum 3sn wait lazım ki Subtle/Creative butonları DOM'a
      // gelsin. networkidle MJ'de uzun sürebilir; karma yaklaşım:
      // networkidle 5sn timeout + ardından sabit 1sn buffer.
      await page
        .waitForLoadState("networkidle", { timeout: 5_000 })
        .catch(() => undefined);
      await page.waitForTimeout(1_000);
    } catch (err) {
      onProgress({
        state: "FAILED",
        blockReason: "browser-crashed",
        message: `Parent /jobs navigate fail: ${err instanceof Error ? err.message : "unknown"}`,
      });
      return;
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

    // Baseline UUID'ler — sayfada zaten parent + diğer önceki render'lar var
    onProgress({ state: "SUBMITTING_PROMPT", message: `Upscale ${mode} tetikleniyor` });
    const baselineUuids = await captureBaselineUuids(page, this.selectors).catch(
      () => new Set<string>(),
    );

    // Trigger Upscale Subtle/Creative
    try {
      await triggerUpscale(page, this.selectors, mode);
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

    onProgress({
      state: "WAITING_FOR_RENDER",
      message: `Upscale render bekleniyor · baseline=${baselineUuids.size} UUID`,
    });

    let result;
    try {
      result = await waitForUpscaleResult(page, this.selectors, {
        // Pass 61 — parentMjJobId polling stratejisinin temel sinyali:
        // page.url() parent UUID'den farklı bir UUID'e değiştiğinde
        // upscale çıktı UUID'ini tespit eder.
        parentMjJobId,
        baselineUuids,
        timeoutMs: this.cfg.renderTimeoutMs,
        onPoll: (ms, currentUrl) => {
          if (signal.aborted) return;
          // currentUrl logla — debug için
          const urlTail = currentUrl.split("/").pop()?.slice(0, 30);
          onProgress({
            state: "WAITING_FOR_RENDER",
            message: `Upscale bekleniyor… ${Math.floor(ms / 1000)}s · url=${urlTail}`,
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
      mjJobId: result.mjJobId,
      mjMetadata: {
        upscaleMode: mode,
        parentMjJobId,
        parentGridIndex: gridIndex,
      },
    });

    // Download (single image, gridIndex=0)
    onProgress({
      state: "DOWNLOADING",
      message: "Upscale çıktısı indiriliyor",
    });

    let downloaded;
    try {
      downloaded = await downloadGridImages(
        page,
        [result.imageUrl],
        this.cfg.outputsDir,
        job.id,
      );
    } catch (err) {
      onProgress({
        state: "FAILED",
        blockReason: "internal-error",
        message: `Upscale download fail: ${err instanceof Error ? err.message : "unknown"}`,
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
      mjJobId: result.mjJobId,
      message: `Upscale ${mode} tamamlandı`,
    });
  }

  /**
   * Pass 66 — Describe executor (kind="describe").
   *
   * Pass 65 audit'in YANLIŞ "describe yok" sonucunun düzeltmesi:
   * Kullanıcı ekran görüntüleri + canlı probe doğrulaması (e2e probe v3)
   * gösterdi ki MJ V8 web'de describe **var** — three-dots menü üzerinden
   * yüklü thumbnail'in dropdown'undan tetikleniyor.
   *
   * Akış:
   *   1. /imagine sayfasına navigate (login/challenge probe)
   *   2. describeImage helper çağrısı (Add Images popover → Image Prompts
   *      tab → setInputFiles → hover thumbnail → vertical-dots → "Describe"
   *      → 4 prompt scrape)
   *   3. COMPLETED state + mjMetadata.describePrompts[]
   *
   * Çıktı kontratı: outputs[] BOŞ (describe görsel üretmez, prompt verir).
   * mjMetadata.describePrompts[] dolu, mjMetadata.sourceImageUrl dolu.
   * Caller (EtsyHub midjourney.service) bu metadata'yı saklayıp UI'da
   * gösterir; MidjourneyAsset row açılmaz.
   */
  private async executeDescribeJob(
    job: { id: string; request: CreateJobRequest },
    onProgress: DriverProgressCallback,
    signal: AbortSignal,
  ): Promise<void> {
    if (job.request.kind !== "describe") return; // type-narrow guard
    if (!this.context) {
      onProgress({
        state: "FAILED",
        blockReason: "browser-crashed",
        message: "Bridge init() henüz çağrılmadı",
      });
      return;
    }
    const { imageUrl } = job.request;
    if (!imageUrl || !imageUrl.startsWith("https://")) {
      onProgress({
        state: "FAILED",
        blockReason: "internal-error",
        message: `Describe imageUrl geçersiz (HTTPS şart): ${imageUrl?.slice(0, 80)}`,
      });
      return;
    }

    onProgress({ state: "OPENING_BROWSER", message: "Browser hazırlanıyor" });

    const page = this.pickMjPage() ?? (await this.context.newPage());
    await page.bringToFront().catch(() => undefined);

    // /imagine sayfasına navigate (zaten oradaysa idempotent)
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

    onProgress({
      state: "SUBMITTING_PROMPT",
      message: "Describe için image yükleniyor + tetikleniyor",
    });

    let describeResult;
    try {
      describeResult = await describeImage(page, this.selectors, imageUrl, {
        resultTimeoutMs: this.cfg.renderTimeoutMs,
      });
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

    onProgress({
      state: "COMPLETED",
      outputs: [], // describe görsel üretmez
      mjMetadata: {
        kind: "describe",
        sourceImageUrl: imageUrl,
        thumbnailSrc: describeResult.thumbSrc,
        describePrompts: describeResult.prompts,
      },
      message: `Describe tamamlandı: ${describeResult.prompts.length} prompt`,
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
