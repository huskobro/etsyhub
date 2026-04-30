// Phase 7 Task 6 — Crop edit-op stub.
//
// Bu task'te (Task 6 — orchestrator iskeleti) yalnız INTERFACE/SİNYAL var.
// Gerçek implementasyon Task 7'de (Sharp resize + center crop + Asset
// upload + DB row).
//
// Kontrat (plan Task 7, design Section 5):
//   - Input: `{ inputAssetId, params: { ratio } }`
//   - Output: yeni Asset entity (`{ assetId }` minimum — orchestrator
//     yalnız bu alanı kullanır; Task 7'de tam Asset row dönülecek).
//   - Side-effect: Storage upload + Asset DB row create.
//
// Aspect ratio whitelist: "2:3" | "4:5" | "1:1" | "3:4".
//
// Bu stub Task 7'de implement edilene kadar çağrıldığında ÇALIŞMAZ —
// yalnız tip yüzeyi var. Task 6 testleri bu fonksiyonu vi.mock ile
// override eder; production akışında Task 7 merge'lenmeden çağrı yok.
//
// CLAUDE.md disiplini: stub explicit throw — silent no-op değil. "Henüz
// implement edilmedi" runtime'da fail-fast.

export type CropRatio = "2:3" | "4:5" | "1:1" | "3:4";

export type CropAssetInput = {
  inputAssetId: string;
  params: { ratio: CropRatio };
};

export type CropAssetResult = {
  assetId: string;
};

/**
 * Asset'i verilen aspect ratio'ya göre kırp; yeni Asset entity döner.
 *
 * **Stub** — Task 7'de implement edilecek (Sharp resize `fit: 'cover'` +
 * center crop + storage upload + Asset DB row).
 */
export async function cropAsset(
  input: CropAssetInput,
): Promise<CropAssetResult> {
  void input;
  throw new Error("cropAsset Task 7'de implement edilecek (stub)");
}
