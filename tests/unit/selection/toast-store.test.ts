// Phase 7 Task 39 — Selection Studio toast store testleri.
//
// Sözleşme (plan Task 39):
//   - Default: toasts boş array.
//   - push(): toasts'a yeni entry ekler; otomatik unique id atanır.
//   - dismiss(id): id eşleşen toast'ı kaldırır.
//   - clear(): tüm toast'ları siler.
//   - Birden çok push'ta id'ler unique olmalı (Date.now + random suffix).
//
// Phase 7 paterni: studio-store ile aynı disiplin (basit zustand state +
// transition fonksiyonları). Phase 6'dan ayrı, Toast primitive'i
// (`@/components/ui/Toast`) konum/yaşam döngüsü tarafsız atom.

import { describe, it, expect, beforeEach } from "vitest";
import { useSelectionStudioToasts } from "@/features/selection/stores/toast-store";

function reset() {
  useSelectionStudioToasts.setState({ toasts: [] });
}

describe("useSelectionStudioToasts — default state", () => {
  beforeEach(() => reset());

  it("default: toasts boş array", () => {
    expect(useSelectionStudioToasts.getState().toasts).toEqual([]);
  });
});

describe("useSelectionStudioToasts — push", () => {
  beforeEach(() => reset());

  it("yeni toast entry ekler + otomatik id atar", () => {
    useSelectionStudioToasts
      .getState()
      .push({ tone: "success", message: "Tamamlandı" });
    const { toasts } = useSelectionStudioToasts.getState();
    expect(toasts).toHaveLength(1);
    expect(toasts[0]!.tone).toBe("success");
    expect(toasts[0]!.message).toBe("Tamamlandı");
    expect(typeof toasts[0]!.id).toBe("string");
    expect(toasts[0]!.id.length).toBeGreaterThan(0);
  });

  it("ardışık push'larda id'ler unique olur", () => {
    const push = useSelectionStudioToasts.getState().push;
    push({ tone: "info", message: "a" });
    push({ tone: "info", message: "b" });
    push({ tone: "info", message: "c" });
    const ids = useSelectionStudioToasts.getState().toasts.map((t) => t.id);
    expect(new Set(ids).size).toBe(3);
  });

  it("source alanı saklanır (debug)", () => {
    useSelectionStudioToasts.getState().push({
      tone: "error",
      message: "x",
      source: "heavy-edit",
    });
    expect(
      useSelectionStudioToasts.getState().toasts[0]!.source,
    ).toBe("heavy-edit");
  });
});

describe("useSelectionStudioToasts — dismiss", () => {
  beforeEach(() => reset());

  it("id eşleşen toast kaldırılır; diğerleri kalır", () => {
    const push = useSelectionStudioToasts.getState().push;
    push({ tone: "info", message: "a" });
    push({ tone: "info", message: "b" });
    const firstId = useSelectionStudioToasts.getState().toasts[0]!.id;

    useSelectionStudioToasts.getState().dismiss(firstId);
    const { toasts } = useSelectionStudioToasts.getState();
    expect(toasts).toHaveLength(1);
    expect(toasts[0]!.message).toBe("b");
  });

  it("eşleşmeyen id → no-op", () => {
    useSelectionStudioToasts
      .getState()
      .push({ tone: "info", message: "a" });
    useSelectionStudioToasts.getState().dismiss("nonexistent");
    expect(useSelectionStudioToasts.getState().toasts).toHaveLength(1);
  });
});

describe("useSelectionStudioToasts — clear", () => {
  beforeEach(() => reset());

  it("tüm toast'lar silinir", () => {
    const push = useSelectionStudioToasts.getState().push;
    push({ tone: "info", message: "a" });
    push({ tone: "info", message: "b" });
    useSelectionStudioToasts.getState().clear();
    expect(useSelectionStudioToasts.getState().toasts).toEqual([]);
  });
});
