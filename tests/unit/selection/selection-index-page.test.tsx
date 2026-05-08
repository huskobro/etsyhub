// Phase 7 Task 23 — /selection index page TDD test sözleşmesi.
//
// Senaryolar (kilitli liste — plan Task 23):
//   1. Aktif draft varsa kart render: set adı + Draft badge + "Aç" buton
//   2. Aktif draft yoksa empty state + "Yeni set oluştur" buton görünür
//   3. Son ready listesi 3 mock data → 3 satır + her biri /selection/sets/[id] link
//   4. Ready listesi boş → muted "Henüz finalize edilen set yok" mesajı
//   5. Loading state → SkeletonCardGrid / role=status render
//   6. Error state → "Yüklenemedi" StateMessage; raw error UI'a sızmaz
//   7. Sidebar nav-config: /selection entry mevcut, label "Seçim", enabled=true,
//      phase=7
//
// Phase 6 query test paterni: `useSelectionSets` mock'lanır; her test mocked
// state setup ile useQuery'nin döndürdüğü shape'i taklit eder.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/selection",
  useSearchParams: () => new URLSearchParams(""),
}));

const mockUseSelectionSets = vi.fn();
vi.mock("@/features/selection/queries", () => ({
  useSelectionSets: (status?: "draft" | "ready" | "archived") =>
    mockUseSelectionSets(status),
}));

import { SelectionIndexPage } from "@/features/selection/components/SelectionIndexPage";
import { NAV_ITEMS } from "@/features/app-shell/nav-config";

function wrapper(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

/**
 * Helper: useSelectionSets çağrısı status filter ile çağrıldığı için iki
 * ayrı mock yanıt return etmeli. status === "draft" → first arg, status ===
 * "ready" → second.
 */
function setupQueries(opts: {
  draft?: { data?: unknown; isLoading?: boolean; error?: unknown };
  ready?: { data?: unknown; isLoading?: boolean; error?: unknown };
}) {
  mockUseSelectionSets.mockImplementation((status?: string) => {
    if (status === "draft") {
      return {
        data: opts.draft?.data,
        isLoading: opts.draft?.isLoading ?? false,
        error: opts.draft?.error ?? null,
      };
    }
    if (status === "ready") {
      return {
        data: opts.ready?.data,
        isLoading: opts.ready?.isLoading ?? false,
        error: opts.ready?.error ?? null,
      };
    }
    return { data: undefined, isLoading: false, error: null };
  });
}

beforeEach(() => mockUseSelectionSets.mockReset());

describe("SelectionIndexPage — aktif draft set", () => {
  it("aktif draft varsa kart render eder: ad + Draft badge + 'Aç' link", () => {
    setupQueries({
      draft: {
        data: [
          {
            id: "set-1",
            name: "Boho wall art",
            status: "draft",
            createdAt: new Date().toISOString(),
            finalizedAt: null,
            updatedAt: new Date().toISOString(),
          },
        ],
      },
      ready: { data: [] },
    });
    wrapper(<SelectionIndexPage />);
    expect(screen.getByText("Boho wall art")).toBeInTheDocument();
    // Badge text "Draft" tam eşleşme (section başlığı "Aktif draft" lower-case
    // "draft" içerir; çift match'i ayırmak için exact "Draft" arıyoruz).
    expect(screen.getByText("Draft")).toBeInTheDocument();
    const openLink = screen.getByRole("link", { name: /Aç/i });
    expect(openLink.getAttribute("href")).toBe("/selection/sets/set-1");
  });

  it("aktif draft yoksa empty state + 'Yeni set oluştur' butonu", () => {
    setupQueries({
      draft: { data: [] },
      ready: { data: [] },
    });
    wrapper(<SelectionIndexPage />);
    expect(screen.getByText(/aktif draft set/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /yeni set oluştur/i }),
    ).toBeInTheDocument();
  });

  it("draft loading → role=status skeleton render", () => {
    setupQueries({
      draft: { isLoading: true, data: undefined },
      ready: { data: [] },
    });
    wrapper(<SelectionIndexPage />);
    // Skeleton primitive role=status verir.
    const statuses = screen.getAllByRole("status");
    expect(statuses.length).toBeGreaterThan(0);
  });

  it("draft error → 'Yüklenemedi' mesajı; raw error metni UI'da görünmez", () => {
    setupQueries({
      draft: {
        data: undefined,
        error: new Error("internal db boom xyz"),
      },
      ready: { data: [] },
    });
    wrapper(<SelectionIndexPage />);
    expect(screen.getByText(/yüklenemedi/i)).toBeInTheDocument();
    expect(screen.queryByText(/internal db boom xyz/)).toBeNull();
  });
});

describe("SelectionIndexPage — son ready set'ler", () => {
  it("3 ready set → 3 satır link render", () => {
    setupQueries({
      draft: { data: [] },
      ready: {
        data: [
          {
            id: "r1",
            name: "Nursery print v1",
            status: "ready",
            createdAt: new Date().toISOString(),
            finalizedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: "r2",
            name: "Halloween stickers",
            status: "ready",
            createdAt: new Date().toISOString(),
            finalizedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: "r3",
            name: "Boho canvas pack",
            status: "ready",
            createdAt: new Date().toISOString(),
            finalizedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      },
    });
    wrapper(<SelectionIndexPage />);
    const rows = screen.getAllByTestId("selection-ready-row");
    expect(rows).toHaveLength(3);
    expect(rows[0]!.getAttribute("href")).toBe("/selection/sets/r1");
    expect(rows[1]!.getAttribute("href")).toBe("/selection/sets/r2");
    expect(rows[2]!.getAttribute("href")).toBe("/selection/sets/r3");
  });

  it("ready listesi boş → muted 'Henüz finalize edilen set yok'", () => {
    setupQueries({
      draft: { data: [] },
      ready: { data: [] },
    });
    wrapper(<SelectionIndexPage />);
    expect(
      screen.getByText(/henüz finalize edilen set yok/i),
    ).toBeInTheDocument();
  });

  it("ready listesi 5'ten fazla → ilk 5 ile sınırlanır", () => {
    setupQueries({
      draft: { data: [] },
      ready: {
        data: Array.from({ length: 8 }, (_, i) => ({
          id: `s${i}`,
          name: `Set ${i}`,
          status: "ready",
          createdAt: new Date().toISOString(),
          finalizedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })),
      },
    });
    wrapper(<SelectionIndexPage />);
    expect(screen.getAllByTestId("selection-ready-row")).toHaveLength(5);
  });
});

describe("Sidebar nav-config — Selections entry (Kivasy IA, rollout-1)", () => {
  // Rollout-1 IA: 8 items / 2 groups (Produce / System). Selections lives
  // in Produce group with rollout=4. The legacy `enabled` / `phase` shape
  // was replaced by `ready` / `rollout`. See docs/IMPLEMENTATION_HANDOFF.md
  // §4 + nav-config.ts.
  it("Selections nav item: label 'Selections', group 'produce', rollout=4", () => {
    const entry = NAV_ITEMS.find((n) => n.href === "/selections");
    expect(entry).toBeDefined();
    expect(entry!.label).toBe("Selections");
    expect(entry!.group).toBe("produce");
    expect(entry!.rollout).toBe(4);
  });

  it("Production chain order: Library → Selections → Products", () => {
    // Selections sits between Library and Products in the production chain.
    // Reference → Batch → Library → Selection → Product → Etsy Draft.
    const libraryIdx = NAV_ITEMS.findIndex((n) => n.href === "/library");
    const selectionsIdx = NAV_ITEMS.findIndex((n) => n.href === "/selections");
    const productsIdx = NAV_ITEMS.findIndex((n) => n.href === "/products");
    expect(selectionsIdx).toBeGreaterThan(libraryIdx);
    expect(selectionsIdx).toBeLessThan(productsIdx);
  });
});
