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
  motoru** — preview render sözleşmesini birebir izler; zoom
  export'ta YOK (composition scale=1); `resolveMediaOffsetPx`
  canonical+export aynı (§11.0). ProductType-specific item shape
  (sticker/wall_art/phone/bookmark/garment/garment-hooded) +
  item chrome (rounded+outline+shadow+tilt) + plate chrome
  (rounded+border+shadow+stage-padding) + plate-only Lens Blur.
  Detay → `docs/claude/mockup-studio-framing.md`.
- Digital-only listing — physical/shipping/made-to-order
  alanları YASAK (CLAUDE.md Madde D + Listing Builder scope).
- Listing readiness checklist zorunlu (title/13 tag/desc/
  resolution/AI review/trademark/export/Etsy zorunlu alan).

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

## 6. Archive / Historical pointer

Tarihsel detay (Phase 9 Listing V1, Phase 14-17 Products B4,
Phase 99-108 Frame export pipeline + parity) →
`docs/claude/archive/phase-log-12-96.md` + `phase-log-97-135.md`
(NOT authoritative). Frame export parity invariant'ı →
`docs/claude/mockup-studio-contract.md` §11.0 +
`docs/claude/mockup-studio-framing.md`.
