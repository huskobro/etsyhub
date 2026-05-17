# Known Issues & Deferred Work

> **AUTHORITATIVE — CURRENT.** Açık item'lar, bilinçli ertelemeler
> ve gelecek yön (future direction) tek listesi. Phase narrative
> DEĞİL. Tarihsel "Phase N candidate" gerekçeleri için
> `docs/claude/archive/phase-log-97-135.md` (NOT authoritative).
>
> **Son güncelleme:** Phase 137 (2026-05-17) — Effect Settings
> Flyout (Lens Blur + BG Effects secondary panel); Tilt/Portrait/
> Watermark/VFX honest-disabled KORUNDU (flyout'a alınmadı).
> Phase 136 — BG Effects §D'de "wire edildi" işaretlendi
>
> İlgili authoritative dokümanlar:
> - `docs/claude/mockup-studio-contract.md` (§13 Future Direction
>   Roadmap A-F — bu doküman onun operasyonel özetidir)
> - `docs/claude/mockup-studio-zoom-navigator.md`
> - `docs/claude/mockup-studio-framing.md`
> - `docs/claude/mockup-studio-rail-preview.md`

---

## 0. Çekirdek (6-başlık özeti)

> Bu doc bir **cross-cutting açık-item katalog**u (tüm modüllerin
> "Open issues" başlığı buraya pointer verir — tek consolidated
> kaynak). Çekirdek 6 başlık burada; **modül-bazlı açık item'lar
> aşağıdaki §A–G'de**.

1. **Kapsam / Rol / Boundary:** Tüm modüllerin açık item'ları +
   bilinçli ertelemeler + future direction (§13 Behavior Contract
   operasyonel özeti) + erken-abstraction guard'ları. Boundary:
   yalnız "ne açık / ne ertelendi / neden"; canonical güncel
   davranış ilgili stage doc'ta.
2. **Current behavior:** §A (zoom/navigator), §B (framing), §C
   (rail), §D (Frame export/Etsy V3 e2e), §E (future §13.A-B +
   Remotion), §F (pre-existing limitations), §G (erken-abstraction
   guard'ları). Her item: ne açık + neden ertelendi + ilgili
   stage doc.
3. **Invariants:** Future direction item'ı **Contract + Phase
   entry'siyle açılır** (sessiz drift YASAK — §E). Erken-
   abstraction guard'ları (§G) AÇILMADAN ÖNCE açık karar gerekir.
4. **Relevant files / Ownership:** Yok (katalog doc); her item
   ilgili stage doc'un "Relevant files"ına işaret eder
   (`docs/claude/00-router.md` üzerinden).
5. **Open issues / Deferred:** Bu doc'un kendisi (§A–G).
6. **Archive / Historical pointer:** Her item'ın tarihsel "Phase
   N candidate" gerekçesi → `docs/claude/archive/phase-log-*.md`
   (NOT authoritative).

---

## A. Mockup Studio — zoom / navigator / marker

- **Tilt (media rotate)** — honest-disabled (`Tilt · Soon`,
  no-op sahte kontrol YOK). Media-rotate preview-inspect ileride
  **ayrı preview-only disiplinle** (export-bağımsız, rail-bağımsız;
  Shots.so canlı inceleme ile) wire edilir. **Phase 137 notu:**
  Effect Settings Flyout yalnız Lens Blur + BG Effects'i aldı;
  Tilt (rail-head) honest-disabled KORUNDU — flyout'a alınmadı
  (boş/sahte panel YASAK; wire edilince aynı flyout pattern'ine
  takılır — Contract §7.8).
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
- **BG Effects** (§13.D) — **Phase 136'da wire edildi**
  (vignette + grain, tek-seçim, mode/glass/lensBlur'dan bağımsız
  eksen; preview = export parity, snapshot/isStale dahil). Artık
  honest-disabled DEĞİL — canonical davranış
  `mockup-studio-contract.md` §7.7. Pattern (Glass + Lens Blur
  Phase 98-109 + BG Effects Phase 136) kanıtlandı.
- **Portrait / Watermark / VFX** (§13.D) — Frame sidebar'da
  görünür ama `data-wired="false"` (honest disclosure
  preview-only) ve **hâlâ honest-disabled** (Phase 136 yalnız
  BG Effects wire etti; **Phase 137 Effect Settings Flyout da
  yalnız Lens Blur + BG Effects'i aldı — bunlar flyout'a
  ALINMADI**, boş/sahte panel YASAK; ayrım korunmalı).
  `sceneOverride` field genişletmesiyle wire + Effect Settings
  Flyout pattern'ine takma (Contract §7.7/§7.8 emsali —
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

## H. Settings / Admin — kod-borçları ("No Hidden Behavior" ile çelişen, implement edilmemiş)

Kaynak: `docs/claude/settings-admin.md` §5 kod-grounding
(2026-05-17). Bunlar CLAUDE.md "No Hidden Behavior" / Settings
Registry (Madde R) / prompt-block (Madde O) hedefiyle çelişiyor
— **henüz açık borç, doc'larda "yapıldı" gibi anlatılmamalı**:

- **Negative library Settings Registry'ye taşınmadı** —
  `variation-generation/negative-library.ts` hardcoded (Phase 6+
  defer marker). Admin görünür/düzenlenebilir değil.
- **Prompt-block admin CRUD/override UI yok** — `criteria.ts`
  builtin hardcoded; `ReviewCriterion` DB modeli yok; block
  weight/severity/applicability admin'den düzenlenemez (Madde O
  architecture tasarlandı, admin-managed kısmı incomplete).
- **Cost limit job engeli yok** — `CostUsage` kaydı + dashboard
  var; enqueue-öncesi cost-check (limit aşımı engeli) implement
  değil (monitoring-only).
- **Settings Registry kısmî** — ai-mode + review threshold
  resolved (kod-enforced); negative-library + bazı prompt-default
  builtin fallback (Madde R hedefine tam ulaşılmadı).

## I. Enforcement borçları — DEFERRED (takip ediliyor; yeni iş AÇILMADI)

> **Statü (2026-05-17):** Bu P1 borçları code-grounding'de
> bulundu, kullanıcı kararıyla **şimdilik sonraya bırakıldı**.
> Yeni enforcement işi AÇILMADI. Burası tek görünür takip
> noktası; detay + somut mekanizma ilgili doc §5.5'te. Sonraki
> enforcement turu bunları buradan alır.

- **[P1 · batch-pipeline] Decision gate server-side assert** —
  `createSelectionFromBatch`/`createSelectionFromAiBatch` POST
  endpoint'i `undecided>0` (= `reviewStatusSource != USER`)
  kontrolü YAPMIYOR; UI-stage görünürlük var ama API çağrısı
  gate'i sessizce bypass edip downstream operator-kept zincirini
  kırabilir. **En yüksek risk.** Önerilen: servis başı assert +
  explicit `?force=true` audit (Madde H). Detay →
  `docs/claude/batch-pipeline.md` §5.5.
- **[P1 · settings-admin] Negative library → Settings Registry**
  — `negative-library.ts` hardcoded; admin görünür/düzenlenebilir
  değil ("No Hidden Behavior" en görünür ihlali). Önerilen:
  `negative.terms[]` setting + resolved helper (ai-mode pattern),
  builtin → fallback. Detay → `docs/claude/settings-admin.md`
  §5.5 + bu doc §H.
- **[P2 · settings-admin] Cost-limit pre-check** — Cost Guardrails
  hiç enforce değil (monitoring-only); enqueue-öncesi limit
  check yok. Detay → §H + settings-admin §5.5.
- **[P2 · settings-admin] Prompt-block READ-ONLY admin görünürlük**
  — full CRUD DEĞİL (Review FROZEN/Madde Z; görünürlük yarısı
  güvenli). Detay → §H + settings-admin §5.5.
- **[P2 · selection-library-products] Module-boundary ESLint** —
  Library≠Selections≠Products yalnız konvansiyon; products↛
  library/selection import-boundary lint + handoff tek-yön
  test. Detay → `docs/claude/selection-library-products.md` §5.5.
- **[P2 · product-etsy] Trademark/risk-flag selective hard-gate**
  — readiness'in tamamı değil, yalnız telif-riskli flag submit'i
  bloklasın + override audit. Detay →
  `docs/claude/product-etsy.md` §5.5.

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
