// Phase 9 V1 Task 22 — useSubmitListingDraft hook unit test.
//
// Test scenarios:
// - happy path: fetch çağrı şekli (POST + body "{}") + response parse + isSuccess
// - error path: HTTP 503 NOT_CONFIGURED message yansır
// - error path: HTTP 400 ConnectionNotFound message yansır
// - error path: HTTP 422 MissingFields message yansır
// - error path: body parse fail → fallback `HTTP {status}` message
// - onSuccess invalidate: listing-draft + listings query keys

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useSubmitListingDraft } from "@/features/listings/hooks/useSubmitListingDraft";

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

describe("useSubmitListingDraft", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("happy path — POST + body '{}' + response parse", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "PUBLISHED",
        etsyListingId: "1234567890",
        failedReason: null,
        providerSnapshot: "etsy-mock@v3-2026-05-03",
      }),
    });

    const { result } = renderHook(() => useSubmitListingDraft("listing-id"), {
      wrapper,
    });
    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/listings/draft/listing-id/submit",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      }),
    );
    const callArgs = fetchMock.mock.calls[0];
    expect(callArgs).toBeDefined();
    const init = callArgs?.[1] as RequestInit;
    expect(init.body).toBe("{}");

    expect(result.current.data?.status).toBe("PUBLISHED");
    expect(result.current.data?.etsyListingId).toBe("1234567890");
    expect(result.current.data?.failedReason).toBeNull();
    expect(result.current.data?.providerSnapshot).toBe(
      "etsy-mock@v3-2026-05-03",
    );
  });

  it("error path — HTTP 503 NOT_CONFIGURED message yansır", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({
        error: "Etsy entegrasyonu yapılandırılmamış",
        code: "ETSY_NOT_CONFIGURED",
      }),
    });

    const { result } = renderHook(() => useSubmitListingDraft("listing-id"), {
      wrapper,
    });
    result.current.mutate();

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe(
      "Etsy entegrasyonu yapılandırılmamış",
    );
  });

  it("error path — HTTP 400 ConnectionNotFound message yansır", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        error: "Etsy bağlantısı bulunamadı",
        code: "ETSY_CONNECTION_NOT_FOUND",
      }),
    });

    const { result } = renderHook(() => useSubmitListingDraft("listing-id"), {
      wrapper,
    });
    result.current.mutate();

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Etsy bağlantısı bulunamadı");
  });

  it("error path — HTTP 422 MissingFields message yansır", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: async () => ({
        error: "Listing zorunlu alanları eksik: title, price",
        code: "LISTING_SUBMIT_MISSING_FIELDS",
        details: { missing: ["title", "price"] },
      }),
    });

    const { result } = renderHook(() => useSubmitListingDraft("listing-id"), {
      wrapper,
    });
    result.current.mutate();

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe(
      "Listing zorunlu alanları eksik: title, price",
    );
  });

  it("error path — body parse fail → HTTP {status} fallback", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error("invalid json");
      },
    });

    const { result } = renderHook(() => useSubmitListingDraft("listing-id"), {
      wrapper,
    });
    result.current.mutate();

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("HTTP 502");
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
        status: "PUBLISHED",
        etsyListingId: "9999",
        failedReason: null,
        providerSnapshot: "etsy-mock@v3-2026-05-03",
      }),
    });

    const { result } = renderHook(() => useSubmitListingDraft("listing-id"), {
      wrapper: customWrapper,
    });
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
