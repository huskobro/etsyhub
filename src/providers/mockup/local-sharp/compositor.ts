// Phase 8 Task 9 — Sharp compositor render orchestration.
// Phase 63 — placePerspective wired (4-corner DLT homography active).
// Phase 74 — Multi-slot render execution (slots[] fanout).
//
// Pipeline:
//   1. Snapshot config TypeGuard (providerId === "local-sharp").
//   2. Base asset MinIO fetch (config.baseAssetKey).
//   3. Design asset MinIO fetch (input.designUrl — storageKey).
//   4. SafeArea dispatch:
//        a) Phase 74 — Multi-slot path: config.slots[] varsa her slot için
//           placeRect/placePerspective + sequential composite (z-order =
//           slots array index). Sticker sheet 9-up grid / bundle preview /
//           cover + back gibi multi-area mockup'lar tek render output'unda
//           N design placement döner. Tek-design fanout (her slot aynı
//           design); multi-design assignment Phase 75+ candidate.
//        b) Legacy single-slot path: config.safeArea (rect veya
//           perspective) — Phase 8 baseline, backward-compat. Slots yoksa
//           hep bu path çağrılır.
//   5. Recipe apply (blend + opsiyonel shadow). Template-genelinde recipe;
//      her slot aynı recipe alır (Phase 74 scope). Slot-bazlı recipe
//      override Phase 75+.
//   6. Output PNG + thumbnail (400×400 inside fit).
//   7. MinIO upload (versionlı path).
//   8. RenderOutput dön (outputKey + thumbnailKey + dimensions + duration).

import sharp from "sharp";
import { getStorage } from "@/providers/storage";
import type {
  LocalSharpConfig,
  RenderInput,
  RenderOutput,
  SafeArea,
} from "@/providers/mockup";
import { placeRect, placePerspective } from "./safe-area";
import { applyRecipe } from "./recipe-applicator";

/** V1 thumbnail max dimension (Spec §2.2 emsali, Phase 7 thumbnail boyutu). */
const THUMBNAIL_SIZE = 400;

/** V1 output format — PNG (lossless, MockupRender.outputKey için). */
const OUTPUT_FORMAT = "png" as const;

/**
 * Worker'ın localSharpProvider.render() üzerinden çağırdığı entry point.
 *
 * Spec §3.2: snapshot.config TypeGuard ile LocalSharpConfig'e narrow edilir.
 * Snapshot'ta `coverPriority` field'ı dışlanmıştır (Spec §3.3); render path
 * bu alana bakmaz, dolayısıyla tip uyumu Omit<LocalSharpConfig,"coverPriority">
 * ile çalışır.
 *
 * AbortSignal entegrasyonu: input.signal worker tarafından
 * AbortSignal.timeout(60_000) (Spec §7.1 RENDER_TIMEOUT cap, defense-in-depth).
 * Sharp pipeline native abort desteği yok; manuel checkpoint'ler hot path'te
 * her major adımdan önce eklenir.
 */
export async function renderLocalSharp(input: RenderInput): Promise<RenderOutput> {
  const startTime = Date.now();

  // Pre-aborted signal kontrolü (en başta).
  abortIfRequested(input.signal);

  const rawConfig = input.snapshot.config;
  if (rawConfig.providerId !== "local-sharp") {
    throw new Error(
      `INVALID_PROVIDER_CONFIG: expected local-sharp, got ${rawConfig.providerId}`,
    );
  }
  // Snapshot'ta coverPriority dışlandığı için Omit<...,"coverPriority"> gelir;
  // burada Sharp render path bu alana hiç bakmaz, type cast güvenli.
  const config = rawConfig as Omit<LocalSharpConfig, "coverPriority">;

  const storage = getStorage();

  // 1) Base asset fetch.
  abortIfRequested(input.signal);
  const baseBuffer = await storage.download(config.baseAssetKey);

  // 2) Design asset fetch (input.designUrl is storageKey, not HTTP URL —
  //    Task 5 resolveAssetKey emsali).
  abortIfRequested(input.signal);
  const designBuffer = await storage.download(input.designUrl);

  // 3) SafeArea dispatch — Phase 74 multi-slot capable.
  abortIfRequested(input.signal);

  // Phase 74 — Multi-slot fanout. config.slots[] varsa her slot için ayrı
  // placement + sequential composite. Yoksa Phase 8 baseline (tek safeArea)
  // — backward-compat tam korunur.
  const slotAreas: SafeArea[] =
    config.slots && config.slots.length > 0
      ? config.slots.map((s) => s.safeArea)
      : [config.safeArea];

  // Tek design buffer, N slot'a yerleştirilir (Phase 74 single-design fanout).
  // Multi-design assignment (her slot farklı design) Phase 75+ candidate —
  // RenderInput shape genişletme + UI assignment akışı gerektirir.
  let compositedBuffer = baseBuffer;
  for (const safeArea of slotAreas) {
    abortIfRequested(input.signal);

    let placement: { buffer: Buffer; top: number; left: number };
    if (safeArea.type === "rect") {
      placement = await placeRect(designBuffer, safeArea, config.baseDimensions);
    } else if (safeArea.type === "perspective") {
      placement = await placePerspective(
        designBuffer,
        safeArea,
        config.baseDimensions,
      );
    } else {
      // Discriminated union exhaustive check.
      const _exhaustive: never = safeArea;
      throw new Error(`UNKNOWN_SAFE_AREA_TYPE: ${JSON.stringify(_exhaustive)}`);
    }

    // 4) Recipe apply (blend + shadow) — her slot için.
    //    Template-genelinde recipe; slot-bazlı override Phase 75+.
    //    Sequential composite: önceki slot'un sonucu base olur, yeni slot
    //    onun üstüne yerleşir. Z-order = slots array index (slot 0 alt,
    //    son slot üst).
    abortIfRequested(input.signal);
    compositedBuffer = await applyRecipe(
      compositedBuffer,
      placement,
      config.recipe,
    );
  }

  // 5) Thumbnail (400×400 inside fit; PNG; upscale yapmaz).
  abortIfRequested(input.signal);
  const thumbnailBuffer = await sharp(compositedBuffer)
    .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, { fit: "inside" })
    .png()
    .toBuffer();

  // 6) MinIO upload (versionlı path).
  //    Output key: mockup-renders/{renderId}/{timestamp}.png
  //    Thumbnail key: mockup-renders/{renderId}/{timestamp}-thumb.png
  //    Phase 7 storage emsali (`exports/{userId}/...` yapısı).
  const timestamp = Date.now();
  const outputKey = `mockup-renders/${input.renderId}/${timestamp}.${OUTPUT_FORMAT}`;
  const thumbnailKey = `mockup-renders/${input.renderId}/${timestamp}-thumb.${OUTPUT_FORMAT}`;

  abortIfRequested(input.signal);
  await storage.upload(outputKey, compositedBuffer, {
    contentType: `image/${OUTPUT_FORMAT}`,
  });

  abortIfRequested(input.signal);
  await storage.upload(thumbnailKey, thumbnailBuffer, {
    contentType: `image/${OUTPUT_FORMAT}`,
  });

  return {
    outputKey,
    thumbnailKey,
    outputDimensions: config.baseDimensions, // Output PNG base ile aynı boyut.
    renderDurationMs: Date.now() - startTime,
  };
}

/**
 * AbortSignal checkpoint — hot path'te defense-in-depth.
 * Sharp pipeline native abort desteği yok; bu manuel checkpoint timeout
 * cap'i sağlar (Spec §7.1 RENDER_TIMEOUT 60s).
 */
function abortIfRequested(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new Error("RENDER_TIMEOUT: AbortSignal triggered");
  }
}
