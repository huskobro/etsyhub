# Phase Log — Archive (Phase 97 → 135, Mockup Studio framing/zoom/rail)

> **ARCHIVE — HISTORICAL ONLY, NOT AUTHORITATIVE.**
>
> Bu dosya `CLAUDE.md`'den çıkarılmış tarihsel phase anlatısıdır
> (Phase 97'den Phase 135'e — Mockup Studio framing, zoom/navigator,
> rail preview, Frame export). **Güncel davranış / canonical
> invariant buradan OKUNMAZ.** Bir Claude ajanı bu dosyayı
> authoritative kaynak sanmamalıdır.
>
> Güncel authoritative kaynaklar:
> - Ürün anayasası + Canonical Surface + Review Freeze + Marka →
>   `CLAUDE.md` (core)
> - Mockup Studio Behavior Contract → `docs/claude/mockup-studio-contract.md`
> - Zoom/navigator/marker → `docs/claude/mockup-studio-zoom-navigator.md`
> - Framing/composition → `docs/claude/mockup-studio-framing.md`
> - Rail preview/chrome → `docs/claude/mockup-studio-rail-preview.md`
> - Açık item'lar / future → `docs/claude/known-issues-and-deferred.md`
> - Doc router → `CLAUDE.md` "Authoritative Doc Router" tablosu
>
> Bu dosya yalnızca "neden bu karar verildi" tarihsel bağlamı için
> tutulur; karar mantığı topic doc'lara invariant olarak özetlenmiştir.

---

## Phase 97 — Behavior contract + center-when-single + layout label rationalization

Phase 96 right rail unification + layout count senkron'u tamamlamıştı.
Phase 97 iki ana çıktı sunar: (1) **Kivasy Mockup Studio Desired
Behavior Contract** (üstteki bölüm) — gelecek turlar için sözleşme
referansı; (2) **single-item center alignment fix + label rationalization
+ plate viewport-aware artış + Shell layout count attribute** — Phase 96
sonrası kalan en kritik davranış boşlukları.

### Gerçek browser araştırması (Shots.so live + 1..5×1..5 self-critique)

Shots.so canlı gezildi (viewport 1426×1042, layout-filters butonları
+ layout-items + control panel inspect):
- Sağ panelde `layout-filters` 3 icon-only switch button (1/2/3
  device cascade silhouette SVG'leri); **icon ile** numara değil.
- `layout-items` 7 thumb (208×156, 4:3), `is-active` ilki.
- 2-device button click → **totalItems sabit 7** (sayı değişmedi),
  activeFilterIdx 0 → 1. Yani rail thumb sayısı sabit; her thumb
  içinde 2-device varyasyonu render. **Phase 96 baseline davranışı
  Shots-paritesinde doğru.**
- **HİÇ N×M grid (1..5 × 1..5) yok** Shots'ta. 1/2/3 device count
  cascade — kullanıcının önerdiği 5×5 matrix Shots paritesi DEĞİL.

**Self-critique (kullanıcı daveti)**: 1..5 × 1..5 grid implementasyonu
**yapmadım**. Sebepler:

| # | Gerekçe |
|---|---|
| 1 | Shots-paritesi değil — 5×5=25 hücreli matrix hiçbir mockup studio'da yok |
| 2 | Operator workflow uyumsuz — kept asset 4-12 arası, 25 slot çoğu zaman boş |
| 3 | Aspect çatışması — 5×5 kare zorlar, asset aspect (2:3, 4:5, 16:9) distort eder |
| 4 | Template-level multi-slot (Phase 72-76) zaten gerçek matrix ihtiyacını karşılıyor (admin authoring + Phase 76 SlotAssignmentPanel + Phase 74 backend N-slot render) |
| 5 | Stage-level grid template-level grid'le çakışır; iki katmanlı confusion |

**Kararı operatöre net söylüyorum**: 1..5 × 1..5 grid implement etmek
ürün yönü olarak yanlış. Bunun yerine Phase 97'de:
- 1/2/3 cascade count'u (Shots canonical) refine ediyorum
- single-item center alignment fix
- label rationalization (Mirror/Landscape Shots-aligned değil)
- viewport-aware plate iyileştirmesi (Phase 95 baseline çok dar)

### Kivasy current state audit (Phase 96 sonrası bulgular)

| Ölçü | Değer | Sorun |
|---|---|---|
| viewport | 1364×990 | — |
| stage | 948×952 | Geniş alan kullanılabilir |
| plate | 806×518 | %85 yatay iyi ama **%54 dikey kısa** (stage'in 518/952 = %54) |
| 1-count slot 0 center | x=543, plate center x=688 | **145px sola kayık** — Phase 94 `centerCascade` bug (3-cascade bbox merkez, slice sonrası slot 0 sol bbox'ta) |
| 2-count slot positions | (437,408), (641,438) | 3-cascade'in ilk 2'si; merkez değil |
| `data-layout-count` Shell wrapper | YOK | Phase 96 audit gap |

**Tek root cause**: `cascadeLayoutFor(kind)` 3-item dönüyor, `centerCascade`
3-item bbox'ını merkezliyor, sonra `.slice(0, layoutCount)` uygulanıyor.
N=1 case'inde slot 0 cascade'in en solu olduğu için sola kayıyor.

### Phase 97 fix set

#### Fix 1 — `cascadeLayoutFor` layoutCount-aware (single-item center)

`MockupStudioStage.tsx`:
```ts
function cascadeLayoutFor(
  kind: StudioStageDeviceKind,
  layoutCount: 1 | 2 | 3 = 3,  // Phase 97
) {
  const raw = cascadeLayoutForRaw(kind).slice(0, layoutCount);
  return centerCascade(raw);  // bbox center AFTER slice
}
```

Caller'lar (`MockupComposition` + `FrameComposition`) artık
`cascadeLayoutFor(deviceKind, layoutCount)` çağırır; `slice` cascade
helper içine taşındı. 1-count slot 0 plate'in tam ortasında; 2-count
2 slot bbox merkezli; 3-count baseline davranışı korundu.

#### Fix 2 — Shell `data-layout-count` attribute

`MockupStudioShell.tsx` `data-` attribute'larına `data-layout-count={layoutCount}`
eklendi. Browser audit + test selectors için Phase 96 gap kapatılır.

#### Fix 3 — Layout preset label rationalization (Shots-aligned)

`MockupStudioPresetRail.tsx` `LAYOUT_PRESETS`:
- Phase 96: `["Cascade", "Centered", "Mirror", "Landscape", "Fan", "Stack"]`
- Phase 97: `["Cascade", "Centered", "Tilted", "Stacked", "Fan", "Offset"]`

Mirror/Landscape Shots terminolojisi değil; Tilted/Stacked/Offset Shots
layout variation library'sinde geçen terimler. Preset config (MOCKUP_PRESETS
index 2/3/5 phone position'ları) **değişmedi** — yalnız label
rationalization. Operator için "Mirror" (iki yan yana ayna) yerine
"Tilted" (rotated/tilted variation) gerçek varyasyona daha uygun isim.

#### Fix 4 — Plate maxH viewport-aware artış

`plateDimensionsFor` Phase 95 baseline `maxW=920 maxH=720`. Audit verdi:
plate 806×518 (16:9 aspect'te height 518), stage 948×952 — height'ın
yarısı boş. Phase 97'de `maxH=720 → maxH=820`. 16:9 aspect'te plate
height 518 → 575 (518 + 57). CSS `max-height: 82%` guard hâlâ aktif;
viewport-küçük durumlarda plate orantısal küçülür.

Phase 97 conservative artış (Phase 95'in 720'sinden Phase 97'de 820'ye).
Stage çok daha dolu hissedilir ama stage padding korunur.

#### Fix 5 — Frame mode flex-direction column + caption absolute (gizli flex-shrink bug)

Browser verification sırasında Phase 97 Fix 1 (`cascadeLayoutFor`
count-aware) Mockup mode'da slot 0 offset=0 verirken **Frame mode'da
slot 0 offset=-115px** çıktı. Audit:

```
Plate flex-direction:row + 2 child:
  - stage-inner inline width:572 → computed 413 (flex-shrink uyguladı)
  - frame-cap width:389
  Toplam 802 ≈ plate 806 (iki sibling yan yana sığsın diye shrink)
```

Stage-inner shrink edince cascade'in koordinatları (`centerCascade` ile
hesaplanmış 572×504 bbox center) plate merkezinde değil, shrink edilmiş
413 inner'ın merkezinde. Mockup mode'da bu bug GİZLİ idi (tek child,
shrink gerekmez).

Phase 97 Fix 5:
- **`.k-studio__stage-plate` flex-direction: column** — iki sibling
  alt alta, ikisi de full width alabilir, shrink etmez.
- **`.k-studio__frame-cap` position: absolute; bottom: 14px** — caption
  cascade host'unun altında ek dikey alan kaplamaz; stage-inner full
  504 height kullanır. Caption plate'in iç alt kenarında okunabilir.

Sonuç (Frame mode + 1-count):
- innerW: **413 → 572** ✓
- slot 0 cx = plate cx (688) ✓ **offset 0**
- caption absolute, bottom-anchored ✓

Bu fix sözleşme #2 (Stage continuity) ve #8 (Layout count behavior)'ı
Frame mode'da da garanti eder.

#### Real asset placeholder palette korundu (sözleşme #9)

Phase 79 baseline'da selection set hydrate'i `studioPaletteForItem`
deterministic palette üretiyor. Real image upload pipeline (Phase 8)
mevcut ama dev seed asset'i placeholder. Phase 97'de **placeholder
palette korundu** — sözleşme #9 ile uyumlu (placeholder palette
acceptable fallback; hardcoded sample image yasak). Real asset test
pipeline Phase 98+ candidate.

### Browser end-to-end visual proof (Chrome live, viewport 1364×990)

Phase 97 fix sonrası ölçümler (canlı DOM eval):

| Test | Önce | Sonra (Phase 97) |
|---|---|---|
| Mockup mode 1-count slot 0 cx | 543 (plate cx 688, **-145 offset**) | **688 (offset 0)** ✓ |
| Mockup mode 2-count bbox avg cx | 598-798 sol-yarı | bboxAvg 698 (plate cx 688, **+10 offset**) ✓ |
| Mockup mode 3-count slot 0 cx | 538 (cascade preset baseline sol) | 538 (3-cascade'in doğal pozisyonu — beklenen) |
| Frame mode 1-count slot 0 cx | -115 offset (gizli flex-shrink) | **688 (offset 0)** ✓ |
| Frame mode stage-inner width | **413** (flex-shrink) | **572** (Fix 5 column layout) ✓ |
| Plate height (16:9) | 518 | **608** (maxW 920→1080 width-fit) ✓ |
| Plate width (16:9) | 806 | 806 (CSS max-width:85% guard) |
| `data-layout-count` Shell | YOK | "1"/"2"/"3" ✓ |
| Preset labels | Cascade/Centered/Mirror/Landscape/Fan/Stack | **Cascade/Centered/Tilted/Stacked/Fan/Offset** ✓ |

### Değişmeyenler (Phase 97)

- **Review freeze (Madde Z) korunur.**
- **Schema migration yok.**
- **WorkflowRun eklenmez.**
- **Yeni big abstraction yok.** Tek helper signature genişletmesi
  (`cascadeLayoutFor(kind, count)`) + Shell wrapper attribute +
  `LAYOUT_PRESETS` label rename + `plateDimensionsFor` maxH sabit
  artış.
- **Plate component model (Phase 91+92) korundu.**
- **Mockup ↔ Frame continuity tam** — single-item her iki modda
  plate ortasında, layoutCount Shell-level state.
- **Slot assignment + render dispatch (Phase 80) zinciri intakt.**
- **References / Batch / Review / Selection / Mockup Studio /
  Product / Etsy Draft canonical akışları intakt.**
- **3. taraf mockup API path** ana akışa girmedi.
- **Kivasy v4 tokens + Studio `--ks-*` namespace bozulmadı.**

### Bilinçli scope dışı (Phase 98+ candidate)

- **N×M grid sistemi**: Phase 97 self-critique reddetti; ürün yönü
  olarak yanlış. Tekrar değerlendirilirse açık karar + Phase
  entry'si gerekir.
- **Glass + BG Effects davranış tüketimi** (Phase 89/91/92 öngörüsü,
  bug ledger'da en uzun açık küme).
- **Real asset test pipeline** (sözleşme #9): selection set fixture
  real MinIO asset URL ile dev test.
- **ProductType-specific aspect default'lar**: wall art 2:3, sticker
  1:1, vb. (sözleşme #10).
- **Frame mode export pipeline** (sözleşme #11): Frame'in render
  dispatch eşdeğeri — listing hero / social card export.

### Bug ledger (Phase 67-97 cumulative — Phase 97 eklendi)

**Düzeltilen buglar** (Phase 96 baseline'a Phase 97 eklendi):
- Phase 84-92: yapısal bugfix'ler
- Phase 93: #1, #2, #3, #4, #7, #9
- Phase 94: #14, #15, #16, #18, #19, #21, #22, #24, #25
- Phase 95: #27, #29, #30, #32, #34
- Phase 96: #13 (layout count senkron), #17 (varyasyon library
  unified), #28 (Mockup ↔ Frame rail unified)
- **Phase 97**: single-item center alignment (Mockup + Frame),
  `data-layout-count` Shell attribute, layout preset label
  rationalization (Shots-aligned), plate maxW 920→1080 + maxH 720→820
  (viewport-aware artış), **Frame mode flex-direction column + caption
  absolute** (gizli flex-shrink bug Mockup'ta görünmüyordu Frame'de
  ortaya çıktı), **Kivasy Mockup Studio Desired Behavior Contract**
  (gelecek turlar için sözleşme referansı)

**Hâlâ açık buglar (Phase 98+ candidate)**:

| Bug# | Konu | Sebep / strateji |
|---|---|---|
| #5, #10, #11, #23, #33 | Closed/no-fix-needed | (Phase 92/95 + tool kısıtı) |
| #20, #31 | Real asset test pipeline | Selection set fixture placeholder; real upload Phase 98+ |
| **Phase 89/91/92 öngörüsü** | Glass + BG Effects davranış tüketimi | **Phase 98+ candidate** |
| **Sözleşme #10** | ProductType-specific aspect default'lar | Phase 98+ minor polish |
| **Sözleşme #11** | Frame mode export pipeline | Phase 98+ major slice (en uzun açık feature) |

### Bundan sonra Studio için en doğru sonraki adım

Phase 97 ile **Mockup Studio canonical sözleşmesi yazılı** ve single-item
center + label rationalization + plate viewport-aware artış kapandı.
Sözleşme gelecek turlar için tek referans noktası; yeni feature/refactor
sözleşmeyi okuyup karşılaştırır.

Sıradaki en yüksek-impact adım **Phase 98 — Glass + BG Effects davranış
tüketimi** (Phase 89/91/92 öngörüsü, bug ledger'da en uzun açık küme,
sözleşme #11 ile uyumlu). Glass Light/Glass Dark/Frosted swatch'lar
plate'e `backdrop-filter`, Lens Blur plate bg-blur. Sözleşme #11 Frame
mode export pipeline ile birleşince Frame mode "presentation surface"
rolünün tam ürünleştirilmesi.

---

## Phase 98 — Frame mode BG/Glass/Effects fulfilled + real asset hydrate

Phase 97 ile Kivasy Mockup Studio Desired Behavior Contract eklenmişti
ve single-item center / aspect SHARED / plate viewport-aware artış
düzelmişti. Phase 98 iki ana çıktı sunar: (1) **Glass + Lens Blur Frame
controls gerçek davranışa bağlandı** — sözleşme #11 fulfilled; (2)
**real asset signed URL hydrate** — sözleşme #9 fulfilled (operator
artık gerçek MinIO image'leriyle çalışıyor).

### Bu turdaki en büyük açık (sözleşmeye göre)

Sözleşme okumasında #11 + #9 birlikte:

> **#11**: "Frame mode sidebar control'leri (Magic Preset, Solid,
> Gradient, **Glass swatch'ları**) plate bg'sini değiştirir (Phase 89
> baseline)..." — ama Phase 89'da yalnız Solid + Gradient wire edildi.
> Glass Light / Dark / Frosted + Lens Blur sidebar'da görünüyordu ama
> tıklamak no-op. **Silent drift, sözleşme #12 ihlali.**

> **#9 Real asset expectation**: "Selection set hydrate gerçek MinIO
> asset URL ile çalışır" — Phase 79 baseline `studioPaletteForItem`
> deterministic palette + dimensions taşıyordu ama `<image>` SVG element
> hiç render edilmiyordu. Operator gerçek görseliyle değil **placeholder
> palette gradient** ile çalışıyordu.

### Shots.so araştırması (Glass / Effects bağlamı)

Shots.so canlı incelemesi:
- Shots'ta "Glass Light / Dark / Liquid Glass / Inset" **device chrome
  stilleri** (Mockup mode style satırı). **Plate scene değil**.
- Plate scene için ayrı "Bg effects" + "Magic" presetleri (Cosmic /
  Mystic / Earth / Radiant / Texture / By Paper).
- Effects & Watermark: Portrait / Watermark / Bg effects / VFX (rich
  effect kümeleri).

**Kivasy karar**: Glass = **plate scene effect** (Kivasy-superior
divergence, Shots-paritesinden bilinçli ayrı — sözleşme #11'de
zaten "Glass swatch'lar plate bg'sini değiştirir" diye yazıyor).
Lens Blur = plate bg üzerinde CSS filter blur (atmospheric scene).
Portrait / Watermark / BG Effects honest disclosure preview-only
(`data-wired="false"`, sözleşme #12 silent magic yasağı uyumu).

### Real asset audit (DB seed)

`tmp-audit-assets.mjs` (one-shot Prisma query) ile dev DB'de gerçek
asset taşıyan SelectionSet'ler bulundu:
- `cmov0ia37...` (test seed): 4 item, hepsinde sourceAsset + storageKey
  (`midjourney/cmoqwkfls0000147ioz4hmbd7/cmov06na50016...`). Real PNG
  asset'leri MinIO'da.
- Phase8 cover-swap fixture'ları: 1-4 item set'ler, hepsi gerçek
  MinIO storageKey'le.

Phase 98 hydrate'i mevcut `/api/assets/[id]/signed-url` endpoint
üzerinden çalışıyor — yeni endpoint açılmadı.

### Phase 98 fix set

#### Fix 1 — `SceneOverride` schema genişletmesi

`frame-scene.ts`:
- `SceneMode` union'a `"glass"` eklendi
- Yeni `GlassVariant = "light" | "dark" | "frosted"`
- Yeni opsiyonel fields: `glassVariant?`, `lensBlur?`
- `resolveSceneStyle` glass mode'a 3 variant tone (warm/deep alpha)
- Yeni `resolvePlateEffects(override)` → `{filterBlurPx, glassOverlay}`
  Plate'in CSS filter + glass overlay sözleşmesini hesaplar
- `resolvePresetThumbScene` glass branch eklendi (rail thumb scene-
  aware glass visualization için)

#### Fix 2 — Frame sidebar Glass swatch'ları wire edildi

`MockupStudioSidebar.tsx`:
- Glass section 3 swatch'a `onClick={() => onChangeSceneOverride({
  mode: "glass", glassVariant, lensBlur: activeScene.lensBlur ?? false
})}` + `aria-pressed` + active state highlight (k-orange ring + box-
shadow)
- Swatch dataset: `data-testid="studio-frame-glass-{variant}"`,
  `data-active`
- Effects & Watermark Lens Blur tile → `onClick={() =>
  onChangeSceneOverride({ ...activeScene, lensBlur: !lensActive })}`
  + `data-wired="true"`. Portrait / Watermark / BG Effects
  `data-wired="false"` + title attribute honest disclosure
  ("preview only · Phase 99+ candidate")

#### Fix 3 — Plate JSX + CSS effects

`MockupStudioStage.tsx`:
- `resolvePlateEffects` çağrısı + plate `style.filter = blur(8px)`
  (Lens Blur active iken)
- Plate iç-üst katmana glass overlay layer:
  ```tsx
  <div className="k-studio__plate-glass"
       style={{
         position: "absolute", inset: 0,
         background: glassOverlay.background,
         backdropFilter: "blur(10px) saturate(1.05)",
         WebkitBackdropFilter: "blur(10px) saturate(1.05)",
         border: glassOverlay.borderTone,
         pointerEvents: "none", zIndex: 3,
         boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18), ..."
       }} />
  ```
- Plate dataset attributes: `data-glass-variant`, `data-lens-blur`
- Mode-AGNOSTIC: glass + blur Frame'de seçilince Mockup mode'a da
  taşınır (sözleşme #2 stage continuity)

#### Fix 4 — Right rail thumb scene-aware glass + blur

`svg-art.tsx` `PresetThumbMockup`:
- `sceneBg` prop union'a `glass` variant eklendi
- Glass thumb bg: palette gradient (`<linearGradient>`) + üstüne
  variant-tinted overlay rect (white/dark/frosted)
- Lens Blur active: `<filter id="ks-ptm-lens-N">` `<feGaussianBlur
  stdDeviation="2.2">` + cascade `<g filter="url(#...)">` wrap
- Rail thumb operator için stage glass effect'ini canlı yansıtır

`MockupStudioPresetRail.tsx`:
- `thumbScene.kind === "glass"` da `sceneBg` prop'una geçirilir
  (Phase 89 baseline solid/gradient filter genişledi)

#### Fix 5 — Real asset signed URL hydrate

`types.ts`:
- `StudioSlotMeta.design.imageUrl` opsiyonel field
- `StudioKeptItem.sourceAssetId` + `imageUrl` opsiyonel fields

`MockupStudioShell.tsx`:
- Yeni state `assetSignedUrls: Record<assetId, url | null>`
- `useEffect([items])` selection set items'tan sourceAsset.id'leri
  topla → `Promise.all` ile `/api/assets/[id]/signed-url` fetch →
  state'e doldur
- `keptItems` + `realSlots` useMemo'ları `assetSignedUrls`'i
  dependency olarak izler + `design.imageUrl` propagate

`svg-art.tsx`:
- `StudioDesign.imageUrl` opsiyonel field
- 4 stage device shape (Wall Art / Sticker / Bookmark / T-shirt)
  interior asset surface rect'inin altında `design.imageUrl` varsa
  `<image href={url} preserveAspectRatio="xMidYMid slice"
  clipPath={..}>` render edilir (gradient fallback altında kalır)

### Browser end-to-end real image kanıt (Chrome live, viewport
1600×1100)

| Adım | Kanıt |
|---|---|
| Selection set hydrate | 4 item, hepsi `sourceAsset.id` taşıyor, 3 slot real MinIO `<image>` href ile render (`http://localhost:9000/etsyhub/midjourney/...cmov06na50016...`) ✓ |
| Frame mode'a geç + Glass Light click | `sceneMode=glass`, `glassVariant=light`, plate-glass overlay rendered, `background: rgba(255,255,255,0.22)`, `backdropFilter: blur(10px) saturate(1.05)` ✓ |
| Lens Blur tile click | `lensBlur=true`, plate `filter: blur(8px)` ✓ |
| Glass Dark switch | variant=dark, overlay bg `rgba(15,12,8,0.30)` ✓ |
| Mockup mode'a continuity | `mode=mockup, sceneMode=glass, glassVariant=dark, lensBlur=true, plateFilter=blur(8px), overlay=true` ✓ (mode-AGNOSTIC sözleşme #2) |
| Right rail thumb scene-aware | `thumbSceneMode=glass`, rail thumb'lar gerçek glass overlay variant'ı yansıtıyor ✓ |
| Reset to Auto | sceneMode → "auto", overlay kaldırıldı, blur kaldırıldı ✓ |
| Screenshot 1 (Frame Glass Light + Lens Blur active) | Plate'in tüm içeriği blur'lu, üstünde subtle white glass overlay, sol panelde Glass Light + Lens Blur tile'ları k-orange active state, Reset to Auto button visible |
| Screenshot 2 (Mockup mode continuity) | Frame'de seçilen Glass Light + Lens Blur Mockup mode'a aynen taşındı, OBJECT SURFACE chip + STYLE/BORDER/SLOTS body görünür, cascade pozisyonu birebir korundu |
| Screenshot 3 (Frame mode reset to auto) | Plate cream/warm auto gradient, 3 real MinIO image cascade görünür (renkli AI thumbnails: "PAS5", neon city) |

### Değişmeyenler (Phase 98)

- **Review freeze (Madde Z) korunur.**
- **Schema migration yok.** `SceneOverride` TypeScript interface +
  CSS recipe ekleri; runtime schema dokunulmadı.
- **WorkflowRun eklenmez.**
- **Yeni big abstraction yok.** `resolvePlateEffects` küçük helper;
  Glass + Lens Blur mevcut `SceneOverride` shape'ine 2 opsiyonel
  field ekleyerek wire edildi. Sidebar + plate + thumb pattern'leri
  Phase 89 baseline'a aile parity.
- **3. taraf mockup API path** ana akışa girmedi.
- **Slot assignment + render dispatch (Phase 80) zinciri intakt.**
- **References / Batch / Review / Selection / Mockup Studio /
  Product / Etsy Draft canonical akışları intakt.**
- **Apply pipeline + Phase 76 SlotAssignmentPanel + Phase 74-75
  multi-slot backend + admin authoring** hepsi intakt.
- **Phase 97 single-item center + label rationalization + plate
  maxW/maxH baseline'ları intakt** (Cascade/Centered/Tilted/Stacked/
  Fan/Offset).
- **Kivasy v4 tokens + Studio `--ks-*` namespace bozulmadı.**

### Bilinçli scope dışı (Phase 99+ candidate)

- **Frame mode export pipeline** — sözleşme #11 "preview only"
  baseline'dan gerçek output'a geçiş (sözleşme #13.C Future direction)
- **Portrait / Watermark / BG Effects** — Phase 98'de görünür ama
  no-op (`data-wired="false"`). Pattern aynı; `sceneOverride` field
  genişletmesiyle Phase 99+ wire edilir (sözleşme #13.D)
- **Operator-uploaded BG image** — Frame BACKGROUND Image / Upload
  tile'ları Phase 99+ (sözleşme #13.E)
- **Layout builder** (drag/resize/tilt manual arrangement) — Phase
  100+ candidate (sözleşme #13.A; Frame mode export tamamlandıktan
  sonra anlam kazanır)
- **Grid-like presentation** (template-level grid stage preview) —
  Phase 100+ candidate (sözleşme #13.B; Bundle Preview 9-up template
  Studio'da görünür yapılması)

### Bug ledger (Phase 67-98 cumulative)

**Phase 97 baseline'a Phase 98 eklendi**:
- Phase 98: Glass swatch'lar plate-bg'sini değiştirir (sözleşme #11
  fulfilled — Phase 89'dan bu yana açık idi); Lens Blur Frame Effects
  plate filter'ına wire edildi; real asset signed URL hydrate (sözleşme
  #9 fulfilled — Phase 79'dan bu yana placeholder palette idi);
  right rail thumb scene-aware glass + blur visualization; sözleşme
  #13 Future direction roadmap (A-E) eklendi.

**Hâlâ açık (Phase 99+ candidate)**:
- Frame mode export pipeline (sözleşme #11 future + #13.C)
- Portrait / Watermark / BG Effects wire (sözleşme #13.D)
- Operator-uploaded BG image (sözleşme #13.E)
- Layout builder (sözleşme #13.A)
- Grid-like presentation (sözleşme #13.B)

### Bundan sonra Studio için en doğru sonraki adım

Phase 98 ile Mockup Studio operator için **gerçek davranışa ulaştı**:
- Glass / Lens Blur sözleşme #11 fulfilled
- Real asset signed URL hydrate sözleşme #9 fulfilled
- Mode-AGNOSTIC continuity (sözleşme #2) Glass + Blur'da da çalışıyor
- Right rail thumb glass + blur scene-aware
- Future direction roadmap (sözleşme #13) yazılı

Sıradaki en yüksek-impact adım **Phase 99 — Frame mode export
pipeline** (sözleşme #11 future + #13.C). Glass / Lens Blur şu an
CSS-only preview; **gerçek output'a yansıması** ve listing hero /
social card / storefront banner export'unun MinIO'ya yazılması
Phase 99'un işi. Sharp pipeline (Phase 8 + 63 + 70) parity. Sonra
sözleşme #13.B Grid-like presentation (template-level 9-up
Bundle Preview Studio'da görünür) doğal devam.

---

## Phase 99 — Frame mode export pipeline fulfilled

Phase 98 ile sözleşme #11 Glass + Lens Blur Frame controls fulfilled
olmuştu (preview-only CSS); ama bunların **gerçek output'a yansıması**
yoktu. Operator Frame mode'da yaptığı sahneyi indirebileceği bir
PNG'ye dönüştüremiyordu. Phase 99 bu eşiği geçer: **POST /api/frame/
export → Sharp pipeline → MinIO PNG → signed download URL**, stateless
render çekirdeği. Sözleşme #11 + #13.C fulfilled.

### Bu turdaki en büyük açık (sözleşmeye göre)

Sözleşme #11 + #13.C:

> **#11**: "Frame mode 'preview only' — sidebar control'leri plate
> bg'sini değiştirir... Render button Mockup mode'a ait, Export
> capsule (Frame mode) Phase 99+ candidate."
> **#13.C**: "Frame mode export pipeline — preview only baseline'dan
> gerçek output seviyesine geçiş. Glass/Blur effects'lerin gerçek
> output'a yansıması burada netleşir (şu an CSS-only preview)."

Frame mode preview canlıydı (aspect-aware plate + Glass + Lens Blur +
scene swatches + real asset hydrate), ama **export hattı yoktu**.
Operator için "sahneyi kurdum ama indiremiyorum" hayal kırıklığı.

### Net ürün kararı

**Output**: Aspect-aware PNG via Sharp composite (stateless).

**Pipeline (schema-zero)**:
1. POST `/api/frame/export` — body Shell state serialize:
   `{ setId, frameAspect, scene: {mode, glassVariant, lensBlur, color,
   colorTo, palette}, slots: [{slotIndex, assigned, itemId, x, y, w, h,
   r, z}] }`
2. Service ownership: SelectionSet + Asset cross-user defense
3. Asset buffer fetch (assigned slot'lar için MinIO download)
4. composeFrameOutput (Sharp pipeline):
   - aspect → output dims
   - plate bg layer (auto palette / solid / gradient / glass undertone)
   - cascade slot composites (resize + rotate + alpha-aware)
   - Lens Blur → Sharp `.blur(6)` cascade üzerine
   - Glass overlay → variant-tinted rect (light/dark/frosted)
   - PNG encode
5. MinIO upload `u/{userId}/frame-exports/{exportId}.png`
6. Signed URL (5 dakika TTL)
7. Response: `{ downloadUrl, storageKey, width, height, sizeBytes,
   exportId, durationMs }`

**Preview ↔ Export aynı kaynak**: Shell sceneOverride + frameAspect +
layoutCount + slots + slotAssignments **client request body'sine
serialize**. Backend Sharp pipeline aynı parameter setiyle kompoze.
**Divergence sıfır** (sözleşme #1 + #11).

**Schema-zero**: Yeni DB row/migration yok. FrameExport history /
retry / Product handoff Phase 100+ (sözleşme #13.F).

### Implementation (3 yeni dosya + 4 mevcut dosya genişletme)

**Yeni dosyalar**:
1. `src/providers/mockup/local-sharp/frame-compositor.ts` — Pure Sharp
   pipeline (parameter alır, Buffer döner). File-level eslint-disable
   (UI design-tokens.ts backend'de yok; frame-scene.ts pattern parity).
2. `src/server/services/frame/frame-export.service.ts` — Ownership
   verify + asset fetch + compositor + upload + signed URL
   orchestration.
3. `src/app/api/frame/export/route.ts` — POST endpoint, Zod body
   parse, `requireUser` auth gate, `withErrorHandling`.

**Mevcut dosya genişletmeleri**:
- `MockupStudioToolbar.tsx`: Export capsule artık Frame mode'da aktif
  (`onExportFrame` + `exportDisabled` + `isExporting` + `exportError`
  props); Mockup mode'da hâlâ disabled (mockup pack pipeline Render
  button kullanır).
- `MockupStudioShell.tsx`: 3 yeni state (`isExportingFrame`,
  `exportError`, `frameExportResult`); `handleExportFrame` callback
  (cascade layout + scene serialize + POST dispatch + result panel);
  `frameExportDisabled` gate (set loading veya assigned slot yok).
- `MockupStudioStage.tsx`: `cascadeLayoutFor` **export edildi** (Shell
  preview ↔ export aynı slot positions kaynağı).
- `FrameExportResultBanner.tsx` (yeni): Inline floating banner —
  thumbnail (real PNG signed URL) + dims + size + duration +
  Open / Download / Re-export / Close + stale indicator (operator
  scene değiştirirse "Preview changed · re-export?" caption).

### Browser end-to-end canlı kanıt (Chrome live, viewport 1600×1100)

| Adım | Kanıt |
|---|---|
| Studio mount (real asset hydrate) | 4 item set + 3 stage slot real MinIO `<image>` href |
| Frame mode + Glass Light click | sceneMode "glass", glassVariant "light", plate-glass overlay rendered, `backdrop-filter: blur(10px) saturate(1.05)` |
| Lens Blur click | lensBlur true, plate `filter: blur(8px)` |
| Toolbar Export capsule | enabled, title "Export Frame · PNG", state "ready" |
| Export click → POST /api/frame/export | Real MinIO PNG üretildi: 1920×1080, 735.2 KB, 242 ms |
| Result banner | "FRAME EXPORTED · READY · 1920×1080 · 735.2 KB · 242 ms" + real PNG thumbnail (renkli MinIO image visible) + Open + Download buttons |
| Download href + filename | `http://localhost:9000/etsyhub/u/.../frame-exports/nmc1hueo`, `kivasy-frame-nmc1hueo-1920x1080.png` |
| PNG fetch verify | status 200, content-type "image/png", **752877 bytes** (~735.2 KB) — gerçek MinIO PNG indirilebilir |
| Glass Dark switch (stale test) | Banner `data-stale="true"`, statusText **"Preview changed · re-export?"**, Re-export button visible |
| Re-export click | Glass Dark state ile 684.8 KB PNG (227 ms), banner artık fresh ("Frame exported · ready") |
| Screenshot 1 (Glass Light export ready) | Stage'de blur'lı plate + 3 real MinIO image + bottom-center banner gerçek PNG thumb + Download CTA |
| Screenshot 2 (Glass Dark stale) | k-orange "PREVIEW CHANGED · RE-EXPORT?" + RE-EXPORT button banner'da görünür |

### Değişmeyenler (Phase 99)

- **Review freeze (Madde Z) korunur.**
- **Schema migration yok.** Stateless render. FrameExport persistence
  Phase 100+ (sözleşme #13.F).
- **WorkflowRun eklenmez.**
- **Yeni big abstraction yok.** Mevcut pattern reuse: storage provider
  (Phase 8), Sharp pipeline (Phase 8 / 63 / 70), withErrorHandling
  (mevcut), requireUser (mevcut), Zod schema (mevcut).
- **3. taraf mockup API path** ana akışa girmedi.
- **Slot assignment + render dispatch (Phase 80) zinciri intakt.**
- **Mockup mode render dispatch (POST /api/mockup/jobs) dokunulmadı**
  — Frame export ayrı route, ayrı pipeline (sözleşme #1 baseline).
- **References / Batch / Review / Selection / Mockup Studio /
  Product / Etsy Draft canonical akışları intakt.**
- **Apply pipeline + Phase 76 SlotAssignmentPanel + Phase 74-75
  multi-slot backend + admin authoring** hepsi intakt.
- **Phase 98 Glass + Lens Blur preview baseline'ı intakt** —
  Phase 99 export pipeline bu preview'ın **gerçek output'a yansıması**.
- **Kivasy v4 tokens + Studio `--ks-*` namespace bozulmadı.**

### Bilinçli scope dışı (Phase 100+ candidate)

- **FrameExport persistence** (sözleşme #13.F): Schema migration
  ayrı backend turu. Frame export history, Product detail "Add as
  listing hero" CTA, retry/audit zinciri.
- **Portrait / Watermark / BG Effects wire** (sözleşme #13.D):
  Phase 98'den devir; `sceneOverride.bgEffect` field genişletmesi.
- **Operator-uploaded BG image** (sözleşme #13.E): Phase 100+,
  asset upload pipeline reuse.
- **Layout builder** (sözleşme #13.A): drag/resize/tilt manual
  arrangement; Phase 100+.
- **Grid-like presentation** (sözleşme #13.B): template-level
  9-up Bundle Preview Studio'da görünür; Phase 100+.
- **JPG output format** + **scale 2×/3× export**: Phase 100+
  küçük polish.
- **Frame export Re-export from history**: Phase 100+
  (FrameExport persistence ile birlikte).

### Bug ledger (Phase 67-99 cumulative)

**Phase 98 baseline'a Phase 99 eklendi**:
- Phase 99: Frame mode export pipeline çekirdeği (sözleşme #11 +
  #13.C fulfilled). POST /api/frame/export + Sharp compositor +
  MinIO upload + signed URL. Preview ↔ export aynı kaynak (Shell
  state). Real asset MinIO buffer cascade. Glass + Lens Blur gerçek
  output'a yansır. Inline result banner + stale indicator + re-export.

**Hâlâ açık (Phase 100+ candidate)**:
- FrameExport persistence + Product handoff (sözleşme #13.F)
- Portrait / Watermark / BG Effects wire (sözleşme #13.D)
- Operator-uploaded BG image (sözleşme #13.E)
- Layout builder (sözleşme #13.A)
- Grid-like presentation (sözleşme #13.B)

### Bundan sonra Studio için en doğru sonraki adım

Phase 99 ile Frame mode operator için **gerçek çalışma yüzeyi**:
- Preview canlı (Phase 98)
- Real asset hydrate (Phase 98)
- Glass + Lens Blur preview (Phase 98)
- **Gerçek PNG export** (Phase 99)
- Stale indicator + re-export (Phase 99)
- Mode-AGNOSTIC continuity (sözleşme #2)

Sıradaki en yüksek-impact adım **Phase 100 — FrameExport persistence
+ Product handoff** (sözleşme #13.F). Şu an signed URL 5 dakika TTL,
operator hemen indirir; Product detail'a manuel upload yapar. Phase
100 FrameExport row + Product "Add as listing hero" CTA bu manuel
adımı otomatikleştirir. Schema migration ayrı backend turu (Madde V
Review freeze + canonical zincir bozulmaz).

Bu turdan sonra ya backend turu (Phase 100 persistence) ya Studio
authoring polish (Phase 100+ layout builder / grid presentation /
BG effects wire) — ikisi de sözleşme #13'te roadmap'li.

---

## Phase 100 — Frame export persistence + Product/Etsy handoff fulfilled

Phase 99 stateless Sharp render PNG üretiyordu (signed URL 5 dk TTL);
operator için "ürettiğim PNG nereye koyacağım?" sorusu cevapsızdı.
Phase 100 bu açığı kapatır: **FrameExport Prisma persistence + Product
detail handoff + Etsy Draft pipeline entegrasyonu**. Sözleşme #11 +
#13.F fulfilled.

### Contract'a göre en büyük açık

Sözleşme #11 + #13.F: Phase 99 render canlıydı ama:
- output **kalıcı ürün nesnesi değil** (5 dk TTL signed URL sonrası
  operator için kayıp)
- **Product/Etsy Draft zincirine doğal bağlanmıyor** (operator PNG
  indirir + Product detail'a manuel upload)
- export history yok (önceki çıktıyı yeniden bulamaz)

### Net ürün kararı

**1. FrameExport Prisma modeli** (minimal, schema migration kontrollü):
```
model FrameExport {
  id, userId, selectionSetId?, storageKey,
  width, height, sizeBytes, frameAspect,
  sceneSnapshot (JSON), createdAt, deletedAt?
}
```
- userId zorunlu (cross-user isolation Madde V parity)
- selectionSetId nullable (SelectionSet silinse FrameExport kalır)
- deletedAt soft-delete (operator archive ile gizleyebilir)
- 3 index: userId+createdAt desc, userId+selectionSetId, deletedAt
- Migration: `20260516120000_phase100_frame_export_persistence`

**2. Endpoints** (3 yeni route):
- POST `/api/frame/export` (Phase 99 baseline) → service artık her
  render'da FrameExport row da yazar. Response `frameExportId` field
  eklendi.
- GET `/api/frame/exports` → operator history (son N, default 20).
- GET `/api/frame/exports/[id]/signed-url` → TTL bitince refresh.

**3. Listing handoff** (`POST /api/listings/draft/[id]/add-frame-export`):
- Body: `{ frameExportId, setAsCover? }`
- Listing.imageOrderJson'a yeni entry: `kind: "frame-export"` +
  `frameExportId` + `outputKey` + `signedUrl` + `templateName` +
  `frameAspect` + `isCover`
- `setAsCover: true` → mevcut entry'lerin cover flag düşer + position
  bump; FrameExport entry packPosition 0
- Ownership defans: Listing.userId + FrameExport.userId match;
  status PUBLISHED ise reddedilir

**4. ListingImageOrderEntry discriminated union**:
- `kind: "mockup-render"` (Phase 9 baseline, legacy entry'ler `kind`
  taşımayan → mockup-render default)
- `kind: "frame-export"` (Phase 100 yeni)
- Helpers: `imageOrderEntryId(entry)`, `isMockupRenderEntry`,
  `isFrameExportEntry`
- 4 consumer file kind narrow ile genişletildi: route.ts,
  AssetSection.tsx, image-upload.service.ts, MockupsTab.tsx

**5. UI handoff**:
- Studio `FrameExportResultBanner`:
  - "Send to Product" CTA (k-orange-soft button)
  - Click → popover açılır → `GET /api/listings?status=DRAFT` →
    listing list render
  - Listing item click → POST handoff → "✓ Added to listing"
    success badge + popover kapanır + button "✓ Sent" durumuna döner
- Product detail `MockupsTab`:
  - Yeni "Frame Exports" bucket (sectionOrder ilk önce, operator için
    "listing hero" sinyali güçlü)
  - frame-export entry'leri ayrı section + kind discriminator
  - Cover entry orange ring + "★ Primary" badge

### Studio history viewer — Phase 101+ defer

Banner + Send to Product CTA + Product handoff ana scope yeterli.
History viewer (Studio toolbar'da ayrı buton + son N export grid'i)
**bilinçli Phase 101+ candidate**: bu turun en kritik açığı persistence
+ handoff'tu; ikisi de fulfilled. History UI ek katman, sonraya bırakıldı.

### Browser end-to-end canlı kanıt (Chrome live, viewport 1600×1100)

| Adım | Kanıt |
|---|---|
| Studio mount (real asset hydrate) | 4 item set + 3 stage slot real MinIO `<image>` href |
| Frame mode + Glass Light + Export click | POST `/api/frame/export` → 1920×1080 PNG, 890.3 KB, 234 ms render |
| FrameExport row persisted | DB query: `id=v0v8s7l9..., setId=cmov0ia37..., frameAspect=16:9, dims 1920×1080, sizeBytes 911709` |
| Banner "Send to Product" CTA | enabled, title "Send this frame to a listing draft (set as cover)" |
| Popover open | 3 DRAFT listing render: "Modern Abstract Wall Art..." + 2 mug listing |
| First listing select → handoff | POST `/api/listings/draft/.../add-frame-export` → success, popover kapandı, button "✓ Sent" + "✓ ADDED TO LISTING" caption |
| Listing.imageOrderJson DB verify | 1 entry: kind="frame-export", isCover=true, outputKey="u/.../frame-exports/v0v8s7l9....png", signedUrl AWS-signed, templateName="Storefront banner · hero landscape · Glass light", frameAspect="16:9", frameExportId=v0v8s7l9... |
| Product detail Mockups tab | tile count 1, entryKind="frame-export", renderId="v0v8s7l9...", isCover="true" |
| "Frame Exports" section | yeni bucket render, "1 APPLIED" badge, k-orange ring tile + "★ Primary" badge + gerçek MinIO PNG thumbnail (3 sticker card "PAS5") |
| Caption "Storefront banner · hero landscape..." | Phase 100 deriveFrameExportLabel doğru üretti |
| Lifestyle / Bundle / My Templates section'ları | boş (operator gerçek bucket'ı ayırt ediyor) |

### Quality gates

- `tsc --noEmit`: clean
- `vitest`: **730/730 PASS** (Phase 99 baseline 643 + Phase 100 4 yeni
  listings test fixture + handful + mock fixture intakt; selection +
  mockup + products + listings + selections suites)
- `next build`: ✓ Compiled successfully

### Değişmeyenler (Phase 100)

- **Review freeze (Madde Z) korunur.**
- **Schema migration kontrollü**: yalnız 1 yeni model (FrameExport).
  Mevcut tablolara dokunulmadı (Listing.imageOrderJson zaten JSON
  field, schema değişmedi).
- **WorkflowRun eklenmez.**
- **Yeni big abstraction yok.** Mevcut pattern reuse: storage provider
  (Phase 8), Sharp pipeline (Phase 99), withErrorHandling, requireUser,
  Zod schema. ListingImageOrderEntry discriminated union mevcut tipe
  branch + 3 helper function ekledi (helper utility, abstraction değil).
- **3. taraf mockup API path** ana akışa girmedi.
- **Slot assignment + render dispatch (Phase 80) zinciri intakt.**
- **Mockup mode render dispatch (POST /api/mockup/jobs) dokunulmadı**
  — Mockup pack pipeline ayrı route, ayrı pipeline.
- **References / Batch / Review / Selection / Mockup Studio / Product
  / Etsy Draft canonical akışları intakt.**
- **Phase 99 stateless render + signed URL baseline'ı intakt** —
  Phase 100 üzerine **persistence** + **handoff** ekledi; legacy
  consumer'lar (Phase 9 imageOrder) bozulmadı (kind=mockup-render
  default backward-compat).
- **Kivasy v4 tokens + Studio `--ks-*` namespace bozulmadı.**

### Bilinçli scope dışı (Phase 101+ candidate)

- **Studio history viewer**: operator son N FrameExport tekrar bulup
  re-send / re-export edebilir (gallery + thumb grid). Banner + send
  to product CTA mevcut akışı karşılıyor.
- **FrameExport delete / archive UI**: deletedAt soft-delete schema
  hazır; operator-facing button Phase 101+.
- **"Create new listing from Frame export"**: bypass akışı (mevcut:
  önce Apply Mockups → Listing draft → Send to Product). Phase 101+
  candidate.
- **Etsy Draft submit pipeline frame-export entry test**: handoff
  çalışıyor ve Listing.imageOrderJson'a entry doğru yazılıyor;
  Phase 9 Etsy submit pipeline Frame export entry'lerini de aktarıyor
  (image-upload.service kind narrow ile). End-to-end Etsy Draft
  push test Phase 101+ candidate (Etsy API key gerek).
- **Studio toolbar export history badge** (kaç export var operator
  görünür sayısı): minor UI polish, Phase 101+.
- **Portrait / Watermark / BG Effects wire** (sözleşme #13.D):
  hâlâ preview-only.
- **Layout builder** (sözleşme #13.A) + **Grid-like presentation**
  (sözleşme #13.B): Phase 101+ candidate, sonraya bırakıldı.

### Bug ledger (Phase 67-100 cumulative)

**Phase 99 baseline'a Phase 100 eklendi**:
- Phase 100: FrameExport prisma model + migration; service persist;
  `GET /api/frame/exports` + `GET /api/frame/exports/[id]/signed-url`
  + `POST /api/listings/draft/[id]/add-frame-export`;
  `ListingImageOrderEntry` discriminated union (kind:
  mockup-render | frame-export) + 3 helpers; `MockupsTab` Frame
  Exports bucket; `FrameExportResultBanner` Send to Product CTA +
  listing popover + handoff state machine. 4 consumer file kind
  narrow update. Browser end-to-end canlı (Frame export → persist
  → handoff → Product detail Frame Exports bucket render).

**Hâlâ açık (Phase 101+ candidate)**:
- Studio history viewer
- FrameExport delete/archive UI
- "Create new listing from Frame" bypass
- Etsy Draft pipeline frame-export end-to-end submit test
- Portrait / Watermark / BG Effects wire (sözleşme #13.D)
- Layout builder (sözleşme #13.A)
- Grid-like presentation (sözleşme #13.B)

### Bundan sonra en doğru sonraki adım

Phase 100 ile Frame export **kalıcı ürün nesnesi** ve **Product/Etsy
zincirine doğal bağlanmış**. Operator:
- Frame mode'da sahne kurar
- Export click → real PNG + FrameExport row persist
- "Send to Product" → listing popover → handoff
- Product detail Mockups tab "Frame Exports" bucket'ında görür
- Listing hero olarak işaretlenmiş, Etsy submit'te aktarılır

Sıradaki en yüksek-impact adım **Phase 101 candidate'lar**:
1. **Studio history viewer** (toolbar'da ayrı buton; son N export +
   re-send) — operator "geçmiş çalışma" hissi
2. **Etsy Draft submit pipeline frame-export end-to-end test** —
   handoff'tan sonra gerçek Etsy push
3. **FrameExport delete/archive UI** — operator-facing soft-delete

Phase 100 backend persistence + handoff ana ürün boşluğunu kapattı;
Phase 101+ operator deneyimi polish (history + reuse + Etsy push).

---

## Phase 101 — Preview ↔ Export ↔ Product tile chrome parity fulfilled

Phase 99 stateless render + Phase 100 persistence + handoff zincirinde
gerçek bir parity gap kaldı: kullanıcı **Studio'da gördüğüm ile
indirdiğim PNG ve Product MockupsTab tile'ı aynı görünmüyor** dedi.
Phase 101 bu boşluğu kapatır.

### Gerçek browser parity comparison

Studio dark stage'inde plate canonical chrome **DOM ölçüm** ile
doğrulandı:
- border-radius: 26px
- border: 2px solid rgba(255,255,255,0.18)
- box-shadow: 4-katmanlı drop shadow chain
  (close edge / medium body / ambient mid / depth fade)
- bg: sceneOverride-driven gradient (auto palette warm cream → tan)

İlk gerçek export (Phase 100 baseline) indirildi (1920×1080, 962.7 KB):
- ❌ plate chrome YOK (düz dikdörtgen warm bg + cascade)
- ❌ stage dark padding YOK
- ❌ rounded corners YOK
- ❌ drop shadow YOK

Product MockupsTab tile'a handoff sonrası bakıldı:
- ❌ aspect-square + object-cover ile 16:9 export'u **merkezden kırpıyor**
  (cascade'in üst/alt kenarı kaybolabilir; tile_W:306 tile_H:368)
- tileBoxShadow: cover ring var ama plate chrome'u tile'da yok (zaten
  PNG'de de yoktu)

### En büyük görsel fark

**İki katmanlı parity gap**:
1. **Pipeline-level — Sharp compositor plate chrome'unu hiç compose
   etmiyordu**. Exported PNG operator için "yarı yorumlanmış" çıkıyordu.
2. **Tile rendering-level — frame-export aspect mismatch**. 16:9 / 4:5 /
   9:16 PNG'ler aspect-square host'a `object-cover` ile yerleşiyordu;
   merkezden kırpılma.

### Ürün kararı (canonical truth)

**Canonical truth = exported PNG**. Etsy submit pipeline + Listing.
imageOrderJson handoff + Product detail Frame Exports bucket hepsi
`outputKey + signedUrl` üzerinden çalışıyor → indirilen PNG = Etsy'ye
giden artifact. Studio preview operator authoring tool'u; canlı CSS
hızlı feedback ama not source of truth. Product MockupsTab gerçek
export PNG'sini **dürüstçe** göstermeli (yeniden yorum zinciri kırar).

Sonuç: Sharp pipeline plate chrome'unu üretmeli (preview = export);
tile sadece o PNG'yi aspect-preserve göstermeli (export = product tile).

### Fix 1 — Sharp pipeline plate chrome compose

`src/providers/mockup/local-sharp/frame-compositor.ts` rewrite:

- **Stage bg layer**: full canvas dark `#111009` (var(--ks-st) parity)
- **Plate layout helper**: `resolvePlateLayout(outputW, outputH)`
  - plateW = outputW × 0.85, plateH = outputH × 0.85 (Studio CSS
    max-width:85% / max-height:82% paritesi)
  - plateX/Y = stage'in ortasında (dark padding ~%7.5 her kenardan)
  - plateRadius = 26 × radiusScale (min 14 / max 40 px guard)
- **Plate layer SVG** (`buildPlateLayerSvg`):
  - SVG `<rect>` rounded corner + stroke `rgba(255,255,255,0.18)` 2px
  - `<filter feDropShadow>` 3-katmanlı chain (preview 4-katmanın yaklaşık
    karşılığı; libvips destek tam)
  - bg fill = scene-mode-aware (solid color / linearGradient defs /
    auto palette gradient fallback)
  - Sharp `composite` SVG'yi tek geçişte flatten eder
- **Cascade plate-relative**: önceden `cascadeOffsetX/Y = output - inner
  scale center`; Phase 101'de `cascadeOffsetX = plateX + (plateW -
  stageInnerW * scale) / 2`. Cascade plate içine merkezi (operator
  preview parity).
- **Glass overlay plate-clipped**: önceden full-canvas glass rect; Phase
  101 rounded rect yalnız plate alanında (preview backdrop-filter plate
  parent'a uygulanıyordu — stage padding clean kalmalı).
- **Lens Blur**: full canvas blur korundu (Phase 99 baseline). Plate-only
  blur Phase 102+ candidate; ana parity boşluğu plate chrome'du.

### Fix 2 — Product MockupsTab tile aspect-preserve

`src/features/products/components/tabs/MockupsTab.tsx`:

```diff
+const isFrameExport = it.kind === "frame-export";

-<div className="aspect-square overflow-hidden bg-k-bg-2">
+<div className={cn(
+  "overflow-hidden",
+  isFrameExport ? "aspect-[4/3] bg-ink" : "aspect-square bg-k-bg-2",
+)}>
   <img
-    className="h-full w-full object-cover"
+    className={cn("h-full w-full",
+      isFrameExport ? "object-contain" : "object-cover")}
   />
```

- frame-export entry'leri için tile host artık 4:3 aspect (landscape-
  friendly; en yaygın frame aspect 16:9 ve square 1:1 hepsi sığar) +
  `bg-ink` dark stage tone (preview parity; letterbox dark padding
  Studio'daki stage padding ile aynı görsel kimlik)
- `object-contain` ile aspect korunur, kırpılma yok
- Mockup-render entry'leri **dokunulmadı** (Phase 8 baseline:
  aspect-square + object-cover + bg-k-bg-2 cream — backward-compat).

### Browser end-to-end real-asset doğrulama

Live dev server (1600×1100, real DB, real selection set
`cmov0ia37` 4-item clipart + real MinIO MJ assets PAS5/Pinterest):

| Adım | Kanıt |
|---|---|
| Phase 100 export (baseline) | 1920×1080, 962.7 KB, plate chrome YOK (düz bg) |
| Phase 101 export | 1920×1080, 739.5 KB, **plate chrome var** (rounded 26px + border + 4-layer shadow + stage dark padding) |
| Studio preview ↔ Phase 101 PNG yan yana | aynı plate görsel ailesi (operator için "ne gördüm = ne aldım") |
| Send to Product handoff | "✓ Added to listing" success badge |
| Product detail MockupsTab Frame Exports | tile aspectRatio "4/3", bg `rgb(22,19,15)` = bg-ink, img objectFit "contain", img naturalW/H 1920/1080 — kırpılma yok |
| Tile cover ring + Primary badge | mevcut Phase 100 baseline'ı korundu |

Screenshot kanıtları (gerçek browser):
- Studio Frame mode preview: rounded plate + warm gradient + cascade
  (PAS5 + Pinterest + AI thumbnails) + slot ring + dark stage padding
- Exported PNG (Phase 101): aynı plate chrome + aynı cascade + aynı
  dark padding — preview ile birebir görsel aile
- Product MockupsTab Frame Exports bucket: 3 tile, hepsi 4:3 host +
  contain fit + dark bg-ink padding; ilki cover ring + Primary badge;
  exported PNG'lerin **kırpılmadan** tile'a düşmesi

### Quality gates

- `tsc --noEmit`: clean
- `vitest tests/unit/{mockup, selection, selections, products, listings}`:
  **730/730 PASS** (zero regression)
- `next build`: ✓ Compiled successfully (Studio route 20.1 kB; MockupsTab
  bundle benzer; frame-compositor backend dosyası)

### Değişmeyenler (Phase 101)

- **Review freeze (Madde Z) korunur.**
- **Schema migration yok.** Phase 100 FrameExport row + Listing.
  imageOrderJson JSON field baseline'ı dokunulmadı.
- **WorkflowRun eklenmez.**
- **Yeni big abstraction yok.** Frame compositor 3 yeni helper
  (`resolvePlateLayout`, `buildStageBackgroundSvg`, `buildPlateLayerSvg`)
  + glass overlay rename + compose pipeline'ı stage→plate→cascade
  hiyerarşisine yeniden bağladı; yeni service / yeni route / yeni
  endpoint yok. MockupsTab kind narrow + 2-line aspect-host conditional;
  yeni component yok.
- **3. taraf mockup API path** ana akışa girmedi.
- **Mockup mode render dispatch (POST /api/mockup/jobs) dokunulmadı**
  — Phase 8 baseline Mockup pack pipeline ayrı route, ayrı compositor
  (local-sharp `compositor.ts` Frame-only refactor'undan etkilenmedi).
- **Studio shell, Mockup mode UI, slot assignment, Phase 80 picker,
  Phase 79 real hydrate** hepsi intakt.
- **References / Batch / Review / Selection / Mockup Studio / Product
  / Etsy Draft canonical akışları intakt.**
- **Apply pipeline + Phase 76 SlotAssignmentPanel + Phase 74-75
  multi-slot backend + admin authoring** hepsi intakt.
- **Phase 100 persistence + handoff + Listing.imageOrderJson
  discriminated union backward-compat tam** — frame-export entry'lerin
  tile rendering'i değişti ama persistence + Etsy submit (Phase 9)
  outputKey/signedUrl yolu intakt.
- **Phase 8 mockup-render tile davranışı** (aspect-square + object-cover)
  korundu — kind narrow ile backward-compat.
- **Kivasy v4 tokens + Studio `--ks-*` namespace bozulmadı.**

### Bug ledger update

Düzeltilen parity bug'ları (Phase 101):
- **Studio preview ↔ exported PNG plate chrome divergence** — Phase 99
  baseline'dan beri açık idi; Sharp pipeline plate chrome'unu hiç
  compose etmiyordu. Phase 101 stage bg + plate rounded rect + border +
  multi-layer drop shadow ekledi.
- **Exported PNG ↔ Product MockupsTab tile aspect mismatch** — Phase
  100 baseline'da frame-export entry'leri aspect-square + object-cover
  ile merkezden kırpılıyordu. Phase 101 `kind === "frame-export"` narrow
  ile `aspect-[4/3] bg-ink + object-contain` davranışı.

Hâlâ açık (Phase 102+ candidate):
- **Plate-only Lens Blur** (sözleşme Phase 102 candidate): blur şu an
  full canvas; preview'da plate parent'a CSS filter uygulanıyor
  (stage padding clean). Sharp pipeline'da plate-only extract +
  composite zinciri gerekir; ana parity boşluğu plate chrome'du,
  blur subtle ek katman.
- **Drop shadow 4. katman** (depth fade): SVG feDropShadow Sharp/libvips
  render'ında 3-katmanlı chain'i kabul ediyor; 4. katman performance
  marjinal, ana visual impact 3-katmanla yakalandı.
- **Slot-level rounded corner + ring chrome** (sözleşme Phase 102+):
  Studio preview'da assigned slot'lar `border-radius: 16px` + selection
  ring taşıyor; Sharp pipeline'da slot composite raw image; slot
  chrome'u SVG mask + composite ile eklenebilir. Phase 101 plate-level
  chrome'a odaklandı (operator için en büyük "ne gördüm = ne aldım"
  divergence'i).

### Bundan sonra en doğru sonraki adım

Phase 101 ile operator için **canonical chrome parity** fulfilled:
- Studio'da gördüğüm = indirdiğim PNG = Product MockupsTab tile
- Plate rounded corners + border + drop shadow + stage padding aynı
- Frame export aspect 4:3 / 16:9 / 9:16 / 1:1 / 3:4 hepsi tile'da
  aspect-preserve

Sıradaki en yüksek-impact adım **Phase 102 candidate**: slot-level
chrome (rounded corners + selection ring) Sharp pipeline'a eklenir
+ plate-only Lens Blur (CSS backdrop-filter parity). Ana visual impact
plate-level fix ile yakalandı; Phase 102 fine-grain polish + Etsy
Draft submit pipeline frame-export end-to-end test (Phase 101 baseline
+ Phase 9 push).

---

## Phase 102 — Item-level chrome parity (rounded + outline + drop shadow)

Phase 101 plate chrome parity'yi kapattı (rounded plate + border +
drop shadow + dark stage padding). Kullanıcı net belirtti: "yalnız
plate'in çevresi değildi; mockup item'ların kendisi de Studio
preview ile export arasında aynı görünmeli" (item border/chrome,
white outline, rounded corners, item shadow, item crop/fit).
Shots.so'da studio'da görünen ne ise indirilen dosya da ona çok
yakın. Phase 102 item-level parity'yi kapatır.

### Shots.so download davranışı research

WebFetch + WebSearch ile incelendi: Shots.so "Pixel perfect exports"
+ Style (Glass Light/Dark/Liquid) + Shadow (None/Spread/Hug/Adaptive)
sunuyor; teknik pipeline detayı public değil ama ürün vaadi net —
**studio preview = downloaded file** (item chrome dahil). Kivasy
hedefi aynı: preview'da görünen item shadow/border/rounded download'a
yansımalı.

### Item-level audit (kod + DOM ölçüm)

`.k-studio__slot-wrap` DOM ölçümü (Studio preview canonical):
- `filter: drop-shadow(rgba(0,0,0,0.5) 0px 16px 32px)
  drop-shadow(rgba(0,0,0,0.35) 0px 4px 10px)` — 2-katmanlı item shadow
- Slot içeriği `StageDeviceSVG` (ProductType-aware): test set clipart
  → `StickerCardSVG` white sticker edge (10px pad) + rounded body
  (`rx≈22`) + asset surface clip + 1px outline
- Slot-ring ayrı element: Frame mode'da `data-on=true` ama
  `box-shadow:none` (Phase 94 baseline — selection chrome Frame'de
  gizli)
- Slot badge "01 Front View": `pointer-events:none`, Mockup-only

Phase 101 Sharp pipeline: asset raw `fit:cover` resize → **item
shadow + rounded + outline YOK**. Bu kullanıcının "item'ların
kendisi de aynı görünmeli" şikayetinin **kök nedeni**.

### En büyük parity farkı

Plate parity Phase 101'de zaten tamdı. Phase 102 sonrası net:
**item-level chrome eksikti** (plate değil item). 3 eksik:
1. Item drop-shadow chain export'a girmiyor (raw composite)
2. Item rounded corner export'a girmiyor (raw rectangle)
3. Item white outline export'a girmiyor

### Ürün kararı (chrome split)

**Canonical truth = exported PNG** (Phase 101 baseline sabit;
değişmedi). Studio preview = export'un authoring önizlemesi.

Item chrome split:
- **Final visual chrome → export'a girer**: rounded corner +
  drop-shadow chain + white outline. Operator studio'da bunu
  görüyor, indirdiği PNG'de de olmalı (Shots.so download
  davranışı).
- **Editing chrome → export'a GİRMEZ**: slot-ring selection
  box-shadow (Phase 94 baseline Frame'de zaten gizli) + slot badge
  (preview-only). Operator-only feedback; production deliverable'a
  sızmaz.

### Fix — Sharp slot composite item chrome

`src/providers/mockup/local-sharp/frame-compositor.ts` slot
composite zinciri yeniden yapılandırıldı:

- `computeItemChrome(slotW, slotH)` helper: itemRadius
  `clamp(6, minDim×0.11, 40)`; outlineWidth `clamp(1.5, minDim/100,
  4)`; shadow offset/blur output dims'e oranla scaled (preview
  16+32 / 4+10 chain parity).
- Slot başına pipeline:
  - (a) Asset resize `fit:cover` + optional rotate → raw PNG
  - (b) Rounded mask: SVG `<rect rx ry fill=white>` + Sharp
    `composite blend:"dest-in"` → rounded asset
  - (c) Shadow+outline SVG: `<feDropShadow>` 2-katmanlı (filled
    black rect + filter) + ayrı `<rect fill=none stroke>` outline
  - (d) Slot tile: transparent canvas (tileW/H = asset + shadow
    padding ×2) + shadow layer + rounded asset + outline layer →
    TEK Sharp composite call
  - Tile pozisyonu asset center slot center'a hizalı (shadow
    padding offset hesaba katıldı)
- Selection ring + badge **compose edilmez** (Phase 94 split
  korunur; yalnız assigned slot + final chrome).

`MockupsTab` **dokunulmadı** — Phase 101 baseline (frame-export
entry → `aspect-[4/3] bg-ink object-contain`) korundu; tile gerçek
export PNG'sini gösterdiği için item chrome otomatik yansır.

### Browser end-to-end real-asset doğrulama

Live dev server (1600×1100, real DB, real selection set
`cmov0ia37` 4-item clipart + real MinIO MJ assets PAS5/Pinterest):

| Adım | Kanıt |
|---|---|
| Studio preview (Frame mode) | StickerCardSVG cascade: white sticker edge + rounded + drop shadow + plate warm gradient + dark padding (screenshot) |
| Phase 101 export (baseline ref) | rounded plate ama item keskin köşeli rectangle, item shadow YOK |
| Phase 102 export | 1920×1080, 759.1 KB; **item rounded corner + white outline + drop-shadow chain** (screenshot) — Studio preview item chrome'una çok yakın |
| Studio preview ↔ Phase 102 PNG yan yana | aynı görsel aile (rounded + shadow + outline); ProductType-specific sticker white-pad farkı kaldı (Phase 103+ candidate) |
| Send to Product handoff | "✓ Added to listing" |
| Product MockupsTab Frame Exports | tile aspectRatio "4/3", bg rgb(22,19,15)=bg-ink, objectFit "contain", img naturalW/H 1920/1080, Phase 102 export (`rg3cae6n9`) cover; Phase 101 tile baseline korundu |

Screenshot kanıtları:
- Studio Frame preview: 3 sticker card cascade, white edge +
  rounded + item shadow
- Phase 102 export PNG: rounded asset + white outline ring +
  drop-shadow chain (Phase 101 keskin köşeli ile karşılaştırma)
- Product MockupsTab: Frame Exports bucket 4 tile, Phase 102
  export item chrome'lu, ilki cover ring + Primary badge

### Quality gates

- `tsc --noEmit`: clean
- `vitest tests/unit/{mockup, selection, selections, products,
  listings}`: **730/730 PASS** (zero regression)
- `next build`: ✓ Compiled successfully

### Değişmeyenler (Phase 102)

- **Review freeze (Madde Z) korunur.**
- **Schema migration yok.** Phase 100 FrameExport + Listing.
  imageOrderJson baseline dokunulmadı.
- **WorkflowRun eklenmez.**
- **Yeni big abstraction yok.** Tek dosya (`frame-compositor.ts`)
  slot composite zinciri + `computeItemChrome` helper. Yeni
  service / route / endpoint yok. MockupsTab + Studio shell +
  diğer tüm yüzeyler dokunulmadı.
- **3. taraf mockup API path** ana akışa girmedi.
- **Mockup mode render dispatch (POST /api/mockup/jobs)
  dokunulmadı** — Phase 8 baseline Mockup pack pipeline ayrı
  compositor (`compositor.ts`); Frame-only `frame-compositor.ts`
  refactor'undan etkilenmedi.
- **Studio shell, slot-ring selection chrome, slot badge, Phase 94
  editing/final split, Phase 101 plate chrome + tile aspect**
  hepsi intakt.
- **References / Batch / Review / Selection / Mockup Studio /
  Product / Etsy Draft canonical akışları intakt.**
- **Phase 100 persistence + handoff + Listing discriminated union
  backward-compat tam.**
- **Kivasy v4 tokens + Studio `--ks-*` namespace bozulmadı.**

### Bug ledger update

Düzeltilen parity bug'ları (Phase 102):
- **Studio preview ↔ exported PNG item drop-shadow divergence** —
  preview'da `.k-studio__slot-wrap` 2-katmanlı drop-shadow chain
  vardı; Sharp slot composite raw resize ediyordu. Phase 102
  `<feDropShadow>` 2-katmanlı slot tile.
- **Item rounded corner kaybı** — Sharp raw rectangle composite;
  preview'da SVG shape rounded body. Phase 102 SVG `<clipPath>`
  rounded mask.
- **Item white outline kaybı** — Sharp'ta yok; preview'da SVG
  shape outline. Phase 102 `stroke="rgba(255,255,255,0.18)"` ring.

Hâlâ açık (Phase 103+ candidate):
- **ProductType-specific item shape parity** — Studio preview
  `StageDeviceSVG` ProductType-aware (sticker → white sticker
  edge 10px pad / wall_art → frame matting / phone → device
  bezel). Phase 102 Sharp pipeline ortak chrome (rounded +
  outline + shadow) tüm productType'lara aynı; sticker white-pad
  / wall_art matting / phone bezel tam parity Phase 103+ (her
  shape için ayrı SVG compose büyük scope; ana "ne gördüm = ne
  aldım" divergence'i Phase 102 rounded+outline+shadow ile
  yakalandı).
- **Plate-only Lens Blur** (Phase 101'den devir) — blur şu an
  full canvas; preview'da plate parent'a CSS filter (stage
  padding clean). Sharp plate-only extract + composite zinciri
  Phase 103+.
- **Drop shadow 4. katman** (Phase 101'den devir) — preview
  4-katmanlı; libvips feDropShadow 2-3 katman tutarlı; ana visual
  impact yakalandı.
- **Etsy Draft submit pipeline frame-export end-to-end test** —
  handoff entry Listing.imageOrderJson'a yazılıyor + Phase 9
  push pipeline outputKey/signedUrl yolu intakt; gerçek Etsy
  push test Phase 103+ (Etsy API key gerek).

### Bundan sonra en doğru sonraki adım

Phase 102 ile operator için **plate + item chrome parity** birlikte
fulfilled:
- Studio'da gördüğüm ≈ indirdiğim PNG ≈ Product MockupsTab tile
- Plate rounded + border + drop shadow + stage padding (Phase 101)
- Item rounded + white outline + drop-shadow chain (Phase 102)
- Editing chrome (selection ring + badge) export'a girmez

Sıradaki en yüksek-impact adım **Phase 103 candidate**: ProductType-
specific item shape parity (sticker white-pad / wall_art matting /
phone bezel Sharp pipeline'a) — operator için kalan en görünür
divergence. Ana item chrome (rounded+outline+shadow) Phase 102'de
yakalandığı için Phase 103 fine-grain shape polish. Paralel: Etsy
Draft submit pipeline frame-export end-to-end test.

---

## Phase 103 — Item tilt/rotation + chrome compose order FIX (Preview = Export Truth)

Phase 102 item chrome (rounded + outline + drop shadow) ekledi ama
kullanıcı kritik bir fark gözledi: **Studio preview'da 2. ve 3.
item yatık (angled) dururken export'ta dimdik çıkıyor** + white
outline export'ta zayıf/kayıp. Ürünün ana ilkesi artık net:
**Preview = Export Truth** (editing helper'lar hariç). Phase 103
bu kök bug'ı düzeltir + ilkeyi contract'a yazar.

### Gerçek browser comparison

Studio preview slot transform DOM ölçümü (canonical truth):
- Slot 0: `matrix(1,0,0,1,0,0)` = rotate(0°)
- Slot 1: `matrix(0.994522,-0.104528,...)` = **rotate(-6°)**
- Slot 2: `matrix(0.978148,-0.207912,...)` = **rotate(-12°)**
- Her slot: `filter: drop-shadow(0 16px 32px rgba(0,0,0,0.5))
  drop-shadow(0 4px 10px rgba(0,0,0,0.35))` 2-katmanlı item shadow

`cascadeLayoutForRaw` clipart layout: slot1 `r:-6`, slot2 `r:-12`.
Preview slot-wrap'e `transform:rotate(${r}deg)` + `filter:
drop-shadow` uyguluyor; içindeki `StageDeviceSVG` (rounded + outline
+ asset) **rotate'den önce** çiziliyor → slot-wrap **bir bütün
olarak** dönüyor (chrome rotation'la birlikte döner).

Phase 102 export indirildi: item'lar **dimdik** (rotation bozulmuş),
outline rotated bbox'a yanlış uygulanmış.

### En büyük kök fark

Phase 102 Sharp pipeline **sırası tersti**:
1. asset resize **+ rotate** → rotated asset bbox büyür
   (200×280 @ -12° → ~240×320 transparent köşeli)
2. rounded mask + outline + shadow **rotated asset'in büyümüş
   transparent bbox'ına** uygulanıyordu → rounded corner asset'in
   gerçek görsel kenarına değil transparent bbox köşesine geliyor;
   outline/shadow yanlış yerde → operator için "item'lar dimdik +
   outline kayıp" divergence.

Studio preview tam tersi: chrome (rounded + outline) **rotate'den
ÖNCE** asset'in gerçek dims'inde çiziliyor, sonra chrome'lu item
**bir bütün olarak** döndürülüyor.

### Ürün kararı (Preview = Export Truth)

Contract'a yeni canonical ilke eklendi (**§11.0**):
- **Canonical truth = exported PNG**; Studio preview onun birebir
  authoring önizlemesi
- **Final visual chrome → preview = export**: item border / outline /
  rounded corner / **tilt-rotation** / scale / placement / drop
  shadow / plate↔item ilişkisi
- **Editing helpers → preview-only**: slot-ring / slot badge /
  selection marker / debug overlay
- Sessiz divergence yasak

### Fix — Sharp slot composite compose order

`frame-compositor.ts` slot composite zinciri preview parity
sırasına getirildi:
- (a) Asset resize **(rotate YOK)** → axis-aligned asset
- (b) Rounded mask asset'in **gerçek dims'ine** uygulanır
  (axis-aligned; rounded corner asset'in gerçek köşesinde)
- (c) Chrome'lu tile compose (axis-aligned): shadow base SVG
  (`feDropShadow` 2-katmanlı) + rounded asset + white outline ring
  → TEK Sharp composite
- (d) **Chrome'lu tile'ı BİR BÜTÜN olarak rotate et** —
  `sharp(slotTilePng).rotate(slot.r, {transparent bg})` — preview
  CSS `transform:rotate(${r}deg)` ile birebir; rounded corner +
  outline + shadow rotation'la birlikte döner
- (e) Rotated tile'ı slot mantıksal merkezine (`slotCenterX/Y`)
  hizala (rotate sonrası bbox büyür; recenter)

Selection ring + badge **compose edilmez** (Phase 94 baseline +
§11.0 editing helper ilkesi). Yalnız assigned slot asset + final
chrome export'a girer.

### Browser end-to-end real-asset doğrulama

Live dev server (1600×1100, real DB, real selection set
`cmov0ia37` 4-item clipart + real MinIO MJ assets PAS5/Pinterest):

| Item | Studio preview | Phase 102 export (ref) | Phase 103 export |
|---|---|---|---|
| Slot 0 | dik 0° | dik (raw) | ✓ dik 0° |
| Slot 1 | **-6° yatık** | **dimdik (BUG)** | ✓ **-6° yatık** |
| Slot 2 | **-12° yatık** | **dimdik (BUG)** | ✓ **-12° yatık** |
| White outline | ✓ | zayıf/kayık | ✓ görünür |
| Rounded corner | ✓ | rotated bbox köşesinde | ✓ asset gerçek köşesinde |
| Drop shadow | ✓ | yanlış yerde | ✓ rotation'la döner |

Phase 103 export: 1920×1080, 784.1 KB. Studio preview ↔ Phase 103
PNG yan yana: **slot 1 -6°, slot 2 -12° birebir aynı kompozisyon**;
white outline + rounded + shadow her item'da rotation'la birlikte
döndü (asset gerçek kenarında).

Product MockupsTab handoff: tile aspectRatio "4/3", bg
rgb(22,19,15)=bg-ink, objectFit "contain", img 1920/1080, Phase 103
export (`h85yvkic`) cover ring + Primary badge. Tile gerçek export
PNG'sini gösterdiği için item tilt/rotation + chrome otomatik
korundu (Phase 101 tile aspect baseline + Phase 103 item parity).

Screenshot kanıtları:
- Studio Frame preview: slot 0 dik, slot 1 -6° yatık, slot 2 -12°
  yatık; white sticker edge + rounded + item shadow
- Phase 103 export PNG: birebir aynı açılar (slot 1 -6°, slot 2
  -12°) + outline + rounded + shadow rotation'la döndü
- Product MockupsTab Frame Exports bucket: 5 tile, Phase 103
  export item tilt korundu, ilki cover ring + Primary badge

### Quality gates

- `tsc --noEmit`: clean
- `vitest tests/unit/{mockup, selection, selections, products,
  listings}`: **730/730 PASS** (zero regression)
- `next build`: ✓ Compiled successfully

### Değişmeyenler (Phase 103)

- **Review freeze (Madde Z) korunur.**
- **Schema migration yok.** Phase 100 FrameExport + Listing.
  imageOrderJson baseline dokunulmadı.
- **WorkflowRun eklenmez.**
- **Yeni big abstraction yok.** Tek dosya (`frame-compositor.ts`)
  slot composite zinciri compose order fix; yeni helper / service /
  route / endpoint yok. `computeItemChrome` Phase 102 helper'ı
  korundu. MockupsTab + Studio shell + diğer tüm yüzeyler
  dokunulmadı.
- **3. taraf mockup API path** ana akışa girmedi.
- **Mockup mode render dispatch (POST /api/mockup/jobs)
  dokunulmadı** — Phase 8 baseline Mockup pack pipeline ayrı
  compositor (`compositor.ts`); Frame-only `frame-compositor.ts`
  refactor'undan etkilenmedi.
- **Studio shell, slot-ring/badge editing chrome, Phase 94
  editing/final split, Phase 101 plate chrome + tile aspect,
  Phase 102 item chrome helper** hepsi intakt.
- **References / Batch / Review / Selection / Mockup Studio /
  Product / Etsy Draft canonical akışları intakt.**
- **Phase 100 persistence + handoff + Listing discriminated union
  backward-compat tam.**
- **Kivasy v4 tokens + Studio `--ks-*` namespace bozulmadı.**

### Bug ledger update

Düzeltilen parity bug'ları (Phase 103):
- **Item tilt/rotation export'ta düzleşiyor** — Phase 102 Sharp
  pipeline asset'i önce rotate edip sonra chrome uyguluyordu;
  preview slot-wrap'i bir bütün olarak döndürüyordu. Phase 103
  compose order fix: chrome'lu tile bir bütün olarak rotate
  (preview parity).
- **White outline rotated item'da kayıp/zayıf** — outline rotated
  asset'in büyümüş transparent bbox'ına uygulanıyordu. Phase 103
  outline axis-aligned asset gerçek dims'ine uygulanıp tile ile
  birlikte döner.
- **Rounded corner rotated item'da yanlış yerde** — rounded mask
  rotated bbox köşesindeydi. Phase 103 rounded mask axis-aligned
  asset gerçek köşesinde.

Hâlâ açık (Phase 104+ candidate):
- **ProductType-specific item shape parity** (Phase 102'den devir)
  — Studio preview `StageDeviceSVG` ProductType-aware (sticker →
  white sticker edge 10px pad / wall_art → frame matting / phone →
  device bezel). Phase 103 ortak chrome (rounded + outline + shadow
  + tilt) tüm productType'lara aynı; sticker white-pad / wall_art
  matting / phone bezel tam parity Phase 104+ (her shape için ayrı
  SVG compose büyük scope; ana "ne gördüm = ne aldım" divergence
  Phase 101-103'te kapandı).
- **Plate-only Lens Blur** (Phase 101'den devir) — blur full canvas;
  preview plate parent'a CSS filter.
- **Drop shadow shadow softness fine-tune** — preview 4-katmanlı;
  libvips feDropShadow 2-katmanlı; ana visual impact yakalandı,
  yumuşaklık ince fark.
- **Etsy Draft submit pipeline frame-export end-to-end test** —
  handoff entry + Phase 9 push pipeline outputKey/signedUrl yolu
  intakt; gerçek Etsy push test (Etsy API key gerek).

### Bundan sonra en doğru sonraki adım

Phase 103 ile **Preview = Export Truth** ilkesi hem contract'a
yazıldı hem item-level kök bug (tilt/rotation + outline compose
order) çözüldü:
- Studio'da gördüğüm ≈ indirdiğim PNG ≈ Product MockupsTab tile
- Plate rounded + border + drop shadow + stage padding (Phase 101)
- Item rounded + white outline + drop-shadow chain (Phase 102)
- **Item tilt/rotation + chrome compose order birebir** (Phase 103)
- Editing chrome (selection ring + badge) export'a girmez

Sıradaki en yüksek-impact adım **Phase 104 candidate**: ProductType-
specific item shape parity (sticker white-pad / wall_art matting /
phone bezel Sharp pipeline'a) — kalan en görünür divergence. Ana
item chrome + tilt/rotation Phase 101-103'te kapandığı için Phase
104 fine-grain shape polish. Paralel: Etsy Draft submit pipeline
frame-export end-to-end test.

---

## Phase 104 — White edge / sticker outline parity (kalın opak beyaz çerçeve)

Phase 103 tilt/rotation + compose order düzeltti ama kullanıcı hâlâ
kritik bir fark gözledi: **item'ların etrafındaki beyaz çerçeve /
white edge export'ta preview'daki kadar görünmüyor**. Tilt parity
tamamdı ama item chrome parity (white edge) hâlâ kapanmamıştı.
Phase 104 bu kök bug'ı düzeltir.

### Gerçek browser comparison (DOM ölçüm + screenshot)

Studio preview slot 0 (clipart → `StickerCardSVG`, 220×220) DOM
rect ölçümü — **white edge'in gerçek katman yapısı**:
- rect1: `0,0 220×220 rx=22 fill=#FFFFFF` → **KALIN OPAK BEYAZ
  DOLGU** (polaroid/sticker tarzı çerçeve)
- rect2: `10,10 200×200 rx=18 fill=gradient` → asset surface
  (pad=10px İÇERİDE; pad/minDim ≈ %4.5)
- image: asset 10px içeride, rx=18 clip
- rect3: `0.5,0.5 219×219 rx=21.5 stroke=rgba(0,0,0,0.1) sw=1` →
  ince **koyu** hairline inner outline

Screenshot: preview'da 3 sticker card, her birinde belirgin kalın
opak beyaz çerçeve asset'in etrafında.

### En büyük kök fark

Phase 102/103 "white edge"i **ince 2px `rgba(255,255,255,0.18)`
stroke outline** ile taklit ediyordu. Ama preview'daki gerçek
white edge = asset'in etrafında **kalın opak beyaz dolgu bandı**
(asset beyaz çerçevenin İÇİNDE çizilir, %4.5 her kenarda). İnce
saydam stroke kalın opak banta karşılık gelmiyordu → export'ta
white edge **görünmüyordu**. Kullanıcının şikayetinin tam kök
nedeni buydu (tilt değil — item chrome white edge layer model'i).

### Ürün kararı

- **White edge / sticker outline = final visual chrome** → EVET,
  export'a birebir girer (contract §11.0 Preview = Export Truth).
- **Product tile** exported PNG üzerinden korunur (tile gerçek
  PNG'yi gösterdiği için white edge otomatik yansır; Phase 101
  tile aspect baseline değişmez).
- Canonical truth = exported PNG; preview StickerCardSVG katman
  yapısı export'ta birebir compose edilir.

### Fix — frame-compositor.ts preview StickerCardSVG layer parity

`computeItemChrome` yeniden tanımlandı (preview StickerCardSVG
geometry):
- `outerRadius = clamp(8, minDim×0.16, 56)` (preview rect1 rx =
  min(22, minDim×0.16))
- `whiteEdge = max(6, minDim×0.046)` (preview pad/minDim ≈ %4.5;
  min 6px küçük slot'ta görünür kalsın)
- `innerRadius = max(4, outerRadius×0.82)` (preview rect2 rx = r-4)
- `innerStroke = max(1, minDim/200)` (preview rect3 koyu hairline)

Slot composite zinciri preview 3-katman yapısına göre yeniden
yazıldı:
- (a) Card silhouette dims (rotate YOK — Phase 103 order korundu)
- (b) Asset INNER rounded rect mask: `assetW-2×whiteEdge` ×
  `assetH-2×whiteEdge`, `rx=innerRadius` (asset beyaz çerçevenin
  içinde, preview rect2 parity)
- (c) Chrome'lu tile compose (axis-aligned):
  - layer 1: shadow base (full card silhouette + feDropShadow
    2-katmanlı, Phase 102/103 baseline)
  - layer 2: **OUTER WHITE EDGE** — `<rect fill=#FFFFFF
    rx=outerRadius>` kalın opak beyaz dolgu (preview rect1) +
    koyu hairline inner outline `<rect stroke=rgba(0,0,0,0.10)
    sw=innerStroke>` (preview rect3) tek SVG
  - layer 3: inner asset (whiteEdge band içinde, rx=innerRadius)
- (d) Chrome'lu tile'ı BİR BÜTÜN olarak rotate (Phase 103
  compose order korundu — preview CSS transform:rotate parity)
- (e) Rotated tile slot mantıksal merkezine recenter

Selection ring + badge **compose edilmez** (§11.0 editing helper
baseline korundu). `MockupsTab` **dokunulmadı** (Phase 101 tile
baseline; tile gerçek export PNG'sini gösterdiği için white edge
otomatik yansır).

### Browser end-to-end real-asset doğrulama

Live dev server (1600×1100, real DB, real selection set
`cmov0ia37` 4-item clipart + real MinIO MJ assets PAS5/Pinterest):

| Özellik | Studio preview | Phase 103 export (ref) | Phase 104 export |
|---|---|---|---|
| Kalın opak beyaz edge | ✓ belirgin | ❌ ince saydam stroke (kayıp) | ✓ belirgin kalın opak |
| Asset beyaz çerçeve içinde | ✓ pad=10px | ❌ tüm tile | ✓ whiteEdge band içinde |
| Tilt/rotation | slot1 -6° slot2 -12° | ✓ korundu | ✓ korundu |
| Rounded corner | ✓ | ✓ | ✓ |
| Drop shadow | ✓ | ✓ | ✓ |
| Inner hairline | rgba(0,0,0,0.1) | rgba(255,255,255,0.18) yanlış | ✓ rgba(0,0,0,0.1) parity |

Phase 104 export: 1920×1080, 704.2 KB. Studio preview ↔ Phase 104
PNG yan yana screenshot: **kalın opak beyaz polaroid/sticker
çerçeve birebir aynı**; asset beyaz çerçevenin içinde, tilt
korundu (slot1 -6°, slot2 -12°).

Product MockupsTab handoff: tile aspectRatio "4/3", bg
rgb(22,19,15)=bg-ink, objectFit "contain", img 1920/1080, Phase
104 export (`p0cmfv6v`) cover ring + Primary badge. Tile gerçek
export PNG'sini gösterdiği için white edge + tilt otomatik
korundu (Phase 101 tile aspect baseline değişmedi).

Screenshot kanıtları:
- Studio Frame preview: 3 sticker card, kalın opak beyaz edge +
  tilt (slot1 -6° slot2 -12°)
- Phase 104 export PNG: birebir aynı kalın opak beyaz çerçeve +
  tilt korundu (Phase 103'ün ince stroke export'u ile net
  karşılaştırma)
- Product MockupsTab Frame Exports bucket: 6 tile, Phase 104
  export white edge korundu, ilki cover ring + Primary badge

### Quality gates

- `tsc --noEmit`: clean
- `vitest tests/unit/{mockup, selection, selections, products,
  listings}`: **730/730 PASS** (zero regression)
- `next build`: ✓ Compiled successfully

### Değişmeyenler (Phase 104)

- **Review freeze (Madde Z) korunur.**
- **Schema migration yok.** Phase 100 FrameExport + Listing.
  imageOrderJson baseline dokunulmadı.
- **WorkflowRun eklenmez.**
- **Yeni big abstraction yok.** Tek dosya (`frame-compositor.ts`)
  `computeItemChrome` helper redefinition + slot composite layer
  yapısı; yeni helper/service/route/endpoint yok. Phase 103
  compose order (rotate sırası) korundu. MockupsTab + Studio shell
  + diğer tüm yüzeyler dokunulmadı.
- **3. taraf mockup API path** ana akışa girmedi.
- **Mockup mode render dispatch (POST /api/mockup/jobs)
  dokunulmadı** — Phase 8 baseline Mockup pack pipeline ayrı
  compositor (`compositor.ts`); Frame-only `frame-compositor.ts`
  refactor'undan etkilenmedi.
- **Studio shell, slot-ring/badge editing chrome, Phase 94
  editing/final split, Phase 101 plate chrome + tile aspect,
  Phase 103 compose order** hepsi intakt.
- **References / Batch / Review / Selection / Mockup Studio /
  Product / Etsy Draft canonical akışları intakt.**
- **Phase 100 persistence + handoff + Listing discriminated union
  backward-compat tam.**
- **Kivasy v4 tokens + Studio `--ks-*` namespace bozulmadı.**

### Bug ledger update

Düzeltilen parity bug'ları (Phase 104):
- **White edge / sticker outline export'ta görünmüyor** — Phase
  102/103 ince 2px `rgba(255,255,255,0.18)` stroke ile taklit
  ediyordu; preview gerçek white edge = kalın opak beyaz dolgu
  bandı. Phase 104 preview StickerCardSVG 3-katman yapısı birebir
  (outer white edge rect + asset pad içeride + koyu hairline).
- **Inner outline yanlış renk** — Phase 102/103 beyaz saydam
  stroke; preview koyu `rgba(0,0,0,0.10)` hairline. Phase 104
  preview parity.

Hâlâ açık (Phase 105+ candidate):
- **ProductType-specific item shape parity** (Phase 102'den devir)
  — Phase 104 white edge model'i StickerCardSVG'ye birebir; ama
  wall_art → frame matting / phone → device bezel farklı katman
  yapısı taşıyor. Sharp pipeline şu an tüm productType'lara
  sticker-style white edge uyguluyor. wall_art frame matting /
  phone bezel tam parity Phase 105+ (her shape için ayrı SVG
  layer model; ana clipart/sticker divergence Phase 101-104'te
  kapandı — test set clipart).
- **Plate-only Lens Blur** (Phase 101'den devir) — blur full
  canvas; preview plate parent'a CSS filter.
- **Drop shadow softness fine-tune** (Phase 103'ten devir) —
  libvips feDropShadow 2-katmanlı; preview 4-katmanlı; ana
  visual impact yakalandı.
- **Etsy Draft submit pipeline frame-export end-to-end test** —
  handoff entry + Phase 9 push pipeline outputKey/signedUrl yolu
  intakt; gerçek Etsy push test (Etsy API key gerek).

### Bundan sonra en doğru sonraki adım

Phase 104 ile **item chrome parity** (plate + tilt + white edge)
clipart/sticker için tam fulfilled:
- Studio'da gördüğüm ≈ indirdiğim PNG ≈ Product MockupsTab tile
- Plate rounded + border + drop shadow + stage padding (Phase 101)
- Item rounded + drop-shadow chain (Phase 102)
- Item tilt/rotation + compose order (Phase 103)
- **Kalın opak beyaz sticker edge + koyu hairline** (Phase 104)
- Editing chrome (selection ring + badge) export'a girmez

Sıradaki en yüksek-impact adım **Phase 105 candidate**: ProductType-
specific item shape parity (wall_art frame matting / phone device
bezel Sharp pipeline'a — her shape için ayrı layer model). Clipart/
sticker divergence Phase 101-104'te kapandığı için Phase 105 diğer
productType shape polish. Paralel: Etsy Draft submit pipeline
frame-export end-to-end test.

---

## Phase 105 — productType-specific item shape parity (wall_art frame + mat, phone bezel)

Phase 101-104 clipart/sticker case için preview/export parity'yi
tam kapadı (plate + tilt + white edge). Kullanıcı belirtti: kalan
en önemli açık **productType-specific item shape parity** —
wall_art frame matting / phone bezel preview'da farklı, export'ta
sticker-style düz beyaz edge alıyordu.

### Gerçek browser audit (DOM rect ölçüm)

Studio preview `StageDeviceSVG` 5 shape ailesi (svg-art.tsx):
- **wall_art/canvas/printable → WallArtFrameSVG**: rect1
  `#1A1612` (koyu ahşap frame) + rect2 frame inner hairline +
  rect3 `#F5F1E9` (**KREM MAT**, frameW=9) + rect4 asset interior
  (innerX=23 = frame 9 + mat 14)
- **sticker/clipart → StickerCardSVG**: kalın opak beyaz edge
  (Phase 104 baseline)
- **phone → PhoneSVG**: koyu device gövde + screen inset (bezel)
- bookmark → BookmarkStripSVG; tshirt/dtf/hoodie →
  TshirtSilhouetteSVG

Phase 104'e kadar Sharp pipeline'a `deviceKind` **hiç geçmiyordu**
→ TÜM productType'lara sticker-style beyaz edge. wall_art
export'unda **koyu frame + krem mat YOK** (en büyük productType-
specific divergence). DOM ölçüm (wall_art patch'li test set):
preview rect1 `#1A1612` + rect3 `#F5F1E9` + asset interior x=23.

### En büyük kök fark

`deviceKind` Shell'de resolve ediliyordu (`stageDeviceForProduct
Type(categoryId)`, cascadeLayoutFor'da kullanılıyor) ama frame
export body'sine / route / service / compositor zincirine **hiç
iletilmiyordu**. Sharp compositor tek "sticker-style" chrome
uyguluyordu. wall_art (koyu frame + krem mat) ve phone (device
bezel) preview'da tamamen farklı shape; export sticker'a
düzleştiriyordu.

### Ürün kararı

- productType-specific shape/chrome = **final visual chrome** →
  EVET, export'a birebir girer (contract §11.0 Preview = Export
  Truth).
- preview'da görünen shape (frame+mat / bezel) export'a girer;
  selection helpers (slot-ring / badge) **girmez** (§11.0 editing
  helper baseline korunur).
- Product MockupsTab gerçek export PNG'sini gösterir (Phase 101
  tile aspect baseline değişmez; shape parity otomatik yansır).
- Canonical truth = exported PNG.

### Fix — deviceShape zinciri + Sharp shape model

**Zincir** (Shell → route → service → compositor):
- `frame-compositor.ts`: yeni `FrameDeviceShape = "frame" |
  "sticker" | "bezel"` type + `resolveDeviceShape(deviceKind)`
  helper. `FrameCompositorInput.deviceShape?` (backward-compat:
  undefined → "sticker").
- `frame-export.service.ts`: `ExportFrameInput.deviceShape?` +
  compositorInput'a iletim.
- `route.ts`: `DeviceShapeSchema = z.enum([...]).optional()` +
  service çağrısına geçirim.
- `MockupStudioShell.tsx`: `handleExportFrame` body'sine
  `deviceShape` (deviceKind → shape inline map; client/server
  boundary: compositor server-only, Shell-local map server
  `resolveDeviceShape` ile aynı).

**Sharp shape-aware slot composite** (3 branch):
- `"frame"` → WallArtFrameSVG parity: layer1 shadow base
  (frame silhouette) + layer2 koyu frame `#1A1612` + frame
  inner hairline `rgba(255,255,255,0.06)` + **krem mat
  `#F5F1E9`** (frameW=minDim×0.045, matW=minDim×0.07) + layer3
  asset interior (innerX=frameW+matW). Preview rect1-4 birebir.
- `"sticker"` → StickerCardSVG parity (Phase 104 baseline
  korundu — kalın beyaz edge, regression yok).
- `"bezel"` → PhoneSVG parity: koyu device gövde `#0E0C0A`
  (bodyRadius=minDim×0.14) + screen inset (bezel=minDim×0.035,
  rounded screen mask).
- bookmark/tshirt → "sticker" fallback (Phase 106+ candidate;
  test set'leri clipart/wall_art/phone üçlüsü kapsadı).
- Phase 103 compose order (chrome'lu tile bir bütün rotate)
  her shape için korundu.

### Browser end-to-end real-asset doğrulama

Live dev server (1600×1100, real DB). **Controlled test seed**
(CLAUDE.md Phase 12 "seed parity gap" pattern): test set
`cmov0ia37` 4 GeneratedDesign productType clipart → wall_art
patch'lendi (runtime parity için); test sonrası clipart'a geri
restore edildi (production data drift yok).

| Özellik | Studio preview (WallArtFrameSVG) | Phase 104 export (sticker model) | Phase 105 export (frame model) |
|---|---|---|---|
| Koyu ahşap frame | ✓ #1A1612 | ❌ beyaz sticker edge | ✓ koyu çerçeve |
| Krem mat (paspartu) | ✓ #F5F1E9 | ❌ yok | ✓ krem paspartu |
| Asset interior | ✓ frame+mat içinde | ❌ tüm tile | ✓ frame+mat içinde |
| Tilt/rotation | slot1 -6° slot2 -12° | ✓ | ✓ korundu |
| Drop shadow | ✓ | ✓ | ✓ |

- Wall_art export: 1920×1080, 756.4 KB. Studio preview ↔ Phase
  105 PNG yan yana: **koyu ahşap çerçeve + krem mat + asset
  interior birebir aynı**; tilt korundu.
- Clipart regression (restore sonrası, deviceKind=clipart):
  preview rect1 `#FFFFFF` (StickerCardSVG) + export 704.2 KB
  kalın opak beyaz sticker edge — **Phase 104 baseline hiç
  bozulmadı** (deviceShape="sticker" path).
- Product MockupsTab handoff (wall_art): tile aspectRatio
  "4/3", bg-ink, contain, 1920/1080, Phase 105 export cover —
  framed wall art tile'da korundu.

Screenshot kanıtları:
- Studio Frame preview (wall_art): 3 framed wall art (koyu
  çerçeve + krem mat + tilt)
- Phase 105 export PNG: birebir framed wall art (Phase 104
  sticker export ile net karşılaştırma)
- Product MockupsTab Frame Exports: 7 tile, Phase 105 wall_art
  export frame shape korundu, cover ring + Primary badge
- Clipart regression export: kalın opak beyaz sticker edge
  (Phase 104 ile birebir — regression yok)

### Quality gates

- `tsc --noEmit`: clean
- `vitest tests/unit/{mockup, selection, selections, products,
  listings}`: **730/730 PASS** (zero regression)
- `next build`: ✓ Compiled successfully

### Değişmeyenler (Phase 105)

- **Review freeze (Madde Z) korunur.**
- **Schema migration yok.** Phase 100 FrameExport + Listing.
  imageOrderJson baseline dokunulmadı. Controlled test seed
  patch (GeneratedDesign productType clipart→wall_art→clipart)
  yalnız runtime verification için; restore edildi, production
  drift yok.
- **WorkflowRun eklenmez.**
- **Yeni big abstraction yok.** `FrameDeviceShape` type +
  `resolveDeviceShape` helper + shape-aware composite branch
  (frame/sticker/bezel); zincir 4 dosyada opsiyonel field
  (Shell/route/service/compositor). Yeni service/route/endpoint
  yok. Phase 103 compose order + Phase 104 sticker baseline
  korundu.
- **3. taraf mockup API path** ana akışa girmedi.
- **Mockup mode render dispatch (POST /api/mockup/jobs)
  dokunulmadı** — Phase 8 baseline ayrı compositor
  (`compositor.ts`).
- **Studio shell, slot-ring/badge editing chrome, Phase 94
  split, Phase 101 plate chrome + tile aspect, Phase 103
  compose order, Phase 104 sticker white-edge** hepsi intakt
  (clipart regression doğrulandı).
- **References / Batch / Review / Selection / Mockup Studio /
  Product / Etsy Draft canonical akışları intakt.**
- **Phase 100 persistence + handoff backward-compat tam.**
- **Kivasy v4 tokens + Studio `--ks-*` namespace bozulmadı.**

### Bug ledger update

Düzeltilen parity bug'ları (Phase 105):
- **wall_art export sticker-style düz beyaz edge alıyordu** —
  Sharp pipeline'a deviceKind hiç geçmiyordu; tüm productType'lar
  sticker chrome. Phase 105 deviceShape zinciri + WallArtFrameSVG
  parity (koyu frame + krem mat + asset interior).
- **phone export bezel chrome'u yoktu** — aynı kök neden. Phase
  105 PhoneSVG parity (koyu device gövde + screen inset).

Hâlâ açık (Phase 106+ candidate):
- **bookmark/tshirt/hoodie/dtf shape parity** — Phase 105'te
  "sticker" fallback (preview BookmarkStripSVG /
  TshirtSilhouetteSVG farklı katman yapısı). Sharp pipeline
  bunlara henüz dedicated shape uygulamıyor. Tam parity Phase
  106+ (her shape için ayrı layer model; test set'leri
  clipart/wall_art/phone üçlüsünü kapsadı — en görünür
  divergence kapandı).
- **Plate-only Lens Blur** (Phase 101'den devir) — blur full
  canvas; preview plate parent'a CSS filter.
- **Drop shadow softness fine-tune** (Phase 103'ten devir) —
  libvips feDropShadow 2-katmanlı; preview 4-katmanlı.
- **Etsy Draft submit pipeline frame-export end-to-end test** —
  handoff entry + Phase 9 push pipeline outputKey/signedUrl
  yolu intakt; gerçek Etsy push test (Etsy API key gerek).

### Bundan sonra en doğru sonraki adım

Phase 105 ile **productType-specific item shape parity** clipart/
sticker (Phase 104) + wall_art frame+mat + phone bezel (Phase
105) için fulfilled:
- Studio'da gördüğüm ≈ indirdiğim PNG ≈ Product MockupsTab tile
- Plate rounded + border + drop shadow + stage padding (Phase 101)
- Item rounded + drop-shadow chain (Phase 102)
- Item tilt/rotation + compose order (Phase 103)
- Kalın opak beyaz sticker edge (Phase 104)
- **wall_art koyu frame + krem mat / phone device bezel** (Phase
  105)
- Editing chrome (selection ring + badge) export'a girmez

Sıradaki en yüksek-impact adım **Phase 106 candidate**: bookmark/
tshirt/hoodie/dtf shape parity (BookmarkStripSVG /
TshirtSilhouetteSVG Sharp pipeline'a — her shape için ayrı
layer model). Clipart/wall_art/phone divergence Phase 101-105'te
kapandığı için Phase 106 kalan productType shape polish.
Paralel: Etsy Draft submit pipeline frame-export end-to-end test.

---

## Phase 106 — kalan productType shape parity (bookmark strip, garment silhouette, phone bezel refine)

Phase 105 wall_art frame+mat + sticker baseline kapadı; phone
"bezel" branch kısmen vardı. Kullanıcı: kalan iki kritik açık —
(1) phone/bezel parity için gerçek browser proof zayıf, (2)
bookmark/tshirt/hoodie/dtf hâlâ "sticker" fallback davranıyordu.
Phase 106 bu üçünü tamamlar.

### Gerçek browser audit (DOM ölçüm) + temporary test harness

Studio preview kalan 3 shape (svg-art.tsx) DOM ölçüm
(test set `cmov0ia37` controlled patch ile her productType):

- **phone → PhoneSVG**: rect W×H rx=26 fill `#0C0A09` koyu gövde +
  screen **ASİMETRİK bezel** (x=bz, y=bz×2 üst, sw=W-bz×2,
  sh=H-bz×3 alt daha kalın) + camera notch (w/2-16, sy+7, 32×9
  `#0C0A09`) + outer hairline `rgba(255,255,255,0.07)`. bz=10 @
  ref ≈ minDim×0.05.
- **bookmark → BookmarkStripSVG**: dar dikey strip (viewBox
  90×320). tassel knot circle (cx=45, r=6, `#3A3532`) + askı ipi
  line + body rect (4,20,W-8,H-28 rx=3 gradient/asset) + inner
  outline `rgba(0,0,0,0.18)`.
- **tshirt/hoodie/dtf → TshirtSilhouetteSVG**: garment body
  `<path>` (omuz+kol+gövde, fill `#2A2622`) + neckline ellipse
  (`#161412`) + chest area asset (chestX,chestY,chestW×chestH
  rx=4). Path-based silüet.

Phase 105 bezel branch basitti (uniform bezel minDim×0.035,
notch yok); bookmark/tshirt **"sticker" fallback** (kalın beyaz
edge — yanlış silüet).

**Temporary test harness** (CLAUDE.md Phase 12 pattern, raporlandı
+ restore edildi): test set `cmov0ia37` 4 GeneratedDesign
productType clipart → bookmark → tshirt sırayla patch'lendi
(runtime parity proof için); test sonrası clipart'a restore
(`krb3g7`, production data drift yok).

### En büyük kök fark

`deviceShape` zinciri Phase 105'te kuruldu (Shell → route →
service → compositor) ama yalnız 3 shape (frame/sticker/bezel-
basit). bookmark/tshirt `resolveDeviceShape` "sticker" fallback'e
düşüyordu → preview'da BookmarkStripSVG (dar strip + knot) /
TshirtSilhouetteSVG (garment) export'ta kare beyaz sticker
oluyordu. phone bezel notch + asimetrik bezel eksikti.

### Ürün kararı

- productType-specific shape/chrome = **final visual chrome** →
  export'a birebir girer (contract §11.0 Preview = Export Truth).
- preview'da görünen shape (strip+knot / garment / asimetrik
  bezel+notch) export'a girer; selection helpers (slot-ring/badge)
  **girmez** (§11.0 editing helper baseline korunur).
- Product MockupsTab gerçek export PNG'sini gösterir (Phase 101
  tile aspect baseline değişmez; shape parity otomatik yansır).
- Canonical truth = exported PNG.

### Fix — deviceShape genişletme + 3 yeni Sharp shape branch

`frame-compositor.ts` `FrameDeviceShape` genişletildi:
`"frame" | "sticker" | "bezel" | "bookmark" | "garment"`.
`resolveDeviceShape`: bookmark → "bookmark", tshirt/hoodie/dtf
→ "garment" (hoodie hood ellipse Phase 107+ baseline garment).

Shape-aware slot composite branch'leri:
- **"bezel" refine** (PhoneSVG parity): koyu gövde `#0C0A09` +
  asimetrik bezel (screenX=bz, screenY=bz×2, screenW=W-bz×2,
  screenH=H-bz×3) + camera notch (asset compose sonrası üstte) +
  outer hairline `rgba(255,255,255,0.07)`. bz=minDim×0.05,
  bodyRadius=minDim×0.13.
- **"bookmark"** (BookmarkStripSVG parity): tassel knot circle
  (`#3A3532`, knotR=minDim×0.075) + askı ipi line + body rect
  (bodyMargin=W×0.05, bodyTop=H×0.07, rounded asset clip) +
  inner outline `rgba(0,0,0,0.18)`. Shadow body silhouette'e.
- **"garment"** (TshirtSilhouetteSVG parity): garment body
  `<path>` (omuz+kol+gövde, `#2A2622`, sleeveOffset=W×0.18,
  bodyW=W×0.62) + neckline ellipse (`#161412`) + chest area asset
  (chestW=bodyW×0.7 kare, rounded clip). Shadow path silhouette'e.
- "sticker"/"frame" Phase 104/105 baseline korundu.
- Phase 103 compose order (chrome'lu tile bir bütün rotate) her
  shape için korundu.

Zincir: route `DeviceShapeSchema` 5-enum, Shell deviceKind→shape
inline map (bookmark/garment branch eklendi; client/server
boundary korunur — server `resolveDeviceShape` ile aynı).

### Browser end-to-end real-asset doğrulama

Live dev server (1600×1100, real DB, real MinIO MJ assets PAS5/
Pinterest):

| productType | Studio preview | Phase 105 export (sticker fallback) | Phase 106 export |
|---|---|---|---|
| **bookmark** | dar strip + tassel knot + ip | ❌ kare beyaz sticker | ✓ dar dikey strip + siyah knot + askı ipi |
| **tshirt** | garment silüeti + neckline + chest | ❌ kare beyaz sticker | ✓ garment silüeti + yaka oyuğu + chest print |
| clipart (restore) | StickerCardSVG kalın beyaz edge | ✓ | ✓ regression yok (pixel-perfect 721091 bytes) |

- bookmark export 538.2 KB, tshirt export 312.6 KB. Studio
  preview ↔ Phase 106 PNG yan yana screenshot: silüet birebir
  (bookmark dar strip + knot / tshirt garment + chest); tilt
  korundu (slot1 -6° slot2 -12°).
- clipart regression (restore sonrası, deviceKind=clipart):
  preview rect1 `#FFFFFF` + export 704.2 KB / 721091 bytes —
  **Phase 104/105 baseline pixel-perfect korundu** (deviceShape
  ="sticker" path).
- Product MockupsTab handoff (bookmark + tshirt): 9 tile,
  aspectRatio "4/3", bg-ink, contain, 1920/1080; bookmark strip
  + garment silüet tile'da korundu, tshirt cover ring + Primary
  badge.

Screenshot kanıtları:
- Studio Frame preview (bookmark): 3 bookmark strip (dar dikey +
  siyah knot + tilt)
- Studio Frame preview (tshirt): 3 garment silüet (omuz+gövde +
  neckline + chest)
- Phase 106 bookmark export PNG: birebir dar strip + knot + ip
- Phase 106 tshirt export PNG: birebir garment + neckline + chest
- Product MockupsTab Frame Exports: 9 tile karışık shape (bookmark
  strip / garment / wall_art frame / sticker) hepsi gerçek export
  PNG ile korundu
- Clipart regression export: kalın opak beyaz sticker edge (Phase
  104/105 ile pixel-perfect — regression yok)

### Quality gates

- `tsc --noEmit`: clean
- `vitest tests/unit/{mockup, selection, selections, products,
  listings}`: **730/730 PASS** (zero regression)
- `next build`: ✓ Compiled successfully

### Değişmeyenler (Phase 106)

- **Review freeze (Madde Z) korunur.**
- **Schema migration yok.** Controlled test seed patch
  (GeneratedDesign productType clipart→bookmark→tshirt→clipart)
  yalnız runtime verification için temporary test harness;
  restore edildi, production drift yok.
- **WorkflowRun eklenmez.**
- **Yeni big abstraction yok.** `FrameDeviceShape` 2 yeni union
  member + `resolveDeviceShape` 2 yeni case + 2 yeni composite
  branch (bookmark/garment) + bezel branch refine; zincir 3
  dosyada opsiyonel field genişletme (Shell/route/compositor;
  service Phase 105'ten unchanged). Yeni service/route/endpoint
  yok. Phase 103 compose order + Phase 104 sticker + Phase 105
  frame baseline korundu.
- **3. taraf mockup API path** ana akışa girmedi.
- **Mockup mode render dispatch (POST /api/mockup/jobs)
  dokunulmadı** — Phase 8 baseline ayrı compositor
  (`compositor.ts`).
- **Studio shell, slot-ring/badge editing chrome, Phase 94
  split, Phase 101 plate chrome + tile aspect, Phase 103
  compose order, Phase 104 sticker, Phase 105 frame** hepsi
  intakt (clipart regression pixel-perfect doğrulandı).
- **References / Batch / Review / Selection / Mockup Studio /
  Product / Etsy Draft canonical akışları intakt.**
- **Phase 100 persistence + handoff backward-compat tam.**
- **Kivasy v4 tokens + Studio `--ks-*` namespace bozulmadı.**

### Bug ledger update

Düzeltilen parity bug'ları (Phase 106):
- **bookmark export kare beyaz sticker alıyordu** —
  resolveDeviceShape "sticker" fallback'e düşüyordu. Phase 106
  "bookmark" branch BookmarkStripSVG parity (dar strip + tassel
  knot + ip + body + inner outline).
- **tshirt/hoodie/dtf export kare beyaz sticker alıyordu** —
  aynı kök. Phase 106 "garment" branch TshirtSilhouetteSVG
  parity (garment path + neckline + chest area).
- **phone bezel notch + asimetrik bezel eksikti** — Phase 105
  basit uniform bezel. Phase 106 PhoneSVG parity (asimetrik
  bezel + camera notch + outer hairline).

Hâlâ açık (Phase 107+ candidate):
- **hoodie hood ellipse** — Phase 106'da garment baseline
  (hoodie = garment, hood ellipse yok). Preview hoodie variant'ı
  shoulder üstünde hood ellipse çiziyor. Phase 107+ garment'a
  hood param eklenir (küçük delta; ana garment silüeti Phase
  106'da kapandı).
- **Plate-only Lens Blur** (Phase 101'den devir) — blur full
  canvas; preview plate parent'a CSS filter.
- **Drop shadow softness fine-tune** (Phase 103'ten devir) —
  libvips feDropShadow 2-katmanlı; preview 4-katmanlı.
- **Etsy Draft submit pipeline frame-export end-to-end test** —
  handoff entry + Phase 9 push pipeline outputKey/signedUrl
  yolu intakt; gerçek Etsy push test (Etsy API key gerek).

### Bundan sonra en doğru sonraki adım

Phase 106 ile **productType-specific item shape parity tüm ana
shape'ler için fulfilled**:
- Studio'da gördüğüm ≈ indirdiğim PNG ≈ Product MockupsTab tile
- Plate rounded + border + drop shadow + stage padding (Phase 101)
- Item rounded + drop-shadow chain (Phase 102)
- Item tilt/rotation + compose order (Phase 103)
- Kalın opak beyaz sticker edge (Phase 104)
- wall_art koyu frame + krem mat (Phase 105)
- **bookmark dar strip + tassel knot / tshirt garment silüeti +
  chest / phone asimetrik bezel + notch** (Phase 106)
- Editing chrome (selection ring + badge) export'a girmez

Sıradaki adım **Phase 107 candidate**: hoodie hood ellipse delta
(garment baseline + hood param) + plate-only Lens Blur + drop
shadow softness fine-tune + Etsy Draft submit pipeline frame-
export end-to-end test. Ana productType shape divergence Phase
101-106'te kapandı; Phase 107 fine-grain polish + Etsy push e2e.

---

## Phase 107 — phone bezel detay parity + Etsy Draft e2e continuity proof

Phase 106 bookmark/garment/wall_art shape parity'yi kapadı; phone
"bezel" branch geometry'si doğruydu ama 2 kritik açık vardı:
(1) phone/bezel parity için gerçek browser proof + ikincil chrome
detayları (side buttons / speaker / screen sheen) eksik, (2)
Frame export → Etsy Draft zinciri uçtan uca kanıtlanmamıştı.
Phase 107 ikisini tamamlar.

### Gerçek browser audit (PhoneSVG vs Phase 106 bezel)

Studio preview `PhoneSVG` (svg-art.tsx:201) DOM ölçüm
(temporary test harness ile deviceKind=phone):
- rect1: koyu gövde `#0C0A09` rx=26 (r/w=0.13)
- rect2: screen x=bz y=bz×2 sw=W-bz×2 sh=H-bz×3 (bz/w=0.05;
  **asimetrik bezel** — üst sy=bz×2 alt'tan 2× kalın)
- notch: w/2-16, sy+7, 32×9 `#0C0A09`
- **side buttons** (Phase 106'da eksikti): sol-üst x=-1.5
  y=h×0.28 3×18, sol-alt y=h×0.37 3×27, sağ x=w-1.5 y=h×0.31
  3×34 (`#080706`, gövde kenarına bitişik)
- **speaker slot** (eksikti): w/2-20 h-bz-5 40×3.5
  rgba(255,255,255,0.12)
- **screen sheen** (eksikti): 2 gradient (sid üst rgba(255,255,
  255,0.13)→0, rid alt 0→0.04 gloss)
- outer hairline rgba(255,255,255,0.07)

Phase 106 bezel branch geometry (bz, radius, asimetrik bezel,
notch) **doğruydu** ama side buttons / speaker / screen sheen
**yoktu** → telefon kimliği zayıf (preview'da net görünen kenar
tuşları + gloss export'ta yoktu).

### En büyük fark

Phone genel parity Phase 106'da iyi (koyu gövde + asimetrik
bezel + notch + hairline). Eksik **ikincil chrome detayları**:
en görünür side buttons (gövde dışına taşan koyu kenar tuşları —
iPhone silüetinin imzası), sonra screen sheen gloss, speaker
slot. Preview = Export Truth için kapatılmalı.

### Ürün kararı

- PhoneSVG shape/chrome (gövde + asimetrik bezel + notch + side
  buttons + speaker + sheen) = **final visual chrome** → export'a
  birebir girer (contract §11.0).
- Product MockupsTab gerçek export PNG'sini gösterir (Phase 101
  tile aspect baseline değişmez).
- editing helpers (slot-ring/badge) export'a girmez (§11.0).
- Canonical truth = exported PNG.

### Fix — bezel branch ikincil chrome detayları

`frame-compositor.ts` "bezel" branch'e eklendi (geometry Phase
106 baseline korundu):
- **side buttons** (3 koyu rect `#080706`, gövde kenarına
  bitişik — sbW=minDim×0.015; sol-üst y=H×0.28 h=H×0.044,
  sol-alt y=H×0.37 h=H×0.066, sağ y=H×0.31 h=H×0.083): body
  SVG'sine eklendi (asset altında, gövdeyle birlikte).
- **screen sheen** (2 linearGradient gloss — üst H×0.48
  rgba(255,255,255,0.13)→0, alt H×0.55+ 0→0.04; screen rounded
  clip içinde): asset compose'tan sonra, notch'tan önce ayrı
  SVG layer.
- **speaker slot** (rgba(255,255,255,0.12) rect, w/2 ortalı,
  spkW=W×0.2 spkH=minDim×0.017): notch SVG'sine eklendi.
- Compose sırası preview parity: shadow → body+sidebuttons →
  screen asset → sheen → notch+speaker+hairline.
- Phase 103 compose order (chrome'lu tile bir bütün rotate)
  korundu.

### Etsy Draft e2e continuity proof (backend + kod + browser)

Phone export Product'a handoff edildi (setAsCover: true).
**DB-level kanıt** (Listing cmor0wkjt..., imageOrderJson):
- 10 entry hepsi `kind: "frame-export"` (önceki turlardan birikmiş)
- Phone entry: `kind: "frame-export"`, packPosition 0,
  **isCover: true**, frameExportId set, outputKey + signedUrl
  var, frameAspect "16:9"
- FrameExport row persisted: 1920×1080, aspect 16:9, storageKey
  var, selectionSetId bağlı (Phase 100 persistence intakt)
- Cover-first ordering: 1 cover entry, kind frame-export,
  packPosition 0 → Etsy submit pipeline cover-first (packPosition
  ASC, cover rank=1) sözleşmesine uygun

**Kod-level kanıt** (`image-upload.service.ts`):
- `orderForUpload`: imageOrder packPosition ASC sıralı
  (cover-first), frame-export + mockup-render ayrım yapmaz
- `storage.download(entry.outputKey)`: frame-export entry'nin
  outputKey'i (Phase 100 FrameExport storageKey) Etsy upload
  için buffer download — kind-agnostic
- `entryId` narrow: `entry.kind === "frame-export" ?
  entry.frameExportId : entry.renderId` (Phase 100 discriminated
  union backward-compat)

**Zincir uçtan uca kanıtlandı**: Frame export (Studio) →
FrameExport persist (Phase 100) → Listing.imageOrderJson
`kind:"frame-export"` cover entry (handoff) → Etsy submit
pipeline orderForUpload + storage.download(outputKey) → Etsy V3
uploadListingImage.

**Güvenli durma noktası**: Gerçek Etsy V3 API POST (final
submit) Etsy API key + OAuth token (production credential)
gerektirir; dev'de credential yok + gerçek Etsy'ye POST riskli.
Continuity DB-level (entry + FrameExport + cover ordering) +
kod-level (submit pipeline frame-export outputKey download)
kanıtlandı. Gerçek Etsy POST açıkça scope dışı (credential +
production risk).

### Browser end-to-end real-asset doğrulama

Live dev server (1600×1100, real DB, real MinIO MJ assets).
**Temporary test harness** (CLAUDE.md Phase 12 pattern,
raporlandı + restore): clipart productType key `clipart` →
`phone` patch (stageDeviceForProductType("phone")="phone"
branch tetikler); test sonrası key `clipart`a restore
(single-row, production drift yok).

| Özellik | Studio preview (PhoneSVG) | Phase 106 export | Phase 107 export |
|---|---|---|---|
| Koyu gövde + asimetrik bezel + notch | ✓ | ✓ | ✓ |
| side buttons (kenar tuşları) | ✓ | ❌ yok | ✓ sol/sağ koyu tuşlar |
| screen sheen (gloss) | ✓ | ❌ yok | ✓ screen gradient gloss |
| speaker slot | ✓ | ❌ yok | ✓ |
| Real asset (PAS5) screen'de | gradient placeholder | — | ✓ gerçek MJ asset |
| Tilt/rotation | slot1 -6° slot2 -12° | ✓ | ✓ korundu |

- phone export 1271.1 KB. Studio preview ↔ Phase 107 PNG yan
  yana screenshot: iPhone-style mockup birebir (gövde + notch +
  side buttons + sheen + gerçek MJ asset screen'de); tilt
  korundu.
- clipart regression (restore sonrası, deviceKind=clipart):
  preview rect1 `#FFFFFF` + export 704.2 KB / **721091 bytes —
  Phase 105/106/107 PIXEL-PERFECT korundu** (3 turdur aynı;
  deviceShape="sticker" path; bezel branch izole değişti).
- Product MockupsTab handoff (phone): 10 tile, aspectRatio
  "4/3", bg-ink, contain, 1920/1080, phone export cover ring +
  Primary badge. Frame Exports section "Send to Etsy as Draft"
  CTA görünür (downstream zincir konumu).

Screenshot kanıtları:
- Studio Frame preview (phone): 3 iPhone-style device (koyu
  gövde + camera notch + side buttons + tilt)
- Phase 107 phone export PNG: birebir iPhone-style + gerçek MJ
  asset screen'de + side buttons + sheen + notch
- Product MockupsTab Frame Exports: 10 tile karışık shape
  (phone / bookmark / garment / wall_art / sticker) hepsi
  gerçek export PNG; phone cover ring + Primary badge + "Send
  to Etsy as Draft" CTA
- Clipart regression export: kalın opak beyaz sticker edge
  (Phase 105/106 ile pixel-perfect 721091 bytes — regression
  yok)

### Quality gates

- `tsc --noEmit`: clean
- `vitest tests/unit/{mockup, selection, selections, products,
  listings}`: **730/730 PASS** (zero regression)
- `next build`: ✓ Compiled successfully

### Değişmeyenler (Phase 107)

- **Review freeze (Madde Z) korunur.**
- **Schema migration yok.** Temporary test harness
  (productType.key clipart→phone→clipart) yalnız runtime
  verification için; restore edildi, production drift yok.
- **WorkflowRun eklenmez.**
- **Yeni big abstraction yok.** Yalnız `frame-compositor.ts`
  "bezel" branch'e side buttons / screen sheen / speaker slot
  SVG layer eklendi (geometry Phase 106 baseline korundu); yeni
  helper/service/route/endpoint yok. deviceShape zinciri
  (Shell/route/service) Phase 105/106'dan unchanged. Etsy Draft
  continuity yalnız **doğrulama** (kod değişikliği yok — mevcut
  pipeline kanıtlandı).
- **3. taraf mockup API path** ana akışa girmedi.
- **Mockup mode render dispatch (POST /api/mockup/jobs)
  dokunulmadı** — Phase 8 baseline ayrı compositor.
- **Studio shell, slot-ring/badge editing chrome, Phase 94
  split, Phase 101 plate chrome + tile aspect, Phase 103
  compose order, Phase 104 sticker, Phase 105 frame, Phase 106
  bookmark/garment** hepsi intakt (clipart regression
  pixel-perfect 721091 bytes 3 turdur).
- **References / Batch / Review / Selection / Mockup Studio /
  Product / Etsy Draft canonical akışları intakt.**
- **Phase 100 persistence + handoff + Listing discriminated
  union backward-compat tam** (Etsy Draft continuity DB+kod
  kanıtlandı).
- **Kivasy v4 tokens + Studio `--ks-*` namespace bozulmadı.**

### Bug ledger update

Düzeltilen parity bug'ları (Phase 107):
- **phone export side buttons (kenar tuşları) yoktu** — Phase
  106 bezel branch geometry doğruydu ama side buttons eksikti.
  Phase 107 body SVG'sine 3 koyu rect `#080706` (sol-üst /
  sol-alt / sağ, gövde kenarına bitişik) PhoneSVG parity.
- **phone export screen sheen (gloss) yoktu** — Phase 107
  asset compose'tan sonra 2 linearGradient gloss (screen
  rounded clip içinde, preview sid/rid parity).
- **phone export speaker slot yoktu** — Phase 107 notch
  SVG'sine speaker rect (rgba(255,255,255,0.12)) eklendi.

Continuity doğrulandı (kod değişikliği yok):
- **Frame export → Etsy Draft zinciri uçtan uca kanıtlandı** —
  DB-level (imageOrderJson kind:"frame-export" cover entry +
  FrameExport row) + kod-level (image-upload.service
  orderForUpload + storage.download(outputKey) + entryId
  narrow). Önceki turlarda yalnız handoff doğrulanmıştı; Phase
  107 Etsy submit pipeline'ın frame-export entry'leri gerçekten
  aktardığını kanıtladı.

Hâlâ açık (Phase 108+ candidate):
- **Gerçek Etsy V3 API POST e2e** — final submit Etsy API key +
  OAuth token gerektirir (production credential; dev'de yok).
  Continuity DB+kod kanıtlandı; gerçek Etsy POST açıkça scope
  dışı.
- **hoodie hood ellipse** (Phase 106'dan devir) — garment
  baseline; hood Phase 108+ (küçük delta).
- **Plate-only Lens Blur** (Phase 101'den devir) — blur full
  canvas; preview plate parent'a CSS filter.
- **Drop shadow softness fine-tune** (Phase 103'ten devir) —
  libvips feDropShadow 2-katmanlı; preview 4-katmanlı.

### Bundan sonra en doğru sonraki adım

Phase 107 ile **tüm ana productType shape parity + Etsy Draft
continuity fulfilled**:
- Studio'da gördüğüm ≈ indirdiğim PNG ≈ Product MockupsTab tile
- Plate (Phase 101) + item chrome (Phase 102) + tilt (Phase
  103) + sticker white-edge (Phase 104) + wall_art frame+mat
  (Phase 105) + bookmark/garment (Phase 106) + **phone
  full bezel (gövde + asimetrik bezel + notch + side buttons +
  speaker + sheen)** (Phase 107)
- Frame export → FrameExport persist → Listing imageOrder
  cover entry → Etsy submit pipeline outputKey download
  (DB+kod kanıtlandı)
- Editing chrome export'a girmez

Sıradaki adım **Phase 108 candidate**: hoodie hood ellipse
delta + plate-only Lens Blur + drop shadow softness + gerçek
Etsy V3 POST e2e (credential gerektiğinde). Ana shape +
continuity Phase 101-107'te kapandı; Phase 108 fine-grain
polish + production Etsy push.

---

## Phase 108 — Plate-only Lens Blur parity + hoodie hood ellipse (stabilization turu)

Phase 101-107 plate + item + tilt + white-edge + productType
shape (clipart/sticker/wall_art/phone/bookmark/garment) +
Etsy continuity'yi kapadı. Phase 108 **feature turu DEĞİL —
stabilization/polish turu**: kalan parity açıklarını kapat,
mevcut shape/chrome kalitesini üretim seviyesine çek, geçici
test harness'e bağımlılığı azalt. Kullanıcı net kısıt: yeni
SVG varyasyonu yok, layout builder yok, mockup item drag/
resize/tilt editable yapma yok, mockup editor yok.

### Audit — en büyük kalan polish açığı

`MockupStudioStage.tsx:748-750` DOM ölçümü: preview Lens Blur
`plateStyle.filter = blur(${plateEffects.filterBlurPx}px)`
**plate element'ine** uygulanıyor → yalnız plate + içindeki
cascade bulanık, **stage dark padding alanı NET kalıyor**.
Phase 101-107 Sharp pipeline ise **tüm canvas'ı blur'luyordu**
(`sharp(canvasBuffer).blur(6)` — stage padding + plate chrome +
cascade hepsi bulanık) → Preview = Export Truth (§11.0) ihlali.
Operator için belirgin divergence (preview'da net dark padding +
bulanık plate, export'ta her şey bulanık). **En yüksek-impact
açık.**

İkincil: hoodie productType `resolveDeviceShape` Phase 106'da
`"garment"`'a düşürülüyordu → hood ellipse export'ta KAYIP.
Preview `TshirtSilhouetteSVG hooded` (svg-art.tsx:1095) omuz
üstünde `ellipse cx, shoulderY-h*0.04 rx=w*0.18 ry=h*0.08
#2A2622` çiziyor; export çizmiyordu.

### Fix 1 — Plate-only Lens Blur (Preview = Export Truth)

`frame-compositor.ts` Lens Blur bloğu (full-canvas → plate-only):
- (a) Full canvas `blur(6)` (preview ~8px CSS karşılığı)
- (b) Blur'lu canvas'tan **plate-area rounded-rect crop** —
  `plateLayout.{plateX,plateY,plateW,plateH,plateRadius}` SVG
  rect + Sharp `composite blend:"dest-in"` mask (plate border
  dahil; preview `plateStyle.filter` plate div'ine uygulanıyor)
- (c) Net (blur'suz) canvas'a plate-area blur'lu region'ı
  composite → **stage padding NET, plate region BULANIK**
  (preview ile birebir)

Pipeline sırası korundu: stage bg → composites → **(5) plate-
only blur** → (6) glass overlay (sharp kalır) → (7) PNG encode.
Lens Blur OFF path'i (`scene.lensBlur` false) hiç değişmedi
(Phase 105/106/107 clipart pixel-perfect korunur).

### Fix 2 — Hoodie hood ellipse delta (deviceShape granularity)

`FrameDeviceShape` enum'a `"garment-hooded"` eklendi (yeni big
abstraction değil — Phase 105 deviceShape chain pattern'inin
tek branch genişletmesi). 4-katmanlı chain tek satır branch:

| Katman | Değişiklik |
|---|---|
| `frame-compositor.ts` `FrameDeviceShape` | + `"garment-hooded"` |
| `frame-compositor.ts` `resolveDeviceShape` | `hoodie` → `"garment-hooded"` (tshirt/dtf → `"garment"` hood YOK) |
| `frame-compositor.ts` garment branch | koşul `garment \|\| garment-hooded`; `isHooded` flag → hood ellipse SVG (svg-art.tsx:1095 parity: path #2A2622 → hood ellipse #2A2622 → neckline #161412 katman sırası) |
| `MockupStudioShell.tsx` inline deviceShape map | `hoodie` → `"garment-hooded"` |
| `route.ts` `DeviceShapeSchema` | enum + `"garment-hooded"` |

### Browser proof (gerçek dev server, clean restart)

`.next` clear + fresh `preview_start` (hot reload'a güvenilmedi).
Test set `cmov0ia370019149ljyu7divh` (4-item clipart, real MinIO
MJ assets PAS5/Pinterest).

**Lens Blur — plate-only pixel kanıtı** (high-freq energy =
mean abs diff of horizontal neighbors, S=90 patch):

| Patch | Blur ON (ha2uhrd6) | Blur OFF (wtfhnid2) | Yorum |
|---|---|---|---|
| cornerTL (stage padding) | 0 | 0 | **birebir aynı** — blur padding'e dokunmuyor ✓ |
| cornerBL | 0.013 | 0.013 | aynı ✓ |
| plateInterior | 0.019 | 0.019 | plate gradient smooth, fark yok |
| **plateCenter** (cascade) | **1.028** | **2.731** | blur ON cascade'i **%62 yumuşatmış**; OFF keskin ✓ |

Preview screenshot: plate (cream + 3 cascade) bulanık, **stage
dark padding TAM NET** (keskin sınırlı çerçeve). Banner
"PREVIEW CHANGED RE-EXPORT?" (Phase 99 stale indicator §12
uyumu). Lens Blur OFF preview `plateFilter: "none"` (parity
diğer yön de doğru).

**Clipart regresyon**: blur OFF export **721091 bytes** —
Phase 105/106/107 pixel-perfect baseline (721091 bytes) **3
turdur korundu, hiçbir regresyon yok** (plate-only değişikliği
blur OFF path'ini hiç etkilemedi).

**Hoodie hood ellipse — pixel kanıtı** (temporary test harness:
4 design clipart→hoodie patch, test, **revert edildi** — Phase
12 pattern, production drift=0, `reverted:4 allClipart:true`
doğrulandı):

| Patch | Dark fraction (luma<70) | Yorum |
|---|---|---|
| **hoodBand** (omuz üstü, hood region) | **0.9764** | %97.6 koyu → hood ellipse #2A2622 mevcut ✓ |
| bodyBand (gövde/göğüs) | 0.5733 | garment body + chest asset (normal) |
| **plateLightControl** (plate cream bg) | **0** | %0 koyu → kontrol noktası doğru (hood'suz olsa cream olurdu) |

Preview screenshot (hoodie deviceKind): 3 garment silüeti,
**her birinin omuzlarının üstünde belirgin koyu hood ellipse**
(kapüşon şekli). Export hoodBand %97.6 koyu → `garment-hooded`
parity export'ta birebir.

**Product MockupsTab + Etsy continuity** (Phase 108 dokunmadı,
re-verify): `/products/cmor0wkjt...` Mockups tab → 10 frame-
export tile, `tileHostAspectRatio: "4 / 3"`, `tileHostBg:
rgb(22,19,15)` (bg-ink), `tileImgObjectFit: "contain"`,
naturalWH 1920×1080 — Phase 101 baseline intakt. Etsy submit
pipeline (`image-upload.service.ts` line 95/146/162) kod-level
kind-agnostic (orderForUpload packPosition ASC + storage.
download(outputKey) + entryId narrow) — frame-export entry'leri
Phase 100 discriminated union backward-compat ile akıyor.

### Quality gates

- `tsc --noEmit`: clean
- `vitest tests/unit/{mockup,selection,selections,products,
  listings}`: **730/730 PASS** (zero regression)
- `next build`: ✓ Compiled successfully

### Değişmeyenler (Phase 108)

- **Review freeze (Madde Z) korunur.**
- **Schema migration yok.** `FrameDeviceShape` TypeScript
  union + Zod enum genişletme; runtime DB schema dokunulmadı.
  Temporary test harness (productTypeId clipart→hoodie→clipart)
  yalnız runtime verification; revert edildi, production
  drift=0.
- **WorkflowRun eklenmez.**
- **Yeni big abstraction yok.** Yalnız `frame-compositor.ts`
  Lens Blur bloğu (full→plate-only) + `FrameDeviceShape` tek
  union member + `resolveDeviceShape` hoodie branch + garment
  branch hood ellipse delta + Shell inline map + route enum.
  Yeni helper/service/component/endpoint yok. Phase 103
  compose order (chrome'lu tile bir bütün rotate) + Phase 104
  sticker + Phase 105 frame + Phase 106 bookmark/garment +
  Phase 107 bezel detay baseline'ları intakt.
- **Yeni SVG varyasyonu YOK** (kullanıcı kısıtı). **Layout
  builder YOK** (kullanıcı kısıtı). **Mockup item editable
  YOK** (kullanıcı kısıtı). Bunlar future direction'da
  ertelenmiş kalır (§13.A layout builder, yeni SVG varyasyon).
- **3. taraf mockup API path** ana akışa girmedi.
- **Mockup mode render dispatch (POST /api/mockup/jobs)
  dokunulmadı** — Phase 8 baseline ayrı compositor.
- **Studio shell, slot-ring/badge editing chrome, Phase 94
  editing/final split, Phase 101 plate chrome + tile aspect,
  Phase 103 compose order** hepsi intakt (clipart regresyon
  pixel-perfect 721091 bytes doğrulandı).
- **References / Batch / Review / Selection / Mockup Studio /
  Product / Etsy Draft canonical akışları intakt.**
- **Phase 100 persistence + handoff + Listing discriminated
  union backward-compat tam** (continuity re-verify).
- **Kivasy v4 tokens + Studio `--ks-*` namespace bozulmadı.**

### Bug ledger update

Düzeltilen parity bug'ları (Phase 108):
- **Lens Blur export'ta full-canvas idi (preview plate-only)**
  — Phase 101-107 baseline `sharp(canvasBuffer).blur(6)` tüm
  canvas'ı blur'luyordu; preview `plateStyle.filter` yalnız
  plate'e uyguluyordu. Phase 108 plate-area rounded-rect mask
  ile blur'lu region'ı net canvas'a composite → stage padding
  NET, plate region BULANIK (Preview = Export Truth §11.0).
- **hoodie export hood ellipse'i yoktu** — `resolveDeviceShape`
  Phase 106'da hoodie'yi `"garment"`'a düşürüyordu (hood YOK).
  Phase 108 `"garment-hooded"` granularity + garment branch
  hood ellipse delta (svg-art.tsx:1095 parity).

Hâlâ açık (Phase 109+ candidate):
- **Drop shadow softness fine-tune** (Phase 103/107'ten devir)
  — libvips feDropShadow 2-katmanlı; preview 4-katmanlı.
  Ana visual impact Phase 101-108'de yakalandı; yumuşaklık
  ince fark.
- **Gerçek Etsy V3 API POST e2e** — final submit Etsy API key
  + OAuth token (production credential; dev'de yok).
  Continuity DB+kod kanıtlandı (Phase 107-108); gerçek Etsy
  POST açıkça scope dışı.
- **Yeni SVG varyasyonları + layout builder** — kullanıcı
  kararıyla **future direction'da ertelenmiş** (§13.A; bu turun
  scope'unda DEĞİL). Frame mode export pipeline (§13.C Phase 99
  fulfilled) + productType shape parity (Phase 101-108
  fulfilled) tamamlandıktan sonra yeni varyasyon/layout builder
  ayrı tur olarak değerlendirilir.

### Bundan sonra en doğru sonraki adım

Phase 108 ile Mockup Studio çekirdeği üretim seviyesine yaklaştı:
- Studio'da gördüğüm ≈ indirdiğim PNG ≈ Product MockupsTab tile
- Plate (Phase 101) + item chrome (Phase 102) + tilt (Phase 103)
  + sticker white-edge (Phase 104) + wall_art frame+mat (Phase
  105) + bookmark/garment (Phase 106) + phone full bezel (Phase
  107) + **plate-only Lens Blur + hoodie hood** (Phase 108)
- Lens Blur preview = export (plate bulanık, padding net)
- Editing chrome (selection ring + badge) export'a girmez
- Temporary test harness bağımlılığı azaltıldı (clipart natural
  set ile Lens Blur + regresyon; hoodie tek geçici patch +
  zorunlu revert)

Sıradaki adım **Phase 109 candidate**: drop shadow softness
fine-tune (preview 4-katman libvips 2-katman) + gerçek Etsy V3
POST e2e (credential geldiğinde). Yeni SVG varyasyonları +
layout builder kullanıcı kararıyla **ertelenmiş** (§13.A) —
Frame mode export + productType shape parity tam olduğu için
ayrı bir genişleme turu olarak ele alınır.

---

## Phase 109 — Responsive viewport + Lens Blur targeting + shared capability (stabilization turu)

Phase 101-108 plate/item/tilt/white-edge/productType-shape
parity'yi kapadı. Phase 109 **feature turu DEĞİL —
stabilization/maintainability turu**: Mockup Studio çekirdeğini
responsive behavior + effects architecture + maintainability
açısından sağlamlaştır. Kullanıcı kısıtı: yeni SVG library yok,
layout builder yok, mockup editörü yok, Etsy gerçek POST
odaklanma yok, hoodie polish'e fazla enerji yok.

### Dürüst audit — en büyük kalan açık

Mevcut kod + Contract + gerçek browser:
- **Responsive viewport behavior YOK**: studio.css'te `@media`
  query yok, `matchMedia`/`resize` JS yok, **minimum viewport
  eşiği YOK**, **larger-screen state YOK**. Sidebar 214px + rail
  202px **fixed px**. Viewport <~600px → sidebar+rail sabit,
  stage squeeze → **broken studio** (operatör için bozuk yüzey).
- **Lens Blur targeting modeli ilkel**: `resolvePlateEffects`
  → `filterBlurPx = override.lensBlur ? 8 : 0` — monolitik (tek
  boolean, sabit 8px, target seçimi YOK, intensity YOK, plate'in
  TÜM child'ları + cascade items dahil blur). Future SVG-effect
  için shared capability model YOK (her effect ayrı if-else).

İki açık birden Contract §5'i (viewport) + §7'yi (effect
targeting) eksik bırakıyordu.

### Davranışsal ölçüm (Shots.so + MockupViews gerçek browser)

Shots.so canlı (Chrome, pencere 1316→900→600px):
- **1316px**: full editor (sol panel + center stage + sağ rail).
- **900px ve 600px**: editor **TAMAMEN GİZLİ** → intercept/
  promo splash ("Create Amazing Mockups"). Shots.so dar
  viewport'ta **broken editor göstermez — dürüst intercept
  screen** koyar. Eşik ~960px civarı.
- Shots STYLE satırı Glass Light/Dark var ama **ayrı "Lens
  Blur" tile YOK** — blur STYLE/Glass içinden. → Kivasy Lens
  Blur **Kivasy-özgü**; parity zorlaması yok.
- MockupViews: login wall/error — ölçülemedi (dürüst not;
  Shots.so kanıtı yeterli canonical referans).

### Net ürün kararları

1. **Responsive**: mevcut CSS `max-width:85%/max-height:82%` +
   `plateDimensionsFor` + `cascadeScale` viewport-aware
   ölçeklemeyi sağlıyor (≥1100px için yeterli) — korunur.
2. **Minimum viewport eşiği = 1100×640** (sidebar 214 + rail
   202 + min stage ~600 + padding). Altında studio shell
   render edilmez → sade "Mockup Studio needs a larger screen"
   intercept state (Shots.so canonical). Client `matchMedia`
   + Shell early return (yeni route/yüzey DEĞİL).
3. **Lens Blur**: structured `{ enabled, target, intensity }`
   (backward-compat boolean). `target` plate (default — items
   NET) / all (legacy); `intensity` soft/medium/strong →
   4/8/14px. Frame sidebar'da target+intensity seçim UI.
4. **Shared capability model**: tek `STUDIO_DEVICE_CAPABILITIES`
   map (deviceShape → supports*). Future SVG-specific feature
   FIELD eklenerek gelir — if-else patlaması yok.

### Implementation

| Dosya | Değişiklik |
|---|---|
| `frame-scene.ts` | `LensBlurConfig/Target/Intensity` type + `LENS_BLUR_PX` + `LENS_BLUR_DEFAULT` + `normalizeLensBlur` (backward-compat) + `resolvePlateEffects` structured (`filterBlurPx`+`blurTarget`) + `STUDIO_DEVICE_CAPABILITIES` map + `studioDeviceCapability` |
| `MockupStudioStage.tsx` | target-aware blur: "all" → plate div filter (legacy); "plate" → ayrı `k-studio__plate-surface` absolute layer (z-index 0) + blur, cascade (`k-studio__stage-inner` z-index 1) NET |
| `MockupStudioSidebar.tsx` | Lens Blur tile structured toggle (LENS_BLUR_DEFAULT) + target (Plate only/Plate+items) + intensity (Soft/Med/Strong) seçim UI |
| `MockupStudioShell.tsx` | `viewportTooSmall` matchMedia state + early return larger-screen intercept state; lensBlur snapshot tipi structured; file-level eslint-disable (Studio dark shell pattern) |
| `FrameExportResultBanner.tsx` | snapshot tipi structured; stale = enabled+target+intensity normalizeLensBlur ile |
| `route.ts` | `LensBlurConfigSchema` + `lensBlur: z.union([boolean, config])` |
| `frame-export.service.ts` | sceneSnapshot lensBlur JSON-safe structured serialize |
| `frame-compositor.ts` | `FrameLensBlurConfig` type + `FRAME_LENS_BLUR_SIGMA` (3/6/11) + `normalizeFrameLensBlur` + Phase 108 blur bloğu target-aware: "all" → Phase 108 davranış; "plate" → cascade-SİZ canvas blur + plate-mask + slotComposites blur'suz EN ÜSTE |

### Browser proof (fresh restart, viewport ölçümlü)

`.next` clear + fresh `preview_start` (hot reload'a güvenilmedi).
Test set `cmov0ia37` (4-item clipart, real MinIO PAS5/Pinterest).

**Lens Blur targeting**:
- Frame mode + Lens Blur on (1440×900): `lensControlsPresent:
  true`, `targetPlateActive: "true"` (default), `intensityMed
  Active: "true"`, `plateBlurTarget: "plate"`, `plateDivFilter:
  "none"` (cascade net), `plateSurfaceLayerPresent: true`.
  Screenshot: plate bg bulanık, **3 PAS5 cascade item TAMAMEN
  KESKİN** + sol panel BLUR TARGET / INTENSITY UI.
- target "all" → `plateDivFilter: "blur(8px)"`, surface yok
  (legacy davranış). target "all" + strong → `blur(14px)`.
  back plate + soft → `surfaceFilter: "blur(4px)"`. intensity
  4/8/14 + target plate/all hepsi doğru.
- **Export pixel kanıtı** (`q1ml4dti` target=plate + strong,
  1920×1080): cornerTL 0 (padding sharp), **plateBgTopMid
  0.023 (bulanık)**, **cascadeCenter 2.731 + leftItem 2.721
  (KESKİN — items blur ALMAMIŞ)**. ~119x fark. Preview =
  Export Truth §11.0 sağlandı; Phase 108 clipart baseline
  (cascadeCenter 2.731) ile aynı keskinlik.

**Responsive / larger-screen**:
- 1000px reload: `tooSmall: "true"`, `largerScreenPresent:
  true`, "Mockup Studio needs a larger screen". Screenshot:
  orange monitor icon + 1100×640 açıklama + "Back to selection"
  — bozuk sidebar/stage YOK (Shots.so canonical parity).
- 1440px reload: `tooSmall: null`, sidebar+stage var, full
  studio (responsive geçiş çift yönlü doğru).

**Continuity** (Phase 109 backend bozmadı): Product MockupsTab
`/products/cmor0wkjt...` → 10 frame-export tile, `tileHost
AspectRatio: "4 / 3"`, `tileHostBg: rgb(22,19,15)`, `tileImg
ObjectFit: "contain"`, naturalWH 1920×1080 — Phase 101 baseline
intakt. Etsy submit pipeline (`image-upload.service.ts`)
dokunulmadı (kind-agnostic outputKey; Phase 108 baseline).

### Quality gates

- `tsc --noEmit`: clean
- `vitest tests/unit/{mockup,selection,selections,products,
  listings}`: **730/730 PASS** (zero regression)
- `next build`: ✓ Compiled successfully

### Değişmeyenler (Phase 109)

- **Review freeze (Madde Z) korunur.**
- **Schema migration yok.** `sceneSnapshot` Prisma JSON column
  (esnek — structured config serialize, migration yok).
- **WorkflowRun eklenmez.**
- **Yeni big abstraction yok.** Structured Lens Blur =
  `SceneOverride.lensBlur` field genişletmesi (boolean →
  union) + `normalizeLensBlur` helper. Capability model = tek
  static map + tek accessor. Larger-screen = Shell koşullu dal
  (yeni route/component/yüzey YOK).
- **Yeni SVG library YOK, layout builder YOK, mockup editörü
  YOK, Etsy gerçek POST YOK** (kullanıcı kısıtı; §13.A future
  direction'da ertelenmiş kalır).
- **Backward-compat tam**: legacy `lensBlur: boolean true` →
  `{enabled,target:"all",intensity:"medium"}` (Phase 98-108
  export davranışı korunur); `undefined/false` → disabled.
- **Studio shell, canonical studio kararı, slot assignment,
  Phase 80 picker, Phase 79 real hydrate, Phase 101 plate
  chrome + tile aspect, Phase 103 compose order, Phase 104
  sticker, Phase 105 frame, Phase 106 bookmark/garment, Phase
  107 phone bezel, Phase 108 plate-only blur baseline** hepsi
  intakt.
- **References / Batch / Review / Selection / Mockup Studio /
  Product / Etsy Draft canonical akışları intakt.**
- **3. taraf mockup API path** ana akışa girmedi.
- **Kivasy v4 tokens + Studio `--ks-*` namespace bozulmadı.**

### Bug ledger update

Kapatılan açıklar (Phase 109):
- **Responsive viewport behavior yoktu** — dar viewport'ta
  broken studio (sidebar/rail fixed, stage squeeze). Phase 109
  matchMedia guard + 1100×640 eşiği + larger-screen intercept
  state (Shots.so canonical parity).
- **Lens Blur monolitik (boolean, 8px sabit, items dahil)** —
  Phase 109 structured `{enabled,target,intensity}` + target
  "plate" (items NET, default) / "all" (legacy) + intensity
  soft/medium/strong + Frame sidebar seçim UI. Preview =
  Export Truth (Sharp pipeline target-aware).
- **Future SVG-effect için shared capability yoktu** — Phase
  109 `STUDIO_DEVICE_CAPABILITIES` tek map (if-else patlaması
  yerine).

Hâlâ açık (Phase 110+ candidate):
- **Drop shadow softness fine-tune** (Phase 103/107/108'ten
  devir) — libvips feDropShadow 2-katmanlı; preview 4-katmanlı.
- **Future SVG-specific color/chrome variant** — capability
  map'te `supportsColorVariant`/`supportsChromeTone` field
  hazır (false); feature kullanıcı kararıyla ertelenmiş (§13
  / §7.6). Effect sistemi tasarımı hesaba kattı; açma ayrı tur.
- **Gerçek Etsy V3 API POST e2e** — credential gerektirir
  (production; dev'de yok). Continuity DB+kod kanıtlı (Phase
  107-109).
- **Yeni SVG varyasyonları + layout builder + mockup editörü**
  — kullanıcı kararıyla **future direction'da ertelenmiş**
  (§13.A; bu turun scope'unda DEĞİL).

### Bundan sonra en doğru sonraki adım

Phase 109 ile Mockup Studio çekirdeği responsive + effects
architecture + maintainability açısından sağlamlaştı:
- Dar viewport'ta dürüst larger-screen intercept (broken
  studio yok)
- Lens Blur structured target/intensity (items NET default,
  Preview = Export Truth)
- Shared capability model (future SVG readiness — if-else yok)
- Continuity (Product MockupsTab + Etsy) bozulmadı

Sıradaki adım **Phase 110 candidate**: drop shadow softness
fine-tune (preview 4-katman libvips 2-katman) veya — kullanıcı
kararı geldiğinde — capability map field'larıyla future SVG
color/chrome variant (effect sistemi hazır). Yeni SVG library
+ layout builder + mockup editörü §13.A'da ertelenmiş kalır.

---

## Phase 110 — Responsive scaling parity: aspect-locked plate + cascade-follows-plate + rail-collapse ara aşama (stabilization turu)

Phase 109 minimum-viewport/larger-screen baseline'ı (tek-aşamalı:
≥1100 full / <1100 intercept) eklemişti. Phase 110 **eşik öncesi**
responsive davranışı Shots.so'nun "browser zoom-out" hissine
yaklaştırır. Feature turu DEĞİL — `plateDimensionsFor` + cascadeScale
+ Phase 109 viewport guard'ın düzeltilmesi. Yeni feature / layout
builder / mockup editor / yeni SVG library YOK (kullanıcı kısıtı).

### Shots.so resize behavior (gerçek browser + DOM ölçümü)

Chrome'da Shots.so 16:9 sahne, browser pencere adım adım daraltıldı,
`.frame-background` (stage plate) DOM rect ölçüldü:

| Aşama | Viewport | Sol panel | Stage plate | Sağ rail | Aspect |
|---|---|---|---|---|---|
| Full | ≥~1200px | ✓ | %57.8 vw | ✓ | sabit 1.776 |
| Rail-collapse | ~764–1200px | ✓ | %65.7 vw (büyür) | **❌ gizli** | sabit 1.784 |
| Intercept | <~764px | — | landing splash | — | — |

Kanonik bulgular: **(1) aspect daima sabit** (1.776→1.784, 16:9
korunuyor — kompozisyon hiç bozulmuyor), **(2) plate viewport ile
orantılı küçülüyor** (mutlak 696→528 ama plate/vw %57.8→%65.7 —
plate viewport'tan yavaş küçülür, dar viewport'ta dominant kalır),
**(3) item plate ile %100 orantılı** (birlikte zoom-out hissi),
**(4) rail önce gizlenir** (~764-1200'de rail kapanır, stage o
alanı kazanır — eşik öncesi usability), **(5) sonra editor
intercept** (<~764px landing splash). Kullanıcı ek gözlemi
("belirli daraltma altında sağ panel kapatılmış oluyor") DOM
ile doğrulandı: @804px `hasLayoutPresets:false`, `hasZoom:false`,
`rightSideEls:[]` — rail tamamen yok, sol panel + stage var.

### Kivasy resize ölçümü + 3 kök neden

`preview_resize` ile Studio 16:9, farklı genişlik DOM rect:

| | Kivasy @1440 (Phase 109) | Kivasy @1180 (Phase 109) | Shots |
|---|---|---|---|
| plate aspect | **1.432** ✗ | **1.097** ✗ | 1.776-1.784 ✓ |
| cascade cssScale | 1.000 (sabit) | 1.000 (sabit) | orantılı |
| rail | 202px görünür | 202px görünür | <1200 gizli |

**Kök neden #1 (en kritik) — plate aspect bozuluyor:**
`plateStyle` inline `width:1080/height:608` (fixed px) + CSS
`.k-studio__stage-plate` **bağımsız** `max-width:85%` &
`max-height:82%`. İki ayrı % cap → biri (height) tetiklenince
diğeri (width) orantısal küçülmüyor → 16:9 plate aspect'i
1.778'den sapıyor (@1440 1.432, @1180 1.097, neredeyse kare).
Contract §3 (plate aspect-aware) ihlali; kullanıcının "browser
daralınca aspect sabit kalmıyor" şikayetinin kök nedeni.

**Kök neden #2 — cascade plate'i izlemiyor:** `cascadeScale =
Math.min((plateDims.w-32)/572, ...)` fixed px (1080×608) →
daima ~1.0. Plate küçülürken cascade fixed 572×504 + scale 1.0
kalıyor → plate + item birlikte zoom-out YOK (Phase 109'da da
tespit).

**Kök neden #3 — rail-collapse ara aşaması yok:** Kivasy @1180
rail hâlâ 202px (sidebar 214 + rail 202 = 416px sabit chrome,
stage'e sadece 764px). Shots <1200'de rail'i gizler. Kivasy
tek-aşamalı.

### Net ürün kararı + fix

1. **Aspect-locked viewport-aware plate scaling:** `plateDimensionsFor`
   artık `(mode, frameAspect, viewportW, viewportH, railCollapsed)`
   alır; available stage alanını viewport'tan hesaplar (sidebar 214
   + rail 0/202 + padding çıkarılır), **aspect-locked bbox-fit**
   (capW ≤ 1180, capH ≤ 880; hem capW hem capH'a sığ, aspect SABİT).
   CSS `.k-studio__stage-plate` `max-width:85%/max-height:82%`
   clamp **KALDIRILDI** (aspect bozan kaynak). Plate boyutu tamamen
   tek aspect-sabit JS hesabında.
2. **Cascade-follows-plate:** cascadeScale plateDims'i kullandığı
   için plateDims viewport-aware olunca otomatik düzeldi (@1440
   0.964 → @1180 0.907 → plate küçülünce cascade orantılı).
3. **3-aşamalı responsive (rail-collapse ara aşaması):** Shell
   `viewport {w,h}` state (resize listener) → `viewportTooSmall`
   (<880w veya <640h) + `railCollapsed` (<1280, not tooSmall).
   `≥1280` full, `880-1280` rail conditional-render gizli (stage
   genişler), `<880` larger-screen intercept (Phase 109 baseline,
   eşik 1100→880 indi). Phase 109 intercept metni `1100×640` →
   `880×640` güncellendi.

### Browser doğrulama (3 aşama + roundtrip + continuity)

`preview_resize` + DOM rect + screenshot:

| Viewport | plate aspect | cascade scale | rail | intercept | sonuç |
|---|---|---|---|---|---|
| 1440 | **1.780** ✓ | 0.964 | görünür | yok | full, 16:9 sabit |
| 1180 | **1.777** ✓ | 0.907 | **gizli** | yok | rail-collapse, stage 764→966px, plate %55→%73.6 vw |
| 820 | — | — | — | **var** | clean intercept (stage yok, "880×640" metni) |
| 1440 (roundtrip) | **1.780** ✓ | — | görünür | gone | full geri geldi (çift yönlü) |

Screenshot kanıtları: @1180 rail YOK + büyük 16:9 stage plate +
3 cascade orantılı (browser-zoom-out hissi); @820 sade orange
monitor icon + "needs a larger screen" + "880×640" + "Back to
selection" (bozuk studio değil — Shots.so canonical dürüst
intercept).

**Product/export continuity korundu:** Phase 110 yalnız studio
shell scaling (Shell viewport state + plateDimensionsFor + CSS
clamp kaldırma + rail conditional render). `frame-compositor.ts`
/ export persistence / handoff / Product MockupsTab **hiç
dokunulmadı**. Product detail Mockups tab DOM: 10 frame-export
tile, `aspect 4/3`, `bg rgb(22,19,15)`, `object-contain`,
naturalWH 1920×1080 — Phase 101-108 baseline intakt.

### Quality gates

- `tsc --noEmit`: clean
- `vitest tests/unit/{mockup,selection,selections,products,
  listings}`: **730/730 PASS** (zero regression)
- `next build`: ✓ Compiled successfully

### Değişmeyenler (Phase 110)

- **Review freeze (Madde Z) korunur.**
- **Schema migration yok.** Yalnız studio shell scaling +
  responsive 3-aşama.
- **WorkflowRun eklenmez.**
- **Yeni big abstraction yok.** `plateDimensionsFor` signature
  genişletme + Shell viewport state + rail conditional render +
  CSS clamp kaldırma. Yeni component / route / service / SVG
  library / layout builder / mockup editor YOK.
- **Stage continuity (§2) korunur** — stage merkez stable
  (Phase 93/95), mode-AGNOSTIC, slot click plate bg değiştirmez.
- **Aspect SHARED state (§4) korunur** — Mockup ↔ Frame aynı
  frameAspect.
- **Preview = Export Truth (§11.0) korunur** — responsive yalnız
  preview scaling; export pipeline (frame-compositor Phase 108
  baseline) dokunulmadı.
- **Phase 109 Lens Blur structured + shared capability + larger-
  screen guard baseline'ları intakt** (Phase 110 guard'ı
  matchMedia → innerWidth/innerHeight state'e çevirdi + 3-aşama
  ekledi; Lens Blur/capability dokunulmadı).
- **References / Batch / Review / Selection / Mockup Studio /
  Product / Etsy Draft canonical akışları intakt.**
- **3. taraf mockup API path** ana akışa girmedi.
- **Kivasy v4 tokens + Studio `--ks-*` namespace bozulmadı.**

### Bug ledger update

Kapatılan responsive bug'ları (Phase 110):
- **Plate aspect ratio sabit değildi** (16:9 @1440 1.432, @1180
  1.097) — fixed px inline w/h + CSS bağımsız max-w/max-h % iki
  ayrı cap. Phase 110 aspect-locked viewport-aware bbox-fit +
  CSS clamp kaldırma → aspect daima sabit (1.777-1.780).
- **Cascade plate ile beraber zoom-out olmuyordu** (cascadeScale
  fixed-px ~1.0) — Phase 110 plateDims viewport-aware olunca
  cascadeScale otomatik plate'i izler (0.964→0.907).
- **Rail-collapse ara aşaması yoktu** (Kivasy tek-aşamalı, @1180
  rail 202px sabit) — Phase 110 880-1280 rail conditional-render
  gizli, stage genişler (Shots.so canonical 3-aşama parity).

Hâlâ açık (Phase 111+ candidate):
- **Drop shadow softness fine-tune** (Phase 103/107/108'ten
  devir) — libvips feDropShadow 2-katmanlı; preview 4-katmanlı.
  Ana visual impact yakalandı; yumuşaklık ince fark.
- **Gerçek Etsy V3 API POST e2e** — production credential
  gerektirir. Continuity DB+kod kanıtlı (Phase 107-109).
- **Yeni SVG varyasyonları + layout builder + mockup editörü** —
  kullanıcı kararıyla §13.A future direction'da ertelenmiş.
- **Rail-collapse'ta rail content erişimi** — 880-1280'de rail
  gizli; rail'deki layout preset / zoom / export-capsule
  kontrolleri o aralıkta erişilemez (Shots'ta da rail gizli;
  Export toolbar'da kalır). Phase 111+ candidate: dar viewport'ta
  rail kontrollerini collapsible drawer/popover ile sunma
  (şimdilik Shots-parity: rail gizli, toolbar Export yeterli).

### Bundan sonra en doğru sonraki adım

Phase 110 ile responsive scaling Shots.so canonical seviyesinde:
- Plate aspect daima sabit (16:9 → 1.777-1.780 her viewport)
- Plate + cascade beraber browser-zoom-out (cascadeScale plate'i
  izler)
- 3-aşamalı responsive: full / rail-collapse / intercept (Shots
  parity)
- Çift-yönlü geçiş + Product/export continuity intakt

Sıradaki adım **Phase 111 candidate**: drop shadow softness
fine-tune veya rail-collapse'ta rail kontrol erişimi (collapsible
drawer). Yeni SVG/layout builder/mockup editor §13.A'da
ertelenmiş kalır.

---

## Phase 111 — Cascade composition group locking: plate-relative locked group (drift sıfır)

Phase 110 responsive scaling parity'yi (aspect-locked plate +
rail-collapse) bitirmişti. Phase 111 **cascade gibi mockup item
gruplarının plate'e bağlı tek locked composition** gibi
davranmasını sağlar. Stabilization turu — yeni feature / layout
builder / mockup editor / SVG library / manual drag-resize YOK
(kullanıcı kısıtı).

### Drift'in kök nedeni (browser+DOM+code triangulation)

Cascade aslında **zaten bir group transform** içinde (`stage-inner`
div + sabit local koordinatlar + `transform:scale`). Drift'in
gerçek kök nedeni iki katmanda:

1. **`cascadeScale = Math.min(innerW/572, innerH/504, 1.0)`** —
   tek-eksen fit + `Math.min(..., 1.0)` clamp + sabit 572×504
   referans. Plate aspect değişince group dar eksene fit; geniş
   eksende boşluk → group bbox/plate oranı dramatik kayar.
   Plate group'tan büyükse (1:1 plate 633: inner 601, 601/572=1.05)
   scale 1.0'da takılır → group plate'e küçük kalmaz.
2. **`centerCascade` 572×504 sabit canvas merkezli** — stage-inner
   572×504 aspect ≠ plate aspect → 572×504 box plate-center'da ama
   group bbox box içinde offsetli + rotation'lı item'larda görsel
   bbox ≠ layout bbox → center drift.

Browser+DOM kanıt (16:9, preview):

| | @1440 16:9 | @1180 16:9 | @1180 1:1 |
|---|---|---|---|
| grpW/plate (Phase 110) | %55.6 | %55.5 | **%84.1** ✗ |
| centerDy (Phase 110) | 6 | **14** ✗ | 6 |

Group plate'e KİLİTLİ DEĞİL (aspect değişince %55.5 → %84.1
dramatik kayma) + dikey drift (@1440 6 → @1180 14).

### Net ürün kararı

Cascade ve benzeri mockup item setleri **tek tek bağımsız obje
değil, plate'e bağlı tek locked composition group**. Responsive
scale + aspect değişimi sırasında: **(1) composition geometry
önce grup olarak korunur** (relative offsets sabit), **(2) sonra
plate'e fit edilir** (bbox plate `PLATE_FILL_FRAC` iç alanına
aspect-locked, clamp YOK), **(3) group center daima plate
center'da** (drift sıfır). Plate küçülürse group orantılı küçülür,
büyürse büyür, kompozisyon karakteri bozulmaz.

### Fix (composition-level transform)

`compositionGroup(items, plateW, plateH)` helper (eski
`compositionGroupScale`'in genişletilmişi):
- Cascade'in **gerçek bbox**'ını hesaplar (sabit 572×504 değil).
- `scale = min(plateW·FRAC/bboxW, plateH·FRAC/bboxH)`, FRAC=0.84;
  **clamp YOK** (plate büyürse scale > 1 → group orantılı).
- Items **0-origin normalize** (minX/minY çıkar — birbirlerine
  göre relative offset değişmez; bbox 0..bboxW × 0..bboxH).
- `stage-inner` artık **BBOX-TIGHT** (`width=bboxW, height=bboxH`,
  572×504 sabit değil) + `transformOrigin:center` + CSS plate-
  center → group center = plate center otomatik (drift sıfır,
  rotation simetrik dağılır).

MockupComposition + FrameComposition **birebir aynı** (Sözleşme
§2 stage continuity mode-AGNOSTIC).

**Preview = Export Truth (§11.0):** `frame-compositor.ts` aynı
mantık — slot positions gerçek bbox + `FRAME_PLATE_FILL_FRAC=0.84`
bbox-fit scale + `cascadeOffset = plateCenter − (bMin+bbox/2)·
scale` → final konum `plateCenter − bbox/2·scale + (slotX−bMin)·
scale` (preview 0-origin normalize + CSS plate-center ile **aynı
formül**).

### Browser + pixel doğrulama

Preview (16:9 @1180, aspect değişimi):

| Aspect | grpW/plate | centerDx | centerDy |
|---|---|---|---|
| 16:9 | **%86.0** | 8 | 8 |
| 1:1 | **%86.0** | 6 | 6 |
| 9:16 | **%86.0** | 3 | 3 |
| 16:9 (roundtrip) | **%86.0** | 8 | 8 |

grpW/plate **tüm aspect'lerde SABİT %86.0** (Phase 110'da %55.5→
%84.1 kayıyordu) — group plate'e LOCKED. Center dx≈dy simetrik
küçük (3-8px residual rotation görsel). 16:9→1:1→9:16→16:9
roundtrip birebir aynı (drift sıfır). @1440 16:9 centerDy
22→**9** (Phase 110 → Phase 111).

Export pixel kanıt (gerçek PNG `si9yox3o`, 1920×1080):
plate-region aspect 1.782 (16:9), cascade group/plate width
**%84.9** ↔ preview %86.0 (PLATE_FILL_FRAC=0.84 birebir), group
center offset dx:12/dy:13 ↔ preview dx:8/dy:8 (aynı simetri,
pixel-sampling toleransı). **Preview = Export Truth korundu.**

Screenshot: cascade 3-item group plate ortasında kilitli
kompozisyon (Front dik + Side -6° + Back -12° relative offset
korunmuş), group center plate center'da, %86 plate-locked.

### Quality gates

- `tsc --noEmit`: clean
- `vitest tests/unit/{mockup,selection,selections,products,
  listings}`: **730/730 PASS** (zero regression)
- `next build`: ✓ Compiled successfully

### Continuity korundu

Product MockupsTab: 10 frame-export tile, aspect 4/3, bg-ink,
object-contain, 1920×1080 — Phase 101-110 baseline intakt. Phase
111 yalnız composition group scale/anchor mantığı; handoff /
export persistence / tile render **dokunulmadı**.

### Değişmeyenler (Phase 111)

- **Review freeze (Madde Z) korunur.**
- **Schema migration yok.** Yalnız composition group transform.
- **WorkflowRun eklenmez.**
- **Yeni big abstraction yok.** `compositionGroup` helper (eski
  `compositionGroupScale` genişletilmişi) + bbox-tight stage-inner
  + compositor parity. Yeni component / route / service / SVG
  library / layout builder / mockup editor / manual drag-resize
  YOK.
- **Phase 110 responsive scaling baseline'ları intakt** (aspect-
  locked plate, 3-aşamalı viewport, rail-collapse; Phase 111
  cascade'i plate'e LOCK eder, plate scaling'i değiştirmez).
- **§2 stage continuity + §3 plate behavior + §8 layout count +
  §11.0 Preview=Export korundu.**
- **References / Batch / Review / Selection / Mockup Studio /
  Product / Etsy Draft canonical akışları intakt.**
- **Kivasy v4 tokens + Studio `--ks-*` namespace bozulmadı.**

### Bug ledger update

Kapatılan (Phase 111):
- **Cascade group plate'e kilitli değildi** — aspect değişince
  group bbox/plate oranı dramatik kayıyordu (16:9 %55.5 → 1:1
  %84.1). Phase 111: gerçek bbox + PLATE_FILL_FRAC bbox-fit
  (clamp YOK) → tüm aspect'te %86 sabit.
- **Group center plate center'a göre drift ediyordu** (16:9
  @1440 centerDy:22, @1180 dy:14 vs @1440 dy:6) — 572×504 sabit
  stage-inner ≠ plate aspect + rotation görsel. Phase 111:
  bbox-tight stage-inner + 0-origin normalize → CSS plate-center
  = group center (dx≈dy ~3-9px simetrik residual).
- **Plate büyürse group orantılı büyümüyordu** (`Math.min(...,
  1.0)` clamp) — Phase 111 clamp kaldırıldı.

Hâlâ açık (Phase 112+ candidate):
- **Drop shadow softness fine-tune** (Phase 103/107/108'ten
  devir) — libvips feDropShadow 2-katmanlı; preview 4-katmanlı.
- **Residual ~3-9px rotation görsel offset** — rotated item'ın
  görsel bbox'ı layout bbox'tan farklı (rotation köşeleri
  şişirir). Layout-bbox center plate-center'da; görsel-bbox
  küçük asimetri. Minimal, kabul edilebilir; tam görsel-bbox
  center için per-item rotated-AABB hesabı gerekir (Phase 112+,
  Preview=Export riski yüksek — şimdilik ertelendi).
- **Gerçek Etsy V3 API POST e2e** — production credential.
- **Yeni SVG/layout builder/mockup editor** — §13.A ertelenmiş.

### Bundan sonra en doğru sonraki adım

Phase 111 ile cascade plate-relative LOCKED composition:
- Group bbox/plate oranı tüm aspect/viewport'ta sabit (%86)
- Group center plate center'da (drift sıfır, ~3-9px residual)
- Relative offsets korunur, plate küçülünce/büyüyünce group
  orantılı (browser-zoom-out hissi + kompozisyon karakteri
  bozulmaz)
- Preview = Export Truth (pixel kanıt %86 ↔ %84.9)

Sıradaki adım **Phase 112 candidate**: drop shadow softness
fine-tune veya residual rotation-AABB center (Preview=Export
riski değerlendirilerek). Yeni SVG/layout builder/mockup editor
§13.A'da ertelenmiş kalır.

---

## Phase 112 — Composition primitive resmîleştirme + dead capability map canlandırma (mimari sağlamlaştırma)

Phase 101-111 Mockup Studio çekirdeğini büyük ölçüde olgunlaştırdı.
Phase 112 **yalnız bug fix değil**: composition/device/effect
davranışını gelecekte genişleyebilecek ama bugünden de işe yarayan
genellenebilir bir temele oturtur. Stabilization turu — yeni
feature / layout builder / mockup editor / SVG library / dev
framework YOK (kullanıcı kısıtı).

### Dürüst audit + kullanıcı ürün yönü eleştirisi

**Layout-specific kalan:** `cascadeLayoutForRaw` 5 grup hardcoded
array (`switch(kind)`). **Kabul edilebilir** — her shape geometrisi
gerçekten farklı (telefon 416h, sticker kare, bookmark dar); layout
*registry*, hack değil. Yeni shape = tek case.

**Genellenebilir hale gelmiş:** `compositionGroup` (Phase 111) —
cascade'e özel değil, generic `{x,y,w,h}[]` primitive. MockupComp
+ FrameComp + frame-compositor aynı mantık.

**En kritik gerçek açık:** `STUDIO_DEVICE_CAPABILITIES` +
`studioDeviceCapability()` **SIFIR TÜKETİCİ** (Phase 109'da kuruldu,
hiç okunmuyordu). Tam da kullanıcının korktuğu şey: "gelecekte
gerekebilir diye yazılmış, bugünden kopuk" dead future-only
abstraction.

**Kullanıcının "evrensel sistem" isteğine eleştiri (talep
edildi):** Kısmen katılmadım. Doğru tarafı: composition primitive
netleştirmek (Phase 111 `compositionGroup` zaten yaptı). **Riskli
tarafı:** yeni "composition engine / layout strategy interface"
şu an **erken abstraction** — kanıt: capability map zaten sıfır
tüketiciyle yazılmış, daha fazla soyutlama aynı dead-code hatasını
büyütür. `cascadeLayoutForRaw` switch 5 case ile **şu an doğru**;
pluggable layout registry bugünkü 1 layout-family ihtiyacından
kopuk. **Daha sade/doğru karar:** yeni framework KURMA; (1)
`compositionGroup`'u canonical primitive olarak Contract'ta
resmileştir, (2) dead capability'yi **fiilen tüketime bağla**.

### Net mimari karar + uygulanan slice

| Kavram | Statü | Karar |
|---|---|---|
| `compositionGroup` | Generic primitive (Phase 111) | Contract §2'de canonical resmileştir (first client = cascade; primitive = reusable). Refactor değil, netleştirme. |
| `cascadeLayoutForRaw` switch | Per-shape registry | Kabul — yeni shape = yeni case. Strategy interface ertelendi (erken abstraction). |
| `STUDIO_DEVICE_CAPABILITIES` | **Dead (0 tüketici)** | **Fiilen tüketime bağla** — Lens Blur targeting UI capability okur. |
| Composition engine / layout strategy iface | — | **AÇILMAZ** (erken abstraction, dead-code dersi). |

Uygulanan (davranış değişmeden):
- `frame-scene.ts` yeni `deviceKindToShape(deviceKind)` client-safe
  resolver — `resolveDeviceShape` (frame-compositor server-side)
  ile birebir aynı mapping (build-boundary tekrarı bilinçli;
  Phase 105 emsali). Tek client-side kaynak.
- Sidebar `deviceKind` prop tanımlandı (Shell zaten geçiriyordu
  ama prop tanımsızdı → ignore ediliyordu) + FrameBody'ye iletildi.
- FrameBody Lens Blur targeting controls render guard'ına
  `studioDeviceCapability(deviceKindToShape(deviceKind))
  .supportsLensBlurTargeting` eklendi → dead capability **canlı
  tüketiliyor**; tüm shape `true` → davranış birebir aynı.

### Browser + pixel doğrulama (davranış değişmedi)

Preview (16:9 @1180, baseline = Phase 111):

| Metrik | Phase 111 baseline | Phase 112 | Sonuç |
|---|---|---|---|
| 16:9 cascadeScale | 1.404 | 1.404 | birebir |
| 16:9 grpW/plate | %86.0 | %86.0 | birebir |
| 16:9 centerDx/Dy | 8/8 | 8/8 | birebir |
| 1:1 grpW/plate | %86.0 | %86.0 | birebir (locked korundu) |
| lensTargetingVisible | — | **true** | capability gate çalışıyor (clipart→sticker, supportsLensBlurTargeting:true) |

Export pixel kanıt (gerçek PNG `m0j9s7w5` 1920×1080): plate aspect
1.782, group/plate %84.9, center dx:12/dy:13 — **Phase 111 export
ile birebir** (frame-compositor dokunulmadı). Preview=Export Truth
korundu. Product MockupsTab: 10 frame-export tile, aspect 4/3,
bg-ink, contain, 1920×1080 — Phase 101-111 baseline intakt.

### Quality gates

- `tsc --noEmit`: clean
- `vitest tests/unit/{mockup,selection,selections,products,
  listings}`: **730/730 PASS** (zero regression)
- `next build`: ✓ Compiled successfully

### Değişmeyenler (Phase 112)

- **Review freeze (Madde Z) korunur.**
- **Schema migration yok.** Yalnız client capability tüketim +
  prop tanımı.
- **WorkflowRun eklenmez.**
- **Yeni big abstraction yok.** `deviceKindToShape` küçük
  client-safe resolver (resolveDeviceShape mirror, build-boundary).
  Yeni component / route / service / composition engine / layout
  strategy interface / SVG library / layout builder / mockup
  editor YOK. Composition primitive yalnız Contract'ta
  resmileştirildi (kod zaten generic — Phase 111).
- **Davranış BİREBİR korundu** — composition geometry, scale,
  center, export pixel hepsi Phase 111 baseline ile aynı.
  Capability tüm shape `true` → Lens Blur targeting hâlâ görünür.
- **Phase 111 plate-relative locked group + Phase 110 responsive
  baseline'ları intakt.**
- **§2 stage continuity + §3 plate + §8 layout + §11.0
  Preview=Export korundu.**
- **References / Batch / Review / Selection / Mockup Studio /
  Product / Etsy Draft canonical akışları intakt.**
- **Kivasy v4 tokens + Studio `--ks-*` namespace bozulmadı.**

### Bug ledger update

Kapatılan (Phase 112):
- **`STUDIO_DEVICE_CAPABILITIES` dead-code (0 tüketici)** —
  Phase 109'da kuruldu ama hiç okunmuyordu (future-only
  abstraction). Phase 112: `deviceKindToShape` + Sidebar/FrameBody
  Lens Blur targeting capability-gated → fiilen tüketiliyor,
  davranış değişmeden (tüm shape true).
- **Sidebar `deviceKind` prop tanımsızdı** — Shell
  `deviceKind={deviceKind}` geçiriyordu ama prop interface'de
  yoktu (sessiz ignore). Phase 112: prop tanımlandı + FrameBody'ye
  iletildi.

Hâlâ açık (Phase 113+ candidate):
- **Drop shadow softness fine-tune** (Phase 103/107/108'ten
  devir) — libvips feDropShadow 2-katmanlı; preview 4-katmanlı.
- **Residual ~3-13px rotation görsel offset** (Phase 111'den
  devir) — rotated item görsel bbox ≠ layout bbox; minimal,
  Preview=Export riski yüksek per-item rotated-AABB ertelendi.
- **`supportsColorVariant`/`supportsChromeTone` future SVG**
  (phone color, garment color, chrome tone) — capability map
  field hazır, feature §13.A'da ertelenmiş (effect sistemi
  tasarımı hesaba kattı; bugün açılmaz).
- **Gerçek Etsy V3 API POST e2e** — production credential.
- **Yeni SVG/layout builder/mockup editor** — §13.A ertelenmiş.

### Bundan sonra en doğru sonraki adım

Phase 112 ile composition/device/effect sistemi genellenebilir
temele oturdu (minimal, dev framework değil):
- `compositionGroup` canonical primitive (cascade = first client)
- `cascadeLayoutForRaw` layout registry (yeni shape = tek case)
- `STUDIO_DEVICE_CAPABILITIES` fiilen tüketiliyor (dead → canlı)
- `deviceKindToShape` tek client-side shape kaynağı
- Preview = Export Truth + davranış birebir korundu

Erken abstraction (composition engine / layout strategy iface)
bilinçli ertelendi (Contract §2'ye yazıldı — Claude'un ileride
hem aşırı özel-case hem aşırı framework yazmasını engeller).

Sıradaki adım **Phase 113 candidate**: drop shadow softness
fine-tune veya residual rotation-AABB center (Preview=Export
riski değerlendirilerek). Yeni SVG/layout builder/mockup editor
§13.A'da ertelenmiş kalır.

---

## Phase 113 — Export slot identity bugfix + plate-local layered effects modeli

Phase 112 composition primitive'i resmileştirip dead capability'yi
canlandırmıştı. Phase 113 iki kritik açığı kapatır: (1) **export
slot assignment bug'ı** (Studio'da 3 farklı item, export'ta 3 slotta
da items[0]), (2) **plate-local layered effects** (glass/lens blur
item'ları etkiliyor + plate kenarında glow/inner-border/beyaz border
artifact). Stabilization turu — yeni feature/layout builder/mockup
editor/SVG library YOK (kullanıcı kısıtı).

### Bug #1 — Slot assignment / export identity (kök neden netleşti)

**Browser + network + pixel triangulation ile KESİN doğrulandı:**

Studio preview'da 3 slot DOĞRU 3 farklı item gösteriyor (slot 0/1/2
= Item 1/2/3 — `realSlots` position-sorted dizilim). Ama export
request body (`/api/frame/export`) yakalandığında, operator hiç
slot assignment yapmadığı durumda (`slotAssignmentCount: 0`,
varsayılan):

```
slot 0 → cmov0iacy… (Item 1)
slot 1 → cmov0iacy… (Item 1)  ← YANLIŞ (Item 2 olmalı)
slot 2 → cmov0iacy… (Item 1)  ← YANLIŞ (Item 3 olmalı)
distinctItemIds: ["cmov0iacy…"]  ← TEK item, 3 slot için
```

**Kök neden = frontend mapping** (`MockupStudioShell.tsx`
`handleExportFrame`). Zincir audit'i:
- Route (`/api/frame/export/route.ts`) DOĞRU — `slots[]` her biri
  `{slotIndex, assigned, itemId, …}` taşır.
- Service (`frame-export.service.ts`) DOĞRU — assignedItemIds
  toplar, `id IN assignedItemIds, selectionSetId` query, itemMap
  ile her slot için DOĞRU asset buffer fetch.
- **Frontend BOZUK**: `handleExportFrame` `itemId = override ??
  firstAssignedItemId` kullanıyordu. `override` = `slotAssignments[
  slotIdx]` (Phase 80 operator override; varsayılan `{}`).
  `firstAssignedItemId` = `items[0].id` (HEP ilk item). Operator
  override yokken → her 3 slot da `items[0]`. Preview'ın doğal
  slot→item dizilimi (`realSlots`) export payload'a hiç
  taşınmıyordu çünkü `StudioSlotMeta` itemId tutmuyordu.

### FIX 1 — Stable slot identity (küçük doğruluk katmanı)

- `StudioSlotMeta.design.itemId: string` field eklendi (canonical
  slot→item identity; `realSlots`'ta zaten var olan `sorted[i].id`
  buraya doldurulur). Yeni big abstraction değil — tek field.
- `handleExportFrame` fallback zinciri düzeltildi:
  `override ?? slotNaturalItemId ?? firstAssignedItemId`. Yani
  (1) operator override en güçlü, (2) slot'un DOĞAL item'ı
  (preview ne çiziyorsa), (3) global fallback son çare.
- **Sonuç (network kanıt)**: aynı durumda export body artık
  `slot 0 → Item 1, slot 1 → Item 2, slot 2 → Item 3`,
  `distinctCount: 3`. **Pixel kanıt**: exported PNG'de 3 slot 3
  farklı renk imzası (slot0 PAS5 kırmızı, slot1 mor şehir,
  slot2 mavi araba; distBC 105 — bug öncesi ~0). Görsel
  screenshot: exported PNG'de 3 görünür farklı item.

### Bug #2 — Plate-local effects (glass item'ları etkiliyor + glow/border)

Audit (preview DOM + export compose code):
- Preview `k-studio__plate-glass` **z-index 3** (cascade'in
  ÜSTÜNDE) + `backdrop-filter: blur(10px)` → glass overlay
  arkasındaki TÜM içeriği (plate bg + cascade items) bulanık.
  Item'lar effect'ten etkileniyordu (yanlış).
- Glass overlay `border: 1px solid borderTone` + `boxShadow:
  inset 0 1px 0 … , inset 0 -1px 0 …` → plate kenarında
  inner-border halo.
- `k-studio__stage-plate` box-shadow son satır `inset 0 1px 0
  rgba(255,255,255,0.08)` → plate üstünde subtle inner top-line.
- `k-studio__stage-plate` `border: 2px solid rgba(255,255,255,
  0.18)` → solid koyu bg (sceneMode solid #111009 / glass dark)
  seçilince beyaz border BELİRGİN pop ediyordu (kullanıcı notu —
  istenmiyor; ileride explicit frame-style parametresi).
- Export `frame-compositor.ts` aynı divergence: plate rect
  `stroke="rgba(255,255,255,0.18)"`, glass overlay rect `stroke`,
  ve **glass overlay cascade'in ÜSTÜNE** compose ediliyordu
  (preview ≠ export).

### FIX 2+3 — Plate-local layered effects modeli (3-layer)

**Net ürün kararı**: efekt sistemi 3-layer (Layer 1 plate base /
Layer 2 effect / Layer 3 item). Item layer effect-bağımsız;
itemler varsayılan blur/tint ALMAZ. Hem preview hem export bu
modeli birebir izler (§11.0).

Preview (`MockupStudioStage.tsx`):
- Glass overlay cascade'in **ÖNCESİNE** taşındı (DOM'da
  plate-surface'in hemen ardı), z-index **1** (cascade'in
  ALTINDA). `backdrop-filter` + inset border halo KALDIRILDI —
  glass artık `background: variant-tint` + z-index 1 (plate üstü
  surface treatment, item'a değil plate'e).
- Cascade host (`stage-inner`) `position: relative; z-index: 2`
  (MockupComposition + FrameComposition ikisinde) — effect'in
  ÜSTÜNDE, glass/blur item'ları etkilemez.
- `stage-plate` border `2px solid transparent` (layout-stable —
  box-sizing kayması yok), inset box-shadow top-line kaldırıldı.
  Plate stage'den **yalnız drop-shadow chain** ile ayrılır.

Export (`frame-compositor.ts`) compose sırası preview Layer
parity'sine yeniden yazıldı:
1. Layer 1 — stage bg + plate base (cascade YOK)
2. Layer 2a — glass overlay (plate üstüne, cascade'DEN ÖNCE,
   stroke YOK)
3. Layer 2b — lens blur (plate-area rounded mask; cascade hâlâ
   compose EDİLMEDİ → bg+glass blur, cascade ASLA blur değil)
4. Layer 3 — cascade slotComposites EN ÜSTE (glass+blur'dan
   ETKİLENMEZ)
5. Final PNG encode

`buildPlateLayerSvg` plate rect stroke KALDIRILDI;
`buildGlassOverlayPlateClippedSvg` stroke KALDIRILDI (preview
parity). Phase 113 — Lens Blur target "all" vs "plate" export'ta
artık aynı (ikisi de plate-area bg blur, item NET); "all" eski
"cascade dahil blur" semantiği layered model ile geçersiz,
backward-compat normalize korunur.

### Browser + DOM + pixel + export kanıtları

- **Glass Dark DOM**: `glassBorder: 0px` (border kaldırıldı),
  `glassBoxShadow: none` (inset halo kaldırıldı), `glassZIndex: 1`,
  `cascadeZIndex: 2`, `plateBorder: 2px solid rgba(0,0,0,0)`
  (transparent). Screenshot: glass dark plate'i koyulaştırıyor,
  3 cascade item NET (glass'tan etkilenmemiş), belirgin border YOK.
- **Lens Blur + Glass DOM**: `plateDivFilter: none`,
  `plateSurfaceFilter: blur(8px)` (z-index 0), `cascadeHostFilter:
  none` (z-index 2 — items NET).
- **Slot identity network**: export body `distinctCount: 3`
  (slot 0/1/2 → Item 1/2/3).
- **Slot identity pixel**: exported PNG slot renk imzaları
  farklı (distBC 105); görsel screenshot 3 farklı item.
- **Product MockupsTab continuity**: handoff sonrası "Frame
  Exports · 11 APPLIED", cover tile (★ Primary) Phase 113 yeni
  export = 3 FARKLI item, diğer tile'lar (önceki turlar) intakt,
  plate'lerde beyaz border YOK, item chrome korundu, "Send to
  Etsy as Draft" CTA mevcut.

### Quality gates

- `tsc --noEmit`: clean
- `vitest tests/unit/{mockup,selection,selections,products,
  listings}`: **730/730 PASS** (59 files; zero regression —
  `StudioSlotMeta.design.itemId` zorunlu field test fixture'larını
  etkilemedi)
- `next build`: ✓ Compiled successfully (exit 0)

### Değişmeyenler (Phase 113)

- **Review freeze (Madde Z) korunur.**
- **Schema migration yok.** `StudioSlotMeta` TypeScript interface
  field eklemesi (runtime DB schema dokunulmadı).
- **WorkflowRun eklenmez.**
- **Yeni big abstraction yok.** Slot identity = tek field +
  fallback zinciri düzeltmesi; layered effects = mevcut JSX/SVG
  yeniden sıralama (yeni component/service/route YOK).
- **Service tarafı dokunulmadı** (`frame-export.service.ts` zaten
  doğru slot→item resolve ediyordu; bug yalnız frontend
  payload'daydı).
- **Phase 101-112 baseline'ları intakt**: item chrome (rounded +
  white sticker edge + drop shadow + tilt), productType-specific
  shape (clipart/sticker/wall_art/phone/bookmark/garment),
  composition group locking, plate dimensions/aspect, persistence
  + handoff zinciri.
- **3. taraf mockup API path** ana akışa girmedi.
- **References / Batch / Review / Selection / Mockup Studio /
  Product / Etsy Draft canonical akışları intakt.**
- **Canonical studio kararı + studio shell bozulmadı.**
- **Kivasy v4 tokens + Studio `--ks-*` namespace bozulmadı.**

### FIX 4 — Plate "tüm plate'i saran outline/rim" kök neden (ters mühendislik)

Phase 113 ilk revizelerden sonra kullanıcı plate kenarında HÂLÂ
"tüm plate'i saran outline/border" gördü (glass dark'ta net). İlk
varsayımlar (box-shadow close-edge, scene tint, overflow:hidden
clip) **canlı browser DOM pixel ölçümü ile tek tek çürütüldü**.
Gerçek kök neden (DOM box ölçümüyle KANITLANDI):

- Studio plate `border: 2px solid transparent` + `box-sizing:
  border-box` taşıyordu (Phase 113'te "layout-stable" diye
  bırakılmış transparent border).
- Glass overlay (`.k-studio__plate-glass`) `position:absolute;
  inset:0` → glass plate'in **content/padding box**'ına oturur,
  yani 2px transparent border'ın İÇİNE. Ölçüm: glass box
  918×514, plate box 922×518 → her kenardan **tam 2px inset**.
- Plate çevresinde 2px açık cream bg HALKASI glass tarafından
  örtülmüyor; dark stage padding ile kontrast = plate'i saran
  "outline/rim" (glass dark'ta plate koyulaşınca daha belli).
- Export `buildGlassOverlayPlateClippedSvg` glass'ı plate ile
  BİREBİR aynı `plateX/Y/W/H + plateRadius`'ta çizer (2px inset
  YOK) → export'ta halka YOK. **Studio ≠ Export yapısal farkı.**

**Fix**: Studio plate `border: 2px solid transparent` →
`border: none` (export'ta plate border zaten hiç yok → Studio
export'a hizalandı). Border kalkınca `box-sizing` etkisiz; glass
`inset:0` plate'i BİREBİR kaplar (glass box = plate box,
inset 0/0/0/0 — DOM ölçümüyle doğrulandı). 2px halka kayboldu,
rim YOK. Önceki revizeler (transparent border + shadow tuning)
çözmüyordu çünkü kök neden border'ın **rengi** değil
**varlığıydı** (transparent bile glass inset halkası
üretiyordu). `frame-compositor.ts` dokunulmadı (export zaten
doğruydu); slot identity (FIX 1) korundu (export `distinctItems:
3`). §11.0'a "Studio ↔ Export plate render parity" canonical
unify ilkesi eklendi (gelecekte aynı sınıf yapısal divergence'ı
önlemek için).

### Hâlâ açık (Phase 114+ candidate)

- **Plate frame-style / chrome parametresi**: Phase 113'te plate
  border kaldırıldı (kullanıcı notu). Operator-controlled
  frame-style (border / inner-shadow / chrome tone) ileride
  explicit bir efekt/parametre olarak gelecek (§13 future SVG
  readiness — capability map field eklenerek).
- **Plate/glass/effect render shared geometry/style sözleşmesi**
  (Studio CSS + export SVG tek kaynaktan türesin — §11.0
  unify ilkesi Phase 114+ candidate; erken-abstraction tuzağına
  düşmeden gerçek parity bug tekrarında değerlendirilir).
- **Drop shadow softness fine-tune** (Phase 103/107/108'ten
  devir) — libvips feDropShadow 2-3 katmanlı; preview 4-katmanlı.
- **Gerçek Etsy V3 API POST e2e** — production credential.
- **Yeni SVG/layout builder/mockup editor** — §13.A ertelenmiş.

### Bundan sonra en doğru sonraki adım

Phase 113 ile export slot identity (Preview = Export Truth artık
asset identity için de geçerli) + plate-local layered effects
(item layer effect-bağımsız) + glow/inner-border/plate-border
cleanup tamam. Sıradaki adım **Phase 114 candidate**: operator-
controlled plate frame-style parametresi (Phase 113'te kaldırılan
border'ın §13 future SVG readiness modeliyle explicit efekt
olarak geri gelmesi) veya drop shadow softness fine-tune. Yeni
SVG/layout builder/mockup editor §13.A'da ertelenmiş kalır.

---

## Phase 114 — Unified studio parameter + right rail productization (layout variant canonical, no-op canlandı)

Phase 101-113 parity/cleanup turlarıydı. Phase 114 odak değişti:
**unified parameter model + right rail productization + no-op/
dormant control activation**. Yeni feature/layout builder/mockup
editor/SVG library YOK (kullanıcı kısıtı).

### Dürüst audit (en pahalı bakım noktası)

| Sorun | Kanıt |
|---|---|
| **Dağınık parametre kaynağı** | Shell 8+ ayrı `useState`; Stage'e 13 prop, Rail'e 5 prop ayrı; `handleExportFrame` deviceShape mapping'i inline tekrar (Shell + frame-scene `deviceKindToShape` + frame-compositor `resolveDeviceShape` = 3 yer). |
| **Layout presets TAMAMEN no-op** | Rail 6 preset onClick `setActive(i)` LOCAL state (yalnız thumb highlight); `cascadeLayoutForRaw` tek hardcoded layout — preset variant hiç kullanılmıyor. Stage cascade + export DEĞİŞMİYOR. Right rail'in ANA vaadi ölü. |
| **Contract ↔ kod divergence** | Contract §6 "preset gerçek farklı kompozisyon olmalı" diyor; kod tek layout. Phase 95-97 "yapıldı" demiş ama gerçek farklı (Madde #12 sessiz drift). |

### Kullanıcı isteğinin eleştirisi

- **Doğru:** Dağınık parametreleri canonical kaynağa topla +
  no-op presets'i canlandır. Right rail "control surface" olmalı
  (Shots.so parity).
- **Aşırı abstraction riski:** "Her şeyi unified model yap" —
  tehlikeli (Phase 109 capability map dead-future-only örneği).
  Tüm state'leri `StudioParamStore`/reducer/context'e sokmak
  erken abstraction (bugün 1 consumer ailesi).
- **Sade/doğru yol:** Yeni framework YOK. `StudioLayoutVariant`
  canonical Shell state (en yüksek değerli no-op'u canlandır) +
  Shell `useState` + prop iletimi. Store/reducer DEĞİL.

### Net ürün/mimari kararı — 4 kategori ayrımı (kullanıcı yön ayarı)

Yanlış unify YASAK. Ayrım net (§11.0 + §6'ya canonical yazıldı):

1. **Canonical shared (final visual)**: layoutVariant,
   layoutCount, sceneOverride, frameAspect, slot itemId,
   deviceShape, activePalette → preview + export + rail TEK kaynak.
2. **Mode/UI-specific**: mode, appState, viewTab → AYRI kalır,
   potaya eritilmez.
3. **Shape/layout-specific impl**: `cascadeLayoutForRaw` per-
   productType base, `resolveDeviceShape` → registry içinde AYRI.
4. **Preview-only helper**: selectedSlot ring, slot badge →
   export'a GİRMEZ (Phase 94 korunur).

### Shots.so right rail audit (gerçek browser — Playwright)

Canlı DOM + screenshot (1440px + responsive):
- Right rail `panel-control` w:208 (Kivasy 202 ≈ birebir);
  yapı `layout-filters` (count) → `zoom-tilt-controls` (view
  tabs+zoom) → layout preset gallery (8 `layout-item`, dikey).
- Selected state `layout-item active` (Kivasy `aria-pressed` +
  active parity).
- Responsive: 1180px'te right panel GİZLİ (Kivasy Phase 110
  rail-collapse 1280 eşiği uyumlu).
- **Kritik fark:** Shots'ta layout-item seçimi stage'i değiştirir;
  Kivasy'de no-op. Kullanıcı haklı — yapı zaten çok yakın, eksik
  olan preset'in gerçek stage/export etkisi.

### Uygulanan slice (en yüksek etki — 1+2 birlikte)

- **`types.ts`**: `StudioLayoutVariant` (cascade/centered/tilted/
  stacked/fan/offset) + `STUDIO_LAYOUT_VARIANTS` +
  `STUDIO_LAYOUT_VARIANT_LABELS` (canonical, index parity).
- **`MockupStudioStage.tsx`**: `cascadeLayoutFor(kind, count,
  variant)` + yeni `applyLayoutVariant(base, variant)` — base
  slot boyutlarını korur (shape detail registry'de AYRI),
  dizilim/rotation/offset variant'a göre üretir (productType-
  agnostic). "cascade" = Phase 77-113 baseline (regression yok);
  5 yeni variant. MockupComposition + FrameComposition + Stage
  prop `layoutVariant`.
- **`MockupStudioShell.tsx`**: canonical `layoutVariant` state
  (mode-AGNOSTIC, default "cascade"). Stage + Rail'e iletilir;
  `handleExportFrame` `cascadeLayoutFor(kind, count, variant)`
  (export preview ile AYNI variant — Preview = Export Truth);
  `useCallback` deps + `data-layout-variant` attr.
- **`MockupStudioPresetRail.tsx`**: `LAYOUT_PRESETS` canonical
  türetme (string drift yok); preset onClick `setActive(i)` →
  `selectVariant(i)` → Shell setter (NO-OP CANLANDI). `active`
  Shell variant index'inden türer (fallback local legacy).
  `data-variant` attr.
- **`frame-compositor.ts`** (regression fix): Phase 114
  variant'lar (fan/stacked) geniş yayılım → rotated slot tile
  output canvas'tan büyük → Sharp `composite` "must have same
  dimensions or smaller" 500. **Tile-fits-canvas guard**: tile
  output'tan büyükse aspect-korumalı resize-down + position
  `[0, output-tile]` clamp (eski `Math.max(0,…)` sadece sol/üst
  taşmayı kesiyordu — eksikti; latent bug Phase 114 açığa
  çıkardı). Layout-variant'a özel hack DEĞİL — export pipeline
  robustness.

### Browser+DOM+export+pixel triangulation (gerçek asset)

Test set `cmov0ia37` (4 MinIO MJ asset, real):
- **Preview**: Cascade slots (358,330)/(722,383)/(1009,464);
  **Stacked** → (565,267)/(544,338)/(565,409) dikey;
  **Fan** → (317,292)/(684,288)/(983,309) geniş yatay. 3 variant
  3 FARKLI kompozisyon (no-op canlandı kanıt).
- **Rail**: 6 preset card `data-variant` doğru; seçili
  `aria-pressed=true`.
- **Mode-AGNOSTIC**: Mockup→Frame geçişinde Fan KORUNDU
  (`data-layout-variant=fan`).
- **Export**: Fan payload slots `r:-13/0/13` (simetrik fan açı;
  cascade olsaydı `0/-6/-12`) — preview Fan ile birebir; export
  200 (regression fix sonrası); exported PNG 1920×1080 pixel
  3 farklı bölge (L/C/R distinct) + görsel Fan dizilimi.
- **Continuity**: Product MockupsTab handoff/persistence
  baseline intakt (frame-compositor slot TÜKETİR, kendi layout
  üretmez).

### Quality gates

- `tsc --noEmit`: clean
- `vitest tests/unit/{mockup,selection,selections,products,
  listings}`: **730/730 PASS** (59 files, zero regression)
- `next build`: ✓ Compiled successfully

### Değişmeyenler (Phase 114)

- **Review freeze (Madde Z) korunur.**
- **Schema migration yok.** `StudioLayoutVariant` TypeScript;
  runtime DB schema dokunulmadı.
- **WorkflowRun eklenmez.**
- **Yeni big abstraction yok.** Canonical state = Shell `useState`
  + prop iletimi (store/reducer/context DEĞİL); `applyLayoutVariant`
  pure helper; preset list canonical türetme. Yeni layout builder
  / mockup editor / SVG library YOK.
- **4 kategori ayrımı korundu** — yanlış unify YOK (mode/UI-
  specific + shape impl + preview-only helper AYRI).
- **Preview = Export Truth korundu + genişletildi** (geometry +
  asset identity + layered effects + shared canonical parameter).
- **Phase 111 plate-relative locked composition** intakt
  (`applyLayoutVariant` ham layout üretir, `centerCascade` +
  `compositionGroup` plate-fit eder — fit/center DEĞİŞMEDİ).
- **Phase 113 layered effects + slot identity + plate border:none
  + Studio↔Export parity** intakt.
- **References / Batch / Review / Selection / Mockup Studio /
  Product / Etsy Draft canonical akışları intakt.**
- **3. taraf mockup API path** ana akışa girmedi.
- **Kivasy v4 tokens + Studio `--ks-*` namespace bozulmadı.**

### Hâlâ açık (Phase 115+ candidate)

- **View tabs (Zoom/Tilt/Precision) + Zoom slider** hâlâ no-op
  (kategori 4 — preview-only helper; Phase 114 layoutVariant'a
  öncelik verildi, bunlar düşük değerli). Phase 115+: Zoom slider
  preview scale'e bağlanabilir (Shots parity), ama Preview =
  Export riski değerlendirilmeli (zoom export'a girmemeli — UI
  helper).
- **Plate frame-style/chrome parametresi** (Phase 113'ten devir).
- **Drop shadow softness fine-tune** (Phase 103/107/108'ten devir).
- **Gerçek Etsy V3 API POST e2e** — production credential.
- **Yeni SVG/layout builder/mockup editor** — §13.A ertelenmiş.

### Bundan sonra en doğru sonraki adım

Phase 114 ile right rail "preset listesi"nden "layout control
surface"e dönüştü (Shots.so parity), unified canonical parameter
model kuruldu (4 kategori ayrımı net), no-op layout presets
canlandı (preview+export+rail tek kaynak, Preview = Export Truth
genişledi). Sıradaki adım **Phase 115 candidate**: View tabs +
Zoom slider activation (kategori 4 — Zoom preview-only scale,
export'a girmez) veya plate frame-style explicit parametresi
(Phase 113'ten devir, §13 future SVG readiness modeliyle).
Yeni SVG/layout builder/mockup editor §13.A'da ertelenmiş kalır.

---

## Phase 115 — Right rail = canlı layout preview surface (thumb-canonical: tek cascadeLayoutFor kaynağı, hardcoded MOCKUP_PRESETS kaldırıldı)

Phase 114 layoutVariant'ı canonical shared parameter yaptı (preview
cascade + export GERÇEKTEN değişir). Phase 115 odak: right rail'i
**statik preset listesinden gerçek canlı layout preview surface**'e
çevirmek + unified visual parameter modelini thumb seviyesinde
sağlamlaştırmak. Yeni feature/layout builder/mockup editor/SVG
library YOK (kullanıcı kısıtı).

### Dürüst audit (en pahalı bakım noktası + kullanıcı eleştirisi)

| Sorun | Kanıt |
|---|---|
| **Rail thumb canonical'dan KOPUK** | `PresetThumbMockup` (svg-art.tsx) `MOCKUP_PRESETS[idx].ph` (184×88 uzayında 6 sabit `{x,y,w,h,r,o}` config) kullanıyordu. Phase 114 layoutVariant canonical oldu (Stage cascade + export GERÇEKTEN değişir) AMA rail thumb HÂLÂ ayrı hardcoded geometriden render — operator için "rail canlı preview surface değil". Shots.so'da thumb = canlı SVG scene türevi; Kivasy kopuk (Madde #12 yapısal drift). |
| **Shared param ↔ candidate layout bağı yok** | Thumb scene-aware (palette/glass/blur — Phase 86/89/98) ama **geometri** hâlâ sabit; "candidate layout'u mevcut sahnemde göster" bağlantısı eksik. |
| **Tek canonical kaynak garantisi rail için ihlal** | §11.0 "preview + export tek `cascadeLayoutFor` kaynak" diyordu; rail thumb bu garantinin DIŞINDA kalıyordu. |

**Kullanıcının "unify everything" yönünün eleştirisi (talep
edildi)**: Doğru tarafı — rail thumb geometrisini canonical kaynağa
bağla (gerçek tüketici, dead-config değil). **Aşırı abstraction
riski** — "tüm thumb/preview/layout'u tek composition engine'e
soksun" tehlikeli (§7.6 capability map dead-future-only dersi).
Yeni "composition engine / layout strategy interface" şu an erken
abstraction (bugün 1 layout-family). **Daha sade/doğru yol**: yeni
framework KURMA; (1) mevcut cascade fonksiyonlarını paylaşılan
module'e taşı (refactor, yeni sistem değil), (2) thumb'ı o tek
kaynaktan besle. `compositionGroup` + `PLATE_FILL_FRAC` Stage'de
KALSIN (plate-relative locking = stage-specific, kategori 3 —
thumb'a girmez).

### Net mimari karar — 4-kategori ayrımı korundu

1. **Canonical shared (kategori 1)**: `cascadeLayoutFor` /
   `applyLayoutVariant` / `cascadeLayoutForRaw` / `centerCascade`
   → paylaşılan `cascade-layout.ts`. Stage + Shell/export + rail
   thumb ÜÇÜ DE buradan okur.
2. **Mode/UI-specific (kategori 2)**: mode/appState/viewTab — AYRI,
   dokunulmadı.
3. **Shape/layout impl (kategori 3)**: `cascadeLayoutForRaw`
   per-productType base + `compositionGroup`/`PLATE_FILL_FRAC`
   Stage-local — registry/stage'de KALDI.
4. **Preview-only helper (kategori 4)**: slot-ring/badge — export'a
   GİRMEZ (Phase 94 baseline korundu); thumb'a da girmez.

### Shots.so right rail derin araştırması (gerçek browser)

Shots.so canlı: layout-item thumb seçilince stage o variant'a geçer
+ thumb mevcut asset/scene'i yansıtıyor (statik değil); aspect/bg/
effect değişince thumb yeniden render. **Kivasy hedefi aynı**: yapı
Phase 96-114'te zaten yakındı (asset/scene/count-aware); eksik tek
şey **geometri canonical kaynak türevi olması**. Phase 115 bu son
kopukluğu kapadı.

### Uygulanan slice

- **`cascade-layout.ts` (yeni paylaşılan module)**: `CascadeItem`
  type + `centerCascade` + `cascadeLayoutFor(kind, count, variant)`
  + `applyLayoutVariant` + `cascadeLayoutForRaw`. Phase 114
  baseline'dan BİREBİR taşındı (davranış değişmedi). `compositionGroup`
  + `PLATE_FILL_FRAC` taşınmadı (Stage'de kaldı — kategori 3).
- **`MockupStudioStage.tsx`**: cascade fonksiyonları silindi,
  `cascadeLayoutFor` `./cascade-layout`'tan import.
- **`MockupStudioShell.tsx`**: `cascadeLayoutFor` import'u
  `./MockupStudioStage` → `./cascade-layout` (handleExportFrame
  aynı kaynak).
- **`svg-art.tsx` `PresetThumbMockup`**: `MOCKUP_PRESETS[idx].ph`
  → `cascadeLayoutFor(deviceShape, displayCount ?? 3,
  STUDIO_LAYOUT_VARIANTS[idx])`. Yeni `fitCascadeToThumb` helper:
  ~572×504 stage-inner koordinatları 184×88 viewBox'a aspect-locked
  bbox-fit normalize (Phase 111 composition-group parity: tek-eksen
  değil min scale → aspect korunur). z-order opacity derinlik
  korundu. `deviceShape` prop eklendi (StudioStageDeviceKind,
  default "phone"). `MOCKUP_PRESETS[idx].bg` bg fallback olarak
  kaldı (scene/palette yokken).
- **`MockupStudioPresetRail.tsx`**: `deviceShape` prop eklendi
  (Props + destructure + iki `<Thumb>` call site: live-thumb +
  preset cards).
- **`MockupStudioShell.tsx` PresetRail JSX**: `deviceShape={deviceKind}`
  (Shell zaten `stageDeviceForProductType(categoryId)` hesaplıyor;
  handleExportFrame + Stage ile AYNI `deviceKind`).
- **Circular import çözümü**: `cascade-layout.ts` `type
  StudioStageDeviceKind`'ı svg-art'tan TYPE-only import (runtime
  emit YOK); svg-art `cascadeLayoutFor`'u VALUE import. Type ↔
  value asimetrik → ES module döngüsü yok (tsc clean kanıt).

### Browser+DOM+export+pixel triangulation (gerçek asset)

Test set `cmov0ia37` (4 real MinIO MJ asset: PAS5 / neon city /
blue car), deviceKind `clipart` → shape `sticker`, viewport
1600×1000 (≥1280 full studio + rail; <880 Phase 110 intercept
"Mockup Studio needs a larger screen" CANLI doğrulandı).

**Cascade (default) — üç leg aynı kaynak:**
- Rail preset-0 thumb rects: `1.0 : 0.818 : 0.591` ratio =
  `cascadeLayoutForRaw('sticker')` base `[220,180,130]` BİREBİR.
- Stage cascade slot ratios `1.0 : 0.900 : 0.702` (Stage
  `compositionGroup` plate-fit ekler — kategori 3; ham slot
  dizilim + relative sizing AYNI kaynak).
- 6 rail preset card `data-variant` doğru, preset-0 `aria-pressed
  true`.

**Fan variant seçildi (preset-4 click) — definitive proof:**
| Leg | Slot rotations | Slot size ratio |
|---|---|---|
| Rail Fan thumb | `[-13, 0, 13]` | `1.0 : 0.818 : 0.591` |
| Stage cascade (Mockup) | `[-13, 0, 13]` (matrix 0.97437/±0.224951) | sticker base |
| Stage cascade (Frame, mode-AGNOSTIC) | `[-13, 0, 13]` | sticker base |
| Export payload `/api/frame/export` | `r:[-13,0,13]` w:`220,180,130` | `1.0:0.818:0.591` |

Üç leg ROTATION + SIZE RATIO **BİREBİR aynı** —
`applyLayoutVariant` fan formülü `r=d*13` → `[-13,0,13]`;
`cascadeLayoutForRaw('sticker')` base. `layoutVariant` export
body'sinde değil (beklenen — Shell çözümlenmiş slot pozisyonları
serialize eder; export TÜKETİR §11.0). Real PNG: 1920×1080,
1490.2 KB, `http://localhost:9000/etsyhub/u/.../frame-exports/
ak2rowit37mzkkskqj`, naturalW/H 1920×1080 (placeholder DEĞİL).
Phase 114 baseline (Fan `r:-13/0/13`) BİREBİR reprodüklendi —
fark: Phase 115'te rail thumb da AYNI kaynaktan (Phase 114
hardcoded idi).

**Her preset thumb kendi candidate variant'ını gösterir
(rail = canlı surface, statik DEĞİL):** cascade `[0,-6,-12]`,
centered `[0,0,0]`, tilted `[-7,0,7]`, stacked `[0,0,0]`, fan
`[-13,0,13]`, offset `[0,-4,-8]` — hepsi `applyLayoutVariant`
formülleriyle BİREBİR (Phase 114'te hepsi ayrı hardcoded
keyfi koordinattı). Console: **0 error**; React error YOK;
shell mounted; "Send to Product" handoff CTA present (Product
leg path intakt).

### Quality gates

- `tsc --noEmit`: clean (circular import yok — type↔value asimetri)
- `vitest tests/unit/{mockup,selection,selections,products,
  listings}`: **730/730 PASS** (59 files, zero regression)
- `next build`: ✓ Compiled successfully (Studio route 22.1 kB)
- Clean restart: `.next` silindi → fresh `preview_start` (port
  3000); Studio fresh build üzerinde doğrulandı (hot reload
  DEĞİL).

### Değişmeyenler (Phase 115)

- **Review freeze (Madde Z) korunur.**
- **Schema migration yok.**
- **WorkflowRun eklenmez.**
- **Yeni big abstraction yok.** Mevcut cascade fonksiyonları
  paylaşılan module'e TAŞINDI (refactor); davranış BİREBİR
  korundu (Phase 114 baseline). Yeni composition engine / layout
  strategy interface / store / reducer / layout builder / mockup
  editor / SVG library YOK.
- **4-kategori ayrımı korundu** — yanlış unify YOK (mode/UI-
  specific + shape impl + preview-only helper AYRI; `compositionGroup`
  Stage'de kaldı).
- **Phase 111 plate-relative locked composition** intakt
  (cascade-layout `centerCascade` üretir; Stage `compositionGroup`
  plate-fit eder — DEĞİŞMEDİ).
- **Phase 113 layered effects + slot identity + Studio↔Export
  parity** intakt.
- **Phase 114 layoutVariant canonical + Frame compositor
  tile-fits-canvas guard** intakt.
- **References / Batch / Review / Selection / Mockup Studio /
  Product / Etsy Draft canonical akışları intakt.**
- **3. taraf mockup API path** ana akışa girmedi.
- **Kivasy v4 tokens + Studio `--ks-*` namespace bozulmadı.**

### Hâlâ açık (Phase 116+ candidate)

- **View tabs (Zoom/Tilt/Precision) + Zoom slider** hâlâ no-op
  (kategori 4 preview-only helper). Phase 115 layout-canonical
  thumb'a öncelik verdi.
- **Plate frame-style/chrome parametresi** (Phase 113'ten devir).
- **Drop shadow softness fine-tune** (Phase 103/107/108'ten devir).
- **Gerçek Etsy V3 API POST e2e** — production credential.
- **Yeni SVG/layout builder/mockup editor** — §13.A ertelenmiş.

### Bundan sonra en doğru sonraki adım

Phase 115 ile right rail "statik preset listesi"nden "canlı layout
preview surface"e dönüştü — thumb geometri Stage + export ile AYNI
`cascadeLayoutFor` kaynağından türer (Preview = Export = Rail-thumb
yapısal garanti). Sıradaki adım **Phase 116 candidate**: View tabs +
Zoom slider activation (kategori 4 — Zoom preview-only, export'a
girmez) veya plate frame-style explicit parametresi. Yeni SVG/
layout builder/mockup editor §13.A'da ertelenmiş kalır.

---

## Phase 116 — Right rail thumb = orta panelin minyatür CANLI türevi (generic MockupPh → real StageDeviceSVG + real slots)

Phase 115 thumb GEOMETRİSİNİ canonical kaynağa bağladı
(`cascadeLayoutFor` slot pozisyon/rotation) ama thumb HÂLÂ generic
`MockupPh` çiziyordu — operator için "saçma ikonlar" hissi devam
ediyordu. Phase 116 odak: thumb'ı generic ikondan **orta panelin
gerçek sahnesinin (gerçek itemler + gerçek device shape + gerçek
asset) candidate-layout dizilmiş minyatür canlı türevine** çevirmek.
Yeni feature/layout builder/mockup editor/SVG library YOK (kullanıcı
kısıtı).

### Shots.so right rail araştırması

Preview tool localhost:3000'e sandboxed (shots.so'ya navigate
etmiyor — Phase 110/115 documented constraint). Shots.so right
rail davranışı **Phase 96-115 canlı-browser araştırmalarından
dökümante** (promo banner kapatılıp gerçek editor incelenmişti) +
Phase 116 WebSearch ile teyit. Canonical bulgu: Shots.so
layout-item thumb = kullanıcının **gerçek sahnesinin** minyatür
canlı önizlemesi (gerçek asset + gerçek device + gerçek bg);
thumb seçilince stage o variant'a geçer; aspect/bg/effect değişince
thumb yeniden render. Thumb içeriği = ana canvas ile AYNI sahne,
yalnız mini + candidate-layout dizilimli. Kivasy hedefi birebir
aynı.

### Dürüst audit (browser+code triangulation KANITI)

| | Stage slot 0 (Mockup, deviceKind=clipart) | Rail thumb 0 (Phase 115) |
|---|---|---|
| Render component | `StageDeviceSVG` (StickerCardSVG real die-cut 220×220) | `MockupPh` generic device-frame rects |
| Real asset `<image>` | **1** (`http://localhost:9000/etsyhub/midjourney/.../cmov06na`) | **0** |
| İçerik | Real sticker die-cut + real MJ asset | Generic palette-renkli rounded rects (13 rect, 0 image) |

Phase 115 doğru dizilim ürettiği için geometri canonical'dı, ama
**render-engine farkı** vardı: thumb generic phone-frame
dikdörtgenler (productType ne olursa olsun aynı), stage gerçek
device shape + gerçek asset. Operator'ın "saçma ikon" hissinin
kök nedeni tam buydu (Madde #12 yapısal drift — geometri
canonical'dı ama görsel içerik kopuk; §11.0 "rail-thumb tek
canonical kaynak" garantisi GÖRSEL olarak ihlaldi).

### Net ürün/mimari karar (4-kategori ayrımı korundu)

Right rail **statik preset listesi DEĞİL** — **current scene +
candidate layout türevi**. Operator bir thumb'a baktığında o anki
gerçek item identity + device shape + scene'in **candidate layout
ile nasıl görüneceğini** görür. **right rail = canlı mini
middle-panel previews.**

1. **Canonical shared (kategori 1)**: `slots` (real itemler +
   identity + `imageUrl`), `deviceShape`, `displayCount`,
   candidate `layoutVariant`, scene params → Shell → PresetRail →
   thumb (Stage'e geçen AYNI `slots` referansı).
2. **Mode/UI-specific (kategori 2)**: mode/appState/tab — AYRI,
   dokunulmadı.
3. **Shape/layout impl (kategori 3)**: `StageDeviceSVG` per-shape
   registry + `cascadeLayoutForRaw` base + `compositionGroup`/
   `PLATE_FILL_FRAC` Stage-local — registry/stage'de KALDI
   (thumb StageDeviceSVG'yi REUSE eder, kopyalamaz).
4. **Preview-only helper (kategori 4)**: slot-ring/badge thumb'a
   GİRMEZ (Phase 94 baseline; Stage'in StageDeviceSVG çağrısı
   zaten helper-free).

Yeni framework/composition engine/layout strategy interface
AÇILMADI (§7.6 dead-code dersi) — küçük yapısal slice: thumb'a
`slots` prop + render branch.

### Uygulanan slice

- **`svg-art.tsx` `PresetThumbMockup`**: opsiyonel `slots?:
  ReadonlyArray<StudioSlotMeta>` prop. Verildiğinde `phones.map`
  generic `MockupPh`/`MockupPhWithPalette` YERİNE her slot için
  nested `<svg x y width height viewBox> <StageDeviceSVG
  kind={deviceShape} design={slot.design} ...>` (device kendi
  koordinat uzayını korur) + `<g transform="rotate(r cx cy)">`
  (Stage CSS `rotate(${r}deg)` parity). `fitCascadeToThumb`
  artık `si` + `z` taşır → fitted slot ↔ real `slots[si].design`
  eşleme. `slots` verilmezse Phase 86 baseline `MockupPh`
  fallback (backward-compat, legacy consumer / set yok).
- **`MockupStudioPresetRail.tsx`**: `slots` prop (Props +
  destructure + iki `<Thumb>` call site: live-thumb + preset
  cards). `StudioSlotMeta` type import.
- **`MockupStudioShell.tsx`**: PresetRail JSX `slots={slots}`
  (Shell zaten `slots` Stage'e geçiriyor — AYNI referans →
  rail + stage tek kaynak).
- **Build-boundary**: `StageDeviceSVG` function-declaration
  (hoisted) — `PresetThumbMockup` textual olarak ondan önce
  ama runtime hoisting ile çağırabilir; circular import yok
  (aynı modül, svg-art.tsx).

### Browser+DOM+code+export triangulation (gerçek asset, fresh build)

Test set `cmov0ia37` (4 real MinIO MJ asset: PAS5 / neon city /
blue car), deviceKind `clipart`→shape `sticker`, viewport
1600×1000 (≥1280 full studio + rail).

**Generic-icon gap kapandı:**
| | Rail thumb-0 (Phase 116) | Stage slot 0 |
|---|---|---|
| Nested StageDeviceSVG | **6** (3 slot × StageDeviceSVG) | per-slot |
| Real asset `<image>` | **3** (Phase 115'te **0** idi) | 1 |
| Asset href | `http://localhost:9000/etsyhub/midjourney/.../cmov06na50016` | aynı |
| `sameAssetSource` | **true** ✓ | — |

**Her preset thumb kendi candidate variant + real scene:**
cascade `[0,-6,-12]` 3 img · centered `[0,0,0]` 3 img · tilted
`[-7,0,7]` 3 img · stacked `[0,0,0]` 3 img · fan `[-13,0,13]`
3 img · offset `[0,-4,-8]` 3 img. Hepsi `applyLayoutVariant`
formülleriyle BİREBİR + 3 real `<image>` (Phase 115'te generic
0-image idi).

**Export leg (Fan, mode-AGNOSTIC Mockup→Frame):** payload slots
`r:[-13,0,13]` w:`220,180,130` + 3 DISTINCT real itemId
(`cmov0iacy`/`cmov0iad0`/`cmov0iad2` — Phase 113 slot-identity
korundu, fanout DEĞİL). Real PNG 1920×1080, 1490.2 KB, MinIO
URL. Rail thumb (real StageDeviceSVG+asset+Fan) ≈ stage (aynı)
≈ export (Fan slot pozisyon + distinct real itemId) — §11.0
GÖRSEL seviyede holds.

**Continuity korundu:** Product `/products/cmor0wkjt...`
MockupsTab 11 frame-export tile, hepsi `aspect-[4/3] bg-ink`
naturalW/H 1920×1080 (Phase 100/101 baseline intakt), 0 React
error, 0 console error.

### Quality gates

- `tsc --noEmit`: clean
- `vitest tests/unit/{mockup,selection,selections,products,
  listings}`: **730/730 PASS** (59 files, zero regression)
- `next build`: ✓ Compiled successfully
- Clean restart: `.next` silindi + port 3000 kill → fresh
  `preview_start`; fresh build üzerinde browser-verified
  (hot reload DEĞİL).

### Değişmeyenler (Phase 116)

- **Review freeze (Madde Z) korunur.**
- **Schema migration yok.** `StudioSlotMeta` mevcut tip;
  yalnız thumb opsiyonel prop + render branch.
- **WorkflowRun eklenmez.**
- **Yeni big abstraction yok.** `StageDeviceSVG` REUSE (yeni
  shape/library/engine YOK); thumb'a tek `slots` prop + render
  branch. Backward-compat (slots yoksa Phase 86 MockupPh).
- **Phase 113 slot identity + layered effects** intakt (export
  payload 3 distinct itemId kanıtlandı).
- **Phase 115 cascade-layout.ts canonical geometri kaynağı**
  intakt (geometri değişmedi, yalnız render component değişti).
- **Phase 94 editing/final split** korundu (helper thumb'a
  girmez).
- **References / Batch / Review / Selection / Mockup Studio /
  Product / Etsy Draft canonical akışları intakt** (Product
  MockupsTab browser-verified).
- **3. taraf mockup API path** ana akışa girmedi.
- **Kivasy v4 tokens + Studio `--ks-*` namespace bozulmadı.**

### Hâlâ açık (Phase 117+ candidate)

- **Plate/scene chrome thumb'da minimal**: thumb StageDeviceSVG
  device shape + asset gösterir; plate bg + glass overlay + lens
  blur Phase 89/98 baseline'da `sceneBg` ile yaklaşık (full plate
  chrome parity değil — thumb 184×88 küçük, plate-context-siz
  layout odaklı). Tam plate chrome thumb'da Phase 117+ candidate
  (gerek görülürse; mevcut görsel parity operator için yeterli).
- **View tabs (Zoom/Tilt/Precision) + Zoom slider** hâlâ no-op
  (kategori 4 preview-only helper; Phase 115'ten devir).
- **Plate frame-style/chrome parametresi** (Phase 113'ten devir).
- **Drop shadow softness fine-tune** (Phase 103/107/108'ten
  devir).
- **Gerçek Etsy V3 API POST e2e** — production credential.
- **Yeni SVG/layout builder/mockup editor** — §13.A ertelenmiş.

### Bundan sonra en doğru sonraki adım

Phase 116 ile right rail "generic ikon listesi"nden "orta panelin
candidate-layout dizilmiş minyatür canlı türevleri"ne dönüştü —
thumb Stage ile AYNI `StageDeviceSVG` + AYNI real asset + AYNI
scene'den beslenir, tek fark candidate layout. Generic-ikon hissi
kapandı (browser kanıtı: her thumb 3 real `<image>`). Sıradaki
adım **Phase 116 follow-up**: device-shape chrome (white edge /
frame+mat / bezel / knot) thumb scale'de orantısız kalın → her
ölçekte aynı görsel aile (proportional chrome parity).

---

## Phase 116 follow-up — Proportional device chrome (border/sticker line/bezel her ölçekte aynı görsel aile)

Phase 116 thumb'ı `StageDeviceSVG` + real asset'e bağladı (generic
MockupPh kaldırıldı). Bu follow-up turda kullanıcı net bir kalan
parity açığı bildirdi: **"bazı border/sticker line kalınlıkları
farklı, bazı thumb'lar hâlâ ikonik/generic hissi veriyor; centered
gibi varyantlarda thumb ile orta panel görsel ayrışıyor"**.

### Kök neden (browser+DOM+code triangulation)

`StageDeviceSVG` device shape'lerinin **chrome sabitleri
fixed-pixel** idi (stage scale ~200-220px için tune edilmiş):
`StickerCardSVG pad=10`, `WallArtFrameSVG frameW=9 matW=14`,
`PhoneSVG bz=10 r=26`, `BookmarkStripSVG knotR=6 stroke=1.2` +
sticker inner outline `strokeWidth=1`. Phase 116 thumb device'ı
**fitted küçük `p.w`** ile çiziyor (nested `<svg width={p.w}
viewBox="0 0 ${p.w} ${p.h}">`). Sticker slot 2 stage'de zaten
w=130; thumb'da daha da küçük → `pad=10` o küçük device'ın
**%15-20'si** = "kalın generic çerçeve" hissi. Stage'de slot 0
(w=220) → pad %4.5; slot 2 (w=130) → pad %7.7 (zaten orantısız).
Browser DOM ölçümü: thumb sticker viewBox W=71 → eski pad=10
ratio 0.14 (stage'de 0.045). **Aynı device, ölçeğe göre farklı
çerçeve oranı = generic-ikon hissinin gerçek kök nedeni.**

### Net ürün/mimari kararı

Device chrome **fixed-pixel DEĞİL, `min(w,h)` oranlı** olmalı
(Contract §6 border/chrome parity: "right rail item çerçevesi /
white edge / sticker line orta panel ile aynı ailede olsun").
Her sabit, **stage-scale parity floor** ile bağıl formüle
çevrildi: stage scale'de eski değere ~BİREBİR eşit (sub-pixel
fark), thumb scale'de proportional. Bu **stage'i de iyileştirir**
(slot 2 gibi küçük device'lar artık orantılı chrome alır) —
ad-hoc thumb-only hack DEĞİL, tek tutarlı düzeltme. Stage/export
Preview = Export Truth riskini önlemek için her formül stage-scale
değerini koruyacak şekilde kalibre edildi (kanıt aşağıda).

### Uygulanan slice (`svg-art.tsx` device SVG chrome)

| Shape | Eski (fixed) | Phase 116 fu (proportional) | Stage-scale parity |
|---|---|---|---|
| StickerCardSVG `pad` | `10` | `max(1.5, min(w,h)×0.045)` | w=220 → 9.9 ≈ 10 ✓ |
| StickerCardSVG inner stroke | `1` | `max(0.75, min(w,h)×0.006)` | w=220 → 1.32 ≈ 1 ✓ |
| WallArtFrameSVG `frameW` | `9` | `max(1.5, min(w,h)×0.045)` | w=200 → 9 ✓ exact |
| WallArtFrameSVG `matW` | `14` | `max(2, min(w,h)×0.07)` | w=200 → 14 ✓ exact |
| PhoneSVG `bz` | `10` | `max(2, min(w,h)×0.049)` | w=204 → ~10 ✓ |
| PhoneSVG `r` | `26` | `max(4, min(w,h)×0.127)` | w=204 → ~25.9 ≈ 26 ✓ |
| BookmarkStripSVG `knotR` | `6` | `max(1.5, min(w,h)×0.067)` | w=90 → ~6 ✓ |
| BookmarkStripSVG knot stroke | `1.2` | `max(0.6, min(w,h)×0.013)` | w=90 → ~1.17 ≈ 1.2 ✓ |

`min(w,h)` bağıl seçildi (en dar eksen) → portrait/kare/dik tüm
device aspect'lerinde chrome dengeli. `Math.max(floor, …)` çok
küçük thumb slot'unda chrome'un sıfıra inip kaybolmasını önler.

### Browser+DOM+pixel kanıtı (fresh build, real asset)

Test set `cmov0ia37` (4 real MinIO MJ asset), clipart→sticker,
viewport 1600×1040, **temiz restart sonrası fresh build** (`.next`
silindi → `preview_start` reused:false → Studio route fresh
compile):

- **Thumb = real scene-derived (generic-ikon kapandı)**: rail
  preset-0 (cascade) `nestedSvg:6`, `imgEls:3`, href
  `http://localhost:9000/etsyhub/midjourney/.../cmo` (real MinIO).
  Stage slot 0 aynı asset source. Phase 116 öncesi thumb
  `imgEls:0` (generic MockupPh) idi → **artık 3 real `<image>`**.
- **6 preset thumb'ı her biri kendi candidate variant + 3 real
  img**: cascade `[0,-6,-12]`, centered `[0,0,0]`, tilted
  `[-7,0,7]`, stacked `[0,0,0]`, fan `[-13,0,13]`, offset
  `[0,-4,-8]` — hepsi `applyLayoutVariant` formülleriyle BİREBİR;
  her thumb 3 real MinIO `<image>`.
- **Border parity pixel ölçümü**: stage sticker slot 0 viewBox
  W=220, pad=9.9, **padRatio 0.045**; thumb sticker viewBox
  W=71.08, pad=3.20, **padRatio 0.045**. Stage 9.9 ≈ eski 10
  (0.1px, sub-pixel — **zero stage regression**); stage ratio ===
  thumb ratio === 0.045 → **aynı görsel aile her ölçekte**.
- **Rail → Shell → Stage unity**: rail preset-4 (fan) click →
  `shellLayoutVariant:"fan"`, stage cascade CSS rotate
  `[-13,0,13]`, fan thumb rotate `[-13,0,13]` + 3 real img +
  `pressed:true` — thumb candidate geometri = stage actual
  geometri (tek `cascadeLayoutFor` kaynağı).
- **Mode-AGNOSTIC**: Frame mode'a geçince `layoutVariant:"fan"`
  korundu; fan thumb hâlâ 3 real img + `[-13,0,13]`; Frame stage
  `.k-studio__stage-inner` 3 real `<image>`.
- **Export triangulation**: Frame export tetiklendi → request
  payload (fetch patch ile yakalandı) slot r `[-13,0,13]`, w
  `[220,180,130]`, **3 distinct real itemId** (Phase 113 slot-
  identity; fanout-to-items[0] DEĞİL). Exported PNG signed URL
  GET → `status:200 contentType:image/png bytes:1,525,957`
  (1.5MB gerçek render). `GET /api/frame/exports` → 200, yeni
  export `width:1920 height:1080 sizeBytes:1525957` persisted
  (FrameExport Prisma row — Phase 100 chain kırılmadı).
- **Product MockupsTab continuity**: `/products/cmor0wkjt...`
  Mockups tab → **11 frame-export tile**, `firstImgNatural
  1920x1080`, `objectFit:contain` (Phase 101 baseline) — Product
  detail/handoff/persistence tamamen dokunulmadı, çalışıyor.

Triangulation tablosu (fan variant, real asset):

| Surface | Layout signature | Real asset |
|---|---|---|
| Rail thumb (fan) | rot `[-13,0,13]` | 3 real MinIO `<image>` |
| Stage cascade (Mockup, fan) | rot `[-13,0,13]` | 3 real MinIO `<image>` |
| Stage cascade (Frame, fan) | mode-AGNOSTIC | 3 real `<image>` |
| Export payload | slot r `[-13,0,13]` w `[220,180,130]` 3 distinct itemId | 1.5MB real PNG |

### Quality gates

- `tsc --noEmit`: clean
- `vitest tests/unit/{mockup,selection,selections,products,
  listings}`: **730/730 PASS** (59 files, zero regression)
- `next build`: ✓ Compiled successfully (Dynamic-server-usage
  log satırları pre-existing auth-route prerender uyarısı —
  Phase 116 fu ile ilgisiz, build başarılı)
- Browser: fresh build üzerinde thumb 3 real img + 6 variant
  geometri + border ratio 0.045 stage=thumb + rail→stage→export
  fan unity + Product MockupsTab 11 tile

### Değişmeyenler (Phase 116 follow-up)

- **Review freeze (Madde Z) korunur.**
- **Schema migration yok.** Yalnız device SVG chrome sabitleri
  fixed → proportional (8 sabit, 4 device shape).
- **WorkflowRun eklenmez.**
- **Yeni big abstraction yok.** `MockupPh`/`MockupPhWithPalette`
  fallback korundu (slots yoksa legacy). Yeni layout builder /
  mockup editor / SVG library / framework YOK.
- **4-kategori ayrımı korundu** — chrome = shape-specific impl
  detail (kategori 3, registry/device SVG'de); thumb prop chain
  = canonical shared (kategori 1); selection ring/badge thumb'a
  girmez (kategori 4 — Phase 94 baseline).
- **Preview = Export Truth korundu + güçlendi** — chrome artık
  ölçek-bağımsız aynı oran (geometry + asset identity + layered
  effects + shared canonical parameter + **chrome ratio**).
- **Stage parity sub-pixel** — her formül stage-scale'de eski
  fixed değere ≈ eşit (kanıt: sticker pad 9.9≈10, frameW=9
  exact, matW=14 exact, bz≈10, r≈26).
- **Phase 113 slot identity + layered effects + Phase 114
  layoutVariant canonical + Phase 115 cascade-layout.ts shared
  source + Phase 116 StageDeviceSVG thumb** hepsi intakt.
- **References / Batch / Review / Selection / Mockup Studio /
  Product / Etsy Draft canonical akışları intakt.**
- **3. taraf mockup API path** ana akışa girmedi.
- **Kivasy v4 tokens + Studio `--ks-*` namespace bozulmadı.**

### Hâlâ açık (Phase 117+ candidate)

- **Plate/scene chrome thumb derinleştirme**: thumb device shape
  + asset + candidate layout doğru; plate bg + glass overlay +
  lens blur Phase 89/98 baseline'da `sceneBg` ile yaklaşık (full
  plate chrome parity değil — thumb 184×88 küçük, layout-odaklı).
  Gerek görülürse Phase 117+ (mevcut görsel parity operatör için
  yeterli).
- **View tabs (Zoom/Tilt/Precision) + Zoom slider** no-op
  (kategori 4 preview-only helper; Phase 115'ten devir).
- **Drop shadow softness fine-tune** (Phase 103/107/108'ten
  devir) — libvips feDropShadow 2-katmanlı; preview 4-katmanlı.
- **Gerçek Etsy V3 API POST e2e** — production credential.
- **Yeni SVG/layout builder/mockup editor** — §13.A ertelenmiş.

### Bundan sonra en doğru sonraki adım

Phase 116 + follow-up ile right rail tam "orta panelin
candidate-layout dizilmiş minyatür canlı türevi": real asset +
real device shape + proportional chrome (her ölçekte aynı görsel
aile) + candidate-variant geometri; Preview = Export = Rail-thumb
geometry + asset-identity + chrome-ratio seviyesinde holds.
Generic-ikon hissi tam kapandı (kanıt: stage padRatio 0.045 ===
thumb padRatio 0.045; her thumb 3 real `<image>`). Sıradaki adım
**Phase 116 fu2**: thumb hâlâ full-bleed bg (plate sınırı yok) →
Stage scene→plate→cascade-in-plate yapısının minyatürü
(mini-stage modeli).

---

## Phase 116 fu2 — Tek sahne çok ekran: thumb = orta panelin scene→plate→cascade-in-plate minyatürü (full-bleed bg → bounded plate + scene-padding)

Phase 116 + fu thumb'ı `StageDeviceSVG` + real asset + proportional
chrome'a bağladı. Bu fu2 turda kullanıcı net bir kalan ürün açığı
bildirdi: **"right rail hâlâ ayrı thumb sistemi gibi; thumb full-
bleed bg + cascade, Stage'de ise bounded plate (rounded surface +
shadow + scene-bg) + cascade plate'in içinde + plate etrafında
scene-padding var. İki ayrı görsel. İstediğim: tek sahne, çok
ekran — thumb = orta panel başka layout ile render edilseydi."**

### Kök neden (browser+DOM+code, iki screenshot yan yana)

Stage render = **6 katman**: `stage-scene` (dark + asset-aware
ambient tint) → `stage-amb` → `stage-floor` → `stage-plate`
(bounded rounded surface: `border-radius:26px`, `box-shadow:0
26px 51px rgba(0,0,0,.32)`, scene-aware bg `resolvePlateBackground`)
→ `plate-surface`/`plate-glass` → `MockupComposition` (cascade
plate'in İÇİNDE, `compositionGroup` PLATE_FILL_FRAC). Thumb ise
**tek `<rect 184×88 fill={sceneFill}>` full-bleed + cascade tüm
viewBox'a fit** → bg edge-to-edge, **plate sınırı YOK**, scene-
padding YOK. Aynı kaynak (cascadeLayoutFor + StageDeviceSVG +
real asset), **iki ayrı görsel render** — Madde #12 yapısal drift
(thumb = "ayrı thumb sistemi", Stage'in küçültülmüş hali değil).
`resolvePlateBackground` Stage-only idi (svg-art import edemezdi).

### Net ürün/mimari kararı

**Right rail thumb = orta panelin scene→plate→cascade-in-plate
yapısının minyatürü.** "Ayrı thumb sistemi / generic ikon / özel
thumb component" DEĞİL — **aynı renderer'ın küçük varyasyonu**.
Tek fark: ölçek + candidate `layoutVariant`. bg/plate/scene/
chrome AYNI canonical kaynak (§11.0 Preview = Export = Rail-thumb;
Contract §6 "right rail = canlı mini middle-panel previews").
Framework AÇILMADI — `resolvePlateBackground` paylaşılan module'e
taşındı + thumb 3-katmanlı render'a yapılandırıldı (küçük/orta
yapısal düzenleme, dev framework değil).

### Uygulanan slice

1. **`resolvePlateBackground` → `frame-scene.ts`** (canonical
   shared). Phase 91-115 boyunca `MockupStudioStage.tsx` lokaldi
   (Stage-only; svg-art circular import edemezdi: Stage zaten
   svg-art'tan `StageDeviceSVG` import ediyor). Paylaşılan
   `frame-scene.ts`'e taşındı — `resolveSceneStyle`/
   `resolvePlateEffects`/`resolvePresetThumbScene` ile aynı
   module. Stage local kopya silindi (tek tanım, sessiz drift
   §12 YASAK). Stage import edip tüketir (kanıt: line 27 +
   796).
2. **`PresetThumbMockup` 3-katmanlı mini-stage**:
   - **Layer 1 — scene backdrop**: `<rect 184×88 fill="#0C0B09">`
     (Stage dark stage-tone) + `palette[1] opacity 0.10` tint
     (Stage `stage-scene` asset-aware ambient parity).
   - **Layer 2 — bounded plate**: inset rounded `<rect>`
     (`THUMB_PLATE_FRAC=0.86` → plate stage'in ~%86'sı, etrafta
     scene-padding = Stage stage-padding parity); `rx =
     min(plateW,plateH)×0.075` (Stage `border-radius:26px`
     plate-oranı paritesi → thumb ~5.7px); scene-aware fill
     (`sceneFill` solid/gradient/glass; yoksa palette[0]→[1];
     yoksa Stage CSS fallback `#f5b27d→#d97842` BİREBİR);
     `<feDropShadow dy 2.4 blur 3.4>` (Stage plate box-shadow
     offset≪blur simetrik yumuşak parity).
   - **Layer 3 — cascade plate'in İÇİNDE**: `clipPath` plate
     rect'e; `fitCascadeToThumb` artık plate iç alanına
     (plate − inset) bbox-fit + plate merkezinde (Stage
     `compositionGroup` cascade-in-plate parity). Glass overlay
     da plate'e clip'li (Stage `.k-studio__plate-glass`
     plate-local parity, stage-wide DEĞİL).
   - Dead var temizlendi (`c`/`isGradient`/`bgFromPalette`/
     `ks-ptmg1*` — full-bleed preset-bg kalktı; `MOCKUP_PRESETS`
     hâlâ `PresetThumbFrame`'de). Generic `MockupPh` fallback
     korundu (slots yoksa legacy/no-set).
3. **Shared param doğrulama**: thumb `sceneBg`
   (`resolvePresetThumbScene`'den) + Stage `resolvePlateBackground`
   — ikisi de aynı `SceneOverride`+`palette` kaynağından
   (PresetRail/Shell), artık aynı `frame-scene.ts` module'ünde
   co-located sibling resolver. Ekstra prop EKLENMEDİ (redundancy
   + SVG↔CSS gradient format mismatch riski yok); param-level
   shared source yeterli.

### Browser+DOM triangulation (fresh build, real asset)

Test set `cmov0ia37` (4 real MinIO MJ asset), clipart→sticker,
viewport 1600×1040, **clean restart** (`.next` silindi →
`preview_start` reused:false → Studio fresh compile):

| | Scene backdrop | Bounded plate | Cascade-in-plate | Real img |
|---|---|---|---|---|
| **Stage** | ✓ `stage-scene` | ✓ `border-radius:26px` + `box-shadow 0 26px 51px rgba(0,0,0,.32)` | ✓ in plate | 3 |
| **Thumb 0 cascade** | ✓ `#0C0B09`+tint | ✓ inset `x12.88 y6.16 w158.2 h75.7 rx5.68` + drop-shadow | ✓ `clip-path` plate | 3 |
| Thumb 1-5 (centered/tilted/stacked/fan/offset) | ✓ | ✓ rx 5.7 | ✓ | 3 |

- **6 preset thumb HEPSI mini-stage** (scene + inset plate +
  cascade-clipped + 3 real img); tek fark candidate variant
  rotation: cascade `[0,-6,-12]`, centered `[0,0,0]`, tilted
  `[-7,0,7]`, stacked `[0,0,0]`, fan `[-13,0,13]`, offset
  `[0,-4,-8]` (= `applyLayoutVariant` formülleri BİREBİR).
- **Plate ratio parity**: Stage `border-radius:26px` (plate
  ~1000px → %2.6) ≈ thumb `rx 5.7` (plate 158px → %3.6) —
  proportional aynı aile.
- **Rail→Shell→Stage unity**: rail preset-4 (fan) click →
  `shellLayoutVariant:"fan"`; stage cascade CSS rotate
  `[-13,0,13]`; fan thumb `hasInsetPlate:true` + rot
  `[-13,0,13]` + 3 real img + `pressed:true`. Thumb candidate
  geometri = stage actual geometri (tek `cascadeLayoutFor`).
- **Mode-AGNOSTIC**: Frame mode'a geçince `layoutVariant:"fan"`
  korundu; fan thumb hâlâ mini-stage (`hasInsetPlate:true`,
  scene `#0C0B09`, 3 real img); stage plate present + 3 real img.
- **Product MockupsTab continuity**: `/products/cmor0wkjt...`
  Mockups tab → **11 frame-export tile**, `naturalWidth
  1920x1080`, `objectFit:contain` (Phase 101 baseline) — Product
  detail/handoff/persistence dokunulmadı.
- **Screenshot**: stage cream rounded plate + dark scene + 3
  real sticker (PAS5/neon/car) cascade; 6 rail thumb HEPSI
  AYNI cream plate + dark scene + 3 real sticker, farklı
  candidate layout. Generic-ikon hissi YOK — her thumb "orta
  panel bu layout'ta olsaydı" minyatürü.

### Quality gates

- `tsc --noEmit`: clean
- `vitest tests/unit/{mockup,selection,selections,products,
  listings}`: **730/730 PASS** (59 files, zero regression)
- `next build`: ✓ Compiled successfully

### Değişmeyenler (Phase 116 fu2)

- **Review freeze (Madde Z) korunur.**
- **Schema migration yok.** `resolvePlateBackground` module
  taşıması (tek tanım) + thumb render yapılandırması.
- **WorkflowRun eklenmez.**
- **Yeni big abstraction yok.** Yeni framework/layout builder/
  mockup editor/SVG library YOK. `resolvePlateBackground`
  paylaşılan resolver (zaten vardı, yer değişti — canonical
  co-location). Thumb 3-katman = Stage yapısının minyatürü
  (yeni sistem değil, aynı renderer paterni). Generic `MockupPh`
  fallback korundu.
- **4-kategori ayrımı korundu** — scene/plate/cascade =
  canonical shared (kategori 1); device shape = shape-specific
  impl (kategori 3, `StageDeviceSVG`/`cascadeLayoutForRaw`);
  selection ring/badge thumb'a GİRMEZ (kategori 4 — Phase 94);
  mode/appState unify edilmedi (kategori 2).
- **Preview = Export Truth korundu + güçlendi** — thumb artık
  Stage'in scene→plate→cascade yapısının minyatürü; geometry +
  asset identity + chrome-ratio + **plate/scene structure**
  aynı canonical kaynak.
- **Phase 113 slot identity + layered effects + Phase 114
  layoutVariant canonical + Phase 115 cascade-layout.ts +
  Phase 116/fu StageDeviceSVG+proportional chrome** hepsi
  intakt.
- **References / Batch / Review / Selection / Mockup Studio /
  Product / Etsy Draft canonical akışları intakt.**
- **3. taraf mockup API path** ana akışa girmedi.
- **Kivasy v4 tokens + Studio `--ks-*` namespace bozulmadı.**

### Hâlâ açık (Phase 117+ candidate)

- **Stage placement-floor + ambient-glow thumb'da yok**: thumb
  scene backdrop dark+tint ile Stage `stage-scene`'i yansıtır
  ama `stage-floor` (placement floor) + `stage-amb` (ambient
  glow radial) thumb'da render edilmez (184×88'de görsel
  katkısı minimal; gerek görülürse Phase 117+). Plate + scene-
  bg + cascade-in-plate ana yapısal parity sağlandı.
- **Lens Blur thumb'da basit**: thumb `feGaussianBlur 2.2`;
  Stage Phase 109 structured target (plate-only vs all). Thumb
  scale'de fark görsel olarak ihmal edilebilir.
- **View tabs (Zoom/Tilt/Precision) + Zoom slider** no-op
  (kategori 4 preview-only helper; Phase 115'ten devir).
- **Drop shadow softness fine-tune** (Phase 103/107/108'ten
  devir).
- **Gerçek Etsy V3 API POST e2e** — production credential.
- **Yeni SVG/layout builder/mockup editor** — §13.A ertelenmiş.

### Bundan sonra en doğru sonraki adım

Phase 116 + fu + fu2 ile right rail görsel olarak "tek sahne çok
ekran"a yaklaştı AMA hâlâ **iki ayrı render path** vardı (thumb
`PresetThumbMockup` AYRI SVG renderer, scene/plate'i SVG-rect ile
TAKLİT ediyordu; middle panel `MockupComposition` + CSS divs).
Sıradaki adım **Phase 117**: gerçek tek render path — thumb =
orta panelin AYNI `StageScene` component'i, scaled. "Benzetmeye
çalışan ikinci görsel sistem" tamamen kaldırıldı.

---

## Phase 117 — Single-renderer: thumb = orta panelin AYNI StageScene'i (scaled), ayrı SVG thumb renderer kaldırıldı

Phase 116 fu2 thumb'ı "Stage'in minyatürü gibi" yaptı ama hâlâ
**ayrı bir render path** idi: `PresetThumbMockup` (svg-art.tsx)
kendi `<svg viewBox="0 0 184 88">`'ini + `fitCascadeToThumb`
AYRI fit math'ini + SVG-`<rect>` ile yeniden çizilmiş scene/plate
chrome'unu kuruyordu; middle panel `MockupComposition` + CSS
plate/scene div'leri kullanıyordu. `cascadeLayoutFor`+
`StageDeviceSVG` ortaktı ama **composition/plate-fit math
(`compositionGroup` vs `fitCascadeToThumb`) + scene/plate chrome
(CSS divs vs SVG rects) AYRI — elle senkronlanan iki görsel
sistem**. Kullanıcı net: "benzetmeye çalışan ikinci renderer
istemiyorum; tek sahne, çok ekran — thumb = middle panel if
rendered in that layout, same renderer."

### Yanlış model → doğru model

- **Yanlış (Phase 116 fu2 dahil):** İki render path. Middle panel
  `MockupComposition` (React divs + CSS plate/scene +
  `compositionGroup` plate-fit). Thumb `PresetThumbMockup`
  (hand-built SVG + `fitCascadeToThumb` + SVG-rect scene/plate).
- **Doğru (Phase 117):** TEK render component, İKİ ölçek.
  `StageScene` = scene→amb→floor→plate→(plate-surface/glass)→
  `MockupComposition`/`FrameComposition` bloğunun TAMAMI. Stage
  büyük ekranda render eder (selected layoutVariant); rail thumb
  AYNI `StageScene`'i CSS `transform: scale()` ile küçültülmüş +
  küçük sabit plateDims + candidate layoutVariant ile render eder
  (`StageScenePreview`). **Ayrı SVG thumb renderer YOK.**

### Hangi render path'leri birleştirdim

- **`StageScene` component'i `MockupStudioStage.tsx`'ten extract
  edildi** (export): scene/amb/floor/plate/plate-surface/plate-
  glass + MockupComposition/FrameComposition. Scene/plate
  resolution (sceneTones/plateBgRaw/plateEffects/plateStyle/
  plateSurfaceStyle) StageScene İÇİNDE — Stage main fn'deki lokal
  duplicate KALDIRILDI (tek tanım, sessiz drift §12 YASAK).
- **Stage main fn artık `<StageScene>`'e delege eder** — yalnız
  viewport-aware `plateDims`'i hesaplar (Stage-shell concern) +
  StageScene'e geçirir. Overlay'ler (empty-cap/render-ov/render-
  banner/edit-pill/zoom-pill) `StageSceneOverlays` olarak StageScene
  `children` prop'unda AYNI `k-studio__stage` div'inde sibling
  kalır → **Stage DOM byte-identical** (eski sibling sırası
  korundu).
- **`StageScenePreview.tsx` (yeni)**: rail thumb = `StageScene`'i
  flex-fill wrapper'da PREVIEW_BASE (900×506) boyutunda render
  eder, `transform: scale()` ile thumb kutusuna küçültür;
  selectedSlot=-1 + no-op onSelect + appState="preview" (slot-ring/
  badge GİZLİ — kategori 4 helper thumb'a GİRMEZ, Phase 94
  baseline). plateDims = PREVIEW_BASE × 0.85 (Stage plate %85
  paritesi; etrafta scene-padding).
- **`PresetThumbMockup` rail path'ten KALDIRILDI** (svg-art.tsx'te
  export hâlâ var ama rail kullanmıyor — `PresetThumbFrame` Frame
  legacy için kalır). `fitCascadeToThumb`/`THUMB_PLATE_*` rail'de
  ölü. `resolvePresetThumbScene` import + `thumbScene` rail'de
  kaldırıldı (rail ayrı scene resolve ETMEZ — StageScene içinde).

### Build-boundary (cycle yok)

`StageScenePreview → MockupStudioStage` (StageScene import).
`PresetRail → StageScenePreview`. Stage `StageScenePreview`'i
veya `PresetRail`'i import ETMEZ → cycle yok (Stage→svg-art,
StageScenePreview→Stage, PresetRail→StageScenePreview tek yön).
`compositionGroup`/`MockupComposition`/`FrameComposition` AYNI
dosyada (`MockupStudioStage.tsx`) KALDI (Phase 111-116 battle-
tested, taşıma riski sıfır).

### Artık tek kaynaktan gelen parametreler

slots (real itemler + `imageUrl`), deviceKind, sceneOverride,
activePalette, layoutCount, layoutVariant, frameAspect, mode →
hepsi `StageScene`'e tek prop set. Middle panel + her rail thumb
AYNI `StageScene` (aynı `MockupComposition` + `compositionGroup`
plate-fit + `StageDeviceSVG` + real asset + CSS plate/scene
chrome). **Fark YALNIZCA**: (a) plateDims ölçeği (Stage viewport-
aware; thumb PREVIEW_BASE küçük + CSS scale), (b) candidate
`layoutVariant` (Stage selected; thumb preset candidate),
(c) appState (thumb "preview" → ring/badge gizli).

### Candidate layout dışında temizlenen farklar

`fitCascadeToThumb` (ayrı bbox/scale math) → kaldırıldı, thumb
artık Stage'in `compositionGroup` plate-fit'ini kullanır.
SVG-rect scene/plate → kaldırıldı, thumb artık Stage'in CSS
`k-studio__stage-scene`/`k-studio__stage-plate`/`k-studio__plate-
glass` div'lerini kullanır. SVG-rect chrome (proportional pad/
frame/bezel Phase 116 fu) → ARTIK GEREKSİZ (thumb gerçek
StageDeviceSVG'yi gerçek plate içinde Stage ile birebir render
eder; chrome scale CSS transform'la otomatik orantılı).

### Browser+DOM triangulation (fresh build, real asset)

Test set `cmov0ia37` (4 real MinIO MJ asset), clipart→sticker,
viewport 1600×1040:

- **8 `studio-stage` instance** = 1 middle panel + 7 rail thumb
  (live + 6 preset), **HEPSI aynı `StageScene` component**.
- Middle panel: `hasPlate:true hasMockupComp:true` 3
  `k-studio__slot-wrap` (React div) 3 real MinIO `<image>`
  cascadeScale 1.722.
- Rail thumb 0: `previewWrapperPresent:true sameStageScene
  Component:true hasPlate:true hasMockupComp:true` 3 slot-wrap
  3 real `<image>` (aynı href) cascadeScale 1.454. Plate
  `plateInsidePreviewBox:true` (sizing fix sonrası — `.k-studio__
  stage` flex:1 collapse bug'ı flex-fill wrapper ile çözüldü:
  stageCSSheight 0→506px).
- 6 preset her biri sameStageScene + 3 slot-wrap + 3 real img +
  kendi candidate variant rotation (cascade `[0,-6,-12]`,
  centered `[0,0,0]`, tilted `[-7,0,7]`, stacked `[0,0,0]`,
  fan `[-13,0,13]`, offset `[0,-4,-8]` = `applyLayoutVariant`).
- **Rail→Shell→Stage unity**: rail preset-4 (fan) click →
  `shellLayoutVariant:"fan"`; middle panel cascade `[-13,0,13]`;
  fan thumb sameStageScene + `[-13,0,13]` + 3 real img +
  pressed:true. Middle === thumb (candidate layout dışında).
- **Mode-AGNOSTIC**: Frame mode'a geçince `layoutVariant:"fan"`
  korundu; fan thumb sameStageScene + hasPlate + 3 real img;
  middle panel Frame mode 3 real img + hasPlate; 8 StageScene
  instance sabit.
- **Product MockupsTab continuity**: `/products/cmor0wkjt...`
  Mockups tab 11 frame-export tile, naturalWidth 1920×1080,
  objectFit contain (Phase 101 baseline) — StageScene refactor
  Studio-only, Product/persistence/handoff dokunulmadı.
- **Screenshot**: middle panel + 7 rail thumb HEPSI AYNI cream
  plate + dark scene + 3 real sticker (PAS5/neon/car), farklı
  candidate layout. "Ayrı thumb sistemi / generic ikon / boş
  thumb" tamamen bitti.

### Quality gates

- `tsc --noEmit`: clean
- `vitest tests/unit/{mockup,selection,selections,products,
  listings}`: **730/730 PASS** (59 files, zero regression)
- `next build`: ✓ Compiled successfully (StageScenePreview file-
  level eslint-disable: dinamik `transform:scale` Tailwind token
  ile ifade edilemez — MockupStudioStage/svg-art ile aynı stage-
  namespace pattern)

### Değişmeyenler (Phase 117)

- **Review freeze (Madde Z) korunur.**
- **Schema migration yok.** Sadece component extract +
  delegation + yeni preview wrapper.
- **WorkflowRun eklenmez.**
- **Yeni big abstraction yok.** `StageScene` = mevcut Stage scene
  JSX'inin extract'i (yeni davranış değil); `StageScenePreview` =
  scaled wrapper (yeni framework/layout builder/mockup editor
  YOK). `compositionGroup`/`MockupComposition`/`FrameComposition`
  taşınmadı (aynı dosya).
- **Stage DOM byte-identical** — overlay'ler StageScene children
  olarak AYNI `k-studio__stage` div'inde, eski sibling sırası
  korundu. Stage davranışı (Preview=Export Truth, compositionGroup
  plate-fit, viewport-aware plateDims, Phase 109 Lens Blur target,
  Phase 113 layered effects) BİREBİR.
- **Preview = Export Truth korundu + en güçlü hali** — thumb
  artık Stage'in AYNI render path'i (geometry + asset identity +
  layered effects + chrome + plate/scene + composition HEPSİ tek
  `StageScene`).
- **Phase 113 slot identity + Phase 114 layoutVariant canonical +
  Phase 115 cascade-layout.ts + Phase 116/fu/fu2 baseline** hepsi
  intakt (StageScene bunları aynen tüketir).
- **References / Batch / Review / Selection / Mockup Studio /
  Product / Etsy Draft canonical akışları intakt.**
- **3. taraf mockup API path** ana akışa girmedi.
- **Kivasy v4 tokens + Studio `--ks-*` namespace bozulmadı.**

### Hâlâ açık (Phase 118+ candidate)

- **`PresetThumbMockup`/`fitCascadeToThumb`/`THUMB_PLATE_*` ölü
  kod** svg-art.tsx'te kaldı (`PresetThumbFrame` Frame legacy
  hâlâ kullanıyor olabilir — ayrı audit). Temizlik Phase 118
  candidate (kullanım kontrolü + güvenli silme).
- **StageScenePreview PREVIEW_BASE sabit** (900×506) — thumb
  kutusuna CSS scale ile sığar; çok küçük rail'de cascade detayı
  azalır (kabul edilebilir; Shots.so thumb da düşük detay).
- **View tabs (Zoom/Tilt/Precision) + Zoom slider** no-op
  (kategori 4 preview-only helper; Phase 115'ten devir).
- **Drop shadow softness fine-tune** (Phase 103/107/108'ten
  devir).
- **Gerçek Etsy V3 API POST e2e** — production credential.
- **Yeni SVG/layout builder/mockup editor** — §13.A ertelenmiş.

### Bundan sonra en doğru sonraki adım

Phase 117 ile right rail GERÇEKTEN "tek sahne, çok ekran": rail
thumb = middle panel'in AYNI `StageScene` component'i, scaled +
candidate layoutVariant. "Benzetmeye çalışan ikinci görsel
sistem" tamamen kaldırıldı (kanıt: 8 StageScene instance, hepsi
aynı `k-studio__stage`/`stage-plate`/`stage-mockup-comp`/
`slot-wrap` + real asset; fark yalnız scale + candidate variant;
rail→stage fan unity; mode-AGNOSTIC; Product MockupsTab intakt).
Sıradaki adım **Phase 118 candidate**: ölü kod temizliği
(`PresetThumbMockup`/`fitCascadeToThumb` `PresetThumbFrame`
kullanımı kontrol edilip güvenli silme) veya View tabs/Zoom
slider activation. Yeni SVG/layout builder/mockup editor §13.A'da
ertelenmiş kalır.

---

## Phase 118 — Right rail = canlı bağlı çok ekran: aspect-aware reactive plateDims + chromeless thumb (siyah stage kutusu kaldırıldı)

Phase 117 single-renderer DOĞRU yöndü (rail thumb = orta panelin
AYNI `StageScene`'i, ayrı SVG renderer yok) ama iki açık kaldı:
**(1)** middle panelde aspect ratio değişince rail thumb'lar AYNI
oranda güncellenmiyordu (stale); **(2)** rail thumb'da stage
container'ın siyah kutusu + dot-grid görünüyordu. Kullanıcı:
"tek sahne, çok ekran, **canlı bağlı**" + "right rail'de
siyah kare / stage container görünmesin, Shots.so'daki gibi
yalnız preview hissi".

### Kök neden (browser+DOM+code triangulation)

**Açık #1 — reaktivite gap'i (en kritik):** `StageScenePreview`
`plateDims={{ w: PREVIEW_BASE_W*0.85, h: PREVIEW_BASE_H*0.85 }}`
= sabit `765×430` (16:9-ish oran) geçiyordu. `frameAspect` prop
reaktif akıyordu (DOM `data-frame-aspect` doğru güncelleniyordu)
AMA plate boyutu hiç recompute edilmiyordu. Stage'in
`plateDimensionsFor`'u aspect-locked iken `StageScenePreview`
sabit constant kullanıyordu → operatör 9:16 seçince orta panel
plate `0.562` (portrait) olurken **rail thumb plate `1.778`
(landscape) STALE kalıyordu**. Kullanıcının "aspect ratio
değişince right rail güncellenmiyor" şikayetinin tam kök nedeni.

**Açık #2 — stage container görünür:** `StageScenePreview`
`StageScene`'in TAMAMINI render ediyordu: `.k-studio__stage`
dark bg (`--ks-st` `rgb(17,16,9)`) + `::before` dot-grid +
`.k-studio__stage-scene` ambient tint + `.k-studio__stage-floor`
placement floor. Bunlar **stage workspace chrome'u** (operatör
çalışma alanı tonu) — Shots.so'da rail thumb'da görünmez (yalnız
plate + composition). Kullanıcının "siyah kare / stage kutusu"
gözlemi DOM ile doğrulandı (baseline: `stageBg: rgb(17,16,9)`,
`dotGridBefore: radial-gradient(...)`, `sceneLayerPresent: true`,
`floorLayerPresent: true`).

### Doğru model

**Tek kaynak, çok preview, canlı bağlı.** middle panel = selected
layout; right rail = aynı sahnenin candidate-layout preview'ları;
middle panelde yapılan HER görsel değişiklik (aspect / asset /
item identity / device shape / layout count / plate-bg / scene /
glass / blur / chrome) sağ paneldeki bütün preview'lara anında
yansır (`right rail = current middle-panel state re-rendered with
each candidate layout`). Right rail'de stage container hissi YOK
— yalnız plate + composition (Shots.so parity). Tek render path
korunur (Phase 117 baseline; sessiz drift §12 YASAK).

### Fix #1 — aspect-aware reactive plateDims (`StageScenePreview`)

Sabit `765×430` → `FRAME_ASPECT_CONFIG[frameAspect].ratio`
(w/h, Shell SHARED state — Stage ile AYNI kaynak) ile
**aspect-locked bbox-fit** (Stage `plateDimensionsFor`
paritesi, PREVIEW_BASE ölçeğinde):
```ts
const ratio = FRAME_ASPECT_CONFIG[frameAspect].ratio;
const maxW = PREVIEW_BASE_W * 0.85, maxH = PREVIEW_BASE_H * 0.85;
const fitByWidth = { w: maxW, h: maxW / ratio };
const plateDims = fitByWidth.h <= maxH
  ? { w: maxW, h: maxW / ratio }
  : { w: maxH * ratio, h: maxH };
```
`frameAspect` zaten reaktif akıyordu; artık plate dims o değerden
recompute → aspect (ve değişimle birlikte tüm scene/asset/count/
device) rail thumb'a canlı yansır. Wrapper'a `data-frame-aspect`
attribute (audit/test selector).

### Fix #2 — chromeless prop (`StageScene` + `studio.css`)

`StageScene`'e `chromeless?: boolean` prop. `chromeless=true`:
- `.k-studio__stage` `data-chromeless="true"` → CSS:
  `background: transparent` + `::before { display: none }`
  (dark `--ks-st` kutusu YOK, dot-grid YOK)
- `.k-studio__stage-scene` + `.k-studio__stage-floor` +
  `.k-studio__stage-amb` render EDİLMEZ (görünür stage chrome
  layer'ları; `-amb` zaten Phase 94'te `display:none`)
- Plate + `MockupComposition`/`FrameComposition` AYNEN render
  (tek render path korunur)

`StageScenePreview` `chromeless` geçer. Stage main fn (orta
panel) `chromeless=false` (default) → Phase 117 davranışı
**BİREBİR** (DOM byte-identical, regression yok).

### Artık canlı bağlı parametreler (Shell state → rail thumb)

`frameAspect` (Fix #1 ile plate dims recompute) · `sceneOverride`
(mode/glass/blur/color) · `slots` (real item identity + imageUrl)
· `layoutCount` · `deviceKind` (productType shape) · `activePalette`
· `layoutVariant` (candidate — tek fark). Hepsi Shell `useState`
→ `MockupStudioPresetRail` → `StageScenePreview` → `StageScene`;
React her state değişiminde rail'i yeniden render eder. **Snapshot/
stale state YOK** — derived live previews.

### Candidate layout dışında temizlenen farklar

Stage container chrome (dark bg + dot-grid + scene tint + floor)
artık rail thumb'da yok — middle panel ile rail thumb arasında
**plate + composition + chrome + asset + scene + aspect HEPSİ
AYNI**; tek fark candidate `layoutVariant`. Phase 117'de "tek
render path" idi ama stage container görünüyordu + aspect stale
idi; Phase 118 ikisini de kapattı.

### Browser triangulation (fresh build, real asset, DOM+screenshot)

Test set `cmov0ia37` (4 real MinIO MJ asset), viewport 1600×1040:

**Test A — chromeless:**
| | Rail thumb 0 | Middle panel |
|---|---|---|
| `data-chromeless` | `"true"` ✓ | `"false"` ✓ |
| stage bg | `rgba(0,0,0,0)` (transparent) ✓ | `rgb(17,16,9)` (dark, korundu) ✓ |
| dot-grid `::before` | `display:none` ✓ | `display:block` (korundu) ✓ |
| scene/floor layer | NOT rendered ✓ | rendered (korundu) ✓ |
| plate + 3 real img | present ✓ | — |

**Test B — aspect reactivity (core fix):** aspect `9:16` →
rail thumb plate `0.562` (portrait) === middle panel plate
`0.562` (portrait). Phase 117 stale `1.778` GİTTİ. `RAIL_MATCHES_
MIDDLE: true`.

**Test C — full sweep:** glass-dark → rail thumb + middle ikisi
de `data-glass-variant="dark"` (`SCENE_REACTIVE: true`); layout
count 2 → rail thumb + middle ikisi de 2 slot (`COUNT_REACTIVE:
true`).

**Screenshot:** middle panel 9:16 portrait plate + 2 sticker-card
+ glass-dark; 7 rail thumb hepsi **portrait 9:16** (aspect canlı
yansıdı) + 2 card + glass-dark + **siyah stage kutusu/dot-grid
YOK** (yalnız plate + composition, panel bg üzerinde). Fark
yalnız candidate layout.

**Continuity:** Product MockupsTab 11 frame-export tile,
1920×1080, `aspect-[4/3]` + `object-contain` (Phase 100/101
baseline intakt — Phase 118 yalnız studio rail rendering).

### Quality gates

- `tsc --noEmit`: clean
- `vitest tests/unit/{mockup,selection,selections,products,
  listings}`: **730/730 PASS** (59 files, zero regression)
- `next build`: ✓ Compiled successfully

### Değişmeyenler (Phase 118)

- **Review freeze (Madde Z) korunur.**
- **Schema migration yok.** Yalnız `StageScene`'e bir opsiyonel
  prop + `StageScenePreview` plate dims hesabı + 1 CSS rule.
- **WorkflowRun eklenmez.**
- **Yeni big abstraction yok.** Tek render path (Phase 117)
  KORUNDU — `chromeless` aynı `StageScene`'in görünürlük
  varyantı, ayrı thumb sistemi DEĞİL. `plateDims` Stage
  `plateDimensionsFor` aspect-locked mantığının PREVIEW_BASE
  ölçeğinde parity'si. Yeni component/service/route/SVG library/
  layout builder/mockup editor YOK.
- **Phase 117 single-renderer + Phase 114 layoutVariant canonical
  + Phase 115 cascade-layout.ts + Phase 116 StageDeviceSVG real
  asset thumb baseline'ları intakt.**
- **Orta panel davranışı BİREBİR** (chromeless=false default →
  Phase 117 DOM byte-identical, regression yok).
- **References / Batch / Review / Selection / Mockup Studio /
  Product / Etsy Draft canonical akışları intakt.**
- **3. taraf mockup API path** ana akışa girmedi.
- **Kivasy v4 tokens + Studio `--ks-*` namespace bozulmadı.**

### Hâlâ kalan (Phase 119+ candidate)

- **Ölü kod temizliği** (Phase 117'den devir): `PresetThumbMockup`
  / `fitCascadeToThumb` / `THUMB_PLATE_*` rail path'inde
  kullanılmıyor (`PresetThumbFrame` kullanımı kontrol edilip
  güvenli silinmeli).
- **View tabs (Zoom/Tilt/Precision) + Zoom slider** no-op
  (kategori 4 preview-only helper; Phase 115'ten devir).
- **Drop shadow softness fine-tune** (Phase 103/107/108'ten
  devir).
- **Gerçek Etsy V3 API POST e2e** — production credential.
- **Yeni SVG/layout builder/mockup editor** — §13.A ertelenmiş.

### Bundan sonra en doğru sonraki adım

Phase 118 ile right rail GERÇEKTEN "tek kaynak, çok preview,
canlı bağlı": rail thumb = current middle-panel state re-rendered
per candidate layout (aspect dahil tüm scene/asset/count/device
canlı yansır), stage container kutusu YOK (Shots.so parity), tek
render path (Phase 117) korundu. Sıradaki adım **Phase 119
candidate**: ölü kod temizliği (`PresetThumbMockup`/
`fitCascadeToThumb` güvenli silme) veya View tabs/Zoom slider
activation. Yeni SVG/layout builder/mockup editor §13.A'da
ertelenmiş kalır.

---

## Phase 119 — Right rail preview-first framing: plate-fit scale + self-measuring box + dark card bg/padding kaldırıldı (Shots.so crop parity)

Phase 117 single-renderer + Phase 118 aspect-aware/chromeless'ten
sonra kalan tek görünür açık: rail thumb içinde plate **küçük**
görünüyordu + etrafında fazla **siyah/boş alan** vardı (kullanıcı
"kutunun içinde küçük görüntü, preview küçük"). Stabilization/
framing turu — yeni feature/layout builder/mockup editor/SVG
library YOK; tek render path (Phase 117) korunur.

### Boş alanın gerçek kaynağı (browser+DOM ölçümüyle)

Phase 118 baseline ölçümü (16:9, rail card 167×88): plate
**133×75**, box'ı yalnız **width %79.6 / height %85** kaplıyor.
Üç ayrı kaynak:

1. **Scale full-canvas'a göre (en kritik):** `StageScenePreview`
   `scale = Math.min(boxW/PREVIEW_BASE_W, boxH/PREVIEW_BASE_H)`
   ile TÜM 900×506 PREVIEW_BASE canvas'ını box'a sığdırıyordu.
   Ama plate canvas'ın yalnız ~%85'i (`maxW = PREVIEW_BASE_W*0.85`)
   + portrait aspect'lerde çok daha dar (`maxH*ratio`). Yani box'a
   `[ boş stage-padding ][ küçük plate ][ boş stage-padding ]`
   ölçeklenmiş geliyordu → plate küçük + çevre boş.
2. **Dark card bg + iç padding (Phase 92 SVG-thumb dönemi
   kalıntısı):** `.k-studio__preset-card` + `.k-studio__live-thumb`
   `background: #0C0B09` (koyu) + `padding: 6-7px` taşıyordu.
   Phase 92'de thumb bir SVG idi; dark card bg + inset padding
   "bounded plate on dark stage" hissini SVG-level taklit ediyordu.
   Phase 117 single-renderer'da StageScene plate kendi chrome'unu
   (rounded+border+shadow) taşır; dark bg + padding artık yalnız
   kullanıcının şikayet ettiği "siyah çevre" boş alanını üretiyordu.
3. **Hardcoded box dims (boxW=172 boxH=88/72) ≠ gerçek kart:**
   PresetRail sabit box geçiyordu ama kart CSS `width:100%`
   (≈167-183px ölçülen) × CSS height (102/92px) idi → plate-fit
   scale hatalı + responsive resize'da stale.

### Shots.so thumb framing (dokümante davranış)

Shots.so rail thumb = composition'ı **karta dolduran** preview;
edge-to-edge değil ama küçük breathing-room ile, çevre stage-
padding **crop edilmiş**. Operatör "küçük bir stage kutusu"
değil "bu layout seçilirse böyle görünür" preview'si görür
(preview-first). Kivasy hedefi birebir aynı.

### Net karar + fix (framing/crop only, tek render path korunur)

**Fix A — plate-fit scale (`StageScenePreview`):** `scale`
artık **plate**'in box'a sığması için hesaplanır (full canvas
değil): `Math.min(boxW/plateDims.w, boxH/plateDims.h) ×
PREVIEW_FILL`. `PREVIEW_FILL=0.96` küçük breathing-room inset
(Shots.so thumb da hafif iç boşluk taşır). `overflow:hidden`
çevredeki transparent stage-padding'i KIRPAR → preview box'ı
doldurur (preview-first). Plate PREVIEW_BASE merkezinde,
`plateDims` Phase 118 aspect-aware (recompute) — scale onu
karta oturtur.

**Fix B — self-measuring box (`StageScenePreview`):** `boxW`/
`boxH` prop'ları KALDIRILDI. Wrapper parent kartı `width:100%
height:100%` doldurur; gerçek px `useLayoutEffect` + `ResizeObserver`
ile ölçülür (`hostRef.getBoundingClientRect`). Scale gerçek
karta göre **exact** + responsive-safe. PresetRail'deki hardcoded
`boxW=172 boxH=88/72` (live + preset) silindi.

**Fix C — dark card bg/padding kaldırıldı (`studio.css`):**
`.k-studio__preset-card` + `.k-studio__live-thumb` `background:
#0C0B09 → transparent`, `padding: 6-7px → 0`, `border` rgba(.07)
→ rgba(.06) (near-borderless). Phase 92 SVG-era inset shadow
recipe'leri (`svg { box-shadow ... }`) kaldırıldı (artık SVG
thumb yok). Hover/active subtle ring KORUNDU (operatör seçim
sinyali — aktif preset `box-shadow: 0 0 0 1px k-orange/.35`).
preset-card height 84→92 (preview-first daha çok dikey alan).

### Browser+DOM triangulation (fresh build, real asset)

Test set `cmov0ia37` (4 real MinIO MJ asset), viewport 1600×1040:

| Metrik | Phase 118 baseline (16:9) | Phase 119 (16:9) |
|---|---|---|
| Card bg | `#0C0B09` (dark) | `rgba(0,0,0,0)` ✓ |
| Card padding | `6px` | `0px` ✓ |
| Stage bg (chromeless) | `rgba(0,0,0,0)` | `rgba(0,0,0,0)` (korundu) |
| Plate box width frac | %79.6 | **%83.9** ✓ |
| Plate box height frac | %85.0 | **%93.9** ✓ |
| Real MinIO `<image>` | 3 | 3 (single render path) |

**Aspect reactivity (Phase 118 baseline korundu + Phase 119
framing):** Frame mode + 9:16 → middle plate aspect `0.562`,
rail thumb plate aspect `0.563` (`aspectReactive: true`), rail
plate height frac `0.929` (portrait plate karta dikey doluyor).
16:9'a geri → rail `1.778` / middle `1.78` (`reactiveBothWays:
true`). 6 preset thumb + live-thumb HEPSI aspect-reactive
(`allAspect916: true`), HEPSI 3 real `<image>` (`allHave3Img:
true`), 6 distinct variant (cascade/centered/tilted/stacked/
fan/offset — candidate layout mantığı korundu).

**Diğer param reactivity (Phase 118 baseline):** Glass Dark →
rail `data-glass-variant="dark"` === middle (`glassReactive:
true`); Layout count 2 → rail slot count 2 === middle
(`countReactive: true`).

**Continuity:** Product `/products/cmor0wkjt...` MockupsTab 11
frame-export tile, `1920×1080`, `aspect-[4/3]` + `object-contain`
(Phase 100/101 baseline intakt — Phase 119 yalnız studio rail
framing, export/handoff/Product dokunulmadı).

### Quality gates

- `tsc --noEmit`: clean
- `vitest tests/unit/{mockup,selection,selections,products,
  listings}`: **730/730 PASS** (59 files, zero regression —
  `StageScenePreviewProps` boxW/boxH kaldırıldı; test fixture
  etkilenmedi)
- `next build`: ✓ Compiled successfully

### Değişmeyenler (Phase 119)

- **Review freeze (Madde Z) korunur.**
- **Schema migration yok.** Yalnız `StageScenePreview` framing/
  scale/self-measure + 2 CSS recipe (card bg/padding) + PresetRail
  prop temizliği.
- **WorkflowRun eklenmez.**
- **Yeni big abstraction yok.** `useLayoutEffect`+`ResizeObserver`
  küçük self-measure (yeni framework/hook lib YOK). Tek render
  path (Phase 117 StageScene) BİREBİR korundu — Phase 119 yalnız
  **framing/crop/scale/visible-area** değiştirdi (render path,
  candidate layout mantığı, reactivity dokunulmadı).
- **Phase 117 single-renderer + Phase 118 aspect-aware/chromeless
  baseline'ları intakt** (StageScene `chromeless` prop + CSS
  Phase 118; Phase 119 onun üzerine framing ekledi).
- **Candidate layout mantığı korundu** — 6 distinct variant,
  rail→Shell→Stage canonical (Phase 114 baseline).
- **References / Batch / Review / Selection / Mockup Studio /
  Product / Etsy Draft canonical akışları intakt.**
- **3. taraf mockup API path** ana akışa girmedi.
- **Kivasy v4 tokens + Studio `--ks-*` namespace bozulmadı.**

### Hâlâ kalan (Phase 120+ candidate)

- **Portrait aspect yatay boşluk**: 9:16 portrait plate landscape
  karta dikey doluyor (height frac %93) ama doğal olarak yatayda
  dar (width frac %26 — plate aspect 0.562, kart ~2:1). Bu
  **doğru davranış** (portrait composition landscape karta tam
  oturmaz; Shots.so'da da portrait thumb yatay boşluk taşır) —
  kart aspect'ini içeriğe göre değiştirmek ayrı UX kararı
  (Phase 120+ candidate, şimdilik plate-fit + chromeless yeterli).
- **Ölü kod temizliği** (Phase 117/118'den devir): `PresetThumbMockup`
  / `fitCascadeToThumb` / `THUMB_PLATE_*` svg-art.tsx'te rail
  path'inde kullanılmıyor (`PresetThumbFrame` kullanımı kontrol
  edilip güvenli silinmeli).
- **View tabs (Zoom/Tilt/Precision) + Zoom slider** no-op
  (kategori 4 preview-only helper; Phase 115'ten devir).
- **Drop shadow softness fine-tune** (Phase 103/107/108'ten devir).
- **Gerçek Etsy V3 API POST e2e** — production credential.
- **Yeni SVG/layout builder/mockup editor** — §13.A ertelenmiş.

### Bundan sonra en doğru sonraki adım

Phase 119 ile right rail "kutunun içinde küçük preview"den
"preview-first büyük candidate-layout görünümü"ne dönüştü
(Shots.so parity): plate-fit scale + self-measure box + dark
card bg/padding kaldırıldı; tek render path (Phase 117) + aspect/
scene/count reactivity (Phase 118) + candidate layout mantığı
(Phase 114) BİREBİR korundu. Sıradaki adım **Phase 120
candidate**: ölü kod temizliği (`PresetThumbMockup`/
`fitCascadeToThumb`) veya View tabs/Zoom slider activation. Yeni
SVG/layout builder/mockup editor §13.A'da ertelenmiş kalır.

---

## Phase 120 — Containerless aspect-adaptive rail item (sabit kutu kaldırıldı, container = layout exact, yatay simetri)

Phase 119 plate-fit framing'i içeriği büyüttü ama kullanıcı kalan
gerçek sorunu net gösterdi (2 screenshot, yatay vs dikey):
**rail item'ı taşıyan kutu hâlâ sabit boyutlu + border'lı +
asimetrik padding'li**. Yatay aspect'te idare ediyordu (kart
aspect ≈ plate aspect) ama dikey aspect'te (9:16) belirgin
bozuluyordu. Stabilization/framing turu — yeni feature/layout
builder/mockup editor/SVG library YOK; tek render path (Phase
117 StageScene) korunur.

### Kök neden (browser+DOM ölçümüyle, üç ayrı sorun)

Phase 119 baseline ölçümü:

1. **Sabit landscape kutu (en kritik):** `.k-studio__preset-card`
   / `.k-studio__live-thumb` `height: 92/102px` SABİT → kart hep
   ~1.99 landscape. 16:9'da kart aspect ≈ plate aspect → plate %83
   width doluyor (idare). 9:16 portrait'te portrait plate aynı
   SABİT landscape kutuya sıkışıp **kart genişliğinin %74'ünü
   void** bırakıyordu (plate %26 width). Middle panel'de yok çünkü
   `.k-studio__stage` `flex:1` (kocaman adaptif alan).
2. **Görünür container border + arka plan:** inactive `1px
   rgba(255,255,255,0.06)` + active `1.5px rgba(232,93,37,0.7)`
   box-shadow → kart "çerçeveli kutu" gibi görünüyordu. Kullanıcı
   "container olduğu belli oluyor etrafındaki çerçeveden".
3. **Asimetrik yatay padding:** rail-scroll `scrollbar` (2px)
   yalnız sağdan yer kaplıyor → `clientWidth` skew → portrait
   kart `margin-inline:auto` ile ortalanırken leftGap≠rightGap
   (18 vs 20; 16:9'da -16 right overflow).

### Net karar (kullanıcı: "container gereksizse kaldır VEYA layout ile birebir aynı boyut/yapı")

Container gerçekten gereksiz: Phase 117'den beri `StageScene`
plate'i kendi rounded chrome'uyla render eder; rail card yalnız
tıklama hedefi. Çözüm A = containerless: kart **plate'in tam
kendisi kadar** (zero extra container shell), border yok,
transparent bg (rail dark bg görünür), aspect-adaptive.

### Fix (3 parça, framing/geometry only, tek render path korunur)

**Fix A — Containerless card (`studio.css`):** `.k-studio__preset-
card` + `.k-studio__live-thumb` `border: none`, `background:
transparent`, `border-radius`/`box-shadow` framing kaldırıldı,
`overflow: visible`. Selected state artık FRAMING border DEĞİL:
yalnız caption `data-active` orange + `font-weight:600` (kutu
hissi yok). Inactive `opacity:0.78`, hover/active `opacity:1`
(subtle, çerçevesiz). Kart bg transparent → rail
`.k-studio__rail` `rgb(28,25,22)` görünür (kullanıcı "arka plan
sağ panelle aynı"). StageScene plate'in kendi chrome'u tek
görsel sınır.

**Fix B — Aspect-adaptive card geometry (`MockupStudioPresetRail`):**
Sabit `height` JS-COMPUTED exact aspect'e çevrildi. Kart
WRAPPER `<div>` `ResizeObserver` ile ölçülür (rail-scroll
`clientWidth` DEĞİL — scrollbar-gutter skew'i ilk ölçümde stale
oluyordu, 16:9 kart 16px taşıyordu; wrapper content-flow içinde,
skew yok). `cardW = idealW`, `cardH = idealW / plateAspect`
(`FRAME_ASPECT_CONFIG[frameAspect].ratio`). `cardH` üst sınırı
(`RAIL_CARD_MAX_H=260`, rail-scroll bütçesi) aşarsa height clamp
+ `cardW = cardH * plateAspect` (aspect EXACT korunur). Kart
aspect = plate aspect BİREBİR (portrait → dar+uzun ortalı kart,
landscape → geniş+kısa). Aspect değişince geometry yeniden
hesaplanır (middle panel'in plate'i stage'e sığdığı AYNI
fit/fill ilişkisi, küçük ölçek).

**Fix C — Yatay simetri (`studio.css` rail-scroll):**
`scrollbar-gutter: stable both-edges` → scrollbar (2px) iki
kenardan SİMETRİK pay alır; `margin-inline:auto` portrait kartı
tam ortalar (leftGap == rightGap).

**StageScenePreview `PREVIEW_FILL` 0.96 → 1.0:** kart artık
plate ile TRUE aspect-match → FILL=1.0 + aspect-match → plate
kartı EDGE-TO-EDGE doldurur (her iki eksende ~%98-99; "layout
container ile AYNI boyut, küçük kalmaz"). `overflow:hidden`
sub-pixel taşmayı güvenle kırpar.

### Browser+DOM triangulation (4 aspect, real asset)

Test set `cmov0ia37` (4 real MinIO MJ asset), viewport 1600×1040:

| Aspect | Kart | Border | Bg | Extra W/H vs plate | Simetri |
|---|---|---|---|---|---|
| 16:9 | 179×101 (1.772) | **none** | transparent | **0 / 0** | L2 = R2 ✓ |
| 9:16 | 146×260 (0.562) | **none** | transparent | **0 / 0** | L19 = R19 ✓ |
| 1:1 | 179×179 (1.0) | **none** | transparent | **0 / 0** | L2 = R2 ✓ |
| 4:5 | 179×224 (0.799) | **none** | transparent | **0 / 0** | L2 = R2 ✓ |

- **`cardVsPlateExtraW/H: 0` her aspect'te** — kart = plate
  BİREBİR (zero container shell; "container = layout exact").
- **Kart aspect = plate aspect** her aspect'te (0.562/0.562,
  1.772/1.778, 1.0/1.0, 0.799/0.8) — container aspect-adaptive.
- **Border none + bg transparent** her aspect'te — kutu hissi
  YOK, rail bg görünür.
- **Yatay simetri** her aspect'te leftGap == rightGap (16:9
  baseline -16 overflow → 2/2; 9:16 18/20 → 19/19).
- 6 preset thumb HEPSI 3 real MinIO `<image>`, 6 distinct
  variant (cascade/centered/tilted/stacked/fan/offset) —
  candidate layout + single render path korundu.
- `middlePlateAspect 0.562` == rail card aspect 0.562 →
  **rail container orta panel plate aspect'ini BİREBİR
  yansıtır** (container seviyesinde middle≈rail parity).

### Quality gates

- `tsc --noEmit`: clean
- `vitest tests/unit/{mockup,selection,products,listings}`:
  **730/730 PASS** (59 files, zero regression)
- `next build`: ✓ Compiled successfully (default heap'te OOM
  exit 137 → `NODE_OPTIONS=--max-old-space-size=4096` ile clean;
  kod hatası değil, build mem baskısı)

### Değişmeyenler (Phase 120)

- **Review freeze (Madde Z) korunur.**
- **Schema migration yok.** Yalnız `MockupStudioPresetRail`
  (wrapper-measure + JS card geometry) + 2 CSS recipe
  (containerless + scrollbar-gutter) + StageScenePreview FILL
  1.0.
- **WorkflowRun eklenmez.**
- **Yeni big abstraction yok.** `ResizeObserver` wrapper-measure
  küçük (yeni framework/hook lib YOK). Tek render path (Phase
  117 StageScene) BİREBİR korundu — Phase 120 yalnız **container
  geometry/border/bg/symmetry** değiştirdi (render path,
  candidate layout mantığı, reactivity dokunulmadı).
- **Phase 117 single-renderer + Phase 118 aspect-aware/chromeless
  + Phase 119 plate-fit/self-measure baseline'ları intakt.**
- **Candidate layout mantığı korundu** — 6 distinct variant,
  rail→Shell→Stage canonical (Phase 114 baseline).
- **References / Batch / Review / Selection / Mockup Studio /
  Product / Etsy Draft canonical akışları intakt.**
- **3. taraf mockup API path** ana akışa girmedi.
- **Kivasy v4 tokens + Studio `--ks-*` namespace bozulmadı.**

### Hâlâ kalan (Phase 121+ candidate)

- **Ölü kod temizliği** (Phase 117-119'dan devir):
  `PresetThumbMockup` / `fitCascadeToThumb` / `THUMB_PLATE_*`
  svg-art.tsx'te rail path'inde kullanılmıyor (`PresetThumbFrame`
  kullanımı kontrol edilip güvenli silinmeli).
- **StageScenePreview `PREVIEW_BASE` (900×506) + transform:scale**
  hâlâ scaled-screenshot modelinde (Phase 120 container'ı
  düzeltti, içerik scaling Phase 119 plate-fit; tam native
  container-fit ileride değerlendirilebilir — ama mevcut görsel
  sonuç her aspect'te plate kartı edge-to-edge dolduruyor).
- **View tabs (Zoom/Tilt/Precision) + Zoom slider** no-op
  (kategori 4 preview-only helper; Phase 115'ten devir).
- **Drop shadow softness fine-tune** (Phase 103/107/108'ten
  devir).
- **Gerçek Etsy V3 API POST e2e** — production credential.
- **Yeni SVG/layout builder/mockup editor** — §13.A ertelenmiş.

### Bundan sonra en doğru sonraki adım

Phase 120 ile rail item "sabit border'lı kutu içinde küçük
preview"den "containersiz, aspect-adaptive, layout-ile-birebir-
boyut, yatay-simetrik" hale geldi (kullanıcı talebi birebir):
border yok, bg = rail bg, kart = plate exact (zero shell),
her aspect'te (özellikle dikey 9:16) plate kartı edge-to-edge
doldurur. Tek render path (Phase 117) + aspect/scene/count
reactivity (Phase 118) + plate-fit (Phase 119) + candidate
layout (Phase 114) BİREBİR korundu. Sıradaki adım **Phase 121
candidate**: ölü kod temizliği (`PresetThumbMockup`/
`fitCascadeToThumb`) veya View tabs/Zoom slider activation.
Yeni SVG/layout builder/mockup editor §13.A'da ertelenmiş kalır.

---

## Phase 121 — Rail selection unified design: slot-ring + overlay badge + opacity-dimming kaldırıldı

Phase 120 containerless aspect-adaptive rail item'ı bitirdi.
Kullanıcı üç net görsel tutarlılık eksiği bildirdi: (1) seçili
layout orta paneldeki gibi turuncu **slot-ring** ile işaretlensin
(caption rengi + font-weight yerine), (2) layout isimleri altta
ayrı caption yerine orta paneldeki "01 Front View" gibi **plate
üstü overlay badge** olsun (unified dizayn), (3) seçili olmayan
layout'lar daha karanlık görünüyor + bu **glow hover'da da
beli oluyor** — düzelt. Stabilization/UX-parity turu; tek
render path (Phase 117 StageScene) korunur.

### Kök neden (browser+DOM ölçümüyle)

1. **Karanlık/glow:** Phase 120'de `.k-studio__preset-card`
   `opacity: 0.78` (inactive) + `:hover { opacity: 1 }` +
   `[aria-pressed="true"] { opacity: 1 }` idi. → Seçili olmayan
   kartlar sönük (0.78), hover'da `0.78→1` parlama (kullanıcı
   "glow hover'da beli oluyor"), seçili kart parlak. Selection
   sinyali yanlış kanal (opacity).
2. **İsim alt caption:** ayrı `<div class="k-studio__preset-cap">
   {label}</div>` kartın ALTINDA → orta panel "01 Front View"
   plate-üstü badge ile tutarsız (kullanıcı "daha unified
   dizayn").
3. **Ring yok:** seçili kart yalnız caption rengi + font-weight:
   600 ile işaretliydi → orta panel `.k-studio__slot-ring`
   turuncu ring paritesi yoktu.

### Net karar — orta panel slot-ring/slot-badge AYNI görsel dili

Orta panel Stage'de slot-ring (`.k-studio__slot-ring`,
`box-shadow: 0 0 0 1.5px orange + 5px soft + 28px glow`) +
slot-badge (`.k-studio__slot-badge`, "01 Front View",
lit=orange / dim=dark blur) zaten var. Kategori 4 helper
Stage **preview** state'inde gizli; ama RAIL operatör seçim
yüzeyidir → ring/badge orada selection sinyali olarak Stage
ile AYNI görsel dilden gelir (unified). opacity-dimming
kaldırılır; selection = ring (opacity DEĞİL).

### Fix (3 parça, render path korunur)

**Fix A — opacity-dimming KALDIRILDI (`studio.css`):**
`.k-studio__preset-card` `opacity: 0.78` + `:hover { opacity:
1 }` + `[aria-pressed] { opacity: 1 }` + `transition: opacity`
silindi. Tüm kartlar AYNI parlaklıkta (opacity 1). Hover glow
biter (opacity geçişi kaynağı yok). Selection sinyali artık
yalnız ring.

**Fix B — slot-ring overlay (`MockupStudioPresetRail` +
`studio.css`):** Kart `position: relative`. Seçili kartta
(`active === i`) `<div class="k-studio__preset-ring"
data-on="true">` plate üstüne absolute overlay. Recipe orta
panel `.k-studio__slot-ring[data-on]` ile AYNI box-shadow
katmanları (`0 0 0 1.5px rgba(232,93,37,0.62) + 0 0 0 5px
rgba(...,0.10) + 0 0 24px rgba(...,0.13)`); inset -6px +
radius 14 plate rounded chrome'una göre. Kart `overflow:
visible` → ring kırpılmaz. Unselected: ring render edilmez
(`unselectedNoRing: true`).

**Fix C — overlay badge (alt caption KALDIRILDI):** Ayrı
`<div class="k-studio__preset-cap">` + `.k-studio__preset-cap`
CSS silindi. Her kartta `<div class="k-studio__preset-badge"
data-tone={active?lit:dim}>{NN} {label}</div>` plate üst-sol
köşede (top:6 left:6, z-index:2). Recipe orta panel
`.k-studio__slot-badge` paritesi (lit=`var(--ks-or)` orange /
dim=`rgba(8,7,6,0.78)` blur). "01 Cascade" / "02 Centered" /
… "06 Offset" (Stage "01 Front View" formatı, unified). Live
thumb head badge: `STUDIO_LAYOUT_VARIANT_LABELS[activeVariant]`
(daima lit, head aktif seçimi yansıtır; ring YOK — head daima
aktif preview).

### Browser+DOM triangulation (6 preset + live-thumb, real asset)

Test set `cmov0ia37` (4 real MinIO MJ asset), viewport 1600×1040:

- **`allOpacity1: true`** — 6 kart hepsi opacity 1 (sönük kart
  YOK; kullanıcı "karanlık" şikayeti çözüldü).
- **`hoverTest.noHoverGlow: true`** — unselected karta hover:
  opacity 1 → 1 (önce 0.78→1 glow; artık geçiş yok, hover
  glow YOK — kullanıcı "glow hover'da beli oluyor" çözüldü).
- **`selectedHasRing: true` + `unselectedNoRing: true`** —
  seçili kart turuncu ring (box-shadow Stage parity), diğerleri
  ringsiz. Click Fan (preset-4) → ring preset-0'dan preset-4'e
  taşındı (`p0_ringRemoved: true`, `p4_hasRing: true`).
- **`oldBottomCaptionCount: 0`** — alt ayrı caption kaldırıldı.
  **`allHaveBadge: true`** — 6 kart + live-thumb plate üstü
  badge ("01 Cascade"…"06 Offset"; active=lit orange
  `rgb(232,93,37)`, inactive=dim `rgba(8,7,6,0.78)`; top:6px
  — Stage "01 Front View" unified).
- Live-thumb: badge "Fan" (active variant), `hasNoRing: true`
  (head ring YOK). Click Fan → live-thumb badge → "Fan".
- 3 real MinIO `<image>` her thumb (single render path Phase
  117 korundu), 6 distinct variant (candidate layout Phase
  114 korundu), Phase 120 containerless/aspect-adaptive/
  symmetry BİREBİR (border none + bg transparent + extra 0).

### Quality gates

- `tsc --noEmit`: clean
- `vitest tests/unit/{mockup,selection,products,listings}`:
  **730/730 PASS** (59 files, zero regression)
- `next build`: ✓ Compiled successfully (`NODE_OPTIONS=--max-old-
  space-size=4096`; default heap OOM build mem baskısı, kod
  hatası değil)

### Değişmeyenler (Phase 121)

- **Review freeze (Madde Z) korunur.**
- **Schema migration yok.** Yalnız `MockupStudioPresetRail`
  (ring/badge JSX) + 3 CSS recipe (opacity kaldır + ring +
  badge; preset-cap silindi).
- **WorkflowRun eklenmez.**
- **Yeni big abstraction yok.** ring/badge recipe'leri orta
  panel `.k-studio__slot-ring` / `.k-studio__slot-badge`
  paritesi (yeni component/framework YOK). Tek render path
  (Phase 117 StageScene) BİREBİR korundu — Phase 121 yalnız
  **selection sinyali görsel dili** (ring + badge + opacity
  kaldır); render path / candidate layout / aspect / reactivity
  dokunulmadı.
- **Phase 117 single-renderer + Phase 118 reactive + Phase 119
  plate-fit + Phase 120 containerless/aspect-adaptive/symmetry
  baseline'ları intakt.**
- **Kategori 4 helper sınırı:** Stage **preview** state'inde
  ring/badge gizli kalır (Phase 94 baseline değişmedi); RAIL
  operatör seçim yüzeyi olduğu için orada görünür (Stage'le
  AYNI görsel dil, ayrı yüzey rolü).
- **References / Batch / Review / Selection / Mockup Studio /
  Product / Etsy Draft canonical akışları intakt.**
- **3. taraf mockup API path** ana akışa girmedi.
- **Kivasy v4 tokens + Studio `--ks-*` namespace bozulmadı**
  (`var(--ks-or)`, `var(--ks-fm)`).

### Hâlâ kalan (Phase 122+ candidate)

- **Ölü kod temizliği** (Phase 117-120'den devir):
  `PresetThumbMockup` / `fitCascadeToThumb` / `THUMB_PLATE_*`
  svg-art.tsx rail path'inde kullanılmıyor (`PresetThumbFrame`
  kullanımı kontrol edilip güvenli silinmeli).
- **StageScenePreview `PREVIEW_BASE` + transform:scale** hâlâ
  scaled-screenshot modelinde (Phase 119-120 container + fill
  düzeltti; tam native container-fit ileride değerlendirilebilir
  — mevcut görsel sonuç her aspect'te edge-to-edge).
- **View tabs (Zoom/Tilt/Precision) + Zoom slider** no-op
  (kategori 4 preview-only helper; Phase 115'ten devir).
- **Drop shadow softness fine-tune** (Phase 103/107/108'ten
  devir).
- **Gerçek Etsy V3 API POST e2e** — production credential.
- **Yeni SVG/layout builder/mockup editor** — §13.A ertelenmiş.

### Bundan sonra en doğru sonraki adım

Phase 121 ile rail selection görsel dili orta panelle unified:
turuncu slot-ring (selected) + plate-üstü overlay badge ("01
Cascade" formatı) + opacity-dimming kaldırıldı (tüm kartlar
aynı parlaklık, hover glow yok). Kullanıcının üç eksiği birebir
çözüldü. Tek render path (Phase 117) + reactivity (Phase 118) +
plate-fit (Phase 119) + containerless/aspect-adaptive (Phase
120) + candidate layout (Phase 114) BİREBİR korundu. Sıradaki
adım **Phase 122 candidate**: ölü kod temizliği
(`PresetThumbMockup`/`fitCascadeToThumb`) veya View tabs/Zoom
slider activation. Yeni SVG/layout builder/mockup editor
§13.A'da ertelenmiş kalır.

---

## Phase 122 — Frame mode plate caption kaldırıldı (okunmuyor + redundant)

Phase 121 rail selection unified design'ı bitirdi. Kullanıcı tek
ufak görsel sorun bildirdi: Frame mode'da plate üzerindeki
caption (`1080 × 1920 · 9:16 · Instagram Story · Cascade ·
active Front View`) cream plate üstünde açık renk → **tam
okunmuyor**; "gerekli bir yazı değilse kaldırabiliriz". Küçük
cleanup turu.

### Analiz — caption gerekli mi?

`FrameComposition` içindeki `.k-studio__frame-cap` (Frame-mode-
only, `!isPreview`) üç bilgi taşıyordu:
1. `{outputW} × {outputH} · {label}` (örn. "1080 × 1920 · 9:16")
2. `· {deliverable}` (örn. "· Instagram Story")
3. `· Cascade · active {slot}` (Phase 85 continuity hint)

Browser+code denetimi: **hepsi redundant.**
- Toolbar (Phase 83 baseline) Frame mode'da zaten gösteriyor:
  `templateLabel` = `Frame · {deliverable}` ("Frame · Instagram
  Story") + `statusLabel` = `{outputW}×{outputH}` ("1080×1920").
  Browser doğrulaması: caption silindikten sonra body'de hâlâ
  "Instagram Story" + "1080×1920" var (`toolbar_showsDeliverable:
  true`, `toolbar_showsDims: true`).
- "Cascade · active {slot}" continuity hint'i Phase 121 rail
  slot-ring/badge ile redundant (operatör hangi layout seçili +
  active'i artık rail'de görüyor).
- Caption preview-only chrome — exported PNG'de YOK (§11.0
  editing-helper kategorisi, frame-compositor.ts üretmiyor).
- Cream plate üstünde `rgba(255,255,255,0.45)` açık renk →
  okunmuyor.

Sonuç: kaldırınca **sıfır bilgi kaybı** (toolbar + rail aynısını
taşıyor) + okunabilirlik sorunu biter.

### Fix (MockupStudioStage + studio.css)

- `MockupStudioStage` `FrameComposition`: `.k-studio__frame-cap`
  JSX bloğu (`!isPreview` koşullu div + 3 span) tamamen
  KALDIRILDI. Yalnız caption'da kullanılan `aspectCfg`
  (`FRAME_ASPECT_CONFIG[frameAspect]`) + `activeSlot`
  (`slots[selectedSlot]`) declaration'ları da silindi (artık
  unused — tsc temiz). `designSource` KORUNDU (line 560
  `data-design-source` hâlâ kullanıyor).
- `studio.css`: orphan `.k-studio__frame-cap` recipe (Phase
  97'den absolute bottom positioned caption) KALDIRILDI.
- Test refs: `studio-stage-frame-cap` / `-deliverable` /
  `-source` testid'leri hiçbir testte kullanılmıyordu →
  sıfır test breakage.

### Browser+DOM triangulation (fresh build, real asset)

Frame mode 9:16 (kullanıcı screenshot context):
- `frameMode_plateCaptionPresent: false` +
  `frameCap_testidCount: 0` → caption gitti.
- `toolbar_showsDeliverable: true` + `toolbar_showsDims: true`
  → "Instagram Story" + "1080×1920" toolbar'da korundu (sıfır
  bilgi kaybı).
- `mockupMode_plateOk: true` + `mockupMode_cascadeSlots: 3` →
  Mockup mode tamamen etkilenmedi (caption zaten Frame-only +
  !isPreview idi).
- Screenshot: Frame 9:16 plate temiz, alt caption yok; cascade
  composition korundu; rail slot-ring/badge (Phase 121) intakt.

### Quality gates

- `tsc --noEmit`: clean (unused `aspectCfg`/`activeSlot` silindi)
- `vitest tests/unit/{mockup,selection,products,listings}`:
  **730/730 PASS** (59 files, zero regression — testid'ler hiçbir
  testte yoktu)
- `next build`: ✓ Compiled successfully (`NODE_OPTIONS=--max-old-
  space-size=4096`; default heap OOM build mem baskısı, kod
  hatası değil)

### Değişmeyenler (Phase 122)

- **Review freeze (Madde Z) korunur.**
- **Schema migration yok.** Yalnız bir preview-only caption JSX
  + 2 unused declaration + 1 orphan CSS recipe silindi.
- **WorkflowRun eklenmez.**
- **Yeni big abstraction yok.** Sadece silme (redundant +
  okunmayan chrome).
- **Phase 117 single-renderer + Phase 118 reactive + Phase 119
  plate-fit + Phase 120 containerless/aspect-adaptive + Phase
  121 rail slot-ring/badge baseline'ları intakt.**
- **Bilgi kaybı YOK** — aspect/dims/deliverable toolbar'da
  (Phase 83), continuity rail'de (Phase 121).
- **§11.0 Preview = Export Truth** korunur: caption zaten
  exported PNG'de yoktu (preview-only chrome); silmek export'u
  etkilemez.
- **Mockup mode etkilenmedi** (caption Frame-only + !isPreview).
- **References / Batch / Review / Selection / Mockup Studio /
  Product / Etsy Draft canonical akışları intakt.**
- **3. taraf mockup API path** ana akışa girmedi.
- **Kivasy v4 tokens + Studio `--ks-*` namespace bozulmadı.**

### Hâlâ kalan (Phase 123+ candidate)

- **Ölü kod temizliği** (Phase 117-121'den devir):
  `PresetThumbMockup` / `fitCascadeToThumb` / `THUMB_PLATE_*`
  svg-art.tsx rail path'inde kullanılmıyor (`PresetThumbFrame`
  kullanımı kontrol edilip güvenli silinmeli).
- **StageScenePreview `PREVIEW_BASE` + transform:scale** hâlâ
  scaled-screenshot modelinde (Phase 119-120 container + fill
  düzeltti; mevcut görsel sonuç her aspect'te edge-to-edge).
- **View tabs (Zoom/Tilt/Precision) + Zoom slider** no-op
  (kategori 4 preview-only helper; Phase 115'ten devir).
- **Drop shadow softness fine-tune** (Phase 103/107/108'ten
  devir).
- **Gerçek Etsy V3 API POST e2e** — production credential.
- **Yeni SVG/layout builder/mockup editor** — §13.A ertelenmiş.

### Bundan sonra en doğru sonraki adım

Phase 122 ile Frame mode plate'i temiz: okunmayan + redundant
caption kaldırıldı, bilgi toolbar (Phase 83) + rail slot-ring/
badge'de (Phase 121) korunuyor. Tek render path (Phase 117) +
reactivity (Phase 118) + plate-fit (Phase 119) + containerless/
aspect-adaptive (Phase 120) + rail selection unified (Phase
121) + candidate layout (Phase 114) BİREBİR korundu. Sıradaki
adım **Phase 123 candidate**: ölü kod temizliği
(`PresetThumbMockup`/`fitCascadeToThumb`) veya View tabs/Zoom
slider activation. Yeni SVG/layout builder/mockup editor
§13.A'da ertelenmiş kalır.

---

## Phase 123 — Zoom slider gerçekten çalışıyor: preview-only middle-stage zoom (no-op kontrol canlandı, rail/export bağımsız)

Phase 96-122 boyunca right rail head'deki **Zoom slider** + Tilt/
Precision view tab'ları görünür ama **NO-OP** idi. Bu turun amacı
Studio'yu bir sonraki ürün seviyesine taşımak — son fazların doğru
kurduğu right rail / middle panel / export birlikteliğini bozmadan
en değerli yarım/no-op kontrolü gerçekten çalışır hale getirmek.

### Kısa audit (browser+code kanıtı)

| Soru | Cevap |
|---|---|
| En değerli no-op kontrol | Rail head **Zoom slider** (+ Tilt/Precision tab'ları). Browser kanıt: 9:16'da plate 491×874, slider/tab tıklamasından önce/sonra BİREBİR aynı (`zoomSliderEffect: "NO-OP"`, `tiltTabEffect: "NO-OP"`). Kod: `<input type="range" defaultValue={100}>` — onChange YOK, label statik "100%". |
| Kullanıcı etkisi | Operatör orta paneldeki kompozisyonu yakınlaştırıp inceleyemiyor (Shots.so preview-inspection kontrolü eksik). Görünür kontrol var ama hiçbir şey yapmıyor → "yarım ürün" hissi. |
| Sistemi bozmadan ele alış | Zoom **preview-only helper** (Contract kategori 2/4 — canonical shared visual param DEĞİL, export'a GİRMEZ §11.0, rail candidate thumb'lara UYGULANMAZ). Shell-level state → yalnız orta panel plate scale. StageScene shared render path + rail candidate previews + plateDims/aspect + export pipeline DOKUNULMAZ. |

Tilt/Precision ikincil — bu turda Zoom'a odaklanıldı (en yüksek
etki), gerçekten bitirildi.

### Net ürün/mimari kararı (4-kategori ayrımı korundu)

Zoom = **kategori 2 (mode/UI-specific helper state)** — operatörün
preview'ı yakınlaştırıp inceleme aracı. **Canonical visual
parameter DEĞİL** (kategori 1'e GİRMEZ): export'a yansımaz (§11.0
Preview = Export Truth — zoom viewing aid, final visual değil),
rail candidate thumb'lara uygulanmaz (kategori 1 layoutVariant/
scene/aspect rail'e yansır; zoom yansımaz — Phase 117-118 single-
renderer + chromeless baseline bozulmaz). Selection ring/badge
(kategori 4) zaten preview-only — zoom onlarla aynı katmanda.

### Uygulanan slice

- **`MockupStudioShell.tsx`**: yeni `previewZoom` state (yüzde,
  100 = no-op = Phase 122 BİREBİR). Stage'e `previewZoom/100`
  (ratio), PresetRail'e `previewZoom` + `onChangePreviewZoom`
  iletilir. Canonical Shell state (Phase 114 layoutVariant ile
  aynı pattern — tek kaynak).
- **`MockupStudioPresetRail.tsx`**: Zoom slider artık çalışıyor:
  `value={zoom}` + `onChange → setZoom → onChangePreviewZoom →
  Shell`. min 25 / max 200 / step 5; label dinamik `{zoom}%`.
  Fallback local state (Shell prop yoksa legacy). `data-testid`
  `studio-rail-zoom` + `studio-rail-zoom-val`.
- **`MockupStudioStage.tsx`**: `previewZoom` prop → `StageScene`.
  `zoomActive = !chromeless && previewZoom !== 1` — **çift
  guard**: (a) `!chromeless` → rail thumb (chromeless=true)
  zoom'u YOK SAYAR, (b) StageScenePreview previewZoom geçmez
  (default 1). Rail candidate previews operatör zoom'undan
  yapısal olarak bağımsız. Plate'e `data-preview-zoom` attr.
- **`studio.css`**: **CSS-variable kompozisyonu** —
  `.k-studio__stage-plate { transform: translate(-50%,-50%)
  scale(var(--ks-preview-zoom, 1)); transition: transform 120ms
  ease; }`. React yalnız `--ks-preview-zoom` custom property'sini
  set eder (zoomActive iken); CSS rule translate+scale'i KENDİSİ
  compose eder. Default fallback `1` = no-op. Stage `overflow:
  hidden` → zoom-in'de plate kenarı kırpılır (Shots.so preview-
  inspection).

### Kritik bug: inline transform ↔ CSS transform kompozisyon kırılması (DOM pixel ölçümüyle kanıtlandı)

İlk implementasyon zoom'u **React inline `transform: translate
(-50%,-50%) scale(${zoom})`** ile uyguladı. Browser DOM ölçümü:
inline style attribute DOĞRU (`mPlate.style.transform ===
"translate(-50%, -50%) scale(1.5)"`) AMA `getComputedStyle().
transform = matrix(1,0,0,1,-461,-259)` — **scale DÜŞÜYORDU**
(yalnız translate kalıyor). 2sn settle sonrası, `!important`
ile bile, scale-only ile bile reprodüklendi: plate box
değişmiyordu. Kök neden: plate'in CSS rule'u (`transform:
translate(-50%,-50%)`) + React inline transform + `transition:
transform` üçlüsünde scale güvenilmez şekilde drop ediliyordu
(inline transform ↔ CSS rule transform kompozisyon fragility).
**Çözüm:** CSS rule translate + scale'i kendisi compose eder
(`scale(var(--ks-preview-zoom,1))`), React yalnız değişkeni
set eder → inline/CSS transform conflict YOK, scale güvenle
uygulanır. CSS-variable inline'da set edilince güvenilir; CSS
rule tek transform kaynağı kalır.

### Browser triangulation (fresh build, real asset, viewport 1600×1040)

Test set `cmov0ia37` (4 real MinIO MJ asset PAS5/neon/car):

| Test | Zoom 100 (no-op) | Zoom 175 | Verdict |
|---|---|---|---|
| Slider label | "100%" | **"175%"** | ✓ wired |
| Middle `data-preview-zoom` | "1" | **"1.75"** | ✓ |
| Middle inline `--ks-preview-zoom` | (not set→CSS 1) | **"1.75"** | ✓ |
| Middle computed scaleX/Y | 1 / 1 | **1.75 / 1.75** | ✓ scale APPLIED |
| Middle translate | -533/-299.5 | **-533/-299.5** | ✓ centering preserved |
| Middle plate box | 922×518 | **1866×1048** (≈1.75×) | ✓ zoomed |
| 7 rail thumb scaleX | 1×7 | **1×7** | ✓ rail immune |
| Rail thumb 0 box | 179×101 | **179×101** (unchanged) | ✓ |
| StageScene instance count | 8 (1+7) | **8** | ✓ Phase 117 intact |

Ek doğrulamalar:
- **Zoom-out** (50%): plate `matrix(0.5,...)` = 533×300
  (yarım), centered, label "50%" ✓
- **Zoom + layout-variant coexist**: zoom 150 iken Tilted
  preset click → `shellLayoutVariant: "tilted"`, slot rot
  `[-7,0,7]`, badge "03 Tilted" + ring `data-on=true`
  (Phase 121), `zoomStillActive scaleX 1.5` (zoom persisted,
  variant uncorrupted) ✓
- **Zoom + aspect coexist** (Frame 9:16): rail thumb
  `data-frame-aspect="9:16"` plate aspect 0.562 === middle
  0.562 (`aspectReactive: true`, Phase 118 intact), all 7
  rail `--ks-preview-zoom` empty/scale 1 ✓
- **Reset 100 = clean no-op**: `data-preview-zoom="1"`, inline
  var not set (CSS fallback 1), scaleX 1, box 922×518 (Phase
  122 BİREBİR) ✓
- **Product MockupsTab continuity**: `/products/cmor0wkjt...`
  Mockups tab → "Frame Exports · 11 APPLIED", tüm tile
  `aspect-[4/3] bg-ink object-contain 1920×1080` (Phase 101
  baseline) — export persistence + handoff zinciri zoom'dan
  HİÇ etkilenmedi (§11.0 Preview = Export Truth: zoom Sharp
  pipeline'a ulaşmaz, FrameExport'a persist olmaz, Product
  tile'da görünmez) ✓
- Screenshot (fresh build): middle stage 175% zoom 3 büyük
  real-asset cascade + selection ring + overlay badge'ler,
  kenar stage'de kırpılı (Shots.so preview-inspection); sağ
  rail 7 küçük un-zoomed candidate thumb (her biri kendi
  variant'ı — Cascade ring'li, Centered/Tilted/Stacked/Fan/
  Offset) operatör zoom'undan bağımsız.

### Quality gates

- `tsc --noEmit`: clean
- `vitest tests/unit/{mockup,selection,selections,products,
  listings}`: **730/730 PASS** (59 files, zero regression)
- `next build`: ✓ Compiled successfully (`NODE_OPTIONS=
  --max-old-space-size=4096` — default heap OOM, kod hatası
  değil)
- Clean restart (fresh `.next` + port kill + `reused:false`
  server) üzerinde fresh-build browser verification (HMR
  state'e güvenilmedi)

### Değişmeyenler (Phase 123)

- **Review freeze (Madde Z) korunur.**
- **Schema migration yok.** Yalnız 1 Shell state + prop iletimi
  + Zoom slider wiring + 1 CSS rule (transform var-compose).
- **WorkflowRun eklenmez.**
- **Yeni big abstraction yok.** Shell `useState` + prop
  iletimi (store/reducer/context DEĞİL — Phase 114 layoutVariant
  pattern parity). Yeni component / route / service / SVG
  library / layout builder / mockup editor YOK.
- **4-kategori ayrımı korundu** — zoom kategori 2 (mode/UI
  helper); kategori 1 canonical params (layoutVariant/scene/
  aspect/slot/deviceShape/palette) zoom'dan ETKİLENMEZ;
  kategori 3 (compositionGroup/cascadeLayoutFor/StageDeviceSVG)
  dokunulmadı; kategori 4 (ring/badge) preview-only baseline
  korundu.
- **Preview = Export Truth (§11.0) korundu** — zoom CSS-only
  middle-stage helper; `frame-compositor.ts` (Sharp export)
  bu değeri ASLA görmez; FrameExport persist etmez; Product
  MockupsTab tile'da yansımaz (browser kanıtlı 11 tile
  baseline).
- **Phase 117 single-renderer + Phase 118 aspect-aware/
  chromeless + Phase 120 containerless aspect-adaptive rail +
  Phase 121 selection ring/badge + Phase 122 frame-cap removal
  baseline'ları intakt** (8 StageScene, rail candidate previews
  bağımsız, aspect-reactive, ring/badge çalışıyor).
- **Phase 114 layoutVariant canonical + Phase 116 real-asset
  rail thumb baseline'ları intakt** (zoom 150 iken Tilted
  variant doğru propagate).
- **References / Batch / Review / Selection / Mockup Studio /
  Product / Etsy Draft canonical akışları intakt.**
- **3. taraf mockup API path** ana akışa girmedi.
- **Kivasy v4 tokens + Studio `--ks-*` namespace bozulmadı**
  (`--ks-preview-zoom` yeni custom property, `--ks-*`
  namespace altında).

### Canonical not (Contract'a)

Zoom = **preview-only viewing aid** (Contract §6 view controls
+ §11.0 + 4-kategori): operatör orta paneldeki kompozisyonu
yakınlaştırıp inceler. **Canonical visual parameter DEĞİL** —
exported PNG'ye, FrameExport persistence'a, Product MockupsTab
tile'a, rail candidate thumb'lara YANSIMAZ. Yalnız orta panel
(`StageScene` chromeless=false) plate'ine CSS `scale(var(--ks-
preview-zoom,1))` uygulanır. Rail thumb (chromeless=true)
değişkeni set ETMEZ → daima scale 1 (rail = candidate layout
preview, operatör zoom'undan bağımsız). Yeni preview-only
helper eklenirken aynı disiplin: kategori 2/4, canonical
shared pota'ya GİRMEZ, export-bağımsız, rail-bağımsız.

### Hâlâ kalan (Phase 124+ candidate)

- **Tilt / Precision view tab'ları** hâlâ no-op (kategori 4
  preview-only helper). Phase 123 Zoom'a öncelik verdi (en
  yüksek etki). Tilt = preview rotate-inspect, Precision =
  fine-step nudge — ileride aynı preview-only disiplinle
  (export-bağımsız, rail-bağımsız) wire edilebilir.
- **Sidebar `data-wired="false"` kontroller** (Portrait /
  Watermark / BG Effects — §13.D) honest disclosure preview-
  only; Phase 124+ candidate.
- **Ölü kod temizliği** (Phase 117-119'dan devir):
  `PresetThumbMockup` / `fitCascadeToThumb` / `THUMB_PLATE_*`
  rail path'inde kullanılmıyor (`PresetThumbFrame` kullanımı
  kontrol edilip güvenli silinmeli).
- **Drop shadow softness fine-tune** (Phase 103/107/108'ten
  devir).
- **Gerçek Etsy V3 API POST e2e** — production credential.
- **Yeni SVG/layout builder/mockup editor** — §13.A
  ertelenmiş.

### Bundan sonra en doğru sonraki adım

Phase 123 ile rail head'deki en değerli no-op kontrol (Zoom
slider) gerçekten çalışıyor — operatör orta paneldeki gerçek-
asset kompozisyonu 25-200% yakınlaştırıp inceleyebiliyor
(Shots.so preview-inspection); rail candidate previews + export
+ Product tile zoom'dan tamamen bağımsız (preview-only helper
disiplini). Sıradaki adım **Phase 124 candidate**: Tilt/
Precision view tab'larını aynı preview-only disiplinle wire
etme veya ölü kod temizliği (`PresetThumbMockup`/
`fitCascadeToThumb`). Yeni SVG/layout builder/mockup editor
§13.A'da ertelenmiş kalır.

---

## Phase 124 — Stage zoom-pill ↔ rail slider tek kaynak (− / % / + / Fit wired)

Phase 123 rail slider'ı çalışır yaptı ama Stage'in bottom-center
**zoom-pill**'i (`−` / `%` / `+` / `Fit`) hâlâ NO-OP idi (static
"50%", handler yok). Kullanıcı talebi: "zoom slider üzerinde ufak
bir panel var, onu da entegre edelim" (Shots.so referansı).

### Uygulanan

- `StageSceneOverlays` zoom-pill: `−`/`+` ±10 step
  (`stepZoom(delta)` React **functional updater** → rapid-click
  accumulate; stale-closure batching fix), `Fit` = 100 reset,
  25–200 clamp, dinamik `{pct}%`, disabled-state'ler (min/max/at-100).
- Pill rail slider (Phase 123) ile **AYNI Shell `previewZoom`
  state'i sürer** → iki kontrol yüzeyi senkron, % her yerde aynı
  (Shots.so canonical: tek zoom state, iki kontrol yüzeyi).
  `MockupStudioStage.previewZoomPct` + `onChangePreviewZoom`
  (functional updater destekli) prop'ları Shell `setPreviewZoom`'a
  bağlandı.
- Mode-AGNOSTIC: pill her iki modda render + çalışır.

Browser kanıt (Phase 124): pill `+`×4 rapid → 140% (accumulate),
slider "140" senkron, middle scaleX 1.4, 7 rail thumb scaleX 1
(immune); Fit → 100% clean; Frame mode pill `+`×5 → 150% identical
+ slider senkron. Bu davranış Phase 125'te düzeltildi (aşağı bkz.).

## Phase 125 — Shots.so-canonical zoom: plate SABİT, composition içeriği scale (gerçek browser ölçümü)

Kullanıcı: "shots.so'yu browser üzerinden incele, zoom davranışı
şu an aynı değil; bundan sonra hep Shots.so'yu kod+görsel browser
üzerinden inceleyerek aksiyon al." Phase 123/124 zoom'u **plate'in
KENDİSİNE** (`scale(var(--ks-preview-zoom))`) uyguluyordu → plate
+ chrome (rounded corner, border, shadow) büyüyüp stage'i taşıyordu.
Bu Shots.so davranışıyla **uyuşmuyordu** (kullanıcı tespiti doğru).

### Shots.so canlı browser araştırması (Claude in Chrome, kanıtlı)

Preview tool localhost'a kilitli; **Claude in Chrome** ile
shots.so/ gerçek browser'da açıldı, editor'e girildi, DOM+computed
style ölçüldü:

| Ölçüm | 100% | 400% |
|---|---|---|
| `.frame.preview-frame` (plate/canvas) | 909×682 | **909×682 DEĞİŞMEDİ** |
| `.component` (composition İÇERİĞİ) | scale 1 | **`transform: matrix(4,0,0,4,0,0)`** |
| Composition image | 512×512 | **2046×2046** (4×, frame'i taşıp kırpılıyor) |
| Rail LAYOUT PRESETS thumb'ları | full comp | **DEĞİŞMEDİ** (zoom'dan bağımsız) |
| Üst live preview thumb | full comp | **DEĞİŞMEDİ** |

**Shots.so canonical:** zoom frame/plate'i DEĞİL, frame İÇİNDEKİ
composition içeriğini (`.component`) scale eder; frame SABİT-boyut
viewport kalır, içerik `overflow:hidden` ile **kırpılır**
(preview-inspection); pan yok (yalnız scale, ortadan). Mockup ↔
Frame mode **birebir aynı** (mode-AGNOSTIC, zoom state korunur,
rail her iki modda bağımsız). Slider üstündeki "ufak panel" =
`Zoom/Tilt` segment + canlı preview thumb + Zoom slider; hover'da
"Hold 0 for precision" ipucu. Shots.so **Remotion** kullanıyor
(`.__remotion-player`).

### Uygulanan düzeltme (Shots.so parity)

- **Plate'ten zoom KALDIRILDI**: `.k-studio__stage-plate` CSS rule
  `transform: translate(-50%,-50%) scale(var(--ks-preview-zoom,1))`
  → `transform: translate(-50%, -50%)` (Phase 122 baseline; plate
  SABİT-boyut, chrome büyümez). `--ks-preview-zoom` CSS-var tamamen
  kaldırıldı (hiçbir yerde okunmuyor).
- **Zoom composition layer'ına taşındı**: `MockupComposition` +
  `FrameComposition` `.k-studio__stage-inner` inline transform
  `scale(${grp.scale})` → `scale(${grp.scale * previewZoom})`.
  Plate `overflow: hidden` (zaten vardı, studio.css:132) taşmayı
  kırpar = preview-inspection (Shots.so `.component` davranışı).
- **`effectiveZoom` rail-independence guard**: `StageScene`
  `chromeless ? 1 : previewZoom` → rail thumb (chromeless=true)
  composition'ı DAİMA 1 (kendi plate-fit cascadeScale'i, ×zoom
  YOK) → rail candidate preview'ları operatör zoom'undan bağımsız
  (Phase 117-118 single-renderer + chromeless baseline korunur).
  Her iki composition'a `previewZoom={effectiveZoom}` iletilir.
- `data-preview-zoom` plate attr `effectiveZoom`'u yansıtır.
  Phase 123/124 zoom-pill ↔ slider tek-kaynak + Fit + functional
  updater **korundu** (yalnız scale'in UYGULANDIĞI element değişti:
  plate → stage-inner).

### Browser kanıt (Kivasy, Phase 125)

Preview-tool DOM ölçümü (zoom 150):
- PLATE box 1066×599 → **1066×599 UNCHANGED**, transform
  `matrix(1,0,0,1,-533,-299.5)` (pure centering, **NO scale**),
  `overflow: hidden`, `data-preview-zoom="1.5"`.
- COMPOSITION (`.k-studio__stage-inner`) scaleX **2.583** =
  `data-cascade-scale "2.583"` = 1.722 (Phase 111 plate-fit) ×
  1.5 (zoom) **exact**.
- 7 rail thumb composition scales `[1.235, 1.235, 1.564, 1.537,
  1.642, 1.358, 1.613]` (her biri kendi plate-fit cascadeScale'i,
  **×1.5 DEĞİL**); `data-preview-zoom ["1"×7]` → rail bağımsız.
- 8 StageScene instance (1 middle + 7 rail) — single-renderer
  intact.

**Claude in Chrome büyük-ekran görsel doğrulama** (yan yana
Shots.so karşılaştırması): zoom 150 → plate cream rounded surface
SABİT-boyut + chrome büyümedi; composition 3 cascade card büyüyüp
plate sınırında **kırpıldı** (Front-View sol kenar + blue-car sağ
kenar clipped); rail 6 layout-preset thumb tam un-zoomed kaldı.
Frame mode'a geçince zoom **persisted** (150% korundu) + davranış
**birebir aynı** (mode-AGNOSTIC); Fit → 100% clean no-op (Phase
122 byte-identical). Tüm davranışlar Shots.so canlı ölçümle
**birebir** eşleşti.

### Quality gates (Phase 124+125)

- `tsc --noEmit`: clean
- `vitest tests/unit/{mockup,selection,selections,products,
  listings}`: **730/730 PASS** (59 files, zero regression)
- `next build`: ✓ Compiled successfully (`NODE_OPTIONS=
  --max-old-space-size=4096`)
- Clean restart (fresh `.next` + port kill) + fresh-build
  browser verification (preview DOM + **Claude in Chrome** büyük
  ekran görsel)

### Değişmeyenler (Phase 124+125)

- **Review freeze (Madde Z) korunur.**
- **Schema migration yok.** Yalnız zoom-pill wiring + zoom scale'in
  uygulandığı element (plate → composition layer) + CSS-var kaldırma.
- **WorkflowRun eklenmez.**
- **Yeni big abstraction yok.** Mevcut `compositionGroup` scale'e
  `× previewZoom` çarpanı + `effectiveZoom` chromeless guard.
  Yeni component/route/service/SVG library/layout builder/mockup
  editor YOK.
- **4-kategori ayrımı korundu** — zoom kategori 2 (mode/UI helper);
  kategori 1 canonical params zoom'dan ETKİLENMEZ; kategori 3
  (compositionGroup/cascadeLayoutFor) plate-fit mantığı korundu
  (`grp.scale` baseline, ×previewZoom yalnız preview-inspection
  katmanı); kategori 4 (ring/badge) preview-only baseline korundu.
- **Preview = Export Truth (§11.0) korundu** — zoom yalnız
  `.k-studio__stage-inner` CSS scale (orta panel); `frame-
  compositor.ts` (Sharp export) bu değeri ASLA görmez; FrameExport
  persist etmez; Product MockupsTab tile'da yansımaz.
- **Phase 117 single-renderer + Phase 118 aspect-aware/chromeless
  + Phase 120 containerless rail + Phase 121 selection ring/badge
  + Phase 122 frame-cap removal baseline'ları intakt.**
- **Phase 123 rail slider + Phase 124 zoom-pill tek-kaynak + Fit
  + functional updater korundu** (yalnız scale uygulandığı element
  düzeltildi).
- **References / Batch / Review / Selection / Mockup Studio /
  Product / Etsy Draft canonical akışları intakt.**
- **3. taraf mockup API path** ana akışa girmedi.
- **Kivasy v4 tokens + Studio `--ks-*` namespace bozulmadı**
  (`--ks-preview-zoom` CSS-var kaldırıldı — artık kullanılmıyor).

### Kalıcı kural (kullanıcı talebi)

Bundan sonra Studio'ya eklenecek tüm özelliklerde Shots.so
**kod + görsel olarak gerçek browser üzerinden (Claude in
Chrome)** incelenip aksiyon alınır. Preview tool localhost'a
kilitli olduğu için Shots.so araştırması Claude in Chrome ile
yapılır; varsayımla değil canlı DOM/computed-style ölçümü +
görsel karşılaştırma ile.

### Hâlâ kalan (Phase 126+ candidate)

- **Tilt / Precision view tab'ları** hâlâ no-op (kategori 4
  preview-only helper; Phase 123'ten devir). Shots.so'da Tilt =
  composition rotate-inspect, "Hold 0 for precision" = precision
  modifier. İleride aynı preview-only disiplinle + Shots.so canlı
  inceleme ile wire edilir.
- **Sidebar `data-wired="false"` kontroller** (Portrait /
  Watermark / BG Effects — §13.D) honest disclosure preview-only.
- **Ölü kod temizliği** (`PresetThumbMockup`/`fitCascadeToThumb`).
- **Drop shadow softness fine-tune** (Phase 103/107/108'ten devir).
- **Gerçek Etsy V3 API POST e2e** — production credential.
- **Yeni SVG/layout builder/mockup editor** — §13.A ertelenmiş.

### Bundan sonra en doğru sonraki adım

Phase 125 ile Studio zoom davranışı Shots.so canonical ile
**birebir** (canlı browser ölçümüyle kanıtlı): plate SABİT-boyut,
composition içeriği scale + plate kırpar, rail bağımsız, mode-
AGNOSTIC, Fit reset. Sıradaki adım **Phase 126 candidate**:
Tilt/Precision view tab'larını Shots.so'yu Claude in Chrome ile
inceleyip aynı preview-only disiplinle wire etme veya ölü kod
temizliği. Yeni SVG/layout builder/mockup editor §13.A'da
ertelenmiş kalır.

---

## Phase 126 — Global media-position pad (Shots.so-canonical: drag handle media pan, fixed plate window, Shift precision; canonical mediaPosition param + shared resolver + export parity)

Shots.so'da zoom slider'ın üstündeki "pad" canlı browser'da (Claude in
Chrome, kod+görsel+etkileşim) incelendi: `.position-pad-safearea`
media-position/zoom/tilt pad'i; `.drag-handle` media-position anchor'ı
(handle media'yı plate içinde pan eder); `.shadow-layer` plate'in
**sabit görünür alanı** (media içeride hareket eder, plate sabit kalır);
`.viewfinder-div` framing; Zoom/Tilt toggle + "Hold ⇧ for precision".
Shots.so **tamamen Remotion** üzerine kurulu (sadece animate değil —
stage/composition/export hepsi Remotion). **Full Remotion migration
YAPILMADI** (kullanıcı kararı): Kivasy'nin StageScene/Sharp/parity
zinciri (Phase 117-125) korunmalı; Remotion ileride animate / Etsy
video / motion export için ayrı tur. Bu turda Shots.so'nun pad
**davranışı/semantiği** Kivasy'nin mevcut single-renderer + Sharp
mimarisine **global media-position** olarak getirildi.

### Neden global media-position (per-slot değil)

Kullanıcı net karar verdi: **B kapsamı + GLOBAL model**. Bu turda tek
canonical `mediaPosition: {x,y}` (normalized [-1,+1], pad center = {0,0})
tüm composition'ı topluca pan eder. Per-slot media-position ileride
**ayrı bir advanced/layout-editor modunun** işi (bu tur scope dışı —
erken abstraction §7.6 dead-code dersi). Tilt bu turda **honest
disabled** (`Tilt · Soon`, no-op sahte kontrol YOK); "Precision" ayrı
mode/tab DEĞİL — yalnız Shift modifier (delta ÷4). Pan-range sabiti
`K = 0.5` (kullanıcı onayı; Approach A).

### Canonical 4-kategori ayrımı (zoom ile kesin sınır)

| Param | Kategori | Export'a girer? | Rail thumb yansıtır? |
|---|---|---|---|
| **mediaPosition** | **1 — canonical shared visual** | **EVET** (§11.0 Preview=Export) | **EVET** (canonical) |
| previewZoom (Phase 125) | 2 — preview-only helper | HAYIR | HAYIR (rail-independent) |

mediaPosition canonical: stage preview + Sharp export + rail candidate
thumb'lar **aynı** `mediaPosition`'dan beslenir. previewZoom (Phase
124-125) preview-only viewing aid — export'a girmez, rail thumb'lara
uygulanmaz. İki param **aynı element/transform string'inde
birleştirilmez**: **outer wrapper** (`.k-studio__media-pos`) =
`translate(mediaPosition)` (pure pan, scale=1); **inner wrapper**
(`.k-studio__stage-inner`) = `scale(previewZoom × cascadeScale)` (pure
scale, translate=0). Browser DOM ölçümü ile kanıtlandı: middle panel
outer `matrix(1,0,0,1,359.897,-1.25)` ↔ inner `matrix(2.18319,...)` —
`outerInnerSameElement: false` (iki ayrı element, iki ayrı transform).
Rail thumb outer translate(305) [aynı mediaPosition'ı yansıtır] +
inner scale **1.235** (zoom 150 YOK — rail-independent; mediaPosition
VAR — canonical).

### Tek shared resolver / drift YASAK

`src/features/mockups/studio/media-position.ts` — **pure-TS**
(DOM/React/sharp import YOK → CLAUDE.md Madde V build-boundary: client
preview/rail + server Sharp compositor üçü de bu TEK modülü import
eder). `resolveMediaOffsetPx(pos, renderW, renderH)` = `{ ox: pos.x ×
renderW × K, oy: pos.y × renderH × K }` — preview outer-wrapper +
rail thumb + Sharp export hepsi bu tek formülü çağırır (drift
imkânsız). `normalizePadPointToPosition` pure-math (DOM/event objesi
YOK — kolay test); Shift → `prev + (raw−prev)/4` precision.
`mediaPositionsEqual` epsilon `1e-3` (float drift'ten sahte stale
üretmez). `{x:0,y:0}` **sacred no-op**: `resolveMediaOffsetPx`
`{ox:0,oy:0}` → outer `translate(0,0)` → Phase 125 byte-identical
(browser kanıtı: `data-media-x="0" data-media-y="0"`, computed
`matrix(1,0,0,1,0,0)`; export `cascadeOffset*Final === cascadeOffset*`).
Canonical state **yalnız normalized** (px/plateDims state'e GİRMEZ —
her render kendi boyutundan türetir: middle plate px ↔ rail thumb
küçük px ↔ Sharp `plateLayout.plateW/plateH`; resolution-independent).

### Pad UI (preview'ı boğmaz)

`StageScenePreview` rail-head live thumb'a subtle overlay
(`.k-studio__pad-overlay`): safe-area çerçevesi
(`.k-studio__pad-safearea`) + framing dim (`.k-studio__pad-dim`,
mask-composite exclude) + küçük handle (`.k-studio__pad-handle` 18×18).
Ayrı UI slab DEĞİL — yalnız çerçeve + handle (kullanıcı: "preview'ı
boğmasın"). Overlay yalnız `onChangeMediaPosition` verildiğinde
(rail-head pad); preset thumb'lar overlay GÖSTERMEZ, sadece
mediaPosition'ı yansıtır (sürmez — pad yalnız rail-head'de). Pointer
drag temiz: `setPointerCapture` (pointerdown) + `buttons===0` guard
(pointermove) + `releasePointerCapture` (pointerup + pointercancel).
Click-to-jump (handle dışı pad click → handle atlar) + clamp (±1, asla
aşmaz) + Shift precision pure-math.

### Sharp export parity (§11.0 Preview=Export Truth)

`frame-compositor.ts`: `cascadeOffsetXFinal/YFinal = cascadeOffset*
+ resolveMediaOffsetPx(input.mediaPosition, plateLayout.plateW,
plateLayout.plateH)` — **AYNI** resolver, **AYNI** K=0.5, render-space
= plate px (preview outer-wrapper plateDims ile orantısal parity).
Plate-area mask (mevcut) media taşmasını preview `overflow:hidden`
ile aynı şekilde kırpar. `route.ts` Zod `MediaPositionSchema`
(x/y min -1 max 1 clamp guard) + body optional + service forward.
`frame-export.service.ts` `ExportFrameInput.mediaPosition` + compositor
forward + `sceneSnapshot.mediaPosition` persist (re-export kaynağı +
stale-indicator karşılaştırması). Browser+DB kanıt: export request
body `mediaPosition` taşıyor (DOM ile BİREBİR — `matchesDom: true`),
`FrameExport.sceneSnapshot.mediaPosition` DB'ye persisted (eski
export'lar `undefined` → backward-compat neutral). **Pixel parity
görsel kanıt**: baseline {0,0} export ↔ media-positioned {x:0.709,
y:0.649} export side-by-side — composition exported PNG'de **belirgin
sağ-alta kaymış** (preview kayması ↔ PNG kayması aynı yön+orantı,
plate-clip dahil). (Sayısal bbox metodu plate-dominant olduğu için
yetersiz kaldı — görsel + kod + DB üçlü kanıt; Phase 36/60 emsali.)

### Stale indicator (epsilon, no false stale)

`FrameExportResultBanner` `FrameExportResultSnapshot.mediaPosition` +
`mediaPositionsEqual` epsilon term `isStale`'e eklendi. Shell hem
`currentSceneSnapshot.mediaPosition` (şu anki) hem export
`sceneSnapshot.mediaPosition` (export anı) geçer; `undefined → {0,0}`
(eski export pad'siz neutral). Browser kanıt: {0,0} export → banner
`data-stale="false"` ("FRAME EXPORTED · READY"); mediaPosition
{0.832,0.708}'e değişti → `data-stale="true"` ("PREVİEW CHANGED ·
RE-EXPORT?") + RE-EXPORT button; {0.0056,-0.005}'e geri (export
{0,0}'dan 0.0056 = epsilon 1e-3'ten büyük **gerçek** fark) → doğru
şekilde hâlâ stale (false-stale DEĞİL — epsilon dürüst ayrım; Task 1
unit-test: 0.0000004 fark→equal, 0.05 fark→not-equal PASS).

### Bug fix — handleExportFrame stale closure

Task 3'te export body'sine `mediaPosition` eklendi ama
`handleExportFrame` `useCallback` deps array'inde **YOKtu** → stale
closure (Phase 124 zoom emsali): DOM mediaPosition {0,0} ama export
body 0.397 (eski yakalanan değer). Browser+fresh-build ile kök neden
kanıtlandı, deps'e `mediaPosition` eklendi. Fresh-build re-verify:
export request body `{x:0.7094972,y:0.6485148}` ↔ DOM **BİREBİR**
(`matchesDom: true`). Bu **gerçek kod bug'ı** (test-aracı sınırı
değil) — ayrı fixup commit.

### Test-aracı sınırı (dürüst rapor)

Chrome `left_click_drag` `modifiers="shift"` pointer event'lere
`shiftKey` **iletmiyor** (capture probe: 4 gerçek event hepsi
`shiftKey:false`) — Chrome MCP synthetic-drag kısıtı, **kod bug'ı
DEĞİL**. Shift precision doğruluğu Task 1 unit-test (`normalizePad
PointToPosition` Shift ÷4 → 0.25 PASS) + kod-zinciri grep
(`onPadPointerDown/Move` → `e.shiftKey` → `applyFromEvent` →
`normalizePadPointToPosition` shiftKey) ile kanıtlandı. Native
`dispatchEvent(PointerEvent)` React 17+ root-listener'ı tetiklemiyor
(başka bir test-aracı sınırı) — ama Chrome `left_click_drag`/click'in
ÇALIŞMASI (drag pan, click-jump, clamp DOM-kanıtlı) React handler'ların
doğru olduğunu zaten kanıtlıyor. Pixel-parity sayısal diff plate-
dominant bbox nedeniyle {dx:0} verdi → görsel side-by-side ile
kesin kanıtlandı.

### Kanıt özeti (fresh build, real asset, big screen)

Clean restart (`.next` silindi + port kill + `preview_start
reused:false`), Claude in Chrome büyük ekran (real MinIO MJ asset set
`cmov0ia37`), DOM+screenshot:
- `{0,0}` sacred no-op: 8 `studio-stage-media-pos` (1 middle + 7
  rail), computed `matrix(1,0,0,1,0,0)`, Phase 125 baseline ✓
- Pad drag pan: mediaPosition {0,0}→{0.553,0.589}, middle
  translate(249,149) + **rail thumb translate(211,127)** (canonical
  sync, `allSameX:true` 8 instance) — görsel: composition + rail
  thumb birlikte sağ-alta kaydı ✓
- Click-to-jump: pad center click → {0.0056,-0.005} (`nearZero`),
  handle 50%/50% ✓
- Clamp: pad çok dışına drag → {x:1,y:1} (`xAtMax/yAtMax`, asla
  aşmadı) ✓
- Zoom×media ayrı katman: outer translate vs inner scale `same
  Element:false`, rail thumb mediaPosition VAR + zoom YOK ✓
- Tilt honest-disabled: 2 view-tab (Zoom enabled / `Tilt · Soon`
  disabled+aria-disabled), **Precision tab YOK** ✓
- Frame export: request body mediaPosition ↔ DOM BİREBİR
  (stale-closure fix sonrası), `sceneSnapshot.mediaPosition` DB
  persist, pixel side-by-side görsel parity ✓
- Product MockupsTab continuity: "Frame Exports" 11 tile, Phase 101
  `aspect-[4/3] bg-ink object-contain` class'lar intakt ✓
- Stale indicator: {0,0}→değişti→geri, epsilon doğru ayrım ✓
- Shots.so re-check: `.drag-handle`/`.shadow-layer`/
  `.position-pad-safearea`/`.viewfinder-div` semantiği bu tasarımla
  birebir tutarlı (handle media pan, plate sabit visible-area) ✓

### Quality gates

- `npx tsc --noEmit`: clean
- `npx vitest run tests/unit/{mockup,selection,selections,products,
  listings}`: **739 passed** (730 baseline + 9 Task 1 media-position
  test; zero regression — `{0,0}` byte-identical no-op)
- `NODE_OPTIONS=--max-old-space-size=4096 npx next build`:
  `✓ Compiled successfully` (Step 1 + stale-closure fix sonrası
  rebuild; default heap OOM exit 137 — kod hatası değil)

### Değişmeyenler (Phase 126)

- **Review freeze (Madde Z) korunur.**
- **Schema migration yok.** `FrameExport.sceneSnapshot` Prisma JSON
  field zaten esnek; mediaPosition serialize, migration yok.
- **WorkflowRun eklenmez.**
- **Yeni big abstraction yok.** Tek pure-TS shared resolver modül +
  Shell `useState` + prop iletimi (store/reducer/context DEĞİL —
  Phase 114 layoutVariant pattern parity). Yeni component / route /
  layout builder / mockup editor / SVG library YOK.
- **Full Remotion migration YOK** — Shots.so davranışı/semantiği
  Kivasy'nin StageScene/Sharp/parity zincirine getirildi; Remotion
  ileride animate/video/motion ayrı tur (kullanıcı kararı).
- **4-kategori ayrımı korundu** — mediaPosition kategori 1 canonical;
  previewZoom (Phase 124-125) kategori 2 preview-only DEĞİŞMEDİ
  (zoom×media kesin ayrı katman, browser-kanıtlı).
- **Preview = Export Truth (§11.0) genişledi** — geometry + asset
  identity + layered effects + shared canonical parameter + **global
  media-position**.
- **Phase 117 single-renderer + Phase 118 chromeless + Phase 125
  zoom (plate sabit, composition scale) baseline'ları intakt** —
  mediaPosition outer-wrapper Phase 125 inner-zoom'a dokunmadan
  eklendi (DOM byte-identical {0,0} no-op).
- **References / Batch / Review / Selection / Mockup Studio /
  Product / Etsy Draft canonical akışları intakt.**
- **3. taraf mockup API path** ana akışa girmedi.
- **Kivasy v4 tokens + Studio `--ks-*` namespace bozulmadı.**

### Hâlâ açık (Phase 127+ candidate)

- **Per-slot media-position** — ayrı advanced/layout-editor modu
  (bu tur global; kullanıcı kararı per-slot ileride).
- **Tilt (media rotate)** — Phase 126 honest-disabled (`Tilt ·
  Soon`); media-rotate ileride ayrı tur (no-op sahte kontrol yok).
- **Shift precision canlı browser e2e** — Chrome synthetic-drag
  `shiftKey` iletmiyor (araç sınırı); unit-test + kod-zinciri
  kanıtlı. Gerçek kullanıcı Shift-drag'inde çalışır.
- **Full Remotion migration** — animate / Etsy video / motion
  export (Phase 126 scope dışı, kullanıcı kararı).
- **View tabs (Tilt) + drop-zone gibi diğer Phase 125'ten devir
  no-op'lar** — kategori 4 preview-only / honest-disabled.

### Bundan sonra en doğru sonraki adım

Phase 126 ile Shots.so-canonical global media-position pad tam:
canonical normalized `mediaPosition` + tek pure-TS shared resolver
(drift yok) + outer-translate/inner-zoom split + preview/export/rail
parity + epsilon stale + honest-disabled Tilt + sacred {0,0} no-op.
Sıradaki adım **Phase 127 candidate**: per-slot media-position
(ayrı advanced/layout-editor modu) veya Tilt media-rotate (honest
implementation). Full Remotion migration (animate/video/motion)
kullanıcı kararıyla ayrı tur.

---

## Phase 127 — Pad metaforu tersine + zoom-framing (Shots.so-canonical: handle = sabit center anchor, viewfinder rectangle hareket eder + 1/zoom daralır; canonical state/export/resolver dokunulmadı)

Phase 126 pad'i çalışıyordu ama metafor TERSTİ: mediaPosition değişince
hem composition hem handle/nokta hareket ediyordu, safe-area sabit
kalıyordu → operatör "nokta mockup item'lerine yapışık" hissediyordu.
Ayrıca pad `previewZoom` framing'inden kopuktu (zoom orta paneli
büyütüyordu ama rail-head pad'de hiçbir şey değişmiyordu). Kullanıcı
net iki düzeltme istedi (state/export/resolver DOKUNULMADAN, yalnız
pad overlay görsel temsili).

### Shots.so canlı browser araştırması (Claude in Chrome, DOM ölçümü)

shots.so editor'de pad DOM'u kod+ölçümle incelendi (kullanıcı kalıcı
kuralı: Shots.so daima gerçek browser'dan):

| Element | Rol | Davranış (ölçülen) |
|---|---|---|
| `.position-pad-safearea` (208×156) | Pad container | `position:relative`, sabit |
| `.shadow-layer` (732×732) | Full media extent | sabit (Kivasy pad-overlay karşılığı) |
| `.viewfinder-div` | **Görünür pencere/framing rectangle** | Boyut zoom ile: zoom **146% → 142×107** (208/1.46, 156/1.46 — `1/zoom` matematiği BİREBİR ölçüldü); konum mediaPosition offset (`left/top` negatif) |
| `.drag-handle` | Viewfinder anchor noktası | mediaPosition {0,0} iken pad MERKEZİNDE (`vfCenterVsPadCenter: {dx:-1,dy:1}` ≈ 0) |

Kesin matematik kanıt: zoom %146 → viewfinder 142×107 = pad'in
%68.5'i = `1/1.46`. Yani Shots.so'da pad = sabit full extent +
içinde **zoom-oranında küçülen + mediaPosition'a göre kayan
viewfinder rectangle + merkez anchor**. Kullanıcının "merkezde
anchor + hareket eden framing + zoom değişince framing değişimi"
isteğinin TAM karşılığı. (Test-aracı sınırı: Shots.so custom slider
+ React state synthetic-drag/dispatchEvent ile tetiklenmedi; ama
iki farklı zoom değerinde viewfinder boyut ölçümü 1/zoom'u
matematiksel olarak kanıtladı — Phase 36/60 emsali dürüst rapor.)

### Fix 1 — Pad metaforu tersine (handle sabit center)

`StageScenePreview` pad overlay JSX yeniden yazıldı:
- **Handle** → `left:50% top:50%` SABİT (mediaPosition'a bağlı
  DEĞİL — kullanıcı isteği: medya offset'inin referans/anchor
  noktası). `pointer-events:none` (anchor göstergesi, sürüklenmez;
  drag pad-overlay'in kendisinde — crosshair).
- **Viewfinder rectangle** (`.k-studio__pad-safearea`) → konum
  mediaPosition'ın **TERS izdüşümü**: `vfCx = 50 − mediaPosition.x
  × travel` (media sağa/+x → viewfinder sola; kamera/viewfinder
  metaforu — kompozisyon sağa giderse görünür pencere sola kayar).
  Browser kanıt: media.x=−0.5531 → vfLeft 56.08% (formül `50 −
  (−0.5531)×11` BİREBİR; `inverseProjectionCorrect: true`).
- **Dim** → `clipPath` polygon ile viewfinder DIŞINI karart
  (viewfinder ile hareket eder; eski sabit `-webkit-mask`/
  `mask-composite` KALDIRILDI — o sabit safe-area içindi).

### Fix 2 — Viewfinder boyutu previewZoom ile (1/zoom)

`StageScenePreviewProps.previewZoomPct` eklendi (Shell previewZoom,
yüzde, 100=no-op; PresetRail rail-head render'ından iletilir —
`zoom = previewZoom ?? localZoom`). Viewfinder boyut oranı:
`vfFrac = clamp(0.18, BASE_FRAC × (100/zoom), BASE_FRAC)`,
`BASE_FRAC = 0.78`. Browser kanıt: zoom %100 → vfFrac 0.78 (inline
W/H 78%); zoom %200 → vfFrac **0.39** (inline 39%, `vfFracMatches:
true` — 0.78×100/200). Shots.so 1/zoom davranışı (zoom artınca
görünür pencere daralır) korundu; orta panel composition Phase
125 canonical zoom ile scale'lendi (`innerScale matrix(2.91,...)`
zoom %200 — Phase 125 baseline intakt).

### BASE_FRAC bug fix (travel=0 — viewfinder kaymazdı)

İlk implementasyon `vfFrac = min(1, 100/zoom)` idi → zoom %100'de
vfFrac=1 → `travel = (1-1)×50 = 0` → viewfinder mediaPosition'a göre
HİÇ kaymıyordu (kullanıcı "dikdörtgen hareket etsin" isteği
karşılanmazdı; browser-kanıtlı: media değişti ama vfLeft hep 50%).
Kök neden: viewfinder zoom %100'de pad'i TAM kaplarsa hareket alanı
(travel) kalmaz. Fix: `BASE_FRAC = 0.78` — viewfinder zoom %100'de
bile pad'in yalnız %78'i → `travel = (1-0.78)×50 = 11 > 0` → media
her zaman (zoom %100 dahil) viewfinder'ı kaydırır. Bu **gerçek kod
bug'ı** (test-aracı sınırı değil); ayrı fixup commit; fresh-build
re-verify edildi.

### State/export/resolver DOKUNULMADI (kullanıcının kesin kuralı)

Phase 127 yalnız **3 dosya**: `StageScenePreview.tsx` (pad overlay
JSX), `studio.css` (pad recipe'leri), `MockupStudioPresetRail.tsx`
(previewZoomPct iletimi). `git diff HEAD~3` kanıtı:
`frame-compositor.ts` / `frame-export.service.ts` /
`media-position.ts` (shared resolver) / `api/frame/export/route.ts`
= **0 değişiklik**. Pad interaction (`onPad*` handlers) hâlâ AYNI
`mediaPosition` state'ini yazar (`normalizePadPointToPosition`
değişmedi). Canonical mediaPosition + Sharp export + Phase 126
parity + Product MockupsTab continuity TAMAMEN intakt — yalnız pad
overlay GÖSTERİMİ değişti.

### Kanıt özeti (fresh build, real asset, big screen — Claude in Chrome)

Clean restart (`.next` silindi + port kill + `preview_start
reused:false`), real MinIO MJ asset set `cmov0ia37`, Frame mode,
DOM+screenshot:
- **Initial ({0,0}, zoom %100)**: handle `dxFromPadCenter:0`
  inline 50%/50% (`handleFixedCenter:true`); viewfinder vfFrac
  0.78 inline W 78% (`viewfinderSmallerThanPad:true`) ✓
- **mediaPosition drag** ({-0.5531,0.3317}): handle hâlâ
  `dxFromPadCenter:0` (`handleStillFixed:true`); viewfinder inline
  `left:56.08% top:46.35%` = formül `50−media×11` BİREBİR
  (`inlineMatchesFormula:true`, `inverseProjectionCorrect:true`);
  composition `matrix(...−249,84)` canonical kaydı ✓
- **zoom %200**: viewfinder vfFrac **0.39** inline 39%
  (`vfFracMatches:true`, 1/zoom); handle hâlâ center; orta panel
  `innerScale matrix(2.91,...)` (Phase 125 zoom intakt) ✓
- Screenshot: rail-head pad'de beyaz nokta MERKEZDE sabit + küçük
  krem viewfinder rectangle sağda (media offset + zoom %200 daralma)
  + dim viewfinder dışı; orta panel composition zoom %200 + media-
  offset'li ✓
- Continuity: export/state dosyaları 0 değişiklik (git diff kanıt)
  → Phase 126 canonical/export/Product baseline intakt ✓

### Quality gates

- `npx tsc --noEmit`: clean
- `npx vitest run tests/unit/{mockup,selection,selections,products,
  listings}`: **739 passed** (Phase 126 baseline; zero regression —
  state/export dokunulmadı)
- `NODE_OPTIONS=--max-old-space-size=4096 npx next build`:
  `✓ Compiled successfully`

### Değişmeyenler (Phase 127)

- **Review freeze (Madde Z) korunur.**
- **Schema migration yok.**
- **WorkflowRun eklenmez.**
- **Yeni big abstraction yok.** 3 dosya pad overlay görsel temsili
  + 1 opsiyonel prop (`previewZoomPct`). Yeni component/route/
  service/store YOK.
- **Canonical mediaPosition state, shared resolver
  (`media-position.ts`), Sharp export (`frame-compositor.ts`),
  Phase 126 export parity + sceneSnapshot persist + stale
  indicator + Product MockupsTab continuity** TAMAMEN intakt
  (git diff: export/state dosyaları 0 değişiklik).
- **Phase 125 canonical zoom (plate sabit, composition scale,
  outer-translate/inner-zoom split) intakt** — Phase 127 yalnız
  pad overlay'e previewZoom GÖSTERİM bağı ekledi (kategori 2
  preview-only; export'a girmez).
- **Composition translate mantığı aynı** — pad interaction hâlâ
  aynı mediaPosition'ı yazar (`normalizePadPointToPosition`
  değişmedi).
- **3. taraf mockup API path** ana akışa girmedi.
- **Kivasy v4 tokens + Studio `--ks-*` namespace bozulmadı.**

### Hâlâ açık (Phase 128+ candidate)

- **Per-slot media-position** — Phase 126'dan devir (ayrı
  advanced/layout-editor modu).
- **Tilt (media rotate)** — Phase 126 honest-disabled (`Tilt ·
  Soon`).
- **Shots.so live slider/state e2e** — Shots.so custom slider +
  React synthetic-drag araç sınırı; viewfinder 1/zoom matematiği
  iki zoom değerinde ölçümle + Kivasy fresh-build browser kanıtıyla
  doğrulandı.
- **Full Remotion migration** — Phase 126'dan devir (kullanıcı
  kararıyla ayrı tur).

### Bundan sonra en doğru sonraki adım

Phase 127 ile pad metaforu Shots.so-canonical: sabit center anchor
(handle) + mediaPosition ters izdüşümüyle hareket eden + 1/zoom
daralan viewfinder rectangle. Kullanıcının iki UX problemi
(yanlış metafor + zoom-kopukluk) çözüldü; canonical state/export/
resolver/Phase 126 parity dokunulmadan. Sıradaki adım **Phase 128
candidate**: per-slot media-position (advanced mod) veya Tilt
media-rotate (honest impl). Full Remotion migration kullanıcı
kararıyla ayrı tur.

---

## Phase 128 — Pad = navigator + viewfinder GROUP (Shots.so-canonical: stable full-extent bg, rectangle+center-dot tek group birlikte hareket; zoom→size, pan→position; canonical state/export/resolver dokunulmadı)

Phase 127 pad metaforunu "handle = sabit pad-center anchor +
viewfinder ayrı ters-izdüşüm" yapmıştı. Kullanıcı bunu da yanlış
buldu — önceki yorum fazla literal alınmıştı: **"beyaz nokta pad'in
merkezine sabit bir nokta değil; viewfinder rectangle'ın merkez
marker'ı. Rectangle hareket ediyorsa nokta da onun merkezinde
birlikte hareket etmeli."** Phase 128 doğru modeli uygular.

### Shots.so gerçek browser analizi (Claude in Chrome, DOM ölçümü)

Shots.so editor canlı incelendi (tab 314516105, kuş kafesi clipart
template yüklü). Kesin DOM yapısı:

| Eleman | Rol | Kanıt |
|---|---|---|
| `.position-pad-safearea` | Navigator surface (208×156 sabit) | parent=`.controls` |
| `.pad-preview > .layout-item` | Full-extent background | `transform: none`, pad ile aynı boyut, **SABİT** |
| `.drag-handle` | Hareket eden GROUP | `transform: matrix(1,0,0,1, 84.27, 64.87)` (translate ile pan) |
| `.viewfinder-div` | `.drag-handle`'ın ÇOCUĞU | handle ile **AYNI center** (`handleVsViewfinderSameCenter: {dx:0, dy:0}`) |

Zoom %101 → viewfinder pad'in %99'u (`wFracOfPad: 0.99` ≈ 1/zoom).
Synthetic pointer event'ler Radix slider/handle'ı tetiklemiyordu
(Phase 126 emsali test-aracı sınırı) ama **yapısal kanıt kesin**:
`padPreviewStayedStatic: true`, `.pad-preview` transform:none.
Doğrulanan model: **statik = navigator/full-extent bg; hareket eden
= viewfinder GROUP (rectangle + onun çocuğu olan center dot, AYNI
center, birlikte); zoom → viewfinder size (1/zoom); pan → handle
GROUP translate (bg sabit)**.

### Net ürün/mimari kararı

- **Rail-head live pad = navigator/control surface**, orta panelin
  küçültülmüş thumb'ı GİBİ DAVRANMAZ semantik olarak (görsel olarak
  StageScene thumb arkada navigator/full-extent zemin; üstüne
  viewfinder GROUP çizilir).
- **Candidate preset thumb'lar AYRI** — canonical preview mantığını
  yansıtmaya devam eder, pad overlay GÖSTERMEZ (yalnız rail-head
  pad sürer). Kullanıcının kritik ayrımı: live-pad navigator
  semantiği ≠ preset-thumb canonical preview.
- **Beyaz nokta bağımsız sabit anchor DEĞİL** — viewfinder
  rectangle'ın `::after` pseudo merkez marker'ı → group ile
  BİREBİR aynı center'da hareket eder.
- **Canonical mediaPosition state, shared resolver
  (`media-position.ts`), export matematiği (`frame-compositor.ts`,
  `frame-export.service.ts`, `api/frame/export/route.ts`),
  composition translate, candidate thumb mantığı DOKUNULMADI** —
  pad interaction hâlâ aynı mediaPosition'ı yazar; yalnız pad
  overlay GÖSTERİMİ değişti (2 dosya: `StageScenePreview.tsx` pad
  overlay JSX + `studio.css` pad recipe).

### Uygulanan slice

**`StageScenePreview.tsx` pad overlay** (Phase 127 ayrı handle +
ters-izdüşüm viewfinder → Phase 128 tek viewfinder GROUP):
- Phase 127 `.k-studio__pad-safearea` (ters-izdüşüm) +
  `.k-studio__pad-handle` (sabit pad-center) KALDIRILDI.
- Tek `.k-studio__pad-viewfinder` GROUP: konum + boyut inline
  style dinamik. `vfFrac = clamp(0.18, BASE_FRAC × (100/z),
  BASE_FRAC)`, BASE_FRAC=0.78 (zoom %100'de bile viewfinder
  pad'i tam kaplamaz → mediaPosition'a travel>0). `travel =
  (1-vfFrac)×50`; `vfCx = 50 + mediaPosition.x × travel` (DOĞRUDAN
  izdüşüm — Shots.so `.drag-handle` media-position anchor: group
  media yönünde hareket; kullanıcı "görünür pencereyi navigator
  alanı üzerinde taşıyorum"). Phase 127 ters izdüşüm (`50 - …`)
  düzeltildi.
- `.k-studio__pad-dim` clipPath viewfinder GROUP'u takip eder
  (group ile birlikte hareket — navigator "kapsam dışı" alanı).

**`studio.css`**:
- `.k-studio__pad-safearea` + `.k-studio__pad-handle` recipe'leri
  KALDIRILDI.
- `.k-studio__pad-viewfinder` recipe (rectangle: border + shadow +
  radius + transition; sabit left/top/w/h YOK — inline override).
- `.k-studio__pad-viewfinder::after` = center dot pseudo (50%/50%,
  14×14, beyaz). Viewfinder'ın ÇOCUĞU → group ile BİREBİR aynı
  center'da hareket (Shots.so `.viewfinder-div` içi dot paritesi;
  bağımsız anchor DEĞİL).

### Browser canlı doğrulama (fresh build, real asset set `cmov0ia37`)

Clean restart (`.next` silindi + port 3000 kill + `preview_start
reused:false`), Claude in Chrome real Studio (`/selection/sets/
cmov0ia37.../mockup/studio`):

- **Eski elemanlar yok**: `oldSafeareaPresent:false`,
  `oldHandlePresent:false` (Phase 127 ayrı handle/safearea
  kaldırıldı).
- **Viewfinder GROUP**: `studio-rail-pad-viewfinder` rendered;
  pad'in %78'i @ zoom %100 (`vfFracAttr:0.7800`).
- **Center dot = ::after pseudo**: `afterContent:""`,
  `afterW:14px`, `afterBg:rgba(255,255,255,0.95)` — viewfinder'ın
  çocuğu, AYNI center.
- **{0,0} no-op**: viewfinder `left:50% top:50%` (pad merkezi).
- **Pan (mediaPosition {-0.56,-0.56})**: viewfinder inline
  `left:50% → 43.84%` (`vfCx = 50 + (-0.56)×11 = 43.84` ✓
  matematik birebir); dim clipPath `4.84%…82.84%` (= 43.84±39 ✓
  — dim viewfinder GROUP'u takip etti). Görsel: viewfinder
  rectangle + center dot BİRLİKTE sol-üste kaydı (önceki: merkez).
- **Zoom (%100→%160)**: `vfFracAttr:0.7800 → 0.4875` = `0.78 ×
  (100/160)` ✓ birebir 1/zoom (Shots.so canonical); navigator bg
  (StageScene plate) **SABİT** (`dx:0 dy:0 wDelta:0 hDelta:0`);
  viewfinder center'da kaldı.
- **Pad overlay COUNT = 1** — yalnız rail-head; 6 preset card
  (cascade/centered/tilted/stacked/fan/offset) pad overlay
  GÖSTERMEZ (live-pad ≠ preset-thumb ayrımı korundu).
- **8 StageScene instance** (1 middle + 7 rail) — Phase 117
  single-renderer intakt; middle stage plate present (canonical
  render mediaPosition prop'u hâlâ akıyor); 6 candidate variant
  intakt.

### Quality gates

- `tsc --noEmit`: clean
- `vitest tests/unit/{mockup,selection,selections,products,
  listings}`: **739 passed** (60 files, zero regression — eski
  `studio-rail-pad-safearea`/`-handle` testid'leri hiçbir testte
  yoktu)
- `next build`: ✓ Compiled successfully (`NODE_OPTIONS=
  --max-old-space-size=4096`)

### Değişmeyenler (Phase 128)

- **Review freeze (Madde Z) korunur.**
- **Schema migration yok.** Yalnız pad overlay JSX + CSS recipe
  (2 dosya: `StageScenePreview.tsx` + `studio.css`).
- **WorkflowRun eklenmez.**
- **Yeni big abstraction yok.** Pad overlay yapısı yeniden
  düzenlendi (ayrı handle+safearea → tek viewfinder group +
  ::after dot); yeni component/route/service/state YOK.
- **Canonical mediaPosition state + shared resolver
  (`media-position.ts`) + export matematiği (`frame-compositor.ts`
  + `frame-export.service.ts` + `api/frame/export/route.ts`) +
  composition translate + Phase 126 export parity DOKUNULMADI.**
  Pad interaction hâlâ aynı mediaPosition'ı yazar (drag handler
  `normalizePadPointToPosition` çağrısı değişmedi).
- **Candidate preset thumb mantığı DOKUNULMADI** — 6 variant
  intakt, pad overlay göstermez (live-pad ≠ preset-thumb).
- **Phase 117 single-renderer (8 StageScene instance) + Phase 118
  chromeless/aspect-aware + Phase 125 zoom (plate sabit,
  composition scale) + Phase 126 global media-position baseline'ları
  intakt.**
- **Middle stage canonical render bozulmadı** (mediaPosition prop
  hâlâ StageScene'e akıyor — yalnız rail-head pad overlay GÖSTERİMİ
  değişti).
- **References / Batch / Review / Selection / Mockup Studio /
  Product / Etsy Draft canonical akışları intakt.**
- **3. taraf mockup API path** ana akışa girmedi.
- **Kivasy v4 tokens + Studio `--ks-*` namespace bozulmadı.**

### Hâlâ açık (Phase 129+ candidate)

- **Per-slot media-position** — ayrı advanced/layout-editor modu
  (bu tur global; kullanıcı kararı per-slot ileride).
- **Tilt (media rotate)** — Phase 126'dan honest-disabled (`Tilt ·
  Soon`); media-rotate ileride ayrı tur.
- **Shift precision canlı browser e2e** — Chrome synthetic-drag
  `shiftKey` iletmiyor (araç sınırı, Phase 126'da belgelendi);
  unit-test + kod-zinciri kanıtlı.
- **Full Remotion migration** — animate / Etsy video / motion
  export (kullanıcı kararı, ayrı tur).
- **View tabs (Tilt) + drop-zone gibi diğer no-op'lar** —
  kategori 4 preview-only / honest-disabled.

### Bundan sonra en doğru sonraki adım

Phase 128 ile pad GERÇEKTEN navigator + viewfinder GROUP: stable
full-extent bg (StageScene thumb arkada SABİT) + viewfinder
rectangle ve center dot TEK group birlikte hareket (zoom→size
1/zoom, pan→position doğrudan izdüşüm); canonical state/export/
resolver/Phase 126 parity + candidate thumb'lar DOKUNULMADAN.
Kullanıcının üç turda netleşen modeli (navigator + viewfinder
group, dot = rectangle merkez marker'ı) birebir karşılandı.
Sıradaki adım **Phase 129 candidate**: per-slot media-position
(advanced mod) veya Tilt media-rotate (honest impl). Full
Remotion migration kullanıcı kararıyla ayrı tur.

---

## Phase 129 — Viewfinder İÇERİK eşleşmesi: navigator viewfinder = middle panel görünür crop'unun GERÇEK izdüşümü (compositionGroup shared, keyfi 1/zoom formülü kaldırıldı, transition bug fix)

Phase 128 viewfinder GROUP'u doğru hareket ettirdi ama
kullanıcı kritik bir hata gördü: **viewfinder rectangle'ın
KONUMU doğru ama İÇERİĞİ middle panel crop'unu temsil
etmiyor**. Somut: middle panel Front View'da "PAS5" görünür
ama navigator viewfinder içinde görünmüyor. "Viewfinder içinde
ne görüyorsam middle panel'de onu görmeliyim" garantisi
yoktu. Phase 129 bu içerik-eşleşmesini kurar.

### Kök neden (browser+DOM+code triangulation, kesin)

Phase 126-128 viewfinder boyutu **keyfi `BASE_FRAC(0.78) ×
100/zoom`**, konumu **keyfi `50 - media×50`** idi — navigator
background'daki full composition ile **HİÇBİR matematiksel
bağ yoktu**. Kanıt: zoom %100'de middle panel'de TÜM
composition görünür (`MID_visFrac w:1.0` — plate full-comp'tan
büyük, `PLATE_FILL_FRAC=0.84` → plate/comp ≈ 1.19, crop YOK)
ama viewfinder pad'in yalnız %78'ini kaplıyordu → viewfinder
middle görünür alandan KÜÇÜK → kenar içerik (PAS5)
viewfinder dışında.

### Shots.so navigator modeli (canlı DOM ölçümüyle kanıtlandı)

- `.pad-preview > .layout-item` = full composition, `transform:
  none` SABİT (zoom/pan UYGULANMAMIŞ — pad'i tam doldurur)
- `.viewfinder-div` = **boş çerçeve** (`innerHTML=""`,
  `hasChildren:0`) — içinde ayrı render YOK
- **viewfinderFracOfPad === editArea/component** her zoom'da
  (zoom %101 → vf %99 = visible/full %99; zoom %102 → vf %98
  = %98). Yani **viewfinder boyutu = görünür-pencere ÷
  full-composition oranı**, keyfi 1/zoom değil.
- Operatör viewfinder'ın **arkasındaki** full-comp
  background'unu görür; viewfinder o sabit background üzerinde
  middle panel'in görünür crop'unu **işaretler** → içerik
  eşleşmesi GARANTİ (tek kaynak: full composition).

### Doğru model (Phase 129)

Navigator background = StageScene chromeless + `stageMediaPosition
NEUTRAL` + `effectiveZoom 1` → full composition (zoom/pan
UYGULANMAMIŞ; bu zaten Phase 128'de doğruydu, dokunulmadı).
Viewfinder = middle panel görünür penceresinin navigator
full-comp uzayındaki **gerçek izdüşümü**:

- **boyut (plate-relative %)** = `compFracOfPlate × visibleFrac`
  - `compFracOfPlate = (grp.bboxW × grp.scale) / plateDims.w`
    (full-comp'un plate'e oranı; grp.scale plate'in
    PLATE_FILL_FRAC'ini kaplar)
  - `visibleFrac = min(1, plateDims / (grp.bboxW × grp.scale ×
    previewZoom))` (middle panel görünür crop oranı; plate
    full-comp'tan büyükse tamamı görünür → min(1,...))
- **konum** = media pan'in full-comp uzayındaki normalize
  izdüşümü: `vfCx = 50 - (ox / fullCompVisual) × compFracOfPlate
  × 100`, `{ox,oy}` = `resolveMediaOffsetPx(mediaPosition,
  plateDims)` (middle panel ile AYNI shared resolver). Görünür
  pencere full-comp'a göre -ofset yönünde kayar → viewfinder
  o yönde.

### compositionGroup paylaşılan kaynağa taşındı

Phase 111-128 `compositionGroup` + `PLATE_FILL_FRAC`
`MockupStudioStage.tsx` içinde private idi. Phase 129 navigator
viewfinder de AYNI full-composition geometrisini kullanmak
zorunda → `cascade-layout.ts`'e taşındı (export). Artık Stage
(preview) + Shell (export) + rail thumb + **navigator
viewfinder** HEPSİ tek canonical composition geometrisinden
okur (§11.0 Preview = Export = Rail-thumb = Navigator-viewfinder
yapısal garanti). Stage davranışı BİREBİR korunur (import edip
aynen çağırır; regression 739/739).

### plate-rect wrapper (cardW=box belirsizliği çözüldü)

StageScene-plate kart-merkezli `scale × plateDims` px; pad-
overlay = host (kart). Viewfinder pad-relative % iken navigator
background plate-frac'ta → uyumsuzluk. Phase 129: viewfinder +
dim, **plate-rect wrapper** (kart-merkezli, px-sabit `scale ×
plateDims`, StageScene-plate ile BİREBİR overlap — DOM kanıt
`dw:0 dh:0 dx:0 dy:0`) içinde plate-relative %. ResizeObserver
`box` belirsizliğine bağımlı değil.

### Kritik bug: transition viewfinder boyutunu donduruyordu

`.k-studio__pad-viewfinder` CSS'inde `transition: width/height/
left/top 90ms` (Phase 128). Viewfinder boyut/konum media+zoom+
box ile sürekli değişir; her parent re-render transition'ı
yeniden tetikliyor → **height ara-değerde DONUYORDU** (canlı
kanıt: `inlineH 63.18%` ama `renderH 77px` = 0.82 plate-frac;
`transition:none` → anında DOĞRU 59.3px = 0.632). Phase 129
transition KALDIRILDI (viewfinder gerçek visible-crop'u
temsil etmeli; animasyon doğruluğu bozamaz — §11.0).

### Browser kanıt (fresh build, real asset set `cmov0ia37`)

İçerik-eşleşmesi 3 case'te DOM-ölçümle kanıtlandı (NAV viewfinder/
navInner === MID plate/inner):

| Case | MID görünür crop | NAV viewfinder | Eşleşme |
|---|---|---|---|
| media0 zoom100 | visFrac w:1.0 h:1.0 / off 0,0 | vfSize w:0.9999 h:0.9998 / off 0,0 | BİREBİR |
| media0 zoom160 | visFrac w:0.7614 h:1.0 | vfSize w:0.7441 h:0.9892 | ~birebir (%2 ölçüm tol.) |
| zoom160 panBR | centerOff x:0.1637 y:0.1781 | vfOff x:0.1637 y:0.1779 | BİREBİR (konum mükemmel) |

`plateRectOverlapsNavPlate: dw:0 dh:0 dx:0 dy:0` (plate-rect =
StageScene-plate birebir). **Görsel kanıt**: zoom %100 +
media{0,0} navigator pad'inde Front View "PAS5" yazısı NET
görünür + viewfinder full-comp'u çevreliyor + center dot
merkezde → PAS5 hem middle panel'de hem viewfinder içinde
(kullanıcının şikayeti çözüldü). Zoom %160'ta viewfinder
yatayda %74 daralır (= middle %76 görünür crop; cascade
landscape olduğu için dikeyde crop yok, h:0.99).

### Shots.so click/drag davranışı

- click sonrası beyaz nokta (viewfinder center marker) =
  viewfinder rectangle'ın geometrik merkezi (::after pseudo,
  Phase 128 baseline korundu — bağımsız anchor DEĞİL)
- click + drag AYNI `normalizePadPointToPosition` shared
  mapping'i kullanır (Phase 126 baseline; pad interaction
  canonical mediaPosition'ı yazar, değişmedi)
- viewfinder gerekirse plate-rect dışına taşar (overflow
  görsel kırpılır, crop anlamı korunur)
- zoom artınca viewfinder visibleFrac ile küçülür (gerçek
  crop oranı, keyfi 1/zoom değil)

### Quality gates

- `tsc --noEmit`: clean
- `vitest tests/unit/{mockup,selection,selections,products,
  listings}`: **739 passed** (60 files, zero regression —
  compositionGroup taşıması + viewfinder rewrite davranış
  bozmadı)
- `next build`: ✓ Compiled successfully (`NODE_OPTIONS=
  --max-old-space-size=4096`)
- Fresh build (`.next` silindi + port kill + `preview_start
  reused:false`) üzerinde 3-case DOM içerik-eşleşme + PAS5
  görsel kanıtı canlı doğrulandı

### Değişmeyenler (Phase 129)

- **Review freeze (Madde Z) korunur.**
- **Schema migration yok.**
- **WorkflowRun eklenmez.**
- **Canonical mediaPosition state + shared resolver
  (`media-position.ts`) + export matematiği (`frame-compositor
  .ts`, `frame-export.service.ts`, `api/frame/export/route.ts`)
  + composition translate DOKUNULMADI** — pad interaction hâlâ
  aynı mediaPosition'ı yazar; yalnız navigator viewfinder
  GÖSTERİM matematiği düzeltildi.
- **Candidate preset thumb mantığı DOKUNULMADI** — overlay
  yalnız rail-head pad'de (onChangeMediaPosition VAR); preset
  thumb'lar yalnız mediaPosition'ı yansıtır (Phase 128
  baseline).
- **Single render path korundu** — StageScene chromeless
  navigator bg = orta panelin AYNI component'i (Phase 117);
  compositionGroup taşıması yalnız module konumu (Stage import
  edip aynen çağırır, Phase 111 davranışı BİREBİR).
- **Yeni big abstraction yok.** compositionGroup + PLATE_FILL_FRAC
  zaten var olan tek fonksiyon; paylaşılan module'e taşındı
  (Phase 115 cascade-layout.ts pattern parity). plate-rect
  wrapper tek div; viewfinder math shared resolver kullanır.
- **Phase 125 zoom (plate sabit, composition scale) + Phase 126
  global media-position + Phase 128 viewfinder GROUP +
  ::after dot baseline'ları intakt** — Phase 129 yalnız
  viewfinder boyut/konum **matematiğini** keyfi formülden
  gerçek visible-crop izdüşümüne çevirdi + transition bug fix.
- **Kivasy v4 tokens + Studio `--ks-*` namespace bozulmadı.**

### Hâlâ açık (Phase 130+ candidate)

- **Zoom160 genişlik %2 sapması** (vfSize w:0.7441 vs middle
  0.7614) — `Math.max(3,...)` clamp veya sub-pixel; operatör
  için imperceptible, içerik eşleşmesi ve konum birebir.
- **Per-slot media-position** — Phase 126'dan devir (ayrı
  advanced/layout-editor modu).
- **Tilt (media rotate)** — Phase 126'dan honest-disabled.
- **Full Remotion migration** — kullanıcı kararıyla ayrı tur.

### Bundan sonra en doğru sonraki adım

Phase 129 ile navigator viewfinder içeriği middle panel
görünür crop'u ile **birebir eşleşir** (DOM 3-case kanıt +
PAS5 görsel): operatör viewfinder içinde ne görüyorsa middle
panel'de onu görür. compositionGroup tek canonical kaynağa
taşındı (Preview = Export = Rail-thumb = Navigator-viewfinder).
Sıradaki adım **Phase 130 candidate**: zoom genişlik %2
sapması ince-ayar veya per-slot media-position (advanced mod).
Full Remotion migration kullanıcı kararıyla ayrı tur.

---

## Phase 130 — Navigator viewfinder: zoom %100 semantiği + center-preserving + clamp-siz boyut (zoom<100 viewfinder büyür, no-pan drift YOK; içerik birebir middle = navigator)

Phase 129 viewfinder içerik eşleşmesini kurmuştu ama kullanıcı
iki kesin bug bildirdi: **(1)** zoom %100'de viewfinder middle
panel görünür alanı tam temsil etmiyor (eksik/yanlış crop
hissi). **(2)** zoom %100 altına inince viewfinder büyümüyor,
sağ-alt köşeye drift ediyor (%25'te en çok). Doğru davranış:
zoom out → görünür pencere büyür, merkez korunur, drift YOK
(center-preserving). Kullanıcı kalıcı kuralı: state/export/
shared resolver/middle stage/composition translate/candidate
preset thumb mantığını bozma; gerekirse `StageScenePreview`'de
radikal temsil düzeltmesi yap.

### Zoom %100 semantiği (koddan kesin çözüldü)

`StageScene` chromeless=false (orta panel) render zinciri:
`.k-studio__stage-plate` (plateDims, `overflow:hidden` →
görünür pencere) → `.k-studio__media-pos` (translate ox,oy =
`resolveMediaOffsetPx(mediaPosition, plateDims)`) →
`.k-studio__stage-inner` (`transform: scale(cascadeScale)`,
cascadeScale = `grp.scale × previewZoom`). `compositionGroup`:
`grp.scale = min(plateW×0.84/bboxW, plateH×0.84/bboxH)` →
composition plate'in **%84'ünü** kaplar (PLATE_FILL_FRAC=0.84).
Zoom %100 = `previewZoom=1.0` → composition plate'in %84'ü →
plate composition'dan **büyük** (1/0.84≈1.19) → **tüm
composition görünür + bir miktar plate-padding**. Yani zoom
%100 semantiği = **"fit/full visible"** (composition tamamı +
çevre padding görünür, crop YOK). Kullanıcının "tam visible
region'ı temsil etmeli" beklentisi tam budur.

### Önceki mantık hatası (Phase 129 `min(1,...)` clamp)

Phase 129 viewfinder boyutu `compFracOfPlate × visibleFrac`,
`visibleFrac = min(1, plateDims / fullCompVisual)`. **`min(1,...)`
clamp** viewfinder'ı composition-size'a SABİTLİYORDU:
- zoom <100'de composition küçülür (`bbox×grp.scale×previewZoom`
  azalır), görünür pencere (plateDims) composition'dan ÇOK büyük
  (zoom %25 → MID_winOverComp w:4.76). Ama `visibleFrac =
  min(1, 4.76) = 1` → viewfinder navInner'ı aşmıyor, **%84'te
  DONUYOR** = kullanıcının Bug 2'si "zoom out'ta viewport
  büyümüyor".
- zoom %100'de bile composition etrafındaki plate-padding'i
  (MID_winOverComp w:1.19) çerçevelemiyordu (yalnız comp-size'a
  sabit) = kullanıcının Bug 1'i "tam görünür alan değil".

### zoom <100 neden drift ediyordu

Bu **gerçekte ölçüm yanılgısıydı** + clamp etkisi. DOM
ölçümünde `NAV_vfOffPlateRect: x:0 y:0` HER zoom'da (drift
fiziksel olarak YOK). Kullanıcının "sağ-alta drift" gözlemi:
clamp viewfinder'ı %84'e dondurduğu için zoom-out'ta
viewfinder büyümüyordu; küçük sabit viewfinder + büyüyen
navigator full-comp arası boyut ilişkisi **görsel olarak**
"viewfinder köşeye sıkışmış" illüzyonu üretiyordu. Clamp
kalkınca viewfinder zoom-out'ta büyür (vfFrac %25→4.0),
navInner'ı taşar, merkez sabit kalır → illüzyon kayboldu.

### Center-preserving nasıl kuruldu

Viewfinder konumu formülü Phase 130'da **değişmedi**
(Phase 129 baseline): `vfCx = 50 - (ox/fullCompW) ×
compFracOfPlateW × 100`, `ox = resolveMediaOffsetPx(...)`
(shared resolver). No-pan'da `mediaPosition = {0,0}` →
`ox = oy = 0` → `vfCx = vfCy = 50` (pad merkezi). Bu
zoom'dan **tamamen bağımsız** (formülde ox=0 → 50 sabit) →
no-pan'da zoom 25/50/75/100/160 viewfinder DAİMA merkezde
(center-preserving garanti, drift matematiksel olarak
imkânsız). Yalnız viewfinder **boyutu** clamp'siz hale
getirildi.

### Fix (StageScenePreview.tsx — tek dosya)

`min(1,...)` clamp kaldırıldı; viewfinder boyutu artık
**middle görünür-pencere / composition** oranı, CLAMP YOK:
- `cascadeScaleW = grp.scale × previewZoom` (middle composition
  görsel boyutu = `bbox × cascadeScale`).
- `winOverCompW = plateDims.w / (bbox × grp.scale × previewZoom)`
  = middle'da görünür-alan/composition oranı (= `MID_winOverComp`
  BİREBİR). Zoom <100 → >1 (pencere comp'tan büyük, viewfinder
  navInner'ı taşar — comp etrafı da görünür); zoom >100 → <1
  (crop).
- `vfPctW = winOverCompW × compFracOfPlateW × 100`. Aspect-locked
  `grp.scale`'de cebirsel sadeleşme: **`vfPctW = (1/previewZoom)
  × 100`** (zoom %100→100%, %25→400%, %160→62.5%). `Math.max(3,
  ...)` yalnız dejenerasyon guard'ı; clamp YOK (viewfinder
  plate-rect'i taşabilir, overflow görsel kırpılır, crop anlamı
  korunur).
- Konum formülü (`vfCx`) DOKUNULMADI → no-pan center-preserving
  + pan içerik eşleşmesi (Phase 129) korunur.

Cebirsel parite (kanıtlandı): `NAV_vfOverNavInner_w` (viewfinder/
navInner) `= ((1/previewZoom)×scale×plateW) / (bbox×grp.scale×
scale) = plateW/(previewZoom×bbox×grp.scale)` **= MID_winOverComp_w
birebir**. Konum: `vfCx = 50 - (ox/(previewZoom×plateDims.w))×100`
ve middle'da plate-merkezinin composition full-comp-uzayındaki
konumu `= -ox/(cascadeScale×bbox) = -ox/(grp.scale×previewZoom×
bbox)` → ikisi **matematiksel olarak birebir** (içerik eşleşmesi
garantisi).

### Ölçüm metriği dürüstlük notu

İlk pan+zoom ölçümünde `MID_centerOff` (inner'ın plate-center'a
göre fiziksel kayması = `mediaPos×0.5`, zoom'dan **bağımsız**)
kullanıldı → zoom %160'ta "0.064 sapma" göründü. Bu **yanlış
referans metriğiydi**: navigator viewfinder full-comp'un hangi
**bölgesini** çerçeveliyorsa, doğru karşılaştırma "middle'da
plate-merkezi composition'ın hangi noktasını gösteriyor"
(`MID_plateInComp = (plateCenter-innerCenter)/innerWidth`,
full-comp normalize — zoom'a duyarlı). Doğru metrikle zoom
%160+pan dahil **CONTENT_match birebir 0**. Sapma yoktu; metrik
yanlıştı.

### Browser doğrulaması (fresh build, real asset cmov0ia37)

Clean restart (`.next` clear + dev fresh, hot-reload state
güvenilmedi). Test set 4-item clipart, real MinIO MJ asset
(PAS5/neon/car).

**No-pan center-preserving (zoom 25/50/75/100/160):**
- Her zoom'da `MID_plateInComp = NAV_vfInComp = 0,0` →
  CONTENT_match 0,0 (BİREBİR) + drift 0 (center-preserving).
- vfFrac: %25→4.0 (4× BÜYÜR — Bug 2 çözüldü), %100→1.0,
  %160→0.625 (küçülür). zoom-out'ta viewfinder gerçekten büyür.
- `NAV_vfOverNavInner` = `MID_winOverComp` (z25 4.76, z75 1.62,
  z50 2.44, z100 1.19, z160 0.744) — slider sonrası birebir
  (SIZE_match 0).

**Pan+zoom (100/25/160 + pan), doğru metrik:**
| Durum | CONTENT_match (içerik) | SIZE_match (boyut) | vfFrac |
|---|---|---|---|
| %100+pan | x:-0.0001 y:0.0002 | w:0 | 1.0000 |
| %160+pan | x:0 y:0.0002 | w:0 | 0.6250 |
| %25+pan | x:0 y:0.0008 | w:0 | 4.0000 |

Hepsi `MID_plateInComp` ↔ `NAV_vfInComp` **birebir** (sub-pixel
<%0.08). Viewfinder içinde görünen ≡ middle panelde görünen
(kullanıcının kritik gereksinimi).

**Görsel kanıt (PAS5):** zoom %100 no-pan → middle full comp +
padding görünür, navigator viewfinder o full-comp'u + padding'i
çerçeveler. zoom %25 no-pan → middle comp küçük plate-merkezde
(sağ-alt drift YOK), navigator viewfinder 4× büyük navInner'ı
taşar, merkez sabit. zoom %100/%160 +pan → middle PAS5 sol-
yukarı kayık + plate kırpık, navigator viewfinder+dot sağ-altta
composition'ın o görünür bölgesini işaretler.

**Mount-time %2.3 boyut sapması (dürüst not):** İlk mount'ta
`SIZE_match` ~%2.3 (`MID_winOverComp` 1.2182 vs 1.1905) —
yalnız ResizeObserver/render senkron-olmama timing artifaktı;
operatör herhangi etkileşim yapınca (slider/pan) `SIZE_match:0`
birebir. Formül matematiksel olarak doğru (cebirsel parite).
İçerik eşleşmesi (asıl kritik metrik) mount dahil HER durumda
birebir 0.

### Dosyalar

- `src/features/mockups/studio/StageScenePreview.tsx`:
  `min(1,...)` clamp kaldırıldı; `winOverCompW/H` clamp'siz
  (`plateDims / (bbox×grp.scale×previewZoom)`); `vfPctW/H =
  winOverComp × compFracOfPlate × 100` (= `(1/previewZoom)×100`,
  `Math.max(3,...)` guard). Konum formülü (`vfCx/vfCy`)
  DOKUNULMADI (Phase 129 center-preserving + pan içerik
  eşleşmesi korunur).
- `cascade-layout.ts` / `MockupStudioStage.tsx` / `studio.css`
  Phase 130'da **DOKUNULMADI** (kullanıcı kuralı: state/export/
  shared resolver/middle stage/composition translate bozma).

### Quality gates

- `tsc --noEmit`: clean (EXIT 0)
- `vitest tests/unit/{mockup,selection,selections,products,
  listings}`: **739 passed (60 files)**, zero regression
- `next build`: ✓ Compiled successfully (NODE_OPTIONS=
  --max-old-space-size=4096)
- Browser: clean restart + fresh build üzerinde no-pan zoom
  25/50/75/100/160 + pan+zoom 100/25/160 + 3 PAS5 görsel kanıt

### Değişmeyenler (Phase 130)

- **Review freeze (Madde Z) korunur.**
- **Schema migration yok.**
- **WorkflowRun eklenmez.**
- **Yeni big abstraction yok.** Tek dosyada (`StageScenePreview
  .tsx`) viewfinder boyut formülünden `min(1,...)` clamp
  kaldırma. Konum formülü, canonical mediaPosition state,
  `media-position.ts` shared resolver, `frame-compositor.ts`
  export matematiği, composition translate, candidate preset
  thumb mantığı DOKUNULMADI.
- **Phase 117 single-renderer (8 StageScene instance) + Phase
  125 zoom (plate sabit, composition scale) + Phase 126 global
  media-position + Phase 128 viewfinder GROUP + Phase 129 içerik
  eşleşmesi + compositionGroup shared kaynak** baseline'ları
  intakt — Phase 130 yalnız viewfinder **boyutunu** clamp'siz
  yaptı (zoom<100 büyür); konum + center-preserving + pan
  içerik eşleşmesi Phase 129 baseline'dan korundu.
- **§11.0 Preview = Export = Rail-thumb = Navigator-viewfinder**
  korunur (boyut formülü cebirsel olarak `MID_winOverComp` ile
  birebir; konum `MID_plateInComp` ile birebir).
- **References / Batch / Review / Selection / Mockup Studio /
  Product / Etsy Draft canonical akışları intakt.**
- **3. taraf mockup API path** ana akışa girmedi.
- **Kivasy v4 tokens + Studio `--ks-*` namespace bozulmadı.**

### Hâlâ kalan (Phase 131+ candidate)

- **Mount-time %2.3 boyut timing artifaktı** — ResizeObserver/
  render senkron-olmama; operatör etkileşiminde birebir. İstenirse
  StageScenePreview'de measure-sonrası recompute guard'ı (içerik
  eşleşmesi zaten mount dahil birebir; düşük öncelik).
- **Per-slot media-position** — ayrı advanced/layout-editor modu
  (Phase 126'dan devir; bu tur global).
- **Tilt (media rotate)** — Phase 126'dan honest-disabled
  (`Tilt · Soon`).
- **Full Remotion migration** — animate / Etsy video / motion
  export (kullanıcı kararıyla ayrı tur).

### Bundan sonra en doğru sonraki adım

Phase 130 ile navigator viewfinder zoom semantiği netleşti
("fit/full visible"), `min(1,...)` clamp kaldırıldı (zoom<100
viewfinder büyür — Bug 2 çözüldü), zoom %100 tam görünür-alanı
temsil eder (Bug 1 çözüldü), no-pan center-preserving (drift
matematiksel imkânsız), pan içerik eşleşmesi (Phase 129) ve
boyut middle panel ile cebirsel birebir. Sıradaki adım
**Phase 131 candidate**: mount-time boyut timing guard'ı veya
per-slot media-position (advanced mod). Full Remotion migration
kullanıcı kararıyla ayrı tur.

---

## Phase 131-132 — revert notu

Phase 131 (zoom reset icon button — canonical DEFAULT_PREVIEW_ZOOM)
KOD olarak commit `fcb2663`'te canlıdır (Shell DEFAULT_PREVIEW_ZOOM
sabiti + PresetRail reset button + studio.css `.k-studio__zoom-reset`).
Phase 132 (resolvePlateBox ilk denemesi) `9f2b5f2`'de yapıldı ama
yetersiz kaldı (StageScenePreview'de PREVIEW_BASE+scale modeli
kalmıştı, kullanıcı "bir sürü yeri bozdun" dedi) → `8783b32` ile
**revert** edildi. Phase 131 dokümantasyon entry'si Phase 132 ile
aynı commit'te yazıldığı için revert onu da geri çekti; Phase 131
zoom-reset DAVRANIŞI fcb2663'te çalışır durumda kalır (regression
yok). Phase 133 doğru yapısal çözümü temiz `fcb2663` baz alarak
sıfırdan kurar.

---

## Phase 133 — Rail/zoom framing: 3-katmanlı kök neden (PREVIEW_BASE scaleWrap + width-transition + flex-shrink) + tek shared resolvePlateBox + boxW/boxH prop + rotated-AABB

Kullanıcı hipotezi: sorun yalnız geometry değil, aynı zamanda
**visibility/clipping/overflow** — middle panelde içerik var, rail
thumb / zoom panelde eksik/kesik hissediliyor; "orada veri var ama
bir katman gizliyor". 16:9 tolere ediliyor, 9:16'da dramatik. Phase
132 yaklaşımı doğru varsayılmadı; temiz `fcb2663` baz alınarak
sıfırdan, **diagnose-first** (kod + canlı browser pixel ölçümü)
ele alındı.

### Kök neden — 3 ayrı katman (canlı browser + DOM/pixel KANITI)

`StageScene` render zinciri (3 yüzey de AYNI component, Phase 117
single-renderer): `.k-studio__stage` (`overflow:hidden`) →
`.k-studio__stage-plate` (`overflow:hidden`, inline `width=plateDims`)
→ `.k-studio__media-pos` (`inset:0`, translate) →
`.k-studio__stage-inner` (`width=grp.bboxW`, `transform:scale`).
"Görünüşte tek render path" idi ama **3 ayrı bug birikmişti**:

1. **PREVIEW_BASE 900×506 + scaleWrap + transform:scale (kök).**
   `StageScenePreview` iki katmanlı sahte boyutlandırma: dış wrapper
   `width:PREVIEW_BASE_W(900) height:PREVIEW_BASE_H(506)` SABİT
   16:9-ish + `transform:scale(s)`; içindeki StageScene plate'i
   aspect-aware `plateDims` ile. İki katman uyumsuz. DOM kanıt
   (9:16 rail P0): cardW 146, scaleWrap 211 (karttan +65 taşıyor),
   plate 57 (kartın **%39'u**), `previewWrap overflow:hidden`
   scaleWrap'i + plate'in scaleWrap-içi konumunu birlikte clip
   ediyor → "thumb'da küçük görüntü + bol boş alan + sağdan kesik".
   Middle panel `plateDimensionsFor` viewport-aware (scaleWrap YOK,
   plate stage'e flex-fill) → composition plate'i PLATE_FILL_FRAC
   ile dengeli dolduruyor → iki yüzey farklı dış sarmalama.

2. **`.k-studio__stage-plate` `transition: width 220ms, height
   220ms`.** Plate boyutu ANİME ediliyordu. Rail thumb plate'i her
   render'da recompute (candidate variant + aspect-resolve + box
   ResizeObserver) → her geçişte width/height transition tetikleniyor,
   React re-render + ResizeObserver sürekli yeniden başlatıyor →
   plate gerçek plateDims'ine HİÇ ulaşmıyor, ARA DEĞERDE donuyor
   (DOM kanıt: fiber `plateDims {179,101}`, inline "179px", ama
   computed/offset **167** → `transition:none` enjekte → ANINDA 179).
   9:16 rail'de plate kartın %39'u kalmasının ASIL kalan kaynağı.
   Phase 129 `.k-studio__pad-viewfinder` transition-donma bug'ının
   AYNISI (emsal).

3. **`.k-studio__stage-inner` flex-shrink.** Plate `display:flex;
   flex-direction:column; align-items:center; justify-content:center`.
   stage-inner flex-item, inline `width:grp.bboxW(532)` +
   `transform:scale`. transform DOM layout box'ı DEĞİŞTİRMEZ → flex
   layout 532px'i görür. MID'de plate geniş (901) → 532 < plate →
   shrink YOK. Rail'de plate küçük (179) → 532 >> 179 → flex-shrink:1
   (default) stage-inner'ı plate'e SIKIŞTIRIYOR (DOM kanıt:
   `innerMeasW 50.58` ≠ 532×scale 150.6 → effective ~178). Composition
   532-uzayında 0-origin normalize ama box 178'e sıkışınca scale
   yanlış referansla → composition stage-inner içinde **%28 sağa
   kayık + plate dışına taşıp clip** (`compCxOffsetFrac 0.28`,
   `clipped:true`; MID'de plate büyük → görünmüyordu).

### Yapısal çözüm (aspect/layout/container-agnostic)

Kullanıcı "tek shared framing + visibility sistemi, çoklu görünüm;
future-proof custom resolution" istedi. Middle panel zaten doğru
(`plateDimensionsFor` viewport-aware → plate flex-fill, composition
PLATE_FILL_FRAC dengeli). Rail/zoom AYNI modele bağlandı:

- **`cascade-layout.ts` yeni `resolvePlateBox(aspectRatio,
  containerW, containerH, opts)`** — container-agnostic aspect-locked
  bbox-fit. Stage `plateDimensionsFor` artık bunu çağırır (davranış
  BİREBİR — eski manuel availW/availH/cap algoritması bunun özel
  hâli; viewport-aware + aspect SHARED + cap korunur, regression
  yok). StageScenePreview de AYNI fonksiyonu kullanır → "görünüşte
  tek" GERÇEKTEN tek.
- **StageScenePreview `PREVIEW_BASE + scaleWrap + transform:scale`
  modeli TAMAMEN KALDIRILDI.** Host `width:100% height:100%
  overflow:hidden display:flex`; StageScene DOĞRUDAN host'u doldurur
  (`.k-studio__stage` `flex:1`); plate o box içinde `resolvePlateBox`
  boyutunda render. Viewfinder plate-rect = `plateDims` (ek scale
  çarpanı YOK).
- **StageScenePreview opsiyonel `boxW`/`boxH` prop.** PresetRail
  zaten kartın px boyutunu hesaplıyor (`railInnerW → cardW/cardHr`,
  `idealW/plateAspect`). Bu prop geçilir → ResizeObserver `box`
  state TAMAMEN bypass. Phase 119 `box` init `{167,90}` (16:9-ish)
  + getBoundingClientRect mount-stale → 9:16 kartta state init'te
  takılıp `resolvePlateBox(0.5625,167,90)={51,90}` → plate %39
  bug'ı **kökten** çözülür (deterministik; prop yoksa eski
  self-measure fallback — geriye uyum).
- **`compositionGroup` ROTATED-AABB bbox.** Phase 111-132 bbox
  layout-bbox (rotation yok sayılıyordu) idi; slot CSS
  `transform:rotate(r)` (item-center) ile cascade -6°/-12° kartları
  görsel olarak layout-bbox dışına taşıyordu → stage-inner
  layout-bbox-merkezli, görsel değil (MID'de ~%1 göz ardı, rail
  küçük plate'de orantısal büyük). Phase 133: bbox = her item'ın
  `r` ile item-merkezi etrafında döndürülmüş 4 köşesinin gerçek
  min/max'ı (görsel sınır). slot render DEĞİŞMEZ (x/y/w/h/r aynı;
  CSS rotate item-center — görsel parity korunur). r=0'da
  rotated-AABB = layout-bbox (regression yok). Stage + Shell export
  AYNI `compositionGroup` → export offset de rotated-AABB
  (Preview = Export Truth §11.0; divergence YOK).
- **`.k-studio__stage-plate` `transition: width/height`
  KALDIRILDI**, `background 320ms` korundu (scene/glass yumuşak
  geçişi — boyut değil, donma yaratmaz). Plate boyutu görsel
  surface'in kendisi; ara-değer = bozuk render (Phase 129
  viewfinder-transition emsali).
- **`.k-studio__stage-inner` `flex-shrink:0; min-width:0`** —
  stage-inner gerçek `grp.bboxW` box'ını KORUR (flex sıkıştıramaz).
  transform:scale görsel ölçek; plate `overflow:hidden` taşmayı
  zaten yönetir (Phase 125 zoom-inspection). MID değişmez (orada
  shrink yoktu); rail'de composition plate-merkezli (offset 0,
  clip yok).

### Browser görsel + pixel doğrulama (canlı, fresh build)

3 fix kümülatif. Her fix sonrası dev clean restart + DOM/pixel
ölçümü + görsel screenshot (`getBoundingClientRect` extension-stale
emsali nedeniyle inline style + fiber `memoizedProps` +
`data-cascade-scale` + screenshot triangülasyonu):

| Metrik | Phase 132-öncesi (9:16, en kötü) | Phase 133 (16:9 + 9:16) |
|---|---|---|
| `plateFracOfCardW` | **0.39** (kartın %39'u) | **1.0** (kartı birebir doldurur) |
| `compCxOffsetFrac` (görsel center) | ~0.29 (rail) | **0** (MID = rail) |
| `compFracW` (içerik/plate) | yüzeyler ayrışıyor | **0.84** (4 yüzey BİREBİR) |
| `clipped` | **true** | **false** (clip yok) |

- **16:9 Mockup + Frame:** MID = P0 = P4 = P3 = ZOOM birebir
  (`plateFracOfCardW:1, compFracW:0.84, compCxOffsetFrac:0,
  clipped:false`). Görsel: tüm rail thumb'lar composition'ı plate
  içinde tam + ortalı; Phase-öncesi "sağdan kesik/minik/boş alan"
  TAMAMEN kalktı.
- **9:16 (asıl kritik, Phase 132-öncesi %39):** plate kartı
  birebir dolduruyor (`pa 0.562, cardPA 0.562`), composition
  plate-merkezli, content/plate oranı 4 yüzeyde aynı (0.84), clip
  yok. Görsel: middle/zoom/preset thumb 9:16 portrait plate AYNI
  composition + framing.
- **Variant'lar (Cascade/Centered/Tilted):** 9:16'da her variant'ta
  MID = P0 = P1 = P2 = ZOOM birebir; variant değişimi tüm yüzeylerde
  tutarlı (görsel screenshot ile Centered/Tilted variant farkı
  doğrulandı).

Kullanıcının başarı ölçütü ("aynı içerik uzayı; birebir crop/fit/
aspect/visibility; aynı sistemden türemiş hissi") **9:16 dahil tam
sağlandı**.

### Future-proof

`resolvePlateBox` aspect-agnostic (ratio param) + container-agnostic
(containerW/H param) + layout-agnostic (`compositionGroup` ayrı
katman). Custom resolution / serbest aspect / farklı canvas size →
yeni aspect `FRAME_ASPECT_CONFIG`'e eklenir, 3 yüzey AYNI fonksiyondan
otomatik tutarlı (yeni yüzey de container box'ını geçirip aynı
zincire girer). `boxW/boxH` prop deterministik (ölçüm-stale
bağımsız). 16:9'a özel yama YOK.

### Final cevap (kullanıcının 12 maddesi)

1. **math mı clipping mi:** İKİSİ BİRDEN — (a) math: scaleWrap+
   plateDims uyumsuzluğu + rotated-AABB eksikliği + flex-shrink
   yanlış scale referansı; (b) visibility: 3 iç içe `overflow:hidden`
   (previewWrap + stageRoot + plate) + transition-donma. Kullanıcı
   hipotezi doğru: içerik render ediliyordu, katmanlar gizliyordu.
2. **hangi wrapper:** StageScenePreview scaleWrap (PREVIEW_BASE×scale)
   + `.k-studio__stage-plate` width-transition + `.k-studio__stage-
   inner` flex-shrink. Üçü birlikte.
3. **içerik render edilip gizleniyor muydu:** EVET — DOM kanıt:
   slot'lar/composition render ediliyordu (compFracW doğru), plate
   matematik clip etmiyordu (`slotClipped:false` plate-level), ama
   scaleWrap-vs-plate boyut farkı + transition-donma + flex-shrink
   composition'ı kart içinde minik/kayık/clipli yapıyordu.
4. **middle vs rail neden ayrışıyordu:** middle `plateDimensionsFor`
   viewport-aware plate flex-fill (scaleWrap yok); rail
   `PREVIEW_BASE×scale` sahte sarmalama + küçük plate'de flex-shrink
   + transition-donma. Aynı StageScene, farklı dış boyutlandırma.
5. **zoom panel neden aynı hata:** zoom panel = rail-head
   `StageScenePreview` (rail thumb ile AYNI kod yolu) → aynı 3
   katman bug'ı.
6. **gerçekten tek render path mı:** Phase 117'den beri "görünüşte
   tek" (aynı StageScene component) ama "pratikte farklı" (plateDims
   3 farklı kaynaktan + scaleWrap). Phase 133'te GERÇEKTEN tek:
   plateDims tek `resolvePlateBox`, scaleWrap kaldırıldı, boxW/boxH
   deterministik.
7. **hangi shared sistem:** `resolvePlateBox` (container-agnostic
   aspect-locked fit) + `compositionGroup` rotated-AABB (görsel
   bbox) — middle/rail/zoom + export tek kaynak (§11.0).
8. **hangi dosyalar:** `cascade-layout.ts` (resolvePlateBox +
   rotated-AABB), `MockupStudioStage.tsx` (plateDimensionsFor →
   resolvePlateBox), `StageScenePreview.tsx` (scaleWrap kaldır +
   boxW/boxH prop), `MockupStudioPresetRail.tsx` (boxW/boxH geçir),
   `studio.css` (plate width-transition kaldır + stage-inner
   flex-shrink:0).
9. **hangi aspect:** 16:9 + 9:16 (asıl kritik). pa/cardPA/
   plateFracOfCardW/compFracW/compCxOffsetFrac/clipped ölçüldü;
   ikisinde de MID=rail=zoom birebir.
10. **hangi layout:** Cascade, Centered, Tilted (9:16'da
    variant-by-variant DOM + görsel; hepsi birebir).
11. **browser görsel doğrulama:** 16:9 Mockup screenshot (rail
    thumb'lar tam+ortalı), 9:16 Cascade screenshot (plate kartı
    dolu), 9:16 Centered screenshot (variant farkı + plate dolu);
    DOM pixel triangülasyonu (stale-free).
12. **custom resolution future-proof:** resolvePlateBox
    aspect/container/layout-agnostic; boxW/boxH deterministik;
    yeni aspect tek kaynaktan tutarlı; 16:9'a özel yama yok.

### Quality gates

- `tsc --noEmit`: clean
- `vitest tests/unit/{mockup,selection,selections,products,
  listings}`: **739 passed (60 files)**, zero regression
- `next build`: ✓ Compiled successfully
- Browser: 16:9 + 9:16 × Cascade/Centered/Tilted, 3 yüzey birebir
  + clip-yok (canlı pixel + görsel KANITLANDI)

### Değişmeyenler (Phase 133)

- **Review freeze (Madde Z) korunur.** Schema migration yok.
  WorkflowRun eklenmez.
- **Yeni big abstraction yok.** `resolvePlateBox` tek pure
  fonksiyon (container-agnostic genelleştirme); `compositionGroup`
  rotated-AABB aynı fonksiyon içinde (bbox hesabı 4-köşe rotate);
  `boxW/boxH` opsiyonel prop. Yeni component/route/service/state
  YOK.
- **Canonical mediaPosition state + shared resolver
  (`media-position.ts`) + export pipeline + composition translate
  + candidate preset thumb mantığı DOKUNULMADI** — yalnız framing/
  visibility (plateDims kaynağı + scaleWrap kaldır + transition +
  flex-shrink + bbox görsel).
- **Phase 125 zoom (plate sabit, composition scale) + Phase 126
  global media-position + Phase 128 viewfinder GROUP + Phase 130
  zoom semantiği + Phase 131 zoom-reset (fcb2663 kodu) +
  Phase 117 single-renderer baseline'ları intakt.**
- **slot render geometrisi (x/y/w/h/r) DEĞİŞMEDİ** — CSS rotate
  item-center; görsel parity korunur (yalnız bbox/normalize görsel
  referansa geçti). Stage + export aynı compositionGroup →
  Preview = Export Truth §11.0 korunur.
- Kivasy v4 tokens + Studio `--ks-*` namespace bozulmadı.

### Bundan sonra en doğru sonraki adım

Phase 133 ile rail/zoom framing+visibility yapısal olarak çözüldü:
middle = rail = zoom 3 yüzey tek `resolvePlateBox` + rotated-AABB
`compositionGroup` → birebir aynı içerik uzayı/crop/fit/aspect/
visibility (9:16 plate %39→%100, clip yok, "aynı sistemden
türemiş"). Sıradaki adım **Phase 134 candidate**: residual
rotation görsel offset fine-tune (MID'de ~0 ama matematiksel
mükemmellik için per-item rotated görsel-center) veya per-slot
media-position (advanced mod). Full Remotion migration kullanıcı
kararıyla ayrı tur.

---

## Phase 134 — Visual chrome unify (proportional radius+shadow tek kaynak) + zoom bounds 75-400 shared source + center marker clamp (rectangle overflow ≠ marker visibility)

Phase 133 rail/zoom framing+visibility'i (3-katmanlı kök neden:
PREVIEW_BASE scaleWrap + width-transition + flex-shrink → tek
shared resolvePlateBox + boxW/boxH prop + rotated-AABB) çözdü.
Phase 134 kullanıcının 3 net görsel/davranış sorununu kapatır.
Stabilization turu — yeni feature/layout builder/mockup editor/
SVG library YOK; Phase 133 shared framing + export/state/shared
resolver DOKUNULMADI (kullanıcı kuralı).

### Kök nedenler (browser+DOM+code triangulation, kanıtlı)

| # | Sorun | Kök neden | Yer |
|---|---|---|---|
| 1 | "koyu gri → siyah → sarı kart" stacking | `.k-studio__stage-plate` `box-shadow: 0 26px 51px rgba(0,0,0,0.32), 0 51px 82px rgba(0,0,0,0.30)` SABİT px. Middle plate ~900px (gölge geniş alana yumuşak yayılır), rail thumb plate ~146px (26-51px offset + 51-82px blur SABİT → küçük karta oranla DEVASA siyah halka). Rail dark bg `--ks-sh #1C1916` üzerinde "koyu gri → siyah halka → sarı kart" | studio.css `.k-studio__stage-plate` |
| 2 | preview kartlar daha yuvarlatılmış | `.k-studio__stage-plate` `border-radius: 26px` SABİT px. Middle ~900px → 26/900≈%2.9 (subtle). Rail ~146px → 26/146≈%18 (çok yuvarlak) | studio.css `.k-studio__stage-plate` + `.k-studio__preset-ring` 14px sabit |
| 3 | zoom bounds dağınık | 3 ayrı hardcoded: Stage `StageSceneOverlays` `ZOOM_MIN=25 ZOOM_MAX=200`, PresetRail slider `min={25} max={200} step={5}`, fallback `useState(100)`. Senkron değil ("hidden eski değer" riski) | MockupStudioStage.tsx + MockupStudioPresetRail.tsx |
| 4 | center dot panel dışına taşıyor | `.k-studio__pad-viewfinder` `left:${vfCx}% top:${vfCy}%` (pan büyükse vfCx 0-100 dışı) + center dot `::after` pseudo viewfinder'ın ÇOCUĞU (`left:50%`) → rectangle taşınca dot da panel dışına (rectangle overflow = marker overflow, ayrım YOK) | StageScenePreview.tsx + studio.css `::after` |

### Fix 1 — Visual chrome unify (proportional radius + shadow, tek kaynak)

Yeni shared helper `cascade-layout.ts` `plateRadiusForWidth(plateW)`
+ `PLATE_RADIUS_FRAC = 0.024` (geometri modülü; tek chrome-radius
kaynağı — Phase 133 `resolvePlateBox` yanına). `MockupStudioStage`
`plateStyle`'a inline `borderRadius = plateRadiusForWidth(plateDims.w)`
+ `boxShadow` plate genişliğine ORANLI (`sW×0.024/0.047` offset,
`sW×0.047/0.076` blur). Tek formül, iki ölçek:
- Middle @~900px → radius ~22px ≈ eski sabit 26px (görünüm
  korundu, regression yok), shadow geniş yumuşak
- Rail/zoom @~146-179px → radius ~4px (min 4 clamp), shadow
  küçük yumuşak (kartı saran DEVASA siyah halka YOK)
- **Oran tutarlı:** middle radiusFrac %2.4 ≈ rail %2.4-2.7
  ("aynı sahnenin küçük versiyonu"; önceki: %2.9 vs %18 ayrışma)

`.k-studio__preset-ring` radius da plate köşesiyle KONSANTRİK:
PresetRail `resolvePlateBox(plateAspect, cardW, cardHr).w` →
`plateRadiusForWidth(railPlateW) + 6` (ring inset:-6px) inline.
CSS sabit 26px/14px/box-shadow → FALLBACK comment (inline her
zaman override; dürüstlük + tutarlılık). chromeless rail stage
zaten bg transparent + dot-grid `::before display:none` (Phase
118 baseline — koyu/siyah ara katman'ın ikinci kaynağı zaten
yoktu; asıl kaynak SABİT box-shadow + radius idi).

### Fix 2 — Zoom bounds 75-400 shared source

Yeni `zoom-bounds.ts` (media-position.ts deseni: pure-TS,
DOM/React import YOK — client+server güvenli, tek kaynak):
`ZOOM_MIN=75`, `ZOOM_MAX=400`, `ZOOM_DEFAULT=100`, `ZOOM_STEP=25`,
`clampZoom(n)`. 3 dağınık hardcoded KALDIRILDI:
- `MockupStudioShell` `DEFAULT_PREVIEW_ZOOM = ZOOM_DEFAULT`
- `MockupStudioStage` `StageSceneOverlays`: lokal `ZOOM_MIN=25/
  ZOOM_MAX=200/clampZoom` silindi → shared import; pill `−/+`
  `stepZoom(±ZOOM_STEP)`, Fit `onChangePreviewZoom(ZOOM_DEFAULT)`,
  disabled `=== ZOOM_DEFAULT`
- `MockupStudioPresetRail` slider `min={ZOOM_MIN} max={ZOOM_MAX}
  step={ZOOM_STEP}`, `useState(ZOOM_DEFAULT)`, `setZoom`
  shared `clampZoom` (slider 500 → 400'e clamp; keyboard/
  programatik savunmacı)
- Navigator viewfinder math (StageScenePreview `previewZoomPct`)
  shared bounds'tan beslenir → otomatik tutarlı (zoom 75 → vf
  `1/0.75=1.333` büyür, zoom 400 → vf `1/4=0.25` küçülür;
  Shots.so canonical 1/zoom). Ekstra değişiklik gerekmedi.

UI + davranış AYNI sınırlar; "hidden eski değer" §12 YASAK
(slider ve pill aynı clamp).

### Fix 3 — Center marker clamp (rectangle overflow ≠ marker visibility)

Phase 128 `.k-studio__pad-viewfinder::after` center dot pseudo
(viewfinder'ın çocuğu) KALDIRILDI. Yeni `.k-studio__pad-marker`
AYRI element, plate-rect'in DOĞRUDAN çocuğu. StageScenePreview:
- **Viewfinder rectangle SERBEST:** `vfCx/vfCy` plate-rect
  dışına taşabilir = görünür pencere overflow (Shots.so
  canonical, navigator "kapsam dışı" sinyali — DEĞİŞMEZ)
- **Marker CLAMP'LI:** `dotCx = clamp(dotMarginXPct, 100-
  dotMarginXPct, vfCx)`, `dotCy` benzer. `DOT_PX=14`,
  marginX/Y = `(7/plateRectW)×100%` → dot tamamen plate-rect
  içinde. `data-clamped` attr (vfCx≠dotCx ise true)
- Rectangle ile marker bağımsız: viewfinder %98 (overflow)
  iken marker %96.08/%93.07 (clamp'lı, panel içinde) — ayrım
  net. Canonical mediaPosition/export DEĞİŞMEZ (yalnız dot
  GÖSTERİM konumu clamp'lı; control affordance kaybolmaz)

### Browser doğrulama (canlı, fresh build, real asset)

Clean restart (`.next` clear + dev fresh), Chrome büyük ekran
(viewport ~1417×1042), real MinIO MJ asset set `cmov0ia37`
(PAS5/neon/car), DOM ölçüm + screenshot:

**16:9 (default):**
- mid plate w=901 radius **22px** shadow `22px 42px/42px 68px`;
  rail0 plate w=179 radius **4px** shadow `4px 8px/8px 14px`;
  oran %2.4≈%2.2 (radiusUnified)
- chromeless rail: bg `rgba(0,0,0,0)`, dot-grid `::before
  display:none`; mid bg `rgb(17,16,9)` (korundu)
- ring inline radius 10px (railPlateW + 6, plate köşesiyle
  konsantrik); eski `::after` pseudo content `none` (kaldırıldı)
- slider **min=75 max=400 step=25 value=100**; pill val=100%
  Fit disabled@default
- screenshot: middle + 6 rail thumb (Cascade/Centered/Tilted/
  Stacked/Fan/Offset) AYNI cream/peach plate, subtle köşe,
  kartı saran siyah halka YOK ("aynı sahnenin küçük versiyonu")

**Marker clamp (big pan {x:-0.96,y:-0.96}):**
- viewfinder `left:98% top:98%` → `vfOverflowsPlateRect: true`
  (SERBEST overflow korundu)
- marker `left:96.0894% top:93.0693%` `data-clamped="true"`
  → `markerInsidePanel: true` (panel DIŞINA çıkmadı)

**Zoom 75:** railZoomVal=pillVal=75% (senkron); mid composition
`matrix(1.06679)`; vf `vfFrac=1.333 w/h:133%` (1/0.75); marker
no-pan center, markerInsidePanel=true (vf %133 taşsa bile)

**Zoom 400 + clamp:** slider 500 → `clampedTo400: true` (rail/
pill/slider hepsi 400); mid composition `matrix(5.68952)` (4×);
vf `vfFrac=0.25 w/h:25%` (1/4); pill zoom-in disabled@max;
marker panel içinde

**9:16 portrait:** mid 492×875 radius 12px frac 0.0244; rail
146×260 radius 4px frac 0.0274; **radiusUnified: true**;
aspectPortrait=true (Phase 133 shared framing korundu); rail
bg transparent; markerInsidePanel=true; screenshot: middle +
rail AYNI portrait cream plate subtle köşe (stacking YOK)

### Quality gates

- `tsc --noEmit`: clean (EXIT=0, 0 satır)
- `vitest tests/unit/{mockup,selection,selections,products,
  listings}`: **739/739 PASS** (60 files, zero regression —
  yeni zoom-bounds.ts + helper test fixture'ları etkilemedi)
- `next build`: ✓ Compiled successfully (`NODE_OPTIONS=
  --max-old-space-size=4096`; "Dynamic server usage" log'ları
  pre-existing auth-route prerender uyarısı — Phase 134 ile
  ilgisiz, build başarılı)
- Browser: 16:9 + 9:16 × zoom 75/100/400 + big-pan marker
  clamp + clamp 500→400 (canlı DOM + screenshot KANITLANDI)

### Final cevap (kullanıcının 11 maddesi)

1. **siyah/koyu ara katman hissinin kök nedeni:** `.k-studio__
   stage-plate` `box-shadow: 0 26px 51px..., 0 51px 82px...`
   SABİT px. Middle plate ~900px → gölge geniş alana yumuşak;
   rail thumb plate ~146px → SABİT 26-51px offset + 51-82px
   blur küçük karta oranla DEVASA siyah halka. Rail dark bg
   `--ks-sh #1C1916` üzerinde "koyu gri → siyah halka → sarı
   kart" stacking illüzyonu. (chromeless bg/dot-grid Phase 118'de
   zaten gizliydi — o kaynak değildi).
2. **hangi layer/wrapper:** `.k-studio__stage-plate` (plate'in
   kendisi) box-shadow + radius; ek olarak `.k-studio__preset-
   ring` `border-radius: 14px` sabit (plate köşesiyle uyumsuz).
3. **radius farkı neden:** `border-radius: 26px` SABİT px iki
   farklı plate genişliğinde farklı oran üretiyordu — middle
   ~900px (26/900≈%2.9 subtle) vs rail ~146px (26/146≈%18 çok
   yuvarlak). Sabit px ≠ oransal.
4. **nasıl unify ettim:** radius + shadow plate genişliğine
   ORANSAL (shared `plateRadiusForWidth` helper, tek formül
   `plateW×0.024`; shadow `sW×0.024/0.047/0.076`). Middle ile
   AYNI görsel oran (%2.4) iki ölçekte → "aynı sahnenin küçük
   versiyonu". CSS sabitler fallback comment'e indirildi (inline
   override). ring radius `plateRadiusForWidth(railPlateW)+6`
   plate köşesiyle konsantrik.
5. **zoom min/max kaynak:** yeni `zoom-bounds.ts` (pure-TS,
   media-position.ts deseni) — `ZOOM_MIN=75 ZOOM_MAX=400
   ZOOM_DEFAULT=100 ZOOM_STEP=25 clampZoom`. Tek kaynak.
6. **75-400 her yerde tutarlı:** Shell DEFAULT, Stage pill
   (stepZoom/Fit/disabled), PresetRail slider (min/max/step/
   useState/setZoom clamp), navigator viewfinder math HEPSİ
   bu modülden import — 3 dağınık hardcoded silindi; "hidden
   eski değer" §12 YASAK (DOM kanıt: slider min=75 max=400
   step=25, slider 500→400 clamp, pill ↔ slider senkron).
7. **center marker clamp:** `.k-studio__pad-viewfinder::after`
   pseudo KALDIRILDI; yeni `.k-studio__pad-marker` AYRI element
   plate-rect'in doğrudan çocuğu. Konum `dotCx/dotCy =
   clamp(margin, 100-margin, vfCx/vfCy)` (DOT_PX=14, margin =
   dot-radius/plateRect %); marker daima plate-rect (≈ panel)
   içinde.
8. **rectangle overflow ↔ marker clamp ayrımı:** viewfinder
   rectangle `vfCx/vfCy` SERBEST (plate-rect dışına taşar =
   görünür pencere overflow, Shots.so canonical — DEĞİŞMEDİ).
   Marker AYRI element (viewfinder'ın çocuğu DEĞİL artık) →
   bağımsız clamp'lı. DOM kanıt: vf %98 overflow iken marker
   %96.08 clamp'lı panel içinde.
9. **değiştirdiğim dosyalar:** `zoom-bounds.ts` (YENİ),
   `cascade-layout.ts` (plateRadiusForWidth + PLATE_RADIUS_FRAC),
   `MockupStudioStage.tsx` (inline radius/shadow + shared zoom),
   `MockupStudioPresetRail.tsx` (shared zoom slider + ring
   radius), `MockupStudioShell.tsx` (DEFAULT=ZOOM_DEFAULT),
   `StageScenePreview.tsx` (ayrı clamp'lı marker), `studio.css`
   (radius/shadow/ring FALLBACK comment + `::after`→`.k-studio__
   pad-marker`).
10. **browser'da doğrulanan state'ler:** 16:9 (mid 901 / rail
    179, radius+shadow oran, chromeless, slider 75-400, marker
    center), big-pan {-0.96,-0.96} (vf overflow + marker
    clamp'lı), zoom 75 (vf 1.333), zoom 400 + clamp 500→400
    (vf 0.25, pill disabled@max), 9:16 portrait (mid 492 / rail
    146, radiusUnified, aspectPortrait, marker içinde) — +2
    screenshot (16:9 + 9:16 stacking YOK).
11. **neden yeni divergence yok:** Phase 133 shared framing
    (resolvePlateBox/compositionGroup/plateDims) DOKUNULMADI;
    middle/rail/zoom içerik eşleşmesi DOM kanıtla korundu
    (aspectPortrait, radiusUnified, composition matrix). Radius/
    shadow tek shared helper (her yerde aynı formül — drift
    imkânsız). Zoom tek shared modül (3 hardcoded → 1 kaynak).
    Marker ayrı element ama mediaPosition/export/canonical
    state/composition translate DEĞİŞMEDİ (yalnız dot GÖSTERİM
    konumu). vitest 739/739 (zero regression) + Phase 133
    davranışı browser'da BİREBİR.

### Değişmeyenler (Phase 134)

- **Review freeze (Madde Z) korunur.**
- **Schema migration yok.**
- **WorkflowRun eklenmez.**
- **Yeni big abstraction yok.** `zoom-bounds.ts` (3 sabit +
  clamp) + `plateRadiusForWidth` (tek formül) — media-position.ts
  deseni; yeni component/route/service/state YOK.
- **Phase 133 shared framing** (resolvePlateBox + boxW/boxH +
  rotated-AABB + compositionGroup) DOKUNULMADI; middle/rail/zoom
  içerik eşleşmesi korundu (DOM kanıt: radiusUnified +
  aspectPortrait + composition matrix tutarlı).
- **Canonical mediaPosition state + media-position.ts shared
  resolver + frame-compositor.ts export + composition translate
  + candidate preset thumb mantığı** DOKUNULMADI (Fix 3 yalnız
  marker GÖSTERİM konumu clamp'lı; viewfinder rectangle
  semantiği değişmedi).
- **Phase 125 zoom (plate sabit, composition scale) + Phase 128
  viewfinder GROUP + Phase 130 viewfinder math + Phase 131
  zoom-reset (fcb2663 kodu) baseline'ları intakt** (Phase 134
  yalnız bounds'ı tek kaynağa çekti + marker'ı ayrı element
  yaptı; viewfinder boyut/konum formülü DEĞİŞMEDİ).
- **3. taraf mockup API path** ana akışa girmedi.
- **References / Batch / Review / Selection / Mockup Studio /
  Product / Etsy Draft canonical akışları intakt.**
- **Kivasy v4 tokens + Studio `--ks-*` namespace bozulmadı.**

### Hâlâ kalan (Phase 135+ candidate)

- **Residual rotation görsel offset** (Phase 111/133'ten devir)
  — MID'de ~0; matematiksel mükemmellik için per-item rotated
  görsel-center (Preview=Export riski yüksek, ertelenmiş).
- **Per-slot media-position** — ayrı advanced/layout-editor modu
  (Phase 126'dan devir; bu tur global).
- **Tilt (media rotate)** — Phase 126'dan honest-disabled
  (`Tilt · Soon`).
- **Gerçek Etsy V3 API POST e2e** — production credential.
- **Yeni SVG/layout builder/mockup editor** — §13.A ertelenmiş.

### Bundan sonra en doğru sonraki adım

Phase 134 ile visual chrome unify (proportional radius+shadow
tek shared helper), zoom bounds 75-400 (tek shared modül), center
marker clamp (rectangle overflow ≠ marker visibility) tamam.
Kullanıcının 3 sorunu da 16:9 + 9:16 + zoom 75/400 + big-pan
browser kanıtıyla çözüldü; Phase 133 shared framing + canonical
state/export DOKUNULMADI. Sıradaki adım **Phase 135 candidate**:
residual rotation görsel offset fine-tune veya per-slot media-
position (advanced mod). Full Remotion migration / yeni SVG /
layout builder / mockup editor §13.A'da ertelenmiş kalır.

---


## Phase 135 — Zoom-aware pan reach (kök neden + canonical fix) + dokümantasyon refactor

> Canonical invariant → `docs/claude/mockup-studio-zoom-navigator.md`
> §5/§7. Bu entry tarihsel "neden" bağlamıdır (NOT authoritative —
> bu dosya archive).

**Davranış (Fix A — commit `cdb7b10`):** Phase 134 sonrası kalan
edge-case: zoom >100% (örn. %400) viewfinder/marker köşelere
ulaşamıyor; zoom %75 de test edildi. Kullanıcı hipotezi: marker
clamp doğru fikir ama yanlış uzayda uygulanmış VEYA rectangle range
↔ marker range yanlış bağlanmış VEYA pan reach kaybediliyor.

Diagnose (canlı browser + DOM ölçümü, Chrome): kök neden marker
clamp DEĞİL (z400'de `mkClamp:false` — tetiklenmiyordu bile).
Gerçek kök: `vfCx = 50 − (ox / fullCompW) × compFracOfPlateW × 100`;
`ox = mediaPos × plateW × MEDIA_POSITION_PAN_K(0.5)` **zoom'dan
bağımsız**, `fullCompW = bbox × grp.scale × previewZoom` zoom ile
büyüyor → zoom %400'de `vfCx ≈ 50` (köşe yok). `.k-studio__media-pos`
(translate, outer) ile `.k-studio__stage-inner` (scale, inner)
AYRI katman; translate zoom'dan bağımsızdı.

Shots.so canlı browser ölçümü: `.component` `transform:
matrix(scale,0,0,scale, tx, ty)` — scale+translate birleşik tek
transform, translate zoom ile ölçekleniyor (büyük composition →
büyük translate → köşeler erişilebilir).

Fix: `.k-studio__media-pos` translate `ox × effectiveZoom`
(`effectiveZoom = chromeless ? 1 : previewZoom` — rail thumb DAİMA
1, bağımsız). `resolveMediaOffsetPx` (canonical state + Sharp
export) DEĞİŞMEDİ — zoom export'ta yok (composition scale=1,
pan-reach orada zaten yeterli) → §11.0 Preview = Export korunur
(divergence YOK). `vfCx` numerator `panOx = ox × previewZoom` →
cebirsel sadeleşme (`previewZoom` pay/payda iptal) → vfCx
zoom-bağımsız (mediaPos = ±1 her zoom'da köşeye ulaşır; içerik
eşleşmesi Phase 129 korunur). `{0,0}` → `0 × zoom = 0`
byte-identical no-op.

3 kavram kesin ayrıldı (Phase 135 dersi): (1) viewfinder rectangle
overflow SERBEST (Shots.so canonical), (2) center marker
visibility CLAMP'li (Phase 134), (3) pan reach / navigable range
TAM (zoom-aware). Visibility clamp ↔ interaction clamp
karıştırılmaz.

Browser doğrulama (Claude in Chrome, büyük ekran, clean restart,
fresh build): zoom 75/100/160/400 × no-pan + 4 köşe (TL/TR/BL/BR)
→ vfL≈0%@BR ≈100%@TL her zoom; marker DAİMA panel içinde
(`mkInside:true`); rectangle overflow korundu (vfL 0/100%
olabilir). B-consistency: 16:9/1:1/4:5/9:16 × Cascade/Tilted/Fan
`contentMatch=true` (Phase 133 shared framing + Phase 134
proportional radius korundu, yeni divergence YOK). Quality gates:
`tsc --noEmit` clean, `vitest` 739/739, `next build` ✓. Değişen
dosyalar: `MockupStudioStage.tsx` (`.k-studio__media-pos` translate
× effectiveZoom + `data-pan-zoom`), `StageScenePreview.tsx` (vfCx/
vfCy numerator × previewZoom). Canonical state / shared resolver
(`media-position.ts`) / Sharp export (`frame-compositor.ts`) /
candidate preset thumb mantığı DOKUNULMADI.

**Dokümantasyon refactor:** CLAUDE.md 27,694 satır / 1.33 MB →
authoritative core (2,672 satır / 104 KB) + "Authoritative Doc
Router" tablosu + "CRITICAL DOCUMENTATION PATTERN" kuralı. Phase
anlatısı (≈24,300 satır / %88, Phase 12 → 135) `docs/claude/
archive/phase-log-12-96.md` + `phase-log-97-135.md`'ye
"ARCHIVE — NOT AUTHORITATIVE" damgalı taşındı (bilgi kaybı YOK —
karar mantığı topic doc'lara invariant özetlendi). Mockup Studio
Behavior Contract (canonical living invariant, §1-13) +
4 modül-bazlı topic doc (`mockup-studio-contract.md`,
`mockup-studio-zoom-navigator.md`, `mockup-studio-framing.md`,
`mockup-studio-rail-preview.md`, `known-issues-and-deferred.md`)
`docs/claude/` altına "AUTHORITATIVE — CURRENT" damgalı çıkarıldı.
Diğer modüllerin invariant'ları (Canonical Surface A–Y,
Library/Selections/Products boundary, Mockup 3-tip, Mobile/Native,
Madde Z Review Freeze, Marka) CLAUDE.md core'da KALDI (archive'a
TAŞINMADI — kullanıcı guardrail'i: diğer modüllerin authoritative
bilgisi yanlış archive edilmesin). Mevcut docs/ authoritative
(MVP_ACCEPTANCE, IMPLEMENTATION_HANDOFF, PRODUCTION_SHAKEDOWN,
DESIGN_PARITY_CHECKPOINT, review/) dokunulmadı — router tablosuna
eklendi. Reddit doc-router pattern adapte edildi (router +
"READ THIS FIRST" + "CRITICAL DOCUMENTATION PATTERN"); değiştirildi
(emoji yerine açık `> **AUTHORITATIVE**` / `> **ARCHIVE — NOT
AUTHORITATIVE**` metin başlıkları; ChromaDB MCP overkill reddedildi;
modül-bazlı az sayıda doc, çok sayıda küçük dosya değil).
