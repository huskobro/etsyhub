// Phase 8 — Mockup provider abstraction.
//
// Spec §2.1: localhost-first disiplini.
//   - LOCAL_SHARP (primary) — in-house Sharp compositor, V1 deneyimin
//     tüm render'ları bu yoldan geçer (Task 9-10).
//   - DYNAMIC_MOCKUPS (secondary) — V2 contract-ready stub. V1'de hiç
//     binding satırı yok; gerçek `render()` çağrılırsa
//     `PROVIDER_NOT_CONFIGURED` throw.
//
// Phase 6 emsali: src/providers/review/registry.ts + types.ts paterni
// (registry seçim + ortak interface + concrete adapter dosyaları).

export type {
  ProviderConfig,
  LocalSharpConfig,
  DynamicMockupsConfig,
  SafeArea,
  SafeAreaRect,
  SafeAreaPerspective,
  MockupRecipe,
  ShadowSpec,
  RenderInput,
  RenderOutput,
  RenderSnapshot,
} from "./types";

export type { MockupProvider } from "./registry";
export { resolveBinding, getProvider, PROVIDER_PRIORITY } from "./registry";
export { localSharpProvider } from "./local-sharp";
export { dynamicMockupsProvider } from "./dynamic-mockups";
