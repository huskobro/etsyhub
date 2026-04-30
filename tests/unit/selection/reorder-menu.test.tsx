// Phase 7 Task 31 — ReorderMenu testleri.
//
// Sözleşme (plan Task 31 + spec Section 2.4 + 3.2):
//   - VERILMIŞ KARAR: Drag-and-drop YOK. Reorder = menu/button tabanlı.
//   - Trigger: kebap (MoreVertical) icon button, aria-haspopup="menu",
//     aria-expanded başlangıç false.
//   - Menü açılınca 4 menüitem render: Sola taşı / Sağa taşı / Başa al /
//     Sona al — role="menu", her child role="menuitem".
//   - Disabled states:
//       İlk item (idx=0)  → "Sola taşı" + "Başa al" disabled.
//       Son item (idx=N-1)→ "Sağa taşı" + "Sona al" disabled.
//       Tek item set     → 4'ü de disabled.
//   - Mutation: POST /api/selection/sets/[setId]/items/reorder, body
//     { itemIds: string[] } (full set order).
//   - Outside click → menu kapanır.
//   - Escape key → menu kapanır + focus trigger'a döner.
//   - Live region: role="status" aria-live="polite" — hareket sonrası
//     "Varyant X bir öne taşındı..." vb. announce.
//   - Read-only set → ReorderMenu null render.
//   - Trigger click bubble engellenir (parent item click tetiklenmez).
//
// Phase 6 emsali: tests/unit/selection/quick-actions.test.tsx —
// fetch stubGlobal + QueryClientProvider wrapper + role="menu"/menuitem.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import type { SelectionItemView } from "@/features/selection/queries";

import { ReorderMenu } from "@/features/selection/components/ReorderMenu";

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

const sampleItems = (): SelectionItemView[] => [
  makeItem({ id: "i1", position: 0 }),
  makeItem({ id: "i2", position: 1 }),
  makeItem({ id: "i3", position: 2 }),
  makeItem({ id: "i4", position: 3 }),
];

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("ReorderMenu — read-only", () => {
  it("isReadOnly true → null render (UI yok)", () => {
    const { container } = wrapper(
      <ReorderMenu
        setId="set-1"
        items={sampleItems()}
        itemId="i2"
        isReadOnly
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});

describe("ReorderMenu — trigger button", () => {
  it("kebap trigger button render — aria-haspopup=menu, aria-expanded=false", () => {
    wrapper(
      <ReorderMenu
        setId="set-1"
        items={sampleItems()}
        itemId="i2"
        isReadOnly={false}
      />,
    );
    const trigger = screen.getByRole("button", { name: /sıralama menüsü/i });
    expect(trigger).toBeInTheDocument();
    expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("trigger click → menu açılır, aria-expanded=true, 4 menuitem render", () => {
    wrapper(
      <ReorderMenu
        setId="set-1"
        items={sampleItems()}
        itemId="i2"
        isReadOnly={false}
      />,
    );
    const trigger = screen.getByRole("button", { name: /sıralama menüsü/i });
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const menu = screen.getByRole("menu");
    expect(menu).toBeInTheDocument();
    const items = screen.getAllByRole("menuitem");
    expect(items).toHaveLength(4);
    // Sıra: Sola, Sağa, Başa, Sona
    expect(items[0]!).toHaveTextContent(/sola taşı/i);
    expect(items[1]!).toHaveTextContent(/sağa taşı/i);
    expect(items[2]!).toHaveTextContent(/başa al/i);
    expect(items[3]!).toHaveTextContent(/sona al/i);
  });

  it("trigger click bubble engellenir (stopPropagation)", () => {
    const parentClick = vi.fn();
    wrapper(
      <div onClick={parentClick}>
        <ReorderMenu
          setId="set-1"
          items={sampleItems()}
          itemId="i2"
          isReadOnly={false}
        />
      </div>,
    );
    const trigger = screen.getByRole("button", { name: /sıralama menüsü/i });
    fireEvent.click(trigger);
    expect(parentClick).not.toHaveBeenCalled();
  });
});

describe("ReorderMenu — disabled states", () => {
  it("ilk item: Sola taşı + Başa al disabled, Sağa taşı + Sona al enabled", () => {
    wrapper(
      <ReorderMenu
        setId="set-1"
        items={sampleItems()}
        itemId="i1"
        isReadOnly={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /sıralama menüsü/i }));
    const items = screen.getAllByRole("menuitem");
    // [0] Sola, [1] Sağa, [2] Başa, [3] Sona
    expect((items[0] as HTMLButtonElement).disabled).toBe(true); // Sola
    expect((items[1] as HTMLButtonElement).disabled).toBe(false); // Sağa
    expect((items[2] as HTMLButtonElement).disabled).toBe(true); // Başa
    expect((items[3] as HTMLButtonElement).disabled).toBe(false); // Sona
  });

  it("son item: Sağa taşı + Sona al disabled, Sola taşı + Başa al enabled", () => {
    wrapper(
      <ReorderMenu
        setId="set-1"
        items={sampleItems()}
        itemId="i4"
        isReadOnly={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /sıralama menüsü/i }));
    const items = screen.getAllByRole("menuitem");
    expect((items[0] as HTMLButtonElement).disabled).toBe(false); // Sola
    expect((items[1] as HTMLButtonElement).disabled).toBe(true); // Sağa
    expect((items[2] as HTMLButtonElement).disabled).toBe(false); // Başa
    expect((items[3] as HTMLButtonElement).disabled).toBe(true); // Sona
  });

  it("orta item: hepsi enabled", () => {
    wrapper(
      <ReorderMenu
        setId="set-1"
        items={sampleItems()}
        itemId="i2"
        isReadOnly={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /sıralama menüsü/i }));
    const items = screen.getAllByRole("menuitem");
    for (const it of items) {
      expect((it as HTMLButtonElement).disabled).toBe(false);
    }
  });

  it("tek item set: hepsi disabled (first AND last)", () => {
    const single = [makeItem({ id: "only", position: 0 })];
    wrapper(
      <ReorderMenu
        setId="set-1"
        items={single}
        itemId="only"
        isReadOnly={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /sıralama menüsü/i }));
    const items = screen.getAllByRole("menuitem");
    for (const it of items) {
      expect((it as HTMLButtonElement).disabled).toBe(true);
    }
  });
});

describe("ReorderMenu — mutation", () => {
  function mockFetchOk(payload: unknown = { items: [] }) {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => payload,
    } as unknown as Response);
  }

  it("'Sola taşı' → fetch reorder POST: itemIds idx-1 ile yeni dizi", async () => {
    mockFetchOk();
    wrapper(
      <ReorderMenu
        setId="set-1"
        items={sampleItems()}
        itemId="i3" // idx=2
        isReadOnly={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /sıralama menüsü/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /sola taşı/i }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(url).toBe("/api/selection/sets/set-1/items/reorder");
    expect((init as RequestInit).method).toBe("POST");
    const body = JSON.parse((init as RequestInit).body as string);
    // i3'ü i2 ile yer değiştir → [i1, i3, i2, i4]
    expect(body.itemIds).toEqual(["i1", "i3", "i2", "i4"]);
  });

  it("'Sağa taşı' → idx+1 yer değişimi", async () => {
    mockFetchOk();
    wrapper(
      <ReorderMenu
        setId="set-1"
        items={sampleItems()}
        itemId="i2" // idx=1
        isReadOnly={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /sıralama menüsü/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /sağa taşı/i }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    const init = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]![1] as RequestInit;
    const body = JSON.parse(init.body as string);
    // i2'yi i3 ile yer değiştir → [i1, i3, i2, i4]
    expect(body.itemIds).toEqual(["i1", "i3", "i2", "i4"]);
  });

  it("'Başa al' → item baş'a", async () => {
    mockFetchOk();
    wrapper(
      <ReorderMenu
        setId="set-1"
        items={sampleItems()}
        itemId="i3"
        isReadOnly={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /sıralama menüsü/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /başa al/i }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    const init = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]![1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body.itemIds).toEqual(["i3", "i1", "i2", "i4"]);
  });

  it("'Sona al' → item sona", async () => {
    mockFetchOk();
    wrapper(
      <ReorderMenu
        setId="set-1"
        items={sampleItems()}
        itemId="i2"
        isReadOnly={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /sıralama menüsü/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /sona al/i }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    const init = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]![1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body.itemIds).toEqual(["i1", "i3", "i4", "i2"]);
  });

  it("aksiyon click → menu kapanır (aria-expanded=false)", async () => {
    mockFetchOk();
    wrapper(
      <ReorderMenu
        setId="set-1"
        items={sampleItems()}
        itemId="i2"
        isReadOnly={false}
      />,
    );
    const trigger = screen.getByRole("button", { name: /sıralama menüsü/i });
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(screen.getByRole("menuitem", { name: /sağa taşı/i }));
    await waitFor(() =>
      expect(trigger.getAttribute("aria-expanded")).toBe("false"),
    );
  });
});

describe("ReorderMenu — close behavior", () => {
  it("outside click → menu kapanır", () => {
    wrapper(
      <div data-testid="outside">
        <ReorderMenu
          setId="set-1"
          items={sampleItems()}
          itemId="i2"
          isReadOnly={false}
        />
      </div>,
    );
    const trigger = screen.getByRole("button", { name: /sıralama menüsü/i });
    fireEvent.click(trigger);
    expect(screen.getByRole("menu")).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("Escape key → menu kapanır + focus trigger'a döner", () => {
    wrapper(
      <ReorderMenu
        setId="set-1"
        items={sampleItems()}
        itemId="i2"
        isReadOnly={false}
      />,
    );
    const trigger = screen.getByRole("button", { name: /sıralama menüsü/i });
    fireEvent.click(trigger);
    expect(screen.getByRole("menu")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });
});

describe("ReorderMenu — screen reader announce", () => {
  it("hareket sonrası live region (role=status) mesaj içerir", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ items: [] }),
    } as unknown as Response);

    wrapper(
      <ReorderMenu
        setId="set-1"
        items={sampleItems()}
        itemId="i2"
        isReadOnly={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /sıralama menüsü/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /başa al/i }));

    await waitFor(() => {
      const liveRegion = document.querySelector('[role="status"][aria-live="polite"]');
      expect(liveRegion).not.toBeNull();
      // i2 idx=1 → "Varyant 02 başa taşındı. Yeni sıra: 1."
      expect(liveRegion!.textContent).toMatch(/Varyant 02/i);
      expect(liveRegion!.textContent).toMatch(/başa/i);
    });
  });
});
