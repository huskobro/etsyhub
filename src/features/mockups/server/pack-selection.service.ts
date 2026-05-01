// Phase 8 Task 8 — Pack selection algoritması (gerçek implementation).
//
// Spec §2.5: 3-katmanlı deterministik algoritma:
//   1. Aspect compatibility filter — variant.aspectRatio template.aspectRatios
//      içeriyor mu (template-level filter; binding bağımsız)
//   2. Cover slot (packPosition=0): hero variant (position ASC ilk
//      non-rejected item; §1.4 fallback) × en yüksek coverPriority binding
//      (eşitlikte bindingId lex tie-break)
//   3. Template diversity (slot 1..M): her unique binding en az 1 kez temsil
//      edilsin (cover'dan farklı pair'ler tercih)
//   4. Variant rotation (kalan slot'lar): round-robin (variant[i % N] ×
//      binding[i % M]), önceki seçimler atlanır
//
// Determinizm disiplini: validPairs + bindings + variants listeleri iterasyon
// öncesi stable sort'a tabi (bindingId lex, variantId/position). Aynı input →
// aynı pack.
//
// K10 cover-fail fallback (review-2): cover render kendisi fail olursa
// recomputePackOnRenderComplete fonksiyonu atomic slot swap yapar.
// MOCKUP_RENDER worker (Task 7) her render terminal status'a geçtikten sonra
// çağırır.

import { db } from "@/server/db";
import type {
  MockupTemplateBinding,
  MockupTemplate,
} from "@prisma/client";
import type { LocalSharpConfig } from "@/providers/mockup";

// ────────────────────────────────────────────────────────────
// Types (ABI Task 5 ile uyumlu — PackSlot/PackSelection invariant)
// ────────────────────────────────────────────────────────────

export type PackSlot = {
  variantId: string;
  binding: MockupTemplateBinding;
  selectionReason: "COVER" | "TEMPLATE_DIVERSITY" | "VARIANT_ROTATION";
};

export type PackSelection = {
  cover: PackSlot | null;
  slots: PackSlot[]; // includes cover at index 0 when present
};

// Item'ların pack-selection'a girdi olarak gelen şekli (handoff service
// tarafından map edilir).
export type PackSelectionItem = {
  id: string;
  aspectRatio: string;
  position: number;
};

// Helper — template + binding pair'i (resolveBinding sonrası). Aspect filter
// için template referansı gerekiyor (binding.config'de aspect bilgisi yok;
// template.aspectRatios array'i kullanılıyor).
export type TemplateBindingPair = {
  template: MockupTemplate;
  binding: MockupTemplateBinding;
};

// ────────────────────────────────────────────────────────────
// buildPackSelection — Spec §2.5 3-katmanlı algoritma
// ────────────────────────────────────────────────────────────

/**
 * Spec §2.5 pseudocode'unun birebir implementation'ı.
 *
 * Determinizm: aynı set (item.position ASC) + aynı pair'ler (binding.id ASC)
 * → aynı pack. Test snapshot'ları flaky değil.
 *
 * @param items Aspect-resolved (non-rejected) SelectionItem'lar
 * @param pairs Template + binding tuples (handoff service'in resolveBinding
 *              sonrası ürettiği). Aspect filter için template.aspectRatios
 *              array'i gerekli.
 * @param packSize Hedef pack boyutu (default 10, Spec Etsy limit)
 */
export function buildPackSelection(
  items: PackSelectionItem[],
  pairs: TemplateBindingPair[],
  packSize: number = 10,
): PackSelection {
  if (items.length === 0 || pairs.length === 0 || packSize <= 0) {
    return { cover: null, slots: [] };
  }

  // Stable sort: items by position ASC, pairs by binding.id ASC. Iterasyon
  // öncesi sabit sıralama → deterministik output.
  const sortedItems = [...items].sort((a, b) => a.position - b.position);
  const sortedPairs = [...pairs].sort((a, b) =>
    a.binding.id.localeCompare(b.binding.id),
  );

  // 1. Aspect compatibility filter — Spec §2.5: item.aspectRatio
  //    template.aspectRatios array'i içinde mi?
  const validPairs: { item: PackSelectionItem; pair: TemplateBindingPair }[] =
    [];
  for (const item of sortedItems) {
    for (const pair of sortedPairs) {
      if (pair.template.aspectRatios.includes(item.aspectRatio)) {
        validPairs.push({ item, pair });
      }
    }
  }

  if (validPairs.length === 0) {
    return { cover: null, slots: [] };
  }

  // 2. Cover slot — Spec §2.5: hero (position ASC ilk) × en yüksek
  //    coverPriority binding. Eşitlikte bindingId lex tie-break.
  const cover = pickCover(sortedItems, validPairs);

  // packSize=1 edge case: sadece cover.
  if (packSize === 1) {
    return { cover, slots: [cover] };
  }

  // 3. Template diversity — her unique binding en az 1 kez temsil edilsin.
  const diversitySlots = pickTemplateDiversity(
    validPairs,
    cover,
    sortedPairs,
    packSize,
  );

  // 4. Variant rotation — kalan slot'lar round-robin.
  const remainingSize = packSize - 1 - diversitySlots.length;
  const rotationSlots = pickVariantRotation(
    validPairs,
    [cover, ...diversitySlots],
    remainingSize,
  );

  return {
    cover,
    slots: [cover, ...diversitySlots, ...rotationSlots],
  };
}

/**
 * Cover seçim — Spec §2.5:
 *   - Hero variant: position ASC ilk non-rejected SelectionItem (handoff
 *     service zaten filtered)
 *   - En yüksek coverPriority'li binding (LocalSharpConfig.coverPriority
 *     field)
 *   - Eşitlikte bindingId lex tie-break (ASC)
 *   - Hero variant ile aspect-uyumsuz pair varsa → fallback ilk valid pair
 *     (deterministik)
 */
function pickCover(
  sortedItems: PackSelectionItem[],
  validPairs: { item: PackSelectionItem; pair: TemplateBindingPair }[],
): PackSlot {
  const heroVariant = sortedItems[0]!;

  // Hero ile aspect-uyumlu pair'leri filter et.
  const heroValidPairs = validPairs.filter(
    (vp) => vp.item.id === heroVariant.id,
  );

  if (heroValidPairs.length > 0) {
    // En yüksek coverPriority + lex tie-break.
    const sortedByCoverPriority = [...heroValidPairs].sort((a, b) => {
      const aPrio = readCoverPriority(a.pair.binding);
      const bPrio = readCoverPriority(b.pair.binding);
      if (aPrio !== bPrio) return bPrio - aPrio; // DESC priority
      return a.pair.binding.id.localeCompare(b.pair.binding.id); // ASC lex tie-break
    });
    const winner = sortedByCoverPriority[0]!;
    return {
      variantId: winner.item.id,
      binding: winner.pair.binding,
      selectionReason: "COVER",
    };
  }

  // Hero ile uyumlu pair yoksa: ilk valid pair (deterministik fallback).
  const fallback = validPairs[0]!;
  return {
    variantId: fallback.item.id,
    binding: fallback.pair.binding,
    selectionReason: "COVER",
  };
}

/**
 * Template diversity — Spec §2.5:
 *   Her unique binding (sortedPairs) en az 1 kez pack'te temsil edilsin.
 *   Cover'dan farklı pair'ler tercih edilir (cover'ın binding'i zaten
 *   slots[0]'da). Bu binding için ilk valid item seçilir (sortedItems
 *   position ASC sırasında).
 *
 *   Cap: max packSize - 1 (cover slot dahil değil).
 */
function pickTemplateDiversity(
  validPairs: { item: PackSelectionItem; pair: TemplateBindingPair }[],
  cover: PackSlot,
  sortedPairs: TemplateBindingPair[],
  packSize: number,
): PackSlot[] {
  const slots: PackSlot[] = [];
  const usedBindingIds = new Set<string>();
  usedBindingIds.add(cover.binding.id);

  for (const pair of sortedPairs) {
    if (slots.length >= packSize - 1) break;
    if (usedBindingIds.has(pair.binding.id)) continue;

    // Bu binding için ilk valid item (sortedItems position ASC sayesinde
    // deterministik).
    const validForBinding = validPairs.filter(
      (vp) => vp.pair.binding.id === pair.binding.id,
    );
    if (validForBinding.length === 0) continue;

    const winner = validForBinding[0]!;
    slots.push({
      variantId: winner.item.id,
      binding: winner.pair.binding,
      selectionReason: "TEMPLATE_DIVERSITY",
    });
    usedBindingIds.add(pair.binding.id);
  }

  return slots;
}

/**
 * Variant rotation — Spec §2.5:
 *   Kalan slot'lara round-robin (variant[i % N] × binding[i % M])
 *   doldurulur. Önceden seçilmiş pair'ler (cover + diversity) atlanır.
 *
 *   Lexicographic tie-break (variantId + bindingId zaten validPairs sıralı).
 */
function pickVariantRotation(
  validPairs: { item: PackSelectionItem; pair: TemplateBindingPair }[],
  alreadySelected: PackSlot[],
  remainingSize: number,
): PackSlot[] {
  if (remainingSize <= 0) return [];

  const usedKeys = new Set<string>();
  for (const slot of alreadySelected) {
    usedKeys.add(`${slot.variantId}:${slot.binding.id}`);
  }

  const slots: PackSlot[] = [];
  for (const vp of validPairs) {
    if (slots.length >= remainingSize) break;
    const key = `${vp.item.id}:${vp.pair.binding.id}`;
    if (usedKeys.has(key)) continue;
    slots.push({
      variantId: vp.item.id,
      binding: vp.pair.binding,
      selectionReason: "VARIANT_ROTATION",
    });
    usedKeys.add(key);
  }

  return slots;
}

/**
 * Binding.config içinden coverPriority oku. LocalSharpConfig için tanımlı;
 * DynamicMockupsConfig'de yok → 0 default. Geçersiz JSON şekillerinde de 0
 * (defense-in-depth).
 */
function readCoverPriority(binding: MockupTemplateBinding): number {
  const config = binding.config as unknown as Partial<LocalSharpConfig>;
  if (config && typeof config === "object" && "coverPriority" in config) {
    const value = (config as { coverPriority?: unknown }).coverPriority;
    return typeof value === "number" ? value : 0;
  }
  return 0;
}

// ────────────────────────────────────────────────────────────
// K10 — Cover-fail fallback (review-2 gözlemi)
// ────────────────────────────────────────────────────────────

/**
 * Cover render kendisi fail olursa atomic slot swap ile ilk success render'ı
 * cover'a çek.
 *
 * MOCKUP_RENDER worker (Task 7) her render terminal status'a geçtikten sonra
 * recomputeJobStatus'tan ÖNCE çağırır (swap durumunda coverRenderId değişiyor;
 * aggregate hesabı sırasında bu değişiklik tutarlı olmalı).
 *
 * Senaryolar:
 *   - Cover render success → no-op (cover invariant korunuyor)
 *   - Cover render FAILED + ilk success render var → atomic slot swap:
 *     yeni cover render packPosition=0'a, eski cover yeni cover'ın eski
 *     packPosition'ına. coverRenderId update.
 *   - Cover render FAILED + henüz hiç success yok → bekle (idempotent;
 *     sonraki render terminal'de tekrar trigger edilir)
 *   - Tüm render FAILED → coverRenderId değişmez, job FAILED status (Task 6
 *     aggregate roll-up zaten halleder; bu fonksiyonun sorumluluğu değil)
 *
 * Phase 8 §4.8 atomic slot swap pattern emsali (cover swap endpoint kullanıcı
 * eylemi; bu fonksiyon worker eylemi, aynı atomic disiplin).
 */
export async function recomputePackOnRenderComplete(
  jobId: string,
): Promise<void> {
  const job = await db.mockupJob.findUnique({
    where: { id: jobId },
    include: { renders: true },
  });

  if (!job) return;
  if (!job.coverRenderId) return; // pack creation aşamasında henüz set edilmemiş

  const cover = job.renders.find((r) => r.id === job.coverRenderId);
  if (!cover) return; // beklenmedik durum (FK Cascade yok değil)
  if (cover.status !== "FAILED") return; // cover hâlâ pending/rendering/success → no-op

  // Cover FAILED — ilk success render'ı bul (packPosition ASC).
  const firstSuccess = job.renders
    .filter((r) => r.status === "SUCCESS")
    .sort(
      (a, b) =>
        (a.packPosition ?? Number.POSITIVE_INFINITY) -
        (b.packPosition ?? Number.POSITIVE_INFINITY),
    )[0];

  if (!firstSuccess) return; // henüz success yok, bekle

  // Atomic swap (Spec §4.8 emsali pattern). Cover'ın packPosition'ı yeni
  // cover'ın eski packPosition'ına geçer; yeni cover packPosition=0 olur;
  // coverRenderId update edilir.
  await db.$transaction([
    db.mockupRender.update({
      where: { id: cover.id },
      data: { packPosition: firstSuccess.packPosition },
    }),
    db.mockupRender.update({
      where: { id: firstSuccess.id },
      data: { packPosition: 0 },
    }),
    db.mockupJob.update({
      where: { id: jobId },
      data: { coverRenderId: firstSuccess.id },
    }),
  ]);
}
