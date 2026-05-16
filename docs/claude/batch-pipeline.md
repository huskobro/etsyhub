# Batch Pipeline (Compose / Launch / Queue Panel / Lineage / Batch Detail)

> **AUTHORITATIVE — CURRENT.** Stage #3 (üretim). Batch oluşturma,
> compose form, launch dispatch (Midjourney + Kie), queue panel,
> lineage, batch detail tabs **güncel davranış + invariant**. Phase
> narrative DEĞİL.
>
> **Son güncelleme:** Phase 135 (2026-05-16)
> **Router:** `docs/claude/00-router.md` · **Önceki:**
> `references-intake.md` · **Sonraki:** `review.md`

---

## 1. Kapsam / Rol / Boundary

Batch = üretim pipeline'ının **merkezi çalışma birimi** (başı/sonu
olan, izlenebilir, kararla kapatılan iş). Canonical akış:
References → **Batch** → Review → Selection. **Boundary:** Batch
yalnız üretim (variation jobs) + lineage; review kararı **Review**
stage'inde (`/review?batch=`), selection set **Selection**
stage'inde. Batch detail variation üretir, mockup/listing
**üretmez**.

## 2. Current behavior

- **Schema (Phase 43):** gerçek `Batch` + `BatchItem` Prisma model
  (`BatchState`: DRAFT/QUEUED/RUNNING/SUCCESS/FAILED/CANCELLED).
  Legacy synthetic `Job.metadata.batchId` (cuid) aynı uzayda
  yaşar; iki pipeline uyumlu.
- **References Pool → "Add to Draft"** → current DRAFT batch
  (`getCurrentDraftBatch` / `addReferencesToCurrentDraft`). Queue
  panel (rail) default-collapsed (Phase 47) / expanded; item
  remove (Phase 46); "Create Similar" → compose.
- **Compose (Phase 44-49):** queue panel inline compose mode VEYA
  `/batches/[id]/compose` page. v4 A6 form: Provider (Midjourney
  default — Phase 60; settings `defaultImageProvider`), Aspect,
  Similarity (preview-only), Count (1-6), Quality, Brief.
  Provider-aware fields (`provider-capabilities.ts` static
  registry).
- **Launch (Phase 44/48/61):** `POST /api/batches/[id]/launch`.
  Multi-reference iteration (her item ayrı `createVariationJobs`,
  tümü aynı `Batch.id`). Provider-aware dispatcher:
  - **Kie** (`ai-variation`): `createVariationJobs`.
  - **Midjourney** (`midjourney`): mode-aware
    (`imagine`/`image-prompt`/`sref`/`oref`/`cref`/`describe`) →
    `createMidjourneyJob` / `createMidjourneyDescribeJob`. Bridge
    health proactive göstergesi + actionable copy + Switch-to-Kie
    (Phase 62).
  - Partial-failure tolerant (`perReference` array); ≥1 success
    → QUEUED, all-fail → DRAFT (re-launch güvenli).
- **Batch detail (Phase 4/7/11):** unified resolver (MJ_BRIDGE +
  GENERATE_VARIATIONS); 5-stage `deriveBatchStage` (running /
  review-pending / selection-ready / kept-no-selection / no-kept)
  + tek primary CTA. Tabs: Overview (provider-first production
  summary) / Items (thumbnail grid) / Parameters (read-only
  snapshot) / Logs (lifecycle timeline) / Costs (`CostUsage`
  groupBy provider). Provider-first dil ("Provider: Midjourney" /
  "Provider: Kie · GPT Image 1.5").
- **Lineage (Phase 2-5):** `Job.metadata.referenceId` (schema-zero).
  Batches index reference lineage chip + `?referenceId=` filter +
  review breakdown caption. Batch → Selection lineage
  `SelectionSet.sourceMetadata.mjOrigin.batchIds`.
- **Launch outcome (Phase 49):** sessionStorage one-shot →
  `/batches/[id]` → `LaunchOutcomeBanner` (full/partial/all-fail;
  per-ref skipped reason).
- **LaunchBatch → Selection (Phase 3-4):** `kept-no-selection`
  stage "Create Selection" → `createSelectionFromBatch` dispatcher
  (MJ → `createSelectionFromMjBatch`, AI →
  `createSelectionFromAiBatch`) → `/selections/[setId]`.

## 3. Invariants (değişmez)

- **Batch = ana üretim birimi**; Create Variations/Similar =
  ikincil refinement değil **batch creation trigger** (Phase 5-7;
  "+ New Batch" / "Add to Draft" primary).
- `Batch.id` + legacy `Job.metadata.batchId` **aynı cuid uzayı**;
  unified resolver (`getBatchSummary` AI önce dener, MJ fallback).
  Yeni pipeline batch.id'yi Job.metadata'ya yazar.
- **`deriveBatchStage` (KOD-DOĞRU):** 5 semantik ayrı değer,
  `BatchDetailClient.tsx:123-142` (**client component**, service
  değil); `BatchStageCTA` yalnız render (re-derivation YOK), tek
  primary CTA per stage.
- **Decision gate (Madde H) = VISIBILITY-only (POLICY, server
  enforce YOK):** `kept-no-selection` yalnız `undecided=0 ∧
  kept>0 ∧ set yok` iken render + "X undecided · decide before
  next stage" caption. **Ama POST `/api/batches/[id]/create-
  selection` undecided check YAPMAZ** (`createSelectionFromAiBatch`
  yalnız APPROVED+USER filter; CTA `create.isPending` ile disabled,
  undecided>0 ile değil). Operatör override edebilir → §5.5.
- **Multi-reference launch:** her `BatchItem` ayrı
  `createVariationJobs`, tümü aynı `Batch.id`; partial-failure
  `perReference` array; ≥1 success → QUEUED (idempotent
  re-launch). `enqueueReviewDesign` atomik (db.job + BullMQ tek
  adım; "enqueue but no db.job row" YASAK — Madde V).
- **Provider-aware dispatch:** `midjourney` ≠ Kie path; mode →
  backend param mapping (sref→styleReferenceUrls, oref→
  omniReferenceUrl, cref→characterReferenceUrls, image-prompt→
  referenceUrls; describe single-call). `defaultImageProvider`
  settings'ten (hardcoded YASAK).
- **Schema-zero lineage:** `Job.metadata.referenceId/batchId`
  JSON path query; `WorkflowRun` tablosu eklenmez (IA Phase 11
  kapsamı). `MidjourneyJob.referenceId` DB column set edilmez.
- **Review freeze (Madde Z) korunur** — batch review counts
  `reviewStatus`/`reviewStatusSource` axis'ten (operator-truth);
  batch pipeline review semantiğine dokunmaz.
- Cost: AI variation 24¢/call baseline (`track-usage.ts`);
  Midjourney bridge cost worker write YOK (provider fatura ayrı
  kanal — "no charge recorded" doğru ürün davranışı).

## 4. Relevant files / Ownership

- `src/features/batches/` — BatchesIndexClient, **BatchDetailClient
  (`deriveBatchStage` 5-stage burada — client-side)**, BatchQueuePanel
  (compose mode), BatchComposeClient
- `src/features/batches/server/batch-service.ts` — createDraftBatch,
  addReferencesToCurrentDraft, launchBatch, getBatchSummary,
  createSelectionFromBatch, removeBatchItem
- `src/server/services/.../kept.ts` — `createSelectionFromAiBatch`
  (APPROVED+USER filter; undecided check YOK — bkz. §3 decision gate)
- `src/features/variation-generation/` — provider-capabilities,
  ai-mode-form, AiModePanel
- `src/server/services/ai-generation.service.ts` —
  createVariationJobs (Job.metadata batchId/referenceId yazar)
- `src/app/api/batches/` — `[id]/launch`, `[id]/items`,
  `[id]/create-selection`, `current-draft`, `add-to-draft`
- `src/app/(app)/batches/` — index, `[id]`, `[id]/compose`

## 5. Open issues / Deferred

→ `docs/claude/known-issues-and-deferred.md`:
- Compose shared shell extraction (page + inline iki render path —
  davranış divergence görülmedikçe ertelenmiş)
- Similarity → brief injection (preview-only; backend wiring yok)
- Prompt template picker (v7 d2a/d2b PromptPreviewSection)
- Per-reference post-launch toast queue panel'inde
- Batches index DRAFT batch listeleme unification

## 5.5 Enforcement plan (policy → enforced adayları)

| Kural | Şu an | Enforce adayı? | Öncelik | Önerilen mekanizma |
|---|---|---|---|---|
| Decision gate (undecided=0 olmadan selection oluşturulmaz — Madde H) | POLICY (UI-stage görünürlük; server check YOK) | **Evet** | **P1** | `createSelectionFromBatch`/`createSelectionFromAiBatch` başına **server-side assert**: scope'ta `reviewStatusSource != USER` (undecided) sayımı > 0 ise `ValidationError` (operatör override istiyorsa explicit `?force=true` + audit — CLAUDE.md Madde H "override explicit + audit'lenebilir"). En kritik: şu an UI dışı bir POST gate'i tamamen bypass eder; downstream "kept" zincirinin bütünlüğü riskte. Ucuz (tek servis guard + 1 test). |
| Batch = ana üretim birimi / Create Similar = trigger | POLICY (UI dili + primary CTA) | Hayır | P3 | Wording/CTA kararı; runtime guard anlamsız. Mevcut yapı yeterli. |
| `defaultImageProvider` hardcoded YASAK | KOD-DOĞRU (settings resolve) | — | — | Korunmalı; regresyon testi. |
| Multi-ref launch ≥1→QUEUED / atomik enqueue | KOD-DOĞRU (`launchBatch` + `enqueueReviewDesign` atomik) | — | — | Korunmalı. |
| Schema-zero lineage (`WorkflowRun` eklenmez) | POLICY (mimari kısıt — IA Phase 11) | Hayır | P3 | Bilinçli erken-abstraction guard'ı (`known-issues` G). Açmak ayrı ürün kararı; runtime enforce konusu değil. |

**Net öneri:** **P1 = decision gate server-side assert**
(`createSelectionFromBatch` undecided>0 → 4xx + explicit
`?force` audit). Bu, code-grounding'de bulunan en yüksek-risk
POLICY açığı — UI-bypass eden bir API çağrısı operator-kept
zincirini sessizce kırabilir. Tek servis guard + test, küçük
scope. Diğer maddeler tasarım/wording — guard YAGNI.

## 6. Archive / Historical pointer

Tarihsel detay (Batch-First Phase 1-11, compose evrimi, multi-
launch, provider-first, Phase 60-62 Midjourney dispatcher) →
`docs/claude/archive/phase-log-12-96.md` (NOT authoritative).
Canonical surface per stage + decision gate → `CLAUDE.md`
Madde C/H.
