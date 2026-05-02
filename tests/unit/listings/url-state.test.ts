/**
 * Phase 9 V1 Task 19 — Listing URL state validation.
 *
 * Test: listing path param format (cuid).
 * Flat path K4 lock: /listings/draft/[id]
 *
 * V1 scope: validate param shape (no schema mutation, no edge case routes).
 */

import { describe, it, expect } from "vitest";

/**
 * Minimal CUID validator — 21 chars, alphanumeric + underscore
 * (reference: prisma cuid() output).
 */
function isCUID(value: string): boolean {
  return /^[a-z0-9_]{21}$/.test(value);
}

describe("Listing URL State", () => {
  it("should accept valid listing draft path (flat /listings/draft/[id])", () => {
    const validCUID = "clxywzk3f0000gl6h7k5j";
    const path = `/listings/draft/${validCUID}`;

    // Extract ID from path
    const match = path.match(/^\/listings\/draft\/([a-z0-9_]{21})$/);
    expect(match).toBeTruthy();
    expect(match?.[1]).toBe(validCUID);
  });

  it("should reject invalid CUID format (too short)", () => {
    const invalidCUID = "short";
    const path = `/listings/draft/${invalidCUID}`;

    const match = path.match(/^\/listings\/draft\/([a-z0-9_]{21})$/);
    expect(match).toBeNull();
  });

  it("should reject invalid CUID format (uppercase)", () => {
    const invalidCUID = "CLXYWZK3F0000GL6H7K5J";
    const path = `/listings/draft/${invalidCUID}`;

    const match = path.match(/^\/listings\/draft\/([a-z0-9_]{21})$/);
    expect(match).toBeNull();
  });

  it("should reject invalid CUID format (special chars)", () => {
    const invalidCUID = "clxywzk3f0000gl6h7k5!";
    const path = `/listings/draft/${invalidCUID}`;

    const match = path.match(/^\/listings\/draft\/([a-z0-9_]{21})$/);
    expect(match).toBeNull();
  });

  it("should not allow nested paths (no /edit, no /submit)", () => {
    const validCUID = "clxywzk3f0000gl6h7k5j";
    const nestedPath = `/listings/draft/${validCUID}/edit`;

    const match = nestedPath.match(/^\/listings\/draft\/([a-z0-9_]{21})$/);
    expect(match).toBeNull();
  });

  it("should not match wrong base path (/listings/detail instead of /listings/draft)", () => {
    const validCUID = "clxywzk3f0000gl6h7k5j";
    const wrongPath = `/listings/detail/${validCUID}`;

    const match = wrongPath.match(/^\/listings\/draft\/([a-z0-9_]{21})$/);
    expect(match).toBeNull();
  });
});
