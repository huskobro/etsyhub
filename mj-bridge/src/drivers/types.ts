// Driver kontratı — mock + real Playwright driver'ı bu interface'e uyar.
//
// Job manager (in `src/server/job-manager.ts`) driver'ı state machine
// progresinde çağırır. Driver Implementation:
//   - Mock: deterministic transitions, no browser
//   - Real: Playwright + visible Chromium
//
// İkisi de SAME contract → caller (job manager) tek kod yolu yazar.

import type {
  CreateJobRequest,
  JobSnapshot,
  JobState,
  JobBlockReason,
} from "../types.js";

/**
 * Driver bağlamı — `executeJob` boyunca driver'ın state'i caller'a
 * bildirebileceği callback. Job manager bu callback'i alıp DB'ye
 * (in-memory + JSONL) yazar.
 */
export type DriverProgressCallback = (update: {
  state: JobState;
  blockReason?: JobBlockReason;
  message?: string;
  /** MJ-side capture — ulaştıkça günceller. */
  mjJobId?: string;
  mjMetadata?: Record<string, unknown>;
  outputs?: JobSnapshot["outputs"];
}) => void;

/**
 * Driver — bir MJ job'unu state machine boyunca yürütür.
 *
 * Sözleşme:
 *   - `executeJob` çağrıldığında driver job'u QUEUED'tan terminal state'e
 *     kadar ilerletir (COMPLETED | FAILED | CANCELLED).
 *   - Driver ara state'lerde `onProgress` callback'i ile job manager'a haber
 *     verir. Job manager bu state'i DB'ye flush eder.
 *   - Driver kendi state'i tutmaz — caller (job manager) state owner.
 *   - `cancel()` job manager dışarıdan tetikler; driver iyi-niyetle durur,
 *     CANCELLED state'i caller'ın yazma sorumluluğu.
 */
export interface BridgeDriver {
  /** Driver kimliği — admin görünümünde "mock" / "playwright". */
  readonly id: string;

  /**
   * Bridge bootstrap — process başlangıcında bir kez çağrılır.
   * Real driver: Playwright launch, persistent profile load.
   * Mock driver: no-op.
   */
  init(): Promise<void>;

  /** Bridge shutdown — graceful close. */
  shutdown(): Promise<void>;

  /**
   * Bridge sağlığı — Health endpoint için.
   * Real driver: browser pid, page count, MJ login heuristic.
   * Mock driver: sabit "ok".
   */
  health(): Promise<{
    launched: boolean;
    profileDir: string;
    pageCount: number;
    activeUrl?: string;
    mjLikelyLoggedIn: boolean;
    lastChecked: string;
    /**
     * Pass 45 — browser channel: real driver "chrome"|"chromium",
     * mock driver "mock". Admin UI gösterir; CF managed challenge
     * tanı/teşhis için kritik (chromium = test build = sürekli challenge).
     */
    channel: "chrome" | "chromium" | "mock";
    /**
     * Pass 45 — profile state: "fresh" (ilk kullanım), "primed" (Chrome
     * daha önce başlatılmış), "absent" (mock — gerçek profile yok).
     */
    profileState: "fresh" | "primed" | "absent";
    /**
     * Pass 46 — son driver mesajı (admin debug için). null = henüz
     * job çalışmadı. Driver state machine ilerledikçe güncellenir.
     */
    lastDriverMessage: string | null;
    /**
     * Pass 46 — son driver hatası. Recoverable state'lerde
     * (AWAITING_CHALLENGE/LOGIN) korunur, COMPLETED'da temizlenir.
     */
    lastDriverError: string | null;
    /**
     * Pass 47 — Browser yaşam döngüsü modu.
     *   "attach":  kullanıcının var olan Brave/Chrome'una CDP ile bağlı
     *   "launch":  bridge yeni Chromium/Chrome açtı
     *   "mock":    mock driver (browser yok)
     */
    mode: "attach" | "launch" | "mock";
    /** Pass 47 — Attach modunda CDP endpoint URL (yalnız attach'te dolu). */
    cdpUrl?: string;
    /**
     * Pass 47 — Browser binary kind.
     *   "chrome":   system Google Chrome (launch modu)
     *   "brave":    system Brave (launch modu)
     *   "chromium": Playwright bundled (launch modu — test build)
     *   "external": kullanıcı tarafından başlatılmış (attach modu)
     *   "mock":     mock driver
     */
    browserKind: "chrome" | "brave" | "chromium" | "external" | "mock";
  }>;

  /**
   * Job execute — state machine'i caller adına yürütür.
   *
   * Driver SADECE state transitions raporlar; job persistence (in-memory
   * + JSONL) caller sorumluluğu. Driver throw ederse caller FAILED state
   * yazar.
   */
  executeJob(
    job: { id: string; request: CreateJobRequest },
    onProgress: DriverProgressCallback,
    signal: AbortSignal,
  ): Promise<void>;

  /**
   * Browser pencerini öne getir — UI'dan tetiklenir (challenge / login).
   * Real driver: Playwright `page.bringToFront()`.
   * Mock driver: no-op.
   */
  focusBrowser(): Promise<void>;
}
