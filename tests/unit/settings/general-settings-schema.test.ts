// R11 — General settings schema testleri (UserSetting key="general").

import { describe, it, expect } from "vitest";
import { GeneralSettingsSchema } from "@/server/services/settings/general.service";

describe("GeneralSettingsSchema", () => {
  it("applies defaults when input is empty", () => {
    const parsed = GeneralSettingsSchema.parse({});
    expect(parsed.density).toBe("comfortable");
    expect(parsed.language).toBe("en-US");
    expect(parsed.dateFormat).toBe("relative");
    expect(parsed.theme).toBe("light");
  });

  it("rejects invalid density", () => {
    const result = GeneralSettingsSchema.safeParse({ density: "huge" });
    expect(result.success).toBe(false);
  });

  it("partial parse keeps existing values", () => {
    const parsed = GeneralSettingsSchema.partial().parse({ density: "dense" });
    expect(parsed.density).toBe("dense");
    expect(parsed.language).toBeUndefined();
  });

  it("accepts all 3 supported languages", () => {
    for (const lang of ["en-US", "tr", "de"] as const) {
      expect(() => GeneralSettingsSchema.parse({ language: lang })).not.toThrow();
    }
  });
});
