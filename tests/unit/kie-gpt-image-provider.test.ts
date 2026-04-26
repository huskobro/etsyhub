import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { KieGptImageProvider, mapKieState } from "@/providers/image/kie-gpt-image";
import { VariationState } from "@prisma/client";

// Global fetch mock — Node 20+ fetch'i Vitest stubGlobal ile değiştirilebilir.
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
    const out = await provider.generate({
      prompt: "pastel anemone",
      referenceUrls: ["https://example.com/a.jpg"],
      aspectRatio: "1:1",
    });

    expect(out.providerTaskId).toBe("task_abc");
    expect(out.state).toBe("PROVIDER_PENDING");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.kie.ai/api/v1/jobs/createTask");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer test-key",
      "Content-Type": "application/json",
    });
    const body = JSON.parse(init.body);
    expect(body.model).toBe("gpt-image/1.5-image-to-image");
    expect(body.input.prompt).toBe("pastel anemone");
    expect(body.input.aspect_ratio).toBe("1:1");
    expect(body.input.image_urls).toEqual(["https://example.com/a.jpg"]);
  });
});

describe("mapKieState", () => {
  it("waiting → PROVIDER_PENDING", () => {
    expect(mapKieState("waiting")).toBe(VariationState.PROVIDER_PENDING);
  });
  it("queuing → PROVIDER_PENDING", () => {
    expect(mapKieState("queuing")).toBe(VariationState.PROVIDER_PENDING);
  });
  it("generating → PROVIDER_RUNNING", () => {
    expect(mapKieState("generating")).toBe(VariationState.PROVIDER_RUNNING);
  });
  it("success → SUCCESS", () => {
    expect(mapKieState("success")).toBe(VariationState.SUCCESS);
  });
  it("fail → FAIL", () => {
    expect(mapKieState("fail")).toBe(VariationState.FAIL);
  });
  it("unknown state throws (R17.1 — silent fallback YOK)", () => {
    expect(() => mapKieState("foobar")).toThrow(/Unknown kie\.ai state/);
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
    const out = await provider.poll("task_1");
    expect(out.state).toBe(VariationState.PROVIDER_PENDING);
    expect(out.imageUrls).toBeUndefined();
    expect(out.error).toBeUndefined();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://api.kie.ai/api/v1/jobs/recordInfo?taskId=task_1",
    );
    expect(init.headers).toMatchObject({ Authorization: "Bearer test-key" });
  });

  it("queuing → PROVIDER_PENDING", async () => {
    mockRecordInfoResponse({ taskId: "task_2", state: "queuing" });
    const out = await new KieGptImageProvider().poll("task_2");
    expect(out.state).toBe(VariationState.PROVIDER_PENDING);
    expect(out.imageUrls).toBeUndefined();
  });

  it("generating → PROVIDER_RUNNING, imageUrls undefined", async () => {
    mockRecordInfoResponse({ taskId: "task_3", state: "generating" });
    const out = await new KieGptImageProvider().poll("task_3");
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
    const out = await new KieGptImageProvider().poll("task_4");
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
    const out = await new KieGptImageProvider().poll("task_5");
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
    const out = await new KieGptImageProvider().poll("task_6");
    expect(out.state).toBe(VariationState.FAIL);
    expect(out.error).toBe("RATE_LIMIT");
  });

  it("success but resultJson is not parseable → state FAIL with parse error (no throw)", async () => {
    mockRecordInfoResponse({
      taskId: "task_7",
      state: "success",
      resultJson: "{not-json}",
    });
    const out = await new KieGptImageProvider().poll("task_7");
    expect(out.state).toBe(VariationState.FAIL);
    expect(out.error).toMatch(/Result parse failure/);
  });

  it("success but resultUrls is not an array → state FAIL", async () => {
    mockRecordInfoResponse({
      taskId: "task_8",
      state: "success",
      resultJson: JSON.stringify({ resultUrls: "not-an-array" }),
    });
    const out = await new KieGptImageProvider().poll("task_8");
    expect(out.state).toBe(VariationState.FAIL);
    expect(out.error).toMatch(/Result parse failure/);
  });

  it("unknown state from kie.ai → poll throws", async () => {
    mockRecordInfoResponse({ taskId: "task_9", state: "exploded" });
    await expect(new KieGptImageProvider().poll("task_9")).rejects.toThrow(
      /Unknown kie\.ai state/,
    );
  });
});
