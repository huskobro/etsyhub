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

// ────────────────────────────────────────────────────────────
// Task 40 — Supplementary contract coverage (Phase 8 Mockup Studio handoff)
// ────────────────────────────────────────────────────────────
//
// Coverage matrisi (kullanıcı vurgusu):
//   A. Edit matrix     — edit yapılmış vs yapılmamış aynı set
//   B. Review matrix   — review var vs yok aynı set; review key tamamen yok
//   C. Asset stratejisi A3 corner cases (single, empty, large set, padding)
//   D. Schema invariants — schemaVersion sabit, additionalProperties strict,
//      ISO datetime, PII forward-compat
//   E. buildManifest output → ManifestV1Schema parse roundtrip + JSON
//      stringify/parse stability

describe("Task 40 (A) — Edit matrix coverage", () => {
  it("Karışık set: bir item edit yapılmış, diğer item edit yapılmamış aynı set valid", () => {
    const out = buildManifest({
      set: buildSet(),
      items: [
        // Edit yapılmamış item (originalFilename + editedAssetId yok)
        buildItemInput({
          item: buildItem({ id: "item-plain" }),
          imageFilename: "images/var-001.png",
          originalFilename: null,
        }),
        // Edit yapılmış item (originalFilename + editedAssetId var)
        buildItemInput({
          item: buildItem({
            id: "item-edited",
            editedAssetId: "asset-edited-2",
          }),
          editedAsset: buildAsset({ id: "asset-edited-2" }),
          imageFilename: "images/var-002.png",
          originalFilename: "originals/var-002.png",
        }),
      ],
      exportedAt: EXPORTED_AT,
      exportedBy: { userId: "user-1" },
    });
    const parsed = ManifestV1Schema.safeParse(out);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    const [plain, edited] = parsed.data.items;
    // Edit yapılmamış: alanın HİÇ olmaması (undefined; zod optional yokluk).
    expect(plain).toBeDefined();
    expect("originalFilename" in plain!).toBe(false);
    expect("editedAssetId" in plain!).toBe(false);
    // Edit yapılmış: her iki alan dolu.
    expect(edited).toBeDefined();
    expect(edited!.originalFilename).toBe("originals/var-002.png");
    expect(edited!.editedAssetId).toBe("asset-edited-2");
  });

  it("Edit yapılmış item'da originalFilename `originals/var-NNN.png` pattern'iyle uyumlu", () => {
    const out = buildManifest({
      set: buildSet(),
      items: [
        buildItemInput({
          item: buildItem({ editedAssetId: "asset-edited" }),
          editedAsset: buildAsset({ id: "asset-edited" }),
          imageFilename: "images/var-007.png",
          originalFilename: "originals/var-007.png",
        }),
      ],
      exportedAt: EXPORTED_AT,
      exportedBy: { userId: "user-1" },
    });
    const parsed = ManifestV1Schema.safeParse(out);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    const item = parsed.data.items[0]!;
    expect(item.filename).toMatch(/^images\/var-\d{3}\.png$/);
    expect(item.originalFilename).toMatch(/^originals\/var-\d{3}\.png$/);
    // Aynı NNN korelasyonu (schema-level enforcement YOK — belge için).
    const imageNNN = item.filename.match(/var-(\d{3})/)?.[1];
    const originalNNN = item.originalFilename!.match(/var-(\d{3})/)?.[1];
    expect(imageNNN).toBe(originalNNN);
  });

  it("Edit yapılmamış item'da originalFilename ALANI HİÇ YOK (null değil)", () => {
    const out = buildManifest({
      set: buildSet(),
      items: [
        buildItemInput({
          imageFilename: "images/var-001.png",
          originalFilename: null,
        }),
      ],
      exportedAt: EXPORTED_AT,
      exportedBy: { userId: "user-1" },
    });
    // Manifest output'u: alanın hiç yok olduğunu kanıtla.
    const item = out.items[0]!;
    expect("originalFilename" in item).toBe(false);
    expect("editedAssetId" in item).toBe(false);

    // JSON stringify roundtrip sonrası da yok olduğunu kanıtla
    // (undefined JSON'da kaybolur; null olarak yazılmıyor).
    const json = JSON.stringify(out);
    const reparsed = JSON.parse(json) as { items: Array<Record<string, unknown>> };
    expect("originalFilename" in reparsed.items[0]!).toBe(false);
    expect("editedAssetId" in reparsed.items[0]!).toBe(false);
  });

  it("editedAsset null + originalFilename string verilse dahi schema-output strict — alan eklenmez", () => {
    // Defensive: caller mantık hatası yapsa bile manifest builder editedAsset
    // null iken originalFilename'i atmaz (Section 6.1 A3 sözleşmesi).
    const out = buildManifest({
      set: buildSet(),
      items: [
        buildItemInput({
          editedAsset: null,
          imageFilename: "images/var-001.png",
          originalFilename: "originals/var-001.png", // tutarsız input
        }),
      ],
      exportedAt: EXPORTED_AT,
      exportedBy: { userId: "user-1" },
    });
    const item = out.items[0]!;
    expect("originalFilename" in item).toBe(false);
    expect("editedAssetId" in item).toBe(false);
  });
});

describe("Task 40 (B) — Review matrix coverage", () => {
  it("Karışık set: bir item review var, diğer item review yok aynı set valid", () => {
    const out = buildManifest({
      set: buildSet(),
      items: [
        // Review var
        buildItemInput({
          item: buildItem({ id: "item-r" }),
          imageFilename: "images/var-001.png",
        }),
        // Review yok (gd null + designReview null → mapper null döner)
        buildItemInput({
          item: buildItem({ id: "item-noreview" }),
          generatedDesign: null,
          designReview: null,
          imageFilename: "images/var-002.png",
        }),
      ],
      exportedAt: EXPORTED_AT,
      exportedBy: { userId: "user-1" },
    });
    const parsed = ManifestV1Schema.safeParse(out);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    const [withReview, noReview] = parsed.data.items;
    expect(withReview!.review).toBeDefined();
    expect(withReview!.review!.signals).toBeDefined();
    // "review yok" = key tamamen YOK (null değil).
    expect("review" in noReview!).toBe(false);
  });

  it("review object zorunlu alanları (score, status, signals 4 alan)", () => {
    const out = buildManifest({
      set: buildSet(),
      items: [buildItemInput()],
      exportedAt: EXPORTED_AT,
      exportedBy: { userId: "user-1" },
    });
    const parsed = ManifestV1Schema.safeParse(out);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    const review = parsed.data.items[0]!.review!;
    expect(typeof review.score).toBe("number");
    expect(typeof review.status).toBe("string");
    expect(typeof review.signals.resolution).toBe("string");
    expect(typeof review.signals.textDetection).toBe("string");
    expect(typeof review.signals.artifactCheck).toBe("string");
    expect(typeof review.signals.trademarkRisk).toBe("string");
  });

  it("review yok JSON serialize sonrası `review` key hiç yok", () => {
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
    const json = JSON.stringify(out);
    expect(json).not.toContain("\"review\"");
    const reparsed = JSON.parse(json) as { items: Array<Record<string, unknown>> };
    expect("review" in reparsed.items[0]!).toBe(false);
  });

  it("review var ama signals eksik → schema reject", () => {
    const out = buildManifest({
      set: buildSet(),
      items: [buildItemInput()],
      exportedAt: EXPORTED_AT,
      exportedBy: { userId: "user-1" },
    });
    const tampered = JSON.parse(JSON.stringify(out)) as {
      items: Array<{ review?: { score: number; status: string } }>;
    };
    // signals'i sil
    tampered.items[0]!.review = { score: 90, status: "approved" };
    const parsed = ManifestV1Schema.safeParse(tampered);
    expect(parsed.success).toBe(false);
  });

  it("review.signals içinde bir alan eksik → schema reject", () => {
    const out = buildManifest({
      set: buildSet(),
      items: [buildItemInput()],
      exportedAt: EXPORTED_AT,
      exportedBy: { userId: "user-1" },
    });
    const tampered = JSON.parse(JSON.stringify(out)) as {
      items: Array<{
        review: {
          score: number;
          status: string;
          signals: Partial<{
            resolution: string;
            textDetection: string;
            artifactCheck: string;
            trademarkRisk: string;
          }>;
        };
      }>;
    };
    delete tampered.items[0]!.review.signals.trademarkRisk;
    const parsed = ManifestV1Schema.safeParse(tampered);
    expect(parsed.success).toBe(false);
  });

  it("review.score string olarak gelirse reject (zod number expected)", () => {
    const out = buildManifest({
      set: buildSet(),
      items: [buildItemInput()],
      exportedAt: EXPORTED_AT,
      exportedBy: { userId: "user-1" },
    });
    const tampered = JSON.parse(JSON.stringify(out)) as {
      items: Array<{ review: { score: number | string } }>;
    };
    tampered.items[0]!.review.score = "90";
    const parsed = ManifestV1Schema.safeParse(tampered);
    expect(parsed.success).toBe(false);
  });
});

describe("Task 40 (C) — Asset stratejisi A3 corner cases", () => {
  it("Tek item, edit yapılmış → originalFilename var", () => {
    const out = buildManifest({
      set: buildSet(),
      items: [
        buildItemInput({
          item: buildItem({ editedAssetId: "asset-e" }),
          editedAsset: buildAsset({ id: "asset-e" }),
          imageFilename: "images/var-001.png",
          originalFilename: "originals/var-001.png",
        }),
      ],
      exportedAt: EXPORTED_AT,
      exportedBy: { userId: "user-1" },
    });
    const parsed = ManifestV1Schema.safeParse(out);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.items[0]!.originalFilename).toBe(
        "originals/var-001.png",
      );
    }
  });

  it("Tek item, edit yapılmamış → originalFilename yok", () => {
    const out = buildManifest({
      set: buildSet(),
      items: [buildItemInput()],
      exportedAt: EXPORTED_AT,
      exportedBy: { userId: "user-1" },
    });
    const parsed = ManifestV1Schema.safeParse(out);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect("originalFilename" in parsed.data.items[0]!).toBe(false);
    }
  });

  it("Boş items array → schema valid (empty set export şeması)", () => {
    const out = buildManifest({
      set: buildSet(),
      items: [],
      exportedAt: EXPORTED_AT,
      exportedBy: { userId: "user-1" },
    });
    const parsed = ManifestV1Schema.safeParse(out);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.items).toHaveLength(0);
    }
  });

  it("50 item'lık büyük set schema valid (limit yok)", () => {
    const items: ManifestItemInput[] = Array.from({ length: 50 }, (_, i) => {
      const padded = String(i + 1).padStart(3, "0");
      return buildItemInput({
        item: buildItem({ id: `item-${padded}` }),
        imageFilename: `images/var-${padded}.png`,
      });
    });
    const out = buildManifest({
      set: buildSet(),
      items,
      exportedAt: EXPORTED_AT,
      exportedBy: { userId: "user-1" },
    });
    const parsed = ManifestV1Schema.safeParse(out);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.items).toHaveLength(50);
      expect(parsed.data.items[0]!.filename).toBe("images/var-001.png");
      expect(parsed.data.items[49]!.filename).toBe("images/var-050.png");
    }
  });

  it("filename pattern: images/var-NNN.png (3-digit padding)", () => {
    const out = buildManifest({
      set: buildSet(),
      items: [
        buildItemInput({ imageFilename: "images/var-001.png" }),
        buildItemInput({
          item: buildItem({ id: "item-2" }),
          imageFilename: "images/var-099.png",
        }),
        buildItemInput({
          item: buildItem({ id: "item-3" }),
          imageFilename: "images/var-100.png",
        }),
      ],
      exportedAt: EXPORTED_AT,
      exportedBy: { userId: "user-1" },
    });
    const parsed = ManifestV1Schema.safeParse(out);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      for (const item of parsed.data.items) {
        expect(item.filename).toMatch(/^images\/var-\d{3}\.png$/);
      }
    }
  });

  it("active image her zaman var — item.filename non-empty (sözleşme)", () => {
    const out = buildManifest({
      set: buildSet(),
      items: [
        buildItemInput(),
        buildItemInput({
          item: buildItem({ id: "item-2", editedAssetId: "asset-e" }),
          editedAsset: buildAsset({ id: "asset-e" }),
          imageFilename: "images/var-002.png",
          originalFilename: "originals/var-002.png",
        }),
        buildItemInput({
          item: buildItem({ id: "item-3" }),
          generatedDesign: null,
          designReview: null,
          imageFilename: "images/var-003.png",
        }),
      ],
      exportedAt: EXPORTED_AT,
      exportedBy: { userId: "user-1" },
    });
    const parsed = ManifestV1Schema.safeParse(out);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      for (const item of parsed.data.items) {
        expect(item.filename).toBeTruthy();
        expect(item.filename.startsWith("images/")).toBe(true);
      }
    }
  });

  it("filename empty string reject (z.string().min(1))", () => {
    const out = buildManifest({
      set: buildSet(),
      items: [buildItemInput()],
      exportedAt: EXPORTED_AT,
      exportedBy: { userId: "user-1" },
    });
    const tampered = JSON.parse(JSON.stringify(out)) as {
      items: Array<{ filename: string }>;
    };
    tampered.items[0]!.filename = "";
    const parsed = ManifestV1Schema.safeParse(tampered);
    expect(parsed.success).toBe(false);
  });
});

describe("Task 40 (D) — Schema invariants (forward-compat)", () => {
  it("schemaVersion EXACTLY '1' (literal); buildManifest output kontrolü", () => {
    const out = buildManifest({
      set: buildSet(),
      items: [],
      exportedAt: EXPORTED_AT,
      exportedBy: { userId: "user-1" },
    });
    expect(out.schemaVersion).toBe("1");
    // Literal type — TS seviyesinde de "1" sabit.
  });

  it("top-level extra alan reject (additionalProperties strict)", () => {
    const out = buildManifest({
      set: buildSet(),
      items: [],
      exportedAt: EXPORTED_AT,
      exportedBy: { userId: "user-1" },
    });
    const tampered = { ...out, extraField: "leak" };
    const parsed = ManifestV1Schema.safeParse(tampered);
    expect(parsed.success).toBe(false);
  });

  it("set seviyesinde extra alan reject", () => {
    const out = buildManifest({
      set: buildSet(),
      items: [],
      exportedAt: EXPORTED_AT,
      exportedBy: { userId: "user-1" },
    });
    const tampered = JSON.parse(JSON.stringify(out)) as {
      set: Record<string, unknown>;
    };
    tampered.set.extraField = "leak";
    const parsed = ManifestV1Schema.safeParse(tampered);
    expect(parsed.success).toBe(false);
  });

  it("items[] seviyesinde extra alan reject", () => {
    const out = buildManifest({
      set: buildSet(),
      items: [buildItemInput()],
      exportedAt: EXPORTED_AT,
      exportedBy: { userId: "user-1" },
    });
    const tampered = JSON.parse(JSON.stringify(out)) as {
      items: Array<Record<string, unknown>>;
    };
    tampered.items[0]!.extraField = "leak";
    const parsed = ManifestV1Schema.safeParse(tampered);
    expect(parsed.success).toBe(false);
  });

  it("items[].review seviyesinde extra alan reject", () => {
    const out = buildManifest({
      set: buildSet(),
      items: [buildItemInput()],
      exportedAt: EXPORTED_AT,
      exportedBy: { userId: "user-1" },
    });
    const tampered = JSON.parse(JSON.stringify(out)) as {
      items: Array<{ review: Record<string, unknown> }>;
    };
    tampered.items[0]!.review.extraField = "leak";
    const parsed = ManifestV1Schema.safeParse(tampered);
    expect(parsed.success).toBe(false);
  });

  it("items[].review.signals seviyesinde extra alan reject", () => {
    const out = buildManifest({
      set: buildSet(),
      items: [buildItemInput()],
      exportedAt: EXPORTED_AT,
      exportedBy: { userId: "user-1" },
    });
    const tampered = JSON.parse(JSON.stringify(out)) as {
      items: Array<{ review: { signals: Record<string, unknown> } }>;
    };
    tampered.items[0]!.review.signals.extraSignal = "leak";
    const parsed = ManifestV1Schema.safeParse(tampered);
    expect(parsed.success).toBe(false);
  });

  it("items[].metadata seviyesinde extra alan reject", () => {
    const out = buildManifest({
      set: buildSet(),
      items: [buildItemInput()],
      exportedAt: EXPORTED_AT,
      exportedBy: { userId: "user-1" },
    });
    const tampered = JSON.parse(JSON.stringify(out)) as {
      items: Array<{ metadata: Record<string, unknown> }>;
    };
    tampered.items[0]!.metadata.extraField = "leak";
    const parsed = ManifestV1Schema.safeParse(tampered);
    expect(parsed.success).toBe(false);
  });

  it("exportedAt invalid format (non-ISO) reject", () => {
    const out = buildManifest({
      set: buildSet(),
      items: [],
      exportedAt: EXPORTED_AT,
      exportedBy: { userId: "user-1" },
    });
    const tampered = { ...out, exportedAt: "2026-04-30 12:00:00" }; // ISO değil
    const parsed = ManifestV1Schema.safeParse(tampered);
    expect(parsed.success).toBe(false);
  });

  it("exportedAt epoch number reject (string bekleniyor)", () => {
    const out = buildManifest({
      set: buildSet(),
      items: [],
      exportedAt: EXPORTED_AT,
      exportedBy: { userId: "user-1" },
    });
    const tampered = { ...out, exportedAt: 1745923200000 };
    const parsed = ManifestV1Schema.safeParse(tampered);
    expect(parsed.success).toBe(false);
  });

  it("buildManifest exportedAt çıktısı ISO 8601 datetime", () => {
    const out = buildManifest({
      set: buildSet(),
      items: [],
      exportedAt: new Date("2026-05-01T00:00:00.000Z"),
      exportedBy: { userId: "user-1" },
    });
    expect(out.exportedAt).toBe("2026-05-01T00:00:00.000Z");
    expect(out.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("exportedBy.userId boş string reject", () => {
    const out = buildManifest({
      set: buildSet(),
      items: [],
      exportedAt: EXPORTED_AT,
      exportedBy: { userId: "user-1" },
    });
    const tampered = { ...out, exportedBy: { userId: "" } };
    const parsed = ManifestV1Schema.safeParse(tampered);
    expect(parsed.success).toBe(false);
  });

  it("exportedBy strict — name alanı (PII forward-compat) reject", () => {
    const out = buildManifest({
      set: buildSet(),
      items: [],
      exportedAt: EXPORTED_AT,
      exportedBy: { userId: "user-1" },
    });
    const tampered = {
      ...out,
      exportedBy: { ...out.exportedBy, name: "Hüseyin Coşkun" },
    };
    const parsed = ManifestV1Schema.safeParse(tampered);
    expect(parsed.success).toBe(false);
  });
});

describe("Task 40 (E) — buildManifest output → schema parse roundtrip", () => {
  it("Mixed senaryo: 5 item (2 edit + 3 plain, 3 review + 2 noreview) tek geçişte valid", () => {
    const items: ManifestItemInput[] = [
      // 1. plain + review
      buildItemInput({
        item: buildItem({ id: "item-1" }),
        imageFilename: "images/var-001.png",
      }),
      // 2. edit + review
      buildItemInput({
        item: buildItem({ id: "item-2", editedAssetId: "asset-e2" }),
        editedAsset: buildAsset({ id: "asset-e2" }),
        imageFilename: "images/var-002.png",
        originalFilename: "originals/var-002.png",
      }),
      // 3. plain + noreview
      buildItemInput({
        item: buildItem({ id: "item-3" }),
        generatedDesign: null,
        designReview: null,
        imageFilename: "images/var-003.png",
      }),
      // 4. edit + noreview
      buildItemInput({
        item: buildItem({ id: "item-4", editedAssetId: "asset-e4" }),
        editedAsset: buildAsset({ id: "asset-e4" }),
        generatedDesign: null,
        designReview: null,
        imageFilename: "images/var-004.png",
        originalFilename: "originals/var-004.png",
      }),
      // 5. plain + review
      buildItemInput({
        item: buildItem({ id: "item-5" }),
        imageFilename: "images/var-005.png",
      }),
    ];
    const out = buildManifest({
      set: buildSet(),
      items,
      exportedAt: EXPORTED_AT,
      exportedBy: { userId: "user-1" },
    });
    const parsed = ManifestV1Schema.safeParse(out);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    const data = parsed.data;
    expect(data.items).toHaveLength(5);

    // Edit matrisi: 2 item edit, 3 plain
    const editedItems = data.items.filter((i) => "editedAssetId" in i);
    expect(editedItems).toHaveLength(2);
    const plainItems = data.items.filter((i) => !("editedAssetId" in i));
    expect(plainItems).toHaveLength(3);

    // Review matrisi: 3 review, 2 noreview
    const reviewedItems = data.items.filter((i) => "review" in i);
    expect(reviewedItems).toHaveLength(3);
    const noReviewItems = data.items.filter((i) => !("review" in i));
    expect(noReviewItems).toHaveLength(2);
  });

  it("JSON.stringify → JSON.parse roundtrip sonrası schema valid (serialize stable)", () => {
    const out = buildManifest({
      set: buildSet({
        sourceMetadata: {
          kind: "variation-batch",
          referenceId: "ref-9",
          batchId: "batch-1",
          productTypeId: "pt-1",
          batchCreatedAt: "2026-04-29T10:00:00.000Z",
          originalCount: 6,
        },
      }),
      items: [
        buildItemInput({
          item: buildItem({ editedAssetId: "asset-e" }),
          editedAsset: buildAsset({ id: "asset-e" }),
          imageFilename: "images/var-001.png",
          originalFilename: "originals/var-001.png",
        }),
        buildItemInput({
          item: buildItem({ id: "item-2" }),
          generatedDesign: null,
          designReview: null,
          imageFilename: "images/var-002.png",
        }),
      ],
      exportedAt: EXPORTED_AT,
      exportedBy: { userId: "user-1" },
    });

    const json = JSON.stringify(out);
    const reparsed = JSON.parse(json) as unknown;
    const parsed = ManifestV1Schema.safeParse(reparsed);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    // Roundtrip sonrası shape stabil — undefined alanlar yokluk olarak kalır.
    const item1 = parsed.data.items[0]!;
    expect(item1.originalFilename).toBe("originals/var-001.png");
    expect(item1.editedAssetId).toBe("asset-e");
    expect(item1.review).toBeDefined();

    const item2 = parsed.data.items[1]!;
    expect("originalFilename" in item2).toBe(false);
    expect("editedAssetId" in item2).toBe(false);
    expect("review" in item2).toBe(false);
  });

  it("set.sourceMetadata null → schema valid; record → schema valid", () => {
    // Null branch
    const outNull = buildManifest({
      set: buildSet({ sourceMetadata: null }),
      items: [],
      exportedAt: EXPORTED_AT,
      exportedBy: { userId: "user-1" },
    });
    expect(ManifestV1Schema.safeParse(outNull).success).toBe(true);

    // Record branch
    const outRecord = buildManifest({
      set: buildSet({
        sourceMetadata: {
          kind: "variation-batch",
          referenceId: "ref-1",
          batchId: "batch-1",
          productTypeId: "pt-1",
          batchCreatedAt: "2026-04-29T10:00:00.000Z",
          originalCount: 6,
        },
      }),
      items: [],
      exportedAt: EXPORTED_AT,
      exportedBy: { userId: "user-1" },
    });
    expect(ManifestV1Schema.safeParse(outRecord).success).toBe(true);
  });

  it("Phase 8 handoff shape contract — bilinen anahtarlar discriminator olarak garantili", () => {
    // Phase 8 Mockup Studio bu anahtarları okuyacak. Shape sözleşmesi.
    const out = buildManifest({
      set: buildSet(),
      items: [buildItemInput()],
      exportedAt: EXPORTED_AT,
      exportedBy: { userId: "user-1" },
    });
    const parsed = ManifestV1Schema.parse(out); // throw if invalid

    // Top-level discriminator
    expect(parsed.schemaVersion).toBe("1");
    expect(parsed.exportedAt).toBeDefined();
    expect(parsed.exportedBy.userId).toBeDefined();
    expect(parsed.set).toBeDefined();
    expect(Array.isArray(parsed.items)).toBe(true);

    // Item shape kontratı
    const item = parsed.items[0]!;
    expect(item.filename).toBeDefined();
    expect(item.generatedDesignId).toBeDefined();
    expect(item.sourceAssetId).toBeDefined();
    expect(Array.isArray(item.editHistory)).toBe(true);
    expect(item.status).toBeDefined();
    expect(item.metadata.width).toBeDefined();
    expect(item.metadata.height).toBeDefined();
    expect(item.metadata.mimeType).toBeDefined();
  });
});
