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
  - **DesignsTab (Phase 51):** status filter chip strip +
    bulk-bar (Promote/Move-to-pending/Reject; `PATCH /items/bulk`
    KOD-DOĞRU — `items/bulk/route.ts` `bulkUpdateStatus`) +
    count caption. Per-tile status badge (selected/rejected/
    pending) — filter/state KOD-DOĞRU; tile-level görsel badge
    render'ı kod-grounding'de net doğrulanamadı (Filmstrip/
    PreviewCard filter mantığı var, ayrı badge render'ı belirsiz —
    UI doğrulaması gerekirse browser ile teyit).
  - **Finalize (Phase 51-52):** stage-aware header CTA. Curating/
    Edits + selectedCount>0 → "Finalize selection · N" + "Next ·
    Apply Mockups". `POST /finalize` → status `ready`
    (`state.ts:140-146`). Finalize success → banner
    `selection-finalize-banner` ("N items finalized · set ready
    for mockups" + Apply Mockups CTA). **Düzeltme:** banner
    sessionStorage one-shot DEĞİL — local state `bannerDismissed`
    (`SelectionDetailClient.tsx:431`; refresh banner'ı sıfırlar,
    one-shot persist yok).
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

> **Enforcement-tier ayrımı (kod-grounding 2026-05-17):** Bu
> doc'taki invariant'lar iki sınıf — karıştırma:
>
> **KOD-ENFORCED** (runtime mekanizma var, dosya:satır):
> - SelectionSet finalize immutability — `assertSetMutable`
>   (`services/selection/state.ts`) tüm item mutation'ında;
>   ready/archived → `SetReadOnlyError`.
> - Operator-only kept downstream gate — `reviewStatus="APPROVED"
>   ∧ reviewStatusSource="USER"` Prisma WHERE filter
>   (`kept.ts:783-784`, `review/queue/route.ts:302,611`).
> - İki decision katmanı ayrı — `SelectionItem.status` vs
>   `GeneratedDesign.reviewStatus`+`reviewStatusSource` schema-distinct.
> - Finalize gate selected≥1 — `assertCanFinalize` (`state.ts:87-92`)
>   + UI gate.
> - Lineage resolver — `selection-lineage.ts:30-62` schema-zero
>   dual-path (`mjOrigin.batchIds` / `kind:"variation-batch"`).
>
> **POLICY / KONVANSİYON** (kod enforce ETMEZ; UI ayrımı +
> code-review disiplini):
> - "Library ≠ Selections ≠ Products karıştırmak YASAK" — route
>   guard/middleware/service validation **YOK**; yalnız endpoint'ler
>   fiziksel ayrı + boundary discipline comment'ler (`Products
>   IndexClient.tsx:40-44`, `AddToSelectionModal.tsx:11`). Refactor/
>   yeni feature'da sınır erode olabilir → iş durdurulup gözden
>   geçirilir (ürün kuralı, runtime değil).
> - "Products'a variation generate / Library set CRUD eklenmez" —
>   kod path'i yok ama engelleyen guard da yok (konvansiyon).
> - "State akışı tek yönlü" — endpoint sırası tasarımı net + geri-
>   yazım kodu yok; schema-level cycle guard yok (tasarım kuralı).

Yukarıdaki tier bloğu **tek otoriter referans** (kanıt:satır
orada). Ek bağlam (tekrar değil):

- **"Library ≠ Selections ≠ Products" ihlal örnekleri** (POLICY —
  refactor/yeni feature bunlardan birini yaparsa **iş durdurulur**):
  Selection'da Library grid · Products'a variation generate ·
  Library'de set CRUD · Etsy draft history Selections'ta.
- **İki decision katmanı isimlendirme kuralı:** operator decision
  = `reviewStatus`+`reviewStatusSource` (Review/Madde V); in-set
  curation = `SelectionItem.status` (pending/selected/rejected).
  Yeni isim icat YASAK ("kept/selected/shortlisted" karışıklığı).
- **Selection → Product handoff zinciri:** SelectionSet → Mockup
  Apply → MockupJob result → Listing draft → `/products/[id]`.
  Doğrudan Selection→Product CTA YOK (mockup apply zorunlu ara
  durak; runtime guard değil — akış tasarımı). Product = Listing
  (DB `Listing`, UI "Product").
- High-volume zorunlu (CLAUDE.md ürün kuralı): virtualized grid +
  bulk floating bar + density toggle persist.

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

## 5.5 Enforcement plan (policy → enforced adayları)

POLICY/KONVANSİYON kuralların "should this become enforced?"
değerlendirmesi. Öncelik: **P1** yakın (sınır erozyonu riski
yüksek), **P2** orta, **P3** düşük (mevcut tasarım yeterince
koruyor).

| Kural | Şu an | Enforce adayı? | Öncelik | Önerilen mekanizma |
|---|---|---|---|---|
| Library≠Selections≠Products karıştırma | POLICY (UI ayrımı + code-review) | **Evet** | **P2** | Module-boundary lint (ESLint `no-restricted-imports`: products feature library/selection internal'ını import edemez) + route handler'da feature-scope assert. Tam runtime guard pahalı; lint + import-boundary %80 erozyon yakalar. |
| Products'a variation generate eklenmez | POLICY (kod path yok) | Hayır | P3 | Mevcut: variation servisi yalnız Batch'te. Lint import-boundary (üstteki) bunu da kapsar; ayrı guard gereksiz. |
| Library set CRUD eklenmez | POLICY (UI'da yok) | Hayır | P3 | Aynı import-boundary lint kapsamında; LibraryClient salt-filter. Ek mekanizma YAGNI. |
| State akışı tek yönlü (geri yazım yok) | POLICY (tasarım + geri-yazım kodu yok) | Kısmi | P2 | Schema-level cycle guard pahalı/gereksiz. Bunun yerine handoff servislerine **tek-yön assert** (örn. `createSelectionFromBatch` yalnız Batch→Selection; ters fonksiyon yazılmasını engelleyen test + servis-katmanı invariant testi). |
| Apply Mockups zorunlu ara durak (Selection→Product) | POLICY (akış tasarımı; doğrudan CTA yok) | Hayır | P3 | Product = Listing; listing draft yalnız MockupJob result'tan oluşur (`createListingDraftFromMockupJob`). Yapısal — guard'a gerek yok. |

**KOD-ENFORCED kalan** (plan gerektirmez, korunmalı): finalize
immutability (`assertSetMutable`), operator-kept gate (SQL
`reviewStatusSource=USER`), 2-katman decision schema, finalize
gate (`assertCanFinalize`), lineage resolver. Bunlar regresyon
testi ile korunur; yeni iş bunları zayıflatamaz.

**Net öneri:** Tek yüksek-değer aksiyon = **P2 module-boundary
ESLint kuralı** (products↛library/selection internal import +
handoff tek-yön servis testi). Bu, en kritik POLICY'yi (boundary
karışması) ucuz şekilde yarı-enforce eder. Diğerleri mevcut
tasarımla yeterince korunuyor — premature guard YASAK
(CLAUDE.md erken-abstraction).

## 6. Archive / Historical pointer

Tarihsel detay (Phase 50-52 boundary/handoff, Phase 14-17 Products
index B4, Phase 7 Selection finalize immutability) →
`docs/claude/archive/phase-log-12-96.md` (NOT authoritative).
Canonical boundary kuralı → `CLAUDE.md` "Library / Selections /
Products — Sınır Invariant'ları" + Madde V''.
