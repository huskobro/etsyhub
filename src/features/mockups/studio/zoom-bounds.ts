/* Phase 134 — Shared zoom-bounds (tek kaynak).
 *
 * Phase 123-133 boyunca zoom min/max ÜÇ ayrı yerde hardcoded'di:
 *   - MockupStudioStage.tsx StageSceneOverlays: ZOOM_MIN=25 ZOOM_MAX=200
 *   - MockupStudioPresetRail.tsx slider: min={25} max={200}
 *   - MockupStudioPresetRail.tsx fallback: useState(100)
 * Üçü senkron değildi; kullanıcı min=75 / max=400 istediğinde
 * "hidden eski değerler" riski (bir yer 200'de kalırsa pill ve
 * slider farklı clamp eder). Bu modül TEK kaynak: rail slider,
 * stage zoom-pill, reset davranışı, navigator viewfinder math
 * (StageScenePreview previewZoomPct) hepsi buradan okur (drift
 * YASAK §12; media-position.ts deseni — pure-TS, DOM/React import
 * YOK). Yeni big abstraction değil: 3 sabit + 1 clamp helper.
 *
 * Kullanıcı kararı (Phase 134): min 75%, max 400%, default 100%.
 * 25/50 gibi eski değerler artık YOK (clamp tek noktada). */

export const ZOOM_MIN = 75;
export const ZOOM_MAX = 400;
export const ZOOM_DEFAULT = 100;
/** Stage zoom-pill `−`/`+` adımı. Rail slider step ile uyumlu
 *  (ikisi aynı Shell state'i sürer; pill ±25 daha hızlı
 *  inspection — 75↔400 aralığı 25/200'den geniş). */
export const ZOOM_STEP = 25;

/** Zoom yüzdesini [ZOOM_MIN, ZOOM_MAX] aralığına clamp + yuvarla.
 *  Stage pill stepZoom, rail slider, reset, viewfinder math hepsi
 *  bunu kullanır → UI ve davranış AYNI sınırlar (tek kaynak). */
export function clampZoom(n: number): number {
  if (!Number.isFinite(n)) return ZOOM_DEFAULT;
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.round(n)));
}
