// Phase 7 — Task 11: Manifest builder
//
// SelectionSet + items'tan ZIP export manifest object üretir.
// Pure fonksiyon — DB I/O yok, side effect yok.
//
// Sözleşme: docs/plans/2026-04-30-phase7-selection-studio-design.md
//   - Section 6.1 (asset stratejisi A3): aktif görüntü `images/[name].png`;
//     orijinal yalnız edit yapılmışsa `originals/[name].png`
//   - Section 6.3 (manifest schema): zengin payload — set + items + review
//   - PII disiplini: `exportedBy` yalnız `userId` (userEmail YOK)
//
// Filename disambiguation caller'da (zip-builder) — bu modül yalnız
// shape üretir; dosya adlarını input'tan alır.
//
// Review embed: Task 16 `mapReviewToView` reuse. Mapper null dönerse alan
// TAMAMEN eklenmez (undefined; JSON.stringify undefined alanı atlar).

import type {
  Asset,
  DesignReview,
  GeneratedDesign,
  SelectionItem,
  SelectionSet,
} from "@prisma/client";

import type { ReviewView } from "../types";
import { mapReviewToView } from "../review-mapper";

// ────────────────────────────────────────────────────────────
// Public types
// ────────────────────────────────────────────────────────────

/**
 * Tek item için manifest input. Caller (zip-builder veya export worker)
 * disambiguation sonrası filename'leri atar.
 */
export type ManifestItemInput = {
  item: SelectionItem;
  sourceAsset: Asset;
  editedAsset: Asset | null;
  generatedDesign: GeneratedDesign | null;
  designReview: DesignReview | null;
  /** "images/var-001.png" gibi görece path. */
  imageFilename: string;
  /** "originals/var-003.png" — yalnız edit yapılmış item'da; aksi null. */
  originalFilename: string | null;
};

export type BuildManifestInput = {
  set: SelectionSet;
  items: ManifestItemInput[];
  exportedAt: Date;
  exportedBy: { userId: string };
};

/**
 * Manifest schema v1. Phase 8 Mockup Studio bu shape'i `schemaVersion`
 * discriminator'ı üstünden okur. Forward-compat: v2 eklendiğinde v1
 * destek korunur.
 */
export type ManifestSchemaV1 = {
  schemaVersion: "1";
  exportedAt: string;
  exportedBy: { userId: string };
  set: {
    id: string;
    name: string;
    status: "draft" | "ready" | "archived";
    createdAt: string;
    sourceMetadata: Record<string, unknown> | null;
  };
  items: Array<{
    filename: string;
    originalFilename?: string;
    generatedDesignId: string;
    sourceAssetId: string;
    editedAssetId?: string;
    editHistory: unknown[];
    review?: ReviewView;
    status: "pending" | "selected" | "rejected";
    metadata: {
      width: number;
      height: number;
      mimeType: string;
    };
  }>;
};

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

/**
 * SelectionSet.sourceMetadata Json field — record veya null.
 * Json runtime'da array da olabilir (defensive); record değilse null
 * fallback (sözleşme record-or-null).
 */
function normalizeSourceMetadata(
  raw: SelectionSet["sourceMetadata"],
): Record<string, unknown> | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "object") return null;
  if (Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

/**
 * SelectionItem.editHistoryJson — array veya legacy malformed.
 * Array değilse boş array (defensive).
 */
function normalizeEditHistory(raw: SelectionItem["editHistoryJson"]): unknown[] {
  if (Array.isArray(raw)) return raw;
  return [];
}

// ────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────

export function buildManifest(input: BuildManifestInput): ManifestSchemaV1 {
  const { set, items, exportedAt, exportedBy } = input;

  return {
    schemaVersion: "1",
    exportedAt: exportedAt.toISOString(),
    // PII disiplini: yalnız userId — başka alan ASLA eklenmez.
    exportedBy: { userId: exportedBy.userId },
    set: {
      id: set.id,
      name: set.name,
      status: set.status,
      createdAt: set.createdAt.toISOString(),
      sourceMetadata: normalizeSourceMetadata(set.sourceMetadata),
    },
    items: items.map((entry) => {
      const editedFlag = entry.editedAsset !== null;
      const review = mapReviewToView({
        generatedDesign: entry.generatedDesign,
        designReview: entry.designReview,
      });

      // Conditional alanlar — undefined ise alan TAMAMEN eklenmemeli.
      // JSON.stringify undefined alanı atlar; "in" check'i de false döner.
      const baseItem: ManifestSchemaV1["items"][number] = {
        filename: entry.imageFilename,
        generatedDesignId: entry.item.generatedDesignId,
        sourceAssetId: entry.item.sourceAssetId,
        editHistory: normalizeEditHistory(entry.item.editHistoryJson),
        status: entry.item.status,
        metadata: {
          width: entry.sourceAsset.width ?? 0,
          height: entry.sourceAsset.height ?? 0,
          mimeType: entry.sourceAsset.mimeType,
        },
      };

      if (editedFlag && entry.editedAsset) {
        baseItem.editedAssetId = entry.editedAsset.id;
      }
      if (editedFlag && entry.originalFilename !== null) {
        baseItem.originalFilename = entry.originalFilename;
      }
      if (review !== null) {
        baseItem.review = review;
      }

      return baseItem;
    }),
  };
}
