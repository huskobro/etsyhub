import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { checkUrlPublic, _resetCache } from "@/features/variation-generation/url-public-check";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

beforeEach(() => {
  fetchMock.mockReset();
  _resetCache();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("checkUrlPublic (Q5)", () => {
  it("HEAD 200 → ok=true", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200 });
    const r = await checkUrlPublic("https://example.com/a.jpg");
    expect(r.ok).toBe(true);
    expect(r.status).toBe(200);
  });

  it("HEAD 4xx → ok=false with reason", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 403 });
    const r = await checkUrlPublic("https://example.com/forbidden");
    expect(r.ok).toBe(false);
    expect(r.status).toBe(403);
    expect(r.reason).toMatch(/403/);
  });

  it("network error → ok=false with reason", async () => {
    fetchMock.mockRejectedValueOnce(new Error("ENOTFOUND"));
    const r = await checkUrlPublic("https://nope.invalid");
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/ENOTFOUND/);
  });

  it("uses User-Agent EtsyHub/0.1 + HEAD method", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200 });
    await checkUrlPublic("https://example.com/a.jpg");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/a.jpg",
      expect.objectContaining({
        method: "HEAD",
        headers: expect.objectContaining({ "User-Agent": "EtsyHub/0.1" }),
      }),
    );
  });

  it("caches result for 5 minutes", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200 });
    await checkUrlPublic("https://x.com/a");
    await checkUrlPublic("https://x.com/a");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200 });
    await checkUrlPublic("https://x.com/a");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("url-public-check cache bound (Task 11)", () => {
  beforeEach(() => {
    _resetCache();
    // Bu blok timer'a güvenmiyor; gerçek time kullanılsın ki TTL kontrolleri
    // (Date.now) bize karışmasın.
    vi.useRealTimers();
  });

  it("cache 1000 entry sınırını aşmaz; en eski entry evict edilir", async () => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    // 1001 farklı URL
    for (let i = 0; i < 1001; i++) {
      await checkUrlPublic(`https://e.com/${i}.jpg`);
    }
    expect(fetchMock).toHaveBeenCalledTimes(1001);

    // İlk URL evict edilmiş olmalı; tekrar çağrı yeni fetch
    await checkUrlPublic("https://e.com/0.jpg");
    expect(fetchMock).toHaveBeenCalledTimes(1002);

    // Son URL hala cache'te → tekrar fetch çağırmıyor
    await checkUrlPublic("https://e.com/1000.jpg");
    expect(fetchMock).toHaveBeenCalledTimes(1002);
  });

  it("cache hit aynı entry'i en sona taşır (LRU recency)", async () => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    // 1000 entry doldur
    for (let i = 0; i < 1000; i++) {
      await checkUrlPublic(`https://e.com/${i}.jpg`);
    }
    expect(fetchMock).toHaveBeenCalledTimes(1000);

    // İlk URL'e tekrar dokun → recency güncellensin (cache hit)
    await checkUrlPublic("https://e.com/0.jpg");
    expect(fetchMock).toHaveBeenCalledTimes(1000);

    // Yeni URL → şimdi en eski "1.jpg" evict edilmeli, "0.jpg" değil
    await checkUrlPublic("https://e.com/new.jpg");
    expect(fetchMock).toHaveBeenCalledTimes(1001);

    // 0.jpg hala cache'te (recency güncellendi)
    await checkUrlPublic("https://e.com/0.jpg");
    expect(fetchMock).toHaveBeenCalledTimes(1001);

    // 1.jpg evict edildi, refetch
    await checkUrlPublic("https://e.com/1.jpg");
    expect(fetchMock).toHaveBeenCalledTimes(1002);
  });
});
