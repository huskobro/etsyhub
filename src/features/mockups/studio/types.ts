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
    name: string;
    dims: string;
    colors: readonly [string, string];
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
}

/* Phase 80 — Slot index → kept-item id. `null` = fanout fallback
 * (no assignment; pack-selection rotation'a düşer). Phase 76 panel
 * `SlotAssignmentMap` parity. */
export type StudioSlotAssignmentMap = Record<number, string | null>;
