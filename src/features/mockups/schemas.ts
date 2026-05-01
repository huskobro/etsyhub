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
// - V1 categoryId sadece "canvas" (z.literal); V2'de z.enum olur.
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

// ── API request body schemas ────────────────────────────────────────────

// Spec §4.1 POST /api/mockup/jobs body
export const CreateJobBodySchema = z.object({
  setId: z.string().min(1),
  categoryId: z.literal("canvas"), // V1: tek kategori
  templateIds: z.array(z.string()).min(1).max(8),
});

// Spec §4.8 POST /api/mockup/jobs/[jobId]/cover body
export const CoverSwapBodySchema = z.object({
  renderId: z.string().min(1),
});
