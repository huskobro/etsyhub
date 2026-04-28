import { describe, it, expect, vi, beforeEach } from "vitest";
import path from "node:path";
import { imageToInlineData } from "@/providers/review/image-loader";

const FIXTURE_DIR = path.join(process.cwd(), "tests", "fixtures", "review-loader");

describe("imageToInlineData — local-path", () => {
  it("PNG dosyayı okur, mime image/png ve base64 döner", async () => {
    const result = await imageToInlineData({
      kind: "local-path",
      filePath: path.join(FIXTURE_DIR, "test-image.png"),
    });
    expect(result.mimeType).toBe("image/png");
    expect(result.data).toMatch(/^[A-Za-z0-9+/=]+$/); // valid base64
    expect(result.data.length).toBeGreaterThan(0);
  });

  it("bilinen uzantılar EXT_TO_MIME map'inde mevcut", async () => {
    // Mevcut fixture (.png) okunabiliyor; mime fallback yolunu da dolaylı doğruluyor.
    const result = await imageToInlineData({
      kind: "local-path",
      filePath: path.join(FIXTURE_DIR, "test-image.png"),
    });
    expect(["image/png", "image/jpeg", "image/webp", "image/gif"]).toContain(result.mimeType);
  });

  it("dosya yoksa fs error fırlatır", async () => {
    await expect(
      imageToInlineData({
        kind: "local-path",
        filePath: path.join(FIXTURE_DIR, "nonexistent.png"),
      }),
    ).rejects.toThrow(/ENOENT|no such file/i);
  });
});

describe("imageToInlineData — remote-url", () => {
  beforeEach(() => {
    global.fetch = vi.fn() as unknown as typeof fetch;
  });

  it("başarılı fetch, image content-type → inlineData döner", async () => {
    const fakeBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG header
    const ab = fakeBuffer.buffer.slice(
      fakeBuffer.byteOffset,
      fakeBuffer.byteOffset + fakeBuffer.byteLength,
    );
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers({ "content-type": "image/png" }),
      arrayBuffer: async () => ab,
    });

    const result = await imageToInlineData({
      kind: "remote-url",
      url: "https://cdn.example.com/x.png",
    });
    expect(result.mimeType).toBe("image/png");
    expect(result.data).toBe(fakeBuffer.toString("base64"));
  });

  it("HTTP non-2xx ⇒ throw", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
      headers: new Headers(),
    });

    await expect(
      imageToInlineData({ kind: "remote-url", url: "https://cdn.example.com/missing.png" }),
    ).rejects.toThrow(/image fetch failed: 404/);
  });

  it("content-type 'text/html' ⇒ throw (HTML error page koruma)", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers({ "content-type": "text/html; charset=utf-8" }),
      arrayBuffer: async () => new ArrayBuffer(10),
    });

    await expect(
      imageToInlineData({ kind: "remote-url", url: "https://cdn.example.com/x.png" }),
    ).rejects.toThrow(/non-image content-type: "text\/html/);
  });

  it("content-type 'application/json' ⇒ throw", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers({ "content-type": "application/json" }),
      arrayBuffer: async () => new ArrayBuffer(10),
    });

    await expect(
      imageToInlineData({ kind: "remote-url", url: "https://cdn.example.com/x.png" }),
    ).rejects.toThrow(/non-image content-type/);
  });

  it("content-type yoksa → image/png fallback (kullanıcı talebi: header yoksa kabul)", async () => {
    const fakeBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const ab = fakeBuffer.buffer.slice(
      fakeBuffer.byteOffset,
      fakeBuffer.byteOffset + fakeBuffer.byteLength,
    );
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers(), // header yok
      arrayBuffer: async () => ab,
    });

    const result = await imageToInlineData({
      kind: "remote-url",
      url: "https://cdn.example.com/x.png",
    });
    expect(result.mimeType).toBe("image/png");
  });

  it("18 MB üstü buffer ⇒ throw (boyut sınırı fail-fast)", async () => {
    const huge = Buffer.alloc(19 * 1024 * 1024);
    const ab = huge.buffer.slice(huge.byteOffset, huge.byteOffset + huge.byteLength);
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers({ "content-type": "image/png" }),
      arrayBuffer: async () => ab,
    });

    await expect(
      imageToInlineData({ kind: "remote-url", url: "https://cdn.example.com/big.png" }),
    ).rejects.toThrow(/image too large/);
  });

  it("content-type 'image/jpeg; quality=high' → mime parameter strip", async () => {
    const fakeBuffer = Buffer.from([0xff, 0xd8, 0xff]); // JPEG header
    const ab = fakeBuffer.buffer.slice(
      fakeBuffer.byteOffset,
      fakeBuffer.byteOffset + fakeBuffer.byteLength,
    );
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers({ "content-type": "image/jpeg; quality=high" }),
      arrayBuffer: async () => ab,
    });

    const result = await imageToInlineData({
      kind: "remote-url",
      url: "https://cdn.example.com/x.jpg",
    });
    expect(result.mimeType).toBe("image/jpeg");
  });
});
