# Mockup Studio — Zoom / Navigator / Marker

> **AUTHORITATIVE — CURRENT.** Bu dosya zoom, navigator pad,
> viewfinder rectangle ve center marker davranışının **canonical
> invariant** tanımıdır. Phase narrative DEĞİL — yaşayan kural
> özetidir. Tarihsel anlatı (Phase 123-135 adım adım) için
> `docs/claude/archive/phase-log-97-135.md` (NOT authoritative).
>
> **Son güncelleme:** Phase 135 (2026-05-16)
>
> İlgili authoritative dokümanlar:
> - `docs/claude/mockup-studio-contract.md` — genel Behavior Contract
>   (§5 scroll/viewport, §6 right rail, §11.0 Preview = Export Truth)
> - `docs/claude/mockup-studio-framing.md` — plate/composition/cascade
>   geometrisi (zoom composition scale'i bunun üzerine biner)
> - `docs/claude/mockup-studio-rail-preview.md` — rail thumb / navigator
>   pad'in single-renderer temeli
> - `docs/claude/known-issues-and-deferred.md` — Tilt/Precision no-op,
>   per-slot media-position, residual rotation offset

---

## 1. Zoom bounds — tek kaynak

- `src/features/mockups/studio/zoom-bounds.ts` tek canonical kaynak:
  `ZOOM_MIN = 75`, `ZOOM_MAX = 400`, `ZOOM_DEFAULT = 100`,
  `ZOOM_STEP = 25`, `clampZoom(pct)`.
- Rail-head Zoom slider + Stage bottom-center zoom-pill (`−` / `%` /
  `+` / `Fit`) **AYNI** Shell `previewZoom` state'ini sürer (tek
  zoom state, iki kontrol yüzeyi — Shots.so canonical). İki kontrol
  her zaman senkron; `%` her yerde aynı.
- `Fit` = `ZOOM_DEFAULT` (100) reset (Phase 131 zoom-reset icon
  button canonical; hardcoded değil `ZOOM_DEFAULT`).
- Yeni zoom min/max/step ihtiyacı bu dosyadan değişir; UI'da hardcoded
  sayı YASAK.

## 2. Zoom semantiği — plate SABİT, composition İÇERİĞİ scale (Shots.so canonical)

- Zoom orta panel plate'inin **KENDİSİNE** uygulanmaz. Plate
  sabit-boyut viewport kalır (chrome — rounded corner / border /
  shadow — büyümez); zoom **composition içeriğine**
  (`.k-studio__stage-inner` `transform: scale`) uygulanır; plate
  `overflow: hidden` taşmayı kırpar = **preview-inspection**
  (Shots.so `.component` davranışı, canlı browser ölçümüyle
  doğrulandı: zoom %146 → `.frame.preview-frame` boyutu DEĞİŞMEZ,
  `.component` `matrix(scale,...)` ile içerik büyür).
- **Translate ve scale AYRI katman** (kritik invariant —
  Phase 126/127 inline↔CSS transform kompozisyon kırılması dersi):
  - **Outer wrapper** `.k-studio__media-pos` = `translate(panOx,
    panOy)` (pure pan, scale=1).
  - **Inner wrapper** `.k-studio__stage-inner` = `scale(grp.scale
    × previewZoom)` (pure scale, translate=0).
  - İkisi **aynı element/transform string'inde birleştirilmez**
    (browser-kanıtlı: `outerInnerSameElement: false`).
- `effectiveZoom = chromeless ? 1 : previewZoom`. Rail thumb
  (chromeless=true) composition'ı DAİMA scale 1 (kendi plate-fit
  cascadeScale'i; operatör zoom'undan **bağımsız** — rail =
  candidate layout preview, viewing aid değil).
- Zoom %100 semantiği = **"fit/full visible"**: composition plate'in
  `PLATE_FILL_FRAC` (0.84) kadarını kaplar → plate composition'dan
  ~1.19× büyük → tüm composition + bir miktar padding görünür,
  crop YOK (Phase 130 baseline).
- Zoom-out (<100) → görünür pencere büyür, composition küçülür.
  Zoom-in (>100) → composition büyür, plate kenarı kırpar.

## 3. Zoom = kategori 2 preview-only viewing aid (canonical 4-kategori sınırı)

- Zoom **canonical visual parameter DEĞİL** (kategori 1'e GİRMEZ):
  - exported PNG'ye yansımaz (`frame-compositor.ts` previewZoom'u
    ASLA görmez),
  - FrameExport persist etmez,
  - Product MockupsTab tile'da yansımaz,
  - rail candidate thumb'lara uygulanmaz (chromeless guard).
- Yeni preview-only helper eklenirken aynı disiplin: kategori 2/4,
  canonical shared pota'ya GİRMEZ, export-bağımsız, rail-bağımsız.
- Bu Contract §11.0 (Preview = Export Truth) ile uyumludur — zoom
  bir viewing aid'dir, final visual değildir.

## 4. Media-position (global pan) — canonical kategori 1

- `src/features/mockups/studio/media-position.ts` tek pure-TS shared
  resolver (DOM/React/sharp import YOK → client preview/rail +
  server Sharp compositor üçü de bu TEK modülü import eder;
  CLAUDE.md Madde V build-boundary):
  - `MEDIA_POSITION_PAN_K = 0.5`
  - `resolveMediaOffsetPx(pos, renderW, renderH) = { ox: pos.x ×
    renderW × 0.5, oy: pos.y × renderH × 0.5 }`
  - `clampMediaPosition` → x/y [-1, +1] clamp guard
  - `normalizePadPointToPosition` pure-math (DOM/event objesi YOK;
    Shift precision → `prev + (raw − prev) / 4`)
  - `mediaPositionsEqual` epsilon `1e-3` (float drift'ten sahte
    stale üretmez)
- `mediaPosition` **kategori 1 canonical shared visual**: stage
  preview + Sharp export + rail candidate thumb HEPSİ aynı
  `mediaPosition`'dan beslenir; exported PNG'ye yansır
  (`sceneSnapshot.mediaPosition` persist; §11.0).
- Canonical state **yalnız normalized** ([-1,+1]). px/plateDims
  state'e GİRMEZ — her render kendi boyutundan türetir (resolution-
  independent: middle plate px ↔ rail thumb küçük px ↔ Sharp
  `plateLayout.plateW/plateH`).
- `{x:0, y:0}` **sacred no-op**: `resolveMediaOffsetPx` `{0,0}` →
  outer `translate(0,0)` → Phase 125 baseline byte-identical;
  export `cascadeOffset*Final === cascadeOffset*`.

## 5. Zoom-aware pan reach (Phase 135 — kök neden + canonical fix)

**Sorun (Phase 135 öncesi):** `vfCx = 50 − (ox / fullCompW) ×
compFracOfPlateW × 100`; `ox = mediaPos × plateW × PAN_K` **zoom'dan
bağımsızdı**. `fullCompW = bbox × grp.scale × previewZoom` zoom ile
büyüyordu → zoom %400'de `vfCx ≈ 50` (köşelere ulaşılamıyor — pan
reach kaybı). Marker clamp (Phase 134) bunun nedeni DEĞİLDİ (z400'de
clamp tetiklenmiyordu bile — `mkClamp:false`); kök neden pan-reach
matematiğiydi.

**Shots.so canonical (canlı browser ölçümü):** `.component`
`transform: matrix(scale,0,0,scale, translateX, translateY)` —
scale+translate **birleşik tek transform**; translate zoom ile
**ölçeklenir** (büyük composition → büyük translate → köşeler
erişilebilir).

**Fix (Phase 135):**
- `.k-studio__media-pos` (orta panel preview): translate
  `ox × effectiveZoom` (`effectiveZoom = chromeless ? 1 :
  previewZoom`). Pan ofseti artık zoom ile ölçeklenir → her
  zoom'da `mediaPos = ±1` köşelere ulaşır.
- `resolveMediaOffsetPx` (canonical state + Sharp export) **HİÇ
  DEĞİŞMEDİ**: zoom export'ta yok (export composition scale=1),
  pan-reach orada zaten yeterli → §11.0 Preview = Export
  korunur (divergence YOK).
- Navigator viewfinder: `vfCx` numerator'a `panOx = ox ×
  previewZoom` → cebirsel sadeleşme:
  `vfCx = 50 − (ox × previewZoom / (bbox × grp.scale ×
  previewZoom)) × compFracOfPlateW × 100` → `previewZoom` pay/payda
  iptal → **vfCx ZOOM'DAN BAĞIMSIZ** (mediaPos = ±1 her zoom'da
  köşeye gider; viewfinder içerik eşleşmesi Phase 129 korunur).
- `{0,0}` → `0 × zoom = 0` → byte-identical no-op (regression yok).

## 6. Navigator viewfinder = orta panel görünür crop'unun GERÇEK izdüşümü (Phase 129-130)

- Rail-head live pad = **navigator / control surface** (orta panelin
  birebir thumb'ı DEĞİL): arkada chromeless StageScene full-extent
  background (`stageMediaPosition` NEUTRAL + `effectiveZoom` 1 →
  zoom/pan UYGULANMAMIŞ tam composition); üstüne viewfinder GROUP.
- Viewfinder = orta panel görünür penceresinin navigator full-comp
  uzayındaki **gerçek izdüşümü** (keyfi 1/zoom formülü Phase 130'da
  KALDIRILDI):
  - **boyut**: `winOverComp × compFracOfPlate × 100`,
    `winOverComp = plateDims / (bbox × grp.scale × previewZoom)`
    (= orta panelde görünür-alan / composition oranı, CLAMP YOK).
    Aspect-locked sadeleşme: `vfPct ≈ (1/previewZoom) × 100`
    (zoom %100 → 100%, %25 → 400% büyür, %160 → %62.5 küçülür).
    `Math.max(3, …)` yalnız dejenerasyon guard'ı; clamp YOK
    (viewfinder plate-rect'i taşabilir — overflow görsel kırpılır,
    crop anlamı korunur — Shots.so canonical).
  - **konum**: `vfCx = 50 − (panOx / fullCompW) × compFracOfPlateW
    × 100` (Phase 135'te `panOx = ox × previewZoom` → zoom-bağımsız;
    içerik eşleşmesi korunur). No-pan (`mediaPos = {0,0}`) →
    `ox = 0` → `vfCx = vfCy = 50` (pad merkezi) zoom'dan **tamamen
    bağımsız** → **center-preserving garanti** (drift matematiksel
    imkânsız).
- **İçerik eşleşmesi invariant (§11.0 türevi):** Operatör navigator
  viewfinder içinde ne görüyorsa orta panelde **birebir** onu
  görür. `MID_plateInComp` (orta panelde plate-merkezi composition'ın
  hangi noktası) ↔ `NAV_vfInComp` (viewfinder full-comp'un hangi
  bölgesi) cebirsel olarak birebir. DOM-ölçüm doğrulaması 3-case
  (no-pan, pan, zoom+pan) <%0.08 sapma.
- `compositionGroup` (`cascade-layout.ts`) Stage + Shell export +
  rail thumb + navigator viewfinder HEPSİ tek canonical kaynaktan
  okur → Preview = Export = Rail-thumb = Navigator-viewfinder yapısal
  garanti (bkz. `mockup-studio-framing.md`).

## 7. Viewfinder GROUP + center marker (Phase 128 + 134)

- **Navigator pad = navigator + viewfinder GROUP** (Shots.so DOM
  ölçümüyle kanıtlı): statik full-extent bg + üstüne tek viewfinder
  GROUP. `.position-pad-safearea` 208×156 sabit; `.pad-preview >
  .layout-item` `transform: none` SABİT (zoom/pan UYGULANMAMIŞ);
  `.viewfinder-div` boş çerçeve (`innerHTML=""`, ayrı render YOK);
  `.drag-handle` viewfinder anchor (handle = group, viewfinder
  onun çocuğu, AYNI center).
- Kivasy karşılığı: `.k-studio__pad-viewfinder` GROUP (konum + boyut
  inline dinamik); center marker = `.k-studio__pad-viewfinder::after`
  pseudo (50%/50%, 14×14, beyaz) → **viewfinder'ın çocuğu, group ile
  BİREBİR aynı center'da hareket eder** (bağımsız anchor DEĞİL —
  Phase 128 kullanıcı netleştirmesi: nokta = rectangle merkez
  marker'ı).
- **Center marker clamp (Phase 134) = yalnız VISIBILITY, pan reach
  DEĞİL:** Marker zoom panelden taşmamak için clamp'lenir
  (`DOT_PX = 14`, `dotMarginXPct = (7 / plateRectW) × 100`,
  `dotCx = Math.max(dotMarginXPct, Math.min(100 − dotMarginXPct,
  vfCx))`, ayrı `.k-studio__pad-marker` element `data-clamped`).
  Bu clamp **navigable pan range'i KISITLAMAZ** — viewfinder
  rectangle serbestçe taşar (Shots.so canonical), pan ofseti
  zoom-aware (Phase 135) → operatör her zoom'da köşelere ulaşır;
  yalnız küçük nokta görsel olarak panel içinde tutulur.
- **3 ayrı kavram (kesin ayrım — Phase 135 kullanıcı talebi):**
  1. **Viewfinder rectangle overflow** — SERBEST (plate-rect'i
     taşabilir; `vfCx` 0% veya 100% olabilir — Shots.so canonical,
     crop anlamı korunur).
  2. **Center marker visibility** — CLAMP'li (Phase 134; panelden
     taşmaz, küçük nokta panel içinde).
  3. **Pan reach / navigable range** — TAM (Phase 135 zoom-aware;
     `mediaPos = ±1` her zoom'da köşelere ulaşır; clamp bunu
     kısıtlamaz).
  Bu üçü **birbirine bağlanmamalı** (Phase 135 kök neden dersi:
  visibility clamp ↔ interaction clamp karıştırılınca pan reach
  kaybolur).

## 8. Pad interaction (Phase 126-128)

- Pad pointer drag: `setPointerCapture` (pointerdown) +
  `buttons === 0` guard (pointermove) + `releasePointerCapture`
  (pointerup + pointercancel).
- Click-to-jump (handle dışı pad click → handle/viewfinder atlar)
  + clamp (±1, asla aşmaz) + Shift precision (`normalizePad
  PointToPosition` Shift → ÷4).
- Pad yalnız **rail-head**'de sürer (`onChangeMediaPosition` VAR);
  preset thumb'lar pad overlay GÖSTERMEZ, yalnız `mediaPosition`'ı
  yansıtır (live-pad navigator semantiği ≠ preset-thumb canonical
  preview — Phase 128 kritik ayrım).
- **Test-aracı sınırı (dürüst not):** Chrome synthetic-drag
  `shiftKey` pointer event'lere iletmiyor; Shift precision
  doğruluğu unit-test (`normalizePadPointToPosition` Shift ÷4) +
  kod-zinciri grep ile kanıtlanır, canlı synthetic-drag ile değil.

## 9. Tilt / Precision — honest disabled / no-op

- Rail-head "Tilt" view tab **honest-disabled** (`Tilt · Soon`,
  no-op sahte kontrol YOK; `aria-disabled`).
- "Precision" ayrı mode/tab DEĞİL — yalnız Shift modifier (delta
  ÷4, Phase 126).
- Tilt = media rotate (preview rotate-inspect) ileride **ayrı
  preview-only disiplinle** wire edilir (Shots.so canlı inceleme
  ile); bkz. `docs/claude/known-issues-and-deferred.md`.

## 10. Değişmez sözleşme (yeni tur kontrol listesi)

Zoom / navigator / marker tarafına dokunan her yeni tur şunu korur:
- `zoom-bounds.ts` tek kaynak (UI'da hardcoded zoom sayısı YOK).
- Zoom = composition scale (plate sabit); translate/scale ayrı
  katman; `effectiveZoom` chromeless guard (rail-bağımsız).
- Zoom kategori 2 preview-only (export/persist/Product/rail-thumb
  bağımsız — §11.0).
- `media-position.ts` tek shared resolver; `resolveMediaOffsetPx`
  canonical + export'ta DEĞİŞMEZ (zoom-aware pan yalnız preview
  `.k-studio__media-pos` katmanında `× effectiveZoom`).
- `vfCx` numerator `× previewZoom` → cebirsel sadeleşme →
  zoom-bağımsız; no-pan center-preserving; içerik eşleşmesi.
- 3 kavram (rectangle overflow / marker visibility / pan reach)
  ayrı tutulur — visibility clamp pan reach'i kısıtlamaz.
- `{0,0}` sacred no-op (byte-identical).
- Yeni davranış canlı browser (Claude in Chrome) + DOM/pixel
  ölçümü + zoom 75/100/160/400 × 5 pan + 16:9/1:1/4:5/9:16 ×
  layout variant ile doğrulanır.
