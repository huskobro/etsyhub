// Phase 6 Dalga B polish (A2) — BulkActionsBar UI testleri.
//
// Kontratlar:
//   - selectedIds.size === 0 ⇒ render null (bar görünmez).
//   - scope=design ⇒ Onayla + Reddet butonları, Sil yok.
//   - scope=local  ⇒ Onayla + Reddet + Sil (3 buton).
//   - İptal butonu selection store'u clear eder.
//
// Dialog'lar (BulkApproveDialog, BulkRejectDialog, BulkDeleteDialog) bu
// testte mount oluyor ama open=false default — content yok. Trigger
// butonları açma/kapama logic'i ayrı dialog testlerinde (A3, A4).

import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useReviewSelection } from "@/features/review/stores/selection-store";
import { BulkActionsBar } from "@/app/(app)/review/_components/BulkActionsBar";

function renderBar(scope: "design" | "local") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <BulkActionsBar scope={scope} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  // Store'u temiz başlat (page+scope+selection).
  act(() => {
    useReviewSelection.setState({
      selectedIds: new Set<string>(),
      scope: "design",
      page: 1,
    });
  });
});

describe("BulkActionsBar", () => {
  it("selectedIds=0 ⇒ render null (bar görünmez)", () => {
    const { container } = renderBar("design");
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId("bulk-actions-bar")).toBeNull();
  });

  it("scope=design + 2 seçim ⇒ Approve + Reject butonları, Delete yok", () => {
    act(() => useReviewSelection.getState().selectAll(["a", "b"]));
    renderBar("design");
    expect(
      screen.getByRole("button", { name: /Approve/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Reject/i }),
    ).toBeInTheDocument();
    // Bulk delete trigger sadece local'de görünür.
    expect(screen.queryByRole("button", { name: /Delete/i })).toBeNull();
  });

  it("scope=local + 1 seçim ⇒ Delete butonu da görünür", () => {
    act(() => useReviewSelection.getState().selectAll(["a"]));
    renderBar("local");
    expect(
      screen.getByRole("button", { name: /Delete/i }),
    ).toBeInTheDocument();
  });

  it("Clear selection butonu selection store'u clear eder", () => {
    act(() => useReviewSelection.getState().selectAll(["a", "b"]));
    renderBar("design");
    expect(useReviewSelection.getState().selectedIds.size).toBe(2);
    fireEvent.click(screen.getByRole("button", { name: /Clear selection/i }));
    expect(useReviewSelection.getState().selectedIds.size).toBe(0);
  });

  it("aria-label — bulk actions toolbar (a11y)", () => {
    act(() => useReviewSelection.getState().selectAll(["x"]));
    renderBar("design");
    // FloatingBulkBar uses role="toolbar" with dynamic count label
    const toolbar = screen.getByRole("toolbar", { name: /bulk actions/i });
    expect(toolbar).toBeInTheDocument();
  });
});
