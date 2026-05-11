// R11 — Storage prefs schema testleri.

import { describe, it, expect } from "vitest";
import { StoragePrefsSchema } from "@/server/services/settings/storage-prefs.service";

describe("StoragePrefsSchema", () => {
  it("applies defaults: 1h signed URL, 1h thumbnail cache", () => {
    const parsed = StoragePrefsSchema.parse({});
    expect(parsed.signedUrlTtlSeconds).toBe(3600);
    expect(parsed.thumbnailCacheSeconds).toBe(3600);
  });

  it("rejects TTL below 5min (300s)", () => {
    const r = StoragePrefsSchema.safeParse({ signedUrlTtlSeconds: 100 });
    expect(r.success).toBe(false);
  });

  it("rejects TTL above 12h", () => {
    const r = StoragePrefsSchema.safeParse({ signedUrlTtlSeconds: 60_000 });
    expect(r.success).toBe(false);
  });

  it("accepts boundaries: 300s and 43200s", () => {
    expect(() =>
      StoragePrefsSchema.parse({ signedUrlTtlSeconds: 300 }),
    ).not.toThrow();
    expect(() =>
      StoragePrefsSchema.parse({ signedUrlTtlSeconds: 43200 }),
    ).not.toThrow();
  });
});
