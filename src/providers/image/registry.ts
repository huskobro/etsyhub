// Image provider registry (Phase 5 §2.2).
//
// R17.3: hardcoded tek-model çözüm YASAK. Tüm provider lookup'ları bu
// registry üzerinden yapılır. Bilinmeyen id'de sessiz fallback YOK — hata
// fırlatılır.
import type { ImageProvider } from "./types";
import { KieGptImageProvider } from "./kie-gpt-image";
import { KieZImageProvider } from "./kie-z-image";

const providers: ReadonlyArray<ImageProvider> = [
  new KieGptImageProvider(),
  new KieZImageProvider(),
];

const byId: ReadonlyMap<string, ImageProvider> = new Map(
  providers.map((p) => [p.id, p] as const),
);

export function getImageProvider(id: string): ImageProvider {
  const provider = byId.get(id);
  if (!provider) {
    throw new Error(`Unknown image provider: "${id}"`);
  }
  return provider;
}

export function listImageProviders(): ReadonlyArray<ImageProvider> {
  return providers;
}
