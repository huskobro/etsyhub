# Kivasy Mockup Studio Desired Behavior Contract

> **AUTHORITATIVE — CURRENT.** Bu, Mockup Studio'nun **yaşayan davranış
> sözleşmesidir** (bug listesi DEĞİL). Studio ile ilgili her yeni tur
> (refactor, polish, bug fix, feature) önce bu dosyayı okur, hangi
> davranışı bozduğunu/teyit ettiğini ölçer. Source of truth: bu dosya
> + kod. Tarihsel Phase narrative'leri için → `docs/claude/archive/`
> (orası authoritative DEĞİL — yalnız "nasıl bu hâle geldi").
>
> **Son güncelleme:** Phase 136 (2026-05-17) — §7.7 BG Effects
> (Frame scene effect: vignette+grain, tek-seçim, mode/glass/
> lensBlur'dan bağımsız eksen; compositing order bg → grain →
> glass → blur → cascade → vignette; Preview = Export §11.0).
> Phase 135 — zoom-aware pan reach (§5/§7: marker visibility ≠
> pan reach; rectangle overflow serbest).
>
> **İlgili authoritative topic docs:** zoom/navigator/marker davranışı
> → [`mockup-studio-zoom-navigator.md`](./mockup-studio-zoom-navigator.md) ·
> framing/composition/plate → [`mockup-studio-framing.md`](./mockup-studio-framing.md) ·
> rail preview/chrome → [`mockup-studio-rail-preview.md`](./mockup-studio-rail-preview.md) ·
> açık işler → [`known-issues-and-deferred.md`](./known-issues-and-deferred.md).
>
> Sözleşme **değişebilir** ama açık bir karar + Phase entry'si ile
> değiştirilir; sessiz silent override yasak. Sözleşme yalnız
> operatör-facing canonical davranışı tanımlar; implementasyon detayı
> (component isimleri, prop shape) değil **niyetin kalıcı tarifi**.
> Shots.so + MockupViews live davranış araştırması + Kivasy-superior
> denge kararlarına dayanır.

## 0. Çekirdek (6-başlık özeti)

> Hibrit şablon: çekirdek 6 başlık burada; **detay/derinleştirme
> aşağıdaki §1–13'te** (Behavior Contract maddeleri — Mockup/Frame
> ilişkisi, stage continuity, plate, aspect, scroll, rail,
> selection, layout count, real asset, productType, §11.0
> Preview = Export Truth, handoff, future direction).

1. **Kapsam / Rol / Boundary:** Mockup Studio'nun genel davranış
   sözleşmesi (§1–13) — Mockup mode (object surface) + Frame mode
   (presentation surface), stage/plate/composition continuity,
   Preview = Export Truth. Boundary: zoom/navigator detay → §6a,
   geometri → §6b, rail → §6c, açık/future → known-issues.
2. **Current behavior:** §1–13 maddeleri (her biri kendi current
   behavior + invariant + Phase fulfilled durumunu taşır). En
   kritik: §11.0 Preview = Export Truth (exported PNG canonical
   truth; preview onun authoring önizlemesi; editing helper'lar
   hariç birebir).
3. **Invariants:** Tüm §1–13 maddeleri canonical invariant
   (özellikle §11.0 Preview = Export Truth, §12 No silent magic,
   §2 stage continuity, 4-kategori parametre ayrımı). Sözleşme
   değişikliği açık karar + Phase entry gerektirir (sessiz
   override YASAK).
4. **Relevant files / Ownership:** `src/features/mockups/studio/`
   (StageScene, MockupStudioStage, StageScenePreview,
   MockupStudioShell, MockupStudioPresetRail, cascade-layout,
   media-position, zoom-bounds, frame-scene, svg-art),
   `src/providers/mockup/local-sharp/frame-compositor.ts`
   (canonical export), `src/server/services/frame/
   frame-export.service.ts`, `src/app/(studio)/`. Companion
   doc'lar: §6a `mockup-studio-zoom-navigator.md`, §6b
   `mockup-studio-framing.md`, §6c `mockup-studio-rail-preview.md`.
5. **Open issues / Deferred:** → `docs/claude/known-issues-and-
   deferred.md` (A-G; §13 future direction operasyonel özeti).
6. **Archive / Historical pointer:** → `docs/claude/archive/
   phase-log-97-135.md` (NOT authoritative; Phase 77-135 Mockup
   Studio anlatısı). Günlük çalışmada inilmez.

---

### 1. Mockup vs Frame mode ilişkisi

- Mockup mode = **object surface authoring** ("how it looks"). Operator
  template seçer, slot başına design atar, style/border/shadow düzenler,
  render dispatch eder. ProductType-aware device shape (wall art frame,
  sticker die-cut, t-shirt silhouette, vb.).
- Frame mode = **presentation surface authoring** ("how it sells").
  Operator aspect ratio + background + scene + effects ile listing hero
  / social card / storefront banner / Pinterest pin composition'ı
  oluşturur.
- **Aynı stage**, **aynı kompozisyon**, mode-aware **content swap**.
  Operator Mockup → Frame geçerken "başka sayfaya gittim" hissi
  almaz. Toolbar + sağ rail outer chrome mode-AGNOSTIC; sol panel
  içeriği mode-aware swap.
- Render dispatch (Mockup mode'da gerçek backend job) + Frame mode
  export pipeline (presentation surface gerçek output) **iki ayrı**
  pipeline; ama operator Mockup'ta üretip Frame'de presentation'a
  taşır — handoff sözleşmesi netleşir (Phase 98+ candidate).

### 2. Stage continuity (mode + aspect + slot click + scroll)

- Stage container outer mode-AGNOSTIC + aspect-AGNOSTIC.
- Stage composition (cascade item'ları) mode-AGNOSTIC: Mockup → Frame
  geçişinde slot pozisyonu, ölçeği, drop-shadow filter chain'i
  **birebir korunur**.
- Slot click plate-bg'sini değiştirmez (Phase 93 baseline). Plate bg
  yalnız Frame mode scene/swatch controls + Magic Preset toggle ile
  değişir.
- Stage merkez stable — page scroll, panel scroll, viewport resize
  stage'i kaydırmaz (Phase 93 page-scroll lock + Phase 95 overscroll
  lock).
- **Cascade / multi-item compositions = plate-relative LOCKED group
  (Phase 111 canonical):** Cascade ve benzeri çoklu mockup item
  setleri tek tek bağımsız obje DEĞİL, plate'e bağlı **tek
  composition group**. Responsive scaling + aspect değişimi
  sırasında:
  - **Composition geometry önce grup olarak korunur** (items
    birbirlerine göre relative offset'leri sabit — gerçek bbox
    0-origin normalize), **sonra plate'e fit edilir** (group bbox
    plate'in `PLATE_FILL_FRAC` iç alanına aspect-locked bbox-fit
    scale; CLAMP YOK — plate büyürse group orantılı büyür,
    küçülürse küçülür).
  - **Group center daima plate center'da** (stage-inner BBOX-TIGHT,
    CSS plate-center → drift sıfır; rotation görsel offset'i
    simetrik dağılır).
  - **Individual item drift KABUL EDİLMEZ.** Phase 95-110 baseline
    sabit 572×504 stage-inner + `Math.min(.../572, .../504, 1.0)`
    (tek-eksen + clamp) plate aspect değişince group bbox/plate
    oranını dramatik kaydırıyordu (16:9 %55.5 → 1:1 %84.1) +
    center drift (16:9 @1440 centerDy:22). Phase 111 fix: group
    bbox/plate oranı **tüm aspect/viewport'ta sabit** (%86 width,
    aspect değişse de drift sıfır), center dx≈dy simetrik küçük
    residual (~3-9px rotation görsel).
  - **Preview = Export Truth (§11.0):** `frame-compositor.ts` aynı
    `PLATE_FILL_FRAC` bbox-fit + bbox-center→plate-center mantığını
    uygular (pixel kanıt: preview group/plate %86 ↔ export %84.9,
    aynı formül `plateCenter − bbox/2·scale + (slotX−minX)·scale`).
- **Composition primitive resmî (Phase 112 canonical):**
  `compositionGroup(items, plateW, plateH)` (MockupStudioStage.tsx)
  **reusable primitive**, cascade'e özel DEĞİL: herhangi
  `{si,x,y,w,h,r,z}[]` alır → gerçek bbox + `PLATE_FILL_FRAC`
  aspect-locked plate-fit scale (clamp YOK) + items 0-origin
  normalize + `{scale, bboxW, bboxH, items}` döner. **Cascade =
  first client**, underlying system = reusable primitive set.
  Evrensel kabul edilen kavramlar: composition bbox, normalized
  local coordinates, plate-fit strategy, anchor policy
  (bbox-tight stage-inner + CSS plate-center), locked-group
  transform. Yeni layout (ileride) bu primitive'i tüketir;
  **ayrı composition engine / layout strategy interface
  AÇILMAZ** (erken abstraction — bugünkü 1 layout-family
  ihtiyacından kopuk; capability map'in Phase 109-111 dead-code
  dersi). Yeni shape = `cascadeLayoutForRaw` switch'e tek case
  (layout registry, hack değil). Bu sınır ileride Claude'un hem
  aşırı özel-case hem aşırı soyut framework yazmasını engeller.

### 3. Plate behavior

- Plate stage'in **ortasında bounded surface**. Operator için "objenin
  arkasında gerçekten görünen surface" — ana subject.
- Plate dimensions aspect-aware bbox-fit (Phase 95 baseline);
  aspect değişimi plate'i resize eder. Plate maxBbox stage'in
  ~%85-90 alanını hedefler — stage padding korunur ama plate boş
  void değil **dolu surface**.
- Plate bg sceneOverride-driven (auto/solid/gradient/glass) +
  asset-aware fallback (selected slot palette / first assigned
  slot palette). Phase 91 baseline.
- Plate border + multi-layer drop shadow ile stage'den net ayrı
  (Phase 92 baseline). **Phase 134 — radius + shadow plate
  genişliğine ORANSAL** (`plateRadiusForWidth(plateW)` =
  `plateW × 0.024`, shared `cascade-layout.ts`; shadow `sW×0.024/
  0.047` offset, `sW×0.047/0.076` blur — inline `plateStyle`,
  Stage). Sabit `border-radius: 26px` + sabit box-shadow
  KALDIRILDI (rail thumb küçük plate'te %18 köşe + devasa siyah
  halka = "koyu gri → siyah → sarı kart" stacking idi). Tek
  formül iki ölçek: middle %2.4 ≈ rail %2.4 ("aynı sahnenin
  küçük versiyonu"). `.k-studio__preset-ring` radius da
  `plateRadiusForWidth(railPlateW)+6` (plate köşesiyle
  konsantrik) — detay → [`mockup-studio-rail-preview.md`](./mockup-studio-rail-preview.md).
- Plate **mode-AGNOSTIC** görünür; Mockup'ta object surface'i,
  Frame'de presentation surface'i taşır — ama plate'in kendisi
  iki modun ortak görsel taşıyıcısı.

### 4. Aspect / shared state

- `frameAspect` Shell-level **SHARED state** (mode-AGNOSTIC). Frame
  mode'da seçilen aspect Mockup mode'a da geçer; Mockup mode'a
  döndüğünde plate aynı aspect'te kalır. Phase 95 canonical
  Shots.so parity.
- Aspect değişimi: caption + toolbar status badge + sağ rail
  preset thumb aspect refresh + plate bbox-fit. Cascade plate
  içine `cascadeScale` ile orantısal sığar (portrait aspect'te
  cascade küçülür ama tüm slot'lar görünür).
- Default aspect: Mockup mode için 4:3 horizontal (Shots Mockup
  default'una yakın), Frame mode'a geçişte operator değiştirebilir.

### 5. Scroll / viewport behavior

- Page scroll **kilitli** (`height: 100dvh + overflow: hidden +
  overscroll-behavior: none`). Sayfa düzeyinde scroll yok.
- Sol sidebar + sağ rail kendi internal scroll alanlarını taşır.
  Operator sidebar'da Magic Preset altına inerse stage + rail
  sabit kalır.
- **Phase 110 — Aspect-locked viewport-aware plate scaling
  (Shots.so canonical, browser+DOM ölçümüyle doğrulandı):**
  Plate boyutu **viewport-aware tek aspect-sabit hesapta**
  belirlenir (`plateDimensionsFor` window dims + railCollapsed
  → available stage alanı → aspect-locked bbox-fit). CSS
  bağımsız `max-width`/`max-height` % clamp **KALDIRILDI** —
  Phase 95-109'da iki ayrı % cap (biri tetiklenince diğeri
  orantısal küçülmüyor) 16:9 plate aspect'ini bozuyordu (@1440
  1.432, @1180 1.097; 16:9=1.778'den sapma — kullanıcının
  "browser daralınca aspect sabit kalmıyor" bug'ının kök
  nedeni). Phase 110 sonrası aspect **daima sabit** (16:9 →
  1.777-1.780 her viewport'ta). cascadeScale plateDims'i
  kullandığı için otomatik düzelir: plate küçülünce cascade
  orantılı küçülür = **plate + item beraber browser-zoom-out
  hissi** (Shots parity; @1440 cascade scale 0.964 → @1180
  0.907). Stage merkez stable (Phase 93/95 baseline korunur).
- **3-aşamalı responsive viewport (Phase 110 — Shots.so live
  ölçümü 3-aşamalı kanıtladı):**
  - **≥ 1280px** → full: sidebar 214px + stage + rail 202px.
  - **880–1280px** → **rail-collapse ara aşaması**: sağ rail
    gizli (conditional render), stage o alanı kazanır (stage
    764→966px, plate %55→%73.6 vw — Shots'ta da rail <~1200'de
    gizlenir, stage büyür). Sol panel + stage usable kalır;
    aspect sabit, cascade orantılı zoom-out. Eşik öncesi iyi
    deneyim.
  - **< 880px veya < 640px height** → larger-screen intercept:
    studio shell render edilmez, sade Kivasy dark-shell-uyumlu
    **"Mockup Studio needs a larger screen"** state (orange
    monitor icon + 880×640 açıklama + "Back to selection"
    link). Shots.so ~764px altında editor'ü HİÇ göstermez,
    landing/splash koyar (broken editor değil — dürüst). Kivasy
    aynı: bozuk sidebar/stage squeeze YERİNE dürüst intercept.
  - Phase 109 tek-aşamalı idi (≥1100 full / <1100 intercept);
    Phase 110 rail-collapse ara aşaması ekledi, intercept eşiği
    1100→880'e indi (rail-collapse 880-1280'de usable studio
    sağladığı için).
- Guard mekanizması: Shell `window.innerWidth/innerHeight`
  state (resize listener) + türetilen `viewportTooSmall`
  (<880w veya <640h) + `railCollapsed` (<1280, not tooSmall).
  Yeni route/yüzey DEĞİL — `MockupStudioStage` viewport prop'ları
  + rail conditional render + Shell early-return intercept.
  Mount'ta + resize'da sync. Geçişler çift yönlü (eşik üstüne
  dönülünce full studio + rail geri gelir; resize sonrası
  aspect bozulmaz).

### 6. Right rail behavior

- Rail outer chrome mode-AGNOSTIC (export capsule, layout count
  buttons, view tabs, zoom slider, layout presets section).
- Rail head 1/2/3 buttons cascade item count'unu kontrol eder.
  Bu **rail thumb sayısını DEĞİŞTİRMEZ** — her thumb count-aware
  varyasyonunu içeride render eder (Phase 96 baseline).
- Rail thumb sayısı Shots'ta 7 sabit; Kivasy'de 6 (LAYOUT_PRESETS).
  Operator için "aynı kompozisyonun N farklı layout varyasyonu"
  hissi — sayı değil **varyasyon library** önemli.
- **Preset isimleri yalnız label değil GERÇEK farklı kompozisyon
  (Phase 114 fulfilled — CANONICAL shared parameter).** Phase
  96-113 boyunca bu madde Contract'ta yazılıydı ama kod gerçeği
  AYRIŞMIŞTI: rail preset onClick `setActive(i)` LOCAL state'ti
  (yalnız thumb highlight), `cascadeLayoutForRaw` tek hardcoded
  layout döndürüyordu — preset NO-OP (Madde #12 sessiz drift).
  Phase 114: `StudioLayoutVariant` canonical Shell state
  (cascade/centered/tilted/stacked/fan/offset). Rail preset
  onClick → Shell setter → Stage cascade + rail thumb + Frame
  export HEPSİ aynı değerden okur. `cascadeLayoutFor(kind, count,
  variant)` — `cascadeLayoutForRaw` per-productType BASE boyut
  (shape-specific impl detail, kategori 3, registry içinde AYRI)
  + `applyLayoutVariant` boyutları koruyup dizilim/rotation/offset
  variant'a göre üretir (canonical shared parameter, kategori 1,
  productType-agnostic). "cascade" = Phase 77-113 baseline
  (regression yok). Operator preset seçince preview cascade +
  exported PNG GERÇEKTEN değişir (browser+pixel kanıtlı).
- Rail thumb asset-aware (Phase 86) + scene-aware (Phase 89) +
  count-aware (Phase 96) + **variant-aware (Phase 114 — thumb
  `displayCount`/`active` canonical layoutVariant index'inden)**.
  Mode-AGNOSTIC (Phase 96 unified family + Phase 114 layoutVariant
  mode-AGNOSTIC: Mockup↔Frame geçişinde korunur).
- **Rail thumb = orta panelin AYNI StageScene'i, scaled + candidate
  layoutVariant** (Phase 117-134). Ayrı SVG renderer YOK; tek render
  path. chromeless prop → stage container chrome gizli (Phase 118).
  Containerless, aspect-adaptive, plate-fit, marker clamp ve detaylı
  davranış → [`mockup-studio-rail-preview.md`](./mockup-studio-rail-preview.md)
  (authoritative).

### 7. Selection / preview behavior

- Selection ring + slot badge **yalnız Mockup mode**, **yalnız Edit
  state**. Frame mode'da yok; Preview state'inde yok (Phase 94
  baseline).
- Slot click cascade içinde aktif slot'u seçer; bu slot'a yapılacak
  edit'ler (rename, replace, edit prompt) sidebar Selection /
  Slot footer üzerinden açılır.
- Selection chrome subtle — agresif orange glow halo yok (Phase 94
  baseline). Uniform drop-shadow + selection ring tek sinyal.
- Hover preview / replace flow operator için non-blocking; stage
  composition bozulmaz.

### 7.5 Lens Blur / effect targeting (Phase 109)

- Lens Blur **monolitik boolean DEĞİL** — structured config
  `{ enabled, target, intensity }` (`SceneOverride.lensBlur`;
  backward-compat: legacy `boolean true` → `{enabled:true,
  target:"all", intensity:"medium"}`, `undefined/false` →
  disabled; `normalizeLensBlur` helper tek normalize noktası).
- **target** `"plate"` (default) | `"all"`:
  - `"plate"`: yalnız plate bg/scene bulanık; **cascade items
    NET**. Operatör eğilimi ("itemler blur'lu olmamalı") +
    Preview = Export Truth §11.0 (items keskin, sahne
    atmospheric). Preview: plate bg AYRI absolute surface
    layer (`k-studio__plate-surface`, z-index 0) + ona CSS
    `filter:blur`; cascade composition (`k-studio__stage-inner`
    z-index 1) NET. Export: Sharp pipeline cascade-SİZ canvas
    blur → plate-area rounded mask → net canvas + slotComposites
    blur'suz EN ÜSTE (preview z-index 0/1 birebir).
  - `"all"`: plate + cascade items hepsi blur (legacy Phase
    98-108 davranış — backward-compat). Preview: plate div'in
    tümüne filter. Export: Phase 108 baseline (full canvas blur
    → plate-area mask).
- **intensity** `"soft" | "medium" | "strong"` → CSS 4/8/14px
  (preview) / Sharp sigma 3/6/11 (export). Default `medium`.
- Lens Blur enable iken Frame sidebar'da **target + intensity
  seçim UI** (Plate only / Plate + items + Soft/Medium/Strong
  segment'leri). Shots.so'da ayrı Lens Blur tile YOK (blur
  STYLE/Glass içinden) — Kivasy Lens Blur **Kivasy-özgü**;
  parity zorlaması yok, tasarım kararı bize ait.
- Banner stale: enabled + target + intensity hepsi export'a
  yansır (Preview = Export Truth) → herhangi biri değişirse
  "Preview changed — re-export?" (sözleşme #12 no silent magic).

### 7.6 Shared device capability model (Phase 109 + Phase 112 fiilen tüketim)

- Effect/SVG-varyasyon **tek tek mockup if-else patlaması ile
  DEĞİL** — tek `STUDIO_DEVICE_CAPABILITIES` map (deviceShape →
  `{ supportsLensBlurTargeting, supportsColorVariant,
  supportsChromeTone }`). `studioDeviceCapability(shape)` tek
  erişim noktası.
- **Phase 112 — capability map artık FİİLEN tüketiliyor.** Phase
  109'da map kuruldu ama **sıfır tüketici** idi (dead future-only
  abstraction — kullanıcının "gelecekte gerekebilir diye yazılmış,
  bugünden kopuk" eleştirdiği tam örnek). Phase 112: Sidebar Lens
  Blur targeting UI'ı `studioDeviceCapability(deviceKindToShape(
  deviceKind)).supportsLensBlurTargeting` ile **gate'lenir** —
  shape `false` ise target/intensity UI gizlenir (ad-hoc if-else
  yerine tek capability kapısı). Şu an tüm shape `true` →
  **davranış birebir aynı** (Lens Blur targeting hâlâ görünür),
  ama capability model artık canlı (dead-code canlandı). Future
  SVG-specific shape `supportsLensBlurTargeting=false` set ederse
  UI otomatik gizlenir.
- **`deviceKindToShape(deviceKind)`** (Phase 112, `frame-scene.ts`
  client-safe) — `resolveDeviceShape` (frame-compositor.ts,
  server-side) ile **birebir aynı mapping**. Build-boundary
  tekrarı **bilinçli** (Phase 105 emsali: server compositor
  sharp/server-only, client studio ayrı bundle — frame-scene
  client modülü compositor'ı import edemez). Tek client-side
  kaynak: capability erişimi + ileride shape-aware client logic
  buradan okur, ad-hoc switch büyütülmez.
- Phase 109'da yalnız `supportsLensBlurTargeting: true` (tüm
  shape — Lens Blur target/intensity evrensel). `supports
  ColorVariant` / `supportsChromeTone` tip+map'te var ama hepsi
  **false** (feature açılmadı — future SVG readiness §13 / §7).
- **Future SVG-specific feature** (phone color, button color,
  browser frame style, chrome/material tone): ilgili shape'in
  capability entry'sine **FIELD eklenerek** gelir — kod
  patlamaz, effect sistemi baştan buna göre tasarlandı. Feature
  şimdi açılmaz; effect/action sistemi tasarlanırken hesaba
  katılır (kullanıcı kısıtı: "ortak capability/parameter
  modeliyle ilerlesin, tek tek hack değil").

### 7.7 BG Effects (Frame scene effect — Phase 136)

- `SceneOverride.bgEffect?` — tek-seçimli (`vignette`|`grain` ×
  `soft/medium/strong`); undefined = none.
- **Frame-only**: Mockup mode'a sızmaz (Frame scene kararı).
- **Export'a yansır + snapshot'lanır**: canonical kategori 1;
  `sceneSnapshot`'a girer, `FrameExportResultBanner` `isStale`
  karşılaştırmasına dahil (glass/lensBlur ile birebir —
  değişirse "Preview changed — re-export?").
- `mode`/`glassVariant`/`lensBlur`'dan **bağımsız eksen**:
  kombinlenebilir, mutual-exclusion YOK.
- **Compositing order SABİT** (preview CSS layer-order = Sharp
  composite çağrı sırası): scene bg → **grain** → glass →
  lens blur → cascade → **vignette**. Grain bg'nin parçası
  (glass/blur onu yumuşatır); vignette EN ÜSTTE (optik kenar
  karartması son katman). `resolvePlateEffects` tek pure-TS
  resolver (preview + export aynı).
- **Preview = Export parity zorunlu** (§11.0): deterministik —
  vignette saf radial-gradient formülü; grain sabit-seed
  monokrom noise. Preview SVG feTurbulence ↔ Sharp greyscale
  gaussian: **algısal eşdeğer, bit-exact değil** (§11.0
  "birebir" = yapısal/algısal). Grain export alpha = dest-in
  mask `fill-opacity=grainOpacity` (Sharp `ensureAlpha`
  NO-OP olduğu için — grainPlate zaten channels:4).
- Vignette merkez ~%60 ŞEFFAF (radial `transparent 60% →
  alpha 100%`); subject boğmaz, portrait/vertical güvenli.
  Grain monokrom film-grain (dijital RGB gürültü DEĞİL).
- Intensity (browser-kalibre tavan): vignette α
  soft/medium/strong = 0.14/0.26/0.42; grain opacity =
  0.04/0.07/0.11. `BG_VIGNETTE_ALPHA`/`BG_GRAIN_OPACITY`
  (frame-scene.ts) — değişirse unit-test tavanı (≤0.42/≤0.11)
  korunmalı.
- Sidebar: `bgfx` tile tek-seçim **cycle** (none → vignette·
  medium → grain·medium → none); Shots.so popover yerine sade
  toggle (CLAUDE.md sade-güçlü).
- Scope-dışı (Phase 136): pattern overlay, eşzamanlı çift-effect
  (blur zaten `lensBlur`), Portrait/Watermark/Tilt/VFX
  (honest-disabled korunur).

### 8. Layout count behavior

- 1/2/3 cascade item count (Shots paritesi). N×M grid (1..5 × 1..5)
  **YASAK** — Shots'ta yok, operator workflow'unda template-level
  multi-slot (Phase 72-76) ile zaten karşılanıyor. Phase 97
  self-critique kararı.
- **Single-item (count=1) cascade plate ORTASINDA**. Phase 97
  düzeltmesi: `centerCascade` layoutCount uygulandıktan sonra
  hesaplanır; slot 0'ın N=1 case'inde sola kaymaz.
- N=2/3 cascade layout'u tasarımcı tarafından kompoze edilmiş
  preset (Cascade/Centered/Tilted...) — operator değiştiremez,
  ama preset seçerek farklı kompozisyona geçer.
- Rail head count buttons → Shell state → (rail thumb display
  count + stage cascade count) senkron (Phase 96 baseline).

### 9. Real asset expectation

- Selection set hydrate **gerçek MinIO asset URL** ile çalışır
  (Phase 79 baseline). Dev seed placeholder palette kullanır ama
  pipeline real asset için hazır.
- Operator için "test image upload + Studio'da render + S7/S8 result"
  end-to-end working. Render dispatch real backend job tetikler
  (Phase 8 mockup render pipeline).
- Studio'nun **fake / dummy demo asset göstermesi yasak** — daima
  selected set'in items'ı veya operator'ün upload ettiği gerçek
  asset gösterilir. Placeholder palette acceptable bir fallback;
  hardcoded sample image YASAK.

### 10. ProductType-aware behavior

- Stage device shape selected set'in productType'ına göre değişir
  (Phase 82 baseline). Wall art set → wall art frame; sticker set
  → sticker die-cut; t-shirt set → garment silhouette; vb.
  Placeholder iPhone yalnız bilinmeyen kategori fallback.
- Plate aspect default'u productType'a uyumlu (4:3 horizontal genel
  default; ileride productType-specific aspect chip'leri eklenebilir
  — Phase 98+ candidate).

### 11.0 Preview = Export Truth (canonical ilke — Phase 103)

**Bu ilke Mockup Studio'nun en yüksek öncelikli görsel sözleşmesidir.**

Studio preview'da operator ne görüyorsa, exported PNG **birebir o**
olmalı — **yalnız editing helper'lar hariç**.

**Editing helpers (preview-only — export'a GİRMEZ):**
- slot-ring (selection box-shadow / active marker)
- slot badge ("01 Front View" / active helper label)
- selection marker / hover state
- debug / dev overlay (varsa)
- **navigator pad marker / viewfinder rectangle** (Phase 134/135 —
  rail-head pad overlay; preview-only viewing aid, export'a girmez;
  detay → [`mockup-studio-zoom-navigator.md`](./mockup-studio-zoom-navigator.md))
- **previewZoom** (Phase 125 — preview-only zoom; export composition
  scale=1)

**Final visual chrome (preview = export — ikisi de aynı):**
- item border / white outline
- item rounded corner
- item drop shadow chain
- **item tilt / rotation** (slot `r` derecesi — preview CSS
  `transform:rotate` ile export Sharp tile rotation birebir)
- item scale
- item placement (slot pozisyonu, cascade dizilimi)
- plate ↔ item ilişkisi (plate chrome + item'ın plate üzerindeki
  yeri)

**Slot / asset identity de Preview = Export Truth kapsamındadır
(Phase 113 canonical):** Preview = Export Truth yalnız geometry
(tilt / scale / placement / chrome) için değil, **hangi slot'ta
hangi item görünüyor** için de geçerlidir. Studio preview'da slot
N'de hangi selection-item çiziliyorsa, exported PNG'de slot N'de
**birebir o item** olmalı.

- Studio `realSlots` selection set items'ı `position` sıralı slot
  index'e map eder (slot 0 → sorted[0], slot 1 → sorted[1], …).
  Preview her slot'un kendi item'ını çizer.
- Export request body slot→itemId eşleşmesi bu **doğal slot→item
  dizilimini** taşımalıdır (`StudioSlotMeta.design.itemId` stable
  identity field; export fallback zinciri: operator override
  (Phase 80 `slotAssignments`) → slot.design.itemId → son çare
  global fallback).
- "firstAssignedItemId fanout fallback" (operator override yokken
  TÜM slot'lara items[0]) **YASAK** — Phase 113 öncesi bu bug
  3 farklı preview item'ı export'ta tek item'a düşürüyordu.
  Yeni model: slot'un doğal item'ı canonical.

Bu ilkeye aykırı bir davranış görülürse (preview'da yatık item
export'ta dimdik, preview'da görünen outline export'ta kayıp,
preview'da 3 farklı item export'ta 1 item, vb.): ya sözleşme
açıkça güncellenir ya da kod düzeltilir. **Sessiz divergence
kabul edilmez.** Operator "export edildi ama başka bir görsele
dönüştü" hissi almamalı.

**Plate-local layered effects modeli (Phase 113 canonical):**
Frame mode efektleri (glass / lens blur / glow / tint) 3-katmanlı
düşünülür ve hem preview hem export bu modeli birebir izler:

- **Layer 1 — plate base**: `k-studio__stage-plate` bg (export
  `buildPlateLayerSvg`). Plate stage'den **yalnız drop-shadow
  chain** ile ayrılır; sabit beyaz/inset border YOK (Phase 113'te
  kaldırıldı — solid koyu bg'de pop ediyordu; bu görsel ileride
  explicit bir frame-style/chrome parametresi olarak gelecek).
- **Layer 2 — effect layer**: glass overlay + lens blur surface.
  Item layer'ın **ALTINDA** (preview z-index 0/1, DOM'da
  cascade'den ÖNCE; export compose sırası plate → glass → blur).
  Glass = plate üstü variant-tinted surface treatment (item'a
  değil plate'e). `backdrop-filter` + inset border halo
  KALDIRILDI (item'ları bulanıklaştırıyor + plate kenarında
  inner-border üretiyordu).
- **Layer 3 — item layer**: cascade composition (preview
  z-index 2; export compose'da slotComposites EN ÜSTE). Effect'ten
  **ETKİLENMEZ** — itemler varsayılan olarak blur/tint ALMAZ
  (operatör eğilimi + §11.0). Lens Blur target "plate" (default)
  vs "all" export'ta artık aynı: ikisi de plate-area bg blur,
  item NET (Phase 113 — "all" eski "cascade dahil blur" semantiği
  layered model ile geçersiz; backward-compat normalize korunur).

Future SVG/effect readiness: yeni efekt (phone color / button
color / browser window style / chrome tone) bu 3-layer modele
oturur — Layer 2'ye yeni treatment, Layer 3 (item) effect-bağımsız
kalır. Tek-mockup hack veya per-effect z-index patlaması YASAK.

**Shared canonical parameter de Preview = Export Truth kapsamındadır
(Phase 114 canonical — unified studio parameter):** Preview = Export
Truth yalnız geometry + asset identity + layered effects için değil,
**operator'ın seçtiği her final visual parametre** için geçerlidir.
Kullanıcı bir değer seçtiğinde (layout variant, layout count, scene
mode/glass/blur, frame aspect, slot assignment, device shape) bu
seçim **tek canonical Shell state'ten** okunur ve stage preview +
rail thumb + Frame export payload + Product MockupsTab tile HEPSİ
aynı değerden türer. Ayrışma (preview "X", export "Y baseline")
YASAK.

- **Canonical shared parameters (kategori 1 — final visual,
  preview+export+rail aynı kaynak):** layoutVariant (Phase 114),
  layoutCount, sceneOverride (mode/glass/blur/color), frameAspect,
  slot itemId / slotAssignments, deviceShape, activePalette.
- **Mode/UI-specific state (kategori 2 — AYRI kalır, unify
  edilmez):** mode (mockup/frame), appState, viewTab (zoom/tilt/
  precision), **previewZoom** (Phase 125 preview-only),
  **mediaPosition** pad GÖSTERİM tarafı (Phase 134/135 — canonical
  state export'a girer ama navigator marker clamp + zoom-aware pan
  reach preview-only viewing aid; detay zoom-navigator doc). Bunlar
  tek canonical parameter potasına ERİTİLMEZ (yanlış unify —
  önceki fazların doğru ayrımları korunur).
- **Shape/layout-specific impl detail (kategori 3 — registry
  içinde AYRI):** `cascadeLayoutForRaw` per-productType base
  geometri, `resolveDeviceShape` SVG mapping. Variant logic
  productType-agnostic; shape detail registry'de kalır (tek pota
  DEĞİL).
- **Preview-only helper (kategori 4 — export'a GİRMEZ):**
  selectedSlot ring, slot badge (Phase 94 baseline korunur),
  navigator pad marker/viewfinder (Phase 134/135).

Yeni final visual parametre eklenirken kategori 1'e girer (tek
Shell state → preview + export + rail). Yeni framework / store /
reducer AÇILMAZ — Shell `useState` + sub-component prop iletimi
yeterli (bugün tek consumer ailesi; erken abstraction §7.6
dead-code dersi). `cascadeLayoutFor` çağrısı preview
(MockupComposition/FrameComposition) ve export (`handleExportFrame`)
TEK kaynak; `frame-compositor.ts` slot pozisyonlarını TÜKETİR
(kendi layout üretmez) → Preview = Export yapısal garanti.

**Rail thumb-candidate de Preview = Export Truth kapsamındadır
(Phase 115 canonical — thumb-candidate genişletme):** Right rail
thumb'ı yalnız "operatöre fikir veren dekoratif önizleme" DEĞİL —
**aynı canonical geometri kaynağının candidate-variant türevi**.
Phase 96-114 boyunca thumb `MOCKUP_PRESETS[idx].ph` hardcoded
geometriden render ediyordu; Phase 114 layoutVariant canonical
oldu (preview cascade + export GERÇEKTEN değişir) AMA thumb hâlâ
ayrı kopuk geometriden çiziliyordu — bu §11.0'ın "tek canonical
kaynak" garantisini rail için ihlal ediyordu (Madde #12 yapısal
drift). Phase 115 fix: `cascadeLayoutFor` + `applyLayoutVariant` +
`cascadeLayoutForRaw` + `centerCascade` paylaşılan `cascade-layout.ts`
module'üne çıkarıldı; **Stage (preview) + Shell (`handleExportFrame`
→ frame-compositor) + rail thumb (`PresetThumbMockup`) ÜÇÜ DE bu
TEK kaynaktan okur**. Thumb idx → candidate `layoutVariant`;
`cascadeLayoutFor(deviceShape, displayCount, candidateVariant)` →
~572×504 stage-inner koordinatları 184×88 viewBox'a aspect-locked
bbox-fit normalize. Sonuç: operator bir layout preset seçtiğinde
**rail thumb yapısal dizilim ≈ stage cascade ≈ exported PNG cascade
≈ Product MockupsTab tile** — dördü de aynı `cascadeLayoutFor`
çıktısından türer (rail thumb 184×88 ölçek + plate-context-siz
düz layout; stage/export `compositionGroup` + plate-fit ekler —
kategori 3 stage-specific, thumb'a girmez ama temel slot dizilim
+ rotation BİREBİR aynı kaynak). Yeni layout-related thumb/preview
yüzeyi eklenirken aynı kural: `cascade-layout.ts`'ten oku, ayrı
geometri kopyalama (sessiz drift YASAK §12).
(Phase 117 sonrası rail thumb tek render path = orta panelin AYNI
StageScene'i; detay → [`mockup-studio-rail-preview.md`](./mockup-studio-rail-preview.md).)

**Rail thumb GÖRSEL içeriği de Preview = Export Truth kapsamındadır
(Phase 116 canonical — scene-derived thumb genişletme):** Phase 115
thumb GEOMETRİSİNİ canonical kaynağa bağladı, ama thumb hâlâ generic
`MockupPh` device-frame dikdörtgenleri çiziyordu (gerçek device
shape YOK, gerçek asset image YOK) — geometri canonical'dı ama
**render-engine farkı** vardı (thumb generic `MockupPh` vs stage
real `StageDeviceSVG` + real `<image>`). Bu §11.0'ın "preview =
export = rail-thumb tek canonical kaynak" garantisini **görsel**
olarak ihlal ediyordu (yapısal dizilim aynı, görsel içerik kopuk —
Madde #12 drift). Phase 116 fix: `PresetThumbMockup` opsiyonel
`slots` prop alır; verildiğinde thumb **Stage'in AYNI
`StageDeviceSVG` component'i** + AYNI real `slot.design` (gerçek
MinIO `imageUrl`) ile render edilir (generic `MockupPh` YERİNE).
Shell `slots` (Stage'e geçen AYNI referans) → PresetRail → thumb.
Sonuç: rail thumb / stage / export ÜÇÜ DE aynı **gerçek asset
identity** + aynı `StageDeviceSVG` device shape + aynı scene
params'tan beslenir; **tek fark candidate layoutVariant geometri**.
Browser+code+export triangulation kanıtı (real asset): rail thumb
3 real `<image>` (`cmov06na50016`) ↔ stage slot real `<image>`
(aynı href, `sameAssetSource:true`) ↔ export payload 3 distinct
real itemId (Phase 113 slot-identity korundu) + Fan `r:[-13,0,13]`
BİREBİR. Yani Preview = Export = Rail-thumb artık **yalnız
geometry/asset-identity değil GÖRSEL içerik** seviyesinde de
holds. (Phase 117 sonrası bu tek render path StageScene ile
yapısal olarak garantilenir — ayrı renderer YOK.)

Canonical truth = **exported PNG**. Studio preview, exported PNG'nin
authoring önizlemesidir. Sharp pipeline (`frame-compositor.ts`)
preview'ın render sözleşmesini birebir izler (geometry + asset
identity + layered effects + shared canonical parameter).

**Studio ↔ Export plate render parity (Phase 113 canonical — unify
ilkesi):** Studio plate'i **CSS `<div>` zinciri** ile render eder
(`.k-studio__stage-plate` + `.k-studio__plate-glass` + scene/floor
katmanları); export plate'i **Sharp SVG composite** ile render eder
(`buildStageBackgroundSvg` + `buildPlateLayerSvg` +
`buildGlassOverlayPlateClippedSvg`). Bu iki teknoloji yapısal olarak
FARKLI; **aynı görsel sonucu üretmek zorundalar** ama otomatik
garanti YOK. Geçmişte (Phase 113 öncesi) bu yapısal fark sessiz
divergence'lar üretti:

- **Plate border + glass inset halkası**: Studio plate `border:
  2px solid transparent` + `box-sizing: border-box` taşıyordu;
  glass overlay `position:absolute; inset:0` → glass plate'in
  border'ının İÇİNE oturup çevrede 2px açık bg halkası ("tüm
  plate'i saran outline" rim) bırakıyordu. Export glass'ı plate
  ile birebir aynı koordinatta (`plateX/Y/W/H + plateRadius`)
  çiziyordu — halka YOK. Fix: Studio plate `border: none`
  (export'ta plate border zaten yok → Studio export'a hizalandı).
- **Box-shadow vs feDropShadow**: Studio CSS `box-shadow` negatif
  spread + dy offset ile gölgeyi üst kenardan geri çekiyordu;
  export `feDropShadow` blur >> offset ile her kenarı sarıyordu.
  Fix: Studio box-shadow export feDropShadow oran/davranışına
  hizalandı (negatif spread yok, blur >> offset).

Kalıcı kural: **plate/glass/effect render'ında Studio CSS ile
export Sharp SVG arasında görsel divergence kabul edilmez.** Yeni
bir plate/glass/effect değişikliği yapılırken HER İKİ taraf
(studio.css `.k-studio__stage-plate*` + frame-compositor.ts
`buildPlateLayerSvg`/`buildGlassOverlay*`) birlikte güncellenir
ve canlı browser + exported PNG **yan yana** doğrulanır. Studio'da
olup export'ta olmayan bir görsel katman (Studio-özel CSS
artifact: clip rim, border halka, box-shadow asimetrisi) bir
**parity bug**'dır; varsayım yapılmadan DOM pixel ölçümü +
exported PNG karşılaştırması ile kök neden bulunur, Studio
export'a hizalanır (export canonical truth — Etsy'ye giden
artifact odur). Studio-özel dekoratif katmanlar (dot-grid
`.k-studio__stage::before`, ambient scene tint, placement floor)
plate'in DIŞINDA kalır, plate kenarına / asset identity'sine
sızmaz; sızarsa export ile birebirleştirilir veya kaldırılır.

İleride bu yapısal farkı tamamen elemek için (uzun vadeli
sağlık): plate/glass/effect render'ı tek bir **paylaşılan
geometri/stil sözleşmesi** (plateRadius, fill, glass tint,
shadow params) üzerinden hem CSS hem SVG'ye türetilebilir
(Phase 114+ candidate — şimdi açılmadı; bugünkü ihtiyaç iki
tarafı manuel senkron + parity testi). Bu, capability map
(§7.6) gibi erken-abstraction tuzağına düşmeden, gerçek bir
parity bug tekrarladığında değerlendirilir.

### 11. Mockup vs Frame handoff (Phase 99 fulfilled, Phase 101 plate chrome, Phase 102 item chrome, Phase 103 tilt/rotation, Phase 104 white-edge, Phase 105-106 productType shape, Phase 107 phone bezel + Etsy continuity, Phase 108 plate-only Lens Blur + hoodie hood, Phase 109 responsive viewport + Lens Blur targeting + shared capability)

- **Phase 102 item chrome parity fulfilled — exported PNG'deki her
  mockup item'ı Studio preview item chrome'una yaklaştı.**
  Phase 101 plate chrome'unu (rounded + border + drop shadow + dark
  stage padding) compose etti ama **item-level chrome eksikti**: Sharp
  slot composite raw `fit:cover` resize yapıyordu; preview'da
  `.k-studio__slot-wrap` `filter: drop-shadow(0 16px 32px rgba(0,0,0,
  0.5)) drop-shadow(0 4px 10px rgba(0,0,0,0.35))` item shadow chain +
  ProductType-aware SVG shape rounded body + outline taşıyordu.
  Phase 102 fix'i (yalnız `frame-compositor.ts`, slot composite zinciri):
  - **Rounded mask**: her asset SVG `<clipPath>` rounded rect ile
    maskelenir (`itemRadius = clamp(6, min(slotW,slotH)×0.11, 40)`).
    Asset 1:1 raw image (operator MJ output) olsa bile item'ın kendi
    rounded chrome'u var.
  - **Drop-shadow chain**: her slot için ayrı SVG layer
    `<feDropShadow>` 2-katmanlı (preview `0 16px 32px rgba(.5)` +
    `0 4px 10px rgba(.35)` parity; output dims'e oranla scaled).
    Shadow padding (`shadowOffset1 + shadowBlur1`) ile slot tile
    asset'ten büyük; shadow item'ın dışına taşar.
  - **White outline ring**: asset üstüne `stroke="rgba(255,255,255,
    0.18)" stroke-width=clamp(1.5,minDim/100,4)"` (Shots.so item
    border parity).
  - Slot başına TEK Sharp composite (transparent canvas + shadow +
    rounded asset + outline) — performans için 3 slot × 3 layer
    yerine slot başına 1 chrome wrap.
- **Editing chrome vs final chrome split** (operator talimatı):
  - **Final visual chrome export'a girer**: rounded corner +
    drop-shadow chain + white outline (Shots.so download davranışı:
    studio'da görünen item chrome indirilen dosyada da var).
  - **Editing chrome export'a GİRMEZ**: slot-ring selection
    box-shadow (Phase 94 baseline — Frame mode'da `data-on` ama
    `box-shadow:none`), slot badge "01 Front View" (preview-only,
    `pointer-events:none`). Sharp pipeline bunları compose etmez —
    yalnız assigned slot asset + final chrome.
- **Canonical truth = exported PNG** (Phase 101 baseline sabit).
  Studio preview = exported PNG'nin authoring önizlemesi; operator
  için "studio'da gördüğüm ≈ indirdiğim PNG ≈ Product tile".
- **Phase 101 chrome parity fulfilled — Studio preview ↔ exported PNG ↔
  Product MockupsTab tile aynı görsel aileden gelir.**
  Phase 99'da Sharp pipeline plate chrome'unu compose etmiyordu (düz
  dikdörtgen bg + cascade). Phase 100 persistence + handoff'tan sonra
  Product MockupsTab tile aspect-square + object-cover ile 16:9 export'u
  merkezden kırpıyordu. İki katmanlı parity gap kullanıcı tarafından
  tespit edildi. Phase 101 fix'i:
  - **Sharp pipeline plate chrome'u compose eder**: stage dark padding
    (var(--ks-st) `#111009` parity) → plate rounded rect (26px CSS @ ref;
    output dims'e oranla scale) + 2px rgba(255,255,255,0.18) border +
    multi-layer drop shadow chain (SVG feDropShadow 3-katmanlı, preview
    4-katmanlı chain'in approximation'ı; libvips render desteği tam).
    Plate fill ratio %85 output dims (Studio CSS max-width/max-height
    85%/82% paritesi). Cascade plate-relative koordinatlara mapped
    (`cascadeOffsetX = plateX + (plateW - stageInnerW * scale) / 2`).
    (NOT: Phase 134'te Studio plate radius/shadow plate-genişliğine
    ORANSAL oldu — `plateRadiusForWidth`; export Sharp tarafı bu oran
    sözleşmesini izlemeli, sabit 26px DEĞİL. Detay
    [`mockup-studio-framing.md`](./mockup-studio-framing.md).)
  - **Glass overlay plate-clipped**: önceden full-canvas rect; Phase 101
    rounded rect yalnız plate alanında (preview backdrop-filter plate
    parent'a uygulanıyordu — stage padding clean kalır).
  - **MockupsTab tile aspect frame-export için preserve**: `kind ===
    "frame-export"` ise host `aspect-[4/3] bg-ink` + image `object-contain`
    (letterbox dark padding stage parity). Mockup-render entry'leri
    Phase 8 baseline (`aspect-square + object-cover`) ile aynı.
- Operator için sözleşme: **Studio'da gördüğüm + indirdiğim PNG + Product
  tile aynı görsel aile**. "Export edildi ama başka bir görsele dönüştü"
  hissi yok. Sözleşme #1 + #11 + #13.F birlikte fulfilled.
- **Canonical truth = exported PNG**. Sebepler:
  (a) FrameExport persistence + handoff + Etsy submit pipeline outputKey
  + signedUrl üzerinden çalışıyor → Etsy'ye giden gerçek artifact PNG'dir.
  (b) Studio preview operator authoring tool'u, canlı CSS hızlı feedback;
  Product tile gerçek export edilmiş görseli göstermeli (yeniden yorum
  zinciri kırar).
- **Phase 99 fulfilled — Frame mode export pipeline çekirdeği aktif.**
  Operator Frame mode'da Glass / Lens Blur / Solid / Gradient / aspect
  ayarlarıyla bir sahne kurar; toolbar Export · 1× · PNG capsule
  tıklayınca POST `/api/frame/export` çağrılır → Sharp pipeline
  aspect-aware canvas + plate bg + cascade real asset compose eder
  → MinIO'ya PNG yükler → signed download URL döner. Operator inline
  result banner'dan **Open** / **Download** ile çıktıyı kullanır.
  Stateless render (schema migration yok). Sözleşme #13.C fulfilled.
- Preview ↔ export aynı kaynak: Shell state (sceneOverride +
  frameAspect + slots + layoutCount + deviceKind + activePalette)
  client request body'sine serialize edilir; backend Sharp pipeline
  aynı parameter setiyle kompoze eder. **Divergence sıfır** (sözleşme
  #1 + #11 fulfilled).
- Frame controls'ün **gerçek output'a yansıması** Phase 99'da
  netleşti:
  - aspect ratio → output dims (1080×1080 / 1080×1350 / 1080×1920 /
    1920×1080 / 1500×2000)
  - sceneOverride.mode auto/solid/gradient/glass → plate background
    layer
  - Glass variant → variant-tinted overlay rect (subtle border +
    semi-transparent fill)
  - Lens Blur → Sharp `.blur(6)` cascade üzerine
  - Real asset → MinIO storageKey buffer fetch + Sharp resize +
    rotate + composite per slot pozisyonu
- Mockup mode render dispatch (Render button → S7/S8 result) ile
  **iki ayrı pipeline** korunur (sözleşme #1 baseline): Mockup pack
  pipeline mevcut Phase 8 baseline; Frame export Phase 99 ayrı çekirdek.
- **Portrait / Watermark / BG Effects** hâlâ honest disclosure
  preview-only (`data-wired="false"`); Phase 100+ candidate
  (sözleşme #13.D).
- **Result banner stale indicator**: operator export sonrası
  scene state değiştirirse banner "Preview changed · re-export?"
  caption + Re-export button gösterir (sözleşme #12 no silent magic
  uyumu — operator için "bu PNG güncel mi?" sinyali açık).
- **Persistence (FrameExport history) Phase 100 fulfilled** —
  her render `FrameExport` Prisma row'u yazar (id + userId + setId +
  storageKey + dims + sceneSnapshot + createdAt + deletedAt). Signed
  URL 5 dakika TTL geçici erişim; kalıcı kaynak `FrameExport.storageKey`.
  History `GET /api/frame/exports` (operator için son N export);
  signed URL refresh `GET /api/frame/exports/[id]/signed-url`.
- **Product handoff Phase 100 fulfilled** —
  POST `/api/listings/draft/[id]/add-frame-export` Frame export'u
  Listing.imageOrderJson'a `kind: "frame-export"` entry olarak
  ekler; opsiyonel `setAsCover: true` ile listing hero (Phase 9
  Listing baseline'a paralel pattern). Studio result banner'da
  "Send to Product" CTA + listing popover; Product detail
  MockupsTab'da yeni **"Frame Exports"** bucket (frame-export
  entry'leri ayrı section + kind chip). Etsy Draft submit pipeline
  (Phase 9) Frame export entry'lerini de aynı `outputKey` /
  `signedUrl` yoluyla aktarır — `kind` discriminator narrow ile
  Phase 100 backward-compat. Operator için "PNG indirip Product
  detail'a manuel upload" gereksinimi kalktı.

### 12. No silent magic

- Hiçbir operator-facing davranış sözleşmesiz değişmez. Slot click
  plate bg'sini değiştirmez (Phase 93 baseline); mode geçişi
  stage'i shrink etmez (Phase 95 baseline); aspect değişimi page
  scroll açmaz; layout count rail thumb sayısını değiştirmez.
- Bu sözleşmeye aykırı bir davranış görülürse: ya sözleşme + Phase
  entry'si açıkça güncellenir, ya da davranış düzeltilir. **Sessiz
  drift kabul edilmez.**

### 13. Future direction roadmap (design notes, not bugs)

> Güncel açık iş listesi + her modülün "hâlâ açık" maddeleri →
> [`known-issues-and-deferred.md`](./known-issues-and-deferred.md)
> (authoritative). Aşağıdaki A-F yön notları sözleşmenin parçası
> olarak burada kalır (implementasyon adayı; sözleşmeye eklenmeden
> implement YASAK — sessiz drift).

**Future direction A — Layout builder (drag/resize/tilt/manual
arrangement on stage)**:
- Operator stage'deki cascade item'larını **drag** ile yeniden
  konumlandırsın
- **Resize** handle ile her item'ın boyutunu ayarlasın
- **Tilt slider** ile rotation versin
- Mevcut hardcoded preset'lerden (Cascade / Centered / Tilted /
  Stacked / Fan / Offset) operator-driven serbest düzene geçiş
- **Hangi ürün aşamasında**: Frame mode export pipeline (Phase 99+)
  ve real Render dispatch'in tam olgunlaştığı an. Önce **export
  pipeline gerçekten çalışsın**, sonra operator manual arrangement
  ile preset'ten ayrılabilsin. Layout builder export'tan önce
  açılırsa "ben düzenledim ama çıktıya yansımıyor" hayal kırıklığı
  doğurur.

**Future direction B — Grid-like presentation for digital products
(clipart / bookmark / bundle showcase)**:
- 9-up sticker sheet, 4-up bookmark set, 12-clipart-bundle preview
  gibi **digital download listing hero**'ları için grid composition
- Template-level multi-slot (Phase 72-76) zaten **render pipeline**
  düzeyinde N-slot fanout çözüyor; eksik olan **stage-level grid
  preview** ve operator-driven N×M layout
- **Hangi ürün aşamasında**: Frame mode export + Mockup mode multi-
  template binding birleştikten sonra. Bundle Preview 9-up template
  zaten admin authoring tarafında mevcut (Phase 67-73); operator
  Studio'da bunu seçince stage'de **9-grid composition** preview
  + export edilebilmeli. Phase 97 self-critique'inde reddedilen
  "1..5×1..5 grid stage-level" değil — **template-level grid
  preview** (canonical multi-slot template'in stage'de görünür
  olması).

**Future direction C — Frame mode export pipeline (Phase 99 fulfilled)**:
- **STATUS: fulfilled (Phase 99)** — POST `/api/frame/export` +
  Sharp pipeline + MinIO upload + signed download URL.
- Operator Frame mode'da listing hero compose eder + Export · 1× ·
  PNG capsule gerçek MinIO PNG üretir (1920×1080 / 1080×1080 /
  1080×1920 / 1080×1350 / 1500×2000).
- aspect + plate bg + scene mode (auto/solid/gradient/glass) +
  glass variant + lens blur + real asset cascade hepsi output'a
  yansır. Preview ↔ export aynı state kaynağı (sözleşme #1 + #11).
- Persistence (FrameExport history + Product handoff) sözleşme #13.F
  altında roadmap'te.

**Future direction D — BG Effects (noise / grain / vignette)**:
- Phase 98'de görünür ama no-op (preview only). Glass / Lens Blur
  Phase 98'de aktif edildi; BG Effects (noise grain / paper texture
  / vignette overlay) `sceneOverride.bgEffect` field genişletmesi
  ile aynı pattern'le wire edilebilir
- **Hangi ürün aşamasında**: Phase 99+ minor polish. Glass/Blur
  baseline operator için yeterince zengin sahne kontrolü sunuyor;
  BG Effects ek seviyedir.

**Future direction E — Operator-uploaded BG image** (Background
"Image" / "Upload" tile):
- Frame BACKGROUND satırında Trans. / Color / Image / Upload tile'ları
  var; Color Phase 89 Solid swatch'larıyla wire'lı. Image + Upload
  Phase 100+ candidate — operator kendi background image'ini plate
  arka planına yerleştirebilir
- **Hangi ürün aşamasında**: Phase 100+. Asset upload pipeline
  (Phase 67 mockup template upload + Phase 30 asset-url endpoint)
  reuse edilebilir. Phase 99 export pipeline + bu birlikte gerçek
  değer üretir (operator kendi background + Frame composition export).

**Future direction F — Frame export → Product / Etsy Draft handoff
(Phase 100 fulfilled)**:
- **STATUS: fulfilled (Phase 100)** — FrameExport Prisma model +
  POST `/api/frame/export` persist + `Send to Product` CTA + Product
  detail "Frame Exports" bucket.
- Akış (canlı):
  - FrameExport row her render'da yazılır (id + userId + setId +
    storageKey + width/height + sizeBytes + frameAspect +
    sceneSnapshot + createdAt + deletedAt).
  - Studio result banner "Send to Product" CTA → listing draft
    popover → POST `/api/listings/draft/[id]/add-frame-export`
    (setAsCover default true) → Listing.imageOrderJson kind:
    "frame-export" entry eklenir.
  - Product detail MockupsTab "Frame Exports" bucket Phase 100
    yeni: frame-export entry'leri ayrı section + kind chip;
    operator için listing hero'nun nereden geldiği net.
  - Etsy Draft submit pipeline (Phase 9) Frame export entry'lerini
    de aynı outputKey / signedUrl yoluyla aktarır.
- **Phase 101+ extension candidate'lar**:
  - Studio history viewer (operator son N FrameExport'u tekrar
    bulup re-send edebilir) — Phase 100'de defer edildi (banner
    + handoff ana scope yeterli).
  - FrameExport delete / archive UI (deletedAt soft-delete
    şu an programatik; UI button Phase 101+).
  - "Create new listing from this Frame" — Frame export'tan yeni
    Listing draft auto-create (mevcut akış: önce Apply Mockups,
    sonra Frame export ekleme; Phase 101+ bypass akışı).
  - FrameExport cost telemetry + render time aggregation (admin
    cost usage dashboard).
