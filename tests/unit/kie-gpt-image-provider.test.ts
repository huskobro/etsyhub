// Phase 5 closeout hotfix (2026-04-29): provider settings-aware refactor.
// `vi.stubEnv("KIE_AI_API_KEY", ...)` çağrıları SİLİNDİ; provider çağrıları
// `{ apiKey: "test-key" }` ile yapılır (per-user resolved key simulation).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { KieGptImageProvider, mapKieState } from "@/providers/image/kie-gpt-image";
import { VariationState } from "@prisma/client";

// Global fetch mock — Node 20+ fetch'i Vitest stubGlobal ile değiştirilebilir.
const fetchMock = vi.fn();

// Sabit test key — caller (worker) per-user encrypted'dan decrypt'leyip
// options.apiKey olarak geçer. Burada simüle ediyoruz.
const TEST_API_KEY = "test-key";

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("KieGptImageProvider.generate (createTask)", () => {
  it("posts createTask with bearer + body, returns providerTaskId + PROVIDER_PENDING", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        code: 200,
        msg: "ok",
        data: { taskId: "task_abc" },
      }),
    });

    const provider = new KieGptImageProvider();
    const out = await provider.generate(
      {
        prompt: "pastel anemone",
        referenceUrls: ["https://example.com/a.jpg"],
        aspectRatio: "1:1",
      },
      { apiKey: TEST_API_KEY },
    );

    expect(out.providerTaskId).toBe("task_abc");
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
    expect(body.model).toBe("gpt-image/1.5-image-to-image");
    expect(body.input.prompt).toBe("pastel anemone");
    expect(body.input.aspect_ratio).toBe("1:1");
    expect(body.input.image_urls).toEqual(["https://example.com/a.jpg"]);
  });
});

// mapKieState exhaustive testleri kie-shared.test.ts'te tek truth.
// Burada yalnız re-export integration smoke testi: dosya kontratının
// kırılmadığını doğrular (otoritatif davranış kapsama kie-shared'da).
describe("mapKieState (re-export smoke)", () => {
  it("kie-gpt-image dosyasından çağrılabilir ve enum üyesi döndürür", () => {
    expect(mapKieState("success")).toBe(VariationState.SUCCESS);
  });
});

describe("KieGptImageProvider.poll (recordInfo)", () => {
  function mockRecordInfoResponse(data: Record<string, unknown>) {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ code: 200, msg: "ok", data }),
    });
  }

  it("waiting → PROVIDER_PENDING, imageUrls undefined", async () => {
    mockRecordInfoResponse({ taskId: "task_1", state: "waiting" });
    const provider = new KieGptImageProvider();
    const out = await provider.poll("task_1", { apiKey: TEST_API_KEY });
    expect(out.state).toBe(VariationState.PROVIDER_PENDING);
    expect(out.imageUrls).toBeUndefined();
    expect(out.error).toBeUndefined();

    const call = fetchMock.mock.calls[0] as [string, RequestInit];
    const [url, init] = call;
    expect(url).toBe(
      "https://api.kie.ai/api/v1/jobs/recordInfo?taskId=task_1",
    );
    expect(init.headers).toMatchObject({ Authorization: "Bearer test-key" });
  });

  it("queuing → PROVIDER_PENDING", async () => {
    mockRecordInfoResponse({ taskId: "task_2", state: "queuing" });
    const out = await new KieGptImageProvider().poll("task_2", {
      apiKey: TEST_API_KEY,
    });
    expect(out.state).toBe(VariationState.PROVIDER_PENDING);
    expect(out.imageUrls).toBeUndefined();
  });

  it("generating → PROVIDER_RUNNING, imageUrls undefined", async () => {
    mockRecordInfoResponse({ taskId: "task_3", state: "generating" });
    const out = await new KieGptImageProvider().poll("task_3", {
      apiKey: TEST_API_KEY,
    });
    expect(out.state).toBe(VariationState.PROVIDER_RUNNING);
    expect(out.imageUrls).toBeUndefined();
  });

  it("success → SUCCESS with parsed imageUrls (resultJson string)", async () => {
    mockRecordInfoResponse({
      taskId: "task_4",
      state: "success",
      resultJson: JSON.stringify({
        resultUrls: ["https://r.kie.ai/1.png", "https://r.kie.ai/2.png"],
      }),
    });
    const out = await new KieGptImageProvider().poll("task_4", {
      apiKey: TEST_API_KEY,
    });
    expect(out.state).toBe(VariationState.SUCCESS);
    expect(out.imageUrls).toEqual([
      "https://r.kie.ai/1.png",
      "https://r.kie.ai/2.png",
    ]);
    expect(out.error).toBeUndefined();
  });

  it("fail → FAIL with failMsg surfaced", async () => {
    mockRecordInfoResponse({
      taskId: "task_5",
      state: "fail",
      failCode: "RATE_LIMIT",
      failMsg: "rate limited",
    });
    const out = await new KieGptImageProvider().poll("task_5", {
      apiKey: TEST_API_KEY,
    });
    expect(out.state).toBe(VariationState.FAIL);
    expect(out.error).toBe("rate limited");
    expect(out.imageUrls).toBeUndefined();
  });

  it("fail without failMsg falls back to failCode", async () => {
    mockRecordInfoResponse({
      taskId: "task_6",
      state: "fail",
      failCode: "RATE_LIMIT",
      failMsg: "",
    });
    const out = await new KieGptImageProvider().poll("task_6", {
      apiKey: TEST_API_KEY,
    });
    expect(out.state).toBe(VariationState.FAIL);
    expect(out.error).toBe("RATE_LIMIT");
  });

  it("success but resultJson is not parseable → state FAIL with parse error (no throw)", async () => {
    mockRecordInfoResponse({
      taskId: "task_7",
      state: "success",
      resultJson: "{not-json}",
    });
    const out = await new KieGptImageProvider().poll("task_7", {
      apiKey: TEST_API_KEY,
    });
    expect(out.state).toBe(VariationState.FAIL);
    expect(out.error).toMatch(/Result parse failure/);
  });

  it("success but resultUrls is not an array → state FAIL", async () => {
    mockRecordInfoResponse({
      taskId: "task_8",
      state: "success",
      resultJson: JSON.stringify({ resultUrls: "not-an-array" }),
    });
    const out = await new KieGptImageProvider().poll("task_8", {
      apiKey: TEST_API_KEY,
    });
    expect(out.state).toBe(VariationState.FAIL);
    expect(out.error).toMatch(/Result parse failure/);
  });

  it("unknown state from kie.ai → poll throws", async () => {
    mockRecordInfoResponse({ taskId: "task_9", state: "exploded" });
    await expect(
      new KieGptImageProvider().poll("task_9", { apiKey: TEST_API_KEY }),
    ).rejects.toThrow(/Unknown kie\.ai state/);
  });
});

describe("KieGptImageProvider — referenceUrls guard (R17.2)", () => {
  it("rejects relative/local path", async () => {
    const p = new KieGptImageProvider();
    await expect(
      p.generate(
        {
          prompt: "x",
          aspectRatio: "1:1",
          referenceUrls: ["/Users/foo/img.png"],
        },
        { apiKey: TEST_API_KEY },
      ),
    ).rejects.toThrow(/public HTTP\(S\) URLs/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects file:// URI", async () => {
    const p = new KieGptImageProvider();
    await expect(
      p.generate(
        {
          prompt: "x",
          aspectRatio: "1:1",
          referenceUrls: ["file:///foo/img.png"],
        },
        { apiKey: TEST_API_KEY },
      ),
    ).rejects.toThrow(/public HTTP\(S\) URLs/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects data: URI / base64", async () => {
    const p = new KieGptImageProvider();
    await expect(
      p.generate(
        {
          prompt: "x",
          aspectRatio: "1:1",
          referenceUrls: ["data:image/png;base64,iVBORw0KGgo="],
        },
        { apiKey: TEST_API_KEY },
      ),
    ).rejects.toThrow(/public HTTP\(S\) URLs/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("KieGptImageProvider — apiKey validation (Phase 5 closeout hotfix)", () => {
  // Phase 5 closeout hotfix: env okuma kalktı; key boş ise explicit throw
  // (Settings → AI Mode yön mesajı).
  it("generate() throws when apiKey is empty string; fetch NOT called", async () => {
    const p = new KieGptImageProvider();
    await expect(
      p.generate({ prompt: "x", aspectRatio: "1:1" }, { apiKey: "" }),
    ).rejects.toThrow(/Settings → AI Mode'dan KIE anahtarı girin/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("generate() throws when apiKey is whitespace-only", async () => {
    const p = new KieGptImageProvider();
    await expect(
      p.generate({ prompt: "x", aspectRatio: "1:1" }, { apiKey: "   " }),
    ).rejects.toThrow(/api key missing for kie-gpt-image-1\.5/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("poll() throws when apiKey is empty; fetch NOT called", async () => {
    const p = new KieGptImageProvider();
    await expect(p.poll("task_x", { apiKey: "" })).rejects.toThrow(
      /Settings → AI Mode'dan KIE anahtarı girin/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
