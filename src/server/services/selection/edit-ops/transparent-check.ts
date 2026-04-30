// Phase 7 Task 8 — Transparent PNG kontrolü edit-op (LOCAL DUPLICATE).
//
// Sözleşme (design Section 5):
//   - Input: `{ inputAssetId }`
//   - Output: `{ ok, signals, summary }` — **asset üretmez, yalnız raporlar**.
//   - Side-effect: Yok (read-only analiz).
//
// Asset üretmemesi orchestrator için kritik: `editedAssetId` /
// `lastUndoableAssetId` değişmez; yalnız `editHistoryJson`'a op record
// eklenir (`{ op: "transparent-check", at, result }`).
//
// **Local duplicate stratejisi (design Section 5):** Phase 6
// `runAlphaChecks` (src/server/services/review/alpha-checks.ts) servisine
// production'da DOKUNULMAZ ve IMPORT edilmez. Phase 7 Selection Studio
// kendi alpha-check fonksiyonunu paralel taşır: aynı sayısal eşikler,
// davranışsal uyum garantisi (test'te kıyaslanır), ayrı kod yolu.
// Konsolidasyon Phase 6 smoke kapandıktan sonra (carry-forward
// `selection-studio-alpha-check-consolidate`).
//
// Eşikler (Phase 6 ile birebir aynı):
//   - EDGE_ARTIFACT_RATIO_THRESHOLD = 0.01 (%1) — kenar piksellerin >%1'i
//     "kirli" (0 < alpha < 250) ise ok=false.
//   - ALPHA_CLEAN_THRESHOLD = 250 — alpha >= 250 "yeterince opak" sayılır
//     (PNG sıkıştırma jitter'ı için tolerans).
//
// **Output shape farkı:** Phase 6 `ReviewRiskFlag[]` döner; Selection
// Studio UI panel için yapılandırılmış sinyal objesi gerekir
// (`{ ok, signals: { hasAlphaChannel, alphaCoveragePercent,
// edgeContaminationPercent }, summary }`). Bu yüzden output Phase 6
// formatında değil — Selection Studio'nun tüketim ihtiyacına göre normalize.

import sharp from "sharp";
import { db } from "@/server/db";
import { getStorage } from "@/providers/storage";

const EDGE_ARTIFACT_RATIO_THRESHOLD_PERCENT = 1; // %1 — Phase 6 ratio 0.01 percent ölçekte 1.0
const ALPHA_CLEAN_THRESHOLD = 250; // alpha >= 250 ⇒ "yeterince opak" (PNG jitter toleransı)

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
 * Algoritma (Phase 6 alpha-checks ile davranışsal uyum):
 *   1. Asset entity'yi DB'den çek (fail-fast: yoksa throw)
 *   2. Storage'dan buffer indir
 *   3. Sharp metadata: hasAlpha kontrolü
 *      - hasAlpha=false ⇒ ok=false, "Alpha kanalı yok" (early return)
 *   4. Raw piksel data oku (ensureAlpha + raw)
 *   5. Edge contamination loop (üst+alt+sol+sağ kenarlar; köşeler tek sayım)
 *      - 0 < alpha < 250 ⇒ kirli kenar pikseli
 *   6. Alpha coverage loop (tüm pikseller, alpha < 255 ⇒ transparent)
 *   7. Karar: edgeContaminationPercent > 1 ⇒ ok=false; else ok=true
 *
 * Sessiz fallback YASAK: storage/sharp hataları propagate olur.
 */
export async function transparentCheck(
  input: TransparentCheckInput,
): Promise<TransparentCheckResult> {
  // 1) Input asset (fail-fast)
  const asset = await db.asset.findUniqueOrThrow({
    where: { id: input.inputAssetId },
  });

  // 2) Storage'dan buffer
  const storage = getStorage();
  const buffer = await storage.download(asset.storageKey);

  // 3) Metadata + alpha kanalı kontrolü
  const meta = await sharp(buffer).metadata();
  if (meta.hasAlpha !== true) {
    return {
      ok: false,
      signals: {
        hasAlphaChannel: false,
        alphaCoveragePercent: 0,
        edgeContaminationPercent: 0,
      },
      summary: "Alpha kanalı yok",
    };
  }

  // 4) Raw piksel data (ensureAlpha — RGB ise alpha ekler; ama buraya
  // hasAlpha=true ile geliyoruz, yine de defansif).
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  // 5) Edge contamination — Phase 6 ile birebir aynı sayım stratejisi:
  //    üst (y=0) + alt (y=h-1) tüm x; sol (x=0) + sağ (x=w-1) iç y'ler
  //    (köşeler çift sayılmaz).
  let edgePixels = 0;
  let dirtyEdgePixels = 0;

  for (let x = 0; x < width; x++) {
    for (const y of [0, height - 1]) {
      const alphaIdx = (y * width + x) * channels + (channels - 1);
      edgePixels++;
      const alpha = data[alphaIdx]!;
      if (alpha > 0 && alpha < ALPHA_CLEAN_THRESHOLD) dirtyEdgePixels++;
    }
  }
  for (let y = 1; y < height - 1; y++) {
    for (const x of [0, width - 1]) {
      const alphaIdx = (y * width + x) * channels + (channels - 1);
      edgePixels++;
      const alpha = data[alphaIdx]!;
      if (alpha > 0 && alpha < ALPHA_CLEAN_THRESHOLD) dirtyEdgePixels++;
    }
  }

  // 6) Alpha coverage — tüm pikseller, alpha < 255 ⇒ transparent
  const totalPixels = width * height;
  let transparentPixels = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alphaIdx = (y * width + x) * channels + (channels - 1);
      const alpha = data[alphaIdx]!;
      if (alpha < 255) transparentPixels++;
    }
  }

  // Defensive: 1x1 görselde edgePixels gene de >0 olur (4 sayım, 1 unique
  // piksel). Yine de 0-genişlik/yükseklik gibi anomalilerde 0 fallback.
  const edgeContaminationPercent =
    edgePixels === 0 ? 0 : (dirtyEdgePixels / edgePixels) * 100;
  const alphaCoveragePercent =
    totalPixels === 0 ? 0 : (transparentPixels / totalPixels) * 100;

  const ok = edgeContaminationPercent <= EDGE_ARTIFACT_RATIO_THRESHOLD_PERCENT;

  let summary: string;
  if (!ok) {
    summary = `Kenar artifact %${edgeContaminationPercent.toFixed(1)}`;
  } else {
    summary = "Temiz transparent PNG";
  }

  return {
    ok,
    signals: {
      hasAlphaChannel: true,
      alphaCoveragePercent,
      edgeContaminationPercent,
    },
    summary,
  };
}
