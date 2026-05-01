// Phase 8 Task 9 — Recipe applicator (blend + shadow).
//
// Spec §3.2: MockupRecipe minimal — blendMode + opsiyonel shadow.
// Sharp composite() blend mode parametresi: normal/multiply/screen.
// Shadow: design alpha mask + siyah RGB + opacity multiply + gaussian blur.

import sharp from "sharp";
import type { MockupRecipe, ShadowSpec } from "@/providers/mockup";

/** Sharp composite layer parametre tipi (minimal subset). */
type CompositeLayer = {
  input: Buffer;
  top: number;
  left: number;
  blend: "over" | "multiply" | "screen";
};

/**
 * MockupRecipe.blendMode → Sharp composite blend string.
 *  - "normal"   → "over"     (Sharp default; design alpha üstte)
 *  - "multiply" → "multiply" (printed-on-fabric efekt; pixel*pixel/255)
 *  - "screen"   → "screen"   (luminance overlay; 1-(1-a)*(1-b))
 */
function blendModeToSharp(
  mode: MockupRecipe["blendMode"],
): "over" | "multiply" | "screen" {
  switch (mode) {
    case "normal":
      return "over";
    case "multiply":
      return "multiply";
    case "screen":
      return "screen";
  }
}

/**
 * Shadow buffer üret — design alpha mask kullanılarak siyah, opacity-scaled,
 * gaussian-blurred shadow PNG.
 *
 * Yaklaşım (Sharp 0.33.x ile sağlam):
 *   1. Design'ın alpha channel'ını çıkar (extractChannel("alpha")).
 *   2. Aynı boyutta siyah RGB buffer (raw fill) oluştur.
 *   3. RGB + alpha'yı `joinChannel` ile birleştir (siyah RGBA, alpha = design
 *      alpha).
 *   4. opacity multiplier'ı alpha kanalına uygula (linear(opacity, 0)).
 *   5. Gaussian blur uygula (Sharp blur min radius 0.3).
 */
async function buildShadowBuffer(
  designBuffer: Buffer,
  shadow: ShadowSpec,
): Promise<Buffer> {
  // Önce design metadata'sını al (RGBA garanti).
  const designMeta = await sharp(designBuffer).ensureAlpha().metadata();
  const w = designMeta.width;
  const h = designMeta.height;
  if (!w || !h) {
    throw new Error("Shadow build: design buffer width/height yok");
  }

  // Design alpha channel'ını raw 1-channel buffer olarak çıkar.
  const alphaRaw = await sharp(designBuffer)
    .ensureAlpha()
    .extractChannel("alpha")
    .raw()
    .toBuffer();

  // Aynı boyutta siyah RGB raw buffer (3 channels, fill = 0).
  const rgbRaw = Buffer.alloc(w * h * 3, 0);

  // RGB + alpha'yı birleştir → siyah RGBA, alpha = design alpha.
  // joinChannel raw alpha'yı eklemeyi kabul eder; raw input metadata gerekir.
  const blackRgba = await sharp(rgbRaw, {
    raw: { width: w, height: h, channels: 3 },
  })
    .joinChannel(alphaRaw, {
      raw: { width: w, height: h, channels: 1 },
    })
    .png()
    .toBuffer();

  // opacity'i alpha'ya uygula + blur.
  const blurRadius = Math.max(0.3, shadow.blur);
  const opacity = Math.max(0, Math.min(1, shadow.opacity));
  // linear() RGBA tüm kanallara aynı multiplier uygular; alpha'ya yalnız
  // uygulamak için extractChannel + linear + joinChannel yeniden olur fakat
  // shadow tüm RGB zaten 0; RGB üzerinde 0*opacity = 0 değişmiyor; alpha
  // 255*opacity oluyor. Yani genel linear safe.
  return sharp(blackRgba)
    .linear(opacity, 0)
    .blur(blurRadius)
    .png()
    .toBuffer();
}

/**
 * Recipe'i base asset'e composite et.
 *
 * Layer order (alttan üste):
 *   1. Base asset (Sharp pipeline source).
 *   2. Shadow layer (varsa, design'dan ÖNCE; offset edilir).
 *   3. Design layer (blendMode uygulanır).
 *
 * Spec §3.2 minimal V1 recipe: yalnız blendMode + opsiyonel shadow.
 * cornerRadius / lighting / mask / multiDesign V2 reserve.
 */
export async function applyRecipe(
  baseBuffer: Buffer,
  designLayer: { buffer: Buffer; top: number; left: number },
  recipe: MockupRecipe,
): Promise<Buffer> {
  const blend = blendModeToSharp(recipe.blendMode);
  const layers: CompositeLayer[] = [];

  // Shadow varsa, design'dan önce ekle (alttan üste düzen).
  if (recipe.shadow) {
    const shadowBuf = await buildShadowBuffer(designLayer.buffer, recipe.shadow);
    layers.push({
      input: shadowBuf,
      top: designLayer.top + recipe.shadow.offsetY,
      left: designLayer.left + recipe.shadow.offsetX,
      blend: "over",
    });
  }

  // Design layer (blend mode uygulanır).
  layers.push({
    input: designLayer.buffer,
    top: designLayer.top,
    left: designLayer.left,
    blend,
  });

  return sharp(baseBuffer).composite(layers).png().toBuffer();
}
