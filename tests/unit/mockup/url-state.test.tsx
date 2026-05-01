// Phase 8 Task 14 — useMockupPackState integration testleri.
//
// Spec §6.1: URL primary state. URL'den selectedTemplateIds parse;
// selectQuickPackDefault (Task 13) default türetme; dirty türev hesabı.
//
// Test pattern: Phase 6 useSearchParams mock emsali
// (tests/unit/review-detail-panel.test.tsx). jsdom environment + UI setup
// (vitest.config.ui.ts) — `tests/unit/**/*.test.tsx` path'i bu config'i
// kullanır. Plan §Task 14 dispatch'i `__tests__/integration/...` ya da
// `tests/integration/mockup/url-state.test.ts` öneriyor; ana
// `vitest.config.ts` integration path'i `node` environment'i kullandığı için
// `renderHook` çalışmıyor → bu test codebase'in mevcut UI test paterninde
// yer alıyor (Phase 6/7 emsali).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// ────────────────────────────────────────────────────────────
// Mock state — testler arası reset
// ────────────────────────────────────────────────────────────

let mockSearchParams = new URLSearchParams("");
const mockReplace = vi.fn();
type MockSet = { variants: { aspectRatio: string }[] } | null;
type MockTemplate = {
  id: string;
  name: string;
  aspectRatios: string[];
  tags: string[];
  thumbKey: string;
  estimatedRenderMs: number;
  hasActiveBinding: boolean;
};
let mockSet: MockSet = null;
let mockTemplates: MockTemplate[] = [];

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => "/selection/sets/test-set/mockup/apply",
  useSearchParams: () => mockSearchParams,
}));

vi.mock("@/features/selection/queries", () => ({
  useSelectionSet: (setId: string) => ({ data: setId ? mockSet : null }),
}));

vi.mock("@/features/mockups/hooks/useMockupTemplates", () => ({
  useMockupTemplates: () => ({ data: mockTemplates }),
}));

import { useMockupPackState } from "@/features/mockups/hooks/useMockupPackState";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  mockSearchParams = new URLSearchParams("");
  mockReplace.mockReset();
  mockSet = null;
  mockTemplates = [];
});

// ────────────────────────────────────────────────────────────
// Fixture helpers
// ────────────────────────────────────────────────────────────

function setupSet(variants: { aspectRatio: string }[]): void {
  mockSet = { variants };
}

function setupTemplates(
  tpls: { id: string; aspectRatios: string[]; tags: string[] }[],
): void {
  mockTemplates = tpls.map((t) => ({
    ...t,
    name: t.id,
    thumbKey: "x.png",
    estimatedRenderMs: 2000,
    hasActiveBinding: true,
  }));
}

// ────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────

describe("useMockupPackState (Spec §6.1)", () => {
  it("returns default templateIds when no t= param", async () => {
    setupSet([{ aspectRatio: "2:3" }]);
    setupTemplates([
      { id: "tpl-modern", aspectRatios: ["2:3"], tags: ["modern"] },
      { id: "tpl-boho", aspectRatios: ["2:3"], tags: ["boho"] },
    ]);
    const { result } = renderHook(() => useMockupPackState("test-set"), {
      wrapper,
    });
    await waitFor(() => {
      expect(result.current.defaultTemplateIds.length).toBeGreaterThan(0);
    });
    expect(result.current.selectedTemplateIds).toEqual(
      result.current.defaultTemplateIds,
    );
    expect(result.current.isDirty).toBe(false);
    expect(result.current.isCustom).toBe(false);
  });

  it("returns parsed templateIds from URL t= param", async () => {
    mockSearchParams = new URLSearchParams("t=tpl-a,tpl-b");
    setupSet([{ aspectRatio: "2:3" }]);
    setupTemplates([
      { id: "tpl-a", aspectRatios: ["2:3"], tags: ["modern"] },
      { id: "tpl-b", aspectRatios: ["2:3"], tags: ["boho"] },
    ]);
    const { result } = renderHook(() => useMockupPackState("test-set"), {
      wrapper,
    });
    await waitFor(() => {
      expect(result.current.selectedTemplateIds).toEqual(["tpl-a", "tpl-b"]);
    });
    expect(result.current.isCustom).toBe(true);
  });

  it("isDirty=false when URL t= matches default", async () => {
    setupSet([{ aspectRatio: "2:3" }]);
    setupTemplates([
      { id: "tpl-a", aspectRatios: ["2:3"], tags: ["modern"] },
    ]);
    // Önce default'u hesaplat
    const { result: r1 } = renderHook(() => useMockupPackState("test-set"), {
      wrapper,
    });
    await waitFor(() =>
      expect(r1.current.defaultTemplateIds.length).toBeGreaterThan(0),
    );
    const defaultIds = r1.current.defaultTemplateIds.join(",");

    // Aynı id'leri URL'e koy ve yeniden render
    mockSearchParams = new URLSearchParams(`t=${defaultIds}`);
    const { result: r2 } = renderHook(() => useMockupPackState("test-set"), {
      wrapper,
    });
    await waitFor(() =>
      expect(r2.current.selectedTemplateIds.length).toBeGreaterThan(0),
    );
    expect(r2.current.isDirty).toBe(false);
    // Ama isCustom hâlâ true (URL'de t= var) — Spec §2.7
    expect(r2.current.isCustom).toBe(true);
  });

  it("isDirty=true when URL diverges from default", async () => {
    mockSearchParams = new URLSearchParams("t=tpl-x");
    setupSet([{ aspectRatio: "2:3" }]);
    setupTemplates([
      { id: "tpl-x", aspectRatios: ["2:3"], tags: ["modern"] },
      { id: "tpl-y", aspectRatios: ["2:3"], tags: ["boho"] },
    ]);
    const { result } = renderHook(() => useMockupPackState("test-set"), {
      wrapper,
    });
    await waitFor(() =>
      expect(result.current.selectedTemplateIds.length).toBeGreaterThan(0),
    );
    // default = [tpl-x, tpl-y] (her vibe 1); URL t=tpl-x → dirty
    expect(result.current.isDirty).toBe(true);
  });

  it("toggleTemplate updates URL (debounced 150ms)", async () => {
    setupSet([{ aspectRatio: "2:3" }]);
    setupTemplates([
      { id: "tpl-a", aspectRatios: ["2:3"], tags: ["modern"] },
      { id: "tpl-b", aspectRatios: ["2:3"], tags: ["boho"] },
    ]);
    const { result } = renderHook(() => useMockupPackState("test-set"), {
      wrapper,
    });
    await waitFor(() =>
      expect(result.current.defaultTemplateIds.length).toBeGreaterThan(0),
    );

    act(() => {
      // Default'taki tpl-a'yı remove → URL custom shape üretilir
      result.current.toggleTemplate("tpl-a");
    });
    await waitFor(
      () => {
        expect(mockReplace).toHaveBeenCalled();
      },
      { timeout: 500 },
    );
  });

  it("toggle to default state clears t= param", async () => {
    // Custom durum: URL'de tpl-b yok (default'tan çıkarılmış); toggle ile
    // tpl-b geri eklenir → default'a eşitlenir → updateUrl({ t: undefined })
    setupSet([{ aspectRatio: "2:3" }]);
    setupTemplates([
      { id: "tpl-a", aspectRatios: ["2:3"], tags: ["modern"] },
      { id: "tpl-b", aspectRatios: ["2:3"], tags: ["boho"] },
    ]);
    // Default'tan çıkarılmış custom state: yalnız tpl-a
    mockSearchParams = new URLSearchParams("t=tpl-a");

    const { result } = renderHook(() => useMockupPackState("test-set"), {
      wrapper,
    });
    await waitFor(() =>
      expect(result.current.defaultTemplateIds).toEqual(["tpl-a", "tpl-b"]),
    );
    expect(result.current.isDirty).toBe(true);

    act(() => {
      // tpl-b ekle → default'a eşitlenir
      result.current.toggleTemplate("tpl-b");
    });

    await waitFor(
      () => {
        expect(mockReplace).toHaveBeenCalled();
      },
      { timeout: 500 },
    );
    const lastCall = mockReplace.mock.calls.at(-1);
    // updateUrl({ t: undefined }) → URL'de t= olmamalı
    expect(lastCall?.[0]).not.toContain("t=tpl");
  });

  it("filters invalid templateIds from URL silently", async () => {
    mockSearchParams = new URLSearchParams("t=tpl-a,tpl-invalid,tpl-b");
    setupSet([{ aspectRatio: "2:3" }]);
    setupTemplates([
      { id: "tpl-a", aspectRatios: ["2:3"], tags: ["modern"] },
      { id: "tpl-b", aspectRatios: ["2:3"], tags: ["boho"] },
    ]);
    const { result } = renderHook(() => useMockupPackState("test-set"), {
      wrapper,
    });
    await waitFor(() =>
      expect(result.current.selectedTemplateIds.length).toBeGreaterThan(0),
    );
    expect(result.current.selectedTemplateIds).toEqual(["tpl-a", "tpl-b"]);
    expect(result.current.selectedTemplateIds).not.toContain("tpl-invalid");
  });

  it("caps URL templateIds at 8 (sanity)", async () => {
    const ids = Array.from({ length: 12 }, (_, i) => `tpl-${i}`);
    mockSearchParams = new URLSearchParams(`t=${ids.join(",")}`);
    setupSet([{ aspectRatio: "2:3" }]);
    setupTemplates(
      ids.map((id) => ({ id, aspectRatios: ["2:3"], tags: ["modern"] })),
    );
    const { result } = renderHook(() => useMockupPackState("test-set"), {
      wrapper,
    });
    await waitFor(() =>
      expect(result.current.selectedTemplateIds.length).toBeGreaterThan(0),
    );
    expect(result.current.selectedTemplateIds.length).toBeLessThanOrEqual(8);
  });

  it("resetToQuickPack clears t= param", async () => {
    mockSearchParams = new URLSearchParams("t=tpl-a,tpl-b");
    setupSet([{ aspectRatio: "2:3" }]);
    setupTemplates([
      { id: "tpl-a", aspectRatios: ["2:3"], tags: ["modern"] },
      { id: "tpl-b", aspectRatios: ["2:3"], tags: ["boho"] },
    ]);
    const { result } = renderHook(() => useMockupPackState("test-set"), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isCustom).toBe(true));

    act(() => {
      result.current.resetToQuickPack();
    });
    expect(mockReplace).toHaveBeenCalled();
    const lastCall = mockReplace.mock.calls.at(-1);
    expect(lastCall?.[0]).not.toContain("t=");
  });

  it("router.replace called with scroll: false (Spec §6.2)", async () => {
    mockSearchParams = new URLSearchParams("t=tpl-a");
    setupSet([{ aspectRatio: "2:3" }]);
    setupTemplates([
      { id: "tpl-a", aspectRatios: ["2:3"], tags: ["modern"] },
    ]);
    const { result } = renderHook(() => useMockupPackState("test-set"), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isCustom).toBe(true));

    act(() => {
      result.current.resetToQuickPack();
    });
    const lastCall = mockReplace.mock.calls.at(-1);
    expect(lastCall?.[1]).toEqual({ scroll: false });
  });
});
