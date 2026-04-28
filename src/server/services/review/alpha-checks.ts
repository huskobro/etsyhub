import sharp from "sharp";
import type { ReviewRiskFlag } from "@/providers/review/types";

/**
 * Deterministic alpha kanal kontrolleri — Phase 6 hibrit pipeline'ın sharp tarafı.
 *
 * Pure fonksiyon: aynı görsel her zaman aynı flag'leri döndürür (LLM dalgalanması yok).
 * Stateless; product-type gate burada DEĞİL — worker (Task 8) transparent ürün
 * tiplerinde (clipart/sticker/transparent_png) bu fonksiyonu çağırır.
 *
 * İki olası flag:
 * - no_alpha_channel: meta.hasAlpha === false ise (transparent hedefte alfa yok)
 * - transparent_edge_artifact: kenar piksellerin >%1'inde 0 < alpha < 250
 *
 * Threshold mantığı:
 * - Temiz transparent: kenar pikselleri ya tamamen şeffaf (alpha=0) ya da
 *   tamamen opak (alpha=255). Yarı saydam piksel = artifact (kenar bozulması).
 * - Tolerans: 250+ alpha "yeterince opak" sayılır (PNG sıkıştırma jitter'ı için).
 * - >%1 oran: 64x64 görselde 252 kenar pikseli; 2-3'ü "kirli" ise zaten flag.
 *
 * Sessiz fallback YASAK: sharp dosya okunamazsa zaten throw eder; üzerine
 * sarmıyoruz, hata propagate olur.
 */
const EDGE_ARTIFACT_RATIO_THRESHOLD = 0.01; // %1
const ALPHA_CLEAN_THRESHOLD = 250; // alpha >= 250 ⇒ "yeterince opak"

export async function runAlphaChecks(
  filePath: string,
): Promise<ReviewRiskFlag[]> {
  const image = sharp(filePath);
  const meta = await image.metadata();

  // Check 1: alfa kanalı yok mu?
  if (!meta.hasAlpha) {
    return [
      {
        type: "no_alpha_channel",
        confidence: 1,
        reason: "Görselde alfa kanalı yok",
      },
    ];
  }

  // Check 2: kenar piksel artifact ratio
  const { data, info } = await sharp(filePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  let edgePixels = 0;
  let dirtyEdgePixels = 0;

  // Üst (y=0) + alt (y=height-1) kenar — tüm x'ler
  for (let x = 0; x < width; x++) {
    for (const y of [0, height - 1]) {
      const alphaIdx = (y * width + x) * channels + (channels - 1);
      edgePixels++;
      const alpha = data[alphaIdx]!;
      if (alpha > 0 && alpha < ALPHA_CLEAN_THRESHOLD) dirtyEdgePixels++;
    }
  }
  // Sol (x=0) + sağ (x=width-1) kenar — köşeler hariç (zaten yukarıda sayıldı)
  for (let y = 1; y < height - 1; y++) {
    for (const x of [0, width - 1]) {
      const alphaIdx = (y * width + x) * channels + (channels - 1);
      edgePixels++;
      const alpha = data[alphaIdx]!;
      if (alpha > 0 && alpha < ALPHA_CLEAN_THRESHOLD) dirtyEdgePixels++;
    }
  }

  // Edge case: width veya height 1 ise edgePixels 0 olabilir; bu durumda flag üretmiyoruz.
  if (edgePixels === 0) return [];

  const ratio = dirtyEdgePixels / edgePixels;
  if (ratio > EDGE_ARTIFACT_RATIO_THRESHOLD) {
    return [
      {
        type: "transparent_edge_artifact",
        confidence: Math.min(1, ratio * 10),
        reason: `Kenar piksellerinin %${(ratio * 100).toFixed(1)}'inde yarı saydam artifact`,
      },
    ];
  }

  return [];
}
