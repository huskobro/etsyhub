/* Phase 83 — Frame mode aspect ratio + deliverable type config.
 *
 * Shots.so öncelikli okuma ile: Frame mode "presentation surface"
 * (Phase 81 role chip) artık passive shell değil — aspect chip click
 * canvas dims'i live değiştirir + deliverable type caption gösterir.
 * Phase 82 baseline'da Frame canvas hardcoded 580×326 (16:9) idi;
 * Phase 83 5 canonical Etsy/social aspect ratio'ya bağlanıyor.
 *
 * Export pipeline (Sharp composite + MinIO) Phase 84+ candidate;
 * Phase 83 davranışsal yarısını çözer (operator aspect seçer,
 * canvas live update, deliverable type görünür).
 */

export type FrameAspectKey = "1:1" | "4:5" | "9:16" | "16:9" | "3:4";

export interface FrameAspectConfig {
  /** Operator-facing chip label (sidebar). */
  label: string;
  /** Numeric width:height ratio for canvas dims hesap. */
  ratio: number;
  /** Output dims (operator-facing dims caption). */
  outputW: number;
  outputH: number;
  /** Deliverable type — operator hangi listing/social surface için
   *  çalıştığını anlar (Etsy hero, Instagram square, Story vb.). */
  deliverable: string;
}

export const FRAME_ASPECT_CONFIG: Record<FrameAspectKey, FrameAspectConfig> = {
  "1:1": {
    label: "1:1",
    ratio: 1,
    outputW: 1080,
    outputH: 1080,
    deliverable: "Instagram square · bundle card",
  },
  "4:5": {
    label: "4:5",
    ratio: 4 / 5,
    outputW: 1080,
    outputH: 1350,
    deliverable: "Etsy listing portrait",
  },
  "9:16": {
    label: "9:16",
    ratio: 9 / 16,
    outputW: 1080,
    outputH: 1920,
    deliverable: "Instagram Story",
  },
  "16:9": {
    label: "16:9",
    ratio: 16 / 9,
    outputW: 1920,
    outputH: 1080,
    deliverable: "Storefront banner · hero landscape",
  },
  "3:4": {
    label: "3:4",
    ratio: 3 / 4,
    outputW: 1500,
    outputH: 2000,
    deliverable: "Pinterest pin",
  },
};

export const FRAME_ASPECT_KEYS: FrameAspectKey[] = [
  "1:1",
  "4:5",
  "9:16",
  "16:9",
  "3:4",
];

/* Phase 83 — Bounded canvas dims hesap.
 *
 * Stage canvas alanı sabit max bbox içinde (580×326 baseline);
 * aspect ratio'ya göre fit edilir. Wide aspect (16:9) → max
 * width'e fit; tall aspect (9:16) → max height'a fit; orta
 * aspect (1:1, 4:5, 3:4) → daha küçük boyutla iki ekseni dengeler.
 *
 * boundary 580×326 mevcut Phase 77+82 baseline; bu helper hiç
 * 580'i geçmez ve hiç 326'yı geçmez (stage scroll/clip yok).
 */
export function computeFrameCanvasDims(
  aspect: FrameAspectKey,
  maxW: number = 580,
  maxH: number = 326,
): { w: number; h: number } {
  const cfg = FRAME_ASPECT_CONFIG[aspect];
  const r = cfg.ratio;
  // Max width-fit first; eğer height aşıyorsa height-fit.
  let w = maxW;
  let h = Math.round(maxW / r);
  if (h > maxH) {
    h = maxH;
    w = Math.round(maxH * r);
  }
  return { w, h };
}
