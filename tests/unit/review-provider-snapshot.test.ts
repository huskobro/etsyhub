import { describe, it, expect } from "vitest";
import {
  buildProviderSnapshot,
  parseProviderSnapshot,
} from "@/providers/review/snapshot";

describe("Provider snapshot string format", () => {
  it("build: tipik durumda 'model@YYYY-MM-DD' üretir", () => {
    const result = buildProviderSnapshot("gemini-2.5-flash", new Date("2026-04-28T12:34:56Z"));
    expect(result).toBe("gemini-2.5-flash@2026-04-28");
  });

  it("round-trip: build → parse → eşit model+date döner", () => {
    const built = buildProviderSnapshot("gemini-2-5-flash", new Date("2026-04-28T00:00:00Z"));
    const parsed = parseProviderSnapshot(built);
    expect(parsed.model).toBe("gemini-2-5-flash");
    expect(parsed.date).toBe("2026-04-28");
  });

  it("parse: invalid format ⇒ throw (sessiz fallback yok)", () => {
    expect(() => parseProviderSnapshot("invalid_string")).toThrow(/invalid provider snapshot/);
    expect(() => parseProviderSnapshot("model-without-date")).toThrow(/invalid provider snapshot/);
    expect(() => parseProviderSnapshot("model@bad-date")).toThrow(/invalid provider snapshot/);
    expect(() => parseProviderSnapshot("model@2026-4-28")).toThrow(/invalid provider snapshot/); // ay/gün 2 hane
    expect(() => parseProviderSnapshot("")).toThrow(/invalid provider snapshot/);
  });

  it("build: boşluk içeren model adı ⇒ throw", () => {
    expect(() => buildProviderSnapshot("bad model", new Date("2026-04-28"))).toThrow(/invalid provider model/);
  });

  it("build: boş model ⇒ throw", () => {
    expect(() => buildProviderSnapshot("", new Date("2026-04-28"))).toThrow(/invalid provider model/);
  });
});
