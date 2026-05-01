// Phase 8 — Local Sharp mockup provider (V1 primary).
//
// Spec §2.2: in-house Sharp compositor. V1 deneyiminin tüm render'ları
// bu yoldan geçer (localhost-first disiplini).
//
// Task 4'te scaffold idi (validateConfig çalışır, render NOT_IMPLEMENTED).
// Task 9'da rect safeArea + recipe gerçek implementation eklendi.
// Perspective safeArea Task 10'da gelir; placePerspective hâlâ
// NOT_IMPLEMENTED throw eder, worker bunu PROVIDER_DOWN classify eder.

import type { MockupProvider } from "../registry";
import { LocalSharpConfigSchema } from "@/features/mockups/schemas";
import { renderLocalSharp } from "./compositor";

export const localSharpProvider: MockupProvider = {
  id: "LOCAL_SHARP",

  /**
   * Render execution — Task 9 rect path artık gerçek; perspective Task 10.
   *
   * Pipeline detayı: ./compositor.ts (renderLocalSharp).
   */
  async render(input) {
    return renderLocalSharp(input);
  },

  /**
   * Config validation: Zod schema parse.
   *
   * Asset existence check Task 9 render() içinde MinIO fetch sırasında
   * yapılır; bu validation katmanı sadece JSON shape kontrolü
   * (TEMPLATE_INVALID hata sınıfı için pre-render guard).
   */
  validateConfig(config) {
    const result = LocalSharpConfigSchema.safeParse(config);
    if (!result.success) {
      return { ok: false, reason: result.error.message };
    }
    return { ok: true };
  },
};
