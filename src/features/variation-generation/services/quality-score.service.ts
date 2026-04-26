// Quality Score Service — Phase 5 §3.4.a (Q1 sözleşmesi)
//
// Yalnız iki objektif input: DPI + Resolution. Negatif/review sinyali
// score'a GİRMEZ — Q1 kuralı: kullanıcı score'u + flag'leri AYRI görür.
// Bu yüzden QualityInput type'ı isNegative/negativeReason alanını kabul etmez.
//
// Phase 5/6 sınırı: Phase 6+ AI review (OCR/background detection) YENİ
// service olarak yan yana eklenir; bu signature genişletilmez.
//
// dpi=null davranışı: throw YOK — sharp PNG'lerde density dönmeyebilir
// (spec §11 risk tablosu); kontrollü "dpi-unreadable" reason üretilir.

export type QualityReason =
  | { type: "dpi-low"; actual: number; target: number; delta: number }
  | { type: "dpi-unreadable"; delta: number }
  | {
      type: "resolution-low";
      actual: string;
      target: string;
      deltaPct: number;
      delta: number;
    };

export type QualityInput = {
  dpi: number | null;
  width: number;
  height: number;
  target: { width: number; height: number };
  targetDpi: number;
};

export type QualityResult = {
  score: number;
  reasons: QualityReason[];
};

export function computeQualityScore(input: QualityInput): QualityResult {
  const reasons: QualityReason[] = [];
  let dpiPoints = 0;

  if (input.dpi == null) {
    reasons.push({ type: "dpi-unreadable", delta: -50 });
  } else if (input.dpi >= input.targetDpi) {
    dpiPoints = 50;
  } else if (input.dpi >= 200) {
    dpiPoints = 25;
    reasons.push({
      type: "dpi-low",
      actual: input.dpi,
      target: input.targetDpi,
      delta: -25,
    });
  } else {
    reasons.push({
      type: "dpi-low",
      actual: input.dpi,
      target: input.targetDpi,
      delta: -50,
    });
  }

  // Lineer oran (en kısa kenar) — spec §3.4.a örneğiyle uyumlu:
  // 3000x3000 vs 4000x4000 → deltaPct: 75 (alan değil lineer).
  const widthPct = (input.width / input.target.width) * 100;
  const heightPct = (input.height / input.target.height) * 100;
  const pct = Math.min(widthPct, heightPct);

  let resPoints = 0;
  if (pct >= 100) {
    resPoints = 50;
  } else if (pct >= 80) {
    resPoints = 25;
    reasons.push({
      type: "resolution-low",
      actual: `${input.width}x${input.height}`,
      target: `${input.target.width}x${input.target.height}`,
      deltaPct: Math.round(pct),
      delta: -25,
    });
  } else {
    reasons.push({
      type: "resolution-low",
      actual: `${input.width}x${input.height}`,
      target: `${input.target.width}x${input.target.height}`,
      deltaPct: Math.round(pct),
      delta: -50,
    });
  }

  const raw = dpiPoints + resPoints;
  const score = Math.max(0, Math.min(100, raw));
  return { score, reasons };
}
