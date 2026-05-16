# Selection / Library / Products — Boundary + Selection Edit Studio + Finalize Handoff

> **AUTHORITATIVE — CURRENT.** Stage #5 (kürasyon). Bu üç ekranın
> **karıştırılmaz sınır invariant'ı** + Selection edit studio +
> finalize → Mockup handoff **güncel davranış**. Boundary tek
> dosyada (parçalanmaz). Phase narrative DEĞİL.
>
> **Son güncelleme:** Phase 135 (2026-05-16)
> **Router:** `docs/claude/00-router.md` · **Önceki:** `review.md`
> · **Sonraki:** `mockup-studio-contract.md` (Apply Mockups)

---

## 1. Kapsam / Rol / Boundary

Üç ayrı ekran, **karıştırmak YASAK** (kod/route/copy/UI):

| Ekran | Tek-cümle | İçerir | İçermez |
|---|---|---|---|
| **Library** | Üretilmiş tüm asset'in tek doğruluk kaynağı | Variation çıktıları, upload, lineage; filter-driven (kept/rejected/all/by-ref/by-batch) | Set/kürasyon yönetimi YOK; "Add to Selection" sadece aksiyon |
| **Selections** | Kürate set'ler — mockup'a giden hat | Operatör-isimlendirilmiş/sıralanmış/edit'lenmiş gruplar; edit ops (bg remove, color, crop, upscale) | Mockup üretimi + listing YOK; sadece "Apply Mockups" CTA |
| **Products** | Mockup+bundle-preview+listing-draft+Etsy paket | Lifestyle/bundle mockup, listing metadata, digital files, Etsy draft history | Variation üretimi YOK; selection set kaynak, Product paket |

**Boundary:** Selection edit studio = kürasyon + edit; mockup
üretimi **Mockup Studio**'da (stage #6), listing/Etsy **Product**'ta
(stage #7). Library set CRUD yapmaz; Products variation üretmez.

## 2. Current behavior

- **State akışı TEK YÖNLÜ** (geri yazım YOK):
  ```
  Reference ─[create variations]─▶ Batch
            └─[items succeed]────▶ Library asset
  Library asset ─[add to selection]─▶ Selection set
  Selection set ─[apply mockups]─────▶ Product
  Product ─[generate listing+send]──▶ Etsy draft
  ```
  Her ok = action (single primary CTA), çoğu split-modal; operatör
  sayfa değiştirmez.
- **Library (Phase 8 baseline):** filter-driven grid; "Add to
  Selection" aksiyon. Server-rendered, 8s visibility-aware polling.
- **Selections index (B2):** kart stages (Curating/Edits/Mockup
  ready/Sent); batch lineage chip (`sourceMetadata`'dan;
  `↗ From batch · <id>` → `/batches/[id]`; Phase 50). Apply
  Mockups primary CTA.
- **Selection detail (StudioShell):** Designs/Edits/Mockups/
  History tab.
  - **DesignsTab (Phase 51):** per-tile status badge (selected/
    rejected/pending) + status filter chip strip + bulk-bar
    (Promote/Move-to-pending/Reject; `PATCH /items/bulk`) +
    count caption.
  - **Finalize (Phase 51-52):** stage-aware header CTA. Curating/
    Edits + selectedCount>0 → "Finalize selection · N" + "Next ·
    Apply Mockups". `POST /finalize` → status `ready`. Finalize
    success → sessionStorage one-shot → `selection-finalize-banner`
    ("N items finalized · set ready for mockups" + Apply Mockups
    CTA).
  - **Apply Mockups handoff:** finalized → header primary
    "Open in Studio" → `/selection/sets/[id]/mockup/studio`
    (Phase 78 canonical).
- **Review → Selection handoff (Phase 50):** review scope-complete
  (kept>0) → "Continue in Selection" (existing set) /
  "Create selection from N kept" (`/batches/[id]`).
- **Products detail (A5, Phase 14):** Source selection tile
  (back-link `/selections/[setId]`), Listing health, Next step,
  Mockups/Listing/Files/History tab. Frame Exports bucket
  (Phase 100).

## 3. Invariants (değişmez — Madde Z üstü en kritik boundary)

- **Library ≠ Selections ≠ Products — karıştırmak YASAK.** Sınır
  ihlali riskleri (CLAUDE.md):
  - "Selection" denilip Library grid çizilirse → ihlal
  - Products'a variation generate eklenirse → ihlal
  - Library'de set CRUD yapılırsa → ihlal
  - Etsy draft history Selections'ta tutulursa → ihlal
  Yeni feature/migration/refactor sınırı bulanıklaştırırsa **iş
  durdurulur**, sınır gözden geçirilir.
- **State akışı TEK YÖNLÜ** — geri yazım yok; her ok action
  (single primary CTA), sayfa değil.
- **Operator-only kept downstream gate (Madde V''):** Library'den
  selection'a ekleme operatör aksiyonu (silent auto-add YOK);
  selection finalize + mockup apply `SelectionItem.status`'tan
  gate'lenir; Etsy draft listing handoff'tan ilerler. AI
  advisory hiçbir downstream gate'te "kept" saymaz
  (`reviewStatus=APPROVED ∧ reviewStatusSource=USER` zorunlu).
- **İki decision katmanı ayrı** (karıştırılmaz):
  - **Operator decision** (downstream gate): `reviewStatus` +
    `reviewStatusSource` (Review modülü; Madde V).
  - **In-set curation:** `SelectionItem.status` (pending/selected/
    rejected) — Selection içinde mockup'a girer/çıkar. Yeni isim
    icat YASAK ("kept/selected/shortlisted" karışıklığı önlenir).
- **SelectionSet finalize sonrası immutable** (Phase 7 Task 35) —
  selection edit finalize sonrası dondurulur; Product detail yeni
  mockup uygular ama Selection edit'i yapamaz.
- **Selection → Product handoff:** SelectionSet → Mockup Apply →
  MockupJob result → Listing draft → `/products/[id]`. Doğrudan
  Selection → Product CTA YOK (mockup apply zorunlu ara durak).
  Product = Listing (DB'de `Listing` tablosu, UI'da "Product"
  branding).
- **Lineage:** `SelectionSet.sourceMetadata.mjOrigin.batchIds` /
  `kind:"variation-batch"` (schema-zero; Phase 1/50). Selection
  card + detail batch lineage chip aynı resolver.
- High-volume zorunlu (CLAUDE.md): Library/Selection items/Batch
  items/Products virtualized grid + bulk floating bar + density
  toggle persist.

## 4. Relevant files / Ownership

- `src/features/library/` — filter-driven grid, LibraryClient
- `src/features/selections/` — index, SelectionCard, lineage chip
- `src/features/selection/` — StudioShell, DesignsTab,
  SelectionDetailClient, finalize, bulk
- `src/features/products/` — ProductsIndexClient, MockupsTab
  (Frame Exports bucket), boundary discipline
- `src/server/services/selection/` — index-view (lineage resolve),
  kept handoff, `createSelectionFromBatch` dispatcher
- `src/app/(app)/library/` `/selections/` `/selection/sets/[id]/`
  `/products/[id]/`
- `src/lib/selection-lineage.ts` — shared lineage resolver

## 5. Open issues / Deferred

→ `docs/claude/known-issues-and-deferred.md`:
- Compare mode (side-by-side) — DesignsTab grid+filter sonrası
- Drag-and-drop reorder (position PATCH endpoint var; UI wiring
  ayrı tur)
- Selection studio intra-surface TR drift (RightPanel/Filmstrip/
  QuickActions — Phase 15 visible parity scope dışı kalanlar;
  i18n katmanı turu)
- Apply Mockups → Product handoff confidence polish

## 6. Archive / Historical pointer

Tarihsel detay (Phase 50-52 boundary/handoff, Phase 14-17 Products
index B4, Phase 7 Selection finalize immutability) →
`docs/claude/archive/phase-log-12-96.md` (NOT authoritative).
Canonical boundary kuralı → `CLAUDE.md` "Library / Selections /
Products — Sınır Invariant'ları" + Madde V''.
