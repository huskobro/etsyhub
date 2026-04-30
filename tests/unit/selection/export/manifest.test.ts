// Phase 7 — Task 11: Export manifest builder unit tests
//
// Sözleşme: docs/plans/2026-04-30-phase7-selection-studio-design.md Section 6.3
//
// Test başlıkları:
//   - schemaVersion "1" literal
//   - PII disiplini: exportedBy yalnız userId (userEmail YOK)
//   - set object alanları (id/name/status/createdAt/sourceMetadata)
//   - items array length input ile eşit
//   - Item filename input imageFilename'den geliyor
//   - originalFilename yalnız edit yapılmış item'da var
//   - editedAssetId yalnız edit yapılmışsa
//   - review: Task 16 mapper output reuse (varsa eklenir)
//   - review yoksa alan TAMAMEN yok (undefined; null DEĞİL)
//   - editHistory editHistoryJson aynen kopyalanır
//   - status pending/selected/rejected aynen
//   - metadata width/height/mimeType sourceAsset'ten
//   - JSON.stringify roundtrip — schema sözleşmesi korunur
//
// Bu dosya UNIT test. DB I/O yok.

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
import {
  buildManifest,
  type ManifestItemInput,
} from "@/server/services/selection/export/manifest";

// ────────────────────────────────────────────────────────────
// Fixture builders
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

describe("buildManifest — schemaVersion", () => {
  it("schemaVersion is literal '1'", () => {
    const out = buildManifest({
      set: buildSet(),
      items: [],
      exportedAt: EXPORTED_AT,
      exportedBy: { userId: "user-1" },
    });
    expect(out.schemaVersion).toBe("1");
  });
});

describe("buildManifest — PII disiplini", () => {
  it("exportedBy yalnız userId içerir (userEmail YOK)", () => {
    const out = buildManifest({
      set: buildSet(),
      items: [],
      exportedAt: EXPORTED_AT,
      exportedBy: { userId: "user-42" },
    });
    expect(out.exportedBy).toEqual({ userId: "user-42" });
    expect(Object.keys(out.exportedBy)).toEqual(["userId"]);
    expect((out.exportedBy as Record<string, unknown>).userEmail).toBeUndefined();
  });

  it("exportedAt ISO string", () => {
    const out = buildManifest({
      set: buildSet(),
      items: [],
      exportedAt: EXPORTED_AT,
      exportedBy: { userId: "user-1" },
    });
    expect(out.exportedAt).toBe("2026-04-30T12:00:00.000Z");
  });
});

describe("buildManifest — set object", () => {
  it("set fields doğru kopyalanır", () => {
    const set = buildSet({
      id: "set-99",
      name: "Halloween Stickers",
      status: SelectionSetStatus.ready,
      sourceMetadata: {
        kind: "variation-batch",
        referenceId: "ref-5",
        batchId: "batch-9",
        productTypeId: "pt-sticker",
        batchCreatedAt: "2026-04-29T10:00:00.000Z",
        originalCount: 12,
      },
      createdAt: new Date("2026-04-29T15:00:00.000Z"),
    });
    const out = buildManifest({
      set,
      items: [],
      exportedAt: EXPORTED_AT,
      exportedBy: { userId: "user-1" },
    });
    expect(out.set).toEqual({
      id: "set-99",
      name: "Halloween Stickers",
      status: "ready",
      createdAt: "2026-04-29T15:00:00.000Z",
      sourceMetadata: {
        kind: "variation-batch",
        referenceId: "ref-5",
        batchId: "batch-9",
        productTypeId: "pt-sticker",
        batchCreatedAt: "2026-04-29T10:00:00.000Z",
        originalCount: 12,
      },
    });
  });

  it("sourceMetadata null kabul edilir", () => {
    const out = buildManifest({
      set: buildSet({ sourceMetadata: null }),
      items: [],
      exportedAt: EXPORTED_AT,
      exportedBy: { userId: "user-1" },
    });
    expect(out.set.sourceMetadata).toBeNull();
  });
});

describe("buildManifest — items array", () => {
  it("items.length input count'a eşit", () => {
    const out = buildManifest({
      set: buildSet(),
      items: [
        buildItemInput({ imageFilename: "images/var-001.png" }),
        buildItemInput({
          item: buildItem({ id: "item-2" }),
          imageFilename: "images/var-002.png",
        }),
        buildItemInput({
          item: buildItem({ id: "item-3" }),
          imageFilename: "images/var-003.png",
        }),
      ],
      exportedAt: EXPORTED_AT,
      exportedBy: { userId: "user-1" },
    });
    expect(out.items).toHaveLength(3);
  });

  it("filename input imageFilename'i aynen yansıtır", () => {
    const out = buildManifest({
      set: buildSet(),
      items: [buildItemInput({ imageFilename: "images/var-007.png" })],
      exportedAt: EXPORTED_AT,
      exportedBy: { userId: "user-1" },
    });
    expect(out.items[0]!.filename).toBe("images/var-007.png");
  });
});

describe("buildManifest — edit yapılmış item", () => {
  it("originalFilename + editedAssetId edit yapılmışsa eklenir", () => {
    const editedAsset = buildAsset({ id: "asset-edited-1" });
    const out = buildManifest({
      set: buildSet(),
      items: [
        buildItemInput({
          item: buildItem({ editedAssetId: "asset-edited-1" }),
          editedAsset,
          originalFilename: "originals/var-001.png",
          imageFilename: "images/var-001.png",
        }),
      ],
      exportedAt: EXPORTED_AT,
      exportedBy: { userId: "user-1" },
    });
    expect(out.items[0]!.originalFilename).toBe("originals/var-001.png");
    expect(out.items[0]!.editedAssetId).toBe("asset-edited-1");
  });
});

describe("buildManifest — edit yapılmamış item", () => {
  it("originalFilename undefined (alan YOK)", () => {
    const out = buildManifest({
      set: buildSet(),
      items: [buildItemInput({ editedAsset: null, originalFilename: null })],
      exportedAt: EXPORTED_AT,
      exportedBy: { userId: "user-1" },
    });
    expect(out.items[0]!.originalFilename).toBeUndefined();
    expect("originalFilename" in out.items[0]!).toBe(false);
  });

  it("editedAssetId undefined (alan YOK)", () => {
    const out = buildManifest({
      set: buildSet(),
      items: [buildItemInput({ editedAsset: null })],
      exportedAt: EXPORTED_AT,
      exportedBy: { userId: "user-1" },
    });
    expect(out.items[0]!.editedAssetId).toBeUndefined();
    expect("editedAssetId" in out.items[0]!).toBe(false);
  });
});

describe("buildManifest — review embed", () => {
  it("review varsa Task 16 mapper output eklenir", () => {
    const out = buildManifest({
      set: buildSet(),
      items: [buildItemInput()],
      exportedAt: EXPORTED_AT,
      exportedBy: { userId: "user-1" },
    });
    expect(out.items[0]!.review).toBeDefined();
    expect(out.items[0]!.review).toMatchObject({
      score: 92,
      status: "approved",
      signals: {
        resolution: "ok",
        textDetection: "clean",
        artifactCheck: "clean",
        trademarkRisk: "low",
      },
    });
  });

  it("review yoksa alan TAMAMEN eksik (undefined; null DEĞİL)", () => {
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
    expect(out.items[0]!.review).toBeUndefined();
    expect("review" in out.items[0]!).toBe(false);
  });
});

describe("buildManifest — editHistory + status + metadata", () => {
  it("editHistory editHistoryJson'dan aynen kopyalanır", () => {
    const history = [
      { op: "transparent-check", at: "2026-04-30T10:00:00.000Z" },
      {
        op: "crop",
        params: { ratio: "2:3" },
        at: "2026-04-30T10:05:00.000Z",
      },
    ];
    const out = buildManifest({
      set: buildSet(),
      items: [
        buildItemInput({
          item: buildItem({ editHistoryJson: history }),
        }),
      ],
      exportedAt: EXPORTED_AT,
      exportedBy: { userId: "user-1" },
    });
    expect(out.items[0]!.editHistory).toEqual(history);
  });

  it("status pending/selected/rejected aynen yansır", () => {
    const out = buildManifest({
      set: buildSet(),
      items: [
        buildItemInput({
          item: buildItem({
            id: "item-a",
            status: SelectionItemStatus.selected,
          }),
        }),
        buildItemInput({
          item: buildItem({
            id: "item-b",
            status: SelectionItemStatus.rejected,
          }),
        }),
        buildItemInput({
          item: buildItem({
            id: "item-c",
            status: SelectionItemStatus.pending,
          }),
        }),
      ],
      exportedAt: EXPORTED_AT,
      exportedBy: { userId: "user-1" },
    });
    expect(out.items.map((i) => i.status)).toEqual([
      "selected",
      "rejected",
      "pending",
    ]);
  });

  it("metadata width/height/mimeType sourceAsset'ten okunur", () => {
    const out = buildManifest({
      set: buildSet(),
      items: [
        buildItemInput({
          sourceAsset: buildAsset({
            width: 1500,
            height: 2000,
            mimeType: "image/png",
          }),
        }),
      ],
      exportedAt: EXPORTED_AT,
      exportedBy: { userId: "user-1" },
    });
    expect(out.items[0]!.metadata).toEqual({
      width: 1500,
      height: 2000,
      mimeType: "image/png",
    });
  });

  it("metadata width/height null ise 0 fallback", () => {
    const out = buildManifest({
      set: buildSet(),
      items: [
        buildItemInput({
          sourceAsset: buildAsset({
            width: null,
            height: null,
            mimeType: "image/jpeg",
          }),
        }),
      ],
      exportedAt: EXPORTED_AT,
      exportedBy: { userId: "user-1" },
    });
    expect(out.items[0]!.metadata).toEqual({
      width: 0,
      height: 0,
      mimeType: "image/jpeg",
    });
  });

  it("generatedDesignId + sourceAssetId doğru kopyalanır", () => {
    const out = buildManifest({
      set: buildSet(),
      items: [
        buildItemInput({
          item: buildItem({
            generatedDesignId: "gd-77",
            sourceAssetId: "asset-77",
          }),
        }),
      ],
      exportedAt: EXPORTED_AT,
      exportedBy: { userId: "user-1" },
    });
    expect(out.items[0]!.generatedDesignId).toBe("gd-77");
    expect(out.items[0]!.sourceAssetId).toBe("asset-77");
  });
});

describe("buildManifest — JSON roundtrip", () => {
  it("JSON.stringify + parse roundtrip schema sözleşmesini korur", () => {
    const out = buildManifest({
      set: buildSet(),
      items: [
        buildItemInput({ imageFilename: "images/var-001.png" }),
        buildItemInput({
          item: buildItem({
            id: "item-2",
            editedAssetId: "asset-edited",
            editHistoryJson: [
              { op: "background-remove", at: "2026-04-30T11:00:00.000Z" },
            ],
            status: SelectionItemStatus.selected,
          }),
          editedAsset: buildAsset({ id: "asset-edited" }),
          imageFilename: "images/var-002.png",
          originalFilename: "originals/var-002.png",
        }),
      ],
      exportedAt: EXPORTED_AT,
      exportedBy: { userId: "user-1" },
    });

    const json = JSON.stringify(out, null, 2);
    const parsed = JSON.parse(json) as Record<string, unknown>;

    expect(parsed.schemaVersion).toBe("1");
    expect((parsed.exportedBy as Record<string, unknown>).userId).toBe("user-1");
    expect(Array.isArray(parsed.items)).toBe(true);
    const items = parsed.items as Array<Record<string, unknown>>;
    expect(items).toHaveLength(2);
    // Edit yapılmamış item — originalFilename ve editedAssetId yok
    expect(items[0]!.originalFilename).toBeUndefined();
    expect(items[0]!.editedAssetId).toBeUndefined();
    // Edit yapılmış item — alanlar mevcut
    expect(items[1]!.originalFilename).toBe("originals/var-002.png");
    expect(items[1]!.editedAssetId).toBe("asset-edited");
  });
});
