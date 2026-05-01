// Phase 8 — Provider registry + resolveBinding priority chain.
//
// Spec §2.1: deterministik provider seçim — LOCAL_SHARP > DYNAMIC_MOCKUPS.
// V1'de tüm template'ler tek LOCAL_SHARP binding ile gelir; V2'de admin
// ikinci binding eklerse priority chain otomatik kullanır.
//
// Phase 6 review/registry.ts emsali: ortak interface + concrete adapter
// dosyaları + tek noktalı `getProvider` lookup. Hardcoded id lookup yasak;
// tüketici sadece `resolveBinding` + `getProvider` üzerinden çalışır.

import type { MockupTemplate, MockupTemplateBinding } from "@prisma/client";
import type { RenderInput, RenderOutput } from "./types";
import { localSharpProvider } from "./local-sharp";
import { dynamicMockupsProvider } from "./dynamic-mockups";

export interface MockupProvider {
  /**
   * Provider id — Prisma `MockupProviderId` enum string repr ile birebir
   * eşleşir. RenderSnapshot.providerId bu değerle yazılır (audit trace).
   */
  readonly id: "LOCAL_SHARP" | "DYNAMIC_MOCKUPS";

  /** Render execution — Task 9 (rect) + Task 10 (perspective) implement. */
  render(input: RenderInput): Promise<RenderOutput>;

  /**
   * Pre-render config validation (Zod parse). Asset existence check
   * render() içinde MinIO fetch sırasında yapılır; bu katman sadece
   * JSON shape doğrulamasıdır (TEMPLATE_INVALID hata sınıfı sinyali).
   */
  validateConfig(config: unknown): { ok: true } | { ok: false; reason: string };
}

/**
 * Provider seçim öncelik zinciri.
 *
 * V1: LOCAL_SHARP her zaman birinci tercih (localhost-first disiplini,
 * spec §2.1). DYNAMIC_MOCKUPS V2'de premium tier olarak gelebilir; V1'de
 * hiç binding satırı yok, chain bu önceliği zaten uygular.
 */
export const PROVIDER_PRIORITY: ReadonlyArray<MockupProvider["id"]> = [
  "LOCAL_SHARP",
  "DYNAMIC_MOCKUPS",
];

/**
 * Template için active binding bul. Priority chain'in ilk match'i döner.
 * Hiç active binding yoksa null (TEMPLATE_INVALID hata sınıfı sinyali).
 *
 * Spec §2.1: "deterministik provider seçim". Test-edilebilir:
 * aynı input → aynı output.
 */
export function resolveBinding(
  template: MockupTemplate & { bindings: MockupTemplateBinding[] }
): MockupTemplateBinding | null {
  const active = template.bindings.filter((b) => b.status === "ACTIVE");
  for (const providerId of PROVIDER_PRIORITY) {
    const binding = active.find((b) => b.providerId === providerId);
    if (binding) return binding;
  }
  return null;
}

/**
 * Provider lookup — registry pattern. Phase 6 review/registry.ts emsali:
 * tek noktadan resolve, bilinmeyen id ⇒ TypeScript exhaustive check
 * derleme zamanında yakalar.
 */
export function getProvider(providerId: MockupProvider["id"]): MockupProvider {
  switch (providerId) {
    case "LOCAL_SHARP":
      return localSharpProvider;
    case "DYNAMIC_MOCKUPS":
      return dynamicMockupsProvider;
  }
}
