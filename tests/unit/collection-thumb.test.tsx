import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CollectionThumb } from "@/components/ui/CollectionThumb";

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0 } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  vi.unstubAllGlobals();
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/assets/")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ url: "https://example.com/img.jpg" }),
        } as Response);
      }
      return Promise.resolve({ ok: true, json: async () => ({}) } as Response);
    }),
  );
});

describe("CollectionThumb", () => {
  it("0 asset → placeholder render", () => {
    wrap(<CollectionThumb assetIds={[]} alt="Koleksiyon" />);
    expect(
      screen.getByTestId("collection-thumb-placeholder"),
    ).toBeInTheDocument();
  });

  it("1 asset → tek AssetImage, mosaic YOK", () => {
    wrap(<CollectionThumb assetIds={["a1"]} alt="Koleksiyon" />);
    expect(
      screen.queryByTestId("collection-thumb-mosaic"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("collection-thumb-placeholder"),
    ).not.toBeInTheDocument();
  });

  it("3 asset → single fallback (mosaic YOK)", () => {
    wrap(<CollectionThumb assetIds={["a1", "a2", "a3"]} alt="Koleksiyon" />);
    expect(
      screen.queryByTestId("collection-thumb-mosaic"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("collection-thumb-placeholder"),
    ).not.toBeInTheDocument();
  });

  it("5 asset → 2×2 mosaic, ilk 4 AssetImage fetch'lenir", () => {
    wrap(
      <CollectionThumb
        assetIds={["a1", "a2", "a3", "a4", "a5"]}
        alt="Koleksiyon"
      />,
    );
    const mosaic = screen.getByTestId("collection-thumb-mosaic");
    expect(mosaic).toBeInTheDocument();
    expect(mosaic.children.length).toBe(4);
  });
});
