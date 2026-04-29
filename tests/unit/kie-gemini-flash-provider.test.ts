import { describe, it, expect, vi, beforeEach } from "vitest";
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
    const withFlags = {
      ...validOutput,
      score: 70,
      riskFlags: [{ type: "watermark_detected", confidence: 0.85, reason: "köşede silik imza" }],
    };
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockKieResponse(JSON.stringify(withFlags)),
    );
    const result = await kieGeminiFlashReviewProvider.review(baseInput, { apiKey: "kie-key" });
    expect(result.riskFlags).toHaveLength(1);
    expect(result.riskFlags[0]!.type).toBe("watermark_detected");
  });
});

describe("KIE Gemini Flash review provider — Aşama 2A local mode kapalı", () => {
  it("local-path image input ⇒ explicit throw 'KIE local review henüz etkin değil'", async () => {
    await expect(
      kieGeminiFlashReviewProvider.review(
        {
          image: { kind: "local-path", filePath: "/tmp/test.png" },
          productType: "wall_art",
          isTransparentTarget: false,
        },
        { apiKey: "kie-key" },
      ),
    ).rejects.toThrow(/KIE local review henüz etkin değil; Aşama 2B bekleniyor/);
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

  it("bilinmeyen risk flag type ⇒ Zod throw", async () => {
    const bad = {
      ...validOutput,
      riskFlags: [{ type: "fake_flag", confidence: 0.5, reason: "x" }],
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
