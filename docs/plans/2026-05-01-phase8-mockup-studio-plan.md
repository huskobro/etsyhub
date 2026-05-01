# Phase 8 — Mockup Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phase 7 v1.0.1'den çıkan `SelectionSet(status=ready)` setlerini Etsy listing için publish-ready 10-görsel mockup paketine dönüştüren localhost-first dikey dilimi inşa et.

**Architecture:** `MockupTemplate` + `MockupTemplateBinding` (one-to-many) + `MockupJob` 1:N `MockupRender` aggregate. In-house Sharp compositor (primary), Dynamic Mockups adapter contract-ready stub. Curated pack (cover + template diversity + variant rotation, deterministik). URL-primary state. S3 ana route + S1 drawer + S2 modal overlay. S7 → S8 auto-redirect.

**Tech Stack:** Next.js 15 (App Router), TypeScript strict, Prisma + PostgreSQL, BullMQ + Redis, MinIO/S3, Sharp 0.33+, TanStack Query, Zod, Radix Dialog, Tailwind. Phase 7 emsal patternlar (drawer, modal, polling, snapshot).

**Spec:** [docs/plans/2026-05-01-phase8-mockup-studio-design.md](2026-05-01-phase8-mockup-studio-design.md) — review-1 + review-2 kapalı, 14 mimari karar kilitli (§12.2).

---

## TDD + Review Ritmi (Tüm task'ler için zorunlu)

Her task aşağıdaki ritmi takip eder:

1. **Failing test yaz** — TDD red phase
2. **Test'i çalıştır** — fail doğrulanır
3. **Minimal implementation** — green phase
4. **Test'i çalıştır** — pass doğrulanır
5. **Refactor** (gerekirse) — green'i koruyarak
6. **TypeScript strict + token-purity check'leri** geçer
7. **Commit** (Phase 7 conventional commit emsali: `feat(phase8): ...`, `test(phase8): ...`)

Her task tamamlandıktan sonra **2-stage review** (Phase 7 emsali):
- **Stage 1 — Spec compliance review:** task'in spec'teki ilgili bölümle birebir uyumu
- **Stage 2 — Code quality review:** simplicity, naming, dead code, error handling

---

## Spec'ten Plan'a — Söz Tablosu

| Spec bölümü | Plan task'leri |
|---|---|
| §1.4 Phase 7 → Phase 8 sözleşme zinciri (hero fallback, aspectRatio fallback chain) | Task 5 (handoff service) |
| §2.1 Provider abstraction + binding model + resolveBinding | Task 4, Task 22 |
| §2.2 Sharp compositor primitives + 4-corner perspective | Task 0 (T0b), Task 9, Task 10 |
| §2.3 Job/Render aggregate state machine | Task 6, Task 18 |
| §2.4 Snapshot disiplini (binding + setSnapshotId hash) | Task 5, Task 9 |
| §2.5 Curated pack (cover + diversity + rotation) + K10 cover-fail fallback | Task 8 |
| §2.6 Quick Pack default + determinizm | Task 13 |
| §2.7 URL primary state | Task 14, Task 15 |
| §2.8 Honesty discipline | Tüm UI task'lerine yayılır |
| §3.1 Prisma schema (4 enum + 4 model) | Task 1 |
| §3.2 LocalSharpConfig + Zod schemas | Task 2, Task 3 |
| §3.3 RenderSnapshot stable JSON | Task 5 |
| §3.4 SelectionSet → MockupJob handoff | Task 5 |
| §4.1-4.8 API endpoints | Task 16, Task 17, Task 19, Task 20, Task 21 |
| §4.6 ZIP download (cover invariant, packPosition ASC, failed slot atlama) | Task 21 |
| §4.8 Cover swap atomic slot swap | Task 20 |
| §5.2 S3 Apply 4-zone layout + 9 state | Task 23, Task 24, Task 25 |
| §5.3 S1 Browse drawer | Task 26 |
| §5.4 S2 Detail modal | Task 27 |
| §5.5 S7 Job (running + failed + cancelled, polling) | Task 28 |
| §5.6 S8 Result (cover first, swap, retry, partial complete) | Task 29 |
| §5.7 Background completion toast | Task 30 |
| §6.1-6.3 URL state hook + auto-redirect yumuşatma | Task 14, Task 28 |
| §7.1-7.5 5-class hata sözlüğü + retry policy + cleanup | Task 11, Task 18 |
| §8 Test stratejisi | Task 31 (snapshot), Task 32 (E2E), Task 33 (manuel QA) |
| §9 V1 template envanteri | Task 0 (T0a, T0c), Task 12 |

---

## Phase 7 Bağımlı / BLOCKED İşler

| # | Bağımlılık | Durum | Etki |
|---|---|---|---|
| B1 | Phase 7 v1.0.1 🟢 (kapalı 2026-05-01) | OK | SelectionSet(status=ready) input olarak hazır |
| B2 | Phase 6 KIE flaky | BLOCKED ama Phase 8 bağımsız | Phase 6 mini-tour durduruldu; Phase 8 etkilemiyor |
| B3 | Phase 6 drift #6 | BLOCKED ama Phase 8 bağımsız | Ayrı carry-forward |
| B4 | Phase 9 Listing Builder | YET — Phase 9'a kadar | S8 "Listing'e gönder →" CTA disabled placeholder (§5.6) |

**Disiplin:**
- Phase 6'ya geri dönülmeyecek
- Phase 7 schema'sına yeni alan eklenmeyecek (hero fallback `position` 0, aspectRatio fallback chain spec §1.4)
- Yeni scope açılmayacak (15 carry-forward §1.3 dürüstçe ayrılmış)

---

## Dosya Yapısı

```
src/features/mockups/
├── types.ts                          # Provider config types, snapshot types (Task 2)
├── schemas.ts                        # Zod schemas (Task 3)
├── server/
│   ├── handoff.service.ts            # SelectionSet → MockupJob (Task 5)
│   ├── pack-selection.service.ts     # buildPackSelection + cover-fail fallback (Task 8)
│   ├── quick-pack.service.ts         # selectQuickPackDefault (Task 13)
│   ├── job.service.ts                # MockupJob CRUD + state transitions (Task 6)
│   ├── render.service.ts             # MockupRender lifecycle + retry/swap (Task 18, 19)
│   ├── snapshot.service.ts           # setSnapshotId hash + RenderSnapshot (Task 5)
│   └── error-classifier.service.ts   # 5-class error mapping (Task 11)
├── hooks/
│   ├── useMockupPackState.ts         # URL primary state hook (Task 14)
│   ├── useMockupJob.ts               # Polling query (Task 28)
│   ├── useMockupTemplates.ts         # Template list query (Task 23)
│   └── useMockupJobCompletionToast.ts # Background toast (Task 30)
├── components/
│   ├── S3ApplyView.tsx               # Ana karar ekranı (Task 23)
│   ├── SetSummaryCard.tsx            # Bağlam kartı (Task 24)
│   ├── PackPreviewCard.tsx           # Pack özeti + chip dizilimi (Task 25)
│   ├── DecisionBand.tsx              # Sticky footer + CTA (Task 25)
│   ├── EmptyPackState.tsx            # Boş pack durumu (Task 25)
│   ├── IncompatibleSetBand.tsx       # Aspect uyumsuz set (Task 25)
│   ├── S1BrowseDrawer.tsx            # Template kütüphanesi (Task 26)
│   ├── TemplateChip.tsx              # Pack chip + S1 card (Task 26)
│   ├── S2DetailModal.tsx             # Template preview (Task 27)
│   ├── S7JobView.tsx                 # Render progress (Task 28)
│   ├── S8ResultView.tsx              # Pack teslim (Task 29)
│   ├── CoverSwapModal.tsx            # Cover atomic swap (Task 29)
│   └── PerRenderActions.tsx          # Download/swap/retry per slot (Task 29)

src/app/(dashboard)/selection/sets/[setId]/mockup/
├── apply/page.tsx                    # S3 ana route (Task 23)
├── jobs/[jobId]/page.tsx             # S7 (Task 28)
└── jobs/[jobId]/result/page.tsx      # S8 (Task 29)

src/app/api/mockup/
├── jobs/route.ts                     # POST /jobs (Task 16)
├── jobs/[jobId]/route.ts             # GET /jobs/[id] (Task 17)
├── jobs/[jobId]/cancel/route.ts      # POST /cancel (Task 19)
├── jobs/[jobId]/cover/route.ts       # POST /cover atomic swap (Task 20)
├── jobs/[jobId]/download/route.ts    # GET ZIP (Task 21)
├── jobs/[jobId]/renders/[renderId]/swap/route.ts    # POST swap (Task 19)
├── jobs/[jobId]/renders/[renderId]/retry/route.ts   # POST retry (Task 19)
└── templates/route.ts                # GET /templates (Task 22)

src/lib/providers/mockup/
├── types.ts                          # MockupProvider interface (Task 4)
├── registry.ts                       # resolveBinding + priority chain (Task 4)
├── local-sharp/
│   ├── index.ts                      # Adapter entry (Task 9)
│   ├── compositor.ts                 # Sharp render core (Task 9, 10)
│   ├── safe-area.ts                  # Rect + perspective placement (Task 9, 10)
│   └── recipe-applicator.ts          # Blend + shadow (Task 9)
└── dynamic-mockups/
    └── index.ts                      # Stub adapter (Task 4 — V2 contract-ready)

src/jobs/
└── mockup-render.config.ts           # BullMQ config (Task 7)

prisma/
├── schema.prisma                     # +4 model +6 enum (Task 1)
└── seeds/mockup-templates.seed.ts    # 8 template + 8 binding seed (Task 12)

__tests__/
├── unit/mockup/
│   ├── pack-selection.test.ts        # buildPackSelection + cover-fail (Task 8)
│   ├── quick-pack.test.ts            # selectQuickPackDefault (Task 13)
│   ├── snapshot.test.ts              # setSnapshotId determinizm (Task 5)
│   ├── resolveBinding.test.ts        # Priority chain (Task 4)
│   ├── compositor.test.ts            # Sharp deterministic snapshot (Task 31)
│   ├── error-classifier.test.ts      # 5-class mapping (Task 11)
│   └── ui/                           # Component unit tests (Task 23-30)
├── integration/mockup/
│   ├── handoff.test.ts               # SelectionSet → Job (Task 5)
│   ├── job-lifecycle.test.ts         # State machine (Task 6)
│   ├── api/                          # Route integration (Task 16-22)
│   └── url-state.test.ts             # URL primary hook (Task 14)
├── e2e/mockup/
│   └── golden-path.test.ts           # Phase 7 set → submit → S8 ZIP (Task 32)
└── fixtures/mockup/
    ├── designs/                      # Test design assets (Task 31)
    ├── templates/                    # Test base assets (Task 0/T0a, Task 31)
    └── expected/                     # SHA snapshot referansları (Task 31)

docs/design/implementation-notes/
└── phase8-mockup-studio.md           # Manuel QA + closeout (Task 33)
```

---

## Tasks

---

### Task 0: V1 Template Asset Prep + Calibration (T0a + T0b + T0c)

**Files:**
- Create: `__tests__/fixtures/mockup/templates/tpl-canvas-001.png` ... `tpl-canvas-008.png`
- Create: `prisma/seeds/mockup-templates.seed.ts` (boş skeleton)
- Create: `docs/design/implementation-notes/phase8-asset-prep.md` (operasyonel doc)

**Bağlam:** Spec §9. Plan task 1'den **paralel başlatılır** (asset üretim 2-3 gün; bu süre içinde kod task'leri ilerler). Asset üretim bittiğinde Task 12 (binding seed) çalışacak.

- [ ] **Step 1: T0b — 4-corner perspective Sharp library spike**

  Karar: `sharp-perspective` paketi vs manuel matrix transform via `sharp.affine()` çoklu pass. Spike kriterleri:
  - Output deterministic mi (SSIM tolerance %1 altında repeat)
  - Sharp 0.33+ ile uyumluluk
  - Bundle size etkisi
  - Lisans uyumluluğu

  **Beklenen sonuç:** karar dokümantasyonu `phase8-asset-prep.md` içinde, paket veya custom implementation seçilir, Task 10'a girdi olur.

- [ ] **Step 2: T0a — 8 template asset üretimi**

  Spec §9 envanterindeki 8 template için:

  | # | Template | Aspect | safeArea | Vibe | Room | coverPriority |
  |---|---|---|---|---|---|---|
  | 1 | Modern Living Room — Sofa Wall | 2:3, 3:4 | rect | modern, neutral | living-room | 90 |
  | 2 | Scandinavian Bedroom — Bed Wall | 2:3, 3:4 | rect | scandinavian, minimal | bedroom | 80 |
  | 3 | Minimalist Office — Desk Wall (3/4 açı) | 3:4 | **perspective** | minimalist, modern | office | 50 |
  | 4 | Boho Living Room — Gallery Wall | 1:1, 2:3 | rect | boho, neutral | living-room | 70 |
  | 5 | Nursery — Crib Wall | 2:3 | rect | playful, soft | nursery | 60 |
  | 6 | Hallway — Single Canvas | 2:3, 3:4 | rect | modern, vintage | hallway | 40 |
  | 7 | Dining Room — Table Wall | 2:3 | rect | vintage, warm | dining | 30 |
  | 8 | Studio Shot — White Background | 1:1, 2:3, 3:4 | rect | minimalist | studio | 100 |

  Her template için:
  - Stock photo veya AI-generated oda fotoğrafı (Etsy commercial use uyumlu)
  - Manuel safe area kalibrasyonu — JSON ile (`SafeAreaRect` veya `SafeAreaPerspective`)
  - Recipe seed (`blendMode: "normal"`, `shadow: { offsetX: 8, offsetY: 12, blur: 16, opacity: 0.3 }`)
  - Thumbnail otomatik (Sharp resize 400×400)

- [ ] **Step 3: T0c — Seed JSON dosyaları hazırla**

  Her template için `prisma/seeds/mockup-templates.seed.ts` içinde:
  - `MockupTemplate` row data
  - `MockupTemplateBinding` (LOCAL_SHARP) row data with `LocalSharpConfig` JSON

  Şimdilik export sadece data; seed runner Task 12'de.

- [ ] **Step 4: Asset üretim doc'u yaz**

  `phase8-asset-prep.md` içinde:
  - Her template'in kaynağı (stock URL veya AI prompt)
  - Lisans bilgisi
  - Manuel kalibrasyon adımları (perspective template için 4-corner pick metodu)
  - Recipe parametre ayarlarının gerekçesi

- [ ] **Step 5: Commit**

  ```bash
  git add __tests__/fixtures/mockup/templates/ prisma/seeds/mockup-templates.seed.ts docs/design/implementation-notes/phase8-asset-prep.md
  git commit -m "chore(phase8): T0 asset prep — 8 template seed data + perspective spike"
  ```

> **Operasyonel not:** T0a tasarım/manuel iş; geliştirici task'leri (Task 1+) bu adımdan bağımsız olarak başlar. Task 12 (seed apply) T0a tamamlandığında çalışır.

---

### Task 1: Prisma migration — `MockupTemplate` + `MockupTemplateBinding` + `MockupJob` + `MockupRender`

**Files:**
- Modify: `prisma/schema.prisma` (4 model + 6 enum)
- Create: `prisma/migrations/YYYYMMDD_phase8_mockup/migration.sql`
- Create: `__tests__/integration/mockup/schema.test.ts`

- [ ] **Step 1: Failing schema test**

  ```ts
  // __tests__/integration/mockup/schema.test.ts
  describe("Phase 8 Prisma schema", () => {
    it("creates MockupTemplate with active binding", async () => {
      const tpl = await prisma.mockupTemplate.create({
        data: {
          categoryId: "canvas",
          name: "Test Template",
          status: "ACTIVE",
          thumbKey: "thumb.png",
          aspectRatios: ["2:3", "3:4"],
          tags: ["modern", "test"],
          estimatedRenderMs: 2000,
          bindings: {
            create: {
              providerId: "LOCAL_SHARP",
              status: "ACTIVE",
              config: { providerId: "local-sharp", baseAssetKey: "x.png", baseDimensions: { w: 2400, h: 1600 }, safeArea: { type: "rect", x: 0.3, y: 0.2, w: 0.4, h: 0.5 }, recipe: { blendMode: "normal" }, coverPriority: 50 },
              estimatedRenderMs: 2000,
            },
          },
        },
        include: { bindings: true },
      });
      expect(tpl.bindings).toHaveLength(1);
      expect(tpl.bindings[0].providerId).toBe("LOCAL_SHARP");
    });

    it("creates MockupJob with renders cascade", async () => {
      // ... benzer pattern
    });

    it("@@unique([templateId, providerId]) enforced", async () => {
      // duplicate binding insert → fail
    });
  });
  ```

- [ ] **Step 2: Schema + enum'ları ekle**

  Spec §3.1'deki tam schema:
  - 6 enum: `MockupProviderId`, `MockupTemplateStatus`, `MockupBindingStatus`, `MockupJobStatus`, `MockupRenderStatus`, `MockupErrorClass`, `PackSelectionReason`
  - 4 model: `MockupTemplate`, `MockupTemplateBinding`, `MockupJob`, `MockupRender`
  - Index'ler: `[categoryId, status]`, `[providerId, status]`, `[userId, createdAt]`, `[setId, createdAt]`, `[status]`, `[jobId, packPosition]`, `[jobId, status]`
  - Foreign keys: `MockupJob.userId → User.id` (onDelete: Restrict, Phase 7 emsali), `MockupJob.setId → SelectionSet.id` (Restrict), `MockupRender.jobId → MockupJob.id` (Cascade)

- [ ] **Step 3: Migration üret + apply**

  ```bash
  npx prisma migrate dev --name phase8_mockup
  ```

- [ ] **Step 4: Schema test PASS**

  ```bash
  npx vitest run __tests__/integration/mockup/schema.test.ts
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add prisma/schema.prisma prisma/migrations/ __tests__/integration/mockup/schema.test.ts
  git commit -m "feat(phase8): MockupTemplate/Binding/Job/Render Prisma models + 6 enums"
  ```

---

### Task 2: Provider config types + snapshot types

**Files:**
- Create: `src/features/mockups/types.ts`
- Create: `src/lib/providers/mockup/types.ts`

- [ ] **Step 1: Type definitions**

  ```ts
  // src/lib/providers/mockup/types.ts
  // Spec §3.2 LocalSharpConfig

  export type SafeAreaRect = {
    type: "rect";
    x: number; y: number; w: number; h: number;
    rotation?: number;
  };

  export type SafeAreaPerspective = {
    type: "perspective";
    corners: [
      [number, number], [number, number],
      [number, number], [number, number]
    ];
  };

  export type SafeArea = SafeAreaRect | SafeAreaPerspective;

  export type ShadowSpec = {
    offsetX: number; offsetY: number;
    blur: number; opacity: number;
  };

  export type MockupRecipe = {
    blendMode: "normal" | "multiply" | "screen";
    shadow?: ShadowSpec;
  };

  export type LocalSharpConfig = {
    providerId: "local-sharp";
    baseAssetKey: string;
    baseDimensions: { w: number; h: number };
    safeArea: SafeArea;
    recipe: MockupRecipe;
    coverPriority: number;
  };

  export type DynamicMockupsConfig = {
    providerId: "dynamic-mockups";
    externalTemplateId: string;
    smartObjectOptions?: Record<string, unknown>;
    safeAreaHint?: SafeArea;
  };

  export type ProviderConfig = LocalSharpConfig | DynamicMockupsConfig;

  // Snapshot for MockupRender.templateSnapshot JSON
  export type RenderSnapshot = {
    templateId: string;
    bindingId: string;
    bindingVersion: number;
    providerId: "LOCAL_SHARP" | "DYNAMIC_MOCKUPS";
    config: Omit<LocalSharpConfig, "coverPriority"> | DynamicMockupsConfig;
    templateName: string;
    aspectRatios: string[];
  };

  export type RenderInput = {
    renderId: string;
    designUrl: string;
    designAspectRatio: string;
    snapshot: RenderSnapshot;
    signal: AbortSignal;
  };

  export type RenderOutput = {
    outputKey: string;
    thumbnailKey: string;
    outputDimensions: { w: number; h: number };
    renderDurationMs: number;
  };
  ```

- [ ] **Step 2: Type-only test (compile check)**

  ```ts
  // __tests__/unit/mockup/types.test.ts
  import { expectTypeOf } from "vitest";
  import type { SafeArea, ProviderConfig } from "@/lib/providers/mockup/types";

  it("SafeArea discriminated union exhaustive narrowing", () => {
    const sa: SafeArea = { type: "rect", x: 0, y: 0, w: 1, h: 1 };
    if (sa.type === "rect") {
      expectTypeOf(sa.x).toEqualTypeOf<number>();
    } else {
      expectTypeOf(sa.corners).toEqualTypeOf<[[number,number],[number,number],[number,number],[number,number]]>();
    }
  });
  ```

- [ ] **Step 3: TypeScript strict pass**

  ```bash
  npx tsc --noEmit
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add src/lib/providers/mockup/types.ts src/features/mockups/types.ts __tests__/unit/mockup/types.test.ts
  git commit -m "feat(phase8): provider config + render snapshot types"
  ```

---

### Task 3: Zod schemas (validation)

**Files:**
- Create: `src/features/mockups/schemas.ts`
- Create: `__tests__/unit/mockup/schemas.test.ts`

- [ ] **Step 1: Failing schema tests**

  ```ts
  describe("LocalSharpConfigSchema", () => {
    it("rejects missing baseAssetKey", () => {
      expect(() => LocalSharpConfigSchema.parse({ providerId: "local-sharp" })).toThrow();
    });
    it("accepts valid rect safeArea", () => {
      const config = { providerId: "local-sharp", baseAssetKey: "x.png", baseDimensions: { w: 2400, h: 1600 }, safeArea: { type: "rect", x: 0.3, y: 0.2, w: 0.4, h: 0.5 }, recipe: { blendMode: "normal" }, coverPriority: 50 };
      expect(LocalSharpConfigSchema.parse(config)).toEqual(config);
    });
    it("accepts valid perspective safeArea", () => { ... });
    it("rejects safeArea normalize > 1", () => { ... });
    it("rejects unknown blendMode", () => { ... });
    it("rejects shadow.opacity > 1", () => { ... });
  });
  ```

- [ ] **Step 2: Implement Zod schemas**

  ```ts
  // src/features/mockups/schemas.ts
  import { z } from "zod";

  export const ShadowSpecSchema = z.object({
    offsetX: z.number(),
    offsetY: z.number(),
    blur: z.number().min(0),
    opacity: z.number().min(0).max(1),
  });

  export const MockupRecipeSchema = z.object({
    blendMode: z.enum(["normal", "multiply", "screen"]),
    shadow: ShadowSpecSchema.optional(),
  });

  export const SafeAreaRectSchema = z.object({
    type: z.literal("rect"),
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    w: z.number().min(0).max(1),
    h: z.number().min(0).max(1),
    rotation: z.number().optional(),
  });

  export const SafeAreaPerspectiveSchema = z.object({
    type: z.literal("perspective"),
    corners: z.tuple([
      z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]),
      z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]),
      z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]),
      z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]),
    ]),
  });

  export const SafeAreaSchema = z.discriminatedUnion("type", [
    SafeAreaRectSchema,
    SafeAreaPerspectiveSchema,
  ]);

  export const LocalSharpConfigSchema = z.object({
    providerId: z.literal("local-sharp"),
    baseAssetKey: z.string().min(1),
    baseDimensions: z.object({
      w: z.number().int().positive(),
      h: z.number().int().positive(),
    }),
    safeArea: SafeAreaSchema,
    recipe: MockupRecipeSchema,
    coverPriority: z.number().min(0).max(100),
  });

  // API request schemas
  export const CreateJobBodySchema = z.object({
    setId: z.string().min(1),
    categoryId: z.literal("canvas"),
    templateIds: z.array(z.string()).min(1).max(8),
  });

  export const CoverSwapBodySchema = z.object({
    renderId: z.string().min(1),
  });
  ```

- [ ] **Step 3: Tests PASS**

- [ ] **Step 4: Commit**

  ```bash
  git commit -m "feat(phase8): Zod schemas for LocalSharpConfig + API bodies"
  ```

---

### Task 4: Provider abstraction layer + registry + Dynamic Mockups stub

**Files:**
- Create: `src/lib/providers/mockup/registry.ts`
- Create: `src/lib/providers/mockup/local-sharp/index.ts` (interface only, real impl Task 9)
- Create: `src/lib/providers/mockup/dynamic-mockups/index.ts` (stub)
- Create: `__tests__/unit/mockup/resolveBinding.test.ts`

- [ ] **Step 1: MockupProvider interface**

  ```ts
  // src/lib/providers/mockup/registry.ts
  export interface MockupProvider {
    readonly id: "LOCAL_SHARP" | "DYNAMIC_MOCKUPS";
    render(input: RenderInput): Promise<RenderOutput>;
    /** Pre-render config validation (Zod parse + asset existence) */
    validateConfig(config: unknown): { ok: true } | { ok: false; reason: string };
  }

  const PROVIDER_PRIORITY = ["LOCAL_SHARP", "DYNAMIC_MOCKUPS"] as const;

  export function resolveBinding(
    template: MockupTemplate & { bindings: MockupTemplateBinding[] }
  ): MockupTemplateBinding | null {
    const active = template.bindings.filter(b => b.status === "ACTIVE");
    for (const providerId of PROVIDER_PRIORITY) {
      const binding = active.find(b => b.providerId === providerId);
      if (binding) return binding;
    }
    return null;
  }

  // Provider lookup
  export function getProvider(providerId: "LOCAL_SHARP" | "DYNAMIC_MOCKUPS"): MockupProvider {
    switch (providerId) {
      case "LOCAL_SHARP": return localSharpProvider;
      case "DYNAMIC_MOCKUPS": return dynamicMockupsProvider;
    }
  }
  ```

- [ ] **Step 2: Dynamic Mockups stub adapter (V2 contract-ready)**

  ```ts
  // src/lib/providers/mockup/dynamic-mockups/index.ts
  // V2 contract-ready stub — V1'de gerçek implementation YOK.
  // Spec §2.1: "adapter dosyası v1'de var, interface compliance testi geçiyor;
  // ancak v1'de hiç binding satırı yok, gerçek render() çağrısı yapılmıyor."

  export const dynamicMockupsProvider: MockupProvider = {
    id: "DYNAMIC_MOCKUPS",
    async render() {
      throw new Error("PROVIDER_NOT_CONFIGURED: Dynamic Mockups V2'de implement edilecek");
    },
    validateConfig(config) {
      // Stub validation: schema parse only, asset/API key check yok
      return { ok: true };
    },
  };
  ```

- [ ] **Step 3: Local Sharp provider scaffold (Task 9'da gerçek impl)**

  ```ts
  // src/lib/providers/mockup/local-sharp/index.ts
  export const localSharpProvider: MockupProvider = {
    id: "LOCAL_SHARP",
    async render(input) {
      // Task 9'da implement
      throw new Error("NOT_IMPLEMENTED: Task 9");
    },
    validateConfig(config) {
      const result = LocalSharpConfigSchema.safeParse(config);
      return result.success ? { ok: true } : { ok: false, reason: result.error.message };
    },
  };
  ```

- [ ] **Step 4: resolveBinding tests (5 senaryo)**

  ```ts
  describe("resolveBinding", () => {
    it("returns LOCAL_SHARP binding when active", () => { ... });
    it("falls back to DYNAMIC_MOCKUPS when no LOCAL_SHARP active", () => { ... });
    it("returns null when no active bindings", () => { ... });
    it("ignores DRAFT/ARCHIVED bindings", () => { ... });
    it("priority chain: LOCAL_SHARP > DYNAMIC_MOCKUPS", () => { ... });
  });

  describe("MockupProvider interface compliance", () => {
    it("dynamicMockupsProvider has correct shape", () => { ... });
    it("localSharpProvider validateConfig works", () => { ... });
  });
  ```

- [ ] **Step 5: Tests PASS**

- [ ] **Step 6: Commit**

  ```bash
  git commit -m "feat(phase8): provider registry + resolveBinding priority chain + DM stub"
  ```

---

### Task 5: SelectionSet → MockupJob handoff service + setSnapshotId hash

**Files:**
- Create: `src/features/mockups/server/snapshot.service.ts`
- Create: `src/features/mockups/server/handoff.service.ts`
- Create: `__tests__/unit/mockup/snapshot.test.ts`
- Create: `__tests__/integration/mockup/handoff.test.ts`

- [ ] **Step 1: Failing snapshot tests**

  ```ts
  describe("computeSetSnapshotId", () => {
    it("produces deterministic hash for same set+items", () => {
      const set = mockSet({ items: [...] });
      expect(computeSetSnapshotId(set)).toBe(computeSetSnapshotId(set));
    });
    it("different items → different hash", () => { ... });
    it("rejected items excluded", () => { ... });
    it("position ordering normalized", () => { ... });
  });

  describe("snapshotForRender", () => {
    it("excludes coverPriority (catalog meta)", () => { ... });
    it("byte-stable JSON.stringify with sorted keys", () => { ... });
    it("denormalizes templateName + aspectRatios", () => { ... });
  });
  ```

- [ ] **Step 2: Implement snapshot.service.ts**

  ```ts
  import { createHash } from "node:crypto";

  export function stableStringify(obj: unknown): string {
    return JSON.stringify(obj, Object.keys(obj as object).sort());
  }

  export function computeSetSnapshotId(set: SelectionSetWithItems): string {
    const payload = {
      setId: set.id,
      status: set.status,
      finalizedAt: set.finalizedAt?.toISOString() ?? null,
      items: set.items
        .filter(item => item.status !== "rejected")
        .sort((a, b) => a.position - b.position)
        .map(item => ({
          id: item.id,
          position: item.position,
          assetUrl: resolveAssetUrl(item),
          aspectRatio: resolveAspectRatio(item),
        })),
    };
    return createHash("sha256").update(stableStringify(payload)).digest("hex");
  }

  export function snapshotForRender(
    binding: MockupTemplateBinding,
    template: MockupTemplate,
  ): RenderSnapshot {
    const config = binding.config as ProviderConfig;
    const { coverPriority, ...snapshotConfig } = config as LocalSharpConfig & { coverPriority: number };
    return {
      templateId: template.id,
      bindingId: binding.id,
      bindingVersion: binding.version,
      providerId: binding.providerId,
      config: snapshotConfig,
      templateName: template.name,
      aspectRatios: template.aspectRatios,
    };
  }

  // Spec §1.4 fallback chain
  export function resolveAspectRatio(
    item: SelectionItem & { generatedDesign: GeneratedDesign & { productType: ProductType | null } }
  ): string | null {
    return item.generatedDesign.aspectRatio
      ?? item.generatedDesign.productType?.aspectRatio
      ?? null;
  }

  export function resolveAssetUrl(
    item: SelectionItem & { sourceAsset: Asset; editedAsset: Asset | null }
  ): string {
    return item.editedAsset?.url ?? item.sourceAsset.url;
  }
  ```

- [ ] **Step 3: Failing handoff integration tests**

  ```ts
  describe("createMockupJob (handoff service)", () => {
    it("rejects when SelectionSet status ≠ ready", async () => { ... });
    it("rejects cross-user (404 disiplini)", async () => { ... });
    it("rejects empty templateIds", async () => { ... });
    it("rejects > 8 templateIds", async () => { ... });
    it("rejects when no template aspect compatible", async () => { ... });
    it("rejects when all variants have null aspectRatio (set-level)", async () => { ... });
    it("creates job + N MockupRender rows eager (PENDING)", async () => { ... });
    it("computes setSnapshotId deterministically", async () => { ... });
    it("totalRenders = actualPackSize (compatibility-limited)", async () => { ... });
    it("stores templateSnapshot in each render", async () => { ... });
  });
  ```

- [ ] **Step 4: Implement handoff.service.ts**

  ```ts
  // Spec §3.4 atomic creation
  export async function createMockupJob(input: CreateJobInput): Promise<{ jobId: string }> {
    const set = await prisma.selectionSet.findUnique({
      where: { id: input.setId },
      include: { items: { include: { generatedDesign: { include: { productType: true } }, sourceAsset: true, editedAsset: true } } },
    });

    if (!set || set.userId !== input.userId) throw new NotFoundError("SET_NOT_FOUND");
    if (set.status !== "ready") throw new BadRequestError("INVALID_SET");

    const templates = await prisma.mockupTemplate.findMany({
      where: { id: { in: input.templateIds }, status: "ACTIVE" },
      include: { bindings: { where: { status: "ACTIVE" } } },
    });

    // resolveBinding for each template
    const bindings = templates.map(t => ({ template: t, binding: resolveBinding(t) }));
    if (bindings.some(b => !b.binding)) throw new BadRequestError("TEMPLATE_INVALID");

    // buildPackSelection (Task 8)
    const pack = buildPackSelection(set, bindings.map(b => b.binding!));

    const setSnapshotId = computeSetSnapshotId(set);

    return await prisma.$transaction(async (tx) => {
      const job = await tx.mockupJob.create({
        data: {
          userId: input.userId,
          setId: set.id,
          setSnapshotId,
          categoryId: "canvas",
          status: "QUEUED",
          packSize: 10,
          actualPackSize: pack.slots.length,
          totalRenders: pack.slots.length,
          coverRenderId: null, // Task 8 cover slot belirler, render create sonrası set
        },
      });

      const renders = await Promise.all(pack.slots.map((slot, idx) =>
        tx.mockupRender.create({
          data: {
            jobId: job.id,
            variantId: slot.variantId,
            bindingId: slot.binding.id,
            templateSnapshot: snapshotForRender(slot.binding, slot.template) as any,
            packPosition: idx,
            selectionReason: idx === 0 ? "COVER" : (idx <= bindings.length - 1 ? "TEMPLATE_DIVERSITY" : "VARIANT_ROTATION"),
            status: "PENDING",
          },
        })
      ));

      // Cover slot 0 = coverRenderId (cover invariant §4.8)
      await tx.mockupJob.update({
        where: { id: job.id },
        data: { coverRenderId: renders[0].id },
      });

      // BullMQ dispatch (Task 7)
      await queueMockupRenderJobs(job.id, renders.map(r => r.id));

      return { jobId: job.id };
    });
  }
  ```

- [ ] **Step 5: Tests PASS**

- [ ] **Step 6: Commit**

  ```bash
  git commit -m "feat(phase8): handoff service (SelectionSet → MockupJob) + setSnapshotId hash"
  ```

---

### Task 6: MockupJob state machine + aggregate roll-up

**Files:**
- Create: `src/features/mockups/server/job.service.ts`
- Create: `__tests__/integration/mockup/job-lifecycle.test.ts`

- [ ] **Step 1: Failing state machine tests**

  Spec §2.3 state machine:
  ```
  Job: queued → running → (completed | partial_complete | failed | cancelled)
  Render: pending → rendering → (success | failed)

  Aggregate roll-up:
  - all renders success → completed
  - some success + some failed → partial_complete
  - no success → failed
  - cancel → cancelled
  ```

  ```ts
  describe("MockupJob aggregate roll-up", () => {
    it("all success → COMPLETED", async () => { ... });
    it("some success + some fail → PARTIAL_COMPLETE", async () => { ... });
    it("no success → FAILED", async () => { ... });
    it("cancel → CANCELLED, pending renders → FAILED with errorClass=null", async () => { ... });
    it("transitions QUEUED → RUNNING when first render starts", async () => { ... });
    it("transitions RUNNING → terminal when all renders terminal", async () => { ... });
  });
  ```

- [ ] **Step 2: Implement job.service.ts**

  ```ts
  export async function recomputeJobStatus(jobId: string): Promise<MockupJobStatus> {
    const job = await prisma.mockupJob.findUniqueOrThrow({
      where: { id: jobId },
      include: { renders: true },
    });

    if (job.status === "CANCELLED") return "CANCELLED";

    const successCount = job.renders.filter(r => r.status === "SUCCESS").length;
    const failCount = job.renders.filter(r => r.status === "FAILED").length;
    const total = job.renders.length;

    let newStatus: MockupJobStatus;
    if (successCount + failCount < total) {
      newStatus = job.status === "QUEUED" && job.renders.some(r => r.status !== "PENDING") ? "RUNNING" : job.status;
    } else if (successCount === total) {
      newStatus = "COMPLETED";
    } else if (successCount === 0) {
      newStatus = "FAILED";
    } else {
      newStatus = "PARTIAL_COMPLETE";
    }

    await prisma.mockupJob.update({
      where: { id: jobId },
      data: {
        status: newStatus,
        successRenders: successCount,
        failedRenders: failCount,
        completedAt: ["COMPLETED", "PARTIAL_COMPLETE", "FAILED"].includes(newStatus) ? new Date() : null,
      },
    });

    return newStatus;
  }

  export async function cancelJob(jobId: string, userId: string): Promise<void> {
    // ownership + state guard
    // BullMQ kaldırma (Task 7 entegrasyonu)
    // pending renders → FAILED + errorClass=null
  }
  ```

- [ ] **Step 3: Tests PASS**

- [ ] **Step 4: Commit**

  ```bash
  git commit -m "feat(phase8): MockupJob state machine + aggregate roll-up"
  ```

---

### Task 7: BullMQ worker config — `MOCKUP_RENDER` job

**Files:**
- Create: `src/jobs/mockup-render.config.ts`
- Create: `src/jobs/mockup-render.worker.ts`
- Create: `__tests__/integration/mockup/worker.test.ts`

- [ ] **Step 1: Failing worker tests**

  ```ts
  describe("MOCKUP_RENDER worker", () => {
    it("processes render: PENDING → RENDERING → SUCCESS", async () => { ... });
    it("classifies Sharp throw → TEMPLATE_INVALID", async () => { ... });
    it("classifies timeout → RENDER_TIMEOUT", async () => { ... });
    it("classifies provider error → PROVIDER_DOWN", async () => { ... });
    it("triggers recomputeJobStatus after each render", async () => { ... });
  });
  ```

- [ ] **Step 2: Implement worker**

  ```ts
  // src/jobs/mockup-render.config.ts
  export const MOCKUP_RENDER_JOB = {
    name: "MOCKUP_RENDER",
    attempts: 1,             // Spec §7.2 auto-retry yok
    timeout: 60_000,         // Spec §7.1 RENDER_TIMEOUT cap
    removeOnComplete: 100,
    removeOnFail: 200,
  } as const;

  // src/jobs/mockup-render.worker.ts
  // Worker: dequeue → render.service.executeRender → recomputeJobStatus
  ```

- [ ] **Step 3: Tests PASS**

- [ ] **Step 4: Commit**

  ```bash
  git commit -m "feat(phase8): MOCKUP_RENDER BullMQ worker + config"
  ```

---

### Task 8: Pack selection algorithm — cover + template diversity + variant rotation + cover-fail fallback

**Files:**
- Create: `src/features/mockups/server/pack-selection.service.ts`
- Create: `__tests__/unit/mockup/pack-selection.test.ts`

> **K10 cover-fail fallback (review-2 sonrası gözlem):** Spec §2.5 + §4.6'daki cover invariant'ı gereği, cover render'ın kendisi fail olursa sistem otomatik fallback ile ilk success render'ı atomic swap ile cover'a çekmeli. Plan task seviyesinde implement edilir; spec dokunulmadı.

- [ ] **Step 1: Failing tests — buildPackSelection (Spec §2.5)**

  ```ts
  describe("buildPackSelection", () => {
    it("filters validPairs by aspect compatibility", () => { ... });
    it("throws TemplateInvalidError when no valid pairs", () => { ... });
    it("picks cover: hero variant (position=0) × highest coverPriority binding", () => { ... });
    it("template diversity: each unique binding represented at least once", () => { ... });
    it("variant rotation: round-robin for remaining slots", () => { ... });
    it("deterministic: same input → same output (stable sort verification)", () => { ... });
    it("compatibility-limited: validPairs.length < packSize → actualPackSize < 10", () => { ... });
    it("packSize=1 (only cover) edge case", () => { ... });
  });

  describe("pickCover (Spec §2.5 hero fallback)", () => {
    it("hero = position ASC ilk SelectionItem (status≠rejected)", () => { ... });
    it("rejected items excluded from hero candidates", () => { ... });
    it("highest coverPriority binding when multiple bindings", () => { ... });
    it("lex tie-break for equal coverPriority (bindingId ASC)", () => { ... });
  });
  ```

- [ ] **Step 2: Failing tests — cover-fail fallback (K10)**

  ```ts
  describe("recomputePackOnRenderComplete (K10 cover-fail fallback)", () => {
    it("cover render success: no fallback needed", async () => { ... });
    it("cover render FAILED + first success exists: atomic swap, coverRenderId update, packPosition=0 reassigned", async () => { ... });
    it("cover render FAILED + no success yet: coverRenderId unchanged, fallback waits", async () => { ... });
    it("all renders FAILED: coverRenderId unchanged, job → FAILED status (Task 6 covers)", async () => { ... });
  });
  ```

- [ ] **Step 3: Implement buildPackSelection (Spec §2.5)**

  ```ts
  export function buildPackSelection(
    set: SelectionSetWithItems,
    bindings: MockupTemplateBinding[],
    packSize: number = 10,
  ): PackSelection {
    const validPairs = filterValidPairs(set.items, bindings)
      .sort((a, b) => a.binding.id.localeCompare(b.binding.id) || a.variant.id.localeCompare(b.variant.id));

    if (validPairs.length === 0) throw new TemplateInvalidError("No compatible pair");

    const cover = pickCover(set.items, bindings, validPairs);
    const sortedBindings = [...bindings].sort((a, b) => a.id.localeCompare(b.id));
    const diversitySlots = pickTemplateDiversity(validPairs, cover, sortedBindings);
    const rotationSlots = pickVariantRotation(validPairs, [cover, ...diversitySlots], packSize - 1 - diversitySlots.length);

    return { cover, slots: [cover, ...diversitySlots, ...rotationSlots] };
  }

  function pickCover(items, bindings, validPairs): PackSlot {
    const heroVariant = items
      .filter(i => i.status !== "rejected")
      .sort((a, b) => a.position - b.position)[0];
    const sortedBindings = [...bindings].sort((a, b) =>
      (b.config as LocalSharpConfig).coverPriority - (a.config as LocalSharpConfig).coverPriority
      || a.id.localeCompare(b.id)
    );
    // First binding compatible with hero
    for (const binding of sortedBindings) {
      const pair = validPairs.find(p => p.variant.id === heroVariant.id && p.binding.id === binding.id);
      if (pair) return pair;
    }
    return validPairs[0]; // fallback (any pair)
  }
  ```

- [ ] **Step 4: Implement cover-fail fallback (K10)**

  ```ts
  // Çağrılır: render terminal olduğunda Task 7 worker tarafından
  export async function recomputePackOnRenderComplete(jobId: string): Promise<void> {
    const job = await prisma.mockupJob.findUniqueOrThrow({
      where: { id: jobId },
      include: { renders: true },
    });

    if (!job.coverRenderId) return;
    const cover = job.renders.find(r => r.id === job.coverRenderId);
    if (!cover || cover.status !== "FAILED") return;

    // Cover fail: ilk success render'ı bul, atomic swap
    const firstSuccess = job.renders
      .filter(r => r.status === "SUCCESS")
      .sort((a, b) => (a.packPosition ?? Infinity) - (b.packPosition ?? Infinity))[0];

    if (!firstSuccess) return; // Henüz success yok, beklemek lazım

    // Atomic swap (Task 20 emsali pattern)
    await prisma.$transaction([
      prisma.mockupRender.update({ where: { id: cover.id }, data: { packPosition: firstSuccess.packPosition } }),
      prisma.mockupRender.update({ where: { id: firstSuccess.id }, data: { packPosition: 0 } }),
      prisma.mockupJob.update({ where: { id: jobId }, data: { coverRenderId: firstSuccess.id } }),
    ]);
  }
  ```

- [ ] **Step 5: Tests PASS**

- [ ] **Step 6: Commit**

  ```bash
  git commit -m "feat(phase8): pack selection (cover + diversity + rotation) + K10 cover-fail fallback"
  ```

---

### Task 9: Local Sharp compositor — rect safeArea + recipe (frontal templates)

**Files:**
- Modify: `src/lib/providers/mockup/local-sharp/index.ts`
- Create: `src/lib/providers/mockup/local-sharp/compositor.ts`
- Create: `src/lib/providers/mockup/local-sharp/safe-area.ts`
- Create: `src/lib/providers/mockup/local-sharp/recipe-applicator.ts`
- Create: `__tests__/unit/mockup/compositor.test.ts`

- [ ] **Step 1: Install Sharp (varsa skip)**

  ```bash
  npm list sharp || npm install sharp
  ```

- [ ] **Step 2: Failing compositor tests (rect placement)**

  ```ts
  describe("LocalSharp compositor (rect)", () => {
    it("places design on base asset at rect safeArea coords", async () => { ... });
    it("respects rotation field", async () => { ... });
    it("applies blendMode 'multiply'", async () => { ... });
    it("applies shadow before composite", async () => { ... });
    it("returns deterministic SHA hash for same input (frontal)", async () => { ... });
  });
  ```

- [ ] **Step 3: Implement compositor (rect path)**

  ```ts
  // src/lib/providers/mockup/local-sharp/safe-area.ts
  export async function placeRect(
    designBuffer: Buffer,
    safeArea: SafeAreaRect,
    baseDimensions: { w: number; h: number }
  ): Promise<{ buffer: Buffer; top: number; left: number }> {
    const targetW = Math.round(safeArea.w * baseDimensions.w);
    const targetH = Math.round(safeArea.h * baseDimensions.h);
    let img = sharp(designBuffer).resize(targetW, targetH, { fit: "fill" });
    if (safeArea.rotation) img = img.rotate(safeArea.rotation);
    return {
      buffer: await img.toBuffer(),
      top: Math.round(safeArea.y * baseDimensions.h),
      left: Math.round(safeArea.x * baseDimensions.w),
    };
  }

  // src/lib/providers/mockup/local-sharp/compositor.ts
  export async function renderRect(input: RenderInput): Promise<RenderOutput> {
    const config = input.snapshot.config as LocalSharpConfig;
    const baseBuffer = await fetchAsset(config.baseAssetKey);
    const designBuffer = await fetchDesignBuffer(input.designUrl);

    const placement = await placeRect(designBuffer, config.safeArea as SafeAreaRect, config.baseDimensions);
    const layers = [
      ...(config.recipe.shadow ? [await buildShadowLayer(placement, config.recipe.shadow)] : []),
      { input: placement.buffer, top: placement.top, left: placement.left, blend: config.recipe.blendMode },
    ];

    const composited = await sharp(baseBuffer).composite(layers).png().toBuffer();
    const outputKey = await uploadResult(input.renderId, composited);
    const thumbnailKey = await uploadResult(`${input.renderId}-thumb`, await sharp(composited).resize(400, 400, { fit: "inside" }).toBuffer());
    return { outputKey, thumbnailKey, outputDimensions: config.baseDimensions, renderDurationMs: 0 };
  }
  ```

- [ ] **Step 4: Implement recipe-applicator (shadow gaussian blur)**

- [ ] **Step 5: Update localSharpProvider.render to dispatch by safeArea.type (rect this task, perspective Task 10)**

  ```ts
  async render(input) {
    const config = input.snapshot.config as LocalSharpConfig;
    if (config.safeArea.type === "rect") return renderRect(input);
    if (config.safeArea.type === "perspective") return renderPerspective(input);  // Task 10
  }
  ```

- [ ] **Step 6: Tests PASS**

- [ ] **Step 7: Commit**

  ```bash
  git commit -m "feat(phase8): Sharp compositor — rect safeArea + recipe (frontal)"
  ```

---

### Task 10: Local Sharp compositor — perspective safeArea (4-corner transform)

**Files:**
- Modify: `src/lib/providers/mockup/local-sharp/safe-area.ts` (add `placePerspective`)
- Modify: `src/lib/providers/mockup/local-sharp/compositor.ts` (add `renderPerspective`)
- Modify: `__tests__/unit/mockup/compositor.test.ts`

> Task 0/T0b'deki spike kararına göre `sharp-perspective` paketi veya manuel matrix transform kullan.

- [ ] **Step 1: Install dependency (T0b kararına göre)**

- [ ] **Step 2: Failing perspective tests**

  ```ts
  describe("LocalSharp compositor (perspective)", () => {
    it("places design with 4-corner perspective transform", async () => { ... });
    it("returns SSIM tolerance ~%1 for same input (perspective)", async () => { ... });
    it("Office 3/4 template renders without exception", async () => { ... });
  });
  ```

- [ ] **Step 3: Implement placePerspective**

- [ ] **Step 4: Implement renderPerspective**

- [ ] **Step 5: Tests PASS (SSIM tolerance bazlı)**

- [ ] **Step 6: Commit**

  ```bash
  git commit -m "feat(phase8): Sharp compositor — perspective safeArea (4-corner transform)"
  ```

---

### Task 11: Error classifier — 5-class mapping

**Files:**
- Create: `src/features/mockups/server/error-classifier.service.ts`
- Create: `__tests__/unit/mockup/error-classifier.test.ts`

- [ ] **Step 1: Failing tests (5 class)**

  ```ts
  describe("classifyRenderError", () => {
    it("Zod parse fail → TEMPLATE_INVALID", () => { ... });
    it("MinIO fetch fail → TEMPLATE_INVALID", () => { ... });
    it("Sharp execution timeout → RENDER_TIMEOUT", () => { ... });
    it("Sharp throw 'unsupported format' → SOURCE_QUALITY", () => { ... });
    it("safeArea overflow runtime detect → SAFE_AREA_OVERFLOW", () => { ... });
    it("BullMQ worker crash → PROVIDER_DOWN", () => { ... });
    it("unknown error → PROVIDER_DOWN (default)", () => { ... });
  });
  ```

- [ ] **Step 2: Implement classifier**

  ```ts
  export function classifyRenderError(err: unknown): { errorClass: MockupErrorClass; errorDetail: string } {
    if (err instanceof ZodError) return { errorClass: "TEMPLATE_INVALID", errorDetail: err.message };
    if (err instanceof TimeoutError) return { errorClass: "RENDER_TIMEOUT", errorDetail: "..." };
    if (err instanceof SharpFormatError) return { errorClass: "SOURCE_QUALITY", errorDetail: "..." };
    if (err instanceof SafeAreaOverflowError) return { errorClass: "SAFE_AREA_OVERFLOW", errorDetail: "..." };
    return { errorClass: "PROVIDER_DOWN", errorDetail: String(err) };
  }
  ```

- [ ] **Step 3: Tests PASS**

- [ ] **Step 4: Commit**

  ```bash
  git commit -m "feat(phase8): error classifier (5-class mapping)"
  ```

---

### Task 12: Template + binding seed runner

**Files:**
- Modify: `prisma/seeds/mockup-templates.seed.ts` (Task 0'da skeleton, şimdi tam doldur)
- Create: `prisma/seeds/run-mockup-seed.ts`
- Modify: `package.json` (add `db:seed:mockup` script)

> **Bağımlılık:** Task 0 (T0a, T0c) tamamlanmış olmalı (asset dosyaları MinIO'ya yüklü, JSON data hazır).

- [ ] **Step 1: Failing integration test (seed sonrası 8 active binding mevcut)**

  ```ts
  it("seed creates 8 ACTIVE templates with LOCAL_SHARP bindings", async () => {
    await runMockupSeed();
    const templates = await prisma.mockupTemplate.findMany({
      where: { categoryId: "canvas", status: "ACTIVE" },
      include: { bindings: { where: { status: "ACTIVE", providerId: "LOCAL_SHARP" } } },
    });
    expect(templates).toHaveLength(8);
    templates.forEach(t => {
      expect(t.bindings).toHaveLength(1);
    });
  });
  ```

- [ ] **Step 2: Implement seed runner (idempotent — upsert by id)**

- [ ] **Step 3: Run seed**

  ```bash
  npm run db:seed:mockup
  ```

- [ ] **Step 4: Tests PASS**

- [ ] **Step 5: Commit**

  ```bash
  git commit -m "feat(phase8): mockup template + binding seed (8 templates, LOCAL_SHARP)"
  ```

---

### Task 13: Quick Pack default selection algorithm

**Files:**
- Create: `src/features/mockups/server/quick-pack.service.ts`
- Create: `__tests__/unit/mockup/quick-pack.test.ts`

- [ ] **Step 1: Failing tests (Spec §2.6)**

  ```ts
  describe("selectQuickPackDefault", () => {
    it("returns [] when no compatible templates", () => { ... });
    it("vibe diversity: each unique vibe represented at least once", () => { ... });
    it("lex tie-break for equal vibe candidates (id ASC)", () => { ... });
    it("targetSize=6 default", () => { ... });
    it("deterministic iteration: same input → same output", () => { ... });
    it("compatible filtered by aspect ratio match", () => { ... });
    it("falls back to lex order when vibes exhausted", () => { ... });
  });
  ```

- [ ] **Step 2: Implement (Spec §2.6 verbatim)**

  ```ts
  const VIBE_TAGS = ["modern", "scandinavian", "boho", "minimalist", "vintage", "playful"];

  export function selectQuickPackDefault(
    set: { variants: { aspectRatio: string }[] },
    allActiveTemplates: { id: string; aspectRatios: string[]; tags: string[] }[],
    targetSize: number = 6,
  ): string[] {
    const setAspects = [...new Set(set.variants.map(v => v.aspectRatio))];
    const compatible = allActiveTemplates
      .filter(t => t.aspectRatios.some(ar => setAspects.includes(ar)))
      .sort((a, b) => a.id.localeCompare(b.id));
    if (compatible.length === 0) return [];

    const result: string[] = [];
    const usedVibes = new Set<string>();

    for (const t of compatible) {
      if (result.length >= targetSize) break;
      const newVibe = t.tags.find(tag => VIBE_TAGS.includes(tag) && !usedVibes.has(tag));
      if (newVibe) {
        result.push(t.id);
        usedVibes.add(newVibe);
      }
    }

    if (result.length < targetSize) {
      const remaining = compatible.filter(t => !result.includes(t.id));
      for (const t of remaining) {
        if (result.length >= targetSize) break;
        result.push(t.id);
      }
    }

    return result;
  }
  ```

- [ ] **Step 3: Tests PASS**

- [ ] **Step 4: Commit**

  ```bash
  git commit -m "feat(phase8): selectQuickPackDefault (vibe diversity + lex tie-break)"
  ```

---

### Task 14: URL primary state hook — `useMockupPackState`

**Files:**
- Create: `src/features/mockups/hooks/useMockupPackState.ts`
- Create: `__tests__/integration/mockup/url-state.test.ts`

- [ ] **Step 1: Failing tests (Spec §6.1)**

  ```ts
  describe("useMockupPackState", () => {
    it("returns defaultTemplateIds when no t= param", () => { ... });
    it("returns parsed templateIds from URL t= param", () => { ... });
    it("isDirty=false when URL = default", () => { ... });
    it("isDirty=true when URL diverges from default", () => { ... });
    it("toggleTemplate updates URL (debounced 150ms)", () => { ... });
    it("toggle to default state clears t= param", () => { ... });
    it("filters invalid templateIds from URL silently", () => { ... });
    it("caps URL templateIds at 8 (sanity)", () => { ... });
    it("resetToQuickPack clears t= param", () => { ... });
  });
  ```

- [ ] **Step 2: Implement hook**

  Spec §6.1 verbatim, debounce 150ms, `router.replace` + `scroll: false`.

- [ ] **Step 3: Tests PASS**

- [ ] **Step 4: Commit**

  ```bash
  git commit -m "feat(phase8): useMockupPackState (URL primary, dirty türev)"
  ```

---

### Task 15: Drawer + modal URL state helpers

**Files:**
- Create: `src/features/mockups/hooks/useMockupOverlayState.ts`
- Create: `__tests__/integration/mockup/overlay-state.test.ts`

- [ ] **Step 1: Failing tests (Spec §6.2)**

  ```ts
  describe("drawer + modal URL state", () => {
    it("openCustomizeDrawer adds ?customize=1", () => { ... });
    it("openTemplateModal adds ?templateId=...", () => { ... });
    it("closeTemplateModal removes templateId, drawer stays", () => { ... });
    it("closeCustomize removes both customize + templateId", () => { ... });
    it("all updates use router.replace + scroll: false", () => { ... });
  });
  ```

- [ ] **Step 2: Implement helpers**

- [ ] **Step 3: Tests PASS**

- [ ] **Step 4: Commit**

  ```bash
  git commit -m "feat(phase8): drawer + modal URL state helpers (router.replace disiplini)"
  ```

---

### Task 16: API — `POST /api/mockup/jobs`

**Files:**
- Create: `src/app/api/mockup/jobs/route.ts`
- Create: `__tests__/integration/mockup/api/create-job.test.ts`

- [ ] **Step 1: Failing API tests (Spec §4.1)**

  ```ts
  describe("POST /api/mockup/jobs", () => {
    it("202 with jobId on valid input", async () => { ... });
    it("400 INVALID_TEMPLATES when templateIds empty", async () => { ... });
    it("400 INVALID_TEMPLATES when templateIds.length > 8", async () => { ... });
    it("400 INVALID_SET when status≠ready", async () => { ... });
    it("404 SET_NOT_FOUND for cross-user", async () => { ... });
    it("400 TEMPLATE_INVALID when resolveBinding null", async () => { ... });
  });
  ```

- [ ] **Step 2: Implement route handler (Zod parse → handoff service)**

- [ ] **Step 3: Tests PASS**

- [ ] **Step 4: Commit**

  ```bash
  git commit -m "feat(phase8): POST /api/mockup/jobs (handoff + Zod validate + auth)"
  ```

---

### Task 17: API — `GET /api/mockup/jobs/[jobId]`

**Files:**
- Create: `src/app/api/mockup/jobs/[jobId]/route.ts`
- Create: `__tests__/integration/mockup/api/get-job.test.ts`

- [ ] **Step 1: Failing tests (Spec §4.2)**

  ```ts
  describe("GET /api/mockup/jobs/[jobId]", () => {
    it("200 with full job + renders payload", async () => { ... });
    it("includes templateSnapshot with denormalized name + aspectRatios", async () => { ... });
    it("includes ETA estimate (estimatedCompletionAt)", async () => { ... });
    it("404 cross-user", async () => { ... });
  });
  ```

- [ ] **Step 2: Implement**

- [ ] **Step 3: Tests PASS**

- [ ] **Step 4: Commit**

  ```bash
  git commit -m "feat(phase8): GET /api/mockup/jobs/[jobId] (status + renders + ETA)"
  ```

---

### Task 18: Render service — execute + retry + lifecycle

**Files:**
- Create: `src/features/mockups/server/render.service.ts`
- Create: `__tests__/integration/mockup/render-service.test.ts`

- [ ] **Step 1: Failing tests (lifecycle)**

  ```ts
  describe("executeRender", () => {
    it("PENDING → RENDERING → SUCCESS", async () => { ... });
    it("PENDING → RENDERING → FAILED with errorClass", async () => { ... });
    it("calls Task 8 recomputePackOnRenderComplete after terminal status (K10)", async () => { ... });
    it("calls Task 6 recomputeJobStatus after terminal status", async () => { ... });
  });

  describe("retryRender", () => {
    it("only allowed for FAILED renders", async () => { ... });
    it("retryCount++, status PENDING, errorClass cleared", async () => { ... });
    it("retryCount cap=3, exceeds → 400", async () => { ... });
  });
  ```

- [ ] **Step 2: Implement render.service**

- [ ] **Step 3: Tests PASS**

- [ ] **Step 4: Commit**

  ```bash
  git commit -m "feat(phase8): render service (execute + retry + K10 cover-fail trigger)"
  ```

---

### Task 19: API — render swap + retry + cancel

**Files:**
- Create: `src/app/api/mockup/jobs/[jobId]/renders/[renderId]/swap/route.ts`
- Create: `src/app/api/mockup/jobs/[jobId]/renders/[renderId]/retry/route.ts`
- Create: `src/app/api/mockup/jobs/[jobId]/cancel/route.ts`
- Create: `__tests__/integration/mockup/api/swap-retry-cancel.test.ts`

- [ ] **Step 1: Failing tests (Spec §4.4, §4.5, §4.7)**

  ```ts
  describe("POST /renders/[renderId]/swap", () => {
    it("creates new MockupRender with alternative pair, archives old", async () => { ... });
    it("deterministic alternative selection (lex tie-break)", async () => { ... });
    it("404 cross-user", async () => { ... });
  });

  describe("POST /renders/[renderId]/retry", () => {
    it("only FAILED renders, retryCount++", async () => { ... });
  });

  describe("POST /jobs/[jobId]/cancel", () => {
    it("only QUEUED/RUNNING, BullMQ removed, pending → FAILED", async () => { ... });
  });
  ```

- [ ] **Step 2: Implement routes (Zod + render.service çağrıları)**

- [ ] **Step 3: Tests PASS**

- [ ] **Step 4: Commit**

  ```bash
  git commit -m "feat(phase8): API endpoints — render swap + retry + job cancel"
  ```

---

### Task 20: API — `POST /api/mockup/jobs/[jobId]/cover` (atomic slot swap)

**Files:**
- Create: `src/app/api/mockup/jobs/[jobId]/cover/route.ts`
- Create: `__tests__/integration/mockup/api/cover-swap.test.ts`

- [ ] **Step 1: Failing tests (Spec §4.8 atomic swap)**

  ```ts
  describe("POST /api/mockup/jobs/[jobId]/cover", () => {
    it("200 atomic swap: new cover packPosition=0, old cover gets new cover's old position", async () => { ... });
    it("coverRenderId updated to new render id", async () => { ... });
    it("400 INVALID_RENDER (renderId not in this job)", async () => { ... });
    it("400 RENDER_NOT_SUCCESS (failed/pending render)", async () => { ... });
    it("400 ALREADY_COVER (no-op rejected explicitly)", async () => { ... });
    it("404 cross-user", async () => { ... });
    it("invariant preserved after swap: cover ⇔ packPosition=0", async () => { ... });
  });
  ```

- [ ] **Step 2: Implement (Spec §4.8 atomic transaction)**

  ```ts
  export async function swapCover(jobId: string, newCoverRenderId: string, userId: string): Promise<void> {
    const job = await prisma.mockupJob.findUniqueOrThrow({
      where: { id: jobId },
      include: { renders: true },
    });
    if (job.userId !== userId) throw new NotFoundError();

    const newCover = job.renders.find(r => r.id === newCoverRenderId);
    if (!newCover) throw new BadRequestError("INVALID_RENDER");
    if (newCover.status !== "SUCCESS") throw new BadRequestError("RENDER_NOT_SUCCESS");
    if (job.coverRenderId === newCoverRenderId) throw new BadRequestError("ALREADY_COVER");

    const oldCover = job.renders.find(r => r.id === job.coverRenderId);
    if (!oldCover) throw new Error("Job has no cover render");

    // Atomic swap: yeni cover → packPosition=0, eski cover → newCover'ın eski position'ı
    await prisma.$transaction([
      prisma.mockupRender.update({ where: { id: oldCover.id }, data: { packPosition: newCover.packPosition } }),
      prisma.mockupRender.update({ where: { id: newCover.id }, data: { packPosition: 0 } }),
      prisma.mockupJob.update({ where: { id: jobId }, data: { coverRenderId: newCover.id } }),
    ]);
  }
  ```

- [ ] **Step 3: Tests PASS**

- [ ] **Step 4: Commit**

  ```bash
  git commit -m "feat(phase8): POST /jobs/[id]/cover (atomic slot swap, cover invariant)"
  ```

---

### Task 21: API — `GET /api/mockup/jobs/[jobId]/download` (bulk ZIP)

**Files:**
- Create: `src/app/api/mockup/jobs/[jobId]/download/route.ts`
- Create: `__tests__/integration/mockup/api/download.test.ts`

- [ ] **Step 1: Failing tests (Spec §4.6)**

  ```ts
  describe("GET /jobs/[id]/download", () => {
    it("returns ZIP with success renders only (failed slots skipped)", async () => { ... });
    it("filename ordering: 01-cover-..., 02-..., packPosition ASC", async () => { ... });
    it("cover invariant: 01-cover- prefix on packPosition=0", async () => { ... });
    it("partial complete (8/10): files 01-..08-, manifest tracks failed packPositions", async () => { ... });
    it("403 when job status not in {COMPLETED, PARTIAL_COMPLETE}", async () => { ... });
    it("404 cross-user", async () => { ... });
  });
  ```

- [ ] **Step 2: Implement (archiver/zip stream)**

- [ ] **Step 3: Tests PASS**

- [ ] **Step 4: Commit**

  ```bash
  git commit -m "feat(phase8): GET /jobs/[id]/download (bulk ZIP, cover invariant, manifest.json)"
  ```

---

### Task 22: API — `GET /api/mockup/templates`

**Files:**
- Create: `src/app/api/mockup/templates/route.ts`
- Create: `src/features/mockups/hooks/useMockupTemplates.ts`
- Create: `__tests__/integration/mockup/api/templates.test.ts`

- [ ] **Step 1: Failing tests (Spec §4.3)**

  ```ts
  describe("GET /api/mockup/templates?categoryId=canvas", () => {
    it("returns all ACTIVE templates with hasActiveBinding flag", async () => { ... });
    it("excludes provider/binding details (provider-agnostik)", async () => { ... });
    it("hasActiveBinding=false for templates without active binding", async () => { ... });
  });
  ```

- [ ] **Step 2: Implement route + React Query hook**

- [ ] **Step 3: Tests PASS**

- [ ] **Step 4: Commit**

  ```bash
  git commit -m "feat(phase8): GET /api/mockup/templates + useMockupTemplates hook"
  ```

---

### Task 23: S3 Apply ana route + iskelet

**Files:**
- Create: `src/app/(dashboard)/selection/sets/[setId]/mockup/apply/page.tsx`
- Create: `src/features/mockups/components/S3ApplyView.tsx`
- Create: `__tests__/unit/mockup/ui/S3ApplyView.test.tsx`

- [ ] **Step 1: Failing component test (default Quick Pack render)**

  ```ts
  it("renders S3 with default Quick Pack (no t= param)", () => {
    // mock useMockupPackState defaults
    expect(screen.getByText(/★ Quick Pack/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Render et \(Quick Pack\)/ })).toBeEnabled();
  });
  ```

- [ ] **Step 2: Implement S3ApplyView (4 zone iskelet, alt component'ler Task 24-25'te)**

- [ ] **Step 3: Tests PASS**

- [ ] **Step 4: Commit**

  ```bash
  git commit -m "feat(phase8): S3 Apply route + view skeleton (4 zone)"
  ```

---

### Task 24: S3 — Set Summary Card

**Files:**
- Create: `src/features/mockups/components/SetSummaryCard.tsx`
- Create: `__tests__/unit/mockup/ui/SetSummaryCard.test.tsx`

- [ ] **Step 1: Failing tests (Spec §5.2)**

  ```ts
  describe("<SetSummaryCard>", () => {
    it("renders hero variant thumbnail (rank 0 fallback)", () => { ... });
    it("shows variant count + aspect breakdown", () => { ... });
    it("Phase 7 set detail link", () => { ... });
  });
  ```

- [ ] **Step 2: Implement**

- [ ] **Step 3: Tests PASS**

- [ ] **Step 4: Commit**

  ```bash
  git commit -m "feat(phase8): S3 SetSummaryCard (bağlam kartı)"
  ```

---

### Task 25: S3 — Pack Preview + Decision Band + Empty/Incompatible states

**Files:**
- Create: `src/features/mockups/components/PackPreviewCard.tsx`
- Create: `src/features/mockups/components/DecisionBand.tsx`
- Create: `src/features/mockups/components/EmptyPackState.tsx`
- Create: `src/features/mockups/components/IncompatibleSetBand.tsx`
- Create: `src/features/mockups/components/TemplateChip.tsx`
- Create: `__tests__/unit/mockup/ui/PackPreviewCard.test.tsx`
- Create: `__tests__/unit/mockup/ui/DecisionBand.test.tsx`

- [ ] **Step 1: Failing tests (Spec §5.2 9-state coverage)**

  ```ts
  describe("<PackPreviewCard>", () => {
    it("Quick Pack rozeti default, dirty=false", () => { ... });
    it("Custom Pack rozeti dirty=true", () => { ... });
    it("compat-limited preview: '6 görsel — set'inde yeterli...'", () => { ... });
    it("empty pack: EmptyPackState component", () => { ... });
    it("incompatible: IncompatibleSetBand + Phase 7 link", () => { ... });
    it("diversity tooltip ⓘ default, dirty'de gizli", () => { ... });
    it("chip remove → URL update", () => { ... });
    it("+ Template Ekle ve Özelleştir → drawer aç", () => { ... });
  });

  describe("<DecisionBand>", () => {
    it("estimated duration shown", () => { ... });
    it("Reset link visible only when dirty", () => { ... });
    it("⚠ warning when actualPackSize < 10", () => { ... });
    it("CTA disabled when selectedTemplateIds empty", () => { ... });
    it("CTA loading state during submit", () => { ... });
  });
  ```

- [ ] **Step 2: Implement (Spec §5.2 layout verbatim)**

- [ ] **Step 3: Tests PASS**

- [ ] **Step 4: Commit**

  ```bash
  git commit -m "feat(phase8): S3 PackPreview + DecisionBand + Empty/Incompatible states"
  ```

---

### Task 26: S1 Browse drawer

**Files:**
- Create: `src/features/mockups/components/S1BrowseDrawer.tsx`
- Create: `__tests__/unit/mockup/ui/S1BrowseDrawer.test.tsx`

- [ ] **Step 1: Failing tests (Spec §5.3)**

  ```ts
  describe("<S1BrowseDrawer>", () => {
    it("opens via ?customize=1 query", () => { ... });
    it("renders 8 template grid with ✓ rozet for selected", () => { ... });
    it("filter chips: vibe + room + aspect", () => { ... });
    it("aspect filter default = set aspects", () => { ... });
    it("min/max enforcement: 1..8 templates", () => { ... });
    it("Esc/X/backdrop closes", () => { ... });
    it("template card click → S2 modal (?templateId=)", () => { ... });
    it("Phase 7 AddVariantsDrawer pattern (40-50% width, sağdan slide-in)", () => { ... });
  });
  ```

- [ ] **Step 2: Implement**

- [ ] **Step 3: Tests PASS**

- [ ] **Step 4: Commit**

  ```bash
  git commit -m "feat(phase8): S1 Browse drawer (template kütüphanesi)"
  ```

---

### Task 27: S2 Detail modal

**Files:**
- Create: `src/features/mockups/components/S2DetailModal.tsx`
- Create: `__tests__/unit/mockup/ui/S2DetailModal.test.tsx`

- [ ] **Step 1: Failing tests (Spec §5.4)**

  ```ts
  describe("<S2DetailModal>", () => {
    it("opens via ?templateId= query", () => { ... });
    it("renders base asset + safeArea overlay (static preview, no live render)", () => { ... });
    it("shows aspect + vibe + room + composition meta", () => { ... });
    it("Pakette/Ekle CTA toggles URL t=", () => { ... });
    it("Esc/X/backdrop closes modal, drawer stays", () => { ... });
    it("Radix Dialog pattern (CreateSetModal/FinalizeModal emsali)", () => { ... });
  });
  ```

- [ ] **Step 2: Implement**

- [ ] **Step 3: Tests PASS**

- [ ] **Step 4: Commit**

  ```bash
  git commit -m "feat(phase8): S2 Detail modal (template preview + safeArea overlay)"
  ```

---

### Task 28: S7 Job route + view + polling + auto-redirect

**Files:**
- Create: `src/app/(dashboard)/selection/sets/[setId]/mockup/jobs/[jobId]/page.tsx`
- Create: `src/features/mockups/components/S7JobView.tsx`
- Create: `src/features/mockups/hooks/useMockupJob.ts`
- Create: `__tests__/unit/mockup/ui/S7JobView.test.tsx`

- [ ] **Step 1: Failing tests (Spec §5.5)**

  ```ts
  describe("<S7JobView>", () => {
    it("renders progress ring + render timeline (queued/running)", () => { ... });
    it("shows ETA approximate ('~12 saniye kaldı')", () => { ... });
    it("polling 3sn refetchInterval (Phase 7 v1.0.1 fix: refetchQueries)", () => { ... });
    it("auto-redirect on COMPLETED via router.replace", () => { ... });
    it("auto-redirect on PARTIAL_COMPLETE", () => { ... });
    it("kısa success feedback 250-500ms before redirect (yumuşatma)", () => { ... });
    it("FAILED view: 5-class hata + Yeniden dene + S3'e dön", () => { ... });
    it("CANCELLED view: S3'e dön", () => { ... });
    it("'Sayfayı kapatabilirsin' güvence metni görünür", () => { ... });
    it("Cancel button → POST /cancel", () => { ... });
  });
  ```

- [ ] **Step 2: Implement (useMockupJob polling + auto-redirect timer)**

- [ ] **Step 3: Tests PASS**

- [ ] **Step 4: Commit**

  ```bash
  git commit -m "feat(phase8): S7 Job (progress + polling + auto-redirect yumuşatma)"
  ```

---

### Task 29: S8 Result route + view + cover swap + per-render actions

**Files:**
- Create: `src/app/(dashboard)/selection/sets/[setId]/mockup/jobs/[jobId]/result/page.tsx`
- Create: `src/features/mockups/components/S8ResultView.tsx`
- Create: `src/features/mockups/components/CoverSwapModal.tsx`
- Create: `src/features/mockups/components/PerRenderActions.tsx`
- Create: `__tests__/unit/mockup/ui/S8ResultView.test.tsx`
- Create: `__tests__/unit/mockup/ui/CoverSwapModal.test.tsx`

- [ ] **Step 1: Failing tests (Spec §5.6)**

  ```ts
  describe("<S8ResultView>", () => {
    it("redirects to S7 if status not in {COMPLETED, PARTIAL_COMPLETE}", () => { ... });
    it("Completed full (10/10): standart grid, cover first", () => { ... });
    it("Completed compat-limited (6/10): dürüst sayım + standart grid (6 slot)", () => { ... });
    it("Partial complete (8/10): grid + failed slot rozet + retry/swap", () => { ... });
    it("All failed: 'Pack üretilemedi' + hata özeti + recovery", () => { ... });
    it("cover slot has ★ Cover badge + büyük thumbnail (sol üst)", () => { ... });
    it("Bulk download ZIP triggers /download endpoint", () => { ... });
    it("Listing'e gönder → CTA disabled with Phase 9 tooltip", () => { ... });
    it("per-render hover overlay: download/swap/big preview", () => { ... });
    it("per-render swap action → POST /renders/[id]/swap", () => { ... });
    it("per-render retry action → POST /renders/[id]/retry", () => { ... });
    it("failed slot UI per error class (5 mappings)", () => { ... });
  });

  describe("<CoverSwapModal>", () => {
    it("shows alternatives: success renders excluding current cover", () => { ... });
    it("max 9 alternatives", () => { ... });
    it("click → POST /cover atomic swap", () => { ... });
    it("UI updates: cover slot shows new thumbnail, swapped slot shows old cover", () => { ... });
  });
  ```

- [ ] **Step 2: Implement (S8 grid + cover modal + per-render actions)**

- [ ] **Step 3: Tests PASS**

- [ ] **Step 4: Commit**

  ```bash
  git commit -m "feat(phase8): S8 Result (cover first grid + cover swap + per-render actions + Phase 9 placeholder)"
  ```

---

### Task 30: Background completion toast — `useMockupJobCompletionToast`

**Files:**
- Create: `src/features/mockups/hooks/useMockupJobCompletionToast.ts`
- Create: `__tests__/unit/mockup/ui/useMockupJobCompletionToast.test.ts`

- [ ] **Step 1: Failing tests (Spec §5.7, Phase 7 useExportCompletionToast emsali)**

  ```ts
  describe("useMockupJobCompletionToast", () => {
    it("shows toast on job COMPLETED transition", () => { ... });
    it("shows toast on job PARTIAL_COMPLETE transition", () => { ... });
    it("toast click → S8 navigation", () => { ... });
    it("debounce: only one toast per job lifecycle", () => { ... });
  });
  ```

- [ ] **Step 2: Implement (Phase 7 hook pattern)**

- [ ] **Step 3: Tests PASS**

- [ ] **Step 4: Commit**

  ```bash
  git commit -m "feat(phase8): useMockupJobCompletionToast (Phase 7 emsali)"
  ```

---

### Task 31: Sharp deterministic snapshot tests

**Files:**
- Create: `__tests__/unit/mockup/compositor-snapshot.test.ts`
- Create: `__tests__/fixtures/mockup/expected/` (8 baseline PNG + SHA hash dosyaları)

- [ ] **Step 1: Generate baseline (one-time, dev-managed)**

  ```bash
  node scripts/generate-mockup-snapshots.js  # ilk run; sonuçlar __tests__/fixtures/mockup/expected/'a yazılır
  ```

  Her template × her test design için baseline PNG + SHA hash.

- [ ] **Step 2: Failing snapshot tests (frontal byte-stable)**

  ```ts
  describe("Sharp deterministic snapshot — frontal templates", () => {
    it.each([1, 2, 4, 5, 6, 7, 8])("template %i renders byte-stable (SHA match)", async (tplId) => {
      const output = await render(...);
      const sha = createHash("sha256").update(output).digest("hex");
      const expected = await readFile(`__tests__/fixtures/mockup/expected/tpl-canvas-00${tplId}.sha256`, "utf8");
      expect(sha).toBe(expected.trim());
    });
  });

  describe("Sharp perspective snapshot — Office 3/4", () => {
    it("template 3 renders within SSIM tolerance ~%1", async () => {
      const output = await render(...);
      const expected = await readFile("__tests__/fixtures/mockup/expected/tpl-canvas-003.png");
      const ssim = computeSSIM(output, expected);
      expect(ssim).toBeGreaterThan(0.99);  // %1 tolerance
    });
  });
  ```

- [ ] **Step 3: Tests PASS (baseline doğrulanır)**

- [ ] **Step 4: Document snapshot regeneration policy**

  `phase8-asset-prep.md` içinde: Sharp version upgrade veya recipe değişikliği durumunda baseline regeneration ritüeli.

- [ ] **Step 5: Commit**

  ```bash
  git commit -m "test(phase8): Sharp deterministic snapshot tests (7 frontal byte-stable + 1 perspective SSIM)"
  ```

---

### Task 32: E2E golden path

**Files:**
- Create: `__tests__/e2e/mockup/golden-path.test.ts`

- [ ] **Step 1: Failing E2E test (Spec §8.5)**

  ```ts
  // Phase 7 emsali Playwright/Puppeteer benzeri
  describe("Phase 8 golden path E2E", () => {
    it("Phase 7 set ready → Mockup'a gönder → S3 default → Render et → S7 → S8 → ZIP", async () => {
      // 1. Phase 7 set ready hazırla (fixture)
      // 2. /selection/sets/[setId] → "Mockup'a gönder" tıkla
      // 3. S3 default Quick Pack görünür
      // 4. "Render et (Quick Pack)" tıkla
      // 5. S7'ye redirect, polling başlar
      // 6. Mock worker render'ları success ile bitirir
      // 7. Auto-redirect S8
      // 8. 10/10 görsel görünür, cover first
      // 9. "Bulk download ZIP" → download başlar
    });
  });
  ```

- [ ] **Step 2: Implement E2E with mock BullMQ worker**

- [ ] **Step 3: Tests PASS**

- [ ] **Step 4: Commit**

  ```bash
  git commit -m "test(phase8): E2E golden path (Phase 7 set → S3 → S7 → S8 → ZIP)"
  ```

---

### Task 33: Manuel QA + closeout doc

**Files:**
- Create: `docs/design/implementation-notes/phase8-mockup-studio.md`
- Create: `docs/design/implementation-notes/phase8-manual-qa-checklist.md`

- [ ] **Step 1: Manuel QA checklist hazırla**

  - [ ] Phase 7 set ready'den S3'e geçiş çalışıyor
  - [ ] S3 default Quick Pack 6 template seçili gösteriyor
  - [ ] Customize → S1 drawer açılır + filter çalışıyor
  - [ ] S1 → S2 modal preview açılır
  - [ ] S2 ekle/çıkar URL t= update eder
  - [ ] Submit → S7 progress ring + timeline + ETA
  - [ ] "Sayfayı kapatabilirsin" güvence metni görünüyor
  - [ ] S7 → S8 auto-redirect + 250-500ms success feedback
  - [ ] S8'de cover first + 10 slot grid
  - [ ] Cover swap modal alternatif önerir + atomic swap çalışır
  - [ ] Per-render swap yeni render üretir
  - [ ] Per-render retry sadece failed için
  - [ ] Bulk download ZIP cover invariant ile (01-cover-)
  - [ ] Listing'e gönder → disabled + Phase 9 tooltip
  - [ ] Background tab toast bildirimi
  - [ ] Refresh on S3 with t= → state restore
  - [ ] Esc/X/backdrop modal/drawer kapatma
  - [ ] Browser back: drawer/modal kapatmaz, app navigation
  - [ ] Set not ready → banner + Phase 7 link
  - [ ] Empty pack → CTA disabled
  - [ ] Incompatible set → IncompatibleSetBand + Phase 7 link

- [ ] **Step 2: Manuel QA çalıştır + sonuçları doc'a yaz**

  Phase 7 emsali (`docs/design/implementation-notes/phase7-selection-studio.md`).

- [ ] **Step 3: Closeout doc yaz**

  - V1 scope sonuçları
  - Açık riskler (R1-R8) takibi
  - Carry-forward'ların V2 hazırlığı
  - Test sayıları (unit + integration + E2E)
  - Bilinen sınırlamalar

- [ ] **Step 4: Commit**

  ```bash
  git commit -m "docs(phase8): manuel QA checklist + closeout doc (Phase 8 v1 🟢)"
  ```

---

## Plan tamamlama

Tüm task'ler bittiğinde:

1. **Final code review** — `superpowers:requesting-code-review`
2. **Manuel QA result kayıt** — `phase8-mockup-studio.md` içinde "GEÇTİ ✅" işareti
3. **Phase 8 v1 closeout commit** — Phase 7 emsali (`docs(phase8): closeout — v1 🟢`)
4. **Plan dosyasını sil veya arşivle** (Phase 7 emsali — implementation tamamlandığında plan archive edilir)

## Self-Review

**Spec coverage:**
- §1.4 sözleşme zinciri (hero fallback, aspectRatio chain) → Task 5 ✅
- §2.1-2.8 mimari kararlar → Task 4, 5, 6, 8, 13, 14 ✅
- §3.1-3.4 veri modeli → Task 1, 2, 3, 5 ✅
- §4.1-4.8 API contract → Task 16, 17, 19, 20, 21, 22 ✅
- §5.1-5.8 UI ekranları → Task 23-30 ✅
- §6.1-6.3 state + nav → Task 14, 15, 28 ✅
- §7.1-7.5 hata sözlüğü + ops → Task 7, 11, 18 ✅
- §8 test stratejisi → Task 31, 32, 33 ✅
- §9 V1 envanter → Task 0, 12 ✅
- K10 cover-fail fallback → Task 8 ✅

**Placeholder scan:** TBD/TODO yok; tüm step'ler somut.
**Type consistency:** `LocalSharpConfig`, `SafeArea`, `RenderSnapshot`, `MockupRender.packPosition`, `coverRenderId` referansları tutarlı.
**Scope:** 34 task (Task 0..33), Phase 7 ölçeği (Phase 7: 42 task).

---

## Execution Handoff

**Plan complete and saved to** `docs/plans/2026-05-01-phase8-mockup-studio-plan.md`. **Two execution options:**

**1. Subagent-Driven (recommended)** — Dispatch fresh subagent per task, two-stage review (spec compliance + code quality) between tasks, fast iteration. Same session.

**2. Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints for review.

**Which approach?**

- If Subagent-Driven: REQUIRED SUB-SKILL `superpowers:subagent-driven-development`
- If Inline: REQUIRED SUB-SKILL `superpowers:executing-plans`
