// Phase 8 — Dynamic Mockups provider (V2 contract-ready stub).
//
// Spec §2.1: V1'de SADECE adapter dosyası mevcut, interface compliance
// testi geçer; ancak V1'de hiç binding satırı yok (resolveBinding bu
// provider'ı sadece V2'de döndürür).
//
// Gerçek API render implementation V2'ye reserve. Mevcut hâl:
//   - render() çağrılırsa PROVIDER_NOT_CONFIGURED throw
//   - validateConfig() shape kontrolü için minimal stub (V2'de gerçek
//     API key + endpoint reachability check eklenecek)

import type { MockupProvider } from "../registry";

export const dynamicMockupsProvider: MockupProvider = {
  id: "DYNAMIC_MOCKUPS",

  async render() {
    throw new Error(
      "PROVIDER_NOT_CONFIGURED: Dynamic Mockups V2'de implement edilecek"
    );
  },

  /**
   * V1 stub: shape validation no-op (hiç binding satırı olmadığı için
   * çağrılmaz). V2'de DynamicMockupsConfigSchema.safeParse + API key /
   * endpoint reachability check eklenecek.
   */
  validateConfig() {
    return { ok: true };
  },
};
