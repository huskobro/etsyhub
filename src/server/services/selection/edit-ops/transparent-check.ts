// Phase 7 Task 6 — Transparent PNG kontrolü edit-op stub.
//
// Bu task'te yalnız INTERFACE — gerçek implementasyon Task 8 (Phase 6
// alpha-check eşiklerinin LOCAL DUPLICATE'i; Phase 6 service'ine
// dokunulmaz, davranışsal uyum eşik sayıları kopyalanır).
//
// Kontrat (plan Task 8, design Section 5):
//   - Input: `{ inputAssetId }`
//   - Output: `{ ok, signals, summary }` — **asset üretmez, yalnız
//     raporlar**.
//   - Side-effect: Yok (read-only analiz).
//
// Asset üretmemesi orchestrator için kritik: `editedAssetId` /
// `lastUndoableAssetId` değişmez; yalnız `editHistoryJson`'a op record
// eklenir (`{ op: "transparent-check", at, result }`).
//
// Stub Task 8'e kadar throw eder; Task 6 orchestrator testleri vi.mock
// ile override eder.

export type TransparentCheckInput = {
  inputAssetId: string;
};

export type TransparentCheckSignals = {
  hasAlphaChannel: boolean;
  alphaCoveragePercent: number;
  edgeContaminationPercent: number;
};

export type TransparentCheckResult = {
  ok: boolean;
  signals: TransparentCheckSignals;
  summary: string;
};

/**
 * Asset'in transparent PNG kalitesini analiz eder; rapor döner.
 *
 * **Stub** — Task 8'de implement edilecek (Sharp metadata + alpha
 * coverage + edge contamination; Phase 6 alpha-check ile sayısal eşik
 * uyumu).
 */
export async function transparentCheck(
  input: TransparentCheckInput,
): Promise<TransparentCheckResult> {
  void input;
  throw new Error(
    "transparentCheck Task 8'de implement edilecek (stub)",
  );
}
