import { describe, it, expect } from "vitest";
import { db } from "@/server/db";

describe("Phase 6 schema — review alanları", () => {
  it("GeneratedDesign reviewStatusSource alanına sahip", async () => {
    const result = await db.$queryRawUnsafe<{ column_name: string }[]>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'GeneratedDesign' AND column_name = 'reviewStatusSource'`,
    );
    expect(result.length).toBe(1);
  });

  it("GeneratedDesign reviewProviderSnapshot text/varchar tipinde", async () => {
    const result = await db.$queryRawUnsafe<{ data_type: string }[]>(
      `SELECT data_type FROM information_schema.columns
       WHERE table_name = 'GeneratedDesign' AND column_name = 'reviewProviderSnapshot'`,
    );
    expect(result.length).toBe(1);
    // String tipi: text veya character varying
    const row = result[0];
    expect(row).toBeDefined();
    expect(["text", "character varying"]).toContain(row!.data_type);
  });

  it("LocalLibraryAsset reviewStatus alanına sahip", async () => {
    const result = await db.$queryRawUnsafe<{ column_name: string }[]>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'LocalLibraryAsset' AND column_name = 'reviewStatus'`,
    );
    expect(result.length).toBe(1);
  });

  it("LocalLibraryAsset 9 review alanının hepsi mevcut", async () => {
    const expected = [
      "reviewStatus",
      "reviewStatusSource",
      "reviewScore",
      "reviewSummary",
      "reviewIssues",
      "reviewRiskFlags",
      "reviewedAt",
      "reviewProviderSnapshot",
      "reviewPromptSnapshot",
    ];
    const result = await db.$queryRawUnsafe<{ column_name: string }[]>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'LocalLibraryAsset' AND column_name = ANY($1::text[])`,
      expected,
    );
    const got = result.map((r) => r.column_name).sort();
    expect(got).toEqual(expected.slice().sort());
  });

  it("ReviewStatusSource enum SYSTEM ve USER label'larını içerir", async () => {
    const result = await db.$queryRawUnsafe<{ enumlabel: string }[]>(
      `SELECT enumlabel FROM pg_enum
       WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ReviewStatusSource')`,
    );
    const labels = result.map((r) => r.enumlabel).sort();
    expect(labels).toEqual(["SYSTEM", "USER"]);
  });

  it("DesignReview audit alanları (provider, model, promptSnapshot, responseSnapshot) eklendi", async () => {
    const expected = ["provider", "model", "promptSnapshot", "responseSnapshot"];
    const result = await db.$queryRawUnsafe<{ column_name: string }[]>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'DesignReview' AND column_name = ANY($1::text[])`,
      expected,
    );
    const got = result.map((r) => r.column_name).sort();
    expect(got).toEqual(expected.slice().sort());
  });

  it("Legacy GeneratedDesign.riskFlags alanı hala mevcut (silinmedi)", async () => {
    const result = await db.$queryRawUnsafe<{ column_name: string }[]>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'GeneratedDesign' AND column_name = 'riskFlags'`,
    );
    expect(result.length).toBe(1);
  });
});
