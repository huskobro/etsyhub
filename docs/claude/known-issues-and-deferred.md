# Known Issues & Deferred Work

> **AUTHORITATIVE — CURRENT.** Açık item'lar, bilinçli ertelemeler
> ve gelecek yön (future direction) tek listesi. Phase narrative
> DEĞİL. Tarihsel "Phase N candidate" gerekçeleri için
> `docs/claude/archive/phase-log-97-135.md` (NOT authoritative).
>
> **Son güncelleme:** Phase 135 (2026-05-16)
>
> İlgili authoritative dokümanlar:
> - `docs/claude/mockup-studio-contract.md` (§13 Future Direction
>   Roadmap A-F — bu doküman onun operasyonel özetidir)
> - `docs/claude/mockup-studio-zoom-navigator.md`
> - `docs/claude/mockup-studio-framing.md`
> - `docs/claude/mockup-studio-rail-preview.md`

---

## A. Mockup Studio — zoom / navigator / marker

- **Tilt (media rotate)** — honest-disabled (`Tilt · Soon`,
  no-op sahte kontrol YOK). Media-rotate preview-inspect ileride
  **ayrı preview-only disiplinle** (export-bağımsız, rail-bağımsız;
  Shots.so canlı inceleme ile) wire edilir.
- **Precision** — ayrı mode/tab DEĞİL; yalnız Shift modifier
  (delta ÷4, Phase 126). Canlı browser e2e doğrulaması test-aracı
  sınırlı (Chrome synthetic-drag `shiftKey` iletmiyor); unit-test
  + kod-zinciri grep ile kanıtlı (gerçek kullanıcı Shift-drag'inde
  çalışır).
- **Per-slot media-position** — bu tur global tek `mediaPosition`.
  Per-slot pan ayrı advanced / layout-editor modunun işi (erken
  abstraction; kullanıcı kararı per-slot ileride).
- **Mount-time viewfinder boyut timing artifaktı** — ilk mount'ta
  `SIZE_match` ~%2.3 (ResizeObserver/render senkron-olmama);
  operatör herhangi etkileşim yapınca birebir 0. İçerik
  eşleşmesi (asıl kritik metrik) mount dahil HER durumda
  birebir. Düşük öncelik; istenirse measure-sonrası recompute
  guard'ı.

## B. Mockup Studio — framing / composition

- **Residual ~3-9px rotation görsel offset** — rotated item'ın
  görsel bbox'ı layout-bbox'tan farklı (rotation köşeleri
  şişirir). Layout-bbox center plate-center'da; görsel-bbox küçük
  asimetri. Minimal, kabul edilebilir; tam görsel-bbox center
  için per-item rotated-AABB hesabı (Phase 133 rotated-AABB
  bunun çoğunu kapadı; kalan sub-pixel residual Preview=Export
  riski yüksek olduğu için ertelendi).

## C. Mockup Studio — rail preview

- **Ölü kod temizliği** — `PresetThumbMockup` /
  `fitCascadeToThumb` / `THUMB_PLATE_*` svg-art.tsx'te rail
  path'inde KULLANILMIYOR (Phase 117'den beri rail StageScene
  kullanır). `PresetThumbFrame` Frame legacy kullanımı kontrol
  edilip güvenli silinmeli (ayrı küçük temizlik turu).

## D. Frame mode export pipeline (§13.C-F — Phase 99-103 fulfilled,
kalan)

- **Frame mode export pipeline çekirdeği AKTİF** (Phase 99): POST
  `/api/frame/export` → Sharp pipeline → MinIO PNG → signed URL +
  `FrameExport` Prisma persistence (Phase 100) + Product/Etsy
  handoff (`add-frame-export`, MockupsTab "Frame Exports" bucket,
  Etsy submit pipeline `kind: "frame-export"`).
- **Gerçek Etsy V3 API POST e2e** — final submit Etsy API key +
  OAuth token (production credential; dev'de yok). Continuity
  DB-level + kod-level kanıtlı (Phase 107-109: imageOrderJson
  cover entry + FrameExport row + `image-upload.service`
  orderForUpload + `storage.download(outputKey)` + entryId
  narrow). Gerçek Etsy POST açıkça scope dışı (production risk).
- **Portrait / Watermark / BG Effects** (§13.D) — Frame sidebar'da
  görünür ama `data-wired="false"` (honest disclosure preview-
  only). `sceneOverride` field genişletmesiyle aynı pattern'le
  ileride wire (Glass + Lens Blur Phase 98-109'da aktif edildi —
  pattern hazır).
- **Operator-uploaded BG image** (§13.E) — Frame BACKGROUND
  Image/Upload tile'ları; asset upload pipeline (Phase 67 mockup
  template upload + Phase 30 asset-url) reuse edilebilir. Phase
  99 export + bu birlikte gerçek değer (operatör kendi background
  + Frame composition export).
- **Studio history viewer** — operatör son N `FrameExport`'u
  tekrar bulup re-send/re-export (gallery + thumb grid). Banner +
  "Send to Product" CTA mevcut akışı karşılıyor; history UI ek
  katman.
- **FrameExport delete / archive UI** — `deletedAt` soft-delete
  schema hazır; operatör-facing button ileride.
- **"Create new listing from Frame export"** — bypass akışı
  (mevcut: önce Apply Mockups → Listing draft → Send to Product).

## E. Future direction (§13.A-B — Behavior Contract, henüz açılmadı)

Bunlar sözleşme'ye **aday**; implement etmeden Contract +
Phase entry'siyle açılır (sessiz drift YASAK):

- **Layout builder** (§13.A) — operatör stage'deki cascade
  item'larını drag/resize/tilt ile manuel düzenlesin (preset'ten
  serbest düzene). **Hangi aşamada:** Frame export + real Render
  dispatch tam olgunlaştıktan sonra (export'tan önce açılırsa
  "düzenledim ama çıktıya yansımıyor" hayal kırıklığı). Kullanıcı
  kuralı: yeni big abstraction değil — değerlendirilince Contract'a
  yazılır.
- **Grid-like presentation** (§13.B) — 9-up sticker sheet / 4-up
  bookmark / 12-clipart bundle showcase için **template-level
  grid stage preview** (Bundle Preview 9-up template Studio'da
  görünür). N×M stage-level grid (Phase 97'de reddedildi) DEĞİL
  — canonical multi-slot template'in stage'de render olması.
  **Hangi aşamada:** Frame export + Mockup multi-template binding
  birleştikten sonra.
- **Full Remotion migration** — Shots.so tamamen Remotion (stage/
  composition/export hepsi). Kivasy'nin StageScene/Sharp/parity
  zinciri (Phase 117-135) korunmalı; Remotion ileride **animate /
  Etsy video / motion export** için ayrı tur (kullanıcı kararı —
  Phase 126 davranışı/semantiği getirildi, full migration
  değil).

## F. Pre-existing / known limitations (operatör-aware)

- **Etsy Draft pipeline V1** — active publish DEĞİL (draft +
  manual approval; CLAUDE.md core ürün kuralı).
- **Multi-store, scheduling, ScraperAPI/Bright Data** — out-of-
  scope (CLAUDE.md core scope).
- **Browser companion / Chrome extension scraping** (Etsy listing
  / CF product / Pinterest pin) — Phase 38'de pasifleştirildi
  (Datadome/Cloudflare WAF). Future companion backlog; passive
  detection korunur, request atılmaz.
- **Drop shadow softness fine-tune** — libvips `feDropShadow`
  2-katmanlı; preview 4-katmanlı. Ana visual impact Phase
  101-108'de yakalandı; yumuşaklık ince fark.
- **Pre-existing TR/EN drift testleri** (`trend-feed`,
  `competitor-detail`) — Phase 18 EN parity öncesi yazılmış
  legacy testler; canonical paket 739/739 PASS, bu fail'ler
  ayrı test-EN-parity turu (Phase 33-34'te belgelendi;
  regression değil).

## G. Bilinçli mimari kısıtlar (erken-abstraction guard'ları)

Yeni tur bunları AÇMADAN ÖNCE Contract + açık karar gerekir:
- **Ayrı composition engine / layout strategy interface
  AÇILMAZ** (bugünkü 1 layout-family ihtiyacından kopuk;
  capability map Phase 109-112 dead-code dersi). Yeni layout =
  `cascadeLayoutForRaw` switch'e tek case.
- **`STUDIO_DEVICE_CAPABILITIES`** Phase 112'de fiilen tüketime
  bağlandı (Lens Blur targeting gate); future SVG-specific
  feature (phone color / garment color / chrome tone) ilgili
  shape capability entry'sine **FIELD eklenerek** gelir — kod
  patlamaz. Feature şimdi açılmaz; effect/action sistemi
  tasarlanırken hesaba katılır.
- **WorkflowRun tablosu** — IA Phase 11 kapsamı; eklenmez
  (lineage hâlâ `Job.metadata.batchId` schema-zero pattern).
