// Phase 7 — Task 11 contract test: Manifest schema v1 sözleşmesi
//
// Bu test Phase 8 Mockup Studio handoff'unun sigortasıdır. Manifest schema
// v1 değişirse forward-compat'la (yeni v2; v1 destek korunur). Bu test:
//   - schemaVersion "1" literal zorlar
//   - PII disiplinini strict ile garanti eder (userEmail eklenirse reject)
//   - Required field eksikliklerini yakalar
//   - buildManifest output ile fixture data'yı zod parse eder
//
// Sözleşme: docs/plans/2026-04-30-phase7-selection-studio-design.md Section 6.3
// + Section 10.3 (sözleşme test rehberi)

import { describe, expect, it } from "vitest";
import {
  ReviewStatus,
  ReviewStatusSource,
  SelectionSetStatus,
  SelectionItemStatus,
  type Asset,
  type DesignReview,
  type GeneratedDesign,
  type SelectionItem,
  type SelectionSet,
} from "@prisma/client";
import { ManifestV1Schema } from "@/contracts/manifest-v1.schema";
import {
  buildManifest,
  type ManifestItemInput,
} from "@/server/services/selection/export/manifest";

// ────────────────────────────────────────────────────────────
// Fixtures (manifest unit test'le aynı pattern)
// ────────────────────────────────────────────────────────────

function buildSet(overrides: Partial<SelectionSet> = {}): SelectionSet {
  return {
    id: "set-1",
    userId: "user-1",
    name: "Boho Wall Art",
    status: SelectionSetStatus.draft,
    sourceMetadata: null,
    lastExportedAt: null,
    finalizedAt: null,
    archivedAt: null,
    createdAt: new Date("2026-04-30T10:00:00.000Z"),
    updatedAt: new Date("2026-04-30T10:00:00.000Z"),
    ...overrides,
  };
}

function buildAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: "asset-1",
    userId: "user-1",
    storageProvider: "local",
    storageKey: "uploads/asset-1.png",
    bucket: "default",
    mimeType: "image/png",
    sizeBytes: 1024,
    width: 2048,
    height: 3072,
    hash: "h1",
    sourceUrl: null,
    sourcePlatform: null,
    createdAt: new Date("2026-04-30T09:00:00.000Z"),
    updatedAt: new Date("2026-04-30T09:00:00.000Z"),
    deletedAt: null,
    ...overrides,
  };
}

function buildItem(overrides: Partial<SelectionItem> = {}): SelectionItem {
  return {
    id: "item-1",
    selectionSetId: "set-1",
    generatedDesignId: "gd-1",
    sourceAssetId: "asset-1",
    editedAssetId: null,
    lastUndoableAssetId: null,
    editHistoryJson: [],
    activeHeavyJobId: null,
    status: SelectionItemStatus.pending,
    position: 0,
    createdAt: new Date("2026-04-30T10:00:00.000Z"),
    updatedAt: new Date("2026-04-30T10:00:00.000Z"),
    ...overrides,
  };
}

function buildGeneratedDesign(
  overrides: Partial<GeneratedDesign> = {},
): GeneratedDesign {
  return {
    id: "gd-1",
    userId: "user-1",
    referenceId: "ref-1",
    assetId: "asset-1",
    productTypeId: "pt-1",
    promptVersionId: null,
    jobId: null,
    similarity: null,
    qualityScore: 85,
    reviewStatus: ReviewStatus.APPROVED,
    reviewIssues: null,
    reviewSummary: null,
    textDetected: false,
    gibberishDetected: false,
    riskFlags: [],
    reviewedAt: new Date("2026-04-30T09:30:00.000Z"),
    reviewStatusSource: ReviewStatusSource.SYSTEM,
    reviewScore: 90,
    reviewProviderSnapshot: null,
    reviewPromptSnapshot: null,
    reviewRiskFlags: null,
    createdAt: new Date("2026-04-30T09:00:00.000Z"),
    updatedAt: new Date("2026-04-30T09:30:00.000Z"),
    deletedAt: null,
    providerId: null,
    providerTaskId: null,
    capabilityUsed: null,
    promptSnapshot: null,
    briefSnapshot: null,
    resultUrl: null,
    state: null,
    errorMessage: null,
    aspectRatio: null,
    quality: null,
    ...overrides,
  };
}

function buildDesignReview(
  overrides: Partial<DesignReview> = {},
): DesignReview {
  return {
    id: "dr-1",
    generatedDesignId: "gd-1",
    reviewer: "system",
    score: 92,
    decision: ReviewStatus.APPROVED,
    issues: [],
    provider: "kie",
    model: "gemini",
    promptSnapshot: null,
    responseSnapshot: null,
    createdAt: new Date("2026-04-30T09:30:00.000Z"),
    ...overrides,
  };
}

function buildItemInput(
  overrides: Partial<ManifestItemInput> = {},
): ManifestItemInput {
  return {
    item: buildItem(),
    sourceAsset: buildAsset(),
    editedAsset: null,
    generatedDesign: buildGeneratedDesign(),
    designReview: buildDesignReview(),
    imageFilename: "images/var-001.png",
    originalFilename: null,
    ...overrides,
  };
}

const EXPORTED_AT = new Date("2026-04-30T12:00:00.000Z");

// ────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────

describe("ManifestV1Schema — accept paths", () => {
  it("Boş set manifest schema valid", () => {
    const out = buildManifest({
      set: buildSet(),
      items: [],
      exportedAt: EXPORTED_AT,
      exportedBy: { userId: "user-1" },
    });
    const parsed = ManifestV1Schema.safeParse(out);
    expect(parsed.success).toBe(true);
  });

  it("Item review olmadan schema valid (review optional)", () => {
    const out = buildManifest({
      set: buildSet(),
      items: [
        buildItemInput({
          generatedDesign: null,
          designReview: null,
        }),
      ],
      exportedAt: EXPORTED_AT,
      exportedBy: { userId: "user-1" },
    });
    const parsed = ManifestV1Schema.safeParse(out);
    expect(parsed.success).toBe(true);
  });

  it("Item review ile schema valid", () => {
    const out = buildManifest({
      set: buildSet(),
      items: [buildItemInput()],
      exportedAt: EXPORTED_AT,
      exportedBy: { userId: "user-1" },
    });
    const parsed = ManifestV1Schema.safeParse(out);
    expect(parsed.success).toBe(true);
  });

  it("Item edit yapılmış (originalFilename + editedAssetId) schema valid", () => {
    const out = buildManifest({
      set: buildSet(),
      items: [
        buildItemInput({
          item: buildItem({ editedAssetId: "asset-edited-1" }),
          editedAsset: buildAsset({ id: "asset-edited-1" }),
          originalFilename: "originals/var-001.png",
        }),
      ],
      exportedAt: EXPORTED_AT,
      exportedBy: { userId: "user-1" },
    });
    const parsed = ManifestV1Schema.safeParse(out);
    expect(parsed.success).toBe(true);
  });

  it("buildManifest output gerçek fixture data ile schema valid", () => {
    const out = buildManifest({
      set: buildSet({
        sourceMetadata: {
          kind: "variation-batch",
          referenceId: "ref-5",
          batchId: "batch-9",
          productTypeId: "pt-1",
          batchCreatedAt: "2026-04-29T10:00:00.000Z",
          originalCount: 12,
        },
      }),
      items: [
        buildItemInput({ imageFilename: "images/var-001.png" }),
        buildItemInput({
          item: buildItem({
            id: "item-2",
            editedAssetId: "asset-edited",
            status: SelectionItemStatus.selected,
            editHistoryJson: [
              { op: "background-remove", at: "2026-04-30T11:00:00.000Z" },
            ],
          }),
          editedAsset: buildAsset({ id: "asset-edited" }),
          imageFilename: "images/var-002.png",
          originalFilename: "originals/var-002.png",
        }),
      ],
      exportedAt: EXPORTED_AT,
      exportedBy: { userId: "user-1" },
    });
    const parsed = ManifestV1Schema.safeParse(out);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.schemaVersion).toBe("1");
      expect(parsed.data.items).toHaveLength(2);
    }
  });
});

describe("ManifestV1Schema — PII disiplini (strict reject)", () => {
  it("userEmail eklenmiş manifest reject edilir", () => {
    const out = buildManifest({
      set: buildSet(),
      items: [],
      exportedAt: EXPORTED_AT,
      exportedBy: { userId: "user-1" },
    });
    // Tahrif: userEmail enjekte et
    const tampered = {
      ...out,
      exportedBy: { ...out.exportedBy, userEmail: "leaked@example.com" },
    };
    const parsed = ManifestV1Schema.safeParse(tampered);
    expect(parsed.success).toBe(false);
  });

  it("exportedBy ek alan (örn. role) reject edilir", () => {
    const out = buildManifest({
      set: buildSet(),
      items: [],
      exportedAt: EXPORTED_AT,
      exportedBy: { userId: "user-1" },
    });
    const tampered = {
      ...out,
      exportedBy: { ...out.exportedBy, role: "admin" },
    };
    const parsed = ManifestV1Schema.safeParse(tampered);
    expect(parsed.success).toBe(false);
  });
});

describe("ManifestV1Schema — schemaVersion validation", () => {
  it("schemaVersion '2' reject edilir", () => {
    const out = buildManifest({
      set: buildSet(),
      items: [],
      exportedAt: EXPORTED_AT,
      exportedBy: { userId: "user-1" },
    });
    const tampered = { ...out, schemaVersion: "2" };
    const parsed = ManifestV1Schema.safeParse(tampered);
    expect(parsed.success).toBe(false);
  });

  it("schemaVersion 'v1' reject edilir", () => {
    const out = buildManifest({
      set: buildSet(),
      items: [],
      exportedAt: EXPORTED_AT,
      exportedBy: { userId: "user-1" },
    });
    const tampered = { ...out, schemaVersion: "v1" };
    const parsed = ManifestV1Schema.safeParse(tampered);
    expect(parsed.success).toBe(false);
  });

  it("schemaVersion null reject edilir", () => {
    const out = buildManifest({
      set: buildSet(),
      items: [],
      exportedAt: EXPORTED_AT,
      exportedBy: { userId: "user-1" },
    });
    const tampered = { ...out, schemaVersion: null };
    const parsed = ManifestV1Schema.safeParse(tampered);
    expect(parsed.success).toBe(false);
  });
});

describe("ManifestV1Schema — required field eksiklikleri", () => {
  it("set.id eksik reject", () => {
    const out = buildManifest({
      set: buildSet(),
      items: [],
      exportedAt: EXPORTED_AT,
      exportedBy: { userId: "user-1" },
    });
    const tampered = JSON.parse(JSON.stringify(out)) as Record<string, unknown>;
    delete (tampered.set as Record<string, unknown>).id;
    const parsed = ManifestV1Schema.safeParse(tampered);
    expect(parsed.success).toBe(false);
  });

  it("items array missing reject", () => {
    const out = buildManifest({
      set: buildSet(),
      items: [],
      exportedAt: EXPORTED_AT,
      exportedBy: { userId: "user-1" },
    });
    const tampered = JSON.parse(JSON.stringify(out)) as Record<string, unknown>;
    delete tampered.items;
    const parsed = ManifestV1Schema.safeParse(tampered);
    expect(parsed.success).toBe(false);
  });

  it("exportedBy.userId eksik reject", () => {
    const out = buildManifest({
      set: buildSet(),
      items: [],
      exportedAt: EXPORTED_AT,
      exportedBy: { userId: "user-1" },
    });
    const tampered = JSON.parse(JSON.stringify(out)) as Record<string, unknown>;
    tampered.exportedBy = {};
    const parsed = ManifestV1Schema.safeParse(tampered);
    expect(parsed.success).toBe(false);
  });

  it("item.metadata.width negative reject", () => {
    const out = buildManifest({
      set: buildSet(),
      items: [buildItemInput()],
      exportedAt: EXPORTED_AT,
      exportedBy: { userId: "user-1" },
    });
    const tampered = JSON.parse(JSON.stringify(out)) as {
      items: Array<{ metadata: { width: number } }>;
    };
    tampered.items[0]!.metadata.width = -10;
    const parsed = ManifestV1Schema.safeParse(tampered);
    expect(parsed.success).toBe(false);
  });

  it("item.status enum dışı değer reject", () => {
    const out = buildManifest({
      set: buildSet(),
      items: [buildItemInput()],
      exportedAt: EXPORTED_AT,
      exportedBy: { userId: "user-1" },
    });
    const tampered = JSON.parse(JSON.stringify(out)) as {
      items: Array<{ status: string }>;
    };
    tampered.items[0]!.status = "weird-status";
    const parsed = ManifestV1Schema.safeParse(tampered);
    expect(parsed.success).toBe(false);
  });
});
