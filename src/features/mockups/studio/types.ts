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
