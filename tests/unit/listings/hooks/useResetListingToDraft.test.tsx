// Phase 9 V1 — useResetListingToDraft hook unit test.
//
// Test scenarios:
// - happy path: fetch çağrı şekli (POST) + response parse + isSuccess
// - error path: HTTP 409 LISTING_RESET_INVALID_STATE message yansır
// - onSuccess invalidate: listing-draft + listings query keys

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useResetListingToDraft } from "@/features/listings/hooks/useResetListingToDraft";

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

describe("useResetListingToDraft", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("happy path — POST + response parse", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "DRAFT",
        previousEtsyListingId: "L-OLD-12345",
      }),
    });

    const { result } = renderHook(
      () => useResetListingToDraft("listing-id"),
      { wrapper },
    );
    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/listings/draft/listing-id/reset-to-draft",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      }),
    );

    expect(result.current.data?.status).toBe("DRAFT");
    expect(result.current.data?.previousEtsyListingId).toBe("L-OLD-12345");
  });

  it("error path — HTTP 409 INVALID_STATE message yansır", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({
        error:
          "Sadece FAILED durumundaki listing'ler DRAFT'a çevrilebilir (mevcut: PUBLISHED)",
        code: "LISTING_RESET_INVALID_STATE",
      }),
    });

    const { result } = renderHook(
      () => useResetListingToDraft("listing-id"),
      { wrapper },
    );
    result.current.mutate();

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toContain("FAILED durumundaki");
  });

  it("onSuccess invalidate — listing-draft + listings query keys", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    function customWrapper({ children }: { children: ReactNode }) {
      return (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      );
    }

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "DRAFT",
        previousEtsyListingId: null,
      }),
    });

    const { result } = renderHook(
      () => useResetListingToDraft("listing-id"),
      { wrapper: customWrapper },
    );
    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["listing-draft", "listing-id"],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["listings"],
    });
  });
});
