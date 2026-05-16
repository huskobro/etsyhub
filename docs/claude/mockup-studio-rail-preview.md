# Mockup Studio — Right Rail Preview / Chrome / Aspect

> **AUTHORITATIVE — CURRENT.** Bu dosya sağ rail thumb'larının
> single-renderer, containerless, aspect-adaptive, scene-derived
> davranışının **canonical invariant** tanımıdır. Phase narrative
> DEĞİL. Tarihsel anlatı (Phase 117-134 adım adım) için
> `docs/claude/archive/phase-log-97-135.md` (NOT authoritative).
>
> **Son güncelleme:** Phase 135 (2026-05-16)
>
> İlgili authoritative dokümanlar:
> - `docs/claude/mockup-studio-contract.md` — §6 right rail
>   behavior, §7 selection/preview, §11.0 Preview = Export Truth
> - `docs/claude/mockup-studio-framing.md` — rail thumb aynı
>   `cascade-layout.ts` geometrisini tüketir
> - `docs/claude/mockup-studio-zoom-navigator.md` — rail-head
>   navigator pad single-renderer temeli + chromeless guard
> - `docs/claude/known-issues-and-deferred.md` — ölü kod
>   temizliği (`PresetThumbMockup` legacy)

---

## 0. Çekirdek (6-başlık özeti)

> Hibrit şablon: çekirdek 6 başlık burada; **detay/derinleştirme
> aşağıdaki modül-spesifik §1–9'da** (single render path,
> chromeless, aspect-reactive, containerless, scene-derived thumb,
> proportional chrome, selection ring/badge).

1. **Kapsam / Rol / Boundary:** Mockup Studio sağ rail thumb /
   navigator pad bg / preset chrome / aspect. Boundary: rail =
   candidate layout preview (viewing aid değil); orta panelin AYNI
   StageScene'i (ayrı SVG renderer YASAK). Geometri §6b, zoom
   §6a'da.
2. **Current behavior:** rail thumb = orta panelin AYNI StageScene
   (single render path; Phase 117); `chromeless` stage-padding'siz;
   middle ile canlı bağlı (derived; aspect-reactive); containerless
   aspect-adaptive (`boxW`/`boxH` prop deterministik); scene-derived
   (gerçek asset + StageDeviceSVG); proportional device chrome;
   selection slot-ring + overlay badge (orta panel parity). Detay
   → §1–8.
3. **Invariants:** → §9 "Değişmez sözleşme" (single render path;
   chromeless `effectiveZoom` guard; derived/canlı-bağlı; scaleWrap
   YASAK; scene-derived; proportional chrome; selection ring/badge;
   kategori 4 helper Stage-preview'da gizli rail'de görünür).
4. **Relevant files / Ownership:** `src/features/mockups/studio/
   StageScene` (export — orta panel + rail ortak component),
   `StageScenePreview.tsx` (rail thumb scaled wrapper; chromeless),
   `MockupStudioPresetRail.tsx` (preset thumb + boxW/boxH +
   slot-ring/badge), `svg-art.tsx` (StageDeviceSVG real asset;
   `PresetThumbMockup` legacy fallback), `MockupStudioShell.tsx`
   (slots + layoutVariant + deviceKind prop chain).
5. **Open issues / Deferred:** → `docs/claude/known-issues-and-
   deferred.md` C (ölü kod `PresetThumbMockup`/`fitCascadeToThumb`
   güvenli silme).
6. **Archive / Historical pointer:** → `docs/claude/archive/
   phase-log-97-135.md` (NOT authoritative; Phase 117-134).

---

## 1. Single render path — rail thumb = orta panelin AYNI StageScene'i (Phase 117)

- Rail thumb / live-thumb / navigator pad bg HEPSİ orta panelin
  **AYNI `StageScene` component**'i (ayrı SVG thumb renderer
  YASAK). Tek fark: (a) ölçek (orta panel viewport-aware; thumb
  küçük plate), (b) candidate `layoutVariant`, (c) `chromeless`
  (rail = stage-padding'siz), (d) `appState="preview"`
  (selection ring/badge gizli — kategori 4 helper).
- "Benzetmeye çalışan ikinci görsel sistem" KALDIRILDI (Phase
  117-119): `PresetThumbMockup` SVG-rect renderer rail path'ten
  çıkarıldı; rail thumb gerçek `StageDeviceSVG` + gerçek MinIO
  asset + gerçek scene'den beslenir.
- DOM kanıtı: N StageScene instance = 1 middle + (1 live-thumb +
  preset cards); hepsi aynı `k-studio__stage` / `stage-plate` /
  `stage-mockup-comp` / `slot-wrap` + real `<image>`.

## 2. Chromeless — rail thumb stage-padding'siz (Phase 118)

- `StageScene` `chromeless` prop. `chromeless=true` (rail thumb):
  - `.k-studio__stage` `background: transparent` + dot-grid
    `::before` `display: none` (dark stage kutusu YOK),
  - `.k-studio__stage-scene` + `.k-studio__stage-floor` +
    `.k-studio__stage-amb` render EDİLMEZ (görünür stage chrome
    layer'ları),
  - plate + `MockupComposition`/`FrameComposition` AYNEN render
    (tek render path korunur).
- Orta panel `chromeless=false` (default) → tüm stage chrome
  görünür (Phase 117 DOM byte-identical, regression yok).
- `effectiveZoom = chromeless ? 1 : previewZoom` → rail thumb
  composition'ı DAİMA scale 1 (operatör zoom'undan bağımsız —
  rail = candidate preview, viewing aid değil; bkz.
  `mockup-studio-zoom-navigator.md` §3).

## 3. Aspect-aware reactive — rail thumb middle ile canlı bağlı (Phase 118)

- **right rail = current middle-panel state re-rendered with
  each candidate layout.** Middle panelde yapılan HER görsel
  değişiklik (aspect / asset / item identity / device shape /
  layout count / plate-bg / scene / glass / blur / chrome /
  media-position) sağ paneldeki bütün preview'lara **anında**
  yansır. Snapshot / stale state YOK — derived live previews.
- `frameAspect` reaktif → `StageScenePreview` plate dims
  `resolvePlateBox` ile recompute (Phase 119; sabit constant
  YASAK). Aspect değişince rail thumb plate orantısı orta panel
  ile birebir (DOM `aspectReactive: true`).

## 4. Containerless aspect-adaptive card (Phase 120)

- `.k-studio__preset-card` / `.k-studio__live-thumb`: `border:
  none`, `background: transparent` (rail bg görünür), `border-
  radius`/`box-shadow` framing YOK, `overflow: visible`. Kart =
  plate'in tam kendisi (zero extra container shell — Shots.so
  parity).
- Kart geometri JS-computed exact aspect: WRAPPER `<div>`
  `ResizeObserver` ile ölçülür (rail-scroll `clientWidth` DEĞİL
  — scrollbar-gutter skew). `cardW = idealW`, `cardH = idealW /
  plateAspect`; `cardH` üst sınırı (`RAIL_CARD_MAX_H`) aşarsa
  height clamp + `cardW = cardH × plateAspect` (aspect EXACT
  korunur). Kart aspect = plate aspect BİREBİR.
- `scrollbar-gutter: stable both-edges` (rail-scroll) → scrollbar
  iki kenardan simetrik pay → portrait kart tam ortalı (leftGap
  == rightGap).
- **`boxW`/`boxH` prop (Phase 133):** PresetRail kartın px
  boyutunu hesaplayıp `StageScenePreview`'e prop geçer →
  ResizeObserver `box` state TAMAMEN bypass (deterministik;
  mount-stale `getBoundingClientRect` 9:16 kartta plate %39
  bug'ını kökten çözer; prop yoksa eski self-measure fallback —
  geriye uyum).

## 5. Plate-fit framing (Phase 119) + scaleWrap kaldırıldı (Phase 133)

- Phase 119: `StageScenePreview` scale = plate'in karta sığması
  (full PREVIEW_BASE canvas DEĞİL); `PREVIEW_FILL` near-borderless
  inset; `overflow: hidden` çevre stage-padding'i kırpar
  (preview-first).
- Phase 133: `PREVIEW_BASE 900×506 + scaleWrap + transform:scale`
  modeli TAMAMEN KALDIRILDI (kök neden — sahte 16:9-ish iki
  katmanlı boyutlandırma 9:16'da plate'i kartın %39'una
  düşürüyordu). Host `width:100% height:100% overflow:hidden
  display:flex`; StageScene DOĞRUDAN host'u doldurur
  (`.k-studio__stage` `flex:1`); plate o box içinde
  `resolvePlateBox` boyutunda.
- Sonuç (Phase 133 browser+pixel kanıtı, 9:16 dahil): middle =
  rail = zoom 3 yüzey birebir aynı içerik uzayı / crop / fit /
  aspect / visibility; plate kartı %100 doldurur (9:16'da
  %39→%100); composition plate-merkezli; clip yok.

## 6. Scene-derived thumb — gerçek asset + gerçek device shape (Phase 116)

- Rail thumb generic `MockupPh` placeholder DEĞİL: orta panelin
  AYNI `StageDeviceSVG` component'i + AYNI real `slot.design`
  (gerçek MinIO `imageUrl`) ile render. Shell `slots` (Stage'e
  geçen AYNI referans) → PresetRail `slots` → thumb.
- Sonuç: rail thumb / stage / export ÜÇÜ DE aynı **gerçek asset
  identity** + aynı `StageDeviceSVG` device shape + aynı scene
  params; tek fark candidate `layoutVariant` geometri (Phase
  113 slot-identity korundu — fanout-to-items[0] YASAK).
- Backward-compat: `slots` verilmezse (legacy / set yok) Phase 86
  generic `MockupPh` fallback.
- Selection helper (slot-ring / badge) thumb'a GİRMEZ (kategori
  4 — Phase 94 baseline; Stage'in `StageDeviceSVG` çağrısı zaten
  helper-free).

## 7. Proportional device chrome — her ölçekte aynı görsel aile (Phase 116 fu)

- Device shape chrome sabitleri (StickerCardSVG `pad`,
  WallArtFrameSVG `frameW`/`matW`, PhoneSVG `bz`/`r`,
  BookmarkStripSVG `knotR`) **fixed-pixel DEĞİL, `min(w,h)`
  oranlı**. Her sabit stage-scale parity floor ile bağıl
  formüle çevrildi: stage-scale'de eski değere ≈ birebir
  (sub-pixel; zero stage regression), thumb scale'de
  proportional.
- Sonuç: rail thumb chrome (sticker beyaz kenar / wall_art frame
  + mat / phone bezel / bookmark knot) orta panelle aynı oran;
  küçük thumb'da "kalın generic çerçeve" hissi YOK (DOM:
  stage padRatio === thumb padRatio).
- Chrome = shape-specific impl detail (kategori 3,
  `StageDeviceSVG`/`cascadeLayoutForRaw` registry); thumb prop
  chain = canonical shared (kategori 1).

## 8. Unified preset family + selection ring/badge (Phase 96/121)

- Mockup ↔ Frame tek `LAYOUT_PRESETS` family (mode-AGNOSTIC);
  tek `PresetThumbMockup` (Frame için ayrı thumb YOK).
- Layout count senkron: rail-head 1/2/3 → Shell state → rail
  thumb display + stage cascade (Phase 96).
- **Selection sinyali orta panelle unified (Phase 121):**
  seçili kart turuncu **slot-ring** overlay
  (`.k-studio__preset-ring`, orta panel `.k-studio__slot-ring`
  box-shadow parity) + plate-üstü **overlay badge**
  (`.k-studio__preset-badge`, "01 Cascade" formatı, orta panel
  `.k-studio__slot-badge` parity; lit=orange / dim=blur).
  Opacity-dimming KALDIRILDI (tüm kartlar aynı parlaklık;
  hover glow YOK). Selection = ring (opacity DEĞİL).
- Kategori 4 sınırı: Stage **preview** state'inde ring/badge
  gizli kalır (Phase 94 baseline); RAIL operatör seçim
  yüzeyi olduğu için orada görünür (Stage'le AYNI görsel dil,
  ayrı yüzey rolü).

## 9. Değişmez sözleşme (yeni tur kontrol listesi)

Rail preview / chrome / aspect tarafına dokunan her yeni tur:
- Rail thumb = orta panelin AYNI `StageScene`'i (single render
  path; ayrı SVG renderer YASAK).
- `chromeless` rail thumb stage-padding'siz; `effectiveZoom`
  chromeless guard (rail composition scale 1, operatör
  zoom-bağımsız).
- Rail thumb middle ile canlı bağlı (derived; snapshot/stale
  YASAK); `frameAspect` reaktif → `resolvePlateBox` recompute
  (sabit constant YASAK).
- Containerless (border/bg/framing YOK); kart aspect = plate
  aspect exact; `boxW`/`boxH` prop deterministik
  (ResizeObserver box state bypass).
- scaleWrap / PREVIEW_BASE × transform:scale YASAK (Phase 133
  kök neden); host'u doğrudan `resolvePlateBox` plate'i
  doldurur.
- Thumb scene-derived (gerçek asset + `StageDeviceSVG` + real
  slot identity; generic placeholder YASAK; Phase 113 slot
  identity korunur).
- Device chrome proportional (`min(w,h)` oranlı; fixed-pixel
  YASAK; stage-scale parity sub-pixel).
- Selection = slot-ring + overlay badge (orta panel parity;
  opacity-dimming YASAK); kategori 4 helper Stage preview'da
  gizli, rail'de görünür.
- Yeni davranış canlı browser (Claude in Chrome) + DOM/pixel +
  middle = rail = zoom contentMatch + 16:9/1:1/4:5/9:16 × 6
  layout variant ile doğrulanır.
