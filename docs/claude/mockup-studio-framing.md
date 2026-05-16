# Mockup Studio — Framing / Composition Geometry

> **AUTHORITATIVE — CURRENT.** Bu dosya plate boyutlandırma,
> composition grup kilitleme, cascade layout ve aspect-locked
> bbox-fit davranışının **canonical invariant** tanımıdır. Phase
> narrative DEĞİL. Tarihsel anlatı (Phase 111-133 adım adım) için
> `docs/claude/archive/phase-log-97-135.md` (NOT authoritative).
>
> **Son güncelleme:** Phase 135 (2026-05-16)
>
> İlgili authoritative dokümanlar:
> - `docs/claude/mockup-studio-contract.md` — §2 stage continuity,
>   §3 plate behavior, §8 layout count, §11.0 Preview = Export Truth
> - `docs/claude/mockup-studio-zoom-navigator.md` — zoom composition
>   scale bu geometrinin üzerine biner
> - `docs/claude/mockup-studio-rail-preview.md` — rail thumb aynı
>   composition geometrisini tüketir
> - `docs/claude/known-issues-and-deferred.md` — residual rotation
>   görsel offset, per-slot media-position

---

## 1. Tek canonical geometri kaynağı

- `src/features/mockups/studio/cascade-layout.ts` tek modül:
  `resolvePlateBox`, `compositionGroup`, `PLATE_FILL_FRAC`,
  `plateRadiusForWidth`, `PLATE_RADIUS_FRAC`, `cascadeLayoutFor`,
  `cascadeLayoutForRaw`, `applyLayoutVariant`, `centerCascade`.
- **Stage (preview) + Shell (Sharp export) + rail thumb +
  navigator viewfinder HEPSİ bu TEK modülden okur** → Preview =
  Export = Rail-thumb = Navigator-viewfinder yapısal garanti
  (§11.0). Ayrı geometri kopyalama / paralel layout math YASAK
  (sessiz drift §12).
- Pure-TS (DOM/React/sharp import YOK) → client + server build
  boundary korunur (Madde V).

## 2. `resolvePlateBox` — container-agnostic aspect-locked bbox-fit

- İmza: `resolvePlateBox(aspectRatio, containerW, containerH, opts)`.
- Verilen container kutusuna (viewport-aware stage alanı veya rail
  kart kutusu veya zoom panel) **aspect-locked bbox-fit** plate
  boyutu döner: hem `containerW` hem `containerH`'a sığacak, aspect
  ratio **DAİMA sabit** (16:9 → 1.777-1.780 her viewport/yüzey;
  9:16 → 0.562; Phase 110/133 canonical).
- `MockupStudioStage.plateDimensionsFor` artık bunu çağırır
  (davranış BİREBİR — eski manuel availW/availH/cap algoritması
  bunun özel hâli; viewport-aware + aspect SHARED + cap korunur,
  regression yok).
- `StageScenePreview` de AYNI fonksiyonu çağırır → "görünüşte tek
  render path" GERÇEKTEN tek.
- **Future-proof:** aspect-agnostic (ratio param) + container-
  agnostic (W/H param) + layout-agnostic (`compositionGroup` ayrı
  katman). Yeni aspect `FRAME_ASPECT_CONFIG`'e eklenir → 3 yüzey
  AYNI fonksiyondan otomatik tutarlı. 16:9'a özel yama YASAK.

## 3. Aspect SHARED state (Mockup ↔ Frame)

- `frameAspect` Shell-level **SHARED state** (mode-AGNOSTIC). Frame
  mode'da seçilen aspect Mockup mode'a da geçer; Mockup'a dönünce
  plate aynı aspect'te kalır (Phase 95 canonical, Shots.so parity).
- Aspect değişimi: caption + toolbar status badge + sağ rail
  preset thumb aspect refresh + plate bbox-fit. Cascade plate
  içine `cascadeScale` ile orantısal sığar (portrait aspect'te
  cascade küçülür ama tüm slot'lar görünür).

## 4. `compositionGroup` — plate-relative LOCKED group + rotated-AABB

- Cascade ve benzeri çoklu mockup item setleri **tek tek bağımsız
  obje DEĞİL** — plate'e bağlı tek locked composition group.
- Algoritma:
  1. Composition'ın **gerçek bbox**'ı hesaplanır (sabit 572×504
     DEĞİL — Phase 111).
  2. `scale = min(plateW × PLATE_FILL_FRAC / bboxW, plateH ×
     PLATE_FILL_FRAC / bboxH)`, `PLATE_FILL_FRAC = 0.84`. **Clamp
     YOK** (plate büyürse scale > 1 → group orantılı büyür;
     küçülürse küçülür — kompozisyon karakteri bozulmaz).
  3. Items **0-origin normalize** (minX/minY çıkar — relative
     offset'ler değişmez).
  4. `.k-studio__stage-inner` BBOX-TIGHT (`width = bboxW,
     height = bboxH`) + `transformOrigin: center` + CSS
     plate-center → **group center = plate center otomatik**
     (drift sıfır; rotation görsel offset'i simetrik dağılır,
     ~3-9px residual rotation görsel).
- **Rotated-AABB (Phase 133):** bbox = her item'ın `r` ile
  item-merkezi etrafında döndürülmüş **4 köşesinin gerçek
  min/max'ı** (görsel sınır — layout-bbox değil). Slot render
  geometrisi (x/y/w/h/r) DEĞİŞMEZ; CSS rotate item-center →
  görsel parity korunur. `r = 0`'da rotated-AABB =
  layout-bbox (regression yok). Stage + export AYNI
  `compositionGroup` → Preview = Export Truth (divergence YOK).
- `.k-studio__stage-inner` `flex-shrink: 0; min-width: 0` (Phase
  133) — stage-inner gerçek `grp.bboxW` box'ını KORUR (flex
  sıkıştıramaz); transform:scale görsel ölçek; plate
  `overflow: hidden` taşmayı yönetir.

## 5. Plate chrome — proportional radius + shadow (Phase 133/134)

- `plateRadiusForWidth(plateW) = Math.max(4, Math.round(plateW ×
  PLATE_RADIUS_FRAC))`, `PLATE_RADIUS_FRAC = 0.024`. Plate köşe
  yarıçapı plate genişliğiyle orantılı → her yüzey/ölçekte (orta
  panel büyük plate, rail küçük plate, zoom panel) aynı görsel
  aile (rail thumb'da köşe orantısız kalın değil).
- Plate box-shadow Phase 134'te proportional (plate boyutuna
  oranlı katmanlar).
- `.k-studio__stage-plate` `transition: width / height`
  **KALDIRILDI** (Phase 133 — plate boyutu sürekli recompute
  edilir; transition ara-değerde donma yaratıyordu; Phase 129
  viewfinder-transition donma bug'ının AYNISI). `background
  320ms` korundu (scene/glass yumuşak geçişi — boyut değil).

## 6. Cascade layout variant — canonical shared parameter

- `cascadeLayoutFor(deviceShape, count, variant)`:
  - `cascadeLayoutForRaw(kind)` = per-productType BASE boyut
    (shape-specific impl detail — kategori 3, registry içinde
    AYRI: sticker kare, telefon dik 416, wall_art portrait).
  - `applyLayoutVariant(base, variant)` = boyutları KORUYUP
    dizilim/rotation/offset variant'a göre üretir (canonical
    shared parameter — kategori 1, productType-agnostic).
  - `centerCascade(items, count)` = count uygulandıktan SONRA
    bbox-merkez (single-item count=1 plate ortasında, Phase 97).
- `StudioLayoutVariant` canonical Shell state (cascade / centered
  / tilted / stacked / fan / offset; Phase 114). Rail preset
  onClick → Shell setter → Stage cascade + rail thumb + Frame
  export HEPSİ aynı değerden okur. "cascade" = Phase 77-113
  baseline (regression yok).
- Operatör preset seçince preview cascade + exported PNG
  GERÇEKTEN değişir (browser + pixel kanıtlı; Phase 114 preset
  NO-OP bug'ı kapandı).

## 7. Layout count (Phase 96/97)

- 1/2/3 cascade item count (Shots.so parity). N×M grid (1..5 ×
  1..5) **YASAK** (Shots.so'da yok; template-level multi-slot
  Phase 72-76 ile zaten karşılanıyor — Phase 97 self-critique
  kararı).
- Rail-head 1/2/3 buttons → Shell `layoutCount` state → (rail
  thumb display count + stage cascade count) senkron (mode-
  AGNOSTIC).
- Single-item (count=1) cascade plate ORTASINDA (`centerCascade`
  count uygulandıktan SONRA hesaplanır).

## 8. Composition primitive resmî sınırı (Phase 112 — erken
abstraction guard)

- `compositionGroup(items, plateW, plateH)` **reusable primitive**,
  cascade'e özel DEĞİL: herhangi `{si, x, y, w, h, r, z}[]` alır →
  gerçek bbox + aspect-locked plate-fit scale (clamp YOK) + items
  0-origin normalize + `{scale, bboxW, bboxH, items}` döner.
  **Cascade = first client.**
- Evrensel kabul edilen kavramlar: composition bbox, normalized
  local coordinates, plate-fit strategy, anchor policy (bbox-tight
  stage-inner + CSS plate-center), locked-group transform.
- Yeni layout → `cascadeLayoutForRaw` switch'e tek case (layout
  registry, hack değil). **Ayrı composition engine / layout
  strategy interface AÇILMAZ** — erken abstraction (bugünkü 1
  layout-family ihtiyacından kopuk; capability map'in Phase
  109-112 dead-code dersi). Bu sınır Claude'un ileride hem aşırı
  özel-case hem aşırı soyut framework yazmasını engeller.

## 9. Değişmez sözleşme (yeni tur kontrol listesi)

Framing / composition tarafına dokunan her yeni tur şunu korur:
- `cascade-layout.ts` tek canonical kaynak; Stage + export + rail
  thumb + navigator viewfinder hepsi buradan okur (paralel math
  YASAK).
- `resolvePlateBox` aspect/container/layout-agnostic; 16:9'a özel
  yama YOK.
- `compositionGroup` rotated-AABB görsel bbox; clamp YOK
  (plate büyür → group orantılı); slot render geometrisi (x/y/w/h/r)
  değişmez; r=0 → layout-bbox (regression yok).
- Plate chrome proportional (`plateRadiusForWidth` + shadow);
  width/height transition YASAK (donma).
- `applyLayoutVariant` productType-agnostic; `cascadeLayoutForRaw`
  shape detail registry'de AYRI (kategori 3).
- N×M grid YASAK; layout count 1/2/3 (Shots.so parity).
- Stage + export AYNI `compositionGroup` → Preview = Export Truth
  (§11.0; pixel-parity browser+export kanıtı zorunlu).
- Yeni davranış canlı browser (Claude in Chrome) + DOM/pixel +
  16:9/1:1/4:5/9:16 × 6 layout variant ile doğrulanır.
