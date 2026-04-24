import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AssetImage } from "@/components/ui/asset-image";

function wrapper(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        // Testlerde retry/delay olmasın
        retry: false,
        retryDelay: 0,
      },
    },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("AssetImage", () => {
  it("assetId null ise 'Görsel yok' gösterir", async () => {
    wrapper(<AssetImage assetId={null} alt="test" />);
    expect(await screen.findByText("Görsel yok")).toBeInTheDocument();
  });

  it("assetId undefined ise 'Görsel yok' gösterir", async () => {
    wrapper(<AssetImage assetId={undefined} alt="test" />);
    expect(await screen.findByText("Görsel yok")).toBeInTheDocument();
  });

  it("assetId varsa ve fetch başarılıysa <img> render eder, src ve alt doğrudur", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ url: "https://example.com/image.jpg" }),
      }),
    );

    wrapper(<AssetImage assetId="asset-123" alt="Ürün görseli" />);

    const img = await screen.findByRole("img");
    expect(img).toHaveAttribute("src", "https://example.com/image.jpg");
    expect(img).toHaveAttribute("alt", "Ürün görseli");
  });

  it("fetch 404 dönerse hata fallback olarak 'Görsel yok' gösterir", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({}),
      }),
    );

    wrapper(<AssetImage assetId="asset-404" alt="test" />);

    expect(
      await screen.findByLabelText("Görsel yüklenemedi"),
    ).toBeInTheDocument();
  });

  it("fetch 500 dönerse başlangıçta loading state gösterir", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({}),
      }),
    );

    // 500 için retry var; ilk render loading state'te olmalı
    wrapper(<AssetImage assetId="asset-500" alt="test" />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
  });
});
