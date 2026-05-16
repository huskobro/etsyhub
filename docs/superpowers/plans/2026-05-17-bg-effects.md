# BG Effects (Frame scene effect) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mockup Studio Frame mode'da `bgEffect` (vignette + grain) wire et — operatör listing-hero arka plan atmosferini ayarlasın; preview = export parity korunarak.

**Architecture:** `SceneOverride.bgEffect` opsiyonel alan (Glass/Lens Blur'ın kanıtlanmış `SceneOverride` pattern'i birebir). `frame-scene.ts` (type + resolve) → `frame-compositor.ts` (Sharp mirror) → `MockupStudioStage.tsx` (preview CSS) → `MockupStudioSidebar.tsx` (tile wire) → snapshot zinciri (Shell sceneSnapshot + FrameExportResultBanner isStale). Compositing order SABİT: scene bg → grain → glass → lens blur → vignette.

**Tech Stack:** Next.js + TypeScript (strict), Vitest, Sharp (libvips), React 17+.

**Spec:** `docs/superpowers/specs/2026-05-17-bg-effects-design.md`

---

## Önemli kod-gerçeği referansları (okunması zorunlu — plan bunlara dayanır)

- `src/features/mockups/studio/frame-scene.ts`: `SceneMode`/`GlassVariant`/`LensBlurConfig` (satır 36-100), `LENS_BLUR_PX` (67-71), `LENS_BLUR_DEFAULT` (74-78), `normalizeLensBlur` (90-100), `SceneOverride` interface (102-136), `resolvePlateEffects` (323-354), `PlateEffectStyle` (312-321).
- `src/providers/mockup/local-sharp/frame-compositor.ts`: `FrameGlassVariant` (55), `FrameLensBlurConfig` (129), `FRAME_LENS_BLUR_SIGMA` (137), `normalizeFrameLensBlur` (146), compositor scene interface (`glassVariant?` 166, `lensBlur?` 170), blur composite blok (1240-1265), cascade slotComposites composite (1268-1274 — "Layer 3 EN ÜSTE").
- `src/features/mockups/studio/MockupStudioStage.tsx`: `resolvePlateEffects` import (26), `plateEffects = resolvePlateEffects(...)` (715), `plateEffects.glassOverlay` render (845-855), blur filter (770/780).
- `src/features/mockups/studio/MockupStudioShell.tsx`: `sceneSnapshot` type (133-145) + ikinci kullanım (~730).
- `src/features/mockups/studio/FrameExportResultBanner.tsx`: `FrameExportResultSnapshot` type (47), `normalizeLensBlur` (76), `isStale` karşılaştırması (90-95).
- `src/features/mockups/studio/MockupStudioSidebar.tsx`: `efx` array (951-953: `portrait`/`watermark`/`bgfx`), Effects grid map (1202-1253), `isWired` (1204), Lens Blur onClick branch (1216-1230).

## File Structure

| Dosya | Sorumluluk |
|---|---|
| `frame-scene.ts` | `BgEffect*` type, intensity map'leri, `SceneOverride.bgEffect`, `resolvePlateEffects` bgEffect çözümü (preview+export ortak pure-TS resolver) |
| `frame-compositor.ts` | type mirror + Sharp vignette/grain composite (export) |
| `MockupStudioStage.tsx` | preview plate CSS layer (vignette gradient + grain turbulence) |
| `MockupStudioSidebar.tsx` | `bgfx` tile wire (kind + intensity kontrolü) |
| `MockupStudioShell.tsx` | sceneSnapshot'a bgEffect (export payload) |
| `FrameExportResultBanner.tsx` | snapshot type + isStale karşılaştırması |
| `frame-export.service.ts` / `api/frame/export/route.ts` | persist edilen snapshot'a bgEffect |
| `mockup-studio-contract.md` | §7.7 normatif kural |
| `tests/unit/mockup/bg-effects.test.ts` | resolvePlateEffects bgEffect unit |

---

## Task 1: bgEffect type + intensity map + SceneOverride field (frame-scene.ts)

**Files:**
- Modify: `src/features/mockups/studio/frame-scene.ts` (Lens Blur type bloğu ~78 sonrası + `SceneOverride` ~135)
- Test: `tests/unit/mockup/bg-effects.test.ts` (create)

- [ ] **Step 1: Failing test yaz**

Create `tests/unit/mockup/bg-effects.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  BG_VIGNETTE_ALPHA,
  BG_GRAIN_OPACITY,
  type BgEffectConfig,
  type SceneOverride,
} from "@/features/mockups/studio/frame-scene";

describe("bgEffect type + intensity maps", () => {
  it("vignette alpha map: soft<medium<strong, strong<=0.42 (subject korunur)", () => {
    expect(BG_VIGNETTE_ALPHA.soft).toBeLessThan(BG_VIGNETTE_ALPHA.medium);
    expect(BG_VIGNETTE_ALPHA.medium).toBeLessThan(BG_VIGNETTE_ALPHA.strong);
    expect(BG_VIGNETTE_ALPHA.strong).toBeLessThanOrEqual(0.42);
  });
  it("grain opacity map: soft<medium<strong, strong<=0.11 (mockup kirletmez)", () => {
    expect(BG_GRAIN_OPACITY.soft).toBeLessThan(BG_GRAIN_OPACITY.medium);
    expect(BG_GRAIN_OPACITY.medium).toBeLessThan(BG_GRAIN_OPACITY.strong);
    expect(BG_GRAIN_OPACITY.strong).toBeLessThanOrEqual(0.11);
  });
  it("SceneOverride.bgEffect opsiyonel (undefined geçerli)", () => {
    const s: SceneOverride = { mode: "auto" };
    expect(s.bgEffect).toBeUndefined();
    const s2: SceneOverride = {
      mode: "auto",
      bgEffect: { kind: "vignette", intensity: "medium" },
    };
    const cfg: BgEffectConfig = s2.bgEffect!;
    expect(cfg.kind).toBe("vignette");
  });
});
```

- [ ] **Step 2: Test fail doğrula**

Run: `npx vitest run tests/unit/mockup/bg-effects.test.ts`
Expected: FAIL — `BG_VIGNETTE_ALPHA` / `BG_GRAIN_OPACITY` / `BgEffectConfig` export edilmemiş.

- [ ] **Step 3: frame-scene.ts'e type + map ekle**

`frame-scene.ts`'te `LENS_BLUR_DEFAULT` bloğundan (satır 78) HEMEN SONRA ekle:

```ts
/* Phase 136 — BG Effects (Frame scene effect).
 *
 *  Tek-seçimli atmosfer effect'i: vignette VEYA grain (ikisi
 *  aynı anda değil). mode/glassVariant/lensBlur'dan BAĞIMSIZ
 *  eksen — kombinlenebilir (mutual-exclusion yok). undefined =
 *  none. Frame-only (Mockup mode'a sızmaz). Canonical kategori 1
 *  (export'a yansır + sceneSnapshot'lanır — §11.0). Shots.so
 *  referansı "Background effects" = Noise+Blur slider; Kivasy
 *  kararı: blur tekrar etme (lensBlur var), vignette ekle
 *  (Etsy hero değeri), tek-seçim (sade). */
export type BgEffectKind = "vignette" | "grain";
export type BgEffectIntensity = "soft" | "medium" | "strong";
export interface BgEffectConfig {
  kind: BgEffectKind;
  intensity: BgEffectIntensity;
}

/* Vignette: radial-gradient dış-kenar alpha (merkez ŞEFFAF).
 * strong<=0.42 — ürün fotoğrafını öldürmez (guardrail). */
export const BG_VIGNETTE_ALPHA: Record<BgEffectIntensity, number> = {
  soft: 0.14,
  medium: 0.26,
  strong: 0.42,
};

/* Grain: monokrom film-grain overlay opacity (dijital RGB
 * noise DEĞİL). strong<=0.11 — mockup kirletmez (guardrail).
 * Browser doğrulamasında kalibre edilir; bunlar tavan. */
export const BG_GRAIN_OPACITY: Record<BgEffectIntensity, number> = {
  soft: 0.04,
  medium: 0.07,
  strong: 0.11,
};
```

`SceneOverride` interface'inin SONUNA (satır ~135 `lensBlur?` alanından sonra, kapanış `}` öncesi) ekle:

```ts
  /** Phase 136 — BG Effects (Frame scene effect). Tek-seçimli
   *  vignette|grain × soft/medium/strong. undefined = none.
   *  mode/glassVariant/lensBlur'dan bağımsız eksen (kombinlenebilir).
   *  Frame-only; export'a yansır + sceneSnapshot'lanır (§11.0).
   *  Compositing order SABİT: bg → grain → glass → lensBlur →
   *  vignette (bkz. resolvePlateEffects + frame-compositor). */
  bgEffect?: BgEffectConfig;
```

- [ ] **Step 4: Test pass doğrula**

Run: `npx vitest run tests/unit/mockup/bg-effects.test.ts`
Expected: PASS (3 test).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: hata yok.

- [ ] **Step 6: Commit**

```bash
git add src/features/mockups/studio/frame-scene.ts tests/unit/mockup/bg-effects.test.ts
git commit -m "feat(mockup): Phase 136 (1/8) — BgEffect type + intensity maps + SceneOverride.bgEffect"
```

---

## Task 2: resolvePlateEffects bgEffect çözümü (frame-scene.ts)

**Files:**
- Modify: `src/features/mockups/studio/frame-scene.ts` — `PlateEffectStyle` (312-321) + `resolvePlateEffects` (323-354)
- Test: `tests/unit/mockup/bg-effects.test.ts` (extend)

- [ ] **Step 1: Failing test ekle**

`tests/unit/mockup/bg-effects.test.ts` sonuna yeni describe ekle:

```ts
import { resolvePlateEffects } from "@/features/mockups/studio/frame-scene";

describe("resolvePlateEffects — bgEffect", () => {
  it("bgEffect undefined → vignetteAlpha 0, grainOpacity 0", () => {
    const r = resolvePlateEffects({ mode: "auto" });
    expect(r.vignetteAlpha).toBe(0);
    expect(r.grainOpacity).toBe(0);
  });
  it("vignette medium → vignetteAlpha set, grainOpacity 0", () => {
    const r = resolvePlateEffects({
      mode: "auto",
      bgEffect: { kind: "vignette", intensity: "medium" },
    });
    expect(r.vignetteAlpha).toBe(BG_VIGNETTE_ALPHA.medium);
    expect(r.grainOpacity).toBe(0);
  });
  it("grain strong → grainOpacity set, vignetteAlpha 0 (tek-seçim)", () => {
    const r = resolvePlateEffects({
      mode: "auto",
      bgEffect: { kind: "grain", intensity: "strong" },
    });
    expect(r.grainOpacity).toBe(BG_GRAIN_OPACITY.strong);
    expect(r.vignetteAlpha).toBe(0);
  });
  it("bgEffect glass + lensBlur ile bağımsız kombinlenir", () => {
    const r = resolvePlateEffects({
      mode: "glass",
      glassVariant: "dark",
      lensBlur: { enabled: true, target: "plate", intensity: "soft" },
      bgEffect: { kind: "vignette", intensity: "soft" },
    });
    expect(r.glassOverlay).toBeDefined();
    expect(r.filterBlurPx).toBeGreaterThan(0);
    expect(r.vignetteAlpha).toBe(BG_VIGNETTE_ALPHA.soft);
  });
});
```

- [ ] **Step 2: Test fail doğrula**

Run: `npx vitest run tests/unit/mockup/bg-effects.test.ts`
Expected: FAIL — `r.vignetteAlpha` / `r.grainOpacity` `PlateEffectStyle`'da yok.

- [ ] **Step 3: PlateEffectStyle + resolvePlateEffects genişlet**

`frame-scene.ts` `PlateEffectStyle` interface'ine (satır 320 `glassOverlay` alanından sonra, `}` öncesi) ekle:

```ts
  /** Phase 136 — BG Effects. Vignette radial dış-kenar alpha
   *  (0 = no vignette). Grain monokrom overlay opacity (0 = no
   *  grain). Tek-seçim: en fazla biri > 0. */
  vignetteAlpha: number;
  grainOpacity: number;
```

`resolvePlateEffects` fonksiyonunda, `return { filterBlurPx, blurTarget, glassOverlay };` (satır 353) ÖNCESİNE ekle:

```ts
  /* Phase 136 — BG Effects (tek-seçimli; mode/glass/lensBlur'dan
   *  bağımsız). undefined → ikisi de 0 (no-op). */
  let vignetteAlpha = 0;
  let grainOpacity = 0;
  if (override.bgEffect) {
    if (override.bgEffect.kind === "vignette") {
      vignetteAlpha = BG_VIGNETTE_ALPHA[override.bgEffect.intensity];
    } else {
      grainOpacity = BG_GRAIN_OPACITY[override.bgEffect.intensity];
    }
  }
```

Ve return satırını değiştir:

```ts
  return {
    filterBlurPx,
    blurTarget,
    glassOverlay,
    vignetteAlpha,
    grainOpacity,
  };
```

- [ ] **Step 4: Test pass doğrula**

Run: `npx vitest run tests/unit/mockup/bg-effects.test.ts`
Expected: PASS (7 test).

- [ ] **Step 5: Typecheck + regression**

Run: `npx tsc --noEmit && npx vitest run tests/unit/mockup`
Expected: tsc temiz; mockup suite tüm testler PASS (yeni `PlateEffectStyle` alanları diğer çağıranları kırmamalı — `resolvePlateEffects` çağıranlar yalnız okuduğu alanları kullanır).

- [ ] **Step 6: Commit**

```bash
git add src/features/mockups/studio/frame-scene.ts tests/unit/mockup/bg-effects.test.ts
git commit -m "feat(mockup): Phase 136 (2/8) — resolvePlateEffects bgEffect çözümü (vignetteAlpha/grainOpacity)"
```

---

## Task 3: Preview plate CSS — vignette + grain layer (MockupStudioStage.tsx)

**Files:**
- Modify: `src/features/mockups/studio/MockupStudioStage.tsx` — `plateEffects` kullanımı (715 civarı) + plate render (glassOverlay komşuluğu ~845-855)

**Bağlam:** Stage'de `plateEffects = resolvePlateEffects(...)` zaten var (satır 715). `plateEffects.glassOverlay` satır 845-855'te plate üstüne absolute overlay div olarak render ediliyor. Vignette + grain için AYNI pattern: plate-content üstüne pointer-events:none overlay layer'lar. Compositing order §4: grain plate-bg üstünde (glass'tan ÖNCE/altında), vignette EN ÜSTTE (glass + blur'dan sonra). DOM'da: grain layer glassOverlay'den ÖNCE, vignette layer cascade/glassOverlay'den SONRA (en son child = en üst z).

- [ ] **Step 1: glassOverlay render bloğunu oku**

Run: `sed -n '760,870p' src/features/mockups/studio/MockupStudioStage.tsx`
(Plate içeriği + glassOverlay overlay div'in tam yapısını gör; vignette/grain layer'larını aynı stille ekleyeceksin.)

- [ ] **Step 2: Grain + vignette overlay layer'larını ekle**

`plateEffects` destructuring'i bulup `vignetteAlpha`/`grainOpacity`'yi çıkar (satır ~715-716 civarı, `lensBlurActive` komşuluğu):

```tsx
  const plateEffects = resolvePlateEffects(sceneOverride ?? { mode: "auto" });
  const lensBlurActive = plateEffects.filterBlurPx > 0;
  const vignetteActive = plateEffects.vignetteAlpha > 0;
  const grainActive = plateEffects.grainOpacity > 0;
```

**Grain layer** — plate-bg üstüne, glassOverlay'den ÖNCE (compositing: grain bg'nin parçası, glass onu yumuşatır). glassOverlay JSX bloğunun (`{plateEffects.glassOverlay ? (` satır ~845) HEMEN ÖNCESİNE ekle:

```tsx
          {grainActive ? (
            <div
              aria-hidden
              data-bg-grain
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                opacity: plateEffects.grainOpacity,
                // Deterministik monokrom film-grain: sabit seed
                // feTurbulence (her render aynı). RGB değil →
                // grayscale (dijital renkli noise değil §guardrail).
                backgroundImage:
                  "url(\"data:image/svg+xml;utf8," +
                  encodeURIComponent(
                    '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160">' +
                      '<filter id="g"><feTurbulence type="fractalNoise" baseFrequency="0.72" numOctaves="2" seed="7" stitchTiles="stitch"/>' +
                      '<feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.6 0.6 0.6 0 0"/></filter>' +
                      '<rect width="160" height="160" filter="url(#g)"/></svg>',
                  ) +
                  "\")",
                backgroundRepeat: "repeat",
                zIndex: 1,
              }}
            />
          ) : null}
```

**Vignette layer** — EN ÜSTTE (cascade + glass + blur'dan sonra). Plate içeriğinin EN SON child'ı olacak şekilde, glassOverlay bloğundan ve cascade'den SONRA, plate kapanış `</div>`'inden hemen önce ekle (bkz. Step 1 ile bulduğun plate-content kapanışı):

```tsx
          {vignetteActive ? (
            <div
              aria-hidden
              data-bg-vignette
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                // Merkez ~%60 ŞEFFAF (subject boğmaz §guardrail);
                // alpha yalnız dış kenarda. ellipse → portrait/
                // vertical kompozisyonda da merkez korunur.
                background:
                  "radial-gradient(ellipse at center, " +
                  "rgba(0,0,0,0) 60%, rgba(0,0,0," +
                  plateEffects.vignetteAlpha +
                  ") 100%)",
                zIndex: 9,
              }}
            />
          ) : null}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: hata yok.

- [ ] **Step 4: Build (preview render path temiz mi)**

Run: `NODE_OPTIONS=--max-old-space-size=4096 npx next build`
Expected: `✓ Compiled successfully` (Stage Server/Client bundle temiz).

- [ ] **Step 5: Commit**

```bash
git add src/features/mockups/studio/MockupStudioStage.tsx
git commit -m "feat(mockup): Phase 136 (3/8) — preview plate vignette+grain layer (compositing order: grain<glass, vignette en üst)"
```

---

## Task 4: Export Sharp — vignette + grain composite (frame-compositor.ts)

**Files:**
- Modify: `src/providers/mockup/local-sharp/frame-compositor.ts` — scene interface (166-170 civarı) + blur composite bloğu sonrası (1265) + cascade composite sonrası (1274)

**Bağlam:** Compositor `canvasBuffer`'ı katman katman build ediyor: stage bg → plate → glass → blur (1240-1265) → cascade slotComposites EN ÜSTTE (1268-1274). Compositing order §4: grain glass'tan ÖNCE, vignette cascade'den SONRA (en son). Glass mirror pattern (`FrameGlassVariant` satır 55) BG Effect type'ı için şablon. **`resolvePlateEffects` import edilemez mi?** — compositor pure-server; `frame-scene.ts` pure-TS (DOM yok) → import GÜVENLİ (zaten `normalizeFrameLensBlur` compositor-local mirror; ama `resolvePlateEffects` + map'ler import edilebilir — Step 3'te doğrula).

- [ ] **Step 1: Compositor scene interface + blur/cascade bloklarını oku**

Run: `sed -n '160,175p;1238,1280p' src/providers/mockup/local-sharp/frame-compositor.ts`
(Scene interface `bgEffect?` ekleyeceğin yeri + blur composite blok sonu + cascade composite konumunu netleştir.)

- [ ] **Step 2: Scene interface'e bgEffect ekle**

`frame-compositor.ts` compositor scene interface'inde (`lensBlur?: boolean | FrameLensBlurConfig;` satır ~170 sonrası, `}` öncesi) ekle:

```ts
  /** Phase 136 — BG Effects (Frame scene effect). frame-scene.ts
   *  BgEffectConfig mirror; resolvePlateEffects ile çözülür
   *  (preview = export aynı pure-TS resolver). */
  bgEffect?: import("@/features/mockups/studio/frame-scene").BgEffectConfig;
```

- [ ] **Step 3: resolvePlateEffects ile bgEffect çöz + import doğrula**

`frame-compositor.ts` dosya başındaki frame-scene importuna `resolvePlateEffects` ekle (varsa `normalizeFrameLensBlur` zaten compositor-local; `resolvePlateEffects` + map'ler frame-scene'den import edilir). Dosya başı import satırını bul (`from "@/features/mockups/studio/frame-scene"` varsa genişlet; yoksa ekle):

```ts
import {
  resolvePlateEffects,
} from "@/features/mockups/studio/frame-scene";
```

Blur composite bloğunun (satır ~1240 `const lb = normalizeFrameLensBlur(scene.lensBlur);`) HEMEN ÖNCESİNE bgEffect çözümü ekle:

```ts
  /* Phase 136 — BG Effects (preview = export aynı resolver). */
  const bgFx = resolvePlateEffects({
    mode: "auto",
    bgEffect: scene.bgEffect,
  });
```

(Not: yalnız `vignetteAlpha`/`grainOpacity` okunacak; `mode:"auto"` dummy — bgEffect mode'dan bağımsız §4.)

- [ ] **Step 4: Grain composite — glass'tan SONRA, blur'dan ÖNCE**

Compositing order §4: grain glass üstünde ama lens-blur'dan ÖNCE (blur grain'i de yumuşatır — istenen "bg'nin parçası"). Blur bloğunun (`const lb = normalizeFrameLensBlur...`) HEMEN ÖNCESİNE (Step 3'te eklediğin `bgFx`'ten sonra) ekle:

```ts
  /* Phase 136 — Grain (deterministik monokrom; preview SVG
   *  turbulence ile algısal eşdeğer — §11.0 parity, bit-exact
   *  değil). Glass'tan SONRA, lens-blur'dan ÖNCE (blur grain'i
   *  de yumuşatır — bg'nin parçası §4). */
  if (bgFx.grainOpacity > 0) {
    const grainTile = await sharp({
      create: {
        width: 160,
        height: 160,
        channels: 3,
        background: { r: 0, g: 0, b: 0 },
        noise: { type: "gaussian", mean: 128, sigma: 36 },
      },
    })
      .greyscale()
      .png()
      .toBuffer();
    // Tile → plate alanı boyutuna döşe, plate mask, opacity.
    const grainPlate = await sharp({
      create: {
        width: outputW,
        height: outputH,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([
        {
          input: grainTile,
          tile: true,
          blend: "over",
        },
        {
          input: Buffer.from(
            `<svg width="${outputW}" height="${outputH}" xmlns="http://www.w3.org/2000/svg"><rect x="${plateLayout.plateX}" y="${plateLayout.plateY}" width="${plateLayout.plateW}" height="${plateLayout.plateH}" rx="${plateLayout.plateRadius}" ry="${plateLayout.plateRadius}" fill="white"/></svg>`,
          ),
          blend: "dest-in",
        },
      ])
      .ensureAlpha(bgFx.grainOpacity)
      .png()
      .toBuffer();
    canvasBuffer = await sharp(canvasBuffer)
      .composite([{ input: grainPlate, top: 0, left: 0 }])
      .png()
      .toBuffer();
  }
```

- [ ] **Step 5: Vignette composite — cascade slotComposites'ten SONRA (EN ÜST)**

Cascade composite bloğunun (`if (slotComposites.length > 0) { ... }` satır ~1268-1274) HEMEN SONRASINA ekle:

```ts
  /* Phase 136 — Vignette EN ÜSTTE (cascade + glass + blur'dan
   *  sonra; lens kenar karartması optik son katman §4). Merkez
   *  ~%60 şeffaf — subject boğmaz §guardrail. radialGradient
   *  Sharp'ta yok → SVG radial PNG composite. */
  if (bgFx.vignetteAlpha > 0) {
    const vignetteSvg = `<svg width="${outputW}" height="${outputH}" xmlns="http://www.w3.org/2000/svg">
      <defs><radialGradient id="v" cx="50%" cy="50%" r="50%">
        <stop offset="60%" stop-color="rgba(0,0,0,0)"/>
        <stop offset="100%" stop-color="rgba(0,0,0,${bgFx.vignetteAlpha})"/>
      </radialGradient></defs>
      <rect x="${plateLayout.plateX}" y="${plateLayout.plateY}"
        width="${plateLayout.plateW}" height="${plateLayout.plateH}"
        rx="${plateLayout.plateRadius}" ry="${plateLayout.plateRadius}"
        fill="url(#v)"/>
    </svg>`;
    canvasBuffer = await sharp(canvasBuffer)
      .composite([{ input: Buffer.from(vignetteSvg), top: 0, left: 0 }])
      .png()
      .toBuffer();
  }
```

- [ ] **Step 6: Typecheck + regression**

Run: `npx tsc --noEmit && npx vitest run tests/unit/mockup`
Expected: tsc temiz; mockup suite PASS (compositor değişikliği saf-ekleme; bgEffect yokken `bgFx.grainOpacity===0 && bgFx.vignetteAlpha===0` → hiçbir composite çalışmaz → byte-identical no-op, mevcut testler bozulmaz).

- [ ] **Step 7: Commit**

```bash
git add src/providers/mockup/local-sharp/frame-compositor.ts
git commit -m "feat(mockup): Phase 136 (4/8) — Sharp export vignette+grain composite (order: grain<blur, vignette en üst; §11.0 parity)"
```

---

## Task 5: Sidebar bgfx tile wire (MockupStudioSidebar.tsx)

**Files:**
- Modify: `src/features/mockups/studio/MockupStudioSidebar.tsx` — Effects grid (1202-1253), `isWired` (1204), onClick branch

**Bağlam:** `efx` array satır 951-953: `{k:"bgfx", l:"BG Effects", n:"sparkle"}`. Grid map (1202-1253) `isWired = isLens` (yalnız lens wired). Lens onClick branch (1216-1230) `onChangeSceneOverride` pattern. BG Effects için: tile click → kind seçim (vignette/grain) + intensity döngüsü. Sade model: tıklama döngüsü — off → vignette·medium → grain·medium → off (Shots.so popover yerine sade toggle-cycle; CLAUDE.md "sade ama güçlü"; tek-seçim modeline doğal).

- [ ] **Step 1: Effects grid + efx + isWired bloğunu oku**

Run: `sed -n '945,955p;1200,1256p' src/features/mockups/studio/MockupStudioSidebar.tsx`
(Tile map yapısı + `activeScene` erişimi + `onChangeSceneOverride` imzasını netleştir.)

- [ ] **Step 2: bgfx için isWired + onClick cycle ekle**

Grid map içinde (`const isLens = k === "lens";` komşuluğu, satır ~1203-1208):

```tsx
            const isLens = k === "lens";
            const isBgfx = k === "bgfx";
            const isWired = isLens || isBgfx;
            const lensCfg = normalizeLensBlur(activeScene.lensBlur);
            const lensActive = isLens && lensCfg.enabled;
            // BG Effects cycle state: aktif kind veya null.
            const bgKind = activeScene.bgEffect?.kind ?? null;
            const on = isLens
              ? lensActive
              : isBgfx
                ? bgKind !== null
                : effect === k;
```

onClick handler'ında, Lens branch'inden (`if (isLens) { ... return; }` satır ~1216-1230) SONRA, `setEffect(k);` ÖNCESİNE ekle:

```tsx
                  if (isBgfx) {
                    if (onChangeSceneOverride) {
                      // Tek-seçim cycle: none → vignette·medium →
                      // grain·medium → none. Sade model (Shots.so
                      // popover yerine; CLAUDE.md sade-güçlü).
                      const cur = activeScene.bgEffect?.kind ?? null;
                      const next =
                        cur === null
                          ? ({
                              kind: "vignette",
                              intensity: "medium",
                            } as const)
                          : cur === "vignette"
                            ? ({
                                kind: "grain",
                                intensity: "medium",
                              } as const)
                            : undefined;
                      onChangeSceneOverride({
                        ...activeScene,
                        bgEffect: next,
                      });
                    }
                    return;
                  }
```

(Not: `BgEffectConfig` type'ı frame-scene'den import edilmiş olmalı — Sidebar'da `normalizeLensBlur` import satırına `type BgEffectConfig` ekle gerekirse; `as const` ile literal yeterli, ek import gerekmeyebilir — Step 3 tsc doğrular.)

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit && NODE_OPTIONS=--max-old-space-size=4096 npx next build`
Expected: tsc temiz; build `✓ Compiled successfully`.

- [ ] **Step 4: Commit**

```bash
git add src/features/mockups/studio/MockupStudioSidebar.tsx
git commit -m "feat(mockup): Phase 136 (5/8) — bgfx tile wire (tek-seçim cycle: none→vignette→grain→none)"
```

---

## Task 6: Snapshot zinciri — Shell sceneSnapshot + FrameExportResultBanner isStale

**Files:**
- Modify: `src/features/mockups/studio/MockupStudioShell.tsx` — sceneSnapshot type (133-145) + ikinci kullanım (~730)
- Modify: `src/features/mockups/studio/FrameExportResultBanner.tsx` — `FrameExportResultSnapshot` (47) + `isStale` (90-95)

**Bağlam (guardrail 6 — KRİTİK):** Export sonrası `bgEffect` değişirse banner "Preview changed — re-export?" göstermeli (glass/lensBlur ile birebir). `isStale` satır 90-95 `mode/glassVariant/lensBlur/mediaPosition/frameAspect` karşılaştırıyor — `bgEffect` 6. karşılaştırma.

- [ ] **Step 1: İlgili blokları oku**

Run: `sed -n '128,150p;725,740p' src/features/mockups/studio/MockupStudioShell.tsx && echo "---BANNER---" && sed -n '40,96p' src/features/mockups/studio/FrameExportResultBanner.tsx`
(sceneSnapshot type + her iki kullanım + banner snapshot type + isStale tam yapı.)

- [ ] **Step 2: Shell sceneSnapshot type'a bgEffect ekle**

`MockupStudioShell.tsx` sceneSnapshot type tanımında (satır ~143 `mediaPosition?: MediaPosition;` sonrası, `}` öncesi):

```ts
      /** Phase 136 — BG Effects (export anı; banner stale
       *  karşılaştırması — §11.0). undefined = none. */
      bgEffect?: import("@/features/mockups/studio/frame-scene").BgEffectConfig;
```

- [ ] **Step 3: Shell — export anında bgEffect snapshot'a yaz**

`sceneSnapshot: { ... }` objesinin set edildiği YER(ler)i bul (Step 1 çıktısı — ~730 export handler'ında `mode: sceneOverride...` benzeri). Her snapshot oluşturma yerine `mediaPosition` komşuluğuna ekle:

```ts
          bgEffect: sceneOverride?.bgEffect,
```

(sceneOverride state değişkeninin adı dosyada teyit edilir — `glassVariant`/`lensBlur` snapshot'a hangi değişkenden yazılıyorsa AYNI değişken.)

- [ ] **Step 4: FrameExportResultBanner snapshot type + isStale**

`FrameExportResultBanner.tsx` `FrameExportResultSnapshot` type'ına (satır ~47, `mediaPosition` komşuluğu):

```ts
  bgEffect?: import("@/features/mockups/studio/frame-scene").BgEffectConfig;
```

`isStale` bloğundan (satır ~90) ÖNCE `bgEffectChanged` türet:

```ts
  /* Phase 136 — BG Effects stale: kind veya intensity değişirse
   *  export'a yansır (§11.0) → "Preview changed — re-export?".
   *  undefined↔config geçişi de stale. */
  const curBg = currentSceneSnapshot.bgEffect;
  const snapBg = result.sceneSnapshot.bgEffect;
  const bgEffectChanged =
    (curBg?.kind ?? null) !== (snapBg?.kind ?? null) ||
    (curBg?.intensity ?? null) !== (snapBg?.intensity ?? null);
```

`isStale` ifadesine `bgEffectChanged ||` ekle (satır ~93 `lensBlurChanged ||` komşuluğu):

```ts
  const isStale =
    currentSceneSnapshot.mode !== result.sceneSnapshot.mode ||
    currentSceneSnapshot.glassVariant !== result.sceneSnapshot.glassVariant ||
    lensBlurChanged ||
    bgEffectChanged ||
    mediaPositionChanged ||
    currentSceneSnapshot.frameAspect !== result.sceneSnapshot.frameAspect;
```

- [ ] **Step 5: Typecheck + regression + build**

Run: `npx tsc --noEmit && npx vitest run tests/unit/mockup && NODE_OPTIONS=--max-old-space-size=4096 npx next build`
Expected: tsc temiz; mockup suite PASS; build ✓.

- [ ] **Step 6: Commit**

```bash
git add src/features/mockups/studio/MockupStudioShell.tsx src/features/mockups/studio/FrameExportResultBanner.tsx
git commit -m "feat(mockup): Phase 136 (6/8) — snapshot zinciri: sceneSnapshot.bgEffect + banner isStale (guardrail 6)"
```

---

## Task 7: Export persist + rail-derive (frame-export.service + svg-art)

**Files:**
- Modify: `src/server/services/frame/frame-export.service.ts` + `src/app/api/frame/export/route.ts` — persist scene snapshot'a bgEffect
- Modify (gerekiyorsa): `src/features/mockups/studio/svg-art.tsx` — rail thumb scene bgEffect

**Bağlam:** `frame-export.service.ts` + `route.ts`'te glass/lensBlur'in persist edildiği yol var (grep kanıtı: dosyalar lensBlur/glassVariant geçiyor). `svg-art.tsx` rail thumb scene-derive — lensBlur/glassVariant orada geçiyor; rail single-renderer §11.0 parity gereği bgEffect de yansımalı (yoksa rail thumb ≠ orta panel).

- [ ] **Step 1: Persist + svg-art bgEffect yollarını oku**

Run: `grep -n "lensBlur\|glassVariant\|sceneSnapshot\|scene:" src/server/services/frame/frame-export.service.ts src/app/api/frame/export/route.ts | head -20 && echo "---SVG-ART---" && grep -n "lensBlur\|glassVariant\|resolvePlateEffects\|sceneOverride\|bgEffect" src/features/mockups/studio/svg-art.tsx | head -15`
(bgEffect'in glass/lensBlur ile AYNI yola ekleneceği noktaları netleştir; svg-art'ta scene geçiyor mu yoksa rail zaten resolvePlateEffects mi kullanıyor.)

- [ ] **Step 2: route.ts/service — payload + persist bgEffect**

`api/frame/export/route.ts`'te export payload parse/forward edilirken `scene` objesine `lensBlur`/`glassVariant` nasıl geçiyorsa `bgEffect`'i de AYNI şekilde geçir (Step 1 ile bulunan satır). Zod schema varsa `bgEffect` opsiyonel alan ekle:

```ts
  bgEffect: z
    .object({
      kind: z.enum(["vignette", "grain"]),
      intensity: z.enum(["soft", "medium", "strong"]),
    })
    .optional(),
```

`frame-export.service.ts`'te persist edilen scene snapshot objesine (glass/lensBlur komşuluğu) ekle:

```ts
      bgEffect: input.scene?.bgEffect,
```

(Gerçek değişken/alan adları Step 1 çıktısından — glass/lensBlur AYNI pattern.)

- [ ] **Step 3: svg-art rail-derive (yalnız gerekiyorsa)**

Step 1 çıktısı: eğer `svg-art.tsx` rail thumb `resolvePlateEffects` kullanıyorsa **otomatik** bgEffect alır (ek değişiklik YOK — Task 2'deki resolver genişlemesi yeterli; bunu doğrula ve not düş). Eğer svg-art scene'i ayrı bir yoldan alıp glass/lensBlur'u manuel uyguluyorsa, AYNI manuel yola bgEffect (vignette/grain) ekle (Step 1 ile çıkan pattern'i izle). **Karar Step 1 çıktısına bağlı — placeholder değil: "resolvePlateEffects kullanıyorsa no-op; manuel ise glass/lensBlur ile aynı satıra ekle".**

- [ ] **Step 4: Typecheck + regression + build**

Run: `npx tsc --noEmit && npx vitest run tests/unit/mockup tests/unit/products tests/unit/listings && NODE_OPTIONS=--max-old-space-size=4096 npx next build`
Expected: tsc temiz; suite'ler PASS (frame-export persist değişikliği saf-ekleme); build ✓.

- [ ] **Step 5: Commit**

```bash
git add src/server/services/frame/frame-export.service.ts src/app/api/frame/export/route.ts src/features/mockups/studio/svg-art.tsx
git commit -m "feat(mockup): Phase 136 (7/8) — export persist bgEffect + rail-derive parity (§11.0)"
```

---

## Task 8: Behavior Contract §7.7 + browser parity doğrulama + final

**Files:**
- Modify: `docs/claude/mockup-studio-contract.md` — §7.5 sonrası §7.7
- Modify: `docs/claude/known-issues-and-deferred.md` — A bölümü (Portrait/Watermark/Tilt hâlâ honest-disabled notu güncel kalır; bgEffect "wired" notu)

- [ ] **Step 1: Contract §7.7 ekle**

`docs/claude/mockup-studio-contract.md`'te §7.6 bloğunun sonuna (§8 başlamadan önce) ekle:

```markdown
### 7.7 BG Effects (Frame scene effect — Phase 136)

- `SceneOverride.bgEffect?` — tek-seçimli (`vignette`|`grain` ×
  `soft/medium/strong`); undefined = none.
- **Frame-only**: Mockup mode'a sızmaz (Frame scene kararı).
- **Export'a yansır + snapshot'lanır**: canonical kategori 1;
  `sceneSnapshot`'a girer, `FrameExportResultBanner` `isStale`
  karşılaştırmasına dahil (glass/lensBlur ile birebir).
- `mode`/`glassVariant`/`lensBlur`'dan **bağımsız eksen**:
  kombinlenebilir, mutual-exclusion YOK.
- **Compositing order SABİT**: scene bg → grain → glass →
  lens blur → vignette (preview CSS layer-order = Sharp
  composite order; `resolvePlateEffects` tek pure-TS resolver).
- **Preview = Export parity zorunlu** (§11.0): deterministik —
  vignette saf gradient formülü; grain sabit-seed monokrom
  noise (preview SVG turbulence ↔ Sharp gaussian: algısal
  eşdeğer, bit-exact değil — §11.0 "birebir" = yapısal/algısal).
  Vignette merkez ~%60 şeffaf (subject boğmaz); grain
  film-grain (dijital RGB gürültü değil).
- Scope-dışı (Phase 136): pattern overlay, eşzamanlı çift-effect
  (blur zaten `lensBlur`), Portrait/Watermark/Tilt/VFX
  (honest-disabled korunur).
```

- [ ] **Step 2: known-issues güncelle**

`docs/claude/known-issues-and-deferred.md` §A'da Tilt maddesi kalır; BG Effects artık "wired" — §A'ya not (eğer "BG Effects" açık-madde olarak listeli değilse atla; listeliyse "Phase 136'da wire edildi" işaretle). `mockup-studio-contract.md` §0 "Son güncelleme" satırını "Phase 136" yap.

- [ ] **Step 3: Clean restart + fresh build**

```bash
(lsof -ti:3000 | xargs kill -9 2>/dev/null; sleep 1) && rm -rf .next && nohup npm run dev > /tmp/kivasy-dev.log 2>&1 &
sleep 8 && tail -5 /tmp/kivasy-dev.log
```
Expected: `✓ Ready`, 500 yok.

- [ ] **Step 4: Browser parity doğrulama (zorunlu — guardrail 1+2+4)**

Claude in Chrome ile, test set `cmov0ia370019149ljyu7divh` → `/mockup/studio` → Frame mode:

Doğrulanacak kombinasyonlar (guardrail 4 — final'de YAZILACAK):
1. **vignette tek başına** — soft/medium/strong (merkez subject güvenli mi? §guardrail 3)
2. **grain tek başına** — soft/medium/strong (film-grain mi, dijital gürültü mü? §guardrail 2)
3. **vignette + glass**
4. **grain + glass**
5. **grain + lensBlur**

Her biri için: (a) preview snapshot/screenshot, (b) Frame export tetikle → exported PNG, (c) preview vs PNG side-by-side parity. 16:9 + ≥1 layout variant. Büyük ekran (preview screenshot küçükse zoom).

Muddy/noisy/subject-boğan çıkarsa: `BG_VIGNETTE_ALPHA`/`BG_GRAIN_OPACITY` map'lerini yumuşat (frame-scene.ts) → Task 1-2 testleri hâlâ geçmeli (üst sınır assertion'ları korunur) → tsc + vitest + ilgili commit.

- [ ] **Step 5: Quality gates (final)**

Run: `npx tsc --noEmit && npx vitest run tests/unit/mockup tests/unit/selection tests/unit/products tests/unit/listings && NODE_OPTIONS=--max-old-space-size=4096 npx next build`
Expected: tsc temiz; tüm canonical suite PASS; build ✓.

- [ ] **Step 6: Commit + push**

```bash
git add docs/claude/mockup-studio-contract.md docs/claude/known-issues-and-deferred.md
git commit -m "docs(mockup): Phase 136 (8/8) — Contract §7.7 BG Effects normatif + browser parity doğrulandı"
git push origin main
```

- [ ] **Step 7: finishing-a-development-branch**

REQUIRED SUB-SKILL: `superpowers:finishing-a-development-branch`.

---

## Final raporda zorunlu (kullanıcı isteği — 10 madde)

1. BG Effects effect seti: ne seçildi (vignette + grain, tek-seçim)
2. Neden onlar: gerekçe
3. Glass/Lens Blur ilişkisi: bağımsız eksen, compositing order
4. Shots.so'da ne görüldü: Bg Effects = Noise+Blur slider, bağımsız eksen mental model
5. Bizde ne benimsendi: bağımsız eksen + sade tek-seçim cycle
6. Ne bilerek farklı bırakıldı: blur tekrar etmedik, vignette ekledik, tek-seçim
7. Referans-ötesi Kivasy kararı: Shots.so'da vignette yok — Etsy hero için ekledik; sınır olarak almadık
8. Değişen dosyalar: liste
9. Preview/export parity nasıl doğrulandı: 5 kombinasyon browser + exported PNG side-by-side (sonuçlar)
10. Scope-dışı bırakılan effect'ler: pattern overlay, eşzamanlı çift-effect, Portrait/Watermark/Tilt/VFX
