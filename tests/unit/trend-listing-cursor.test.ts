import { describe, expect, it } from "vitest";
import { encodeListingCursor, decodeListingCursor } from "@/features/trend-stories/services/listing-cursor";

describe("listing cursor", () => {
  it("round-trip", () => {
    const seen = new Date("2026-04-24T12:34:56.000Z");
    const cur = encodeListingCursor({ firstSeenAt: seen, listingId: "l_abc" });
    expect(decodeListingCursor(cur)).toEqual({ firstSeenAt: seen, listingId: "l_abc" });
  });
  it("bozuk cursor → null", () => {
    expect(decodeListingCursor("not-base64!")).toBeNull();
    expect(decodeListingCursor(Buffer.from("just-a-string").toString("base64"))).toBeNull();
  });
  it("empty → null", () => {
    expect(decodeListingCursor("")).toBeNull();
  });
});
