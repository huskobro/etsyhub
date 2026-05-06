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
   * Style reference — `--sref URL`. V1.x'te aktif edilecek.
   */
  styleReferenceUrls?: string[];
  /**
   * Omni reference (V7+) — `--oref URL --ow N`. V1.x'te aktif edilecek.
   */
  omniReferenceUrl?: string;
  omniWeight?: number;
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
      /** Hedef render'ın bridge job id'si. */
      parentBridgeJobId: string;
      /** Grid içindeki pozisyon (U1=0, U2=1, U3=2, U4=3). */
      gridIndex: 0 | 1 | 2 | 3;
      etsyhubJobId?: string;
    }
  | {
      kind: "variation";
      parentBridgeJobId: string;
      gridIndex: 0 | 1 | 2 | 3;
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
