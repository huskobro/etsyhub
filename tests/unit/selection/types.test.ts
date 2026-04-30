// Phase 7 — Task 2: Selection types + zod schemas
//
// TDD test'i — Task 2 spec satır listesini birebir kapsar:
//   - CreateSelectionSetInputSchema (boş/whitespace name reject; valid pass)
//   - BulkDeleteInputSchema (TypingConfirmation sentinel "SİL" zorunlu;
//     boş itemIds reject)
//   - EditOpInputSchema (discriminated union — invalid op/ratio reject;
//     crop+ratio valid; transparent-check valid)
//   - UpdateItemStatusInputSchema (sadece pending/selected/rejected)
//   - FinalizeInputSchema (.strict — extra alan reject)
//   - QuickStartInputSchema (source literal "variation-batch")
//
// TypingConfirmation sentinel teyidi:
//   src/components/ui/TypingConfirmation.tsx → phrase = "SİL" (Türkçe büyük İ).
//   Bu schema sentinel'i SERVER-SIDE enforce eder (design Section 7.2).

import { describe, expect, it } from "vitest";

import {
  AddItemsInputSchema,
  ArchiveInputSchema,
  BulkDeleteInputSchema,
  BulkUpdateStatusInputSchema,
  CreateSelectionSetInputSchema,
  EditOpInputSchema,
  FinalizeInputSchema,
  QuickStartInputSchema,
  ReorderInputSchema,
  UpdateItemStatusInputSchema,
} from "@/server/services/selection/types";

describe("CreateSelectionSetInputSchema", () => {
  it("rejects empty name", () => {
    expect(CreateSelectionSetInputSchema.safeParse({ name: "" }).success).toBe(
      false,
    );
  });

  it("rejects whitespace-only name", () => {
    // .trim().min(1) → trim sonrası boş olan reject
    expect(
      CreateSelectionSetInputSchema.safeParse({ name: "   " }).success,
    ).toBe(false);
  });

  it("accepts a valid name", () => {
    const result = CreateSelectionSetInputSchema.safeParse({
      name: "Boho Wall Art Aralık",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing name field", () => {
    expect(CreateSelectionSetInputSchema.safeParse({}).success).toBe(false);
  });
});

describe("BulkDeleteInputSchema (TypingConfirmation server-side)", () => {
  it("accepts when confirmation is exactly 'SİL'", () => {
    const result = BulkDeleteInputSchema.safeParse({
      itemIds: ["item-1"],
      confirmation: "SİL",
    });
    expect(result.success).toBe(true);
  });

  it("rejects lowercase 'sil'", () => {
    expect(
      BulkDeleteInputSchema.safeParse({
        itemIds: ["item-1"],
        confirmation: "sil",
      }).success,
    ).toBe(false);
  });

  it("rejects ASCII 'SIL' (no Turkish dotted İ)", () => {
    expect(
      BulkDeleteInputSchema.safeParse({
        itemIds: ["item-1"],
        confirmation: "SIL",
      }).success,
    ).toBe(false);
  });

  it("rejects whitespace-padded confirmation", () => {
    // TypingConfirmation primitive trim YAPMAZ → server-side aynı sözleşme
    expect(
      BulkDeleteInputSchema.safeParse({
        itemIds: ["item-1"],
        confirmation: " SİL ",
      }).success,
    ).toBe(false);
  });

  it("rejects empty itemIds array (min 1)", () => {
    expect(
      BulkDeleteInputSchema.safeParse({
        itemIds: [],
        confirmation: "SİL",
      }).success,
    ).toBe(false);
  });

  it("rejects missing confirmation field", () => {
    expect(
      BulkDeleteInputSchema.safeParse({ itemIds: ["item-1"] }).success,
    ).toBe(false);
  });
});

describe("EditOpInputSchema (discriminated union)", () => {
  it("accepts crop with valid ratio 2:3", () => {
    const result = EditOpInputSchema.safeParse({
      op: "crop",
      params: { ratio: "2:3" },
    });
    expect(result.success).toBe(true);
  });

  it("accepts crop with valid ratio 1:1", () => {
    expect(
      EditOpInputSchema.safeParse({ op: "crop", params: { ratio: "1:1" } })
        .success,
    ).toBe(true);
  });

  it("rejects crop with invalid ratio", () => {
    expect(
      EditOpInputSchema.safeParse({
        op: "crop",
        params: { ratio: "16:9" },
      }).success,
    ).toBe(false);
  });

  it("rejects crop without params", () => {
    expect(EditOpInputSchema.safeParse({ op: "crop" }).success).toBe(false);
  });

  it("accepts transparent-check without params", () => {
    expect(
      EditOpInputSchema.safeParse({ op: "transparent-check" }).success,
    ).toBe(true);
  });

  it("accepts background-remove without params", () => {
    expect(
      EditOpInputSchema.safeParse({ op: "background-remove" }).success,
    ).toBe(true);
  });

  it("rejects unknown op", () => {
    expect(
      EditOpInputSchema.safeParse({ op: "magic-wand" }).success,
    ).toBe(false);
  });

  it("rejects missing op field", () => {
    expect(EditOpInputSchema.safeParse({}).success).toBe(false);
  });
});

describe("UpdateItemStatusInputSchema", () => {
  it.each(["pending", "selected", "rejected"] as const)(
    "accepts status '%s'",
    (status) => {
      expect(UpdateItemStatusInputSchema.safeParse({ status }).success).toBe(
        true,
      );
    },
  );

  it("rejects unknown status 'approved'", () => {
    expect(
      UpdateItemStatusInputSchema.safeParse({ status: "approved" }).success,
    ).toBe(false);
  });

  it("rejects empty body", () => {
    expect(UpdateItemStatusInputSchema.safeParse({}).success).toBe(false);
  });
});

describe("BulkUpdateStatusInputSchema", () => {
  it("accepts itemIds + valid status", () => {
    expect(
      BulkUpdateStatusInputSchema.safeParse({
        itemIds: ["a", "b"],
        status: "selected",
      }).success,
    ).toBe(true);
  });

  it("rejects empty itemIds", () => {
    expect(
      BulkUpdateStatusInputSchema.safeParse({
        itemIds: [],
        status: "selected",
      }).success,
    ).toBe(false);
  });

  it("rejects invalid status", () => {
    expect(
      BulkUpdateStatusInputSchema.safeParse({
        itemIds: ["a"],
        status: "archived",
      }).success,
    ).toBe(false);
  });
});

describe("FinalizeInputSchema (.strict)", () => {
  it("accepts empty body", () => {
    expect(FinalizeInputSchema.safeParse({}).success).toBe(true);
  });

  it("rejects extra fields", () => {
    expect(FinalizeInputSchema.safeParse({ force: true }).success).toBe(false);
  });
});

describe("ArchiveInputSchema (.strict)", () => {
  it("accepts empty body", () => {
    expect(ArchiveInputSchema.safeParse({}).success).toBe(true);
  });

  it("rejects extra fields", () => {
    expect(ArchiveInputSchema.safeParse({ reason: "spring clean" }).success).toBe(
      false,
    );
  });
});

describe("QuickStartInputSchema", () => {
  it("accepts canonical variation-batch payload", () => {
    const result = QuickStartInputSchema.safeParse({
      source: "variation-batch",
      referenceId: "ref-1",
      batchId: "batch-1",
      productTypeId: "wall-art",
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-literal source", () => {
    expect(
      QuickStartInputSchema.safeParse({
        source: "manual",
        referenceId: "ref-1",
        batchId: "batch-1",
        productTypeId: "wall-art",
      }).success,
    ).toBe(false);
  });

  it("rejects missing referenceId", () => {
    expect(
      QuickStartInputSchema.safeParse({
        source: "variation-batch",
        batchId: "batch-1",
        productTypeId: "wall-art",
      }).success,
    ).toBe(false);
  });

  it("rejects empty referenceId", () => {
    expect(
      QuickStartInputSchema.safeParse({
        source: "variation-batch",
        referenceId: "",
        batchId: "batch-1",
        productTypeId: "wall-art",
      }).success,
    ).toBe(false);
  });
});

describe("AddItemsInputSchema", () => {
  it("accepts array of generatedDesignId entries", () => {
    expect(
      AddItemsInputSchema.safeParse({
        items: [{ generatedDesignId: "gd-1" }, { generatedDesignId: "gd-2" }],
      }).success,
    ).toBe(true);
  });

  it("rejects empty items array", () => {
    expect(AddItemsInputSchema.safeParse({ items: [] }).success).toBe(false);
  });

  it("rejects entries without generatedDesignId", () => {
    expect(
      AddItemsInputSchema.safeParse({ items: [{}] }).success,
    ).toBe(false);
  });
});

describe("ReorderInputSchema", () => {
  it("accepts non-empty itemIds list", () => {
    expect(
      ReorderInputSchema.safeParse({ itemIds: ["a", "b", "c"] }).success,
    ).toBe(true);
  });

  it("rejects empty itemIds list", () => {
    expect(ReorderInputSchema.safeParse({ itemIds: [] }).success).toBe(false);
  });
});
