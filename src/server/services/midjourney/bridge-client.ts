// EtsyHub ↔ MJ Bridge HTTP client.
//
// Bridge ayrı paket (`mj-bridge/`) — cross-package import yok. Tipler
// bu dosyada manuel kopyalanır; bridge tarafı (`mj-bridge/src/types.ts`)
// ile SENKRON tutmak zorunlu (kontrat değişimi her iki tarafı kırar).
//
// Pass 41 doc §3.3:
//   - Loopback only (127.0.0.1:8780)
//   - Auth: X-Bridge-Token header
//   - JSON body
//
// Settings:
//   MJ_BRIDGE_URL    — http://127.0.0.1:8780 (default)
//   MJ_BRIDGE_TOKEN  — shared secret (kullanıcı `.env.local`'den okur;
//                        bridge ayrı dotenv ile aynı token'ı bilir)

import { env } from "@/lib/env";

export type BridgeJobState =
  | "QUEUED"
  | "OPENING_BROWSER"
  | "AWAITING_LOGIN"
  | "AWAITING_CHALLENGE"
  | "SUBMITTING_PROMPT"
  | "WAITING_FOR_RENDER"
  | "COLLECTING_OUTPUTS"
  | "DOWNLOADING"
  | "IMPORTING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export type BridgeJobBlockReason =
  | "challenge-required"
  | "login-required"
  | "render-timeout"
  | "browser-crashed"
  | "selector-mismatch"
  | "rate-limited"
  | "user-cancelled"
  | "internal-error";

export type BridgeAspectRatio =
  | "1:1"
  | "2:3"
  | "3:2"
  | "4:3"
  | "3:4"
  | "16:9"
  | "9:16";

export type BridgeGenerateRequest = {
  kind: "generate";
  params: {
    prompt: string;
    aspectRatio: BridgeAspectRatio;
    version?: string;
    styleRaw?: boolean;
    stylize?: number;
    chaos?: number;
    imagePromptUrls?: string[];
    styleReferenceUrls?: string[];
    omniReferenceUrl?: string;
    omniWeight?: number;
  };
  etsyhubJobId?: string;
};

/**
 * Pass 60 — Upscale request kontrat.
 *
 * Parent job MJ web tarafında zaten render edildi (bizim
 * MidjourneyJob.mjJobId'miz). Bridge `/jobs/{parentMjJobId}?index={gridIndex}`
 * sayfasına gider, "Upscale Subtle/Creative" buton tıklar, render bekler.
 *
 * MVP: mode="subtle"; "creative" type'ta destek var ama UI'da Pass 60'da
 * sadece subtle button gösterilir.
 */
export type BridgeUpscaleRequest = {
  kind: "upscale";
  parentMjJobId: string;
  gridIndex: 0 | 1 | 2 | 3;
  mode: "subtle" | "creative";
  etsyhubJobId?: string;
};

/**
 * Pass 66 — Describe request kontrat (Pass 65 audit'in düzeltmesi).
 *
 * Bridge driver imageUrl'i indirir, /imagine "Add Images → Image Prompts"
 * popover'ından upload eder, yüklü thumbnail üzerine hover edip
 * vertical-dots menüden "Describe" tetikler. Sonuç: 4 prompt önerisi.
 *
 * Sözleşme:
 *   - imageUrl HTTPS olmak zorunda (R17.2)
 *   - Public erişilebilir (browser context auth/cookie'siz fetch eder)
 *   - Çıktı görsel YOK; mjMetadata.describePrompts[] ve
 *     mjMetadata.sourceImageUrl + mjMetadata.thumbnailSrc dolar
 */
export type BridgeDescribeRequest = {
  kind: "describe";
  imageUrl: string;
  etsyhubJobId?: string;
};

export type BridgeJobRequest =
  | BridgeGenerateRequest
  | BridgeUpscaleRequest
  | BridgeDescribeRequest;

export type BridgeJobOutput = {
  gridIndex: number;
  localPath: string;
  fetchUrl: string;
  sourceUrl?: string;
};

export type BridgeJobSnapshot = {
  id: string;
  state: BridgeJobState;
  blockReason?: BridgeJobBlockReason;
  /** Pass 60 — generate veya upscale (BridgeJobRequest discriminated union). */
  request: BridgeJobRequest;
  mjJobId?: string;
  mjMetadata?: Record<string, unknown>;
  outputs?: BridgeJobOutput[];
  enqueuedAt: string;
  startedAt?: string;
  finishedAt?: string;
  lastMessage?: string;
};

export type BridgeHealth = {
  ok: true;
  version: string;
  /** Pass 43 — driver kimliği: "mock" | "playwright". */
  driver: string;
  browser: {
    launched: boolean;
    profileDir: string;
    pageCount: number;
    activeUrl?: string;
    /** Pass 45 — Chrome kanalı (chrome=system, chromium=test, mock=mock). */
    channel?: "chrome" | "chromium" | "mock";
    /** Pass 45 — profile durumu (fresh=ilk kullanım, primed=daha önce başlatılmış, absent=mock). */
    profileState?: "fresh" | "primed" | "absent";
    /** Pass 46 — son driver mesajı (debug için admin UI). */
    lastDriverMessage?: string | null;
    /** Pass 46 — son driver hatası (recoverable durumlarda korunur). */
    lastDriverError?: string | null;
    /**
     * Pass 47 — Browser yaşam döngüsü modu.
     *   "attach": kullanıcı browser'ına CDP ile bağlandı (önerilen)
     *   "launch": bridge yeni browser açtı (test/dev)
     *   "mock":   browser yok
     */
    mode?: "attach" | "launch" | "mock";
    /** Pass 47 — Attach modunda CDP URL. */
    cdpUrl?: string;
    /** Pass 47 — Browser binary kind (admin teşhis için). */
    browserKind?: "chrome" | "brave" | "chromium" | "external" | "mock";
    /**
     * Pass 59 — Watchdog session probe geçmişi. Bridge ayakta kaldığı
     * sürece periyodik MJ login probe yapar (default 60sn). Admin UI
     * canlı badge gösterir; sessiz session düşüşlerini yakalar.
     */
    sessionProbe?: {
      intervalMs: number;
      probeCount: number;
      history: Array<{
        at: string;
        likelyLoggedIn: boolean;
        selectorPromptInputFound: boolean;
      }>;
    };
  };
  /**
   * Pass 43 — selector smoke (yalnız PlaywrightDriver). MockDriver'da null.
   * MJ web UI değiştiyse bridge selector_overrides ile kalibre edilmeli.
   */
  selectorSmoke?: {
    promptInputFound: boolean;
    loginIndicatorFound: boolean;
    signInLinkFound: boolean;
    at: string;
  } | null;
  mjSession: {
    likelyLoggedIn: boolean;
    lastChecked: string;
  };
  jobs: {
    queued: number;
    running: number;
    blocked: number;
    completed: number;
    failed: number;
  };
  recentJobs: Array<Pick<BridgeJobSnapshot, "id" | "state" | "enqueuedAt">>;
  startedAt: string;
};

export class BridgeUnreachableError extends Error {
  constructor(reason: string) {
    super(`MJ Bridge erişilemiyor: ${reason}`);
    this.name = "BridgeUnreachableError";
  }
}

export class BridgeAuthError extends Error {
  constructor() {
    super("MJ Bridge auth fail (X-Bridge-Token yanlış / eksik)");
    this.name = "BridgeAuthError";
  }
}

export type BridgeClientConfig = {
  url: string;
  token: string;
  /** Default 5sn — health & cancel için kısa; ingest stream için longer override. */
  timeoutMs?: number;
};

export class BridgeClient {
  private cfg: BridgeClientConfig;

  constructor(cfg: BridgeClientConfig) {
    this.cfg = { timeoutMs: 5000, ...cfg };
  }

  /** Bridge sağlık raporu — admin sayfası bu endpoint'i kullanır. */
  async health(): Promise<BridgeHealth> {
    return this.json<BridgeHealth>("GET", "/health");
  }

  /** Yeni job enqueue — bridgeJobId döner.
   * Pass 60 — generate veya upscale (BridgeJobRequest discriminated union). */
  async enqueueJob(req: BridgeJobRequest): Promise<BridgeJobSnapshot> {
    return this.json<BridgeJobSnapshot>("POST", "/jobs", req);
  }

  /** Job snapshot — worker polling'i bu endpoint'i çağırır. */
  async getJob(bridgeJobId: string): Promise<BridgeJobSnapshot> {
    return this.json<BridgeJobSnapshot>("GET", `/jobs/${bridgeJobId}`);
  }

  /** Job iptal — manuel cancel veya timeout. */
  async cancelJob(bridgeJobId: string): Promise<BridgeJobSnapshot> {
    return this.json<BridgeJobSnapshot>("POST", `/jobs/${bridgeJobId}/cancel`);
  }

  /** Browser pencerini öne getir — UI'dan tetiklenir (challenge / login). */
  async focusBrowser(): Promise<{ ok: boolean }> {
    return this.json<{ ok: boolean }>("POST", "/focus");
  }

  /**
   * Output stream fetch — ingest worker'ı PNG bytes'ı buradan alır.
   *
   * Caller bunu MinIO'ya upload eder. Bridge dosyayı diskinde tutar; EtsyHub
   * upload sonrası bridge'den silmeyi `cancelJob` veya housekeeping
   * kararına bırakır (V1: bridge kendi cleanup yok).
   */
  async fetchOutput(
    bridgeJobId: string,
    gridIndex: number,
  ): Promise<Buffer> {
    const url = `${this.cfg.url}/jobs/${bridgeJobId}/outputs/${gridIndex}`;
    const ctrl = new AbortController();
    const timer = setTimeout(
      () => ctrl.abort(),
      this.cfg.timeoutMs! * 6, // ingest 30sn
    );
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: { "X-Bridge-Token": this.cfg.token },
        signal: ctrl.signal,
        cache: "no-store",
      });
      if (res.status === 401) throw new BridgeAuthError();
      if (!res.ok) {
        throw new BridgeUnreachableError(
          `output fetch ${res.status}: ${await res.text().catch(() => "")}`,
        );
      }
      const ab = await res.arrayBuffer();
      return Buffer.from(ab);
    } catch (err) {
      if (err instanceof BridgeAuthError) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      throw new BridgeUnreachableError(msg);
    } finally {
      clearTimeout(timer);
    }
  }

  private async json<T>(
    method: "GET" | "POST",
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.cfg.url}${path}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.cfg.timeoutMs!);
    try {
      const res = await fetch(url, {
        method,
        headers: {
          "X-Bridge-Token": this.cfg.token,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: ctrl.signal,
        // Pass 59 — Next.js fetch cache'i bridge'in canlı state'ini
        // (sessionProbe history, lastDriverMessage, vs) eski tutar.
        // Bridge çağrıları ALWAYS fresh; cache yok.
        cache: "no-store",
      });
      if (res.status === 401) throw new BridgeAuthError();
      const text = await res.text();
      if (!res.ok) {
        throw new BridgeUnreachableError(
          `${method} ${path} → ${res.status}: ${text.slice(0, 200)}`,
        );
      }
      try {
        return JSON.parse(text) as T;
      } catch {
        throw new BridgeUnreachableError(
          `Bridge JSON parse fail: ${text.slice(0, 200)}`,
        );
      }
    } catch (err) {
      if (err instanceof BridgeAuthError) throw err;
      if (err instanceof BridgeUnreachableError) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      throw new BridgeUnreachableError(msg);
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * Default client factory — env'den config'i alır.
 *
 * Çağrı: `getBridgeClient()`
 *
 * Env yok / token boş → BridgeUnreachableError fırlatır (caller fallback yazsın).
 */
export function getBridgeClient(): BridgeClient {
  const url = env.MJ_BRIDGE_URL ?? "http://127.0.0.1:8780";
  const token = env.MJ_BRIDGE_TOKEN ?? "";
  if (!token) {
    throw new BridgeUnreachableError(
      "MJ_BRIDGE_TOKEN env tanımsız — bridge yapılandırılmamış.",
    );
  }
  return new BridgeClient({ url, token });
}
