// Phase 6 Dalga B (Task 16) — useReviewSelection store testleri.
//
// Sözleşme:
//   - toggle ekler veya kaldırır
//   - clear tüm Set'i sıfırlar
//   - selectAll yeni Set ile override eder
//   - setScope farklı scope ⇒ auto-clear
//   - setPage farklı sayfa ⇒ auto-clear (Dalga B polish — pagination
//     boundary cache-miss hint'i edge case'i)
//   - setPage aynı sayfa ⇒ idempotent (selection korunur)

import { describe, it, expect, beforeEach } from "vitest";
import { useReviewSelection } from "@/features/review/stores/selection-store";

function reset() {
  useReviewSelection.setState({
    selectedIds: new Set<string>(),
    scope: "design",
    page: 1,
  });
}

describe("useReviewSelection", () => {
  beforeEach(() => reset());

  it("toggle ekler", () => {
    useReviewSelection.getState().toggle("a");
    expect(useReviewSelection.getState().selectedIds.has("a")).toBe(true);
  });

  it("toggle ikinci kez kaldırır", () => {
    useReviewSelection.getState().toggle("a");
    useReviewSelection.getState().toggle("a");
    expect(useReviewSelection.getState().selectedIds.has("a")).toBe(false);
  });

  it("clear tüm seçimi sıfırlar", () => {
    useReviewSelection.getState().toggle("a");
    useReviewSelection.getState().toggle("b");
    useReviewSelection.getState().clear();
    expect(useReviewSelection.getState().selectedIds.size).toBe(0);
  });

  it("selectAll yeni Set ile override", () => {
    useReviewSelection.getState().toggle("z");
    useReviewSelection.getState().selectAll(["a", "b", "c"]);
    expect(Array.from(useReviewSelection.getState().selectedIds).sort()).toEqual(
      ["a", "b", "c"],
    );
  });

  it("setScope aynı scope: seçim korunur", () => {
    useReviewSelection.getState().toggle("a");
    useReviewSelection.getState().setScope("design");
    expect(useReviewSelection.getState().selectedIds.has("a")).toBe(true);
  });

  it("setScope farklı scope: auto-clear", () => {
    useReviewSelection.getState().toggle("a");
    useReviewSelection.getState().toggle("b");
    useReviewSelection.getState().setScope("local");
    expect(useReviewSelection.getState().selectedIds.size).toBe(0);
    expect(useReviewSelection.getState().scope).toBe("local");
  });

  it("setPage farklı sayfaya geçince selection clear olur", () => {
    useReviewSelection.getState().selectAll(["a", "b", "c"]);
    useReviewSelection.getState().setPage(2);
    expect(useReviewSelection.getState().selectedIds.size).toBe(0);
    expect(useReviewSelection.getState().page).toBe(2);
  });

  it("setPage aynı sayfa idempotent: selection korunur", () => {
    useReviewSelection.getState().setPage(1);
    useReviewSelection.getState().selectAll(["a", "b"]);
    useReviewSelection.getState().setPage(1);
    expect(useReviewSelection.getState().selectedIds.size).toBe(2);
    expect(useReviewSelection.getState().page).toBe(1);
  });
});
