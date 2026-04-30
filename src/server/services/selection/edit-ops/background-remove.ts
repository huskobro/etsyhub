// Phase 7 Task 6 — Background remove edit-op stub.
//
// Bu task'te yalnız INTERFACE — gerçek implementasyon Task 9 (algoritma:
// `@imgly/background-removal` WASM); BullMQ worker entegrasyonu Task 10.
//
// Heavy op tier (design Section 5.1):
//   - Sync API'de değil — `applyEditAsync` üzerinden BullMQ enqueue.
//   - `applyEdit({ op: "background-remove" })` orchestrator'da REJECT eder.
//   - Worker tarafından çağrıldığında çalışır; output yeni Asset.
//
// Bu stub fonksiyonu Task 6 orchestrator yalnız "var" olarak referans
// etmez (heavy op çağrısı orchestrator'dan geçmez). Task 9'da gerçek
// implementasyon worker tarafından `removeBackground` olarak çağrılacak.

export type BackgroundRemoveInput = {
  inputAssetId: string;
};

export type BackgroundRemoveResult = {
  assetId: string;
};

/**
 * Asset'in arka planını WASM ile siler; yeni transparent PNG Asset üretir.
 *
 * **Stub** — Task 9'da implement edilecek; Task 10'da BullMQ worker'dan
 * çağrılacak. Sync API'den çağrılmaz (heavy op).
 */
export async function removeBackground(
  input: BackgroundRemoveInput,
): Promise<BackgroundRemoveResult> {
  void input;
  throw new Error(
    "removeBackground Task 9'da implement edilecek (stub)",
  );
}
