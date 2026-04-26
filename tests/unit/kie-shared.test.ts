// kie-shared helper'larının doğrudan unit testleri.
//
// İki provider (kie-gpt-image-1.5 ve kie-z-image) aynı transport
// omurgasını paylaşır; bu test paketi paylaşılan kontratları sabitler:
//   - mapKieState: 5 mapping + unknown throw (R17.1)
//   - parsePollResponse: success / fail / pending+running / parse-fail / non-array
//   - requireApiKey: env var/yok (call-time fail-fast)
//
// parseKieEnvelope ve assertPublicHttpUrls provider testlerinde dolaylı kapsanır.
import { describe, it, expect, afterEach } from "vitest";
import {
  mapKieState,
  parsePollResponse,
  requireApiKey,
} from "@/providers/image/kie-shared";
import { VariationState } from "@prisma/client";

describe("kie-shared.mapKieState", () => {
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

describe("kie-shared.parsePollResponse", () => {
  it("success with valid resultJson string returns SUCCESS + imageUrls", () => {
    const out = parsePollResponse({
      state: "success",
      resultJson: JSON.stringify({
        resultUrls: ["https://r.kie.ai/a.png", "https://r.kie.ai/b.png"],
      }),
    });
    expect(out.state).toBe(VariationState.SUCCESS);
    expect(out.imageUrls).toEqual([
      "https://r.kie.ai/a.png",
      "https://r.kie.ai/b.png",
    ]);
    expect(out.error).toBeUndefined();
  });

  it("fail with failMsg returns FAIL + surfaced error", () => {
    const out = parsePollResponse({
      state: "fail",
      failCode: "RATE_LIMIT",
      failMsg: "rate limited",
    });
    expect(out.state).toBe(VariationState.FAIL);
    expect(out.error).toBe("rate limited");
  });

  it("waiting / generating return PENDING / RUNNING without error", () => {
    const w = parsePollResponse({ state: "waiting" });
    expect(w.state).toBe(VariationState.PROVIDER_PENDING);
    expect(w.error).toBeUndefined();

    const g = parsePollResponse({ state: "generating" });
    expect(g.state).toBe(VariationState.PROVIDER_RUNNING);
    expect(g.error).toBeUndefined();
  });

  it("success with unparseable resultJson returns FAIL (no throw)", () => {
    const out = parsePollResponse({
      state: "success",
      resultJson: "{not-json}",
    });
    expect(out.state).toBe(VariationState.FAIL);
    expect(out.error).toMatch(/Result parse failure/);
  });

  it("success with non-array resultUrls returns FAIL (no throw)", () => {
    const out = parsePollResponse({
      state: "success",
      resultJson: JSON.stringify({ resultUrls: "not-an-array" }),
    });
    expect(out.state).toBe(VariationState.FAIL);
    expect(out.error).toMatch(/Result parse failure/);
  });
});

describe("kie-shared.requireApiKey", () => {
  afterEach(() => {
    delete process.env.KIE_AI_API_KEY;
  });

  it("returns key when env var is set", () => {
    process.env.KIE_AI_API_KEY = "secret-123";
    expect(requireApiKey("kie-z-image")).toBe("secret-123");
  });

  it("throws when env var missing (call-time fail-fast)", () => {
    delete process.env.KIE_AI_API_KEY;
    expect(() => requireApiKey("kie-z-image")).toThrow(/KIE_AI_API_KEY/);
  });
});
