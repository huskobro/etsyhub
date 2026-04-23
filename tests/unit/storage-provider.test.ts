import { describe, expect, it, beforeAll } from "vitest";
import { MinioStorage } from "@/providers/storage/minio-provider";
import { ensureBucket } from "@/providers/storage/init";

describe("MinioStorage", () => {
  beforeAll(async () => {
    await ensureBucket();
  });

  it("upload + download round-trip buffer'ı aynen döner", async () => {
    const s = new MinioStorage();
    const key = `test/roundtrip-${Date.now()}.txt`;
    const body = Buffer.from("hello etsyhub");
    await s.upload(key, body, { contentType: "text/plain" });
    const back = await s.download(key);
    expect(back.toString()).toBe("hello etsyhub");
    await s.delete(key);
  });

  it("signedUrl expiresIn içeren geçerli URL üretir", async () => {
    const s = new MinioStorage();
    const key = `test/signed-${Date.now()}.txt`;
    await s.upload(key, Buffer.from("x"), { contentType: "text/plain" });
    const url = await s.signedUrl(key, 60);
    expect(url).toMatch(/^http/);
    expect(url).toContain(key);
    await s.delete(key);
  });
});
