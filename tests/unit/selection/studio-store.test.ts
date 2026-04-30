// Phase 7 Task 25 — Selection Studio store (Zustand) testleri.
//
// Sözleşme (plan Task 25):
//   - Default: activeItemId null, multiSelectIds empty Set, filter "all",
//     currentSetId null.
//   - setActiveItemId tek alan günceller.
//   - toggleMultiSelect: id Set'te yoksa ekler, varsa kaldırır.
//   - selectMultiRange: yeni Set ile replace eder.
//   - clearMultiSelect: Set boş.
//   - setFilter: filter değişir; diğer alanlar etkilenmez.
//   - setCurrentSetId(yeni): state reset (activeItemId=null,
//     multiSelectIds=empty, filter="all").
//   - setCurrentSetId(aynı): no-op (state korunur — gereksiz reset yok).
//
// Phase 6 emsali: tests/unit/review-selection-store.test.ts (basit state
// reset paterni). Phase 7 store Phase 6'dan ayrı dosyada.

import { describe, it, expect, beforeEach } from "vitest";
import { useStudioStore } from "@/features/selection/stores/studio-store";

function reset() {
  useStudioStore.setState({
    activeItemId: null,
    multiSelectIds: new Set<string>(),
    filter: "all",
    currentSetId: null,
  });
}

describe("useStudioStore — default state", () => {
  beforeEach(() => reset());

  it("default: activeItemId null, multiSelectIds boş, filter 'all', currentSetId null", () => {
    const s = useStudioStore.getState();
    expect(s.activeItemId).toBeNull();
    expect(s.multiSelectIds.size).toBe(0);
    expect(s.filter).toBe("all");
    expect(s.currentSetId).toBeNull();
  });
});

describe("useStudioStore — setActiveItemId", () => {
  beforeEach(() => reset());

  it("activeItemId güncellenir", () => {
    useStudioStore.getState().setActiveItemId("item-1");
    expect(useStudioStore.getState().activeItemId).toBe("item-1");
  });

  it("null geçerli — preview kaldırma", () => {
    useStudioStore.getState().setActiveItemId("item-1");
    useStudioStore.getState().setActiveItemId(null);
    expect(useStudioStore.getState().activeItemId).toBeNull();
  });
});

describe("useStudioStore — toggleMultiSelect", () => {
  beforeEach(() => reset());

  it("yeni id ekler", () => {
    useStudioStore.getState().toggleMultiSelect("a");
    expect(useStudioStore.getState().multiSelectIds.has("a")).toBe(true);
  });

  it("ikinci kez çağrı id'yi kaldırır", () => {
    useStudioStore.getState().toggleMultiSelect("a");
    useStudioStore.getState().toggleMultiSelect("a");
    expect(useStudioStore.getState().multiSelectIds.has("a")).toBe(false);
  });

  it("birden fazla id koexist eder", () => {
    useStudioStore.getState().toggleMultiSelect("a");
    useStudioStore.getState().toggleMultiSelect("b");
    expect(
      Array.from(useStudioStore.getState().multiSelectIds).sort(),
    ).toEqual(["a", "b"]);
  });
});

describe("useStudioStore — selectMultiRange", () => {
  beforeEach(() => reset());

  it("yeni Set ile replace eder (eski seçim taşınmaz)", () => {
    useStudioStore.getState().toggleMultiSelect("z");
    useStudioStore.getState().selectMultiRange(["a", "b", "c"]);
    expect(
      Array.from(useStudioStore.getState().multiSelectIds).sort(),
    ).toEqual(["a", "b", "c"]);
  });

  it("boş array → boş Set", () => {
    useStudioStore.getState().toggleMultiSelect("z");
    useStudioStore.getState().selectMultiRange([]);
    expect(useStudioStore.getState().multiSelectIds.size).toBe(0);
  });
});

describe("useStudioStore — clearMultiSelect", () => {
  beforeEach(() => reset());

  it("tüm seçimi sıfırlar", () => {
    useStudioStore.getState().toggleMultiSelect("a");
    useStudioStore.getState().toggleMultiSelect("b");
    useStudioStore.getState().clearMultiSelect();
    expect(useStudioStore.getState().multiSelectIds.size).toBe(0);
  });
});

describe("useStudioStore — setFilter", () => {
  beforeEach(() => reset());

  it("filter değeri güncellenir", () => {
    useStudioStore.getState().setFilter("active");
    expect(useStudioStore.getState().filter).toBe("active");
    useStudioStore.getState().setFilter("rejected");
    expect(useStudioStore.getState().filter).toBe("rejected");
  });

  it("filter değişimi diğer alanları etkilemez", () => {
    useStudioStore.getState().setActiveItemId("item-1");
    useStudioStore.getState().toggleMultiSelect("a");
    useStudioStore.getState().setFilter("active");
    expect(useStudioStore.getState().activeItemId).toBe("item-1");
    expect(useStudioStore.getState().multiSelectIds.has("a")).toBe(true);
  });
});

describe("useStudioStore — setCurrentSetId", () => {
  beforeEach(() => reset());

  it("yeni setId → state reset (activeItemId=null, multiSelectIds=empty, filter='all')", () => {
    // Önce kirli state oluştur
    useStudioStore.getState().setCurrentSetId("set-1");
    useStudioStore.getState().setActiveItemId("item-x");
    useStudioStore.getState().toggleMultiSelect("a");
    useStudioStore.getState().toggleMultiSelect("b");
    useStudioStore.getState().setFilter("rejected");

    // Yeni set'e geç
    useStudioStore.getState().setCurrentSetId("set-2");

    const s = useStudioStore.getState();
    expect(s.currentSetId).toBe("set-2");
    expect(s.activeItemId).toBeNull();
    expect(s.multiSelectIds.size).toBe(0);
    expect(s.filter).toBe("all");
  });

  it("aynı setId → no-op (state korunur)", () => {
    useStudioStore.getState().setCurrentSetId("set-1");
    useStudioStore.getState().setActiveItemId("item-x");
    useStudioStore.getState().toggleMultiSelect("a");
    useStudioStore.getState().setFilter("active");

    // Aynı setId tekrar
    useStudioStore.getState().setCurrentSetId("set-1");

    const s = useStudioStore.getState();
    expect(s.currentSetId).toBe("set-1");
    expect(s.activeItemId).toBe("item-x");
    expect(s.multiSelectIds.has("a")).toBe(true);
    expect(s.filter).toBe("active");
  });

  it("null'dan ilk setId geçişinde state default zaten boş — reset gözle görünmez", () => {
    useStudioStore.getState().setCurrentSetId("set-1");
    const s = useStudioStore.getState();
    expect(s.currentSetId).toBe("set-1");
    expect(s.activeItemId).toBeNull();
    expect(s.multiSelectIds.size).toBe(0);
    expect(s.filter).toBe("all");
  });
});
