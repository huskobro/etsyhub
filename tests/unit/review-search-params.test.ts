// Phase 6 Dalga B (Task 15) — buildReviewUrl helper testleri.
//
// Sözleşme:
//   - undefined ⇒ key silinir
//   - string ⇒ key set edilir (override)
//   - empty querystring ⇒ pathname tek başına döner

import { describe, it, expect } from "vitest";
import { buildReviewUrl } from "@/features/review/lib/search-params";

describe("buildReviewUrl", () => {
  it("tek key set", () => {
    const params = new URLSearchParams("tab=ai");
    expect(
      buildReviewUrl("/review", params, { detail: "cuid123" }),
    ).toBe("/review?tab=ai&detail=cuid123");
  });

  it("undefined ile key silme", () => {
    const params = new URLSearchParams("tab=ai&detail=cuid123");
    expect(buildReviewUrl("/review", params, { detail: undefined })).toBe(
      "/review?tab=ai",
    );
  });

  it("çoklu key patch (set + delete birlikte)", () => {
    const params = new URLSearchParams("tab=ai&page=2");
    expect(
      buildReviewUrl("/review", params, { tab: "local", page: undefined }),
    ).toBe("/review?tab=local");
  });

  it("empty params + tek key", () => {
    expect(
      buildReviewUrl("/review", new URLSearchParams(), { tab: "ai" }),
    ).toBe("/review?tab=ai");
  });

  it("override existing key", () => {
    const params = new URLSearchParams("tab=ai");
    expect(buildReviewUrl("/review", params, { tab: "local" })).toBe(
      "/review?tab=local",
    );
  });

  it("tüm key'leri silince pathname dönüyor", () => {
    const params = new URLSearchParams("tab=ai");
    expect(buildReviewUrl("/review", params, { tab: undefined })).toBe(
      "/review",
    );
  });
});
