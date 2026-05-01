// PHASE 8 TASK 5 STUB — Task 8'de gerçek pack selection algoritması ile değişir.
//
// V1'de tam algoritma (spec §2.5):
//   - aspect compatibility filter (deterministik stable sort)
//   - cover slot: hero variant × en yüksek coverPriority binding
//   - template diversity: her unique binding en az 1 kez
//   - variant rotation: round-robin kalan slot'lara
//   - K10 cover-fail fallback (recomputePackOnRenderComplete)
//
// Bu stub Task 5 handoff service'i unblock etmek için minimum disipline
// uygular:
//   - lexicographic stable sort (items by position ASC, bindings by id ASC)
//   - cover slot 0 (sortedItems[0] × sortedBindings[0])
//   - template diversity slot'ları (kalan binding'ler için sortedItems[0])
//   - variant rotation kalan slot'lara round-robin
//   - actualPackSize = min(validPairs.length, packSize)
//
// ABI (PackSlot, PackSelection) Task 8'de aynı kalır. Aspect compatibility
// filter Task 8'de tam implement edilir; bu stub'da items.length === 0 veya
// bindings.length === 0 → boş slot dönüş yeterli (handoff service test'leri
// için).

import type { MockupTemplateBinding } from "@prisma/client";

export type PackSlot = {
  variantId: string;
  binding: MockupTemplateBinding;
  selectionReason: "COVER" | "TEMPLATE_DIVERSITY" | "VARIANT_ROTATION";
};

export type PackSelection = {
  cover: PackSlot | null;
  slots: PackSlot[]; // includes cover at index 0 when present
};

export type PackSelectionItem = {
  id: string;
  aspectRatio: string;
  position: number;
};

/**
 * Stub — gerçek algoritma Task 8'de.
 *
 * Önemli invariant'lar (Task 8'de korunmalı):
 *   - cover (varsa) slots[0] olur
 *   - Her slot unique (variantId, bindingId) çifti olmalı
 *   - actualPackSize ≤ packSize
 */
export function buildPackSelection(
  items: PackSelectionItem[],
  bindings: MockupTemplateBinding[],
  packSize: number = 10,
): PackSelection {
  if (items.length === 0 || bindings.length === 0) {
    return { cover: null, slots: [] };
  }

  // Stable sort: items by position ASC, bindings by id ASC.
  const sortedItems = [...items].sort((a, b) => a.position - b.position);
  const sortedBindings = [...bindings].sort((a, b) =>
    a.id.localeCompare(b.id),
  );

  // Aspect compatibility filter — stub'da pass-through (Task 8'de gerçek
  // template.aspectRatios uyumsuzluğu burada düşürülecek).
  const validPairs: { item: PackSelectionItem; binding: MockupTemplateBinding }[] =
    [];
  for (const item of sortedItems) {
    for (const binding of sortedBindings) {
      validPairs.push({ item, binding });
    }
  }

  if (validPairs.length === 0) {
    return { cover: null, slots: [] };
  }

  // Cover: ilk valid pair (sortedItems[0] × sortedBindings[0]).
  const coverPair = validPairs[0]!;
  const cover: PackSlot = {
    variantId: coverPair.item.id,
    binding: coverPair.binding,
    selectionReason: "COVER",
  };

  const usedKeys = new Set<string>();
  usedKeys.add(`${cover.variantId}:${cover.binding.id}`);

  // Diversity slot'ları — her benzersiz binding için ilk variant ile slot.
  const diversitySlots: PackSlot[] = [];
  for (const binding of sortedBindings.slice(1)) {
    if (1 + diversitySlots.length >= packSize) break;
    const candidate: PackSlot = {
      variantId: sortedItems[0]!.id,
      binding,
      selectionReason: "TEMPLATE_DIVERSITY",
    };
    const key = `${candidate.variantId}:${candidate.binding.id}`;
    if (!usedKeys.has(key)) {
      diversitySlots.push(candidate);
      usedKeys.add(key);
    }
  }

  // Rotation slot'ları — kalan slot'lara round-robin (validPairs sırası).
  const rotationSlots: PackSlot[] = [];
  for (const pair of validPairs) {
    if (1 + diversitySlots.length + rotationSlots.length >= packSize) break;
    const key = `${pair.item.id}:${pair.binding.id}`;
    if (usedKeys.has(key)) continue;
    rotationSlots.push({
      variantId: pair.item.id,
      binding: pair.binding,
      selectionReason: "VARIANT_ROTATION",
    });
    usedKeys.add(key);
  }

  return {
    cover,
    slots: [cover, ...diversitySlots, ...rotationSlots],
  };
}
