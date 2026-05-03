import { describe, it, expect, beforeEach, afterAll } from "vitest";
import {
  resolveEtsyTaxonomyId,
  tryResolveEtsyTaxonomyId,
  resetTaxonomyCache,
  EtsyTaxonomyConfigError,
  EtsyTaxonomyMissingError,
} from "@/providers/etsy/taxonomy";

const ORIG = process.env.ETSY_TAXONOMY_MAP_JSON;

describe("Etsy taxonomy mapping", () => {
  beforeEach(() => {
    resetTaxonomyCache();
    delete process.env.ETSY_TAXONOMY_MAP_JSON;
  });

  afterAll(() => {
    if (ORIG === undefined) delete process.env.ETSY_TAXONOMY_MAP_JSON;
    else process.env.ETSY_TAXONOMY_MAP_JSON = ORIG;
    resetTaxonomyCache();
  });

  it("env yoksa MissingError", () => {
    expect(() => resolveEtsyTaxonomyId("wall_art")).toThrow(EtsyTaxonomyMissingError);
  });

  it("happy path — env'den ID döner", () => {
    process.env.ETSY_TAXONOMY_MAP_JSON = JSON.stringify({ wall_art: 2078, sticker: 1208 });
    resetTaxonomyCache();
    expect(resolveEtsyTaxonomyId("wall_art")).toBe(2078);
    expect(resolveEtsyTaxonomyId("sticker")).toBe(1208);
  });

  it("eksik key MissingError, productTypeKey detail'de", () => {
    process.env.ETSY_TAXONOMY_MAP_JSON = JSON.stringify({ wall_art: 2078 });
    resetTaxonomyCache();
    try {
      resolveEtsyTaxonomyId("hoodie");
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(EtsyTaxonomyMissingError);
      expect((err as EtsyTaxonomyMissingError).details).toEqual({ productTypeKey: "hoodie" });
    }
  });

  it("bozuk JSON — ConfigError 503", () => {
    process.env.ETSY_TAXONOMY_MAP_JSON = "not-json";
    resetTaxonomyCache();
    expect(() => resolveEtsyTaxonomyId("wall_art")).toThrow(EtsyTaxonomyConfigError);
  });

  it("array JSON — ConfigError (object bekleniyor)", () => {
    process.env.ETSY_TAXONOMY_MAP_JSON = "[1, 2]";
    resetTaxonomyCache();
    expect(() => resolveEtsyTaxonomyId("wall_art")).toThrow(EtsyTaxonomyConfigError);
  });

  it("non-numeric value — ConfigError", () => {
    process.env.ETSY_TAXONOMY_MAP_JSON = JSON.stringify({ wall_art: "2078" });
    resetTaxonomyCache();
    expect(() => resolveEtsyTaxonomyId("wall_art")).toThrow(EtsyTaxonomyConfigError);
  });

  it("zero/negative ID — ConfigError", () => {
    process.env.ETSY_TAXONOMY_MAP_JSON = JSON.stringify({ wall_art: 0 });
    resetTaxonomyCache();
    expect(() => resolveEtsyTaxonomyId("wall_art")).toThrow(EtsyTaxonomyConfigError);
  });

  it("tryResolve: missing → null", () => {
    process.env.ETSY_TAXONOMY_MAP_JSON = JSON.stringify({ wall_art: 2078 });
    resetTaxonomyCache();
    expect(tryResolveEtsyTaxonomyId("hoodie")).toBeNull();
  });

  it("tryResolve: happy path → ID", () => {
    process.env.ETSY_TAXONOMY_MAP_JSON = JSON.stringify({ wall_art: 2078 });
    resetTaxonomyCache();
    expect(tryResolveEtsyTaxonomyId("wall_art")).toBe(2078);
  });

  it("tryResolve: bozuk JSON → null (silent)", () => {
    process.env.ETSY_TAXONOMY_MAP_JSON = "not-json";
    resetTaxonomyCache();
    expect(tryResolveEtsyTaxonomyId("wall_art")).toBeNull();
  });
});
