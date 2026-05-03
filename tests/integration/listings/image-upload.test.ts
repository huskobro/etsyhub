import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  uploadListingImages,
  ListingImageUploadAllFailedError,
} from "@/features/listings/server/image-upload.service";
import type { ListingImageOrderEntry } from "@/features/listings/types";

vi.mock("@/providers/storage", () => ({ getStorage: vi.fn() }));
vi.mock("@/providers/etsy", async () => {
  const actual = await vi.importActual<typeof import("@/providers/etsy")>("@/providers/etsy");
  return { ...actual, getEtsyProvider: vi.fn() };
});

import { getStorage } from "@/providers/storage";
import { getEtsyProvider } from "@/providers/etsy";

const fakeBuffer = Buffer.from("fake-png");

const mockOrder: ListingImageOrderEntry[] = [
  { packPosition: 0, renderId: "r0", outputKey: "k0", templateName: "tpl-cover", isCover: true },
  { packPosition: 1, renderId: "r1", outputKey: "k1", templateName: "tpl-1", isCover: false },
  { packPosition: 2, renderId: "r2", outputKey: "k2", templateName: "tpl-2", isCover: false },
];

function setupMockStorage(downloads: (Buffer | Error)[]) {
  const calls: string[] = [];
  vi.mocked(getStorage).mockReturnValue({
    download: vi.fn().mockImplementation(async (key: string) => {
      calls.push(key);
      const i = calls.length - 1;
      const item = downloads[i];
      if (item instanceof Error) throw item;
      return item ?? fakeBuffer;
    }),
    upload: vi.fn(),
    delete: vi.fn(),
    signedUrl: vi.fn(),
    list: vi.fn(),
  } as any);
  return calls;
}

function setupMockProvider(uploads: ({ etsyImageId: string } | Error)[]) {
  const callArgs: any[] = [];
  vi.mocked(getEtsyProvider).mockReturnValue({
    id: "etsy-api",
    apiVersion: "v3",
    createDraftListing: vi.fn(),
    uploadListingImage: vi.fn().mockImplementation(async (input: any, options: any) => {
      callArgs.push({ input, options });
      const i = callArgs.length - 1;
      const item = uploads[i];
      if (item instanceof Error) throw item;
      return { etsyImageId: item?.etsyImageId ?? "default-id", rank: input.rank };
    }),
  } as any);
  return callArgs;
}

describe("uploadListingImages", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("happy path — cover-first, rank 1..N", async () => {
    setupMockStorage([fakeBuffer, fakeBuffer, fakeBuffer]);
    const callArgs = setupMockProvider([
      { etsyImageId: "img1" },
      { etsyImageId: "img2" },
      { etsyImageId: "img3" },
    ]);

    const result = await uploadListingImages({
      etsyListingId: "etsy-listing-1",
      imageOrder: mockOrder,
      accessToken: "token",
      shopId: "shop-1",
    });

    expect(result.successCount).toBe(3);
    expect(result.failedCount).toBe(0);
    expect(result.partial).toBe(false);
    expect(result.attempts[0]!.rank).toBe(1);
    expect(result.attempts[0]!.isCover).toBe(true);
    expect(result.attempts[1]!.rank).toBe(2);
    expect(result.attempts[2]!.rank).toBe(3);
    expect(callArgs[0]!.input.rank).toBe(1);
    expect(callArgs[0]!.input.imageSource.kind).toBe("buffer");
    expect(callArgs[0]!.input.imageSource.mimeType).toBe("image/png");
    expect(callArgs[0]!.options.accessToken).toBe("token");
    expect(callArgs[0]!.options.shopId).toBe("shop-1");
  });

  it("imageOrder boş → success 0, partial false (skip)", async () => {
    setupMockStorage([]);
    setupMockProvider([]);
    const result = await uploadListingImages({
      etsyListingId: "etsy-listing-1",
      imageOrder: [],
      accessToken: "token",
      shopId: "shop-1",
    });
    expect(result.successCount).toBe(0);
    expect(result.failedCount).toBe(0);
    expect(result.partial).toBe(false);
    expect(result.attempts).toEqual([]);
  });

  it("partial — bazı upload başarısız", async () => {
    setupMockStorage([fakeBuffer, fakeBuffer, fakeBuffer]);
    setupMockProvider([
      { etsyImageId: "img1" },
      new Error("Etsy 503 maintenance"),
      { etsyImageId: "img3" },
    ]);

    const result = await uploadListingImages({
      etsyListingId: "etsy-listing-1",
      imageOrder: mockOrder,
      accessToken: "token",
      shopId: "shop-1",
    });

    expect(result.successCount).toBe(2);
    expect(result.failedCount).toBe(1);
    expect(result.partial).toBe(true);
    expect(result.attempts[1]!.ok).toBe(false);
    expect((result.attempts[1] as any).error).toContain("Etsy 503 maintenance");
  });

  it("all-failed → AllFailedError", async () => {
    setupMockStorage([fakeBuffer, fakeBuffer, fakeBuffer]);
    setupMockProvider([
      new Error("503 a"),
      new Error("503 b"),
      new Error("503 c"),
    ]);

    await expect(
      uploadListingImages({
        etsyListingId: "etsy-listing-1",
        imageOrder: mockOrder,
        accessToken: "token",
        shopId: "shop-1",
      }),
    ).rejects.toThrow(ListingImageUploadAllFailedError);
  });

  it("all-failed → failedRanks tüm rank'ları içerir", async () => {
    setupMockStorage([fakeBuffer, fakeBuffer, fakeBuffer]);
    setupMockProvider([
      new Error("a"),
      new Error("b"),
      new Error("c"),
    ]);

    let caught: ListingImageUploadAllFailedError | null = null;
    try {
      await uploadListingImages({
        etsyListingId: "etsy-listing-1",
        imageOrder: mockOrder,
        accessToken: "token",
        shopId: "shop-1",
      });
    } catch (e) {
      caught = e as ListingImageUploadAllFailedError;
    }
    expect(caught).toBeInstanceOf(ListingImageUploadAllFailedError);
    expect(caught!.failedRanks).toEqual([1, 2, 3]);
  });

  it("storage download fail — attempt failed olarak yansır", async () => {
    setupMockStorage([new Error("MinIO down"), fakeBuffer, fakeBuffer]);
    setupMockProvider([{ etsyImageId: "img2" }, { etsyImageId: "img3" }]);

    const result = await uploadListingImages({
      etsyListingId: "etsy-listing-1",
      imageOrder: mockOrder,
      accessToken: "token",
      shopId: "shop-1",
    });

    expect(result.successCount).toBe(2);
    expect(result.failedCount).toBe(1);
    expect(result.partial).toBe(true);
    expect(result.attempts[0]!.isCover).toBe(true);
    expect(result.attempts[0]!.ok).toBe(false);
  });

  it("Etsy 10 image cap — 12 entry'den 10'u upload edilir", async () => {
    const longOrder: ListingImageOrderEntry[] = Array.from({ length: 12 }, (_, i) => ({
      packPosition: i,
      renderId: `r${i}`,
      outputKey: `k${i}`,
      templateName: `tpl-${i}`,
      isCover: i === 0,
    }));
    setupMockStorage(Array.from({ length: 10 }, () => fakeBuffer));
    setupMockProvider(Array.from({ length: 10 }, (_, i) => ({ etsyImageId: `img${i}` })));

    const result = await uploadListingImages({
      etsyListingId: "etsy-listing-1",
      imageOrder: longOrder,
      accessToken: "token",
      shopId: "shop-1",
    });

    expect(result.successCount).toBe(10);
    expect(result.attempts).toHaveLength(10);
  });

  it("shuffled imageOrder packPosition ASC sıralanır", async () => {
    const shuffled: ListingImageOrderEntry[] = [
      { packPosition: 2, renderId: "r2", outputKey: "k2", templateName: "tpl", isCover: false },
      { packPosition: 0, renderId: "r0", outputKey: "k0", templateName: "tpl", isCover: true },
      { packPosition: 1, renderId: "r1", outputKey: "k1", templateName: "tpl", isCover: false },
    ];
    setupMockStorage([fakeBuffer, fakeBuffer, fakeBuffer]);
    const callArgs = setupMockProvider([
      { etsyImageId: "i1" },
      { etsyImageId: "i2" },
      { etsyImageId: "i3" },
    ]);

    const result = await uploadListingImages({
      etsyListingId: "L",
      imageOrder: shuffled,
      accessToken: "t",
      shopId: "s",
    });

    expect(result.attempts[0]!.packPosition).toBe(0);
    expect(result.attempts[0]!.isCover).toBe(true);
    expect(result.attempts[1]!.packPosition).toBe(1);
    expect(result.attempts[2]!.packPosition).toBe(2);
    expect(callArgs[0]!.input.rank).toBe(1);
  });
});
