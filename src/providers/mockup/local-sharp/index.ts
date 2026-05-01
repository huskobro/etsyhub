// Phase 8 — Local Sharp mockup provider (V1 primary).
//
// Spec §2.2: in-house Sharp compositor. V1 deneyiminin tüm render'ları
// bu yoldan geçer (localhost-first disiplini).
//
// **Bu dosya scaffold'tur**: render() Task 9'da (rect safeArea) + Task 10'da
// (perspective safeArea) gerçek implementation alacak. Şu an sadece
// validateConfig çalışır + interface uyumu.

import type { MockupProvider } from "../registry";
import { LocalSharpConfigSchema } from "@/features/mockups/schemas";

export const localSharpProvider: MockupProvider = {
  id: "LOCAL_SHARP",

  async render() {
    throw new Error(
      "NOT_IMPLEMENTED: Sharp render Task 9-10'da implement edilecek"
    );
  },

  /**
   * Config validation: Zod schema parse.
   *
   * Asset existence check Task 9'da Sharp render içinde MinIO fetch
   * sırasında yapılır; bu validation katmanı sadece JSON shape kontrolü
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
