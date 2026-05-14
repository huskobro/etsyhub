// Phase 8 Task 3 — Zod runtime validation schemas.
//
// Spec §3.2 LocalSharpConfig + SafeArea + Recipe runtime guard.
// Task 2 TypeScript types ile birebir paralel; type assertion uyumlu.
//
// Provider-config validation (LocalSharpConfigSchema) MockupRender worker
// pre-render parse zorunlu (Task 9+); fail = TEMPLATE_INVALID hata sınıfı.
// API body validation (CreateJobBodySchema, CoverSwapBodySchema) route
// handler input guard (Task 16, 20).
//
// Disiplin:
// - Task 2 types otoriter. Zod schema'lar parse guard rolü.
// - z.infer<> ile type re-export YOK; consumer'lar Task 2 types kullanır.
// - **V2 (HEAD `5eabffc`+):** categoryId artık 8-değer enum (Phase 1 ProductType
//   key'leriyle birebir uyumlu — canvas, wall_art, printable, clipart, sticker,
//   tshirt, hoodie, dtf). MockupCategorySchema dışındaki bir değer reject
//   edilir. Backward-compat: V1 sadece "canvas" template seed'lediği için
//   Apply page diğer kategorilerde (`templates.length === 0`) boş gösterir;
//   admin sonradan asset prep ile sticker/wall_art/poster vb. seed
//   ekleyebilir. Spec §1.3 V2 carry-forward listesinden V2'e açıldı.
// - SafeArea normalize 0..1 (base asset top-left origin).
// - coverPriority snapshot'a sızmaz; render sonrası ayrı katalog metadata.

import { z } from "zod";

// ── Recipe primitives ────────────────────────────────────────────────────

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

// ── SafeArea discriminated union ────────────────────────────────────────

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

// ── Provider configs ────────────────────────────────────────────────────

/**
 * Phase 72 — Multi-slot capability.
 *
 * Mockup template şu güne kadar tek `safeArea` field'ı taşıyordu —
 * single design slot. "9-up sticker sheet", "bundle preview", "front +
 * back garment" gibi yüzeyler hep tek render output'a sıkışıyordu.
 *
 * Phase 72 modeli:
 *   - `safeArea` field'ı KORUNUR (legacy single-slot template'ler bozulmaz;
 *     backend Phase 8 render path'i hiç değişmez)
 *   - YENİ opsiyonel `slots[]` field — multi-slot author edilen template'ler
 *     için
 *   - Her slot kendi safeArea (rect veya perspective) + opsiyonel name
 *   - Min 1, max 12 slot
 *
 * Render execution backward-compat:
 *   - `slots` yoksa → backend `safeArea`'yı kullanır (Phase 8 baseline)
 *   - `slots` varsa → Phase 73+ candidate (multi-design assignment +
 *     composite layer order). Phase 72 yalnız authoring + persist + UI
 *     preview seviyesinde duruyor; render execution değişmedi.
 */
export const SlotConfigSchema = z.object({
  /** Stable slot id (cuid generated client/server). */
  id: z.string().min(1),
  /** Optional operator-facing label (e.g., "Cover", "Back", "Slot 1"). */
  name: z.string().max(40).optional(),
  /** Slot geometry — rect or perspective, schema parity with safeArea. */
  safeArea: SafeAreaSchema,
});

export const LocalSharpConfigSchema = z.object({
  providerId: z.literal("local-sharp"),
  baseAssetKey: z.string().min(1),
  baseDimensions: z.object({
    w: z.number().int().positive(),
    h: z.number().int().positive(),
  }),
  safeArea: SafeAreaSchema,
  /** Phase 72 — Optional multi-slot list. Backward-compat: legacy templates
   *  use `safeArea` only. New templates can opt-in to multi-slot authoring;
   *  render execution honors `slots` once Phase 73+ pipeline lands. */
  slots: z.array(SlotConfigSchema).min(1).max(12).optional(),
  recipe: MockupRecipeSchema,
  coverPriority: z.number().min(0).max(100),
});

// V2 contract-ready stub schema. V1'de hiç parse edilmez (binding yok)
// ama interface compliance için tanımlı.
export const DynamicMockupsConfigSchema = z.object({
  providerId: z.literal("dynamic-mockups"),
  externalTemplateId: z.string().min(1),
  smartObjectOptions: z.record(z.unknown()).optional(),
  safeAreaHint: SafeAreaSchema.optional(),
});

export const ProviderConfigSchema = z.discriminatedUnion("providerId", [
  LocalSharpConfigSchema,
  DynamicMockupsConfigSchema,
]);

// ── Mockup category enum (V2) ───────────────────────────────────────────

/**
 * Mockup kategori enum'u — Phase 1 ProductType.key değerleriyle birebir
 * uyumlu (CLAUDE.md product types listesi). V1'de sadece "canvas" seed'lendi
 * (admin asset prep); V2'de admin diğer kategorilerde de template seed
 * ekleyebilir (sticker, wall_art, poster vb.) — schema/API/UI değişikliği
 * gerekmez.
 *
 * MockupTemplate.categoryId DB'de zaten string; biz sadece runtime guard
 * yapıyoruz. Bilinmeyen kategori → ValidationError.
 */
export const MOCKUP_CATEGORY_VALUES = [
  "canvas",
  "wall_art",
  "printable",
  "clipart",
  "sticker",
  "tshirt",
  "hoodie",
  "dtf",
] as const;

export const MockupCategorySchema = z.enum(MOCKUP_CATEGORY_VALUES);
export type MockupCategoryId = z.infer<typeof MockupCategorySchema>;

// ── API request body schemas ────────────────────────────────────────────

// Spec §4.1 POST /api/mockup/jobs body — V2 enum (V1 hardcoded "canvas"
// genişletildi; backward-compat: "canvas" hâlâ valid, diğer 7 kategori de
// kabul edilir).
export const CreateJobBodySchema = z.object({
  setId: z.string().min(1),
  categoryId: MockupCategorySchema,
  templateIds: z.array(z.string()).min(1).max(8),
});

// Spec §4.8 POST /api/mockup/jobs/[jobId]/cover body
export const CoverSwapBodySchema = z.object({
  renderId: z.string().min(1),
});
