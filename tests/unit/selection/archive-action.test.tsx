// Phase 7 Task 37 — ArchiveAction (set kebap menü minimal) testleri.
//
// Sözleşme (plan Task 37 + spec Section 1.2 + 4.3):
//   - Trigger: kebap (MoreVertical) icon button, aria-haspopup="menu",
//     aria-expanded başlangıç false, aria-label="Set options".
//   - Menü açılınca tek menuitem: "Archive set" (role="menuitem").
//   - Outside click → menu kapanır.
//   - Escape key → menu kapanır + focus trigger'a döner.
//   - Click "Archive set" → menu kapanır + ConfirmDialog açılır.
//   - ConfirmDialog confirm → POST /api/selection/sets/:setId/archive →
//     query invalidate (set detail key) + router.push("/selection").
//   - ConfirmDialog cancel → mutation tetiklenmez, modal kapanır.
//   - Mutation pending → ConfirmDialog busy=true (cancel disabled, confirm
//     "Çalışıyor…").
//   - Mutation error (örn. 409 already archived) → errorMessage modal
//     içinde görünür (role="alert").
//   - Archived set → ArchiveAction null render (kebap menü hiç görünmez).
//
// Phase 6 emsali: BulkApproveDialog (ConfirmDialog reuse) +
// reorder-menu.test.tsx (state-driven inline menu paterni).

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";

// next/navigation router mock — App Router useRouter().push() doğrulanacak.
const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
  usePathname: () => "/selection/sets/set-1",
  useSearchParams: () => new URLSearchParams(""),
}));

import { ArchiveAction } from "@/features/selection/components/ArchiveAction";

function wrapper(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    queryClient: client,
    ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>),
  };
}

beforeEach(() => {
  pushMock.mockReset();
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ────────────────────────────────────────────────────────────
// Archived set → null render
// ────────────────────────────────────────────────────────────

describe("ArchiveAction — archived set", () => {
  it("status='archived' → null render (kebap menüsü hiç görünmez)", () => {
    const { container } = wrapper(
      <ArchiveAction setId="set-1" setStatus="archived" />,
    );
    expect(container.firstChild).toBeNull();
    expect(screen.queryByRole("button", { name: /set options/i }))
      .not.toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
// Trigger button + menu açılma
// ────────────────────────────────────────────────────────────

describe("ArchiveAction — trigger button", () => {
  it("draft set → kebap trigger render: aria-haspopup=menu, aria-expanded=false", () => {
    wrapper(<ArchiveAction setId="set-1" setStatus="draft" />);
    const trigger = screen.getByRole("button", { name: /set options/i });
    expect(trigger).toBeInTheDocument();
    expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    // Default'ta menu yok
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("ready set → kebap trigger render (archived öncesi de erişim var)", () => {
    wrapper(<ArchiveAction setId="set-1" setStatus="ready" />);
    expect(
      screen.getByRole("button", { name: /set options/i }),
    ).toBeInTheDocument();
  });

  it("trigger click → menu açılır + 'Set'i arşivle' menuitem render", () => {
    wrapper(<ArchiveAction setId="set-1" setStatus="draft" />);
    const trigger = screen.getByRole("button", { name: /set options/i });
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("menu")).toBeInTheDocument();
    const items = screen.getAllByRole("menuitem");
    expect(items).toHaveLength(1);
    expect(items[0]!).toHaveTextContent(/archive set/i);
  });
});

// ────────────────────────────────────────────────────────────
// Menu close behavior
// ────────────────────────────────────────────────────────────

describe("ArchiveAction — menu close", () => {
  it("outside click → menu kapanır", () => {
    wrapper(
      <div>
        <span data-testid="outside">outside</span>
        <ArchiveAction setId="set-1" setStatus="draft" />
      </div>,
    );
    const trigger = screen.getByRole("button", { name: /set options/i });
    fireEvent.click(trigger);
    expect(screen.getByRole("menu")).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("Escape key → menu kapanır + focus trigger'a döner", () => {
    wrapper(<ArchiveAction setId="set-1" setStatus="draft" />);
    const trigger = screen.getByRole("button", { name: /set options/i });
    fireEvent.click(trigger);
    expect(screen.getByRole("menu")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });
});

// ────────────────────────────────────────────────────────────
// Click menuitem → ConfirmDialog open
// ────────────────────────────────────────────────────────────

describe("ArchiveAction — confirm dialog open", () => {
  it("'Set'i arşivle' click → menu kapanır + ConfirmDialog açılır", () => {
    wrapper(<ArchiveAction setId="set-1" setStatus="draft" />);
    fireEvent.click(screen.getByRole("button", { name: /set options/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /archive set/i }));

    // Menu kapandı
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    // ConfirmDialog açıldı — başlığı + iki buton
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/archive set/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^archive$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Cancel$/ })).toBeInTheDocument();
  });

  it("ConfirmDialog cancel → modal kapanır + fetch tetiklenmez", () => {
    wrapper(<ArchiveAction setId="set-1" setStatus="draft" />);
    fireEvent.click(screen.getByRole("button", { name: /set options/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /archive set/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Cancel$/ }));
    // Modal kapandı
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // Mutation tetiklenmedi
    expect(global.fetch).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });
});

// ────────────────────────────────────────────────────────────
// Mutation success
// ────────────────────────────────────────────────────────────

describe("ArchiveAction — mutation success", () => {
  it("Confirm → POST /archive + invalidate + redirect /selection", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ set: { id: "set-1", status: "archived" } }),
    } as unknown as Response);

    wrapper(<ArchiveAction setId="set-1" setStatus="draft" />);
    fireEvent.click(screen.getByRole("button", { name: /set options/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /archive set/i }));
    fireEvent.click(screen.getByRole("button", { name: /^archive$/i }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(url).toBe("/api/selection/sets/set-1/archive");
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit).headers).toMatchObject({
      "Content-Type": "application/json",
    });
    // Body boş JSON ({}) — ArchiveInputSchema .strict()
    expect((init as RequestInit).body).toBe(JSON.stringify({}));

    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith("/selections"),
    );
  });
});

// ────────────────────────────────────────────────────────────
// Mutation error
// ────────────────────────────────────────────────────────────

describe("ArchiveAction — mutation error", () => {
  it("409 InvalidStateTransitionError → errorMessage modal içinde görünür", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({
        error: "Set zaten arşivlenmiş",
        code: "INVALID_STATE_TRANSITION",
      }),
    } as unknown as Response);

    wrapper(<ArchiveAction setId="set-1" setStatus="ready" />);
    fireEvent.click(screen.getByRole("button", { name: /set options/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /archive set/i }));
    fireEvent.click(screen.getByRole("button", { name: /^archive$/i }));

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent(/zaten arşivlenmiş/i);
    });

    // Modal hâlâ açık
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    // Redirect tetiklenmedi
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("network/parse error → fallback HTTP X mesajı errorMessage'da görünür", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error("parse boom");
      },
    } as unknown as Response);

    wrapper(<ArchiveAction setId="set-1" setStatus="draft" />);
    fireEvent.click(screen.getByRole("button", { name: /set options/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /archive set/i }));
    fireEvent.click(screen.getByRole("button", { name: /^archive$/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/HTTP 500/i);
    });
  });
});
