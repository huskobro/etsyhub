// Phase 8 — Provider config types + render snapshot sözleşmeleri
//
// Spec §3.2: LocalSharpConfig (V1 aktif) + DynamicMockupsConfig (V2 contract-ready stub).
// Spec §3.3: RenderSnapshot byte-stable JSON, coverPriority dışlı snapshot.
//
// Mimari:
//   - SafeArea discriminated union: rect | perspective
//   - MockupRecipe minimal (blendMode + optional shadow)
//   - LocalSharpConfig: providerId="local-sharp", baseAsset, geometry, recipe, coverPriority
//   - DynamicMockupsConfig: providerId="dynamic-mockups", externalTemplateId, smartObjectOptions, safeAreaHint
//   - RenderSnapshot: template + binding metadata + denormalized config (coverPriority omitted)
//
// Disiplin:
//   - SafeArea normalize 0..1 (base asset top-left origin)
//   - coverPriority catalog metadata (selection algoritması); snapshot'a sızmaz
//   - RenderSnapshot.providerId Prisma enum string repr ("LOCAL_SHARP" | "DYNAMIC_MOCKUPS")
//   - LocalSharpConfig.providerId TypeScript literal ("local-sharp" kebab-case)

// ────────────────────────────────────────────────────────────
// Safe Area — Geometry discriminated union
// ────────────────────────────────────────────────────────────

export type SafeAreaRect = {
  type: "rect";
  // Normalize 0..1, base asset top-left origin
  x: number;
  y: number;
  w: number;
  h: number;
  // Optional rotation degrees (default 0)
  rotation?: number;
};

export type SafeAreaPerspective = {
  type: "perspective";
  // Sıra: top-left, top-right, bottom-right, bottom-left (clockwise from TL)
  // Normalize 0..1
  corners: [
    [number, number],
    [number, number],
    [number, number],
    [number, number]
  ];
};

export type SafeArea = SafeAreaRect | SafeAreaPerspective;

// ────────────────────────────────────────────────────────────
// Recipe — Compositing minimal
// ────────────────────────────────────────────────────────────

export type ShadowSpec = {
  // px (base asset koordinatı, normalize değil)
  offsetX: number;
  offsetY: number;
  // gaussian blur radius px
  blur: number;
  // opacity 0..1
  opacity: number;
};

export type MockupRecipe = {
  blendMode: "normal" | "multiply" | "screen";
  // Optional shadow (V1 minimal)
  shadow?: ShadowSpec;
};

// ────────────────────────────────────────────────────────────
// Provider Config — Discriminated Union
// ────────────────────────────────────────────────────────────

// V1 aktif provider config
/** Phase 72/74 — Multi-slot capability.
 *  Tek slot'lu template'ler için `slots` field yoktur; `safeArea` çağrılır
 *  (Phase 8 baseline backward-compat). Multi-slot template'lerde `slots[]`
 *  set edilir; compositor.ts her slot için ayrı placement + sequential
 *  composite uygular (Phase 74). */
export type SlotConfig = {
  /** Stable slot id (cuid-like) */
  id: string;
  /** Optional operator-facing label ("Cover", "Back", "Tile 1") */
  name?: string;
  /** Slot geometry — rect or perspective, schema parity with safeArea */
  safeArea: SafeArea;
};

export type LocalSharpConfig = {
  // ProviderId literal: "local-sharp" (kebab-case, TypeScript string literal)
  providerId: "local-sharp";

  // Asset
  // MinIO versionlı yol
  baseAssetKey: string;
  // base asset px dimensions
  baseDimensions: { w: number; h: number };

  // Geometry (discriminated union safeArea.type ile).
  // Legacy single-slot field — Phase 8 baseline. Always populated.
  safeArea: SafeArea;

  // Phase 72 — Optional multi-slot list. Phase 74 compositor uses this
  // (if non-empty) instead of `safeArea`; sequential composite per slot.
  slots?: SlotConfig[];

  // Compositing davranışı (minimal — spec §3.2 kararı)
  recipe: MockupRecipe;

  // Cover priority — selection algoritması için catalog metadata
  // Snapshot edilmez (snapshotForRender'da exclude — Spec §3.3)
  // 0..100, yüksek değer yüksek öncelikli
  coverPriority: number;
};

// V2 contract-ready stub config
export type DynamicMockupsConfig = {
  // ProviderId literal: "dynamic-mockups" (kebab-case, TypeScript string literal)
  providerId: "dynamic-mockups";

  // External template ID (Dynamic Mockups API)
  externalTemplateId: string;

  // Smart object options (V2 future)
  smartObjectOptions?: Record<string, unknown>;

  // Safe area hint for UI overlay (render'da kullanılmaz)
  safeAreaHint?: SafeArea;
};

export type ProviderConfig = LocalSharpConfig | DynamicMockupsConfig;

// ────────────────────────────────────────────────────────────
// Render Input/Output — Provider-agnostik sözleşme
// ────────────────────────────────────────────────────────────

export type RenderInput = {
  // Unique render ID (MockupRender.id)
  renderId: string;
  // Design asset URL (public HTTP(S)) — primary / fallback design.
  // Phase 74 multi-slot fanout: tek slot veya single-design-fanout için
  // tüm slot'larda aynı design.
  designUrl: string;
  /** Phase 75 — Optional slot-mapped design URLs.
   *  Multi-slot template'lerde her slot için farklı design.
   *  Index = slot order; eksik index'ler `designUrl`'e düşer (fanout
   *  fallback). Yoksa Phase 74 baseline: tek `designUrl` fanout.
   *  Tek-slot template'lerde ignore. Schema migration YOK — RenderInput
   *  in-memory shape; persistence MockupJob.slotDesigns JSON map'e
   *  yazılabilir (ileride).
   */
  designUrls?: string[];
  // Design aspect ratio string (e.g., "1:1", "3:4")
  designAspectRatio: string;
  // Byte-stable snapshot (Spec §3.3)
  snapshot: RenderSnapshot;
  // Abort signal for cancellation
  signal: AbortSignal;
};

export type RenderOutput = {
  // MinIO versionlı çıkış path
  outputKey: string;
  // MinIO versionlı thumbnail path
  thumbnailKey: string;
  // Rendered dimensions px
  outputDimensions: { w: number; h: number };
  // Render duration milliseconds
  renderDurationMs: number;
};

// ────────────────────────────────────────────────────────────
// Render Snapshot — Byte-stable JSON (Spec §3.3)
// ────────────────────────────────────────────────────────────

export type RenderSnapshot = {
  // Template metadata
  templateId: string;
  // Binding metadata
  bindingId: string;
  bindingVersion: number;

  // Provider ID — Prisma enum string repr ("LOCAL_SHARP" | "DYNAMIC_MOCKUPS")
  // NOT TypeScript literal; bu enum storage representation
  providerId: "LOCAL_SHARP" | "DYNAMIC_MOCKUPS";

  // Denormalized config — coverPriority omitted (catalog meta, snapshot dışı)
  // Spec §3.3: "coverPriority snapshot'a sızmaz çünkü render zaten cover seçildikten sonra çalışır"
  config: Omit<LocalSharpConfig, "coverPriority"> | DynamicMockupsConfig;

  // Catalog metadata (denormalized, görüntü için)
  templateName: string;
  aspectRatios: string[];
};
