"use client";

// Phase 8 Task 14 — `useMockupPackState` URL primary state hook.
//
// Spec §6.1 verbatim implementation. Kanonik state kaynağı = URL (`t=` query
// param). Local UI mirror (Zustand) v1'de yok; React Query (server state) +
// `useSearchParams` + `useMemo` yeterli.
//
// Hook sözleşmesi:
//   - `selectedTemplateIds` — URL'de `t=` varsa parse + invalid filter,
//     yoksa `defaultTemplateIds` fallback.
//   - `defaultTemplateIds` — `selectQuickPackDefault` (Task 13) çıktısı,
//     memoized.
//   - `isDirty` — `t var && t ≠ default` türev (Spec §2.7: ayrı boolean
//     saklanmaz).
//   - `isCustom` — sadece URL'de `t=` var mı sorusu (default'a eşitse de
//     true).
//   - `toggleTemplate(id)` — debounced 150ms; default'a eşitlenirse `t=`
//     temizlenir (Spec §6.1).
//   - `resetToQuickPack()` — `t=` temizler.
//
// URL update disiplini: `router.replace`, `scroll: false`. History'de iz yok
// (Spec §6.2). Phase 7 `AddVariantsDrawer` emsali.
//
// Cap + validation: max 8 ID (Spec §2.7 sanity), invalid silently filter.
//
// Yeni dep eklenmedi: `use-debounce` paketi codebase'de yok; `setTimeout`
// + cleanup pattern ile manuel debounce yazıldı (CLAUDE.md disiplini).

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useSelectionSet } from "@/features/selection/queries";

import {
  useMockupTemplates,
  type MockupTemplateView,
} from "./useMockupTemplates";
import { selectQuickPackDefault } from "@/features/mockups/server/quick-pack.service";

// ────────────────────────────────────────────────────────────
// Sabitler
// ────────────────────────────────────────────────────────────

/** Quick Pack hedef boyutu (Spec §2.6 + §6.1 verbatim). */
const QUICK_PACK_TARGET_SIZE = 6;

/** URL `t=` cap (Spec §2.7 sanity). 8 × ~20 char = ~160 char query. */
const TEMPLATE_IDS_CAP = 8;

/** Debounce ms (Spec §6.1 verbatim). */
const TOGGLE_DEBOUNCE_MS = 150;

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

/**
 * URL `t=` parametresini parse eder.
 *
 * - boş / null → `null` (Quick Pack default fallback'i tetikler)
 * - virgülle ayrılmış string → trimmed, boş eleman atılmış array
 * - sonuç boş array → `null` (default fallback)
 * - cap: max 8 ID (Spec §2.7), fazlası silently kesilir
 */
function parseTemplateIds(raw: string | null): string[] | null {
  if (!raw) return null;
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (ids.length === 0) return null;
  return ids.slice(0, TEMPLATE_IDS_CAP);
}

/** İki string array'in element bazında eşit olup olmadığını kontrol eder. */
function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

/**
 * `set` payload'ından quick-pack input için `variants[].aspectRatio`
 * çıkarır. İki shape'i de güvenli okur (yorum: bk. `defaultTemplateIds`
 * useMemo). Null aspectRatio'lu kayıtlar atılır — backend Spec §1.4
 * fallback chain ile resolve etmemişse default hesabına dahil edilmez.
 */
function extractVariants(
  set: unknown,
): { aspectRatio: string }[] {
  if (!set || typeof set !== "object") return [];
  const obj = set as {
    variants?: Array<{ aspectRatio?: string | null }>;
    items?: Array<{ aspectRatio?: string | null }>;
  };
  const source = obj.variants ?? obj.items ?? [];
  return source
    .map((v) => v?.aspectRatio)
    .filter((ar): ar is string => typeof ar === "string" && ar.length > 0)
    .map((aspectRatio) => ({ aspectRatio }));
}

/**
 * Manuel debounced callback — `use-debounce` paketi yok; CLAUDE.md disiplini
 * gereği yeni dep eklenmedi.
 *
 * Davranış: `delayMs` içinde art arda çağrılırsa son çağrı kazanır
 * (önceki timer iptal edilir). Component unmount'unda pending timer
 * temizlenir (memory leak yok).
 *
 * `fnRef` pattern ile en güncel `fn` closure'ı yakalanır — re-render'da
 * `useCallback` reference değişmez (debounce semantiği bozulmaz).
 */
function useDebouncedCallback<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  delayMs: number,
): (...args: TArgs) => void {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Unmount cleanup
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return useCallback(
    (...args: TArgs) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        fnRef.current(...args);
      }, delayMs);
    },
    [delayMs],
  );
}

// ────────────────────────────────────────────────────────────
// Hook
// ────────────────────────────────────────────────────────────

export type UseMockupPackStateResult = {
  selectedTemplateIds: string[];
  defaultTemplateIds: string[];
  incompatibleTemplateIds?: string[];
  incompatibleReason?: string;
  isDirty: boolean;
  isCustom: boolean;
  toggleTemplate: (templateId: string) => void;
  resetToQuickPack: () => void;
};

/**
 * Spec §6.1 — URL primary state hook.
 *
 * @param setId Selection set id (Phase 7 — `useSelectionSet` ile fetch).
 *              Boş string verilirse `useSelectionSet` disabled olur ve
 *              `defaultTemplateIds = []` döner.
 */
export function useMockupPackState(setId: string): UseMockupPackStateResult {
  const searchParams = useSearchParams();
  const router = useRouter();

  // 1. Server state (React Query, ayrı katman)
  const { data: set } = useSelectionSet(setId);
  const { data: templates } = useMockupTemplates({ categoryId: "canvas" });

  // 2. Default computation (memoized client-side, Spec §2.6 algoritması).
  //
  // `selectQuickPackDefault` input shape'i: `{ variants: [{ aspectRatio }] }`.
  // Backend payload bu alanı v1'de henüz expose etmiyor (Phase 7
  // `SelectionSetDetailView` `items[]` döner; aspectRatio resolve fallback
  // chain backend'de). Task 22'de `useMockupTemplates` gerçek implementation'a
  // bağlanırken set payload'ı da `variants[].aspectRatio` ile genişletilir
  // (Spec §1.4). Bu hook her iki shape'i de güvenli okur:
  //   - `set.variants` varsa (Task 22+ gerçek shape veya test mock) onu kullan
  //   - yoksa `set.items[].aspectRatio` (Phase 7 mevcut shape) fallback
  //   - hiçbiri yoksa boş array
  const defaultTemplateIds = useMemo(() => {
    if (!set || !templates) return [];
    const variants = extractVariants(set);
    return selectQuickPackDefault({
      set: { variants },
      allActiveTemplates: templates.map((t) => ({
        id: t.id,
        aspectRatios: t.aspectRatios,
        tags: t.tags,
      })),
      targetSize: QUICK_PACK_TARGET_SIZE,
    });
  }, [set, templates]);

  // 3. URL'den selectedTemplateIds (override yoksa default)
  const urlTemplateIds = parseTemplateIds(searchParams.get("t"));
  const selectedTemplateIds = urlTemplateIds ?? defaultTemplateIds;

  // Validation: invalid IDs silently filter (Spec §2.7)
  const validIds = selectedTemplateIds.filter((id) =>
    templates?.some((t: MockupTemplateView) => t.id === id),
  );

  // Dirty türev (Spec §2.7: ayrı boolean saklanmaz)
  const isDirty =
    urlTemplateIds !== null &&
    !arraysEqual(urlTemplateIds, defaultTemplateIds);

  // Custom: URL'de `t=` var mı (default'a eşitse de true — Spec §2.7)
  const isCustom = urlTemplateIds !== null;

  // 4. URL update helper (closure ile searchParams + router capture)
  const updateUrl = useCallback(
    (updates: { t?: string | undefined }): void => {
      const next = new URLSearchParams(searchParams.toString());
      if (updates.t === undefined) {
        next.delete("t");
      } else {
        next.set("t", updates.t);
      }
      const queryString = next.toString();
      // Spec §6.2: drawer/modal/toggle = router.replace + scroll: false →
      // history'de iz yok.
      router.replace(queryString ? `?${queryString}` : "?", { scroll: false });
    },
    [searchParams, router],
  );

  // 5. toggleTemplate (debounced 150ms; rapid çağrılar tek update'e collapse)
  const toggleTemplate = useDebouncedCallback((templateId: string) => {
    const current = urlTemplateIds ?? defaultTemplateIds;
    const next = current.includes(templateId)
      ? current.filter((x) => x !== templateId)
      : [...current, templateId];

    if (arraysEqual(next, defaultTemplateIds)) {
      // Default'a eşitlendiyse `t` param'ını temizle (Spec §6.1 verbatim).
      updateUrl({ t: undefined });
    } else {
      // Cap (Spec §2.7): toggle add yoluyla 8'i aşmasın.
      const capped = next.slice(0, TEMPLATE_IDS_CAP);
      updateUrl({ t: capped.join(",") });
    }
  }, TOGGLE_DEBOUNCE_MS);

  const resetToQuickPack = useCallback(() => {
    updateUrl({ t: undefined });
  }, [updateUrl]);

  return {
    selectedTemplateIds: validIds,
    defaultTemplateIds,
    isDirty,
    isCustom,
    toggleTemplate,
    resetToQuickPack,
  };
}
