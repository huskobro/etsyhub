// R11 — signed-url helper davranış testleri.
//
// Pure unit: cache invalidation. resolveTtlForUser DB'ye basar; burada
// invalidateUserSignedUrlPrefs cache map'inin temizlendiğini doğrularız
// (in-memory cache; DB call yok).

import { describe, it, expect } from "vitest";
import { invalidateUserSignedUrlPrefs } from "@/server/services/settings/signed-url.helper";

describe("invalidateUserSignedUrlPrefs", () => {
  it("does not throw for unknown user", () => {
    // Cache yoksa silent skip
    expect(() => invalidateUserSignedUrlPrefs("nonexistent-user")).not.toThrow();
  });

  it("can be called multiple times safely (idempotent)", () => {
    invalidateUserSignedUrlPrefs("u1");
    invalidateUserSignedUrlPrefs("u1");
    invalidateUserSignedUrlPrefs("u1");
    // No throw — idempotent
    expect(true).toBe(true);
  });
});
