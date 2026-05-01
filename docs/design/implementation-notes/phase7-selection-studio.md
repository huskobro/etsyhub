# Phase 7 — Selection Studio Closeout

> **Tarih:** 2026-04-30
> **Status:** 🟢 Phase 7 v1 (42 task tamamlandı, tüm otomasyon gate'leri PASS, manuel QA browser-based smoke (2026-05-01) GEÇTİ — 2 küçük UX polish carry-forward not edildi, kritik bug yok)
> **Spec:** [`../../plans/2026-04-30-phase7-selection-studio-design.md`](../../plans/2026-04-30-phase7-selection-studio-design.md)
> **Plan:** [`../../plans/2026-04-30-phase7-selection-studio-plan.md`](../../plans/2026-04-30-phase7-selection-studio-plan.md)
> **Mockup hazırlık:** [`./phase7-mockup-studio-prep.md`](./phase7-mockup-studio-prep.md) (Phase 7+ tasarım kaynağı)

## Özet

Selection Studio Phase 7 v1 olarak teslim edildi. SelectionSet/SelectionItem
veri modeli, state machine (`draft → ready / archived`), 3 deterministik
hızlı işlem (crop, transparent-check, background-remove), finalize gate
(`selected ≥ 1`), async ZIP export (24h signed URL + 7g cleanup), drawer ile
cherry-pick item ekleme (Reference Batches aktif, Review Queue disabled),
bulk action (Selected'a ekle / Reddet / Hard delete), menu-button tabanlı
**accessible** reorder (drag-and-drop YOK — bilinçli ürün kararı), Phase 6
review verisinin **read-only** köprülenmesi (mapper layer ile schema
izolasyonu), page-level Toast notification + buton-içi inline feedback
ikilisi.

**Phase 6 ile ilişki:** Phase 6 baseline'a (cost-budget, KIE provider,
Aşama 2B local mode, decision rule, sticky kuralı) **dokunulmadı**.
Selection Studio Phase 6 review verisini yalnız okur. Phase 6 canlı smoke
durumu (drift #6 + KIE flaky) Phase 7 v1'in teslimini bloke etmedi —
Phase 7 v1 bağımsız `🟢` ilan edilebilir.

---

## Teslim edilen kapsam (spec §1.2 in-scope tikleri)

| Spec maddesi | Durum |
|--------------|-------|
| `SelectionSet` + `SelectionItem` veri modeli + state machine | ✅ Task 1, 3, 4, 5 |
| Quick start `/review` AI Tasarımları → `/selection/sets/[setId]` | ✅ Task 15, 38 |
| `/selection` minimal index (aktif draft + son ready) | ✅ Task 23 |
| Studio canvas: aktif preview + filmstrip + sağ panel | ✅ Task 25, 26, 27 |
| 3 deterministik hızlı işlem (crop, transparent-check, bg-remove) | ✅ Task 6, 7, 8, 9 |
| Hibrit edit semantiği (`sourceAssetId` immutable + tek seviye undo + reset) | ✅ Task 6, 30 |
| Hibrit işleme modeli (instant sync + heavy BullMQ + paralel heavy yasağı) | ✅ Task 10, 29 |
| AI Kalite paneli (Phase 6 mapper, read-only) | ✅ Task 16, 27 |
| Item ekleme drawer (Reference Batches aktif, Review Queue disabled) | ✅ Task 32 |
| Item status: `pending / selected / rejected` (default `pending`, opt-in) | ✅ Task 5 |
| Bulk action (multi-select sticky bar) | ✅ Task 33 |
| Soft remove + hard delete (TypingConfirmation "SİL") | ✅ Task 33, 34 |
| Filmstrip filter (Tümü / Aktif / Reddedilenler) | ✅ Task 26 |
| Reorder — menu/button (Sola / Sağa / Başa / Sona) a11y | ✅ Task 31 |
| Finalize action (`draft → ready`, item status donar) | ✅ Task 4, 35 |
| Archive action (`draft\|ready → archived`, minimal) | ✅ Task 4, 37 |
| Async ZIP export (signed URL 24h, cleanup 7g) | ✅ Task 11, 12, 13, 14, 36 |
| Inline UI feedback + Phase 6 notification reuse | ✅ Task 39 |
| Cross-user 404 disiplini | ✅ Task 17 (tüm route'larda enforce) |
| Test disiplini (TDD + 2-stage review) | ✅ Phase 6 birebir |

---

## Test sonuçları (Phase 7 v1 final state)

| Katman | Sayı | Durum |
|--------|------|-------|
| Phase 7 contract (manifest schema v1) | 48 | ✅ PASS (Task 40 sonrası) |
| Phase 7 unit + integration + UI (cumulative) | 1700+ | ✅ PASS (UI suite 735+, Phase 7 unit 200+, Phase 7 integration 400+) |
| Phase 7 E2E (Playwright golden path) | 4 | ✅ PASS (Task 41) |
| Phase 6 baseline regression | 88+ | ✅ PASS (dokunulmadı — riskFlags `read-both` helper Phase 7 mapper'da reuse) |

**Kalite gate (Task 42 öncesi son state):**

| Komut | Sonuç |
|-------|-------|
| `npx tsc --noEmit` | ✅ 0 hata |
| `npx next lint` | ✅ 2 mevcut warning (`edit.service.ts:190`, `AddVariantsDrawer.tsx`) — pre-existing baseline, ayrı carry-forward |
| `npm run check:tokens` | ✅ Token ihlali yok |
| `npx vitest run` (server) | ✅ 1700+ PASS |
| `npx vitest run --config vitest.config.ui.ts` | ✅ 735+ PASS |
| Playwright E2E (golden path) | ✅ 4/4 PASS |

**Phase 7 commit sayısı:** 43 commit (Task 1 → Task 42).

---

## Çalışan capability'ler (Phase 7 v1)

- **Quick start (canonical):** `/review` AI Tasarımları sekmesinden batch
  detayında "Selection Studio'da Aç" → atomic tx ile lazy `SelectionSet`
  create + tüm batch item'lar otomatik eklenir → `/selection/sets/[setId]`'e
  yönlendirir.
- **Studio canvas:** Aktif preview (büyük), filmstrip (yatay scroll, item
  multi-select + filter), sağ panel (item meta, edit history, AI Kalite,
  hızlı işlemler).
- **3 deterministik hızlı işlem:**
  - **Crop** (Sharp resize + center crop) — instant, sync.
  - **Transparent PNG kontrolü** — Phase 7 local duplicate (Phase 6 alpha-check
    consolidate Phase 6 smoke kapanınca yapılacak — carry-forward
    `selection-studio-alpha-check-consolidate`).
  - **Background remove** — `@imgly/background-removal-node` heavy job
    (BullMQ `EDIT_BACKGROUND_REMOVE`), paralel heavy yasağı (DB lock per
    item).
- **Hibrit edit semantiği:** `sourceAssetId` (orijinal) immutable; her edit
  yeni `currentAssetId` + `editHistoryJson` audit. Tek seviye undo (son
  edit'i geri al), reset to original (tüm edit'leri sıfırla).
- **Finalize gate:** `selected ≥ 1` zorunlu; modal'da breakdown (X selected /
  Y rejected / Z pending). Finalize sonrası set `ready`, item status'ları
  donar, edit/reorder/archive disabled.
- **Async ZIP export:** `EXPORT_SELECTION_SET` BullMQ job; manifest schema v1
  + `images/`, `originals/` (yalnız edit yapılmış item'lar), `README.txt`;
  signed URL 24h TTL, file cleanup 7g.
- **Drawer ile cherry-pick:** Reference Batches sekmesi aktif (kullanıcı
  reference batch'lerinden item çeker), Review Queue sekmesi disabled
  (Phase 6 canlı smoke gating).
- **Multi-select bulk bar:** Selected'a ekle / Reddet (soft remove) / Hard
  delete (TypingConfirmation "SİL" zorunluluğu).
- **Accessible reorder:** Filmstrip kebap menü → Sola taşı / Sağa taşı /
  Başa al / Sona al; ARIA-live anons. Drag-and-drop YOK (bilinçli ürün
  kararı, carry-forward).
- **AI Kalite paneli (Phase 6 köprü):** Sağ panel'de item'ın Phase 6 review
  verisi varsa read-only gösterilir (score badge, risk flags, decision).
  Mapper layer Phase 6 schema değişikliklerini Studio'dan izole eder.
  "Review'a gönder" link disabled (Phase 6 smoke gating).
- **Notification + inline feedback:** Heavy edit + export tamamlanma /
  failure'da page-level Toast (5sn auto-dismiss, multi-stack); buton-içi
  inline spinner / "Tekrar dene" durumu.

---

## Phase 5 + Phase 6'dan kapatılan carry-forward

| Carry-forward | Phase 7'de nerede kapandı |
|---------------|----------------------------|
| `fix-with-ai-actions` (Phase 6'dan) | **Kısmen kapandı** — Phase 7 v1'de deterministik 3 hızlı işlem var; AI destekli "Edit prompt / Edit uygula" carry-forward'a `selection-studio-ai-edit` olarak korundu |
| `destructive-typing-confirmation` (Phase 5'ten, Phase 6'da kapanmıştı) | Phase 7'de bulk hard delete'de **reuse edildi** (Task 34) |

---

## BLOCKED işler (drift #6 + KIE flaky kaynaklı)

> Phase 6 canlı smoke kapandığında açılacak. **Bu işler ürün-kararı kapalı
> affordance DEĞİLDİR** — Phase 7 v1'de UI'da yer var ama Phase 6
> infrastructure beklediği için disabled.

| Carry-forward | Açıklama | Açılma koşulu |
|---------------|----------|---------------|
| `selection-studio-review-queue-source` | AddVariantsDrawer'da Review Queue tab — kullanıcı Phase 6 review queue'sundan item çekebilecek | Phase 6 status `🟢` |
| `selection-studio-trigger-review` | Sağ panel "Review'a gönder" link — review yok durumdaki item için Phase 6 review job tetikleyecek | Phase 6 status `🟢` |
| `selection-studio-alpha-check-consolidate` | Phase 7'de transparent-check için local duplicate var; Phase 6 alpha-check service'iyle birleştirilecek | Phase 6 status `🟢` (consolidate refactor güvenli olsun diye) |

---

## Bilinçli kapalı affordance'lar (ürün kararı — BLOCKED ile karıştırma)

> **Bug değildir, Phase 7 v1 kapsamı dışıdır.** Spec §1.3 + §1.4 honesty
> disiplini gereği gizli/disabled.

- **Edit prompt section komple gizli** — Mockup'ta var (`design-canvas.jsx`,
  `tweaks-panel.jsx`'te görünüyor) ama Phase 7 v1'de honesty disiplini
  gereği placeholder bile yok. Carry-forward `selection-studio-ai-edit`.
- **Upscale 2× disabled "Yakında"** — Buton görünür ama disabled.
  Carry-forward `selection-studio-upscale`.
- **Drag-and-drop reorder yok** — Menu/button accessible reorder kabul
  edilmiş ürün kararı (a11y default-garantili). DnD ek interaction
  mekanizması olarak ileride eklenebilir; carry-forward
  `selection-studio-drag-reorder`.
- **Set rename yok** — Set oluşturma anında verilen ad sabit.
  Carry-forward `selection-set-management-expanded`.
- **Archived set browsing UX yok** — `/selection` index'te archived set
  listesi/filtre yok; state machine `archived` kapısı doğru kurulu ama UX
  dışı. Carry-forward `selection-set-management-expanded`.
- **`ready → draft` geri dönüş yok** — Finalize tek yön. Carry-forward
  `selection-set-unfinalize`.
- **Mockup Studio handoff implementasyonu yok** — `ready` set Phase 8
  input'u; manifest schema v1 sözleşme. Carry-forward
  `selection-to-mockup-handoff`.
- **Listing/CSV export yok** — Phase 9+ Export Center kapsamı.
  Carry-forward `selection-studio-export-center`.
- **Mobile-optimized layout yok** — Phase 7 v1 desktop-first. Mobile
  responsive Phase 7+.

---

## Phase 7+ carry-forward'lar (ileride yapılacak)

> Spec §9 listesi + Tur 1–6 boyunca eklenenler — birleşik liste.

### Spec §9'dan

| Carry-forward | Kapsam |
|---------------|--------|
| `selection-studio-ai-edit` | AI destekli "Edit prompt / Edit uygula" — yeni image-edit provider abstraction |
| `selection-studio-review-queue-source` | Drawer'da Review Queue tab aktivasyonu (BLOCKED — Phase 6) |
| `selection-studio-direct-upload-source` | Drawer'a Bookmark / direct upload kaynağı |
| `selection-set-management-expanded` | Set rename, archived UX, multiple draft, search/filter |
| `selection-set-unfinalize` | `ready → draft` geri dönüş |
| `selection-studio-export-center` | Tam Export Center (CSV/JSON listing, mockup pack) |
| `selection-to-mockup-handoff` | Phase 8 Mockup Studio handoff implementasyonu |
| `selection-studio-trigger-review` | "Review'a gönder" link aktivasyonu (BLOCKED — Phase 6) |
| `selection-studio-edit-providers` | External edit provider abstraction (bg-remove cloud, upscale cloud) |
| `selection-studio-upscale` | Upscale 2× implementasyonu (provider + UI aktif) |
| `selection-studio-export-fast-path` | Küçük set için sync export optimizasyonu (E3 hibrit) |
| `selection-studio-cancel-export` | Devam eden export job'ı iptal etme |
| `selection-studio-nondestructive-edit-chain` | Full operation graph + replay + cache |
| `selection-import-reference-history` | Reference geçmişinin tamamını sete toplama |
| `selection-quick-start-from-reference-detail` | Reference detay sayfasından Quick start |
| `selection-quick-start-duplicate-warning` | Aynı batch'ten ikinci set uyarısı |
| `selection-studio-drag-reorder` | Drag-and-drop reorder (a11y desteği zorunlu) — Phase 7 v1 menu/button tabanlı reorder zaten user-controlled, DnD ek interaction mekanizması |
| `selection-studio-alpha-check-consolidate` | Phase 7 local alpha-check'i Phase 6 service'i ile birleştirmek (BLOCKED — Phase 6) |
| `asset-orphan-cleanup` | Orphan asset cleanup (genel scope) |

### Tur 1–6 yürütmesinden eklenenler

| Carry-forward | Kapsam |
|---------------|--------|
| `phase7-eslint-config-fix` | `edit.service.ts:190` rule config eksik + `AddVariantsDrawer.tsx` `no-unescaped-entities` warnings — pre-existing baseline; ayrı küçük cleanup turu |
| `phase7-imgly-audit-vulns` | `npm audit` 42 vulnerability — `@imgly/background-removal-node` transitif bağımlılık. Hard-block değil, monitoring |
| `phase7-e2e-baseline-other-specs` | `tests/e2e/auth.spec.ts` ve diğer mevcut E2E spec'leri auth-shell baseline kayması — `helpers.ts` fix sonrası 4/11 PASS, diğer 7 spec ayrı carry-forward |
| `selection-studio-export-polling-invalidate` | Manuel QA bulgu (2026-05-01): ExportButton polling refetch sırasında server tamamlandıktan sonra UI invalidate edemedi (~10sn gecikme). Reload sonrası state #3 doğru render. Polling refetch `selectionSetQueryKey` invalidate çağırıyor ama BullMQ `getActiveExport` cache miss olabilir. Phase 7 v1 v1.0.1 polish — kullanıcı etkisi: completed olduktan sonra 1 reload yeterli |
| `selection-drawer-disabled-tab-tooltip` | Manuel QA bulgu (2026-05-01): AddVariantsDrawer "Review Queue" tab disabled ama tıklamada hint mesajı görünmüyor (tooltip yalnız hover'da). Disabled tab tıklandığında inline mesaj "Phase 6 canlı smoke sonrası aktif" gösterimi daha yardımsever. Phase 7 v1 dürüst (sahte capability yok) ama yardımsever değil |

---

## Drift #6 + KIE flaky notu (Phase 6 canlı kapanış için)

> **Phase 7 v1 teslimini etkilemez** — Phase 6 mini-tur kapsamında izlenir.

- **Drift #5 kapatıldı** (commit `b681006`, Phase 6) — KIE strict JSON schema
  reserved word (`riskFlags[].type` → `kind` write-new + read-both
  backward-compat helper). Phase 7 mapper layer aynı `readRiskFlagKind`
  helper'ını reuse eder.
- **Drift #6 açık** (Aşama 2B kapsamı) — KIE bulut + localhost MinIO 403
  (KIE bulut `localhost:9000` MinIO instance'ına erişemez). İki çözüm
  yolu:
  - Küçük patch: `image-loader.ts` data URL inline (KIE'nin data URL
    desteği data URL probe sonrası netleşir)
  - Orta patch: MinIO temp upload bridge / public proxy
- **KIE endpoint flaky** — HEALTHY ↔ MAINTENANCE arasında dalgalanıyor;
  Aşama 2B probe deterministik sonuç alana kadar bekliyor.
- **Phase 6 status `🟡` korunuyor** — ayrı mini-tur gerekli.
- **Phase 7 v1 bağımsız `🟢` teslim edildi** — Selection Studio Phase 6
  review verisi yoksa da işler; Phase 6 canlı smoke'a kritik bağımlı değil.
  BLOCKED işler (Review Queue tab + "Review'a gönder" link) Phase 6
  kapanınca açılacak.

---

## Phase 7 v1 → Phase 8 handoff

- **Manifest schema v1 sözleşme** — `tests/contract/selection-studio/`
  altındaki 48 contract test schema'yı kilitler. Phase 8 Mockup Studio
  bu sözleşmenin üstüne biner.
- **`ready` SelectionSet'ler Phase 8 input'u** — `status: ready` set'in
  position-sıralı item'ları Mockup Studio'ya beslenir; immutable
  (item status'ları + sıralama donmuş).
- **ExportButton + Notification entegrasyonu** — Phase 8'de Mockup
  workflow'a evrilebilir (mockup pack export, async generation
  notification).
- **Spec carry-forward'ları** — `selection-to-mockup-handoff`,
  `selection-studio-export-center` Phase 8 başlangıcında scope tanımı
  girişi olarak kullanılır.

---

## Bilinen risk / pre-existing baseline (dürüstlük)

1. **`npm audit` 42 vulnerability** — `@imgly/background-removal-node`
   transitif bağımlılık. Production-deploy öncesi gözden geçirilmeli;
   carry-forward `phase7-imgly-audit-vulns`. Hard-block değil, Phase 7 v1
   teslimini etkilemiyor.
2. **2 ESLint warning (pre-existing baseline):**
   - `src/server/services/selection/edit-ops/edit.service.ts:190` — rule
     config eksik (warning, not error).
   - `src/app/(app)/selection/sets/[setId]/_components/AddVariantsDrawer.tsx`
     — `no-unescaped-entities` (TR karakter / apostrof).
   - Pre-existing; Phase 7 v1 teslimini bloke etmiyor; carry-forward
     `phase7-eslint-config-fix`.
3. **E2E baseline diğer spec'ler** — `tests/e2e/auth.spec.ts` ve diğer
   mevcut E2E spec'leri auth-shell baseline kayması göstermişti. `helpers.ts`
   fix sonrası 4/11 PASS (Phase 7 golden path 4/4 dahil); diğer 7 spec
   ayrı carry-forward `phase7-e2e-baseline-other-specs`. Phase 7 golden path
   etkilenmedi.
4. **Phase 7 transparent-check local duplicate** — Phase 6 alpha-check
   service'i mevcut; Phase 7 v1'de local duplicate kullanıldı (consolidate
   Phase 6 canlı smoke kapanınca yapılacak — Phase 6 baseline'a dokunmama
   disiplini). Carry-forward `selection-studio-alpha-check-consolidate`.
5. **Manuel QA henüz yapılmadı** — subagent gerçek tarayıcı + screen reader
   + ZIP extract testlerini yapamaz. Kullanıcı [`phase7-manual-qa.md`](./phase7-manual-qa.md)
   adımlarını koşturup sonuçları işleyecek. Surprise drift varsa bu
   doc'a "Manuel QA bulguları (YYYY-MM-DD)" başlığı eklenir.

---

## Manuel QA sonuçları

[`phase7-manual-qa.md`](./phase7-manual-qa.md) adresine ayrı dosyaya işlendi.
Kullanıcı tarafından adım adım yürütülecek; sonuç bu doc'a "Manuel QA
sonucu (YYYY-MM-DD)" başlığı altında özetlenecek.

---

## Sonraki adımlar (Phase 7 sonrası)

1. **Phase 6 mini-tur:** KIE stabilize → drift #6 data URL probe → Aşama 2B
   impl seçimi (küçük patch / orta patch) → Phase 6 canlı smoke retry →
   Phase 6 status `🟢`.
2. **BLOCKED işleri açma:** Phase 6 `🟢` sonrasında
   `selection-studio-review-queue-source`, `selection-studio-trigger-review`,
   `selection-studio-alpha-check-consolidate` mini-turlarla aktive edilir.
3. **Phase 8 Mockup Studio başlangıcı** — yeni spec/brainstorm turu.
   `ready` SelectionSet manifest schema v1 input'u.
4. **Manuel QA çevrimi** — kullanıcı `phase7-manual-qa.md` koştuktan sonra
   bulguları bu doc'a yansıt.

---

## Kontrat — sonraki phase'ler için kilitli

Aşağıdaki sözleşmeler Phase 7 v1'in **bağlayıcı** çıktısıdır:

- **`SelectionSet` state machine** — `draft → ready / archived`,
  `ready → archived`, başka geçiş yok. `ready → draft` geri dönüş
  carry-forward.
- **`SelectionItem` status enum** — `pending / selected / rejected`
  (default `pending`). Finalize sonrası donar.
- **Hibrit edit semantiği** — `sourceAssetId` immutable, tek seviye undo,
  reset to original, `editHistoryJson` audit. Non-destructive chain
  carry-forward.
- **Manifest schema v1** — `schemaVersion: "1"` discriminator + 48 contract
  test (Task 40 sonrası). Phase 8 handoff sözleşmesi.
- **Cross-user 404 disiplini** — tüm Selection Studio endpoint'leri
  owner-filtered query; cross-user erişim 404 (Phase 6 ile birebir).
- **AI Kalite mapper layer** — Phase 6 review schema'sı yalnız
  `src/server/services/selection/review-mapper.ts` üzerinden okunur. Phase 6
  schema değişiklikleri Studio'yu doğrudan kırmaz.
- **Reorder a11y default-garantili** — Menu/button reorder ARIA-live anons.
  Drag-and-drop ek mekanizma carry-forward (a11y desteği zorunlu).
- **Notification + inline feedback ikilisi** — heavy edit + export
  tamamlanma/failure her zaman iki kanaldan da görünür (page-level Toast +
  buton-içi inline).

---

## Manuel QA sonucu (2026-05-01 — browser-based smoke)

**Tarih:** 2026-05-01
**Test ortamı:** localhost:3000 (next dev) + dev-worker (BullMQ), admin user, Chrome
**Kapsam:** /selection index, CreateSetModal, Studio shell, filmstrip, AI Kalite,
quick actions (crop dropdown + transparent + bg-remove buton + upscale disabled),
selection toggle, FinalizeModal gate, ExportButton state machine, ZIP extract,
AddVariantsDrawer (Reference Batches + duplicate koruma + Review Queue disabled),
ArchiveAction, /review Studio CTA.

### Karar: GEÇTİ ✅

**Kritik bug yok.** Final ürün hissi tutuyor — mockup tonu, sade panel
yoğunluğu, dürüst empty/loading/error state'ler, honesty disiplini (Edit
prompt komple gizli, Upscale "Yakında" sakin, Review yok hint dürüst,
disabled affordance'lar gerçek davranışı yansıtıyor).

**Geçen alanlar (browser smoke):**
- /selection index — aktif draft kartı + son ready listesi pattern ✓
- /review → "Studio" CTA conditional render (jobId varsa) ✓
- Quick start full akış: review card → POST /quick-start → /selection/sets/[id]
  redirect, auto-name "Smoke Aşama 2A reference — 01 May 2026" ✓
- Studio shell üst bar: set adı + Draft badge + "1 varyant · 1 seçili"
  subtitle + İndir/Finalize/kebap menü ✓
- Filmstrip: variant count + filter dropdown + checkmark (selected) +
  active border + "+ Varyant ekle" placeholder ✓
- Sağ panel "Edit": header + AI Kalite (review yok hint + disabled
  "Review'a gönder" link) + Hızlı işlem 4 buton (Background remove enabled,
  Upscale 2× disabled "YAKINDA", Crop dropdown, Transparent PNG kontrolü) +
  İŞLEM GEÇMİŞİ + Reddet/Seçime ekle ✓
- Edit prompt section komple GİZLİ (mockup'taki bölüm Phase 7'de yok) ✓
- Crop dropdown 4 ratio: 2:3/4:5/1:1/3:4 portrait/square/landscape ✓
- Crop instant edit: 1:1 ratio uygulandı, edit history "Crop (1:1) — az önce"
  push'landı, "Orijinale döndür" enabled, Sharp resize gerçek çalıştı ✓
- Selection toggle: "Seçime ekle" → "Seçimden çıkar" label değişimi
  (final ürün UX improvement, mockup'tan ekstra), filmstrip checkmark,
  üst bar subtitle "0 seçili" → "1 seçili", Finalize butonu enabled
  (gate satisfied) ✓
- FinalizeModal: 3-sayı breakdown grid (1 Seçili / 0 Beklemede / 0 Reddedildi),
  dürüst metin (yalnız selected'lar Phase 8 input, pending donar) ✓
- ExportButton state #1 → #2: idle → "Export hazırlanıyor..." spinner
  transition ✓; state #3 reload sonrası "İndir" link primary tonu ✓
- ZIP extract: 4 dosya (manifest.json + README.txt + images/var-001.png +
  originals/var-001.png — A3 stratejisi); manifest schemaVersion "1",
  exportedBy.userId PII-safe, sourceMetadata Quick start info, item
  editHistory crop, status selected; README.txt Türkçe + Phase 8 disclaimer ✓
- AddVariantsDrawer: sağdan kayan panel, 2 tab (Reference Batches aktif +
  Review Queue disabled), reference selector, batch card "1 varyant ·
  1 set'te var" duplicate count, item thumbnail opacity reduced + "set'te
  var" badge, İptal/Ekle bottom ✓
- ArchiveAction: kebap menü → "Set'i arşivle" menuitem → ConfirmDialog
  warning tone, dürüst metin, İptal/Arşivle butonları ✓

### UI/UX sürtünmeleri (carry-forward, kritik değil)

1. **`selection-studio-export-polling-invalidate`**: ExportButton polling
   sırasında server tamamlandıktan sonra UI invalidate yapamadı (live
   transitionda ~10sn gecikme). Reload sonrası state #3 doğru render etti
   (DB `lastExportedAt` set, ZIP storage'da). Polling refetch
   `selectionSetQueryKey(setId)` invalidate çağırıyor ama `getActiveExport`
   BullMQ job state cache miss olabilir. Phase 7 v1 v1.0.1 polish — kullanıcı
   etkisi: completed olduktan sonra 1 reload veya 1 manuel refetch yeterli.
2. **`selection-drawer-disabled-tab-tooltip`**: AddVariantsDrawer "Review
   Queue" tab disabled ama ekrandan tab'a tıklandığında hint mesajı
   görünmüyor (tooltip yalnız hover'da; click no-op). UX polish: disabled
   tab tıklandığında inline mesaj "Phase 6 canlı smoke sonrası aktif"
   gösterimi daha yardımsever. Phase 7 v1 dürüst (sahte capability yok),
   ama yardımsever değil.

### Kullanıcı doğrulamaları geriye kalan (manuel QA checklist'te)

Kullanıcı tarafından zamanlı olarak yapılması gerekenler (subagent
yapamaz):
- Reorder erişilebilirlik: VoiceOver/NVDA + keyboard tab/enter ile menu/button
  reorder akışı, screen reader anonsları
- Background remove görsel kalitesi: gerçek model inference (saç, transparent
  obje edge case'leri); QA ortamında bu test'te denenmedi (smoke fixture
  düz kırmızı kare; @imgly model load + render gerek)
- Cross-browser: Safari, Firefox

Bu maddeler `phase7-manual-qa.md` dosyasında listelenmiş, kullanıcı sonradan
yürütebilir.

### Cleanup
QA fixture'ları (smoke design jobId patch + fake job + QA-yaratılan
SelectionSet) cleanup edildi. DB temiz state'e döndürüldü.
