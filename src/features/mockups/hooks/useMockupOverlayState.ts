// Phase 8 Task 15 — Drawer + modal URL state helpers.
//
// Spec §6.2: S1 Browse drawer (?customize=1) + S2 Detail modal (?templateId=X)
// overlay state'leri URL üzerinden persist edilir. Phase 7'de Zustand pattern
// emsali olsa da Phase 8 §2.7 URL primary kararı (Task 14 ile aynı disiplin)
// uygulanır.
//
// Sözleşme:
//   - isCustomizeOpen: ?customize=1 var mı
//   - modalTemplateId: ?templateId param (null = modal kapalı)
//   - openCustomizeDrawer / closeCustomize: drawer aç-kapa
//   - openTemplateModal / closeTemplateModal: modal aç-kapa
//   - Tüm update'ler router.replace + scroll: false (Task 14 emsali)
//   - Existing ?t= preserve edilir (Task 14 useMockupPackState ile yan yana)

"use client";

import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// ────────────────────────────────────────────────────────────
// Pure helpers (test'lenebilir saf logic)
// ────────────────────────────────────────────────────────────

/**
 * Spec §6.2: URL query string'ini güncelleyerek yeni sürümünü üretir.
 *
 * @param current Mevcut query string (empty string ok)
 * @param updates { customize, templateId } fields'ından biri/ikisi
 * @returns Güncellenmiş query string (leading `?` yok)
 */
export function updateOverlayUrl(
  current: string,
  updates: {
    customize?: "1" | undefined;
    templateId?: string | undefined;
  }
): string {
  const next = new URLSearchParams(current);

  if ("customize" in updates) {
    if (updates.customize === undefined) next.delete("customize");
    else next.set("customize", updates.customize);
  }
  if ("templateId" in updates) {
    if (updates.templateId === undefined) next.delete("templateId");
    else next.set("templateId", updates.templateId);
  }

  return next.toString();
}

// ────────────────────────────────────────────────────────────
// Hook
// ────────────────────────────────────────────────────────────

export type UseMockupOverlayStateResult = {
  /** ?customize=1 query param var mı (S1 drawer açık göstergesi) */
  isCustomizeOpen: boolean;
  /** ?templateId=... query param value (null = S2 modal kapalı) */
  modalTemplateId: string | null;
  /** S1 drawer aç: ?customize=1 ekler, mevcut params preserve. */
  openCustomizeDrawer: () => void;
  /** S1 drawer kapat: ?customize=1 + ?templateId silinir (modal da kapanır). */
  closeCustomize: () => void;
  /** S2 modal aç: ?templateId=X ekler, mevcut params preserve. */
  openTemplateModal: (templateId: string) => void;
  /** S2 modal kapat: ?templateId silinir; ?customize=1 (drawer) kalır. */
  closeTemplateModal: () => void;
};

/**
 * Spec §6.2 hook implementation.
 *
 * Phase 7 emsali: useMockupPackState (Task 14) updateUrl helper paterni.
 * URL primary disiplin (Spec §2.7) — Zustand kullanılmaz.
 */
export function useMockupOverlayState(): UseMockupOverlayStateResult {
  const searchParams = useSearchParams();
  const router = useRouter();

  const isCustomizeOpen = useMemo(
    () => searchParams.get("customize") === "1",
    [searchParams]
  );

  const modalTemplateId = useMemo(
    () => searchParams.get("templateId") || null,
    [searchParams]
  );

  const updateUrlAndNavigate = useCallback(
    (updates: {
      customize?: "1" | undefined;
      templateId?: string | undefined;
    }) => {
      const queryString = updateOverlayUrl(searchParams.toString(), updates);
      // Spec §2.7 + §6.1: router.replace, scroll: false
      router.replace(queryString ? `?${queryString}` : "?", { scroll: false });
    },
    [router, searchParams]
  );

  const openCustomizeDrawer = useCallback(() => {
    updateUrlAndNavigate({ customize: "1" });
  }, [updateUrlAndNavigate]);

  const closeCustomize = useCallback(() => {
    // Drawer kapanırken modal da kapanır (Spec §6.2)
    updateUrlAndNavigate({ customize: undefined, templateId: undefined });
  }, [updateUrlAndNavigate]);

  const openTemplateModal = useCallback(
    (templateId: string) => {
      updateUrlAndNavigate({ templateId });
    },
    [updateUrlAndNavigate]
  );

  const closeTemplateModal = useCallback(() => {
    // Modal kapanırken drawer kalır (Spec §6.2)
    updateUrlAndNavigate({ templateId: undefined });
  }, [updateUrlAndNavigate]);

  return {
    isCustomizeOpen,
    modalTemplateId,
    openCustomizeDrawer,
    closeCustomize,
    openTemplateModal,
    closeTemplateModal,
  };
}
