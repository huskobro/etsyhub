/* Phase 126 — Global media-position shared resolver.
 *
 * Shots.so canlı browser araştırması: pad'in `.drag-handle`'ı media'yı
 * plate içinde pan ediyor; `.shadow-layer` plate'in görünür alanını
 * temsil ediyor (sabit). Kivasy karşılığı: global canonical
 * `mediaPosition {x,y} ∈ [-1,1]` ({0,0} = no-op, Phase 125 byte-
 * identical). Bu modül TEK formül kaynağı: preview outer-wrapper +
 * rail thumb + Sharp export hepsi `resolveMediaOffsetPx` çağırır
 * (drift YASAK, spec §5). Pure-TS — DOM/React/sharp import YOK →
 * client (preview/rail) + server (compositor) ikisi de import eder
 * (CLAUDE.md Madde V build-boundary). */

export const MEDIA_POSITION_PAN_K = 0.5;

export type MediaPosition = { x: number; y: number };

export const MEDIA_POSITION_NEUTRAL: MediaPosition = { x: 0, y: 0 };

const clamp1 = (n: number): number => Math.max(-1, Math.min(1, n));

/** Normalized {x,y} → px offset, render-boyutuna göre türetilir.
 *  TEK formül: preview/rail/export hepsi bunu kullanır. neutral
 *  {0,0} → {ox:0,oy:0} (sacred no-op). */
export function resolveMediaOffsetPx(
  pos: MediaPosition,
  renderW: number,
  renderH: number,
): { ox: number; oy: number } {
  return {
    ox: pos.x * renderW * MEDIA_POSITION_PAN_K,
    oy: pos.y * renderH * MEDIA_POSITION_PAN_K,
  };
}

export function clampMediaPosition(p: MediaPosition): MediaPosition {
  return { x: clamp1(p.x), y: clamp1(p.y) };
}

/** Pure math: pad-px → normalized. Pad rect'in -1..+1 koordinat
 *  uzayını temsil eder (merkez = {0,0}). shiftKey → uygulanan
 *  delta `prev`'ten ÷4 (precision; Shots.so "Hold ⇧"). DOM/event
 *  objesi YOK (kolay test). */
export function normalizePadPointToPosition(
  clientX: number,
  clientY: number,
  padRect: { left: number; top: number; width: number; height: number },
  shiftKey: boolean,
  prev: MediaPosition,
): MediaPosition {
  const halfW = padRect.width / 2;
  const halfH = padRect.height / 2;
  const rawX = clamp1((clientX - padRect.left - halfW) / halfW);
  const rawY = clamp1((clientY - padRect.top - halfH) / halfH);
  if (!shiftKey) return { x: rawX, y: rawY };
  return clampMediaPosition({
    x: prev.x + (rawX - prev.x) / 4,
    y: prev.y + (rawY - prev.y) / 4,
  });
}

/** Epsilon eşitlik (stale indicator — float drift'ten sahte stale
 *  üretme; spec guardrail 3). */
export function mediaPositionsEqual(
  a: MediaPosition,
  b: MediaPosition,
): boolean {
  return Math.abs(a.x - b.x) < 1e-3 && Math.abs(a.y - b.y) < 1e-3;
}
