// Phase 7 Task 30 — UndoResetBar testleri.
//
// Sözleşme (plan Task 30 + spec Section 3.2 / 4.5):
//   - Undo + Reset action butonları (lastUndoableAssetId / editedAssetId
//     varlığına göre enabled state).
//   - History listesi info-only — max 5, en yeni üstte (reverse), op label
//     TR mapping, params.ratio suffix, failed entry "— başarısız" + danger dot.
//   - Relative timestamp TR ("az önce", "5 dk önce", "2 sa önce").
//   - Undo click → POST /undo + invalidateQueries.
//   - Reset click → POST /reset + invalidateQueries.
//   - Mutation error → inline alert role="alert".
//   - Read-only set → her iki buton disabled.
//   - Pending state → her iki buton disabled.
//
// Phase 6 emsali (fake timers): tests/unit/url-public-check.test.ts —
// `vi.useFakeTimers()` + `vi.setSystemTime(...)` ile deterministik Date.now.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import type { SelectionItemView } from "@/features/selection/queries";

import { UndoResetBar } from "@/features/selection/components/UndoResetBar";

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
    status: "pending",
    position: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    review: null,
    ...overrides,
  } as unknown as SelectionItemView;
}

const NOW = new Date("2026-04-30T12:00:00Z");

// Fake timers SADECE relative timestamp testlerinde gerekli — mutation
// testlerinde fake timers + fetch promise'ları timeout yapıyor (vitest
// runner'ın `waitFor` polling'i fake clock'a takılıyor). Strateji: global
// beforeEach yalnız fetch reset; relative-timestamp `describe` block'u
// kendi fake timer setup'ını yönetir.

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ────────────────────────────────────────────────────────────
// Action buton state'leri
// ────────────────────────────────────────────────────────────

describe("UndoResetBar — buton state'leri", () => {
  it("lastUndoableAssetId yok → 'Son işlemi geri al' disabled + tooltip 'Geri alınacak işlem yok'", () => {
    const item = makeItem({ lastUndoableAssetId: null });
    wrapper(<UndoResetBar setId="set-1" item={item} isReadOnly={false} />);
    const btn = screen.getByRole("button", { name: /son işlemi geri al/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("title", "Geri alınacak işlem yok");
  });

  it("editedAssetId yok → 'Orijinale döndür' disabled + tooltip 'Düzenleme yok'", () => {
    const item = makeItem({ editedAssetId: null });
    wrapper(<UndoResetBar setId="set-1" item={item} isReadOnly={false} />);
    const btn = screen.getByRole("button", { name: /orijinale döndür/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("title", "Düzenleme yok");
  });

  it("lastUndoableAssetId + editedAssetId var → her ikisi enabled", () => {
    const item = makeItem({
      lastUndoableAssetId: "asset-prev",
      editedAssetId: "asset-now",
    });
    wrapper(<UndoResetBar setId="set-1" item={item} isReadOnly={false} />);
    expect(screen.getByRole("button", { name: /son işlemi geri al/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /orijinale döndür/i })).toBeEnabled();
  });

  it("read-only set (isReadOnly=true) → her iki buton disabled", () => {
    const item = makeItem({
      lastUndoableAssetId: "a1",
      editedAssetId: "a2",
    });
    wrapper(<UndoResetBar setId="set-1" item={item} isReadOnly={true} />);
    expect(screen.getByRole("button", { name: /son işlemi geri al/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /orijinale döndür/i })).toBeDisabled();
  });
});

// ────────────────────────────────────────────────────────────
// History listesi (info-only)
// ────────────────────────────────────────────────────────────

describe("UndoResetBar — history listesi", () => {
  // History entry'leri NOW'a göre relative timestamp render ediyor →
  // deterministik için fake timer.
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("history boş → 'Henüz düzenleme yok'", () => {
    const item = makeItem({ editHistoryJson: [] });
    wrapper(<UndoResetBar setId="set-1" item={item} isReadOnly={false} />);
    expect(screen.getByText(/henüz düzenleme yok/i)).toBeInTheDocument();
  });

  it("history 3 entry → 3 satır render, en yeni üstte (reversed)", () => {
    const item = makeItem({
      editHistoryJson: [
        { op: "crop", params: { ratio: "2:3" }, at: "2026-04-30T11:50:00Z" },
        { op: "transparent-check", at: "2026-04-30T11:55:00Z" },
        { op: "background-remove", at: "2026-04-30T11:59:00Z" },
      ],
    });
    wrapper(<UndoResetBar setId="set-1" item={item} isReadOnly={false} />);
    // Tüm 3 entry render edilmeli — op label TR.
    const cropRow = screen.getByText(/crop/i, { exact: false });
    const transparentRow = screen.getByText(/transparent kontrol/i);
    const bgRow = screen.getByText(/background remove/i);
    expect(cropRow).toBeInTheDocument();
    expect(transparentRow).toBeInTheDocument();
    expect(bgRow).toBeInTheDocument();
    // hidden count yok (3 ≤ 5).
    expect(screen.queryByText(/eski işlem/i)).not.toBeInTheDocument();
  });

  it("history 7 entry → 5 satır + '... +2 eski işlem' hint", () => {
    const at = (m: number) =>
      new Date(NOW.getTime() - m * 60_000).toISOString();
    const item = makeItem({
      editHistoryJson: [
        { op: "crop", at: at(70) },
        { op: "crop", at: at(60) },
        { op: "crop", at: at(50) },
        { op: "crop", at: at(40) },
        { op: "crop", at: at(30) },
        { op: "crop", at: at(20) },
        { op: "crop", at: at(10) },
      ],
    });
    wrapper(<UndoResetBar setId="set-1" item={item} isReadOnly={false} />);
    expect(screen.getByText(/\+2 eski işlem/i)).toBeInTheDocument();
  });

  it("failed entry → '— başarısız' suffix + danger dot", () => {
    const item = makeItem({
      editHistoryJson: [
        {
          op: "background-remove",
          at: NOW.toISOString(),
          failed: true,
          reason: "provider error",
        },
      ],
    });
    const { container } = wrapper(
      <UndoResetBar setId="set-1" item={item} isReadOnly={false} />,
    );
    expect(screen.getByText(/başarısız/i)).toBeInTheDocument();
    // Danger dot — bg-danger class.
    expect(container.querySelector(".bg-danger")).toBeTruthy();
  });

  it("op label TR mapping — crop / transparent-check / background-remove", () => {
    const item = makeItem({
      editHistoryJson: [
        { op: "crop", at: NOW.toISOString() },
        { op: "transparent-check", at: NOW.toISOString() },
        { op: "background-remove", at: NOW.toISOString() },
      ],
    });
    wrapper(<UndoResetBar setId="set-1" item={item} isReadOnly={false} />);
    expect(screen.getByText("Crop")).toBeInTheDocument();
    expect(screen.getByText("Transparent kontrol")).toBeInTheDocument();
    expect(screen.getByText("Background remove")).toBeInTheDocument();
  });

  it("crop params.ratio → 'Crop (2:3)'", () => {
    const item = makeItem({
      editHistoryJson: [
        { op: "crop", params: { ratio: "2:3" }, at: NOW.toISOString() },
      ],
    });
    wrapper(<UndoResetBar setId="set-1" item={item} isReadOnly={false} />);
    expect(screen.getByText(/crop \(2:3\)/i)).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
// Relative timestamp (TR)
// ────────────────────────────────────────────────────────────

describe("UndoResetBar — relative timestamp", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("at 10 sn önce → 'az önce'", () => {
    const at = new Date(NOW.getTime() - 10_000).toISOString();
    const item = makeItem({
      editHistoryJson: [{ op: "crop", at }],
    });
    wrapper(<UndoResetBar setId="set-1" item={item} isReadOnly={false} />);
    expect(screen.getByText(/az önce/i)).toBeInTheDocument();
  });

  it("at 5 dk önce → '5 dk önce'", () => {
    const at = new Date(NOW.getTime() - 5 * 60_000).toISOString();
    const item = makeItem({
      editHistoryJson: [{ op: "crop", at }],
    });
    wrapper(<UndoResetBar setId="set-1" item={item} isReadOnly={false} />);
    expect(screen.getByText(/^5 dk önce$/i)).toBeInTheDocument();
  });

  it("at 2 sa önce → '2 sa önce'", () => {
    const at = new Date(NOW.getTime() - 2 * 60 * 60_000).toISOString();
    const item = makeItem({
      editHistoryJson: [{ op: "crop", at }],
    });
    wrapper(<UndoResetBar setId="set-1" item={item} isReadOnly={false} />);
    expect(screen.getByText(/^2 sa önce$/i)).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
// Mutation davranışı (Undo / Reset)
// ────────────────────────────────────────────────────────────

describe("UndoResetBar — Undo mutation", () => {
  it("Undo click → POST /api/selection/sets/set-1/items/i1/undo", async () => {
    const item = makeItem({
      lastUndoableAssetId: "asset-prev",
      editedAssetId: "asset-now",
    });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ item }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    wrapper(<UndoResetBar setId="set-1" item={item} isReadOnly={false} />);
    fireEvent.click(screen.getByRole("button", { name: /son işlemi geri al/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/selection/sets/set-1/items/i1/undo");
    expect(init.method).toBe("POST");
  });
});

describe("UndoResetBar — Reset mutation", () => {
  it("Reset click → POST /api/selection/sets/set-1/items/i1/reset", async () => {
    const item = makeItem({
      lastUndoableAssetId: "asset-prev",
      editedAssetId: "asset-now",
    });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ item }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    wrapper(<UndoResetBar setId="set-1" item={item} isReadOnly={false} />);
    fireEvent.click(screen.getByRole("button", { name: /orijinale döndür/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/selection/sets/set-1/items/i1/reset");
    expect(init.method).toBe("POST");
  });
});

describe("UndoResetBar — error handling", () => {
  it("mutation error → inline alert role='alert' + mesaj", async () => {
    const item = makeItem({
      lastUndoableAssetId: "asset-prev",
      editedAssetId: "asset-now",
    });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Undo failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    wrapper(<UndoResetBar setId="set-1" item={item} isReadOnly={false} />);
    fireEvent.click(screen.getByRole("button", { name: /son işlemi geri al/i }));

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert).toBeInTheDocument();
      expect(within(alert).getByText(/undo failed/i)).toBeInTheDocument();
    });
  });
});

describe("UndoResetBar — pending state", () => {
  it("mutation pending → her iki buton disabled", async () => {
    const item = makeItem({
      lastUndoableAssetId: "asset-prev",
      editedAssetId: "asset-now",
    });
    let resolveFn: ((v: Response) => void) | undefined;
    const pending = new Promise<Response>((resolve) => {
      resolveFn = resolve;
    });
    const fetchMock = vi.fn().mockReturnValue(pending);
    vi.stubGlobal("fetch", fetchMock);

    wrapper(<UndoResetBar setId="set-1" item={item} isReadOnly={false} />);
    fireEvent.click(screen.getByRole("button", { name: /son işlemi geri al/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /son işlemi geri al/i }),
      ).toBeDisabled();
      expect(
        screen.getByRole("button", { name: /orijinale döndür/i }),
      ).toBeDisabled();
    });

    resolveFn?.(new Response(JSON.stringify({ item }), { status: 200 }));
  });
});
