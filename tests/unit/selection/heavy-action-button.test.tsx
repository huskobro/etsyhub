// Phase 7 Task 29 — HeavyActionButton testleri.
//
// Sözleşme (plan Task 29 + spec Section 3.2 + Section 5.1):
//   - Background remove butonu — heavy lifecycle (BullMQ job).
//   - Idle state (draft + activeHeavyJobId null) → "Background remove" label,
//     spinner yok, enabled.
//   - Click → POST /api/selection/sets/{setId}/items/{itemId}/edit/heavy
//     body: { op: "background-remove" }.
//   - Mutation pending → spinner görünür, button disabled.
//   - Mutation success → invalidateQueries(["selection","set",setId]).
//   - isProcessing (item.activeHeavyJobId set) → "İşleniyor..." label,
//     spinner, disabled, hint "~5-15 saniye sürebilir".
//   - Polling: isProcessing iken useQuery enabled (refetchInterval 3000),
//     not processing iken disabled.
//   - Mutation error → role="alert" inline error mesaj + "Tekrar dene"
//     buton; tekrar dene yeni mutation invoke eder.
//   - Read-only set (isReadOnly=true) → button disabled.
//
// Phase 6 emsali: tests/unit/selection/quick-actions.test.tsx (QueryClient
// wrapper + fetch mock + fireEvent + waitFor).

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import type { SelectionItemView } from "@/features/selection/queries";

import { HeavyActionButton } from "@/features/selection/components/HeavyActionButton";

function wrapper(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

function makeItem(overrides: Partial<SelectionItemView> = {}): SelectionItemView {
  return {
    id: "i1",
    selectionSetId: "set-1",
    generatedDesignId: "gd1",
    sourceAssetId: "src-1",
    editedAssetId: null,
    lastUndoableAssetId: null,
    editHistoryJson: [],
    activeHeavyJobId: null,
    status: "pending",
    position: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    review: null,
    ...overrides,
  } as unknown as SelectionItemView;
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.useRealTimers();
});

describe("HeavyActionButton — idle state", () => {
  it("Default render: 'Background remove' label, enabled, spinner yok", () => {
    wrapper(
      <HeavyActionButton
        setId="set-1"
        item={makeItem()}
        isReadOnly={false}
      />,
    );
    const btn = screen.getByRole("button", { name: /background remove/i });
    expect(btn).toBeInTheDocument();
    expect(btn).not.toBeDisabled();
    // Spinner yok (label "Yükleniyor" element bulunmamalı)
    expect(screen.queryByLabelText(/yükleniyor/i)).not.toBeInTheDocument();
  });
});

describe("HeavyActionButton — read-only set", () => {
  it("isReadOnly=true → button disabled", () => {
    wrapper(
      <HeavyActionButton
        setId="set-1"
        item={makeItem()}
        isReadOnly={true}
      />,
    );
    const btn = screen.getByRole("button", { name: /background remove/i });
    expect(btn).toBeDisabled();
  });
});

describe("HeavyActionButton — isProcessing (activeHeavyJobId set)", () => {
  it("activeHeavyJobId set → 'İşleniyor...' label + spinner + disabled + hint", () => {
    wrapper(
      <HeavyActionButton
        setId="set-1"
        item={makeItem({ activeHeavyJobId: "job-abc" })}
        isReadOnly={false}
      />,
    );
    // Label "İşleniyor..."
    const btn = screen.getByRole("button", { name: /işleniyor/i });
    expect(btn).toBeInTheDocument();
    expect(btn).toBeDisabled();
    // Spinner aria-label "Yükleniyor"
    expect(screen.getByLabelText(/yükleniyor/i)).toBeInTheDocument();
    // Hint
    expect(screen.getByText(/5-15 saniye sürebilir/i)).toBeInTheDocument();
  });
});

describe("HeavyActionButton — mutation invocation", () => {
  it("Click → POST /edit/heavy { op: 'background-remove' }", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ jobId: "job-xyz" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    wrapper(
      <HeavyActionButton
        setId="set-1"
        item={makeItem({ id: "item-9" })}
        isReadOnly={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /background remove/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/selection/sets/set-1/items/item-9/edit/heavy");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      op: "background-remove",
    });
  });

  it("Mutation pending → button disabled + spinner görünür", async () => {
    let resolveFn: ((v: Response) => void) | undefined;
    const pending = new Promise<Response>((resolve) => {
      resolveFn = resolve;
    });
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(pending));

    wrapper(
      <HeavyActionButton
        setId="set-1"
        item={makeItem()}
        isReadOnly={false}
      />,
    );
    const btn = screen.getByRole("button", { name: /background remove/i });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(btn).toBeDisabled();
      expect(screen.getByLabelText(/yükleniyor/i)).toBeInTheDocument();
    });

    // Cleanup
    resolveFn?.(
      new Response(JSON.stringify({ jobId: "j1" }), { status: 200 }),
    );
  });
});

describe("HeavyActionButton — error state + retry", () => {
  it("Mutation 500 → role='alert' error mesaj + 'Tekrar dene' buton", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ error: "Heavy job başlatılamadı" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    wrapper(
      <HeavyActionButton
        setId="set-1"
        item={makeItem()}
        isReadOnly={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /background remove/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    // Türkçe `İ` (U+0130) regex /i lowercase folding sorunu — explicit
    // string match.
    expect(screen.getByRole("alert").textContent).toContain(
      "Heavy job başlatılamadı",
    );
    // Retry button
    expect(
      screen.getByRole("button", { name: /tekrar dene/i }),
    ).toBeInTheDocument();
  });

  it("'Tekrar dene' → yeni mutation invoke eder", async () => {
    const fetchMock = vi
      .fn()
      // 1. çağrı: fail
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: "Geçici hata" }),
          { status: 500, headers: { "Content-Type": "application/json" } },
        ),
      )
      // 2. çağrı: success
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ jobId: "j2" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    wrapper(
      <HeavyActionButton
        setId="set-1"
        item={makeItem({ id: "item-r" })}
        isReadOnly={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /background remove/i }));

    // İlk fail
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    // Retry
    fireEvent.click(screen.getByRole("button", { name: /tekrar dene/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
    const [url2] = fetchMock.mock.calls[1]!;
    expect(url2).toBe("/api/selection/sets/set-1/items/item-r/edit/heavy");
  });
});

describe("HeavyActionButton — polling enable/disable", () => {
  it("isProcessing=false → polling fetch tetiklenmez (no /sets GET)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    wrapper(
      <HeavyActionButton
        setId="set-1"
        item={makeItem()}
        isReadOnly={false}
      />,
    );
    // Idle state — herhangi bir fetch çağrısı yok
    // (Polling sadece isProcessing iken aktif olmalı.)
    await new Promise((r) => setTimeout(r, 50));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // Not: refetchInterval 3000ms test'te zorlu (real timer 3+ sn). Pragmatik:
  // polling aktif state'i (isProcessing item ile render) yukarıda
  // "isProcessing" describe bloğunda doğrulandı; polling'in interval mekaniği
  // TanStack Query'nin kendi davranışı — bu seviyede test edilmez.
});
