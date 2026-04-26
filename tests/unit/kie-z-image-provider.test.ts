// kie-z-image provider — Phase 5 Task 4 real entegrasyonu.
//
// Sözleşmeler:
//   - Capability: ["text-to-image"] (TEK — i2i değil)
//   - referenceUrls: boş/undefined OK; uzunluk > 0 ise THROW (R17.1 sessiz
//     fallback YOK; capability mismatch + product policy net)
//   - aspectRatio: yalnız "1:1" | "4:3" | "3:4" | "16:9" | "9:16" — "2:3"
//     ve "3:2" THROW (R17.1 sessiz fallback YOK; gpt-image hepsini destekler,
//     z-image runtime'da daraltır)
//   - Body shape: { model: "z-image", input: { prompt, aspect_ratio } }
//     image_urls ALAN OLARAK YOK (negatif assertion)
//   - KIE_AI_API_KEY: call-time fail-fast
//   - Defensif resultJson parse: bozuk → state:FAIL + error (throw değil)
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { KieZImageProvider } from "@/providers/image/kie-z-image";
import { VariationState } from "@prisma/client";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  process.env.KIE_AI_API_KEY = "test-key";
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.KIE_AI_API_KEY;
});

describe("KieZImageProvider.generate (createTask, text-to-image)", () => {
  it("posts createTask with bearer + body, NO image_urls field, returns providerTaskId + PROVIDER_PENDING", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        code: 200,
        msg: "ok",
        data: { taskId: "task_z_xxx" },
      }),
    });

    const provider = new KieZImageProvider();
    const out = await provider.generate({
      prompt: "boho mandala",
      aspectRatio: "1:1",
    });

    expect(out.providerTaskId).toBe("task_z_xxx");
    expect(out.state).toBe(VariationState.PROVIDER_PENDING);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls[0] as [string, RequestInit];
    const [url, init] = call;
    expect(url).toBe("https://api.kie.ai/api/v1/jobs/createTask");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer test-key",
      "Content-Type": "application/json",
    });
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe("z-image");
    expect(body.input.prompt).toBe("boho mandala");
    expect(body.input.aspect_ratio).toBe("1:1");
    // KRİTİK: text-to-image only — image_urls field'ı body'de OLMAMALI
    expect(body.input).not.toHaveProperty("image_urls");
  });

  it("aspectRatio '16:9' is supported (happy path)", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ code: 200, msg: "ok", data: { taskId: "t_169" } }),
    });
    const out = await new KieZImageProvider().generate({
      prompt: "abstract",
      aspectRatio: "16:9",
    });
    expect(out.providerTaskId).toBe("t_169");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("KieZImageProvider — referenceUrls capability guard (text-to-image only)", () => {
  it("rejects non-empty referenceUrls with capability + product policy message; fetch NOT called", async () => {
    const p = new KieZImageProvider();
    await expect(
      p.generate({
        prompt: "x",
        aspectRatio: "1:1",
        referenceUrls: ["https://example.com/img.png"],
      }),
    ).rejects.toThrow(/text-to-image only/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejection message also surfaces 'image-to-image desteklenmiyor' product policy", async () => {
    const p = new KieZImageProvider();
    await expect(
      p.generate({
        prompt: "x",
        aspectRatio: "1:1",
        referenceUrls: ["https://example.com/img.png"],
      }),
    ).rejects.toThrow(/image-to-image desteklenmiyor/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejection message also explicitly says 'sessiz fallback yapılmadı' (R17.1)", async () => {
    const p = new KieZImageProvider();
    await expect(
      p.generate({
        prompt: "x",
        aspectRatio: "1:1",
        referenceUrls: ["https://example.com/img.png"],
      }),
    ).rejects.toThrow(/sessiz fallback yapılmadı/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("empty referenceUrls array is OK (happy path runs)", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ code: 200, msg: "ok", data: { taskId: "t_empty" } }),
    });
    const out = await new KieZImageProvider().generate({
      prompt: "x",
      aspectRatio: "1:1",
      referenceUrls: [],
    });
    expect(out.providerTaskId).toBe("t_empty");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("undefined referenceUrls is OK (happy path runs)", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ code: 200, msg: "ok", data: { taskId: "t_undef" } }),
    });
    const out = await new KieZImageProvider().generate({
      prompt: "x",
      aspectRatio: "1:1",
      referenceUrls: undefined,
    });
    expect(out.providerTaskId).toBe("t_undef");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("KieZImageProvider — aspectRatio validation (R17.1 silent fallback YOK)", () => {
  // TS ImageAspectRatio "2:3" ve "3:2" değerlerini içerir (gpt-image bu
  // ratio'ları destekliyor); z-image RUNTIME'da daraltır. Bu yüzden TS
  // hatası beklemiyoruz — sadece runtime throw test ediyoruz.

  it("rejects '2:3' (z-image does not support); fetch NOT called", async () => {
    const p = new KieZImageProvider();
    await expect(
      p.generate({
        prompt: "x",
        aspectRatio: "2:3",
      }),
    ).rejects.toThrow(/does not support aspect ratio.*2:3/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects '3:2' (z-image does not support); fetch NOT called", async () => {
    const p = new KieZImageProvider();
    await expect(
      p.generate({
        prompt: "x",
        aspectRatio: "3:2",
      }),
    ).rejects.toThrow(/does not support aspect ratio.*3:2/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejection message lists all 5 supported values + R17.1 note", async () => {
    const p = new KieZImageProvider();
    await expect(
      p.generate({
        prompt: "x",
        aspectRatio: "2:3",
      }),
    ).rejects.toThrow(/1:1.*4:3.*3:4.*16:9.*9:16/);
    await expect(
      p.generate({
        prompt: "x",
        aspectRatio: "2:3",
      }),
    ).rejects.toThrow(/silent fallback/i);
  });
});

describe("KieZImageProvider.poll (recordInfo)", () => {
  function mockRecordInfoResponse(data: Record<string, unknown>) {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ code: 200, msg: "ok", data }),
    });
  }

  it("waiting → PROVIDER_PENDING", async () => {
    mockRecordInfoResponse({ taskId: "t_w", state: "waiting" });
    const out = await new KieZImageProvider().poll("t_w");
    expect(out.state).toBe(VariationState.PROVIDER_PENDING);
    expect(out.imageUrls).toBeUndefined();

    const call = fetchMock.mock.calls[0] as [string, RequestInit];
    const [url, init] = call;
    expect(url).toBe(
      "https://api.kie.ai/api/v1/jobs/recordInfo?taskId=t_w",
    );
    expect(init.headers).toMatchObject({ Authorization: "Bearer test-key" });
  });

  it("queuing → PROVIDER_PENDING", async () => {
    mockRecordInfoResponse({ taskId: "t_q", state: "queuing" });
    const out = await new KieZImageProvider().poll("t_q");
    expect(out.state).toBe(VariationState.PROVIDER_PENDING);
  });

  it("generating → PROVIDER_RUNNING", async () => {
    mockRecordInfoResponse({ taskId: "t_g", state: "generating" });
    const out = await new KieZImageProvider().poll("t_g");
    expect(out.state).toBe(VariationState.PROVIDER_RUNNING);
  });

  it("success → SUCCESS with parsed imageUrls (resultJson string)", async () => {
    mockRecordInfoResponse({
      taskId: "t_s",
      state: "success",
      resultJson: JSON.stringify({
        resultUrls: ["https://r.kie.ai/z1.png"],
      }),
    });
    const out = await new KieZImageProvider().poll("t_s");
    expect(out.state).toBe(VariationState.SUCCESS);
    expect(out.imageUrls).toEqual(["https://r.kie.ai/z1.png"]);
  });

  it("fail → FAIL with failMsg surfaced", async () => {
    mockRecordInfoResponse({
      taskId: "t_f",
      state: "fail",
      failCode: "RATE_LIMIT",
      failMsg: "rate limited",
    });
    const out = await new KieZImageProvider().poll("t_f");
    expect(out.state).toBe(VariationState.FAIL);
    expect(out.error).toBe("rate limited");
  });

  it("fail without failMsg falls back to failCode", async () => {
    mockRecordInfoResponse({
      taskId: "t_fc",
      state: "fail",
      failCode: "RATE_LIMIT",
      failMsg: "",
    });
    const out = await new KieZImageProvider().poll("t_fc");
    expect(out.state).toBe(VariationState.FAIL);
    expect(out.error).toBe("RATE_LIMIT");
  });

  it("success but resultJson is unparseable → state FAIL with parse error (no throw)", async () => {
    mockRecordInfoResponse({
      taskId: "t_p",
      state: "success",
      resultJson: "{not-json}",
    });
    const out = await new KieZImageProvider().poll("t_p");
    expect(out.state).toBe(VariationState.FAIL);
    expect(out.error).toMatch(/Result parse failure/);
  });

  it("success but resultUrls is not an array → state FAIL", async () => {
    mockRecordInfoResponse({
      taskId: "t_na",
      state: "success",
      resultJson: JSON.stringify({ resultUrls: "not-an-array" }),
    });
    const out = await new KieZImageProvider().poll("t_na");
    expect(out.state).toBe(VariationState.FAIL);
    expect(out.error).toMatch(/Result parse failure/);
  });

  it("unknown state → poll throws (R17.1)", async () => {
    mockRecordInfoResponse({ taskId: "t_u", state: "exploded" });
    await expect(new KieZImageProvider().poll("t_u")).rejects.toThrow(
      /Unknown kie\.ai state/,
    );
  });
});

describe("KieZImageProvider — KIE_AI_API_KEY env fail-fast", () => {
  it("generate() throws when env missing; fetch NOT called", async () => {
    delete process.env.KIE_AI_API_KEY;
    const p = new KieZImageProvider();
    await expect(
      p.generate({ prompt: "x", aspectRatio: "1:1" }),
    ).rejects.toThrow(/KIE_AI_API_KEY/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("poll() throws when env missing; fetch NOT called", async () => {
    delete process.env.KIE_AI_API_KEY;
    const p = new KieZImageProvider();
    await expect(p.poll("t_x")).rejects.toThrow(/KIE_AI_API_KEY/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
