// MJ Bridge — Shared kontrat tipleri.
//
// EtsyHub tarafı (`src/server/services/midjourney/bridge-client.ts`) bu
// tipleri ayrı kopya tutar (mj-bridge ayrı paket; cross-package import yok).
// Tipleri DEĞİŞTİRİRKEN her iki tarafı SENKRON güncellemek zorunlu —
// kontrat kırılırsa bridge ↔ EtsyHub konuşamaz.
//
// Pass 41 design doc: `docs/plans/2026-05-06-midjourney-web-bridge-design.md`

/**
 * MJ Bridge job lifecycle. State machine §4.3 design doc.
 *
 *   QUEUED → OPENING_BROWSER → AWAITING_LOGIN → SUBMITTING_PROMPT →
 *   WAITING_FOR_RENDER → COLLECTING_OUTPUTS → DOWNLOADING → IMPORTING →
 *   COMPLETED
 *
 * Yan dallar:
 *   • AWAITING_CHALLENGE — herhangi bir aşamada Cloudflare/hCaptcha tetiklenir
 *   • FAILED              — terminal: timeout, browser crash, manuel cancel
 *   • CANCELLED           — terminal: kullanıcı iptal etti
 */
export type JobState =
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

/** Terminal state'ler — yeni transition kabul etmez. */
export const TERMINAL_STATES: ReadonlyArray<JobState> = [
  "COMPLETED",
  "FAILED",
  "CANCELLED",
];

export function isTerminal(state: JobState): boolean {
  return (TERMINAL_STATES as JobState[]).includes(state);
}

/**
 * Job neden duraklatıldı / başarısız oldu — operatör için.
 *
 * Pass 41 doc §4.4 — UI banner "Bridge'i öne getir" buton bu reason'ı
 * okur ve uygun mesajı seçer.
 */
export type JobBlockReason =
  | "challenge-required"   // Cloudflare/hCaptcha — kullanıcı çözmeli
  | "login-required"        // MJ login sayfası — kullanıcı login olmalı
  | "render-timeout"        // Rendering >2dk — manuel kontrol gerek
  | "browser-crashed"       // Playwright crash
  | "selector-mismatch"     // DOM yapısı değişti — bridge update lazım
  | "rate-limited"          // MJ rate limit cevabı algılandı
  | "user-cancelled"        // POST /jobs/:id/cancel
  | "internal-error";       // generic

/**
 * Aspect ratio — MJ web flag karşılığı `--ar W:H` parametresine map'lenir.
 * EtsyHub `ImageProvider.ImageAspectRatio` ile birebir uyumlu (Phase 5).
 */
export type AspectRatio =
  | "1:1"
  | "2:3"
  | "3:2"
  | "4:3"
  | "3:4"
  | "16:9"
  | "9:16";

/**
 * MJ generate parametreleri.
 *
 * Pass 42 — V1 minimal set; V1.x'te omni-ref (--oref --ow), style-ref
 * (--sref) eklenecek. Reference URL'ler HTTPS olmak zorunda (R17.2 — local
 * file path / data: URI yasak).
 */
export type MjGenerateParams = {
  prompt: string;
  aspectRatio: AspectRatio;
  /** MJ version flag — `--v 6.1` | `7` | `8.1`. Default version provider'da. */
  version?: string;
  /** `--style raw` modifier'ı. */
  styleRaw?: boolean;
  /** Stylize değeri 0-1000 — `--stylize N`. */
  stylize?: number;
  /** Chaos değeri 0-100 — `--chaos N`. */
  chaos?: number;
  /**
   * Image-to-image / image-prompt URL'leri. MJ web prompt başına URL
   * yapıştırma şeklinde girilir. HTTPS only.
   */
  imagePromptUrls?: string[];
  /**
   * Style reference — `--sref URL [URL ...]`. Pass 71'de UI/service
   * input alanları geldi. Pass 73 audit notu: AutoSail audit kanıtı
   * `--sref` weight pattern destekliyor (`URL::N`); Pass 73 V1
   * scope'unda weight desteği YOK (sadece URL list). Pass 74+'da
   * weight eklenebilir.
   */
  styleReferenceUrls?: string[];
  /**
   * Omni reference (V7+) — `--oref URL --ow N`. Pass 71'de UI/service
   * input alanları geldi. cref ile mutually exclusive (V7+ only).
   */
  omniReferenceUrl?: string;
  omniWeight?: number;
  /**
   * Pass 73 — Character reference (V6-only) — `--cref URL [URL ...]`.
   * AutoSail audit (Pass 73): cref V6 model gerekli, oref ile mutually
   * exclusive. Weight desteği YOK (eklenti `--cref URL` URL'leri
   * space-separated push ediyor; `--cw` flag'i kullanılmıyor).
   * Service tarafı omniReferenceUrl ile birlikte gönderilirse
   * mutually-exclusive guard reddeder.
   */
  characterReferenceUrls?: string[];
  /**
   * Pass 71 — API-first submit opt-in flag (deneysel).
   * Default false → bridge DOM submit (Pass 49 production-grade).
   * true → bridge önce `POST /api/submit-jobs` dener (ghost-job riski).
   */
  preferApiSubmit?: boolean;
};

/**
 * Bridge'e gönderilen yeni job payload'ı.
 *
 * `kind` field'ı ileride `describe`, `upscale`, `variation` action'larını
 * ayırır — V1 yalnız `generate`.
 */
export type CreateJobRequest =
  | {
      kind: "generate";
      params: MjGenerateParams;
      /** EtsyHub tarafı kendi job id'sini bağlar — bridge'in cevabıyla cross-ref. */
      etsyhubJobId?: string;
    }
  | {
      kind: "describe";
      /** Describe edilecek görselin HTTPS URL'i. */
      imageUrl: string;
      etsyhubJobId?: string;
    }
  | {
      kind: "upscale";
      /**
       * Pass 60 — MJ web tarafı parent job UUID'si (cdn.midjourney.com'daki).
       * Bridge `/jobs/{parentMjJobId}?index={gridIndex}` URL'ine navigate
       * edip "Upscale Subtle/Creative" butonuna tıklar.
       */
      parentMjJobId: string;
      /** Grid içindeki pozisyon (0..3) — generate'den gelen 4 grid'den biri. */
      gridIndex: 0 | 1 | 2 | 3;
      /** Pass 60 — MVP "subtle" desteklenir; "creative" ileride. */
      mode: "subtle" | "creative";
      etsyhubJobId?: string;
    }
  | {
      kind: "variation";
      /** Pass 60 — variation için aynı pattern (ama bu turda implementasyon yok). */
      parentMjJobId: string;
      gridIndex: 0 | 1 | 2 | 3;
      mode: "subtle" | "strong";
      etsyhubJobId?: string;
    };

/**
 * Bridge job snapshot — `GET /jobs/:id` cevabı.
 *
 * `outputs` yalnız COLLECTING_OUTPUTS+ state'lerinde dolar.
 */
export type JobSnapshot = {
  id: string;
  state: JobState;
  blockReason?: JobBlockReason;
  request: CreateJobRequest;
  /** MJ web tarafı job id (URL'den / DOM'dan parse). */
  mjJobId?: string;
  /** MJ-side metadata (seed, weight, model — DOM'dan parse edilecek). */
  mjMetadata?: Record<string, unknown>;
  /**
   * Render outputs — bridge diskinde dosya yolu + indirme sırasında geçici
   * URL'ler. EtsyHub `IMPORTING` adımında bunları MinIO'ya kopyalar.
   */
  outputs?: Array<{
    gridIndex: number;
    /** Bridge tarafı dosya yolu — `data/outputs/{job-id}/{n}.png`. */
    localPath: string;
    /** Bridge'in HTTP üzerinden serve ettiği signed URL (yalnız ingest için). */
    fetchUrl: string;
    /** MJ CDN URL — kayıt için. */
    sourceUrl?: string;
  }>;
  enqueuedAt: string;       // ISO8601
  startedAt?: string;
  finishedAt?: string;
  /** Operasyonel debug — son bridge log satırı (hata mesajı, vb.). */
  lastMessage?: string;
};

/** Bridge sağlık raporu — `GET /health` ve `GET /admin/state` cevabı. */
export type BridgeHealth = {
  /** Bridge çalışıyor mu — her zaman true (yanıt geliyorsa). */
  ok: true;
  version: string;
  /** Pass 43 — driver kimliği: "mock" | "playwright". Admin UI gösterir. */
  driver: string;
  /** Browser durumu. */
  browser: {
    /** Playwright Chromium başlatıldı mı. */
    launched: boolean;
    /** Persistent profile yolu. */
    profileDir: string;
    /** Açık tab sayısı. */
    pageCount: number;
    /** Aktif tab URL'i. */
    activeUrl?: string;
    /**
     * Pass 45 — hangi Chromium kanalı kullanılıyor.
     * - "chrome": system Google Chrome (Cloudflare daha az tetiklenir)
     * - "chromium": Playwright bundled (test build; CF agresif)
     * - "mock": gerçek browser yok
     */
    channel?: "chrome" | "chromium" | "mock";
    /**
     * Pass 45 — profile dizin durumu.
     * - "fresh": dizin yeni veya hiç login/cookie yok (ilk kullanım)
     * - "primed": daha önce başlatılmış, içinde Chrome state var
     * - "absent": dizin yok / mock
     */
    profileState?: "fresh" | "primed" | "absent";
    /**
     * Pass 46 — son driver mesajı (init veya executeJob içinde set).
     * Admin UI'da debug için görünür. null → henüz iş çalışmadı.
     */
    lastDriverMessage?: string | null;
    /**
     * Pass 46 — son driver hatası. AWAITING durumlarında korunur,
     * COMPLETED'da temizlenir. Admin "neden takılı" sorusunu cevaplar.
     */
    lastDriverError?: string | null;
    /**
     * Pass 47 — Browser yaşam döngüsü modu.
     *   "attach": kullanıcı browser'ına CDP ile bağlandı (önerilen)
     *   "launch": bridge yeni browser açtı (test/dev)
     *   "mock":   browser yok
     */
    mode?: "attach" | "launch" | "mock";
    /** Pass 47 — Attach modunda kullanılan CDP URL (admin teşhis için). */
    cdpUrl?: string;
    /**
     * Pass 47 — Browser binary kind (admin teşhis için).
     *   "external": kullanıcı tarafından başlatılmış (attach)
     *   "chrome" / "brave" / "chromium": launch modunda hangisi
     *   "mock": mock driver
     */
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
   * Pass 43 — Boot-time selector smoke (yalnız PlaywrightDriver dolu;
   * MockDriver null). MJ web UI değiştiyse bridge selector_overrides ile
   * kalibre edilmeli.
   */
  selectorSmoke?: {
    promptInputFound: boolean;
    loginIndicatorFound: boolean;
    signInLinkFound: boolean;
    at: string;
  } | null;
  /** MJ login durumu — DOM heuristic'ine göre. */
  mjSession: {
    likelyLoggedIn: boolean;
    /** Algılandığı en son zaman. */
    lastChecked: string;
  };
  /** Aktif/queued job sayısı. */
  jobs: {
    queued: number;
    running: number;
    blocked: number;
    completed: number;
    failed: number;
  };
  /** En son n job. */
  recentJobs: Array<Pick<JobSnapshot, "id" | "state" | "enqueuedAt">>;
  startedAt: string;
};

/** Standart hata cevabı. */
export type BridgeError = {
  ok: false;
  error: string;
  code?: string;
};
