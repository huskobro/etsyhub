# BG Effects (Frame scene effect) — Design

**Tarih:** 2026-05-17
**Durum:** Onaylandı (3 guardrail ile) — implementasyona hazır
**Kapsam:** Mockup Studio Frame mode'da `bgEffect` (vignette + grain) wire'lama
**İlgili authoritative doc:** `docs/claude/mockup-studio-contract.md` (§7.5/§7.6/§11.0),
`docs/claude/mockup-studio-zoom-navigator.md` (§3 kategori sınırı)

---

## 1. Amaç

Mockup Studio Frame mode sidebar'ındaki honest-disabled `bgfx`
("BG Effects") tile'ı wire et: operatör listing-hero / social-card
görselinin arka plan atmosferini (vignette / grain) ayarlayabilsin.
Glass + Lens Blur Phase 98-109'da `SceneOverride` mekanizmasıyla
aktif; BG Effects aynı kanıtlanmış 4-katman pattern'i izler. Yeni
mimari / state hook / abstraction YOK.

## 2. Scope

### In-scope
- `SceneOverride.bgEffect` opsiyonel alan: `{ kind: "vignette" |
  "grain"; intensity: "soft" | "medium" | "strong" }`. Alan yoksa
  = none (effect uygulanmaz).
- **Tek-seçimli**: vignette VEYA grain (ikisi aynı anda değil).
- 3 intensity kademe, `BG_VIGNETTE_*` / `BG_GRAIN_*` sabit map
  (Lens Blur `LENS_BLUR_PX` pattern paraleli).
- Preview (`MockupStudioStage` CSS) + Export (`frame-compositor.ts`
  Sharp) birebir parity.
- `MockupStudioSidebar` `bgfx` tile wire (`isWired=true`,
  `onChangeSceneOverride`).
- Behavior Contract'a normatif kural.

### Out-of-scope (bilinçli)
- **Pattern overlay** (dots/lines/grid) — tile/scale parity riski.
- **Bağımsız çift-effect** (Shots.so Noise+Blur eşzamanlı) — bizde
  tek-seçim; blur zaten `lensBlur` ile karşılanıyor (tekrar etme).
- **Portrait / Watermark / Tilt / VFX** — dokunulmaz; honest-disabled
  kalır (yalnız `bgfx` wire).
- **Operator-uploaded BG image** — ayrı iş.
- Shared framing / zoom / navigator / media-position — dokunulmaz.

## 3. Model

`frame-scene.ts`:
```ts
export type BgEffectKind = "vignette" | "grain";
export type BgEffectIntensity = "soft" | "medium" | "strong";
export interface BgEffectConfig {
  kind: BgEffectKind;
  intensity: BgEffectIntensity;
}
// SceneOverride'a eklenir:
//   bgEffect?: BgEffectConfig;   (undefined = none)
```

Intensity → görsel parametre map'leri (guardrail 1: gerçekten
görsel ayrışsın, agresif olmasın):
```ts
// Vignette: radial-gradient dış-kenar alpha (merkez şeffaf).
// Ürün fotoğrafını öldürmeyecek tavan: strong = 0.45 alpha.
export const BG_VIGNETTE_ALPHA: Record<BgEffectIntensity, number> = {
  soft: 0.14, medium: 0.26, strong: 0.42,
};
// Grain: noise overlay opacity. Mockup'ı kirletmeyecek tavan:
// strong ≈ 0.11 (film-grain hissi, "noisy" değil). Aynı tek
// enum (soft/medium/strong) — ayrı "subtle" YOK.
export const BG_GRAIN_OPACITY: Record<BgEffectIntensity, number> = {
  soft: 0.04, medium: 0.07, strong: 0.11,
};
```
(Kesin sayılar implementasyonda browser görsel doğrulamasıyla
kalibre edilir — guardrail 1; yukarıdakiler başlangıç tavanı.)

## 4. Glass / Lens Blur ilişkisi

`mode` · `glassVariant` · `lensBlur` · `bgEffect` = **dört bağımsız
`SceneOverride` ekseni**. Mutual-exclusion / conditional-disable
YOK. `resolvePlateEffects` zaten `glassOverlay` + `filterBlurPx`
bağımsız döndürüyor → `bgEffect` 3. bağımsız çıktı (`vignette` +
`grain` ayrı alanlar) eklenir.

**Compositing sırası — SABİT (alttan üste), preview CSS
layer-order = Sharp composite order:**
```
1. scene background (solid/gradient/glass base)
2. grain overlay        (bg'nin parçası; glass/blur onu yumuşatır)
3. glass overlay        (mode=glass)
4. lens blur            (plate/all target)
5. vignette overlay     (en üst — kenar koyulaşması her şeyin üstünde)
```
Gerekçe: grain doku → en altta (fotoğrafik norm: noise medyaya
gömülü, sonra optik efektler); vignette → en üstte (lens kenar
karartması optik olarak son katman). Bu sıra hem preview hem
export'ta birebir → parity (§11.0).

## 5. Preview = Export parity

| Effect | Preview (`MockupStudioStage` CSS) | Export (`frame-compositor.ts` Sharp) |
|---|---|---|
| Vignette | plate pseudo-layer `radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,α) 100%)` | radial gradient PNG buffer → `composite` (overlay, plate bbox) |
| Grain | plate pseudo-layer deterministik SVG `feTurbulence` (sabit `baseFrequency`+seed) data-URI, `opacity` | aynı deterministik noise buffer (sabit seed) → `composite` |

Deterministik: vignette = saf gradient formülü (input yok);
grain = **sabit seed** turbulence (her render aynı doku). Aynı
intensity → aynı matematik → preview pixel ≈ export pixel.
Glass/Lens Blur'un parity disiplini korunur.

**Parity doğrulama (zorunlu):** browser preview + Frame export →
exported PNG ile preview side-by-side görsel; vignette/grain
3 intensity × {tek başına, +glass, +lensBlur} kombinasyonları
büyük ekranda incelenir.

## 6. Guardrail'ler (kullanıcı kararı)

1. **Intensity gerçekten görsel ayrışsın, agresif olmasın:**
   soft/medium/strong yalnız isimsel kalmaz; browser'da kalibre
   edilir. Grain tavanı `strong ≈ 0.11 opacity` (mockup
   kirletmez); vignette tavanı `strong ≈ 0.42 alpha` (ürün
   fotoğrafını öldürmez). Final'de 3 intensity görsel kanıtı
   yazılır; gerekirse map yumuşatılır.
2. **Kombinasyon çamurlaşması:** grain+glass / grain+lensBlur /
   vignette+glass kombinasyonları browser'da incelenir; final
   raporda her birinin görsel sonucu yazılır; muddy/noisy ise
   intensity mapping yumuşatılır.
3. **Behavior Contract kuralı kısa+normatif** (prose yok — §7).

## 7. Behavior Contract eklemesi (normatif, kısa)

`mockup-studio-contract.md`'ye §7.5 (Lens Blur) yanına yeni
**§7.7 BG Effects** olarak eklenir:

> **§7.7 BG Effects (Frame scene effect).**
> - `SceneOverride.bgEffect?` — tek-seçimli (`vignette`|`grain` ×
>   `soft/medium/strong`); undefined = none.
> - **Frame-only**: Mockup mode'a sızmaz (Frame scene kararı).
> - **Export'a yansır**: canonical kategori 1; job snapshot'lanır.
> - `mode`/`glassVariant`/`lensBlur`'dan **bağımsız eksen**:
>   kombinlenebilir, mutual-exclusion yok.
> - **Compositing order SABİT**: scene bg → grain → glass →
>   lens blur → vignette (preview CSS layer-order = Sharp
>   composite order).
> - **Preview=Export parity zorunlu** (§11.0): deterministik
>   (vignette gradient formülü, grain sabit-seed turbulence).

## 8. Değişecek dosyalar (~5; Glass/Lens Blur ile aynı katmanlar)

| Dosya | Değişiklik |
|---|---|
| `src/features/mockups/studio/frame-scene.ts` | `BgEffectKind/Intensity/Config` type + `BG_VIGNETTE_ALPHA`/`BG_GRAIN_OPACITY` map + `SceneOverride.bgEffect` field + `resolvePlateEffects` `bgEffect` çözümü |
| `src/providers/mockup/local-sharp/frame-compositor.ts` | type mirror + Sharp vignette gradient composite + grain noise composite (compositing order'a göre) |
| `src/features/mockups/studio/MockupStudioStage.tsx` | preview plate CSS: vignette radial-gradient layer + grain SVG turbulence layer (compositing order) |
| `src/features/mockups/studio/MockupStudioSidebar.tsx` | `bgfx` tile `isWired=true` + popover/control (kind seç + intensity) + `onChangeSceneOverride` |
| `docs/claude/mockup-studio-contract.md` | §7.7 normatif kural (§7) |

**Dokunulmaz:** `media-position.ts`, `cascade-layout.ts`,
`zoom-bounds.ts`, navigator/viewfinder, rail single-renderer,
Portrait/Watermark/Tilt/VFX tile'ları.

## 9. Test stratejisi

- **Unit:** `frame-scene.ts` — `resolvePlateEffects` bgEffect
  kombinasyonları (none / vignette×3 / grain×3 / +glass / +lensBlur);
  intensity map sınır değerleri; undefined = no-op.
- **Quality gates:** `tsc --noEmit` + `vitest` (mockup suite) +
  `next build`.
- **Browser (zorunlu, guardrail 1+2):** clean restart + fresh
  build → Frame mode → bgfx tile → her intensity görsel +
  3 kombinasyon (grain+glass, grain+lensBlur, vignette+glass) →
  Frame export → preview vs exported PNG parity (pixel/görsel).
  16:9 + ≥1 layout variant.

## 10. Riskler

- **Grain Sharp determinizmi:** Sharp noise sabit seed ile
  üretilmeli; preview SVG turbulence ile Sharp noise birebir
  pixel olmayabilir — kabul edilebilir tolerans "algısal eşdeğer"
  (Glass overlay'in de sub-pixel toleransı var; §11.0 "birebir"
  = algısal/yapısal, bit-exact değil). Final'de bu açıkça yazılır.
- **Intensity kalibrasyon:** ilk sayılar tavandır; browser
  doğrulamada yumuşatma gerekebilir (guardrail 1) — plan buna
  esnek.
