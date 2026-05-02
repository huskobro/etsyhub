// Phase 9 V1 Task 7 — Listing state machine tests (foundation slice).

import { describe, it, expect } from "vitest";
import {
  isValidTransition,
  assertValidTransition,
  ListingInvalidTransitionError,
  ALLOWED_TRANSITIONS,
} from "@/features/listings/server/state";

describe("Listing state machine (V1)", () => {
  describe("ALLOWED_TRANSITIONS", () => {
    it("should have all V1/V2+ status keys", () => {
      expect(Object.keys(ALLOWED_TRANSITIONS)).toContain("DRAFT");
      expect(Object.keys(ALLOWED_TRANSITIONS)).toContain("SCHEDULED");
      expect(Object.keys(ALLOWED_TRANSITIONS)).toContain("PUBLISHED");
      expect(Object.keys(ALLOWED_TRANSITIONS)).toContain("FAILED");
    });

    it("should have empty arrays for V1 (no transitions)", () => {
      expect(ALLOWED_TRANSITIONS.DRAFT).toEqual([]);
      // V2+: future transitions will be added here
    });
  });

  describe("isValidTransition()", () => {
    it("should return false for DRAFT → anything (V1 lock)", () => {
      expect(isValidTransition("DRAFT", "SCHEDULED")).toBe(false);
      expect(isValidTransition("DRAFT", "PUBLISHED")).toBe(false);
      expect(isValidTransition("DRAFT", "FAILED")).toBe(false);
      expect(isValidTransition("DRAFT", "DRAFT")).toBe(false);
    });

    it("should return false for unknown source state", () => {
      expect(isValidTransition("UNKNOWN" as any, "DRAFT")).toBe(false);
    });
  });

  describe("assertValidTransition()", () => {
    it("should throw ListingInvalidTransitionError for invalid transition", () => {
      expect(() => {
        assertValidTransition("DRAFT", "SCHEDULED");
      }).toThrow(ListingInvalidTransitionError);

      expect(() => {
        assertValidTransition("DRAFT", "PUBLISHED");
      }).toThrow(ListingInvalidTransitionError);
    });

    it("should not throw for self-loop (though not allowed in V1)", () => {
      // Self-loop also returns false, so should throw
      expect(() => {
        assertValidTransition("DRAFT", "DRAFT");
      }).toThrow(ListingInvalidTransitionError);
    });

    it("error should have correct message and code", () => {
      try {
        assertValidTransition("DRAFT", "SCHEDULED");
        throw new Error("Should not reach here");
      } catch (e) {
        expect(e).toBeInstanceOf(ListingInvalidTransitionError);
        expect((e as any).message).toContain("DRAFT");
        expect((e as any).message).toContain("SCHEDULED");
        expect((e as any).code).toBe("LISTING_INVALID_TRANSITION");
        expect((e as any).statusCode).toBe(409);
      }
    });
  });
});
