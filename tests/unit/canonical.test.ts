import { describe, expect, it } from "vitest";
import { SourcePlatform } from "@prisma/client";
import {
  canonicalizeEtsyShopName,
  canonicalizeListingUrl,
  canonicalizeExternalId,
} from "@/features/competitors/services/canonical";

describe("canonicalizeEtsyShopName", () => {
  it("URL'den shop name çıkarır (query param ile)", () => {
    expect(canonicalizeEtsyShopName("https://www.etsy.com/shop/FooBar?ref=search")).toBe("foobar");
  });

  it("URL'den shop name çıkarır (locale prefix ile)", () => {
    expect(canonicalizeEtsyShopName("https://www.etsy.com/uk/shop/FooBar/")).toBe("foobar");
  });

  it("URL'den shop name çıkarır (tr locale)", () => {
    expect(canonicalizeEtsyShopName("https://www.etsy.com/tr/shop/FooBar/")).toBe("foobar");
  });

  it("URL'den shop name çıkarır (trailing slash yok)", () => {
    expect(canonicalizeEtsyShopName("https://www.etsy.com/shop/FooBar")).toBe("foobar");
  });

  it("düz shop name lowercase yapar", () => {
    expect(canonicalizeEtsyShopName("FooBar")).toBe("foobar");
  });

  it("baştaki ve sondaki boşlukları kırpar", () => {
    expect(canonicalizeEtsyShopName("  foobar  ")).toBe("foobar");
  });

  it("tüm lowercase URL de çalışır", () => {
    expect(canonicalizeEtsyShopName("https://www.etsy.com/shop/myshop")).toBe("myshop");
  });

  it("fragment kırpılır", () => {
    expect(canonicalizeEtsyShopName("https://www.etsy.com/shop/FooBar#about")).toBe("foobar");
  });
});

describe("canonicalizeListingUrl", () => {
  it("query param kırpılır", () => {
    expect(canonicalizeListingUrl("https://www.etsy.com/listing/123/foo?ref=abc")).toBe(
      "https://www.etsy.com/listing/123/foo",
    );
  });

  it("http → https + www. eklenir", () => {
    expect(canonicalizeListingUrl("http://etsy.com/listing/123/foo/")).toBe(
      "https://www.etsy.com/listing/123/foo",
    );
  });

  it("fragment kırpılır", () => {
    expect(canonicalizeListingUrl("https://www.etsy.com/listing/123/foo#reviews")).toBe(
      "https://www.etsy.com/listing/123/foo",
    );
  });

  it("trailing slash kırpılır", () => {
    expect(canonicalizeListingUrl("https://www.etsy.com/listing/123/foo/")).toBe(
      "https://www.etsy.com/listing/123/foo",
    );
  });

  it("zaten canonicalize edilmiş URL değişmez", () => {
    expect(canonicalizeListingUrl("https://www.etsy.com/listing/123/foo")).toBe(
      "https://www.etsy.com/listing/123/foo",
    );
  });
});

describe("canonicalizeExternalId", () => {
  it("Etsy: boşluk kırpılır", () => {
    expect(canonicalizeExternalId(" 1234567890 ", SourcePlatform.ETSY)).toBe("1234567890");
  });

  it("Amazon: uppercase yapılır", () => {
    expect(canonicalizeExternalId("b07xxxxxxx", SourcePlatform.AMAZON)).toBe("B07XXXXXXX");
  });

  it("Amazon: zaten uppercase ise değişmez", () => {
    expect(canonicalizeExternalId("B07XXXXXXX", SourcePlatform.AMAZON)).toBe("B07XXXXXXX");
  });

  it("Etsy: case değişmez (sadece trim)", () => {
    expect(canonicalizeExternalId("  MyId123  ", SourcePlatform.ETSY)).toBe("MyId123");
  });
});
