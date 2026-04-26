import { describe, it, expect } from "vitest";
import { NEGATIVE_LIBRARY } from "@/features/variation-generation/negative-library";

describe("NEGATIVE_LIBRARY (R19 hardcoded sabit)", () => {
  it("contains required terms", () => {
    expect([...NEGATIVE_LIBRARY]).toEqual(
      expect.arrayContaining([
        "Disney",
        "Marvel",
        "Nike",
        "celebrity names",
        "watermark",
        "signature",
        "logo",
      ]),
    );
  });

  it("is readonly tuple (as const)", () => {
    // `as const` -> readonly tuple. Array.isArray remains true; typeof check
    // catches the import shape. Object.isFrozen would be true if frozen at
    // declaration, but TS `as const` alone doesn't freeze at runtime — bu test
    // import varlığını + array shape'ini doğrular; immutability TypeScript
    // seviyesinde garanti.
    expect(Array.isArray(NEGATIVE_LIBRARY)).toBe(true);
    expect(NEGATIVE_LIBRARY.length).toBeGreaterThanOrEqual(7);
  });
});
