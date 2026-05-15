/* Phase 77 — Studio shared types.
 *
 * Studio shell + sub-component'lerin paylaştığı discriminated unions.
 * Mode + app state ayrımı: mode (Mockup / Frame) sidebar + stage +
 * rail içeriği belirler; app state (working / empty / preview /
 * render / renderDone) presentation modunu belirler.
 *
 * Phase 77 görsel state odaklı; gerçek render dispatch Phase 78+
 * candidate (mevcut mockup job pipeline + Phase 75 multi-design
 * `RenderInput.designUrls[]` ile bağlanır).
 */

export type StudioMode = "mockup" | "frame";

export type StudioAppState =
  | "working"
  | "empty"
  | "preview"
  | "render"
  | "renderDone";

export interface StudioSlotMeta {
  id: number;
  name: string;
  assigned: boolean;
  design: {
    /** Phase 113 — Stable selection-item id for this slot. Canonical
     *  slot→item identity (Preview = Export Truth, Sözleşme §11.0:
     *  slot assignment de Preview=Export kapsamındadır).
     *
     *  realSlots position-sorted items'ı slot index'e map eder
     *  (slot 0 → sorted[0], slot 1 → sorted[1], …). Preview her
     *  slot'un kendi design'ını çizer; export payload bu DOĞAL
     *  slot→item dizilimini bu field üzerinden taşır. Phase 80
     *  operator override (slotAssignments) bunu ezer; override yoksa
     *  slot.design.itemId canonical (eski "firstAssignedItemId
     *  fanout fallback" bug'ı — 3 slot da items[0] gönderiyordu —
     *  kapatıldı). */
    itemId: string;
    name: string;
    dims: string;
    colors: readonly [string, string];
    /** Phase 98 — Real asset signed URL (Sözleşme #9 real asset
     *  expectation). Shell hydrate sourceAsset.id → /api/assets/[id]/
     *  signed-url ile çözer; StageDeviceSVG'ye geçirilir, gerçek
     *  `<image>` SVG element olarak render edilir. undefined →
     *  Phase 79 baseline (placeholder palette fallback). */
    imageUrl?: string | null;
  } | null;
}

/* Phase 80 — Studio kept-item (selection item facade for sidebar
 * picker). useSelectionSet items'tan türev — id + position + label +
 * palette + dims. Phase 76 SlotAssignmentPanel `SlotAssignmentKeptItem`
 * ile aynı role (Studio-native + dark recipe). */
export interface StudioKeptItem {
  id: string;
  /** Operator-facing label (Item N · short id). */
  label: string;
  /** Deterministic palette for swatch dot. */
  colors: readonly [string, string];
  /** Asset dims (sourceAsset width×height) — operator orientation. */
  dims: string;
  /** Phase 98 — Source asset id (signed URL fetch için). undefined ise
   *  asset yok / placeholder fallback. */
  sourceAssetId?: string | null;
  /** Phase 98 — Lazy-loaded signed image URL (after Shell hydrate
   *  signed-url fetch). undefined → henüz fetch edilmedi veya asset
   *  yok; null → fetch failed. Live URL operator için real image
   *  görüntülemenin canonical kaynağı. */
  imageUrl?: string | null;
}

/* Phase 80 — Slot index → kept-item id. `null` = fanout fallback
 * (no assignment; pack-selection rotation'a düşer). Phase 76 panel
 * `SlotAssignmentMap` parity. */
export type StudioSlotAssignmentMap = Record<number, string | null>;
