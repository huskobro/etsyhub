import { describe, it, expect } from "vitest";
import {
  LISTING_META_PROMPT_VERSION,
  buildListingMetaUserPrompt,
} from "@/providers/listing-meta-ai/prompt";

/**
 * Phase 9 V1 Task 5 — Listing-meta prompt tests.
 *
 * Phase 6 review-prompt-version emsali — version pin + prompt assembly.
 */

describe("LISTING_META_PROMPT_VERSION", () => {
  it("v1.0 pinned", () => {
    expect(LISTING_META_PROMPT_VERSION).toBe("v1.0");
  });
});

describe("buildListingMetaUserPrompt", () => {
  it("productType + tüm alanlarla string'e ekler", () => {
    const out = buildListingMetaUserPrompt({
      productType: "wall_art",
      currentTitle: "My Title",
      currentDescription: "Short desc",
      currentTags: ["a", "b", "c"],
      category: "canvas",
      materials: ["paper", "ink"],
      toneHint: "minimalist",
    });
    expect(out).toContain("Ürün tipi: wall_art");
    expect(out).toContain("Kategori: canvas");
    expect(out).toContain("Malzemeler: paper, ink");
    expect(out).toContain("Mevcut başlık (referans): My Title");
    expect(out).toContain("Mevcut açıklama (referans): Short desc");
    expect(out).toContain("Mevcut tags (referans): a, b, c");
    expect(out).toContain("Ton: minimalist");
  });

  it("toneHint geçilmezse 'Ton:' satırı YOK", () => {
    const out = buildListingMetaUserPrompt({
      productType: "wall_art",
      currentTitle: null,
      currentDescription: null,
      currentTags: [],
      category: null,
      materials: [],
    });
    expect(out).not.toContain("Ton:");
  });

  it("category null ise 'Kategori:' satırı YOK", () => {
    const out = buildListingMetaUserPrompt({
      productType: "wall_art",
      currentTitle: null,
      currentDescription: null,
      currentTags: [],
      category: null,
      materials: [],
    });
    expect(out).not.toContain("Kategori:");
  });

  it("materials boşsa 'Malzemeler:' satırı YOK", () => {
    const out = buildListingMetaUserPrompt({
      productType: "wall_art",
      currentTitle: null,
      currentDescription: null,
      currentTags: [],
      category: null,
      materials: [],
    });
    expect(out).not.toContain("Malzemeler:");
  });

  it("materials listesi virgülle eklenir", () => {
    const out = buildListingMetaUserPrompt({
      productType: "clipart",
      currentTitle: null,
      currentDescription: null,
      currentTags: [],
      category: null,
      materials: ["png", "svg", "jpg"],
    });
    expect(out).toContain("Malzemeler: png, svg, jpg");
  });

  it("currentTitle/currentDescription null ise satırlar YOK", () => {
    const out = buildListingMetaUserPrompt({
      productType: "wall_art",
      currentTitle: null,
      currentDescription: null,
      currentTags: [],
      category: null,
      materials: [],
    });
    expect(out).not.toContain("Mevcut başlık");
    expect(out).not.toContain("Mevcut açıklama");
  });

  it("currentTags boşsa 'Mevcut tags' satırı YOK", () => {
    const out = buildListingMetaUserPrompt({
      productType: "wall_art",
      currentTitle: null,
      currentDescription: null,
      currentTags: [],
      category: null,
      materials: [],
    });
    expect(out).not.toContain("Mevcut tags");
  });
});
