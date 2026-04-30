# Phase 7 — Selection Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Selection Studio'yu Phase 7 v1 olarak teslim et — `SelectionSet`/`SelectionItem` veri modeli + state machine + 3 deterministik hızlı işlem (crop, transparent-check, background-remove) + finalize + async ZIP export + drawer ekleme + bulk action + menu/button tabanlı reorder + Phase 6 review verisi read-only köprüsü. Spec ONAY aldı (commit `edd4242`); bu plan onu task-by-task implementable hale getirir.

**Architecture:**
1. **Veri modeli + state machine first**: `SelectionSet` (`draft|ready|archived`) ve `SelectionItem` (`pending|selected|rejected`) Prisma'da kurulur; tüm geçişler service layer'da explicit guard'larla korunur.
2. **Hibrit edit semantiği**: `sourceAssetId` immutable, `editedAssetId` aktif, `lastUndoableAssetId` tek seviye undo, `editHistoryJson` audit. Destructive ama source garantili.
3. **Hibrit işleme modeli**: instant ops (crop, transparent-check) sync API; heavy ops (background-remove) BullMQ; aynı item'da paralel heavy yasak.
4. **Authorization 404 disiplini**: Tüm endpoint'ler owner-filtered query; cross-user erişim 404 (Phase 6 paterni).
5. **Async export sözleşmesi**: `EXPORT_SELECTION_SET` job; Set GET payload'unda `activeExport` objesi; signed URL 24h, cleanup 7g.
6. **Phase 6 köprüsü**: Read-only mapper layer; review yazımı/tetikleme yok.
7. **Final ürün UX**: Menu/button tabanlı reorder (a11y default), zorunlu name input manuel create'de, kebap menü archive aksiyonu, drawer ile cherry-pick item ekleme.

**Tech Stack:** Next.js 15 (App Router), TypeScript strict, Prisma + PostgreSQL, BullMQ + Redis, sharp, `@imgly/background-removal` (WASM), `archiver` (ZIP), TanStack Query, Tailwind, Vitest + React Testing Library.

---

## TDD + Review Ritmi (Tüm task'ler için zorunlu)

- **Test-first veya test-birlikte:** Her task'te failing test → minimal implementation → pass → commit.
- **2-stage review:** Her anlamlı task sonunda
  - **Stage 1: Spec/contract compliance review** — Spec'in ilgili bölümüne uyum + endpoint kontratı + veri modeli alanları + state machine geçişleri.
  - **Stage 2: Code quality / regression safety review** — TS strict uyumu, token discipline (hardcoded color/spacing yasağı), Phase 6 baseline'ına dokunmama, naming consistency, dead code yok.
- **Subagent-driven development paterni:** Phase 6'daki disiplin birebir; her task için ayrı subagent + iki review döngüsü.

---

## Spec'ten Plan'a — Söz Tablosu

| Spec bölümü | Plan'da nerede |
|-------------|----------------|
| Section 4.1 SelectionSet alanları + 4.3 state machine | **Task 1** (Prisma) + **Task 4** (state guards) |
| Section 4.2 SelectionItem alanları + 4.4 status geçişleri | **Task 1** (Prisma) + **Task 5** (item service) |
| Section 4.5 hibrit edit semantiği | **Task 6** (edit service) |
| Section 5 hızlı işlem matrisi | **Task 7** (crop) + **Task 8** (transparent-check local) + **Task 9-10** (background-remove worker) |
| Section 6 ZIP export (manifest schema, klasör, async, signed URL) | **Task 11** (export service) + **Task 12** (export worker) + **Task 13** (signed URL + cleanup cron) |
| Section 6.6 activeExport retrieval | **Task 14** (Set GET payload genişletme) |
| Section 7.2 API endpoint'leri | **Task 15-22** (route by route) |
| Section 7.4 Phase 6 köprüsü (mapper layer) | **Task 16** (mapper layer) — Set GET include path'inde |
| Section 3.1 `/selection` index + zorunlu name modal | **Task 23** (index page) + **Task 24** (manual create modal) |
| Section 3.2 Studio canvas (sol + filmstrip + sağ panel) | **Task 25** (shell) + **Task 26** (filmstrip) + **Task 27** (sağ panel + AI Kalite) |
| Section 2.3 edit interactions + undo/reset | **Task 28** (instant edit UI) + **Task 29** (heavy edit UI + paralel yasak) + **Task 30** (undo/reset UI) |
| Section 3.2 reorder menu/button | **Task 31** (reorder controls) |
| Drawer "Varyant ekle" + Reference Batches tab + duplicate koruma | **Task 32** (drawer + reference batches) |
| Drawer Review Queue tab disabled | **Task 32** (disabled tab + tooltip) |
| Bulk action (multi-select + Selected/Reddet/Hard delete) | **Task 33** (bulk bar + actions) + **Task 34** (TypingConfirmation reuse) |
| Section 2.5 finalize + export UI | **Task 35** (finalize modal + selected ≥ 1 gate) + **Task 36** (export UI + activeExport polling) |
| Set kebap archive | **Task 37** (archive action) |
| Quick start `/review` AI Tasarımları action | **Task 38** (Phase 6 UI'sına primary action eklemek) |
| Section 3.3 notification entegrasyonu | **Task 39** (notification reuse — heavy edit + export) |
| Section 10 test stratejisi | Her task'te TDD + **Task 40** (manifest schema sözleşme testi) + **Task 41** (golden path E2E) + **Task 42** (manuel QA checklist + smoke doc) |

---

## Phase 6 Bağımlı / BLOCKED İşler

Spec'te provisional işaretlenen iki nokta plan'da BLOCKED kalır — Phase 6 canlı smoke kapanmadan AÇILMAZ:

| BLOCKED iş | Plan'da nerede |
|------------|----------------|
| Drawer "Review Queue" tab aktivasyonu | **Task 32** içinde **disabled** yapılır + tooltip "Phase 6 canlı smoke sonrası aktif"; aktivasyon ayrı carry-forward task `selection-studio-review-queue-source` |
| "Review'a gönder" disabled link (sağ panel review yok durumu) | **Task 27** içinde **disabled** yapılır + tooltip; aktivasyon carry-forward `selection-studio-trigger-review` |
| Phase 6 alpha-check service ile consolidate | **Task 8** local duplicate ile başlar; Phase 6 smoke kapandıktan sonra carry-forward `selection-studio-alpha-check-consolidate` |
| Phase 6 review schema değişimi durumunda mapper update | **Task 16** mapper layer'da view-model izolasyonu; Phase 6 schema sözleşmesi değişirse yalnız mapper güncellenir |

**Not:** BLOCKED işler Phase 7 v1 teslimini ENGELLEMEZ. Bunlar Phase 7 sonrası yapılacak işler — Phase 7'nin kendisi tamamen Phase 6 smoke'tan bağımsız akar.

---

## Dosya Yapısı

**Yeni dosyalar (oluşturulacak):**
- `prisma/migrations/<timestamp>_phase7_selection/migration.sql` (Task 1)
- `src/server/services/selection/types.ts` (Task 2)
- `src/server/services/selection/sets.service.ts` (Task 3)
- `src/server/services/selection/state.ts` (Task 4 — state machine guards)
- `src/server/services/selection/items.service.ts` (Task 5)
- `src/server/services/selection/edit.service.ts` (Task 6)
- `src/server/services/selection/edit-ops/crop.ts` (Task 7)
- `src/server/services/selection/edit-ops/transparent-check.ts` (Task 8)
- `src/server/services/selection/edit-ops/background-remove.ts` (Task 9)
- `src/server/workers/selection-edit.worker.ts` (Task 10)
- `src/server/services/selection/export/manifest.ts` (Task 11)
- `src/server/services/selection/export/zip-builder.ts` (Task 11)
- `src/server/workers/selection-export.worker.ts` (Task 12)
- `src/server/services/selection/export/signed-url.ts` (Task 13)
- `src/server/services/selection/export/cleanup.cron.ts` (Task 13)
- `src/server/services/selection/active-export.ts` (Task 14)
- `src/server/services/selection/review-mapper.ts` (Task 16)
- `src/server/services/selection/authz.ts` (Task 17 — owner filter helper)
- `src/app/api/selection/sets/route.ts` (Task 18)
- `src/app/api/selection/sets/quick-start/route.ts` (Task 19)
- `src/app/api/selection/sets/[setId]/route.ts` (Task 14, 20)
- `src/app/api/selection/sets/[setId]/items/route.ts` (Task 20)
- `src/app/api/selection/sets/[setId]/items/[itemId]/route.ts` (Task 20)
- `src/app/api/selection/sets/[setId]/items/bulk/route.ts` (Task 21)
- `src/app/api/selection/sets/[setId]/items/bulk-delete/route.ts` (Task 21)
- `src/app/api/selection/sets/[setId]/items/[itemId]/edit/route.ts` (Task 22)
- `src/app/api/selection/sets/[setId]/items/[itemId]/edit/heavy/route.ts` (Task 22)
- `src/app/api/selection/sets/[setId]/items/[itemId]/undo/route.ts` (Task 22)
- `src/app/api/selection/sets/[setId]/items/[itemId]/reset/route.ts` (Task 22)
- `src/app/api/selection/sets/[setId]/items/reorder/route.ts` (Task 22)
- `src/app/api/selection/sets/[setId]/finalize/route.ts` (Task 22)
- `src/app/api/selection/sets/[setId]/archive/route.ts` (Task 22)
- `src/app/api/selection/sets/[setId]/export/route.ts` (Task 22)
- `src/app/(app)/selection/page.tsx` (Task 23)
- `src/app/(app)/selection/_components/CreateSetModal.tsx` (Task 24)
- `src/app/(app)/selection/sets/[setId]/page.tsx` (Task 25)
- `src/app/(app)/selection/sets/[setId]/_components/StudioShell.tsx` (Task 25)
- `src/app/(app)/selection/sets/[setId]/_components/Filmstrip.tsx` (Task 26)
- `src/app/(app)/selection/sets/[setId]/_components/RightPanel.tsx` (Task 27)
- `src/app/(app)/selection/sets/[setId]/_components/AiQualityPanel.tsx` (Task 27)
- `src/app/(app)/selection/sets/[setId]/_components/QuickActions.tsx` (Task 28)
- `src/app/(app)/selection/sets/[setId]/_components/HeavyActionButton.tsx` (Task 29)
- `src/app/(app)/selection/sets/[setId]/_components/UndoResetBar.tsx` (Task 30)
- `src/app/(app)/selection/sets/[setId]/_components/ReorderMenu.tsx` (Task 31)
- `src/app/(app)/selection/sets/[setId]/_components/AddVariantsDrawer.tsx` (Task 32)
- `src/app/(app)/selection/sets/[setId]/_components/BulkActionsBar.tsx` (Task 33 — Phase 6 primitive reuse)
- `src/app/(app)/selection/sets/[setId]/_components/FinalizeModal.tsx` (Task 35)
- `src/app/(app)/selection/sets/[setId]/_components/ExportButton.tsx` (Task 36)
- `src/app/(app)/selection/sets/[setId]/_components/ArchiveAction.tsx` (Task 37)
- `src/features/selection/stores/selection-store.ts` (Task 25 — Zustand, Phase 6 paterni)
- `tests/unit/selection/...` ve `tests/integration/selection/...` her task'te TDD ile
- `tests/fixtures/selection/portrait-2x3.png`, `with-background.png`, `no-background.png`, `multi-format/*`, `seed/*` (Task 1 fixture seed'i ile başlar)

**Değiştirilecek dosyalar:**
- `prisma/schema.prisma` — Task 1
- `src/server/workers/bootstrap.ts` — Task 10 (`SELECTION_EDIT_BACKGROUND_REMOVE`), Task 12 (`EXPORT_SELECTION_SET`)
- `src/app/(app)/_components/AppSidebar.tsx` — Task 23 (Selection menü maddesi)
- `src/app/(app)/review/_components/...` (Phase 6 AI Tasarımları batch grup kartı) — Task 38 (Quick start primary action ekleme)
- `src/lib/notifications/...` — Task 39 (notification tipleri genişletme, Phase 6 reuse)

---

## Tasks

> **Granülerlik:** Task'ler 2-5 saatlik koherent birim. TDD adımları her task içinde (failing test → impl → pass → commit). Task arası bağımlılık explicit; sıralama sırasıyla.

---

### Task 1: Prisma migration — `SelectionSet` + `SelectionItem`

**Neden var:** Tüm Phase 7 yüzeyi bu iki entity üstünde; veri modeli ilk task.

**Kapsam:**
- `SelectionSet` model: id, userId, name, status enum, sourceMetadata Json?, lastExportedAt DateTime?, finalizedAt DateTime?, archivedAt DateTime?, createdAt, updatedAt
- `SelectionItem` model: id, selectionSetId, generatedDesignId, sourceAssetId, editedAssetId?, lastUndoableAssetId?, editHistoryJson Json (default `[]`), status enum, position Int, createdAt, updatedAt
- Enum'lar: `SelectionSetStatus { draft, ready, archived }`, `SelectionItemStatus { pending, selected, rejected }`
- Index'ler: `SelectionSet(userId, status)`, `SelectionItem(selectionSetId, position)`, `SelectionItem(generatedDesignId)`
- FK relations: User, GeneratedDesign, Asset (3 alan: source/edited/undoable)

**Ana dosyalar:**
- `prisma/schema.prisma` (modify)
- `prisma/migrations/<timestamp>_phase7_selection/migration.sql` (create)

**Test beklentisi:**
- `tests/integration/selection/schema.test.ts`: migration apply, basit insert/select roundtrip, FK constraint reject (orphan item insert), enum default değerler, JSON default `[]`.
- Migration up/down çalışır (`prisma migrate dev` + reset).

**Risk seviyesi:** **Düşük-orta** (FK ilişki sayısı yüksek, ama mekanik).

**Bağımlılık:** Yok (kritik path bloker).

**Steps:**
- [ ] **Step 1:** Failing schema test (`tests/integration/selection/schema.test.ts`) — SelectionSet + SelectionItem create + FK ilişkileri.
- [ ] **Step 2:** `prisma/schema.prisma` modellerini ekle.
- [ ] **Step 3:** `npx prisma migrate dev --name phase7_selection` migration üret.
- [ ] **Step 4:** Schema test PASS.
- [ ] **Step 5:** Commit: `feat(phase7): selection set/item Prisma models`.

---

### Task 2: Selection types + zod schemas

**Neden var:** Service ve route katmanları bir tip sözleşmesi üzerinde çalışmalı; runtime validation zod ile.

**Kapsam:**
- TypeScript types: `SelectionSetView`, `SelectionItemView` (mapper output), `EditOpRecord`, `SourceMetadata`, `ActiveExport`.
- Zod schemas: `CreateSelectionSetInput { name }`, `QuickStartInput { source, referenceId, batchId, productTypeId }`, `AddItemsInput { items: { generatedDesignId }[] }`, `UpdateItemStatusInput`, `BulkUpdateInput`, `BulkDeleteInput { itemIds, confirmation: "SİL" }`, `EditOpInput` (crop params, transparent-check, bg-remove), `ReorderInput { itemIds: string[] }`, `FinalizeInput`, `ArchiveInput`.

**Ana dosyalar:**
- `src/server/services/selection/types.ts`

**Test beklentisi:**
- Zod parse success/failure cases — boş name reject, invalid enum reject, TypingConfirmation sentinel zorunlu.

**Risk seviyesi:** **Düşük**.

**Bağımlılık:** Task 1.

**Steps:**
- [ ] **Step 1:** Failing zod test (geçersiz inputlar reject ediliyor mu).
- [ ] **Step 2:** Types + zod schemas ekle.
- [ ] **Step 3:** Test PASS.
- [ ] **Step 4:** Commit: `feat(phase7): selection types + zod schemas`.

---

### Task 3: SelectionSet service (CRUD + read)

**Neden var:** Set yaratma, listeleme, single set fetch service-layer.

**Kapsam:**
- `createSet({ userId, name })` — manuel create, status `draft`.
- `quickStartSet({ userId, source: "variation-batch", referenceId, batchId, productTypeId })` — auto-name + sourceMetadata + items eager load (Task 5'e bağlı).
- `listSets({ userId, status? })` — index için (aktif draft + ready listesi).
- `getSet({ userId, setId })` — single set + items + review (Task 16 mapper devreye girer); ownership check fail → throw `NotFoundError` (404 mapping).
- `archiveSet({ userId, setId })` — `draft|ready → archived` (state machine guard Task 4).

**Ana dosyalar:**
- `src/server/services/selection/sets.service.ts`

**Test beklentisi:**
- `tests/unit/selection/sets.service.test.ts`: createSet sade name; quickStart auto-name pattern (`{ref/productType} — {date}`); listSets userId filter; getSet cross-user → NotFoundError; archive state geçişi.

**Risk seviyesi:** **Düşük-orta**.

**Bağımlılık:** Task 1, Task 2.

**Steps:**
- [ ] **Step 1:** Failing service tests (5 test başlığı).
- [ ] **Step 2:** Service fonksiyonları implement (Prisma queries + ownership filter).
- [ ] **Step 3:** Tests PASS.
- [ ] **Step 4:** Commit: `feat(phase7): SelectionSet service (create + list + get + archive)`.

---

### Task 4: State machine guard'ları

**Neden var:** Veri bütünlüğü için tüm state geçişleri tek noktadan korunsun; "ready'de mutation yasak" ve "selected ≥ 1 finalize gate" gibi invariantlar service-layer'da zorunlu.

**Kapsam:**
- `assertSetMutable(set)` — status `draft` değilse throw `SetReadOnlyError` (409 mapping).
- `assertCanFinalize(set, items)` — selected count ≥ 1 değilse throw `FinalizeGateError` (409). Pending sayılmaz, rejected sayılmaz.
- `assertCanArchive(set)` — `draft` veya `ready` haricinde reddedilir.
- `finalizeSet({ userId, setId })` — gate kontrol + transaction içinde `status: ready, finalizedAt: now()`.
- Item mutation operasyonları için `assertSetMutable` reuse (Task 5+ tüm item ops bunu çağıracak).

**Ana dosyalar:**
- `src/server/services/selection/state.ts`

**Test beklentisi:**
- `tests/unit/selection/state.test.ts`:
  - `draft` set mutable, `ready`/`archived` değil
  - finalize gate: 0 selected → reject; 1+ selected → pass
  - archive: `draft` ✓, `ready` ✓, `archived` reddedilir (no-op olmalı, idempotent değil — explicit error)
  - finalize transaction'ı: gate pass → status değişir + finalizedAt set edilir
  - finalize transaction'ı: gate fail → status değişmez (rollback)

**Risk seviyesi:** **Orta** (final ürün invariant'ları, regression riski).

**Bağımlılık:** Task 1, Task 2, Task 3.

**Steps:**
- [ ] **Step 1:** Failing state test'leri.
- [ ] **Step 2:** Guard fonksiyonlarını ekle, finalize transaction'ı.
- [ ] **Step 3:** Tests PASS.
- [ ] **Step 4:** Commit: `feat(phase7): selection state machine guards + finalize gate`.

---

### Task 5: SelectionItem service (status + reorder + add + delete)

**Neden var:** Item-level operasyonlar (status değişimi, drawer ekleme, reorder, hard delete) tek service içinde.

**Kapsam:**
- `addItems({ userId, setId, items })` — drawer'dan ekleme; duplicate koruma (set'te zaten varsa skip); position son sıraya. `assertSetMutable`.
- `updateItemStatus({ userId, setId, itemId, status })` — pending/selected/rejected geçiş. `assertSetMutable`.
- `bulkUpdateStatus({ userId, setId, itemIds, status })` — atomik (tek transaction).
- `bulkDelete({ userId, setId, itemIds })` — hard delete; SelectionItem silinir, asset entity dokunulmaz. `assertSetMutable`.
- `reorderItems({ userId, setId, itemIds })` — bulk position update; tek transaction; itemIds set'e tam eşleşmek zorunda (subset değil — ya hep ya hiç).

**Ana dosyalar:**
- `src/server/services/selection/items.service.ts`

**Test beklentisi:**
- `tests/unit/selection/items.service.test.ts`:
  - addItems duplicate skip + position increment
  - updateItemStatus geçiş matrisi (Section 4.4)
  - bulkUpdateStatus atomicity (eğer bir item başka user'a aitse hepsi reject)
  - bulkDelete asset'ler silinmez
  - reorderItems mismatch (eksik veya fazla itemId) reject; doğru input atomik update
  - **Cross-user 404 disiplini:** Tüm fonksiyonlarda set ownership ve item ownership doğrulanır.

**Risk seviyesi:** **Orta** (transaction discipline + atomicity + cross-user disiplin).

**Bağımlılık:** Task 1, Task 4.

**Steps:**
- [ ] **Step 1:** Failing item service tests (5 test başlığı).
- [ ] **Step 2:** Item service fonksiyonları (Prisma transactions).
- [ ] **Step 3:** Tests PASS.
- [ ] **Step 4:** Commit: `feat(phase7): SelectionItem service (status + reorder + add + delete)`.

---

### Task 6: Edit service (hibrit semantik orchestrator)

**Neden var:** Crop, transparent-check, background-remove operasyonları tek bir orchestrator üstünden geçer — `editedAssetId`/`lastUndoableAssetId`/`editHistoryJson` invariant'ları tek yerde korunur.

**Kapsam:**
- `applyEdit({ userId, setId, itemId, op })` — op tipine göre edit-ops/* fonksiyonunu çağırır (Task 7-9).
- Aktif görüntü kuralı: `editedAssetId ?? sourceAssetId` → input asset.
- Sonuç: yeni Asset → `editedAssetId` güncellenir, eski `editedAssetId` (varsa) `lastUndoableAssetId`'ye düşer, `editHistoryJson` push.
- `undoEdit({ userId, setId, itemId })` — tek seviye undo: `lastUndoableAssetId` swap, history son op `undone: true` flag ile veya pop.
- `resetItem({ userId, setId, itemId })` — `editedAssetId = null`, `lastUndoableAssetId = null`, history reset (carry-forward `asset-orphan-cleanup` not).
- Tüm fonksiyonlar `assertSetMutable`.
- Heavy op için `applyEditAsync({ ..., op: "background-remove" })` → BullMQ enqueue (Task 10), inline yerine `{ jobId }` döner.

**Ana dosyalar:**
- `src/server/services/selection/edit.service.ts`

**Test beklentisi:**
- `tests/unit/selection/edit.service.test.ts`:
  - Crop sonrası editedAssetId update + history push
  - İkinci edit sonrası lastUndoableAssetId doğru asset'e düşer
  - Undo: editedAssetId ↔ lastUndoableAssetId swap; lastUndoableAssetId yoksa reject
  - Reset: aktif görüntü sourceAssetId'e döner, history reset
  - Heavy op `applyEditAsync` BullMQ enqueue edilir (mock); paralel heavy başka bir item'da OK ama aynı item üstünde aktif heavy job varsa reject.
  - Asset cleanup yapmaz (carry-forward).

**Risk seviyesi:** **Yüksek** — final ürün invariant'ları + asset lifecycle. Yanlış olursa kullanıcı veri kaybı.

**Bağımlılık:** Task 1, Task 4, Task 5.

**Steps:**
- [ ] **Step 1:** Failing edit service tests (6 test başlığı).
- [ ] **Step 2:** applyEdit + undoEdit + resetItem + applyEditAsync implement.
- [ ] **Step 3:** Tests PASS.
- [ ] **Step 4:** Commit: `feat(phase7): edit service (hybrid destructive + single undo + reset)`.

---

### Task 7: Edit op — Crop (Sharp resize, instant)

**Neden var:** Aspect ratio crop deterministik, tek pass; hızlı işlem matrisinin instant tier ilki.

**Kapsam:**
- `cropAsset({ inputAssetId, params: { ratio } })` — Sharp resize `fit: 'cover'` + center crop.
- Aspect ratio enum: `"2:3" | "4:5" | "1:1" | "3:4"` (default product type'a göre frontend seçer).
- Output: yeni Asset entity (storage upload + DB row), Sharp `.toBuffer()` ile MinIO'ya stream.
- Edit history op: `{ op: "crop", params: { ratio }, at }`.

**Ana dosyalar:**
- `src/server/services/selection/edit-ops/crop.ts`

**Test beklentisi:**
- `tests/unit/selection/edit-ops/crop.test.ts`:
  - Fixture `tests/fixtures/selection/portrait-2x3.png` üstünde 2:3 crop → output dimensions doğru
  - 1:1 crop → output square
  - Asset upload mock'lu (storage provider mock)
  - Output Asset entity DB'de oluşur
  - Invalid ratio → throw

**Risk seviyesi:** **Düşük**.

**Bağımlılık:** Task 6.

**Steps:**
- [ ] **Step 1:** Fixture'ı ekle (portrait-2x3.png yoksa generate).
- [ ] **Step 2:** Failing crop tests.
- [ ] **Step 3:** cropAsset implement.
- [ ] **Step 4:** Tests PASS.
- [ ] **Step 5:** Commit: `feat(phase7): crop edit op (sharp resize + center crop)`.

---

### Task 8: Edit op — Transparent PNG kontrolü (local duplicate)

**Neden var:** Phase 7'nin alpha-check'i. Phase 6 alpha-check service'ine dokunmadan davranışsal uyumlu local duplicate.

**Kapsam:**
- `transparentCheck({ inputAssetId })` — Sharp metadata + alpha analysis:
  - Has alpha channel?
  - Alpha coverage % (transparent pixel ratio)
  - Edge contamination (kenar pixellerin alpha durumu)
  - Non-alpha pixel count (pure background varmı sezgisi)
- Eşikler Phase 6'dan **value olarak** kopyalanır (smoke baseline'a dokunmamak için service'i import etmiyoruz, ama eşik sayıları aynı).
- Output: `{ ok: boolean, signals: {...}, summary: string }`.
- Bu op asset üretmez — sadece raporlar; edit history'ye `{ op: "transparent-check", at, result }` eklenir.

**Ana dosyalar:**
- `src/server/services/selection/edit-ops/transparent-check.ts`
- (Phase 6 alpha-check `src/server/services/review/alpha-checks.ts` REFERENCE ONLY — import edilmez)

**Test beklentisi:**
- `tests/unit/selection/edit-ops/transparent-check.test.ts`:
  - Fixture `with-background.png` → ok: false, edge contamination yüksek
  - Fixture `no-background.png` (clean transparent) → ok: true, alpha coverage > eşik
  - JPEG fixture (no alpha) → ok: false, "no alpha channel" sinyali
  - Eşikler Phase 6 alpha-check ile aynı sayısal değerler (sözleşme test'i — değer değişirse hem Phase 6 hem Phase 7'de güncellenir).

**Risk seviyesi:** **Orta** — Phase 6 davranışsal uyumun korunması; consolidate carry-forward.

**Bağımlılık:** Task 6.

**Steps:**
- [ ] **Step 1:** Phase 6 alpha-check service'ini READ-ONLY olarak gözden geçir (eşikleri çıkar).
- [ ] **Step 2:** Fixture ekle (with-background, no-background).
- [ ] **Step 3:** Failing transparent-check tests.
- [ ] **Step 4:** Implement (Sharp metadata + alpha sample).
- [ ] **Step 5:** Tests PASS.
- [ ] **Step 6:** Commit: `feat(phase7): transparent-check op (local duplicate of Phase 6 alpha)`.

---

### Task 9: Edit op — Background remove (`@imgly/background-removal`)

**Neden var:** Selection Studio'nun kritik değer önermesi. Wall art / clipart / sticker akışları için olmazsa olmaz.

**Kapsam:**
- `@imgly/background-removal` npm dependency ekle (WASM, Node.js worker context).
- `backgroundRemove({ inputAssetId })` — model load (lazy + cached), inference, alpha output PNG.
- Output: yeni Asset (PNG, alpha channel), storage upload.
- Edit history op: `{ op: "background-remove", at }`.
- Format support: PNG/JPG/WebP input; output her zaman PNG (alpha required).
- Memory guard: input asset > 50MB → reject ("dosya boyutu sınırı aşıldı"). 50MB threshold spec'ten gelmiyor — pragmatik, plan'da netleştiriliyor (carry-forward `selection-studio-edit-large-asset-streaming` plan'a havale edilebilir, ama bu task içinde sabit threshold).

**Ana dosyalar:**
- `src/server/services/selection/edit-ops/background-remove.ts`
- `package.json` (dep ekleme)

**Test beklentisi:**
- `tests/unit/selection/edit-ops/background-remove.test.ts`:
  - **Mock'lu test:** Library mock'u → input/output asset swap (gerçek inference test scope dışı, library üreticisi sorumluluğu)
  - Format support: PNG/JPG/WebP success
  - Unsupported format (örn. GIF) → reject
  - Memory threshold reject (büyük asset)
  - Output Asset PNG, alpha channel mevcut

**Risk seviyesi:** **Yüksek** — model boyutu (~30-80MB), cold start, OOM riski, edge case'ler (saç, transparent objeler).

**Bağımlılık:** Task 6.

**Steps:**
- [ ] **Step 1:** Dependency ekle (`npm install @imgly/background-removal`).
- [ ] **Step 2:** Library mock setup (Vitest).
- [ ] **Step 3:** Failing tests.
- [ ] **Step 4:** Implement (model lazy init + format check + memory guard).
- [ ] **Step 5:** Tests PASS.
- [ ] **Step 6:** Manuel QA fixture: gerçek `@imgly/...` ile küçük PNG üzerinde local çalıştır, çıktı kalitesini doğrula.
- [ ] **Step 7:** Commit: `feat(phase7): background-remove edit op (@imgly/background-removal)`.

---

### Task 10: BullMQ worker — `SELECTION_EDIT_BACKGROUND_REMOVE`

**Neden var:** Heavy op async job; Phase 7 işleme modeli kuralları.

**Kapsam:**
- Worker handler `selection-edit.worker.ts` — job tipini `SELECTION_EDIT_BACKGROUND_REMOVE` kabul eder.
- Job payload: `{ userId, setId, itemId, opType: "background-remove" }`.
- Handler: ownership check → load item → load input asset → `backgroundRemove(inputAsset)` → DB update (`editedAssetId`, history push, `lastUndoableAssetId` swap).
- Failure handling: retry 2x (BullMQ default), 3. fail'de job FAILED state, item update edilmez, edit history `{ op, at, failed: true, reason }` push edilir.
- Paralel heavy yasağı: enqueue öncesi service layer'da kontrol (Task 6), worker'da double-check (defense in depth).
- Notification trigger: completion + failure event'i Phase 6 notification altyapısı reuse (Task 39).

**Ana dosyalar:**
- `src/server/workers/selection-edit.worker.ts`
- `src/server/workers/bootstrap.ts` (modify — handler register)

**Test beklentisi:**
- `tests/integration/selection/edit-worker.test.ts`:
  - Job success → item editedAssetId update + history push
  - Job failure (mock library throw) → retry + 3. fail FAILED state + history failure entry
  - Cross-user (job payload userId set sahibi değilse) → fail
  - Paralel heavy block: aktif job varken aynı itemId'de yeni job enqueue → reject

**Risk seviyesi:** **Yüksek** — worker lifecycle, retry semantics, notification entegrasyonu.

**Bağımlılık:** Task 6, Task 9.

**Steps:**
- [ ] **Step 1:** Failing worker integration test'leri.
- [ ] **Step 2:** Worker handler implement.
- [ ] **Step 3:** bootstrap.ts'e register ekle.
- [ ] **Step 4:** Tests PASS.
- [ ] **Step 5:** Commit: `feat(phase7): background-remove worker (BullMQ)`.

---

### Task 11: Export service — manifest + ZIP builder

**Neden var:** ZIP export Phase 7'nin Phase 8 handoff sözleşmesi. Manifest schema v1 sözleşme testi (Task 40) bunun üstüne biner.

**Kapsam:**
- `buildManifest({ set, items, exportedAt, exportedBy: { userId } })` — Section 6.3 schema'sı:
  - schemaVersion "1"
  - exportedAt
  - exportedBy.userId (PII disiplini — userEmail YOK)
  - set { id, name, status, createdAt, sourceMetadata }
  - items[] (filename, originalFilename?, generatedDesignId, sourceAssetId, editedAssetId, editHistory, review? (mapper layer Task 16), status, metadata)
- `buildZip({ manifest, assets })` — `archiver` ile streaming:
  - `images/var-001.png` (aktif asset her zaman)
  - `originals/var-NNN.png` (yalnız edit yapılmış item'larda)
  - `manifest.json` (pretty print)
  - `README.txt` (sade Türkçe, 10-15 satır, Section 6.4)
- Filename pattern: `var-{padded-position}.png` (örn. `var-001.png`).

**Ana dosyalar:**
- `src/server/services/selection/export/manifest.ts`
- `src/server/services/selection/export/zip-builder.ts`

**Test beklentisi:**
- `tests/unit/selection/export/manifest.test.ts`: 
  - Manifest shape Section 6.3 ile eşleşir
  - review opsiyonel (yoksa alan yok, null değil)
  - originalFilename yalnız edit yapılmış item'da
  - schemaVersion "1"
  - exportedBy yalnız userId
- `tests/unit/selection/export/zip-builder.test.ts`:
  - ZIP içinde `images/`, `originals/` (varsa), `manifest.json`, `README.txt`
  - Edit yapılmamış item için `originals/` dosyası YOK
  - Streaming (archiver) — büyük input simülasyonu (mock fixture array 50 item)
  - Manifest valid JSON parse

**Risk seviyesi:** **Orta** — manifest sözleşmesi Phase 8 handoff'una bağlı.

**Bağımlılık:** Task 1, Task 5. (Review verisi opsiyonel parametre olarak input'tur; Task 16 mapper output'unu Task 11 fonksiyonuna besler — mapper Task 16'da yazılır, Task 11 çağrı yerinde — Task 12 worker'da — birleşir.)

**Steps:**
- [ ] **Step 1:** Failing manifest tests.
- [ ] **Step 2:** buildManifest implement.
- [ ] **Step 3:** Manifest tests PASS.
- [ ] **Step 4:** Failing zip-builder tests.
- [ ] **Step 5:** archiver dependency ekle, buildZip implement.
- [ ] **Step 6:** zip-builder tests PASS.
- [ ] **Step 7:** Commit: `feat(phase7): export manifest + ZIP builder`.

---

### Task 12: BullMQ worker — `EXPORT_SELECTION_SET`

**Neden var:** Async export sözleşmesi; `lastExportedAt` worker tarafından completion'da set edilir.

**Kapsam:**
- Worker `selection-export.worker.ts` — `EXPORT_SELECTION_SET` job.
- Job payload: `{ userId, setId, jobId }`.
- Handler:
  1. Ownership check
  2. Set + items + assets fetch (mapper layer dahil — review opsiyonel)
  3. Asset'leri storage'tan stream-download (memory'de tutmamak için archiver streaming)
  4. ZIP üret (Task 11 reuse)
  5. ZIP storage'a upload (`exports/{userId}/{setId}/{jobId}.zip` path)
  6. Signed URL generate (Task 13)
  7. DB update: `set.lastExportedAt = now()`
  8. Job result: `{ downloadUrl, expiresAt }`
  9. Notification trigger (Task 39)
- Failure: retry 2x, 3. fail FAILED state + notification.

**Ana dosyalar:**
- `src/server/workers/selection-export.worker.ts`
- `src/server/workers/bootstrap.ts` (modify)

**Test beklentisi:**
- `tests/integration/selection/export-worker.test.ts`:
  - Job success → ZIP üretilir, signed URL döner, lastExportedAt güncellenir
  - Empty set (0 item) → reject veya boş ZIP (kararı plan'da: **boş set'te reject**, tutarsızlık yaratmamak için)
  - Failure → lastExportedAt değişmez, FAILED state
  - Cross-user payload → fail

**Risk seviyesi:** **Orta-yüksek** — streaming asset download + worker memory.

**Bağımlılık:** Task 11, Task 13, Task 16 (review mapper'ı manifest'e besler).

**Steps:**
- [ ] **Step 1:** Failing worker integration tests.
- [ ] **Step 2:** Worker handler implement (streaming download).
- [ ] **Step 3:** bootstrap register.
- [ ] **Step 4:** Tests PASS.
- [ ] **Step 5:** Commit: `feat(phase7): EXPORT_SELECTION_SET worker`.

---

### Task 13: Signed URL + cleanup cron

**Neden var:** ZIP'in 24 saat erişimi + 7 gün sonra cleanup.

**Kapsam:**
- `signedUrl({ key, ttl: 24 * 3600 })` — MinIO/S3 presigned URL helper.
- `cleanupExpiredExports()` — cron: 7 gün önce yüklenen ZIP'leri storage'tan sil + DB'de export job kayıtlarını arşivle (yalnız storage cleanup; job DB'sinden silmek scope dışı).
- Cron tetikleme: günlük (Phase 6 cron pattern'i varsa reuse, yoksa basit setInterval/node-cron).

**Ana dosyalar:**
- `src/server/services/selection/export/signed-url.ts`
- `src/server/services/selection/export/cleanup.cron.ts`

**Test beklentisi:**
- `tests/unit/selection/export/signed-url.test.ts`: TTL 24h, key path correct
- `tests/integration/selection/export/cleanup.test.ts`: 7 gün önce upload edilen mock'lu ZIP silinir; 6 gün öncesi silinmez

**Risk seviyesi:** **Düşük-orta**.

**Bağımlılık:** Task 12 (storage path sözleşmesi).

**Steps:**
- [ ] **Step 1:** Failing tests.
- [ ] **Step 2:** signedUrl helper.
- [ ] **Step 3:** Cleanup cron implement.
- [ ] **Step 4:** Tests PASS.
- [ ] **Step 5:** Commit: `feat(phase7): export signed URL + cleanup cron (7d)`.

---

### Task 14: Active export retrieval (Set GET payload genişletme)

**Neden var:** Section 6.6 sözleşmesi: Set GET `activeExport` objesi. Frontend job feedback bunun üstüne biner.

**Kapsam:**
- `getActiveExport({ userId, setId })` — kullanıcının bu set için en son `EXPORT_SELECTION_SET` job'unu BullMQ'dan veya DB'den çek.
- Output: `{ jobId, status, downloadUrl?, expiresAt?, failedReason? } | null`.
- `status` mapping: BullMQ states → `'queued' | 'running' | 'completed' | 'failed'`.
- `downloadUrl` ve `expiresAt` yalnız `completed && expiresAt > now()` durumunda dolu.

**Ana dosyalar:**
- `src/server/services/selection/active-export.ts`

**Test beklentisi:**
- `tests/unit/selection/active-export.test.ts`:
  - Job yok → null
  - Queued/running → status doğru, downloadUrl yok
  - Completed + URL geçerli → downloadUrl + expiresAt
  - Completed + URL süresi dolmuş → null (yeniden export gerekir)
  - Failed → failedReason

**Risk seviyesi:** **Orta** — BullMQ state mapping; "süresi dolmuş URL" davranışı subtle.

**Bağımlılık:** Task 12, Task 13.

**Steps:**
- [ ] **Step 1:** Failing tests.
- [ ] **Step 2:** getActiveExport implement.
- [ ] **Step 3:** Tests PASS.
- [ ] **Step 4:** Commit: `feat(phase7): active export retrieval`.

---

### Task 15: Quick start service

**Neden var:** Reference batch'ten otomatik set + items oluşturma; manifest sourceMetadata.

**Kapsam:**
- `quickStartFromBatch({ userId, referenceId, batchId, productTypeId })`:
  1. Reference + batch ownership check
  2. Batch'in tüm GeneratedDesign'larını fetch (yalnız bu user'a ait)
  3. Auto-name: `{Reference name veya productType key} — {DD MMM YYYY}` (Türkçe ay)
  4. SelectionSet create: `{ name, status: draft, sourceMetadata: { kind: "variation-batch", referenceId, batchId, productTypeId, batchCreatedAt, originalCount } }`
  5. SelectionItem'ları batch'in design'larından oluştur: `{ generatedDesignId, sourceAssetId: design.assetId, status: pending, position }`
  6. Atomik (tek transaction).
  7. Return: `{ setId }`.

**Ana dosyalar:**
- `src/server/services/selection/sets.service.ts` (modify — `quickStartFromBatch` ekle)
- (Task 3 zaten quickStartSet stub'ını ekliyordu; bu task'te tam implement)

**Test beklentisi:**
- `tests/unit/selection/quick-start.test.ts`:
  - Auto-name pattern doğru
  - Batch boş → reject (uyarısız set kötü UX)
  - Cross-user batch erişimi → NotFoundError
  - sourceMetadata fields doğru
  - Atomic: hata durumunda set ve items birlikte rollback

**Risk seviyesi:** **Orta**.

**Bağımlılık:** Task 3.

**Steps:**
- [ ] **Step 1:** Failing tests.
- [ ] **Step 2:** quickStartFromBatch implement (transaction).
- [ ] **Step 3:** Tests PASS.
- [ ] **Step 4:** Commit: `feat(phase7): quick start (variation batch → SelectionSet)`.

---

### Task 16: Phase 6 review mapper layer

**Neden var:** Selection Studio Phase 6 review schema'sından izole — view-model dönüşümü tek noktada.

**Kapsam:**
- `mapReviewToView(review: DesignReview | null): ReviewView | null`:
  - Phase 6 entity → Selection Studio view: `{ score, status, signals: { resolution, textDetection, artifactCheck, trademarkRisk } }`.
  - Mapper Phase 6 alanlarını okur (`review.score`, `review.status`, `review.signalsJson`); Phase 7 view alanlarını üretir.
  - Phase 6 schema değişirse yalnız bu fonksiyon güncellenir.
  - Read-only — Phase 6 entity'sine yazmaz.
- Set GET include path'inde kullanılır (`getSet` Task 3'ün döndürdüğü items'a `review` field eklenir).

**Ana dosyalar:**
- `src/server/services/selection/review-mapper.ts`

**Test beklentisi:**
- `tests/unit/selection/review-mapper.test.ts`:
  - Review yok → null
  - Review var → view shape doğru
  - Bilinmeyen status enum → fallback (örn. "needs_review")
  - signals JSON parse hata durumunda graceful default

**Risk seviyesi:** **Orta** — Phase 6 sözleşme bağlılığı; izolasyon değer önermesi yüksek.

**Bağımlılık:** Task 3 (mapper'ı Set GET'e bağla).

**Steps:**
- [ ] **Step 1:** Failing mapper tests.
- [ ] **Step 2:** mapReviewToView implement.
- [ ] **Step 3:** Set GET include path'inde mapper devreye al.
- [ ] **Step 4:** Tests PASS.
- [ ] **Step 5:** Commit: `feat(phase7): Phase 6 review mapper layer`.

---

### Task 17: Authorization helpers (owner filter + 404 mapping)

**Neden var:** Tüm endpoint'lerde tutarlı 404 disiplini; tek noktadan helper'lar.

**Kapsam:**
- `requireSetOwnership({ userId, setId })` — set sahibi değilse throw `NotFoundError`.
- `requireItemOwnership({ userId, setId, itemId })` — set sahibi + item set'e ait değilse 404.
- API route handler'larında `try { ... } catch (e) { if (e instanceof NotFoundError) return 404; if (e instanceof SetReadOnlyError) return 409; ... }`.
- Cross-user fixtures: `tests/fixtures/selection/seed/two-users.json` — User A set'i, User B erişimi 404.

**Ana dosyalar:**
- `src/server/services/selection/authz.ts`
- `tests/fixtures/selection/seed/two-users.json`

**Test beklentisi:**
- `tests/integration/selection/authz.test.ts`:
  - User A set'i → User A 200
  - User A set'i → User B 404 (403 değil!)
  - User A item'ı → User B 404
  - Bulk endpoint'lerde User B'nin item'ı User A'nın bulk request'inde silinmez (ownership filter)

**Risk seviyesi:** **Yüksek** — güvenlik kritik. CLAUDE.md "user data isolation" zorunlu test.

**Bağımlılık:** Task 3, Task 5.

**Steps:**
- [ ] **Step 1:** Failing authz integration tests (4 test başlığı + 1 cross-user fixture).
- [ ] **Step 2:** Helper'ları implement.
- [ ] **Step 3:** Tests PASS.
- [ ] **Step 4:** Commit: `feat(phase7): authorization helpers (404 discipline)`.

---

### Task 18: API routes — sets list/create

**Neden var:** Section 7.2 endpoint listesinin ilk bölümü.

**Kapsam:**
- `GET /api/selection/sets?status=draft|ready` — listSets çağrısı.
- `POST /api/selection/sets` — body `{ name }` zod validate; createSet çağrısı.
- Both: authentication required (Phase 6 paterni reuse), ownership filter zorunlu.

**Ana dosyalar:**
- `src/app/api/selection/sets/route.ts`

**Test beklentisi:**
- `tests/integration/selection/api/sets.test.ts`:
  - GET 200 (kullanıcının set'leri) + status filter
  - POST 201 (sade name) + DB'de oluşur
  - POST 400 boş name veya whitespace
  - Unauthenticated → 401

**Risk seviyesi:** **Düşük**.

**Bağımlılık:** Task 3, Task 17, Task 18 dependency: zod schemas (Task 2).

**Steps:**
- [ ] **Step 1:** Failing route tests.
- [ ] **Step 2:** Route handlers implement.
- [ ] **Step 3:** Tests PASS.
- [ ] **Step 4:** Commit: `feat(phase7): /api/selection/sets list+create`.

---

### Task 19: API route — quick-start

**Neden var:** Reference batch → set canonical endpoint.

**Kapsam:**
- `POST /api/selection/sets/quick-start` — body `{ source: "variation-batch", referenceId, batchId, productTypeId }`.
- quickStartFromBatch çağrısı; response `{ setId }`; frontend bu setId ile redirect.

**Ana dosyalar:**
- `src/app/api/selection/sets/quick-start/route.ts`

**Test beklentisi:**
- `tests/integration/selection/api/quick-start.test.ts`:
  - 200 yeni set + items
  - Cross-user batch → 404
  - Empty batch → 400
  - source unsupported → 400

**Risk seviyesi:** **Düşük**.

**Bağımlılık:** Task 15, Task 17.

**Steps:**
- [ ] **Step 1:** Failing tests.
- [ ] **Step 2:** Route implement.
- [ ] **Step 3:** Tests PASS.
- [ ] **Step 4:** Commit: `feat(phase7): /api/selection/sets/quick-start`.

---

### Task 20: API routes — set CRUD + item CRUD

**Neden var:** Section 7.2'nin item-level endpoint'leri.

**Kapsam:**
- `GET /api/selection/sets/[setId]` — set + items + activeExport (Task 14 reuse) + review mapper (Task 16).
- `POST /api/selection/sets/[setId]/items` — drawer ekleme; body `{ items: { generatedDesignId }[] }`.
- `PATCH /api/selection/sets/[setId]/items/[itemId]` — single status update.

**Ana dosyalar:**
- `src/app/api/selection/sets/[setId]/route.ts`
- `src/app/api/selection/sets/[setId]/items/route.ts`
- `src/app/api/selection/sets/[setId]/items/[itemId]/route.ts`

**Test beklentisi:**
- `tests/integration/selection/api/set-items.test.ts`:
  - GET 200 includes items + activeExport + review (varsa)
  - POST items: duplicate koruma (zaten set'te varsa skip)
  - PATCH status geçişi (Section 4.4 matrisi)
  - PATCH ready set'te → 409
  - Cross-user → 404

**Risk seviyesi:** **Orta** — payload yapısı + state guards.

**Bağımlılık:** Task 3, Task 5, Task 14, Task 16, Task 17.

**Steps:**
- [ ] **Step 1:** Failing tests.
- [ ] **Step 2:** Route handlers implement.
- [ ] **Step 3:** Tests PASS.
- [ ] **Step 4:** Commit: `feat(phase7): set GET + items POST/PATCH routes`.

---

### Task 21: API routes — bulk + reorder

**Neden var:** Section 7.2 bulk + reorder endpoint'leri; TypingConfirmation pattern.

**Kapsam:**
- `PATCH /api/selection/sets/[setId]/items/bulk` — body `{ itemIds, status }`.
- `POST /api/selection/sets/[setId]/items/bulk-delete` — body `{ itemIds, confirmation: "SİL" }` zorunlu.
- `POST /api/selection/sets/[setId]/items/reorder` — body `{ itemIds: string[] }` (full set order).
- TypingConfirmation enforcement: confirmation string `"SİL"` değilse 400.

**Ana dosyalar:**
- `src/app/api/selection/sets/[setId]/items/bulk/route.ts`
- `src/app/api/selection/sets/[setId]/items/bulk-delete/route.ts`
- `src/app/api/selection/sets/[setId]/items/reorder/route.ts`

**Test beklentisi:**
- `tests/integration/selection/api/bulk.test.ts`:
  - bulk PATCH atomic + cross-user item filter
  - bulk-delete with sentinel "SİL" → 200
  - bulk-delete without sentinel → 400
  - bulk-delete cross-user item içerirse o item silinmez (filter)
  - reorder full set order → 200; mismatch → 400

**Risk seviyesi:** **Orta-yüksek** — TypingConfirmation güvenlik enforcement.

**Bağımlılık:** Task 5, Task 17.

**Steps:**
- [ ] **Step 1:** Failing tests.
- [ ] **Step 2:** Route handlers + TypingConfirmation enforcement.
- [ ] **Step 3:** Tests PASS.
- [ ] **Step 4:** Commit: `feat(phase7): bulk + reorder routes (with TypingConfirmation)`.

---

### Task 22: API routes — edit + finalize + archive + export

**Neden var:** Section 7.2'nin geri kalan endpoint'leri.

**Kapsam:**
- `POST /api/selection/sets/[setId]/items/[itemId]/edit` — instant edit (crop, transparent-check); body `{ op, params? }`; sync response yeni item shape.
- `POST /api/selection/sets/[setId]/items/[itemId]/edit/heavy` — heavy edit; body `{ op: "background-remove" }`; response `{ jobId }`.
- `POST /api/selection/sets/[setId]/items/[itemId]/undo` — applyUndo.
- `POST /api/selection/sets/[setId]/items/[itemId]/reset` — resetItem.
- `POST /api/selection/sets/[setId]/finalize` — finalizeSet (selected ≥ 1 gate).
- `POST /api/selection/sets/[setId]/archive` — archiveSet.
- `POST /api/selection/sets/[setId]/export` — EXPORT_SELECTION_SET enqueue; response `{ jobId }`.

**Ana dosyalar:**
- `src/app/api/selection/sets/[setId]/items/[itemId]/edit/route.ts`
- `src/app/api/selection/sets/[setId]/items/[itemId]/edit/heavy/route.ts`
- `src/app/api/selection/sets/[setId]/items/[itemId]/undo/route.ts`
- `src/app/api/selection/sets/[setId]/items/[itemId]/reset/route.ts`
- `src/app/api/selection/sets/[setId]/finalize/route.ts`
- `src/app/api/selection/sets/[setId]/archive/route.ts`
- `src/app/api/selection/sets/[setId]/export/route.ts`

**Test beklentisi:**
- `tests/integration/selection/api/edit-finalize-export.test.ts`:
  - Instant edit success + new item shape
  - Heavy edit enqueue + paralel heavy reject (409)
  - Finalize gate: 0 selected → 409
  - Finalize gate: 1+ selected → 200, status `ready`
  - Archive: draft → archived, ready → archived OK
  - Export enqueue + activeExport set GET'inde görünür
  - Cross-user → 404

**Risk seviyesi:** **Orta-yüksek** — finalize gate + paralel heavy yasağı + state machine.

**Bağımlılık:** Task 4, Task 6, Task 10, Task 12, Task 17.

**Steps:**
- [ ] **Step 1:** Failing tests (7 test başlığı).
- [ ] **Step 2:** Route handlers (mapping service errors → HTTP).
- [ ] **Step 3:** Tests PASS.
- [ ] **Step 4:** Commit: `feat(phase7): edit/finalize/archive/export routes`.

---

### Task 23: `/selection` page (index)

**Neden var:** Section 3.1 — aktif draft + son ready listesi minimal index.

**Kapsam:**
- Page shell + AppSidebar menü maddesi ekleme.
- Üstte: aktif draft set kartı (varsa "Aç" → /selection/sets/[id]; yoksa empty state + "Yeni set oluştur" CTA modal trigger).
- Altta: "Son finalize edilen set'ler" max 5, link list.
- TanStack Query: `listSets({ status: 'draft' })` + `listSets({ status: 'ready', limit: 5 })`.
- Zustand store stub: `selection-store.ts` — Phase 6 paterni (selection state için kullanılacak Task 26'da).
- Tokens: tüm renkler/spacing token'lardan; hardcoded yasak (`check:tokens` script'i geçecek).

**Ana dosyalar:**
- `src/app/(app)/selection/page.tsx`
- `src/app/(app)/_components/AppSidebar.tsx` (modify)
- `src/features/selection/stores/selection-store.ts` (stub)

**Test beklentisi:**
- `tests/unit/selection/index-page.test.tsx`:
  - Aktif draft varsa kart render
  - Aktif draft yoksa empty state + "Yeni set oluştur" buton
  - Son ready listesi render (mock data)
  - Sidebar Selection menü maddesi var

**Risk seviyesi:** **Düşük**.

**Bağımlılık:** Task 18, Task 23 dependency: TanStack Query setup mevcut.

**Steps:**
- [ ] **Step 1:** Failing page tests.
- [ ] **Step 2:** Page + sidebar + store stub.
- [ ] **Step 3:** Tests PASS.
- [ ] **Step 4:** Token audit (`npm run check:tokens` veya muadili).
- [ ] **Step 5:** Commit: `feat(phase7): /selection index page (minimal)`.

---

### Task 24: CreateSetModal (manuel name input)

**Neden var:** Section 3.1 zorunlu name input modal.

**Kapsam:**
- Modal: header "Yeni set oluştur" + name input (zorunlu, trim, min 1 char) + "İptal" / "Oluştur" actions.
- Validation: empty/whitespace name → submit disabled + inline hata.
- Mutation: `POST /api/selection/sets` → success redirect `/selection/sets/[id]`.

**Ana dosyalar:**
- `src/app/(app)/selection/_components/CreateSetModal.tsx`

**Test beklentisi:**
- `tests/unit/selection/create-set-modal.test.tsx`:
  - Empty name → disabled
  - Whitespace name → disabled
  - Valid name → submit + redirect (mock router)
  - Server 400 → inline hata gösterimi

**Risk seviyesi:** **Düşük**.

**Bağımlılık:** Task 18, Task 23.

**Steps:**
- [ ] **Step 1:** Failing modal tests.
- [ ] **Step 2:** Modal implement.
- [ ] **Step 3:** Tests PASS.
- [ ] **Step 4:** Commit: `feat(phase7): CreateSetModal (zorunlu name input)`.

---

### Task 25: Studio shell (`/selection/sets/[setId]` page + üst bar)

**Neden var:** Section 3.2 üç bölgeli layout iskeleti.

**Kapsam:**
- Page: `getSet({ setId })` data fetch (server component), Studio shell render.
- Üst bar: Set adı, item count, status badge, "İndir (ZIP)" + "Set'i finalize et" + kebap menü ("Set'i arşivle" Task 37'de).
- Layout: 3 bölge (sol canvas + filmstrip + sağ panel) — placeholder'lar Task 26-27'de doldurulur.
- Ready set banner: "Bu set finalize edildi — Phase 8 Mockup Studio'da işlenecek."
- Read-only mode UI (ready set'te tüm action'lar disabled).
- Selection Zustand store: aktif item id, multi-select set, filmstrip filter state.

**Ana dosyalar:**
- `src/app/(app)/selection/sets/[setId]/page.tsx`
- `src/app/(app)/selection/sets/[setId]/_components/StudioShell.tsx`
- `src/features/selection/stores/selection-store.ts` (modify)

**Test beklentisi:**
- `tests/unit/selection/studio-shell.test.tsx`:
  - Draft set → action'lar enabled
  - Ready set → action'lar disabled + banner
  - Set yoksa → 404 page (Next.js notFound)

**Risk seviyesi:** **Orta**.

**Bağımlılık:** Task 20, Task 23.

**Steps:**
- [ ] **Step 1:** Failing tests.
- [ ] **Step 2:** Page + Shell.
- [ ] **Step 3:** Zustand store genişletme.
- [ ] **Step 4:** Tests PASS.
- [ ] **Step 5:** Token audit.
- [ ] **Step 6:** Commit: `feat(phase7): Studio shell (sets/[setId] page)`.

---

### Task 26: Filmstrip + sol canvas + filter dropdown

**Neden var:** Section 3.2 sol canvas alanı.

**Kapsam:**
- Sol canvas: aktif preview kartı (variant numarası "X / N", boyut, thumb preview, prev/next nav).
- Filmstrip altta: grid (item count'a göre adaptif), her item card: thumbnail + status badge.
- Selected item: checkmark; aktif: border accent; rejected: opacity reduced + "Reddedildi" badge.
- Filter dropdown: `Tümü / Aktif / Reddedilenler` (Aktif = pending + selected).
- Multi-select: shift-click ile range; toggle ile bireysel; keyboard support (space ile toggle).
- "+ Varyant ekle" buton sonunda (Task 32 drawer'ı tetikler).

**Ana dosyalar:**
- `src/app/(app)/selection/sets/[setId]/_components/Filmstrip.tsx`

**Test beklentisi:**
- `tests/unit/selection/filmstrip.test.tsx`:
  - Tümü filter: tüm item'lar render
  - Reddedilenler filter: yalnız rejected
  - Multi-select shift-click range
  - Aktif item border accent
  - "+ Varyant ekle" buton drawer açar (mock)

**Risk seviyesi:** **Orta** — multi-select state management.

**Bağımlılık:** Task 25.

**Steps:**
- [ ] **Step 1:** Failing tests.
- [ ] **Step 2:** Filmstrip implement.
- [ ] **Step 3:** Tests PASS.
- [ ] **Step 4:** Token audit.
- [ ] **Step 5:** Commit: `feat(phase7): Filmstrip + filter dropdown + multi-select`.

---

### Task 27: Sağ panel — AI Kalite (read-only)

**Neden var:** Section 3.2 sağ panel + Phase 6 köprüsü read-only.

**Kapsam:**
- Header: "Edit" + "Varyant N düzenleniyor".
- AI Kalite bölümü:
  - Review varsa: score (büyük, accent color), status badge, 4 sinyal (Resolution / Text detection / Artifact check / Trademark risk).
  - Review yoksa: muted "Bu varyant için AI kalite analizi yapılmamış" + disabled "Review'a gönder" link (tooltip "Phase 6 canlı smoke sonrası aktif").
- Bottom: "Reddet" / "Seçime ekle" buttons (status mutation Task 20 endpoint).

**Ana dosyalar:**
- `src/app/(app)/selection/sets/[setId]/_components/RightPanel.tsx`
- `src/app/(app)/selection/sets/[setId]/_components/AiQualityPanel.tsx`

**Test beklentisi:**
- `tests/unit/selection/ai-quality-panel.test.tsx`:
  - Review var → score + 4 sinyal render
  - Review yok → muted state + disabled "Review'a gönder" link
  - Status badge color mapping (approved → success, rejected → danger, etc.)
  - Bottom action'lar status mutation tetikler

**Risk seviyesi:** **Düşük-orta** (mapper layer ile etkileşim).

**Bağımlılık:** Task 16, Task 25.

**Steps:**
- [ ] **Step 1:** Failing tests.
- [ ] **Step 2:** RightPanel + AiQualityPanel.
- [ ] **Step 3:** Tests PASS.
- [ ] **Step 4:** Token audit.
- [ ] **Step 5:** Commit: `feat(phase7): RightPanel + AI Kalite (read-only Phase 6 bridge)`.

---

### Task 28: QuickActions — instant edits (crop, transparent-check)

**Neden var:** Section 3.2 hızlı işlemler instant tier.

**Kapsam:**
- Crop button: ratio dropdown (2:3 / 4:5 / 1:1 / 3:4, default product type'a göre). Tıklayınca instant API call → optimistic update → preview refresh.
- Transparent PNG kontrolü button: tıklayınca instant API call → result modal/inline (signals listesi).
- Upscale 2× button: **disabled** ("Yakında" hint + tooltip).
- Failure: toast + mevcut görüntü korunur.

**Ana dosyalar:**
- `src/app/(app)/selection/sets/[setId]/_components/QuickActions.tsx`

**Test beklentisi:**
- `tests/unit/selection/quick-actions.test.tsx`:
  - Crop ratio seçimi + click → API call (mock)
  - Transparent check → result render
  - Upscale disabled (interaction yok)
  - Crop failure → toast

**Risk seviyesi:** **Orta**.

**Bağımlılık:** Task 22 (edit endpoint), Task 27.

**Steps:**
- [ ] **Step 1:** Failing tests.
- [ ] **Step 2:** QuickActions implement.
- [ ] **Step 3:** Tests PASS.
- [ ] **Step 4:** Commit: `feat(phase7): QuickActions (crop + transparent-check + upscale-disabled)`.

---

### Task 29: HeavyActionButton — background remove

**Neden var:** Heavy edit UI + paralel yasağı + progress feedback.

**Kapsam:**
- "Background remove" button: tıklayınca `POST /edit/heavy` → jobId döner.
- Button state: idle → spinner + "İşleniyor (~5s)" hint.
- Aynı item'da paralel heavy: button disabled.
- Completion: TanStack Query invalidate (set GET refresh) → preview refresh.
- Failure: toast + retry button.

**Ana dosyalar:**
- `src/app/(app)/selection/sets/[setId]/_components/HeavyActionButton.tsx`

**Test beklentisi:**
- `tests/unit/selection/heavy-action-button.test.tsx`:
  - Click → spinner + API call
  - Completion (notification trigger mock) → button reset
  - Failure → toast + retry
  - Aktif heavy job varken disabled

**Risk seviyesi:** **Orta-yüksek** — async UI state management.

**Bağımlılık:** Task 22, Task 39 (notification listener).

**Steps:**
- [ ] **Step 1:** Failing tests.
- [ ] **Step 2:** HeavyActionButton implement.
- [ ] **Step 3:** Tests PASS.
- [ ] **Step 4:** Commit: `feat(phase7): HeavyActionButton (background remove + paralel yasak)`.

---

### Task 30: UndoResetBar

**Neden var:** Section 3.2 — "Son işlemi geri al" + "Orijinale döndür" + edit history liste.

**Kapsam:**
- "Son işlemi geri al" button: `lastUndoableAssetId` varsa enabled.
- "Orijinale döndür" button: `editedAssetId` varsa enabled.
- Edit history liste: max 5 op (op adı + relative timestamp, "3 dk önce"); 5'ten fazlası "..." şeklinde toplanır.
- Tıklanmaz, replay yok.

**Ana dosyalar:**
- `src/app/(app)/selection/sets/[setId]/_components/UndoResetBar.tsx`

**Test beklentisi:**
- `tests/unit/selection/undo-reset-bar.test.tsx`:
  - lastUndoable yok → undo disabled
  - editedAsset yok → reset disabled
  - History 0 → liste boş
  - History 7 → max 5 + "..."

**Risk seviyesi:** **Düşük**.

**Bağımlılık:** Task 22, Task 27.

**Steps:**
- [ ] **Step 1:** Failing tests.
- [ ] **Step 2:** UndoResetBar implement.
- [ ] **Step 3:** Tests PASS.
- [ ] **Step 4:** Commit: `feat(phase7): UndoResetBar + edit history liste`.

---

### Task 31: ReorderMenu (button/menu tabanlı, accessible)

**Neden var:** **VERILMIŞ KARAR** — Phase 7 v1 reorder = menu/button tabanlı (DnD yok). A11y default.

**Kapsam:**
- Item kebap/menü açılır:
  - "Sola taşı" (position - 1)
  - "Sağa taşı" (position + 1)
  - "Başa al" (position 0)
  - "Sona al" (position N-1)
- Disabled states: ilk item için "Sola taşı/Başa al" disabled; son item için "Sağa taşı/Sona al" disabled.
- Mutation: full reorder array PATCH `/items/reorder` (Task 21 endpoint).
- A11y:
  - Menü trigger button `aria-label="Reorder options"`.
  - Menü item'lar keyboard navigable (tab + enter).
  - Hareket sonrası focus aktif item'da kalır + screen reader announce ("Varyant X başa alındı").
- Görsel affordance opsiyonel: non-functional drag handle ikonu (mockup'ta yok ama kafa karıştırmasın diye eklemeyelim — sadece kebap menü).

**Ana dosyalar:**
- `src/app/(app)/selection/sets/[setId]/_components/ReorderMenu.tsx`

**Test beklentisi:**
- `tests/unit/selection/reorder-menu.test.tsx`:
  - 4 menü item açılır
  - İlk item: "Sola taşı/Başa al" disabled
  - Son item: "Sağa taşı/Sona al" disabled
  - Click → API call (mock) + reorder optimistic update
  - Keyboard navigation (tab + enter)
  - Screen reader announce (live region)
- Manuel QA: gerçek screen reader (VoiceOver/NVDA) ile test (Section 10.4'te listelendi).

**Risk seviyesi:** **Orta** — a11y disiplin ciddiyetle korunmalı (ürün kalite çizgisi).

**Bağımlılık:** Task 21, Task 26.

**Steps:**
- [ ] **Step 1:** Failing tests.
- [ ] **Step 2:** ReorderMenu implement.
- [ ] **Step 3:** Tests PASS.
- [ ] **Step 4:** Manuel a11y QA (VoiceOver smoke).
- [ ] **Step 5:** Commit: `feat(phase7): ReorderMenu (button/menu accessible reorder)`.

---

### Task 32: AddVariantsDrawer (Reference Batches tab + Review Queue disabled)

**Neden var:** Section 2.2 drawer ile item ekleme.

**Kapsam:**
- Drawer trigger: filmstrip "+ Varyant ekle" buton.
- İki tab:
  - **Reference Batches (aktif)**: User'ın geçmiş variation batch'lerini liste; her batch için kapak grid + meta. Set'te zaten olan item'lar disabled. "Tüm batch'i ekle" + per-item multi-select.
  - **Review Queue (disabled)**: Muted state + "Phase 6 canlı smoke sonrası aktif edilecek" tooltip.
- Footer: "İptal" / "Eklenecek N variant" + "Ekle" primary.
- Mutation: `POST /api/selection/sets/[setId]/items` (Task 20).
- Yeni endpoint ihtiyacı: `GET /api/variations/batches?userId` (kullanıcının batch'leri) — Phase 5'te varsa reuse, yoksa minimal create (plan'da netleşir, **Task 32 alt-task**).

**Ana dosyalar:**
- `src/app/(app)/selection/sets/[setId]/_components/AddVariantsDrawer.tsx`
- (Yeni endpoint gerekirse) `src/app/api/variations/batches/route.ts`

**Test beklentisi:**
- `tests/unit/selection/add-variants-drawer.test.tsx`:
  - Reference Batches tab default
  - Review Queue tab disabled (interaction yok)
  - Duplicate item disabled
  - Multi-select count footer'da görünür
  - "Ekle" → API call

**Risk seviyesi:** **Orta** — yeni batch listesi endpoint'i; Phase 5 surface reuse incelemesi gerekiyor.

**Bağımlılık:** Task 20, Task 26.

**Steps:**
- [ ] **Step 1:** Phase 5 batch endpoint'i incele (mevcut mu?).
- [ ] **Step 2:** Yoksa minimal endpoint ekle (`/api/variations/batches`).
- [ ] **Step 3:** Failing drawer tests.
- [ ] **Step 4:** Drawer implement.
- [ ] **Step 5:** Tests PASS.
- [ ] **Step 6:** Commit: `feat(phase7): AddVariantsDrawer (Reference Batches + Review Queue disabled)`.

---

### Task 33: BulkActionsBar (Phase 6 primitive reuse)

**Neden var:** Multi-select sticky bottom bar; selected/reject/hard delete actions.

**Kapsam:**
- Phase 6 `BulkActionsBar` primitive reuse (mümkünse import; yoksa Phase 6 paterni replicate).
- Actions:
  - "Seçime ekle (N)"
  - "Reddet (N)"
  - Filmstrip filter "Reddedilenler" iken: "Kalıcı çıkar (N)" → TypingConfirmation modal (Task 34).
- Mutation: bulk PATCH `/items/bulk` veya bulk POST `/items/bulk-delete` (Task 21).
- Multi-select clear: bulk action sonrası veya ESC.

**Ana dosyalar:**
- `src/app/(app)/selection/sets/[setId]/_components/BulkActionsBar.tsx`
- (Phase 6 primitive `src/components/ui/BulkActionsBar.tsx` mevcutsa reuse)

**Test beklentisi:**
- `tests/unit/selection/bulk-actions-bar.test.tsx`:
  - 0 selected → bar gizli
  - N selected → bar visible + actions render
  - Filter "Reddedilenler" → "Kalıcı çıkar" görünür
  - Diğer filter → "Kalıcı çıkar" gizli
  - ESC ile multi-select clear

**Risk seviyesi:** **Düşük-orta**.

**Bağımlılık:** Task 21, Task 26.

**Steps:**
- [ ] **Step 1:** Phase 6 primitive durumunu incele.
- [ ] **Step 2:** Failing tests.
- [ ] **Step 3:** Bar implement (reuse veya yeni).
- [ ] **Step 4:** Tests PASS.
- [ ] **Step 5:** Commit: `feat(phase7): BulkActionsBar (selected/reject/hard-delete)`.

---

### Task 34: TypingConfirmation modal (hard delete)

**Neden var:** Bulk hard delete için "SİL" yazma onayı.

**Kapsam:**
- Phase 6'daki `TypingConfirmation` primitive reuse (varsa). Yoksa primitive'i ortak bir yere ekle (`src/components/ui/TypingConfirmation.tsx`).
- Modal: "X varyant kalıcı silinecek. Onaylamak için 'SİL' yazın."
- Input: case-sensitive "SİL" exact match → "Sil" buton enabled.
- Onay → POST `/items/bulk-delete` body `{ itemIds, confirmation: "SİL" }`.

**Ana dosyalar:**
- `src/components/ui/TypingConfirmation.tsx` (Phase 6 primitive — reuse veya enhance)
- `src/app/(app)/selection/sets/[setId]/_components/BulkActionsBar.tsx` (Task 33 entegrasyonu)

**Test beklentisi:**
- `tests/unit/components/typing-confirmation.test.tsx` (varsa Phase 6'dan):
  - Wrong input → button disabled
  - Exact "SİL" → button enabled
  - Backspace ile yanlış → button disabled
  - Enter on disabled → no-op
- `tests/integration/selection/bulk-delete.test.tsx`:
  - Confirmation flow end-to-end

**Risk seviyesi:** **Düşük** — primitive zaten Phase 6'da varsa.

**Bağımlılık:** Task 33.

**Steps:**
- [ ] **Step 1:** Phase 6 primitive durumunu incele.
- [ ] **Step 2:** Failing tests.
- [ ] **Step 3:** TypingConfirmation reuse veya enhance.
- [ ] **Step 4:** Bar entegrasyonu.
- [ ] **Step 5:** Tests PASS.
- [ ] **Step 6:** Commit: `feat(phase7): TypingConfirmation entegrasyonu (bulk hard delete)`.

---

### Task 35: FinalizeModal (selected ≥ 1 gate)

**Neden var:** Section 2.5 finalize confirmation + gate UI.

**Kapsam:**
- "Set'i finalize et" buton: selected count = 0 → disabled + tooltip "En az 1 'Seçime ekle' yapılmış varyant gerekli".
- Confirmation modal: "X selected, Y pending, Z rejected — yalnız selected'lar Phase 8 input'u olur. Pending'ler manifest içinde yer alır ama Mockup Studio'ya geçmez."
- Onay → `POST /finalize` → success: page refresh, ready banner görünür.
- 409 (gate fail) → toast.

**Ana dosyalar:**
- `src/app/(app)/selection/sets/[setId]/_components/FinalizeModal.tsx`

**Test beklentisi:**
- `tests/unit/selection/finalize-modal.test.tsx`:
  - 0 selected → buton disabled + tooltip
  - 1+ selected → modal açılır + breakdown text
  - Confirm → API call + redirect/refresh
  - 409 → toast

**Risk seviyesi:** **Orta** — gate UI tutarlılığı.

**Bağımlılık:** Task 22, Task 25.

**Steps:**
- [ ] **Step 1:** Failing tests.
- [ ] **Step 2:** Modal implement.
- [ ] **Step 3:** Tests PASS.
- [ ] **Step 4:** Commit: `feat(phase7): FinalizeModal (selected gate + breakdown)`.

---

### Task 36: ExportButton + activeExport polling

**Neden var:** Section 6.6 sözleşmesi — Set GET activeExport state'ine göre UI.

**Kapsam:**
- Button states (set GET'in activeExport alanından okur):
  - `null` → "İndir (ZIP)" idle (set boşsa disabled).
  - `queued` / `running` → "Export hazırlanıyor..." spinner + disabled.
  - `completed` && expiresAt > now → "İndir" link (downloadUrl).
  - `failed` → "Tekrar dene" + tooltip failedReason.
- Tıklayınca `POST /export` → jobId; TanStack Query invalidate veya notification listener (Task 39) ile state refresh.

**Ana dosyalar:**
- `src/app/(app)/selection/sets/[setId]/_components/ExportButton.tsx`

**Test beklentisi:**
- `tests/unit/selection/export-button.test.tsx`:
  - 4 state için doğru render
  - Click → mutation + state queued
  - Notification trigger (mock) → state completed → "İndir" link
  - Empty set → disabled

**Risk seviyesi:** **Orta**.

**Bağımlılık:** Task 22, Task 14, Task 39.

**Steps:**
- [ ] **Step 1:** Failing tests.
- [ ] **Step 2:** ExportButton implement.
- [ ] **Step 3:** Tests PASS.
- [ ] **Step 4:** Commit: `feat(phase7): ExportButton (activeExport state machine UI)`.

---

### Task 37: ArchiveAction (set kebap menü)

**Neden var:** Section 1.2'ye eklenen archive action UI.

**Kapsam:**
- Set kebap menü: "Set'i arşivle" item.
- Confirmation modal: "Bu set arşivlenecek. Geri alınamaz (Phase 7)."
- Onay → `POST /archive` → /selection redirect (archived set browsing UX yok, kullanıcı index'e döner).

**Ana dosyalar:**
- `src/app/(app)/selection/sets/[setId]/_components/ArchiveAction.tsx`

**Test beklentisi:**
- `tests/unit/selection/archive-action.test.tsx`:
  - Menu item var
  - Confirm → API call + redirect
  - Cancel → no-op

**Risk seviyesi:** **Düşük**.

**Bağımlılık:** Task 22, Task 25.

**Steps:**
- [ ] **Step 1:** Failing tests.
- [ ] **Step 2:** ArchiveAction implement.
- [ ] **Step 3:** Tests PASS.
- [ ] **Step 4:** Commit: `feat(phase7): ArchiveAction (set kebap menü)`.

---

### Task 38: Quick start primary action (`/review` AI Tasarımları)

**Neden var:** Selection Studio canonical giriş noktası — Phase 6 review UI'sının batch grup kartına ek.

**Kapsam:**
- Phase 6'daki AI Tasarımları batch grup kartının üstüne primary action: "Selection Studio'da Aç".
- Click → `POST /api/selection/sets/quick-start { source: "variation-batch", referenceId, batchId, productTypeId }` → response setId → redirect `/selection/sets/[setId]`.
- Phase 6 baseline'a minimum dokunma: tek component'e tek button ekleme; mevcut review akışı bozulmaz.

**Ana dosyalar:**
- `src/app/(app)/review/_components/<batch grup card>.tsx` (Phase 6 mevcut component, **küçük modification**)

**Test beklentisi:**
- `tests/unit/review/quick-start-action.test.tsx`:
  - Action button render
  - Click → API call (mock) + redirect
  - Phase 6 mevcut review akışı regresyon yok (review status, bulk action'lar etkilenmez)

**Risk seviyesi:** **Orta** — Phase 6 component'ine dokunmak; smoke baseline'a regresyon riski.

**Bağımlılık:** Task 19.

**Steps:**
- [ ] **Step 1:** Phase 6 component'ini oku, dokunma yüzeyini netleştir.
- [ ] **Step 2:** Failing tests.
- [ ] **Step 3:** Action button ekle (minimal).
- [ ] **Step 4:** Tests PASS.
- [ ] **Step 5:** Phase 6 review smoke test'leri yeniden koş (regresyon).
- [ ] **Step 6:** Commit: `feat(phase7): /review Quick start primary action`.

---

### Task 39: Notification entegrasyonu (heavy edit + export)

**Neden var:** Section 3.3 — heavy edit + export completion/failure notification (Phase 6 reuse).

**Kapsam:**
- Phase 6 notification altyapısını incele (mevcut event/dispatcher).
- Yeni notification tipleri:
  - `selection.edit.background-remove.completed`
  - `selection.edit.background-remove.failed`
  - `selection.export.completed`
  - `selection.export.failed`
- Worker handler'larında (Task 10, Task 12) job completion/failure'da notification dispatch.
- Frontend listener (TanStack Query invalidate veya custom hook): notification geldiğinde set GET refresh.
- Mikro state'ler için notification YOK (button spinner inline yeterli — Section 3.3).

**Ana dosyalar:**
- `src/lib/notifications/types.ts` (modify — yeni event tipleri)
- `src/server/workers/selection-edit.worker.ts` (Task 10 modify)
- `src/server/workers/selection-export.worker.ts` (Task 12 modify)
- `src/features/selection/hooks/useSelectionNotifications.ts`

**Test beklentisi:**
- `tests/integration/selection/notifications.test.ts`:
  - Edit job completed → notification dispatch
  - Export job failed → notification dispatch + failedReason
  - Frontend listener → query invalidate (mock)

**Risk seviyesi:** **Orta** — Phase 6 notification altyapısı sözleşmesi bağlılığı.

**Bağımlılık:** Task 10, Task 12.

**Steps:**
- [ ] **Step 1:** Phase 6 notification altyapısını incele.
- [ ] **Step 2:** Failing tests.
- [ ] **Step 3:** Yeni event tipleri + dispatch'ler + frontend hook.
- [ ] **Step 4:** Tests PASS.
- [ ] **Step 5:** Commit: `feat(phase7): notification entegrasyonu (heavy edit + export)`.

---

### Task 40: Manifest schema sözleşme testi

**Neden var:** Spec Section 10.3 — Phase 8 Mockup Studio handoff sözleşmesi. ZIP "dosya oluştu" testiyle geçemez.

**Kapsam:**
- `tests/contract/manifest-schema-v1.test.ts`:
  - schemaVersion "1" zorunlu
  - Required fields: exportedAt, exportedBy.userId, set.{id, name, status, createdAt}, items[]
  - Item required: filename, generatedDesignId, sourceAssetId, status, metadata.{width, height, mimeType}
  - Item optional: originalFilename, editedAssetId, editHistory, review
  - review opsiyonel: yoksa alan yok (null değil)
  - originalFilename yalnız edit yapılmış item'da
  - editHistory shape: `[{ op, params?, at }]`
  - exportedBy.userEmail YOK (PII)
- Reuse: Task 11 buildManifest output'unu valide et.

**Ana dosyalar:**
- `tests/contract/manifest-schema-v1.test.ts`
- (Opsiyonel) JSON Schema dosyası `src/contracts/manifest-v1.schema.json` + ajv validator

**Test beklentisi:**
- Test'in kendisi sözleşmenin kendisi.
- Real fixture set'ler üstünde manifest üret + valide et.

**Risk seviyesi:** **Düşük-orta** — Phase 8 handoff sigortası.

**Bağımlılık:** Task 11.

**Steps:**
- [ ] **Step 1:** JSON Schema oluştur (manifest-v1.schema.json).
- [ ] **Step 2:** ajv setup.
- [ ] **Step 3:** Contract test yaz.
- [ ] **Step 4:** buildManifest output'unu valide et.
- [ ] **Step 5:** Test PASS.
- [ ] **Step 6:** Commit: `test(phase7): manifest schema v1 contract test`.

---

### Task 41: Golden path E2E (Quick start → edit → finalize → export)

**Neden var:** Section 10.2 E2E test — golden path doğrulama.

**Kapsam:**
- E2E test (Playwright veya Phase 6 paterniyle):
  - User login
  - `/review` → mock batch'te "Selection Studio'da Aç" tıkla
  - `/selection/sets/[id]` açılır
  - Bir item'da Crop 2:3 → preview güncellenir
  - Aynı item'da Background remove (mock'lu) → completion notification → preview yeniden güncellenir
  - "Seçime ekle" → status selected
  - Drawer'dan başka bir batch'ten 2 variant ekle
  - Reorder: ilk item'ı "Sona al"
  - "Set'i finalize et" → modal → Confirm → status ready
  - "İndir (ZIP)" → activeExport queued → completion → download link aktif
  - ZIP indir + manifest validate (Task 40 contract test reuse)

**Ana dosyalar:**
- `tests/e2e/selection/golden-path.test.ts`

**Test beklentisi:**
- Tek E2E akışı end-to-end. Real DB + mock'lu external (background-removal library).

**Risk seviyesi:** **Orta** — E2E flake riski; test infrastructure setup gerekirse.

**Bağımlılık:** Tüm önceki task'ler.

**Steps:**
- [ ] **Step 1:** E2E setup incele (Phase 6'da var mı?).
- [ ] **Step 2:** Yoksa minimum setup.
- [ ] **Step 3:** Golden path test yaz.
- [ ] **Step 4:** Test PASS.
- [ ] **Step 5:** Commit: `test(phase7): golden path E2E`.

---

### Task 42: Manuel QA checklist + smoke + closeout doc

**Neden var:** Section 10.4 manuel QA + Phase 6 paterniyle closeout dokümantasyonu.

**Kapsam:**
- Manuel QA checklist dosyası: `docs/design/implementation-notes/phase7-manual-qa.md`
  - Reorder a11y (VoiceOver/NVDA keyboard)
  - Background remove görsel kalitesi (saç, low-contrast, transparent obje fixture'ları)
  - Export ZIP gerçek extract testi (manifest validate, README okunabilir)
  - Notification + inline feedback senkronizasyonu (heavy edit, export)
  - Cross-browser smoke (Chrome + Safari minimum)
- Smoke run: User account ile Quick start → edit → finalize → export full akış manuel test.
- Closeout dokümantasyonu: `docs/design/implementation-notes/phase7-closeout.md`
  - Phase 7 v1 status (🟢 / 🟡 / 🔴)
  - Bilinen sınırlar (honesty)
  - Carry-forward listesi (spec'ten)
  - Phase 6 ile ilişki (smoke baseline'a dokunulmadı)
  - Phase 8 Mockup Studio handoff sözleşmesi (manifest v1)

**Ana dosyalar:**
- `docs/design/implementation-notes/phase7-manual-qa.md`
- `docs/design/implementation-notes/phase7-closeout.md`

**Test beklentisi:**
- Manuel checklist'in her satırı işaretlendi mi.

**Risk seviyesi:** **Düşük**.

**Bağımlılık:** Task 41 (E2E geçiyorsa manuel QA hızlanır).

**Steps:**
- [ ] **Step 1:** QA checklist doc yaz.
- [ ] **Step 2:** Manuel smoke koş + işaretle.
- [ ] **Step 3:** Closeout doc yaz.
- [ ] **Step 4:** Commit: `docs(phase7): manuel QA + closeout`.

---

## Risk Profili (Özet)

Plan boyunca yüksek risk profilli noktalar:

| # | Risk | Task'ler | Mitigation |
|---|------|----------|------------|
| 1 | **Authorization / 404 disiplini** | Task 17, 18-22 (tüm route'lar) | Owner-filter helper tek yerde + cross-user fixture + integration test her endpoint'te |
| 2 | **SelectionSet state machine** | Task 4, Task 22 | Tek service guard fonksiyonu + state machine unit test (tüm geçişler kapsanır) |
| 3 | **selected ≥ 1 finalize gate** | Task 4, Task 22, Task 35 | Backend service guard + endpoint 409 + UI tooltip; gate test triple coverage (unit/integration/E2E) |
| 4 | **Background remove worker flow** | Task 9, Task 10, Task 29 | Library mock'u + memory threshold + paralel yasak (defense in depth: service + worker) + manuel QA fixture seti |
| 5 | **Export async contract** | Task 11, Task 12, Task 14, Task 36 | Set GET activeExport sözleşmesi + manifest schema contract test (Task 40) + signed URL TTL discipline |
| 6 | **Manifest schema contract tests** | Task 11, Task 40 | JSON Schema + ajv + contract test ayrı dosyada (Phase 8 handoff sigortası) |
| 7 | **Button/menu tabanlı accessible reorder** | Task 31 | Disabled states + keyboard navigation + screen reader announce + manuel QA (VoiceOver) |
| 8 | **Phase 6 smoke baseline'a dokunmama** | Task 8 (transparent-check local duplicate), Task 38 (review UI minimal modification), Task 39 (notification reuse) | Task 8 import etmiyor (eşik kopyala); Task 38 review smoke test'leri yeniden koş; Task 39 yeni event tipi ekleme, mevcut altyapıyı değiştirmeme |
| 9 | **Transparent-check local duplicate + future consolidate** | Task 8 + carry-forward `selection-studio-alpha-check-consolidate` | Eşikler Phase 6 ile aynı sayısal değer (sözleşme test'iyle korunur); consolidate Phase 6 smoke kapanınca |

---

## Test Stratejisi (Özet)

| Katman | Disiplin | Task'ler |
|--------|----------|----------|
| Service unit | Yüksek | Task 3, 4, 5, 6, 7, 8, 9, 11, 14, 15, 16, 17 |
| API integration | Yüksek | Task 18, 19, 20, 21, 22 |
| Worker | Orta-yüksek | Task 10, 12 |
| Component | Orta | Task 23-37 |
| Authorization (cross-user 404) | Yüksek | Task 17 + her API task |
| State machine geçişleri | Yüksek | Task 4 + finalize/archive E2E test |
| Manifest schema sözleşme testi | Yüksek | Task 40 |
| Golden path E2E | Orta | Task 41 |
| Manuel QA | Orta | Task 42 |

**Genel disiplin:** Phase 6'daki TDD + 2-stage review birebir. Fixture'lar `tests/fixtures/selection/` altında düzenli. `@imgly/background-removal` mock'lu (model accuracy bizim sorumluluğumuz değil; entegrasyon ve hata yüzeyi bizim).

---

## Rollout / Smoke / Doğrulama

1. **Per-task smoke**: Her task'in unit + integration test'leri PASS.
2. **Token audit**: UI task'lerinde `npm run check:tokens` (veya muadili) hardcoded color/spacing yasağı.
3. **Phase 6 regresyon smoke**: Task 38 sonrası Phase 6 review akışı manuel doğrulama (QA fixture'ı ile).
4. **Golden path E2E**: Task 41 — Quick start → edit → finalize → export tam akış otomatize.
5. **Manuel QA**: Task 42 — reorder a11y, background remove kalite, export ZIP extract, notification sync, cross-browser smoke.
6. **Closeout doc**: Phase 7 v1 status `🟢` ilan edilmeden önce manuel QA tüm maddeleri PASS.

---

## Out-of-scope (Plan'da değil — Carry-forward'lar zaten spec'te listelendi)

Spec Section 9 carry-forward listesi tüm out-of-scope item'ları içeriyor (19 madde). Plan'da yeniden açılmaz; spec'ten okunur.

**BLOCKED işler (Phase 6 sonrası açılır)**:
- `selection-studio-review-queue-source` (Drawer Review Queue tab aktivasyonu)
- `selection-studio-trigger-review` ("Review'a gönder" link aktivasyonu)
- `selection-studio-alpha-check-consolidate` (Phase 6 alpha-check ile birleştirme)

---

## Plan Self-Review Notu

Plan yazımı sonrası self-review:
- **Spec coverage**: Söz tablosu spec'in tüm bölümlerini task'lere haritaladı.
- **Placeholder scan**: TBD/TODO/"plan'da netleşir" yok (her task'te kapsam + dosya + test net).
- **Type consistency**: Service signature'lar (createSet, applyEdit, finalizeSet, etc.) task'ler arası tutarlı.
- **TDD ritmi**: Her task failing test → impl → pass → commit.
- **Reorder kararı**: Task 31'de menu/button tabanlı kesinleşmiş; spec ile birebir.
- **BLOCKED işler**: Tek bölümde açıkça listelendi.

---

## Execution Hand-off

**Önerilen execution mode:** Subagent-Driven Development.

Plan onaylandıktan sonra:
- Her task ayrı subagent'a dispatch edilir (full task text + bağımlılık context).
- 2-stage review: spec/contract compliance + code quality.
- Phase 6 disiplini birebir.
- BLOCKED task'ler Phase 6 smoke kapanmadan açılmaz.
