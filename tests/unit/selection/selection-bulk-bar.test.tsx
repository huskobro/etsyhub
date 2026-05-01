// Phase 7 Task 33 — SelectionBulkBar testleri.
//
// Sözleşme (plan Task 33 + spec Section 3.2):
//   - multiSelectIds.size === 0 → primitive null (render YOK).
//   - multiSelectIds.size > 0 + draft set → bar visible: "{N} varyant seçildi"
//     + "Reddet (N)" + "Seçime ekle (N)" butonları.
//   - isReadOnly (ready/archived) → bar görünmez (Phase 7 invariant: read-only
//     mutation yok; multiSelect olsa bile UI mutation tetikleyemez).
//   - Filter "all" / "active" → Hard delete buton GÖRÜNMEZ.
//   - Filter "rejected" → Hard delete buton GÖRÜNÜR.
//   - "Reddet" click → PATCH bulk { status: "rejected" } → invalidate +
//     clearMultiSelect.
//   - "Seçime ekle" click → PATCH bulk { status: "selected" }.
//   - Hard delete click → onHardDeleteRequest callback (Task 34 modal'ı).
//   - Mutation pending → tüm bar action butonları disabled.
//   - Mutation error → inline alert (role=alert) görünür.
//   - Dismiss (X) → clearMultiSelect (BulkActionBar primitive davranışı reuse).
//
// Phase 6 emsali: tests/unit/selection/quick-actions.test.tsx — fetch mock +
// QueryClientProvider wrapper paterni; userEvent yerine fireEvent.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";

import { SelectionBulkBar } from "@/features/selection/components/SelectionBulkBar";
import { useStudioStore } from "@/features/selection/stores/studio-store";

function wrapper(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  // Store reset — testler arası izolasyon
  useStudioStore.setState({
    activeItemId: null,
    multiSelectIds: new Set<string>(),
    filter: "all",
    currentSetId: null,
  });
  vi.stubGlobal("fetch", vi.fn());
});

// ────────────────────────────────────────────────────────────
// Render gating
// ────────────────────────────────────────────────────────────

describe("SelectionBulkBar — render gating", () => {
  it("multiSelectIds boş → primitive null döner (region yok)", () => {
    wrapper(<SelectionBulkBar setId="set-1" isReadOnly={false} />);
    expect(screen.queryByRole("region", { name: /toplu aksiyon/i })).toBeNull();
  });

  it("seçim var + isReadOnly=true → bar görünmez (Phase 7 invariant)", () => {
    useStudioStore.setState({
      multiSelectIds: new Set(["i1", "i2"]),
    });
    wrapper(<SelectionBulkBar setId="set-1" isReadOnly />);
    expect(screen.queryByRole("region", { name: /toplu aksiyon/i })).toBeNull();
  });

  it("seçim var + draft set → bar visible, '{N} varyant seçildi' + 2 buton", () => {
    useStudioStore.setState({
      multiSelectIds: new Set(["i1", "i2", "i3"]),
    });
    wrapper(<SelectionBulkBar setId="set-1" isReadOnly={false} />);

    expect(
      screen.getByRole("region", { name: /toplu aksiyon/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/3 varyant seçildi/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /reddet \(3\)/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /seçime ekle \(3\)/i }),
    ).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
// Filter-aware action set (rejected → hard delete)
// ────────────────────────────────────────────────────────────

describe("SelectionBulkBar — filter-aware actions", () => {
  it("filter='all' → 'Kalıcı çıkar' GÖRÜNMEZ", () => {
    useStudioStore.setState({
      multiSelectIds: new Set(["i1"]),
      filter: "all",
    });
    wrapper(<SelectionBulkBar setId="set-1" isReadOnly={false} />);
    expect(screen.queryByRole("button", { name: /kalıcı çıkar/i })).toBeNull();
  });

  it("filter='active' → 'Kalıcı çıkar' GÖRÜNMEZ", () => {
    useStudioStore.setState({
      multiSelectIds: new Set(["i1"]),
      filter: "active",
    });
    wrapper(<SelectionBulkBar setId="set-1" isReadOnly={false} />);
    expect(screen.queryByRole("button", { name: /kalıcı çıkar/i })).toBeNull();
  });

  it("filter='rejected' → 'Kalıcı çıkar (N)' GÖRÜNÜR", () => {
    useStudioStore.setState({
      multiSelectIds: new Set(["i1", "i2"]),
      filter: "rejected",
    });
    wrapper(<SelectionBulkBar setId="set-1" isReadOnly={false} />);
    expect(
      screen.getByRole("button", { name: /kalıcı çıkar \(2\)/i }),
    ).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
// Bulk PATCH mutation — "Reddet" + "Seçime ekle"
// ────────────────────────────────────────────────────────────

describe("SelectionBulkBar — bulk status mutation", () => {
  it("'Reddet' click → PATCH /items/bulk { status: 'rejected' } + clearMultiSelect", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ updatedCount: 2 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    useStudioStore.setState({
      multiSelectIds: new Set(["i1", "i2"]),
    });
    wrapper(<SelectionBulkBar setId="set-A" isReadOnly={false} />);

    fireEvent.click(screen.getByRole("button", { name: /reddet \(2\)/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/selection/sets/set-A/items/bulk");
    expect(init.method).toBe("PATCH");
    const body = JSON.parse(init.body as string);
    expect(body.status).toBe("rejected");
    expect(new Set(body.itemIds)).toEqual(new Set(["i1", "i2"]));

    // Success sonrası clearMultiSelect tetiklendi mi
    await waitFor(() => {
      expect(useStudioStore.getState().multiSelectIds.size).toBe(0);
    });
  });

  it("'Seçime ekle' click → PATCH /items/bulk { status: 'selected' }", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ updatedCount: 1 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    useStudioStore.setState({
      multiSelectIds: new Set(["i1"]),
    });
    wrapper(<SelectionBulkBar setId="set-B" isReadOnly={false} />);

    fireEvent.click(screen.getByRole("button", { name: /seçime ekle \(1\)/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/selection/sets/set-B/items/bulk");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toMatchObject({
      status: "selected",
      itemIds: ["i1"],
    });
  });
});

// ────────────────────────────────────────────────────────────
// Hard delete — onHardDeleteRequest callback (Task 34 modal'a hazır)
// ────────────────────────────────────────────────────────────

describe("SelectionBulkBar — hard delete callback", () => {
  it("filter='rejected' + 'Kalıcı çıkar' click → onHardDeleteRequest(itemIds)", () => {
    const onHardDeleteRequest = vi.fn();
    useStudioStore.setState({
      multiSelectIds: new Set(["i1", "i2"]),
      filter: "rejected",
    });
    wrapper(
      <SelectionBulkBar
        setId="set-1"
        isReadOnly={false}
        onHardDeleteRequest={onHardDeleteRequest}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /kalıcı çıkar \(2\)/i }));

    expect(onHardDeleteRequest).toHaveBeenCalledTimes(1);
    const ids = onHardDeleteRequest.mock.calls[0]![0] as string[];
    expect(new Set(ids)).toEqual(new Set(["i1", "i2"]));
    // Hard delete fetch tetiklenmiyor — modal Task 34'te DELETE'i tetikler
    expect((globalThis.fetch as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(0);
  });

  it("filter='rejected' + onHardDeleteRequest verilmedi → buton hâlâ render (no crash)", () => {
    useStudioStore.setState({
      multiSelectIds: new Set(["i1"]),
      filter: "rejected",
    });
    wrapper(<SelectionBulkBar setId="set-1" isReadOnly={false} />);
    const btn = screen.getByRole("button", { name: /kalıcı çıkar/i });
    // Click crash etmemeli (callback opsiyonel)
    expect(() => fireEvent.click(btn)).not.toThrow();
  });
});

// ────────────────────────────────────────────────────────────
// Pending + error states
// ────────────────────────────────────────────────────────────

describe("SelectionBulkBar — pending state", () => {
  it("mutation pending → 'Reddet' ve 'Seçime ekle' butonları disabled", async () => {
    let resolveFn: ((v: Response) => void) | undefined;
    const pending = new Promise<Response>((resolve) => {
      resolveFn = resolve;
    });
    const fetchMock = vi.fn().mockReturnValue(pending);
    vi.stubGlobal("fetch", fetchMock);

    useStudioStore.setState({
      multiSelectIds: new Set(["i1", "i2"]),
    });
    wrapper(<SelectionBulkBar setId="set-1" isReadOnly={false} />);

    fireEvent.click(screen.getByRole("button", { name: /seçime ekle \(2\)/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /seçime ekle \(2\)/i }),
      ).toBeDisabled();
      expect(
        screen.getByRole("button", { name: /reddet \(2\)/i }),
      ).toBeDisabled();
    });

    // Cleanup
    resolveFn?.(
      new Response(JSON.stringify({ updatedCount: 2 }), { status: 200 }),
    );
  });
});

describe("SelectionBulkBar — error state", () => {
  it("mutation fail → inline alert görünür (role=alert)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Bulk işlemi başarısız" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    useStudioStore.setState({
      multiSelectIds: new Set(["i1"]),
    });
    wrapper(<SelectionBulkBar setId="set-1" isReadOnly={false} />);

    fireEvent.click(screen.getByRole("button", { name: /reddet \(1\)/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    // Türkçe `İ` (U+0130) JS regex `/i` ile lowercase'e çevrilmiyor; explicit
    // string contains.
    expect(screen.getByRole("alert").textContent).toContain(
      "Bulk işlemi başarısız",
    );

    // Hata sonrası selection korunur (clearMultiSelect SADECE success'te)
    expect(useStudioStore.getState().multiSelectIds.size).toBe(1);
  });
});

// ────────────────────────────────────────────────────────────
// Dismiss → clearMultiSelect
// ────────────────────────────────────────────────────────────

describe("SelectionBulkBar — dismiss", () => {
  it("X (Seçimi temizle) butonu → clearMultiSelect", () => {
    useStudioStore.setState({
      multiSelectIds: new Set(["i1", "i2"]),
    });
    wrapper(<SelectionBulkBar setId="set-1" isReadOnly={false} />);

    fireEvent.click(screen.getByRole("button", { name: /seçimi temizle/i }));

    expect(useStudioStore.getState().multiSelectIds.size).toBe(0);
  });
});
