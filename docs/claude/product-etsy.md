# Product / Etsy (Product Detail / Listing Builder / Frame Export / Etsy Draft)

> **AUTHORITATIVE — CURRENT.** Stage #7 (publish hazırlık). Product
> detail, Listing builder, Frame export persistence/handoff, Etsy
> draft submit (V1) **güncel davranış + invariant**. Phase narrative
> DEĞİL.
>
> **Son güncelleme:** Phase 135 (2026-05-16)
> **Router:** `docs/claude/00-router.md` · **Önceki:**
> `selection-library-products.md` + `mockup-studio-*.md`

---

## 1. Kapsam / Rol / Boundary

Product = mockup'lanmış + bundle-preview-hazırlanmış + listing-
draft'lanmış + Etsy'ye giden **paket**. Listing builder digital-
download listing metadata üretir; Frame export Mockup Studio Frame
mode çıktısını persiste edip Product'a bağlar; Etsy draft submit
V1 (active publish DEĞİL — draft + manual approval). **Boundary:**
Product variation **üretmez** (selection set kaynak); listing/
Etsy yalnız burada (Selection/Library'de değil).

## 2. Current behavior

- **Products index (B4, Phase 14-17):** 8-column table (thumb/
  product/type/files/health/status/updated/chevron) + search
  (name/type/draft-id) + Status/Type/Date filter chip + density
  toggle + "SENT THIS WEEK" subtitle + failure micro-copy
  (Failed stage `Listing.failedReason`). "From Selections" ghost
  helper (canonical Product giriş).
- **Product detail (A5, Phase 14):** header (title/stage badge/
  Etsy chip/"Send to Etsy as Draft") + summary strip (Source
  selection back-link `/selections/[setId]`, Mockups, Files,
  Listing health, Next step) + tabs Mockups/Listing/Files/History.
- **Listing builder (Phase 9 V1):** title/description/13 tags/
  category (Digital Downloads)/price/materials/file types (ZIP/
  PNG/PDF/JPG/JPEG)/commercial license/instant download. AI
  metni master prompt'tan; readiness checklist; Etsy'ye **draft**.
  Üretilmez: production partner/physical/shipping/made-to-order.
- **Frame export (Phase 99-103):** Mockup Studio Frame mode →
  `POST /api/frame/export` → Sharp pipeline (aspect-aware plate
  chrome + cascade + scene + glass + lens-blur) → MinIO PNG +
  signed URL. `FrameExport` Prisma persistence (Phase 100;
  `sceneSnapshot` + `deletedAt` soft-delete). Inline result
  banner (Open/Download/Re-export + stale indicator) + "Send to
  Product" → listing popover → `POST /api/listings/draft/[id]/
  add-frame-export` (`kind:"frame-export"` imageOrder entry,
  setAsCover).
- **MockupsTab Frame Exports bucket (Phase 100-101):** frame-
  export entry'leri ayrı section; tile `aspect-[4/3] bg-ink
  object-contain` (16:9 export kırpılmaz; Phase 101). Mockup-
  render entry'leri Phase 8 baseline (`aspect-square object-
  cover`).
- **Etsy draft submit (Phase 9 V1):** `image-upload.service`
  `orderForUpload` (packPosition ASC, cover-first) +
  `storage.download(entry.outputKey)` + `entryId` narrow
  (`kind:"frame-export"` → frameExportId; mockup-render →
  renderId). `ListingImageOrderEntry` discriminated union
  (mockup-render | frame-export; legacy `kind`-siz →
  mockup-render default backward-compat). SubmitResultPanel
  (Sent to Etsy / Open on Etsy / Reset to DRAFT).

## 3. Invariants (değişmez)

- **Etsy draft V1 — active publish YASAK** (draft + human
  approval; CLAUDE.md ürün kuralı). Direct active publish yok.
- **Product = Listing** (DB `Listing`, UI "Product"); Frame
  export = `FrameExport` ayrı model. Doğrudan Selection→Product
  CTA YOK (mockup apply zorunlu — bkz. `selection-library-
  products.md`).
- **Preview = Export Truth (Mockup Studio §11.0):** Frame export
  Studio preview'ın birebir Sharp render'ı (geometry + asset
  identity + layered effects + shared canonical parameter).
  Canonical truth = exported PNG; Product MockupsTab gerçek
  export PNG'sini gösterir (yeniden yorum YASAK). Detay →
  `docs/claude/mockup-studio-contract.md` §11.0.
- **`ListingImageOrderEntry` discriminated union:** `kind:
  "mockup-render" | "frame-export"`; legacy `kind`-siz row →
  mockup-render default (backward-compat). Helpers
  `imageOrderEntryId`/`isMockupRenderEntry`/`isFrameExportEntry`.
- **Etsy submit pipeline kind-agnostic:** orderForUpload
  packPosition ASC (cover-first) + `storage.download(outputKey)`
  + entryId narrow. Frame export + mockup render aynı
  outputKey/signedUrl yolundan akar.
- **FrameExport persistence:** her render `FrameExport` row
  (userId zorunlu — cross-user isolation; selectionSetId
  nullable; `deletedAt` soft-delete). Signed URL 5dk TTL geçici;
  kalıcı kaynak `storageKey`.
- **Frame compositor (`frame-compositor.ts`) canonical export
  motoru** (KOD-DOĞRU): `resolveMediaOffsetPx` canonical+export
  AYNI fonksiyon (`:34,468` — §11.0); plate-only Lens Blur
  type-enforced (`FrameLensBlurTarget`, `:127`); ProductType
  shape (`FrameDeviceShape` enum, `:80-119`). "zoom export'ta
  YOK" = yapısal (input'ta zoom param hiç yok + Phase 111
  composition-group lock parity) — enforce eden kod değil,
  zoom'un var olmaması. Detay → `mockup-studio-framing.md` +
  `mockup-studio-zoom-navigator.md` §5.
- Digital-only listing — physical/shipping/made-to-order
  alanları YASAK (KOD-DOĞRU: `submit.service.ts:175-178`
  hardcoded `isDigital:true`, `whenMade:"made_to_order"`,
  `whoMade:"i_did"` V1 lock).
- **Listing readiness checklist = SOFT-WARN (POLICY, submit'i
  BLOKLAMAZ):** submit pipeline yalnız **title/description/price**
  zorunlu blok eder (`submit.service.ts:187-202`); readiness
  checks (13 tag/resolution/AI review/trademark/export/Etsy
  zorunlu alan) operatöre **uyarı** gösterir ama submit'i
  durdurmaz (K3 ürün kuralı; runtime hard-gate değil). Doc'taki
  "zorunlu" = ürün kuralı; kod-enforced blok yalnız 3 alan.

## 4. Relevant files / Ownership

- `src/features/products/` — ProductsIndexClient, ProductDetail,
  MockupsTab (Frame Exports bucket), index-view
- `src/features/listings/` — ListingDraftView, MetadataSection,
  PricingSection, AssetSection, SubmitResultPanel, readiness,
  status-labels, image-upload.service
- `src/providers/mockup/local-sharp/frame-compositor.ts` — Frame
  export Sharp pipeline (canonical export motoru)
- `src/server/services/frame/frame-export.service.ts` — persist +
  signed URL + ownership
- `src/app/api/frame/export/`, `/frame/exports/`,
  `/listings/draft/[id]/add-frame-export/`
- `src/app/(app)/products/`, `/products/[id]/`

## 5. Open issues / Deferred

→ `docs/claude/known-issues-and-deferred.md` (D bölümü):
- Gerçek Etsy V3 API POST e2e (production credential; continuity
  DB+kod kanıtlı, gerçek POST scope dışı)
- Portrait/Watermark/BG Effects wire (preview-only `data-wired=
  false`)
- Operator-uploaded BG image (asset upload reuse)
- Studio history viewer + FrameExport delete/archive UI
- "Create new listing from Frame export" bypass
- Listing builder field-level Kivasy DS migration

## 5.5 Enforcement plan (policy → enforced adayları)

| Kural | Şu an | Enforce adayı? | Öncelik | Önerilen mekanizma |
|---|---|---|---|---|
| Listing readiness checklist (13 tag/resolution/AI review/trademark/export) | POLICY soft-warn (submit yalnız title/desc/price blok eder) | **Kısmi/seçici** | **P2** | **Hepsini hard-gate ETME** (operatör bilinçli eksik draft göndermek isteyebilir — Etsy admin'de tamamlar). Yalnız **trademark/negative-library risk** bir blocker'a yükseltilebilir (telif riski = ürün için yüksek maliyet; CLAUDE.md Negative Library). Öneri: `submit.service` readiness'te `riskFlags.trademark` varsa **hard-block + explicit override audit**; geri kalan readiness soft-warn kalır (operatör autonomisi). Kapsam: tek conditional + audit. |
| Etsy active publish YASAK | KOD-DOĞRU (`submit.service:175-178` isDigital/whenMade/whoMade hardcoded; status=PUBLISHED=admin'de yayınla) | — | — | Korunmalı; V1 lock. Active publish ileride ürün kararı olursa ayrı tur (şu an doğru). |
| Preview = Export Truth (§11.0) | KOD-DOĞRU (resolveMediaOffsetPx canonical+export aynı fonksiyon; type-enforced lens/shape) | — | — | Korunmalı; pixel-parity regresyon testi (Mockup Studio doc §11.0). Yeni iş bunu zayıflatamaz. |
| `ListingImageOrderEntry` backward-compat (kind-siz→mockup-render) | KOD-DOĞRU (discriminated union + helpers) | — | — | Korunmalı; migration yapılırsa union genişler, default korunur. |
| Digital-only listing (physical alanları yok) | KOD-DOĞRU (hardcoded V1) | — | — | Korunmalı (CLAUDE.md Madde D scope). |
| FrameExport cross-user isolation | KOD-DOĞRU (userId zorunlu + WHERE filter) | — | — | Korunmalı; regresyon testi. |

**Net öneri:** Tek değerlendirilecek aksiyon = **P2 trademark/
risk-flag selective hard-gate** (readiness'in TAMAMI değil, yalnız
telif-riskli flag submit'i bloklasın + explicit override audit).
Gerekçe: readiness'i topyekûn hard-gate yapmak operatör
autonomisini kırar (Etsy admin'de tamamlama meşru akış); ama
trademark riski ürün için orantısız maliyet — seçici enforce
mantıklı. Diğer maddeler zaten KOD-ENFORCED; korunur.

## 6. Archive / Historical pointer

Tarihsel detay (Phase 9 Listing V1, Phase 14-17 Products B4,
Phase 99-108 Frame export pipeline + parity) →
`docs/claude/archive/phase-log-12-96.md` + `phase-log-97-135.md`
(NOT authoritative). Frame export parity invariant'ı →
`docs/claude/mockup-studio-contract.md` §11.0 +
`docs/claude/mockup-studio-framing.md`.
