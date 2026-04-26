// buildImagePrompt — image üretim master prompt birleştirici (Phase 5).
//
// Sözleşme:
//   - R18: brief APPEND edilir, system'i replace ETMEZ.
//   - R19: NEGATIVE_LIBRARY her çağrıda "Avoid: …" satırı olarak enjekte edilir.
//
// Çıktı format:
//   {systemPrompt}
//
//   [Style note from user: {brief}]   ← brief boşsa bu satır atlanır
//
//   Avoid: {NEGATIVE_LIBRARY virgülle join}
//
// NOT (capability): `capability` parametresi imzanın parçası ama şu an
// output'a etki ETMEZ. Task 10/12'de (üretim akışı + capability mismatch)
// kullanılacak. Erken sözleşme stabilitesi için signature'da tutuluyor;
// regression testi (`tests/unit/prompt-builder.test.ts`) i2i vs t2i identical
// output'u guard'lar.
import type { ImageCapability } from "@/providers/image/types";
import { NEGATIVE_LIBRARY } from "./negative-library";

export type ImagePromptInput = {
  systemPrompt: string;
  brief?: string;
  capability: ImageCapability;
};

export function buildImagePrompt(input: ImagePromptInput): string {
  // S2 — fail-fast: systemPrompt boş/whitespace-only ise config error.
  // Plan'daki .filter(Boolean) sessiz davranışı bilinçli olarak değiştirildi.
  // Empty systemPrompt sessizce drop edilirse buildImagePrompt yalnızca
  // "Avoid: …" üretir; bu bir bug değil config error olarak fail-fast.
  if (input.systemPrompt.trim().length === 0) {
    throw new Error(
      "buildImagePrompt: systemPrompt empty (config error — fail-fast)",
    );
  }

  const negative = NEGATIVE_LIBRARY.join(", ");
  const brief = input.brief?.trim() ?? "";
  return [
    input.systemPrompt,
    brief ? `Style note from user: ${brief}` : "",
    `Avoid: ${negative}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}
