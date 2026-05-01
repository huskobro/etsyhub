// Phase 7 Task 32 — AddVariantsDrawer TDD test sözleşmesi.
//
// Spec Section 2.2 (drawer ile item ekleme) + plan Task 32:
//   - İki tab: "Reference Batches" (aktif) / "Review Queue" (disabled, dürüst metin)
//   - Reference selector → designs fetch → jobId üzerinden batch grouping
//   - Per-item checkbox + "Tüm batch'i ekle" + duplicate koruma (existingDesignIds)
//   - POST /api/selection/sets/[setId]/items + invalidate set query
//   - Empty / loading / error states
//   - Drift #6 + KIE flaky: Review Queue tab disabled — Phase 6 canlı smoke
//     gating. Tooltip + disabled attr + click no-op.
//
// Pattern: create-set-modal.test (Radix Dialog Portal + matchMedia mock).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

import { AddVariantsDrawer } from "@/features/selection/components/AddVariantsDrawer";

function wrap(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

// Yardımcı: References endpoint cevabı ({ items, nextCursor }) ve
// variation-jobs cevabı ({ designs }) için fetch routing.
function makeFetchMock(opts: {
  references?: Array<{
    id: string;
    notes?: string | null;
    productType?: { displayName: string } | null;
  }>;
  designsByReferenceId?: Record<
    string,
    Array<{
      id: string;
      jobId: string | null;
      assetId: string;
      createdAt: string;
    }>
  >;
  postItems?: { ok: boolean; status?: number; body?: unknown };
}) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();

    if (url === "/api/references" && (!init || init.method === undefined)) {
      return {
        ok: true,
        json: async () => ({
          items: opts.references ?? [],
          nextCursor: null,
        }),
      };
    }

    if (url.startsWith("/api/variation-jobs?")) {
      const u = new URL(url, "http://localhost");
      const refId = u.searchParams.get("referenceId") ?? "";
      const designs = opts.designsByReferenceId?.[refId] ?? [];
      return {
        ok: true,
        json: async () => ({ designs }),
      };
    }

    if (
      url.match(/^\/api\/selection\/sets\/[^/]+\/items$/) &&
      init?.method === "POST"
    ) {
      const post = opts.postItems ?? { ok: true };
      return {
        ok: post.ok,
        status: post.status ?? (post.ok ? 201 : 400),
        json: async () => post.body ?? { items: [] },
      };
    }

    throw new Error(`Unexpected fetch: ${url}`);
  });
}

beforeEach(() => {
  vi.spyOn(global, "fetch").mockReset?.();
});

describe("AddVariantsDrawer — render & default state", () => {
  it("open=false → drawer DOM'da yok", () => {
    wrap(
      <AddVariantsDrawer
        open={false}
        onOpenChange={vi.fn()}
        setId="set-1"
        existingDesignIds={new Set()}
      />,
    );
    expect(
      screen.queryByText("Varyant ekle"),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("open=true → başlık + iki tab görünür, Reference Batches aktif", () => {
    vi.stubGlobal("fetch", makeFetchMock({ references: [] }));
    wrap(
      <AddVariantsDrawer
        open
        onOpenChange={vi.fn()}
        setId="set-1"
        existingDesignIds={new Set()}
      />,
    );
    expect(screen.getByText("Varyant ekle")).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: /Reference Batches/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: /Review Queue/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: /Reference Batches/i }),
    ).toHaveAttribute("aria-selected", "true");
  });
});

describe("AddVariantsDrawer — Review Queue tab disabled (Phase 7 v1.0.1 polish)", () => {
  it("Review Queue tab aria-disabled + title tooltip (Phase 6 smoke gating, dürüst metin)", () => {
    vi.stubGlobal("fetch", makeFetchMock({ references: [] }));
    wrap(
      <AddVariantsDrawer
        open
        onOpenChange={vi.fn()}
        setId="set-1"
        existingDesignIds={new Set()}
      />,
    );
    const reviewTab = screen.getByRole("tab", { name: /Review Queue/i });
    // Polish öncesi `disabled` idi; polish sonrası tab clickable hâle geldi.
    // Dürüst sinyal: aria-disabled + title tooltip + sr-only hint.
    expect(reviewTab.getAttribute("aria-disabled")).toBe("true");
    const tooltipText = reviewTab.getAttribute("title") ?? "";
    expect(tooltipText.toLowerCase()).toMatch(/phase 6.*smoke/);
  });

  it("Review Queue tab tıklanırsa görünür inline notice render edilir (yardımsever, sahte capability YOK)", () => {
    vi.stubGlobal("fetch", makeFetchMock({ references: [] }));
    wrap(
      <AddVariantsDrawer
        open
        onOpenChange={vi.fn()}
        setId="set-1"
        existingDesignIds={new Set()}
      />,
    );
    const reviewTab = screen.getByRole("tab", { name: /Review Queue/i });
    fireEvent.click(reviewTab);
    // Reference Batches artık aktif değil
    expect(
      screen.getByRole("tab", { name: /Reference Batches/i }),
    ).toHaveAttribute("aria-selected", "false");
    // Görünür inline notice: kullanıcı neden disabled olduğunu görür
    const notice = screen.getByRole("status");
    expect(notice).toHaveTextContent(/Review Queue henüz aktif değil/i);
    expect(notice).toHaveTextContent(/Phase 6 canlı smoke/i);
  });
});

describe("AddVariantsDrawer — Reference Batches tab — empty references", () => {
  it("kullanıcının referansı yok → 'Henüz referansınız yok' empty state", async () => {
    vi.stubGlobal("fetch", makeFetchMock({ references: [] }));
    wrap(
      <AddVariantsDrawer
        open
        onOpenChange={vi.fn()}
        setId="set-1"
        existingDesignIds={new Set()}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Henüz referansınız yok/i),
      ).toBeInTheDocument();
    });
  });
});

describe("AddVariantsDrawer — reference selector & batch grouping", () => {
  it("references yüklendi → selector dropdown görünür, batch listesi yok", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetchMock({
        references: [
          { id: "ref-1", notes: "Boho wall art", productType: null },
          { id: "ref-2", notes: "Nursery print", productType: null },
        ],
      }),
    );
    wrap(
      <AddVariantsDrawer
        open
        onOpenChange={vi.fn()}
        setId="set-1"
        existingDesignIds={new Set()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/Referans seç/i)).toBeInTheDocument();
    });
    // Henüz reference seçilmedi → batch listesi/empty yok, ipucu metni var
    expect(
      screen.getByText(/Bir referans seçin/i),
    ).toBeInTheDocument();
  });

  it("reference seçildi, design yok → 'henüz variation üretilmemiş'", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetchMock({
        references: [{ id: "ref-1", notes: "Boho", productType: null }],
        designsByReferenceId: { "ref-1": [] },
      }),
    );
    wrap(
      <AddVariantsDrawer
        open
        onOpenChange={vi.fn()}
        setId="set-1"
        existingDesignIds={new Set()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/Referans seç/i)).toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText(/Referans seç/i), {
      target: { value: "ref-1" },
    });

    await waitFor(() => {
      expect(
        screen.getByText(/henüz variation üretilmemiş/i),
      ).toBeInTheDocument();
    });
  });

  it("reference seçildi, designs jobId üzerinden gruplanır", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetchMock({
        references: [{ id: "ref-1", notes: "Boho", productType: null }],
        designsByReferenceId: {
          "ref-1": [
            {
              id: "d1",
              jobId: "job-A",
              assetId: "a1",
              createdAt: "2026-04-30T10:00:00Z",
            },
            {
              id: "d2",
              jobId: "job-A",
              assetId: "a2",
              createdAt: "2026-04-30T10:00:00Z",
            },
            {
              id: "d3",
              jobId: "job-B",
              assetId: "a3",
              createdAt: "2026-04-29T10:00:00Z",
            },
          ],
        },
      }),
    );
    wrap(
      <AddVariantsDrawer
        open
        onOpenChange={vi.fn()}
        setId="set-1"
        existingDesignIds={new Set()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/Referans seç/i)).toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText(/Referans seç/i), {
      target: { value: "ref-1" },
    });

    // İki ayrı batch card render edilir
    await waitFor(() => {
      expect(screen.getAllByTestId("batch-card")).toHaveLength(2);
    });
    // Her batch için "Tüm batch'i ekle" butonu vardır
    expect(
      screen.getAllByRole("button", { name: /Tüm batch'i ekle/i }),
    ).toHaveLength(2);
  });
});

describe("AddVariantsDrawer — selection & duplicate protection", () => {
  it("design checkbox toggle → seçim count güncellenir", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetchMock({
        references: [{ id: "ref-1", notes: "Boho", productType: null }],
        designsByReferenceId: {
          "ref-1": [
            {
              id: "d1",
              jobId: "job-A",
              assetId: "a1",
              createdAt: "2026-04-30T10:00:00Z",
            },
            {
              id: "d2",
              jobId: "job-A",
              assetId: "a2",
              createdAt: "2026-04-30T10:00:00Z",
            },
          ],
        },
      }),
    );
    wrap(
      <AddVariantsDrawer
        open
        onOpenChange={vi.fn()}
        setId="set-1"
        existingDesignIds={new Set()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/Referans seç/i)).toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText(/Referans seç/i), {
      target: { value: "ref-1" },
    });

    await waitFor(() => {
      expect(screen.getAllByTestId("batch-card")).toHaveLength(1);
    });

    const checkboxes = screen.getAllByRole("checkbox", { name: /Varyant/i });
    fireEvent.click(checkboxes[0]!);
    fireEvent.click(checkboxes[1]!);

    expect(screen.getByTestId("submit-add-items").textContent).toMatch(
      /2 variant/,
    );
  });

  it("existingDesignIds set → ilgili design checkbox disabled + 'set'te var' badge", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetchMock({
        references: [{ id: "ref-1", notes: "Boho", productType: null }],
        designsByReferenceId: {
          "ref-1": [
            {
              id: "d1",
              jobId: "job-A",
              assetId: "a1",
              createdAt: "2026-04-30T10:00:00Z",
            },
            {
              id: "d2",
              jobId: "job-A",
              assetId: "a2",
              createdAt: "2026-04-30T10:00:00Z",
            },
          ],
        },
      }),
    );
    wrap(
      <AddVariantsDrawer
        open
        onOpenChange={vi.fn()}
        setId="set-1"
        existingDesignIds={new Set(["d1"])}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/Referans seç/i)).toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText(/Referans seç/i), {
      target: { value: "ref-1" },
    });

    await waitFor(() => {
      expect(screen.getAllByTestId("batch-card")).toHaveLength(1);
    });

    const checkboxes = screen.getAllByRole("checkbox", { name: /Varyant/i });
    expect(checkboxes[0]).toBeDisabled();
    expect(checkboxes[1]).not.toBeDisabled();
    // "set'te var" badge'leri görünür (header summary + tile overlay)
    expect(screen.getAllByText(/set'te var/i).length).toBeGreaterThanOrEqual(1);
  });

  it("'Tüm batch'i ekle' → batch'in non-duplicate item'ları seçilir", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetchMock({
        references: [{ id: "ref-1", notes: "Boho", productType: null }],
        designsByReferenceId: {
          "ref-1": [
            {
              id: "d1",
              jobId: "job-A",
              assetId: "a1",
              createdAt: "2026-04-30T10:00:00Z",
            },
            {
              id: "d2",
              jobId: "job-A",
              assetId: "a2",
              createdAt: "2026-04-30T10:00:00Z",
            },
            {
              id: "d3",
              jobId: "job-A",
              assetId: "a3",
              createdAt: "2026-04-30T10:00:00Z",
            },
          ],
        },
      }),
    );
    wrap(
      <AddVariantsDrawer
        open
        onOpenChange={vi.fn()}
        setId="set-1"
        existingDesignIds={new Set(["d2"])}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/Referans seç/i)).toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText(/Referans seç/i), {
      target: { value: "ref-1" },
    });

    await waitFor(() => {
      expect(screen.getAllByTestId("batch-card")).toHaveLength(1);
    });

    fireEvent.click(
      screen.getByRole("button", { name: /Tüm batch'i ekle/i }),
    );
    // d1 + d3 seçilir; d2 set'te zaten var → atlanır
    expect(screen.getByTestId("submit-add-items").textContent).toMatch(
      /2 variant/,
    );
  });
});

describe("AddVariantsDrawer — mutation", () => {
  it("Ekle butonu → POST /api/selection/sets/[setId]/items çağrılır", async () => {
    const fetchMock = makeFetchMock({
      references: [{ id: "ref-1", notes: "Boho", productType: null }],
      designsByReferenceId: {
        "ref-1": [
          {
            id: "d1",
            jobId: "job-A",
            assetId: "a1",
            createdAt: "2026-04-30T10:00:00Z",
          },
        ],
      },
      postItems: { ok: true, status: 201, body: { items: [{ id: "i1" }] } },
    });
    vi.stubGlobal("fetch", fetchMock);
    const onOpenChange = vi.fn();

    wrap(
      <AddVariantsDrawer
        open
        onOpenChange={onOpenChange}
        setId="set-77"
        existingDesignIds={new Set()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/Referans seç/i)).toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText(/Referans seç/i), {
      target: { value: "ref-1" },
    });
    await waitFor(() => {
      expect(screen.getAllByTestId("batch-card")).toHaveLength(1);
    });
    fireEvent.click(screen.getAllByRole("checkbox", { name: /Varyant/i })[0]!);
    fireEvent.click(screen.getByTestId("submit-add-items"));

    await waitFor(() => {
      const postCall = fetchMock.mock.calls.find(
        ([u, init]) =>
          (typeof u === "string" ? u : "").endsWith("/items") &&
          (init as RequestInit | undefined)?.method === "POST",
      );
      expect(postCall).toBeDefined();
      const init = postCall![1] as RequestInit;
      expect(init.method).toBe("POST");
      expect(JSON.parse(init.body as string)).toEqual({
        items: [{ generatedDesignId: "d1" }],
      });
    });

    // Success → drawer kapanır
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("400 error → inline alert + drawer açık kalır", async () => {
    const fetchMock = makeFetchMock({
      references: [{ id: "ref-1", notes: "Boho", productType: null }],
      designsByReferenceId: {
        "ref-1": [
          {
            id: "d1",
            jobId: "job-A",
            assetId: "a1",
            createdAt: "2026-04-30T10:00:00Z",
          },
        ],
      },
      postItems: {
        ok: false,
        status: 409,
        body: { error: "Set finalize edildi" },
      },
    });
    vi.stubGlobal("fetch", fetchMock);
    const onOpenChange = vi.fn();

    wrap(
      <AddVariantsDrawer
        open
        onOpenChange={onOpenChange}
        setId="set-77"
        existingDesignIds={new Set()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/Referans seç/i)).toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText(/Referans seç/i), {
      target: { value: "ref-1" },
    });
    await waitFor(() => {
      expect(screen.getAllByTestId("batch-card")).toHaveLength(1);
    });
    fireEvent.click(screen.getAllByRole("checkbox", { name: /Varyant/i })[0]!);
    fireEvent.click(screen.getByTestId("submit-add-items"));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(screen.getByRole("alert").textContent).toMatch(/Set finalize/);
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});

describe("AddVariantsDrawer — bottom action bar", () => {
  it("hiç seçim yok → 'Ekle' disabled", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetchMock({
        references: [{ id: "ref-1", notes: "Boho", productType: null }],
        designsByReferenceId: {
          "ref-1": [
            {
              id: "d1",
              jobId: "job-A",
              assetId: "a1",
              createdAt: "2026-04-30T10:00:00Z",
            },
          ],
        },
      }),
    );
    wrap(
      <AddVariantsDrawer
        open
        onOpenChange={vi.fn()}
        setId="set-1"
        existingDesignIds={new Set()}
      />,
    );
    await waitFor(() => {
      expect(screen.getByLabelText(/Referans seç/i)).toBeInTheDocument();
    });
    expect(screen.getByTestId("submit-add-items")).toBeDisabled();
  });

  it("İptal butonu → onOpenChange(false)", () => {
    vi.stubGlobal("fetch", makeFetchMock({ references: [] }));
    const onOpenChange = vi.fn();
    wrap(
      <AddVariantsDrawer
        open
        onOpenChange={onOpenChange}
        setId="set-1"
        existingDesignIds={new Set()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^İptal$/ }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
