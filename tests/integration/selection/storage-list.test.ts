// Phase 7 Task 13 — Storage `list(prefix)` integration testleri.
//
// Test sözleşmesi (plan Task 13, design Section 6.5):
//   - `getStorage().list(prefix)` MinIO/S3 ListObjectsV2 üzerinden çalışır.
//   - Prefix match → yalnız eşleşen object'ler döner.
//   - Her object: { key, size, lastModified } içerir.
//   - lastModified Date instance.
//   - Boş prefix → bucket'taki tüm object'ler döner (ama testte yan etkilerden
//     kaçınmak için izole prefix kullanıyoruz).
//
// Test stratejisi:
//   - Gerçek MinIO endpoint'i — testte uniqe prefix oluşturur, sonunda temizler.
//   - Pagination (1000+ object) MinIO entegrasyon testinde yapılmıyor; cüce
//     sayıyla doğru continuationToken davranışı için MinioStorage'ın do/while
//     loop kontratı zaten unit-style verifiable. Yine de prefix-match + meta
//     dolulukları gerçek storage'da doğrulanır.

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import crypto from "node:crypto";
import { ensureBucket } from "@/providers/storage/init";
import { getStorage } from "@/providers/storage";

const TEST_RUN_ID = `phase7-w13-list-${crypto.randomUUID()}`;
const TEST_PREFIX = `phase7-w13-list/${TEST_RUN_ID}/`;
const OUTSIDE_PREFIX = `phase7-w13-other/${TEST_RUN_ID}/`;
const trackedKeys: string[] = [];

async function uploadTestObject(key: string, body: Buffer) {
  await getStorage().upload(key, body, { contentType: "application/octet-stream" });
  trackedKeys.push(key);
}

beforeAll(async () => {
  await ensureBucket();
});

beforeEach(() => {
  // Pure additive — isolation prefix per test run sufficient.
});

afterAll(async () => {
  const storage = getStorage();
  for (const key of trackedKeys) {
    await storage.delete(key).catch(() => {});
  }
});

describe("StorageProvider.list(prefix)", () => {
  it("prefix match: yalnız eşleşen object'ler döner", async () => {
    const buf = Buffer.from("test-content");
    await uploadTestObject(`${TEST_PREFIX}a.bin`, buf);
    await uploadTestObject(`${TEST_PREFIX}b.bin`, buf);
    await uploadTestObject(`${OUTSIDE_PREFIX}c.bin`, buf);

    const result = await getStorage().list(TEST_PREFIX);
    const keys = result.map((o) => o.key).sort();

    expect(keys).toContain(`${TEST_PREFIX}a.bin`);
    expect(keys).toContain(`${TEST_PREFIX}b.bin`);
    expect(keys).not.toContain(`${OUTSIDE_PREFIX}c.bin`);
  });

  it("her object key + size + lastModified içerir", async () => {
    const body = Buffer.from("hello-list");
    const key = `${TEST_PREFIX}meta-${crypto.randomUUID()}.bin`;
    await uploadTestObject(key, body);

    const result = await getStorage().list(TEST_PREFIX);
    const found = result.find((o) => o.key === key);
    expect(found).toBeDefined();
    expect(found!.size).toBe(body.length);
    expect(found!.lastModified).toBeInstanceOf(Date);
    expect(found!.lastModified.getTime()).toBeGreaterThan(0);
  });

  it("hiç object olmayan prefix → boş array", async () => {
    const emptyPrefix = `phase7-w13-empty/${crypto.randomUUID()}/`;
    const result = await getStorage().list(emptyPrefix);
    expect(result).toEqual([]);
  });
});
