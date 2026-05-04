import { describe, it, expect, vi, beforeEach } from "vitest";

// Drift #6 + Aşama 2B kapanış (2026-05-04):
// Provider artık image-loader üzerinden hem local-path hem remote-url için data
// URL inline yapıyor. Unit testlerde image-loader'ı mock'luyoruz — gerçek
// fs/fetch çağrısı yapılmasın, KIE fetch tek çağrı kalsın (test odak temiz).
const imageToInlineDataMock = vi.fn();
vi.mock("@/providers/review/image-loader", () => ({
  imageToInlineData: (...args: unknown[]) => imageToInlineDataMock(...args),
}));

import { kieGeminiFlashReviewProvider } from "@/providers/review/kie-gemini-flash";

const baseInput = {
  image: { kind: "remote-url" as const, url: "https://cdn.example.com/x.png" },
  productType: "wall_art",
  isTransparentTarget: false,
};

const validOutput = {
  score: 85,
  textDetected: false,
  gibberishDetected: false,
  riskFlags: [],
  summary: "clean illustration",
};

/**
 * Mock KIE chat/completions response.
 *
 * Default: gerçek KIE shape (HTTP 200 + envelope `{code:200, msg, data}`)
 * — drift #4 (2026-04-30) sonrası provider envelope-aware.
 *
 * `flat: true` ⇒ envelope'suz flat OpenAI-compatible body
 * (defansif tolerans path'ini test etmek için).
 */
function mockKieResponse(
  content: string,
  options: { ok?: boolean; status?: number; usage?: object; flat?: boolean } = {},
) {
  const innerBody = {
    choices: [{ message: { content } }],
    usage: options.usage ?? { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
    model: "gemini-2.5-flash",
  };
  return {
    ok: options.ok ?? true,
    status: options.status ?? 200,
    text: async () => "raw error body",
    json: async () =>
      options.flat
        ? innerBody
        : {
            code: 200,
            msg: "success",
            data: innerBody,
          },
  };
}

beforeEach(() => {
  global.fetch = vi.fn() as unknown as typeof fetch;
  imageToInlineDataMock.mockReset();
  // Default: başarılı inline. Drift #6 + Aşama 2B sonrası bu mock her test'te
  // çalışır. "ZmFrZQ==" base64 = "fake".
  imageToInlineDataMock.mockResolvedValue({ mimeType: "image/png", data: "ZmFrZQ==" });
});

describe("KIE Gemini Flash review provider — başarılı senaryolar", () => {
  it("strict JSON schema modu → ReviewOutput parse + costCents:1", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockKieResponse(JSON.stringify(validOutput)),
    );
    const result = await kieGeminiFlashReviewProvider.review(baseInput, { apiKey: "kie-key" });
    expect(result.score).toBe(85);
    expect(result.costCents).toBe(1);
    expect(result.riskFlags).toEqual([]);
  });

  it("strict 400 → json_object fallback retry", async () => {
    // İlk çağrı: strict mode reddedildi (400 + schema-related error).
    (global.fetch as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => "response_format json_schema not supported",
        json: async () => ({}),
      })
      .mockResolvedValueOnce(mockKieResponse(JSON.stringify(validOutput)));

    const result = await kieGeminiFlashReviewProvider.review(baseInput, { apiKey: "kie-key" });
    expect(result.score).toBe(85);

    // İki fetch çağrısı yapıldı (strict + fallback).
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock.mock.calls).toHaveLength(2);
    const fallbackBody = JSON.parse(fetchMock.mock.calls[1]![1].body);
    expect(fallbackBody.response_format).toEqual({ type: "json_object" });
  });

  it("riskFlags dolu valid output → parse", async () => {
    // Drift #5: `type` → `kind` (KIE strict JSON schema reserved-word fix).
    const withFlags = {
      ...validOutput,
      score: 70,
      riskFlags: [{ kind: "watermark_detected", confidence: 0.85, reason: "köşede silik imza" }],
    };
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockKieResponse(JSON.stringify(withFlags)),
    );
    const result = await kieGeminiFlashReviewProvider.review(baseInput, { apiKey: "kie-key" });
    expect(result.riskFlags).toHaveLength(1);
    expect(result.riskFlags[0]!.kind).toBe("watermark_detected");
  });
});

describe("KIE Gemini Flash review provider — drift #6 + Aşama 2B kapanış (data URL inline)", () => {
  it("local-path image input ⇒ image-loader data URL inline + KIE happy path", async () => {
    imageToInlineDataMock.mockResolvedValueOnce({
      mimeType: "image/png",
      data: "TE9DQUw=", // base64("LOCAL")
    });
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockKieResponse(JSON.stringify(validOutput)),
    );

    const result = await kieGeminiFlashReviewProvider.review(
      {
        image: { kind: "local-path", filePath: "/tmp/local.png" },
        productType: "wall_art",
        isTransparentTarget: false,
      },
      { apiKey: "kie-key" },
    );

    expect(result.score).toBe(85);
    expect(result.costCents).toBe(1);

    // image-loader doğru input'la çağrıldı.
    expect(imageToInlineDataMock).toHaveBeenCalledTimes(1);
    expect(imageToInlineDataMock).toHaveBeenCalledWith({
      kind: "local-path",
      filePath: "/tmp/local.png",
    });

    // KIE'ye giden body'de image_url.url data URL formatında.
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    const imageUrl = body.messages[0].content[1].image_url.url;
    expect(imageUrl).toBe("data:image/png;base64,TE9DQUw=");
  });

  it("remote-url image input ⇒ image-loader fetch + data URL inline", async () => {
    imageToInlineDataMock.mockResolvedValueOnce({
      mimeType: "image/jpeg",
      data: "UkVNT1RF", // base64("REMOTE")
    });
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockKieResponse(JSON.stringify(validOutput)),
    );

    const result = await kieGeminiFlashReviewProvider.review(
      {
        image: { kind: "remote-url", url: "https://cdn.example.com/x.jpg" },
        productType: "wall_art",
        isTransparentTarget: false,
      },
      { apiKey: "kie-key" },
    );

    expect(result.score).toBe(85);
    expect(imageToInlineDataMock).toHaveBeenCalledTimes(1);
    expect(imageToInlineDataMock).toHaveBeenCalledWith({
      kind: "remote-url",
      url: "https://cdn.example.com/x.jpg",
    });

    // KIE'ye giden body'de image_url.url data URL formatında (mime preserved).
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    const imageUrl = body.messages[0].content[1].image_url.url;
    expect(imageUrl).toBe("data:image/jpeg;base64,UkVNT1RF");
  });

  it("image-loader fail (local file yok) ⇒ explicit throw, KIE çağrılmaz", async () => {
    imageToInlineDataMock.mockRejectedValueOnce(
      new Error("ENOENT: no such file or directory, open '/tmp/missing.png'"),
    );

    await expect(
      kieGeminiFlashReviewProvider.review(
        {
          image: { kind: "local-path", filePath: "/tmp/missing.png" },
          productType: "wall_art",
          isTransparentTarget: false,
        },
        { apiKey: "kie-key" },
      ),
    ).rejects.toThrow(/ENOENT/);

    // KIE fetch hiç çağrılmadı (sessiz fallback yok).
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock.mock.calls).toHaveLength(0);
  });

  it("image-loader fail (remote 404) ⇒ explicit throw, KIE çağrılmaz", async () => {
    imageToInlineDataMock.mockRejectedValueOnce(
      new Error("image fetch failed: 404 Not Found (https://cdn.example.com/missing.png)"),
    );

    await expect(
      kieGeminiFlashReviewProvider.review(
        {
          image: { kind: "remote-url", url: "https://cdn.example.com/missing.png" },
          productType: "wall_art",
          isTransparentTarget: false,
        },
        { apiKey: "kie-key" },
      ),
    ).rejects.toThrow(/image fetch failed: 404/);

    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock.mock.calls).toHaveLength(0);
  });
});

describe("KIE Gemini Flash review provider — hata senaryoları (sessiz fallback yok)", () => {
  it("apiKey boş ⇒ throw", async () => {
    await expect(
      kieGeminiFlashReviewProvider.review(baseInput, { apiKey: "" }),
    ).rejects.toThrow(/api key missing/i);
  });

  it("apiKey whitespace ⇒ throw", async () => {
    await expect(
      kieGeminiFlashReviewProvider.review(baseInput, { apiKey: "   " }),
    ).rejects.toThrow(/api key missing/i);
  });

  it("HTTP 500 ⇒ throw with status + body", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "internal server error",
      json: async () => ({}),
    });
    await expect(
      kieGeminiFlashReviewProvider.review(baseInput, { apiKey: "kie-key" }),
    ).rejects.toThrow(/kie review failed: 500/);
  });

  it("HTTP 400 schema-related değil ⇒ throw (fallback yapmaz)", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => "rate limit exceeded",
      json: async () => ({}),
    });
    await expect(
      kieGeminiFlashReviewProvider.review(baseInput, { apiKey: "kie-key" }),
    ).rejects.toThrow(/kie review failed: 400/);
    // Fallback yapılmadı: tek fetch çağrısı.
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock.mock.calls).toHaveLength(1);
  });

  it("empty content ⇒ throw", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockKieResponse(""),
    );
    await expect(
      kieGeminiFlashReviewProvider.review(baseInput, { apiKey: "kie-key" }),
    ).rejects.toThrow(/empty content/);
  });

  it("non-JSON content ⇒ throw", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockKieResponse("not json at all"),
    );
    await expect(
      kieGeminiFlashReviewProvider.review(baseInput, { apiKey: "kie-key" }),
    ).rejects.toThrow(/non-JSON output/);
  });

  it("bilinmeyen risk flag kind ⇒ Zod throw", async () => {
    const bad = {
      ...validOutput,
      riskFlags: [{ kind: "fake_flag", confidence: 0.5, reason: "x" }],
    };
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockKieResponse(JSON.stringify(bad)),
    );
    await expect(
      kieGeminiFlashReviewProvider.review(baseInput, { apiKey: "kie-key" }),
    ).rejects.toThrow(/invalid output schema/i);
  });

  it("score > 100 ⇒ Zod throw", async () => {
    const bad = { ...validOutput, score: 150 };
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockKieResponse(JSON.stringify(bad)),
    );
    await expect(
      kieGeminiFlashReviewProvider.review(baseInput, { apiKey: "kie-key" }),
    ).rejects.toThrow(/invalid output schema/i);
  });

  it("provider id + modelId + kind kontrolü", () => {
    expect(kieGeminiFlashReviewProvider.id).toBe("kie-gemini-flash");
    expect(kieGeminiFlashReviewProvider.modelId).toBe("gemini-2.5-flash");
    expect(kieGeminiFlashReviewProvider.kind).toBe("vision");
  });
});

describe("KIE Gemini Flash review provider — envelope handling (drift #4)", () => {
  it("HTTP 200 + KIE envelope code:500 ⇒ throw with envelope msg (drift #4 kapanış)", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => "",
      json: async () => ({
        code: 500,
        msg: "The server is currently being maintained, please try again later~",
      }),
    });

    await expect(
      kieGeminiFlashReviewProvider.review(baseInput, { apiKey: "kie-key" }),
    ).rejects.toThrow(/kie review failed: 500.*server.*maintained/i);
  });

  it("HTTP 200 + KIE envelope code:200 + data.choices ⇒ parse success", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => "",
      json: async () => ({
        code: 200,
        msg: "success",
        data: {
          choices: [{ message: { content: JSON.stringify(validOutput) } }],
          usage: { total_tokens: 150 },
        },
      }),
    });

    const result = await kieGeminiFlashReviewProvider.review(baseInput, {
      apiKey: "kie-key",
    });
    expect(result.score).toBe(85);
    expect(result.costCents).toBe(1);
  });

  it("HTTP 200 + envelope success ama content boş ⇒ empty content throw", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => "",
      json: async () => ({
        code: 200,
        msg: "success",
        data: { choices: [{ message: { content: "" } }] },
      }),
    });

    await expect(
      kieGeminiFlashReviewProvider.review(baseInput, { apiKey: "kie-key" }),
    ).rejects.toThrow(/empty content/);
  });

  it("HTTP 200 + envelope code:401 ⇒ throw with envelope auth msg", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => "",
      json: async () => ({
        code: 401,
        msg: "invalid api key",
      }),
    });

    await expect(
      kieGeminiFlashReviewProvider.review(baseInput, { apiKey: "kie-key" }),
    ).rejects.toThrow(/kie review failed: 401.*invalid api key/i);
  });

  it("HTTP 200 + flat OpenAI-compatible body (envelope yok) ⇒ defansif parse success", async () => {
    // KIE ileride envelope kaldırırsa flat path'in hâlâ çalıştığını doğrular.
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockKieResponse(JSON.stringify(validOutput), { flat: true }),
    );

    const result = await kieGeminiFlashReviewProvider.review(baseInput, {
      apiKey: "kie-key",
    });
    expect(result.score).toBe(85);
  });
});
