import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { KieGptImageProvider } from "@/providers/image/kie-gpt-image";

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
