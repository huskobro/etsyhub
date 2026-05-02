// Phase 9 V1 Task 16 — useGenerateListingMeta hook unit test.
//
// Test scenarios:
// - happy path: fetch çağrı şekli + response shape
// - error path: HTTP 400 NOT_CONFIGURED message yansır
// - error path: body parse fail → fallback HTTP {status} message

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useGenerateListingMeta } from "@/features/listings/hooks/useGenerateListingMeta";

const fetchMock = vi.fn();
global.fetch = fetchMock as unknown as typeof fetch;

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useGenerateListingMeta", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("happy path — fetch çağrısı + response shape", async () => {
    const tags = Array.from({ length: 13 }, (_, i) => `tag${i}`);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        output: { title: "T", description: "D", tags },
        providerSnapshot: "gemini-2.5-flash@2026-05-03",
        promptVersion: "v1.0",
      }),
    });

    const { result } = renderHook(() => useGenerateListingMeta("listing-id"), {
      wrapper,
    });
    result.current.mutate(undefined);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/listings/draft/listing-id/generate-meta",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
      }),
    );
    // Body: JSON.stringify({}) — undefined input default'a fallback.
    const callArgs = fetchMock.mock.calls[0];
    expect(callArgs).toBeDefined();
    const init = callArgs?.[1] as RequestInit;
    expect(init.body).toBe("{}");

    expect(result.current.data?.output.title).toBe("T");
    expect(result.current.data?.output.description).toBe("D");
    expect(result.current.data?.output.tags).toEqual(tags);
    expect(result.current.data?.providerSnapshot).toBe(
      "gemini-2.5-flash@2026-05-03",
    );
    expect(result.current.data?.promptVersion).toBe("v1.0");
  });

  it("error path — HTTP 400 NOT_CONFIGURED message yansır", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        error:
          "AI provider configured değil — Settings → AI Mode'dan KIE anahtarı ekleyin",
        code: "LISTING_META_PROVIDER_NOT_CONFIGURED",
      }),
    });

    const { result } = renderHook(() => useGenerateListingMeta("listing-id"), {
      wrapper,
    });
    result.current.mutate(undefined);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toContain(
      "AI provider configured değil",
    );
  });

  it("error path — body parse fail → HTTP {status} fallback message", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error("invalid json");
      },
    });

    const { result } = renderHook(() => useGenerateListingMeta("listing-id"), {
      wrapper,
    });
    result.current.mutate(undefined);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("HTTP 502");
  });
});
