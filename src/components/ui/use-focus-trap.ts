"use client";

import { useEffect, type RefObject } from "react";

/**
 * EtsyHub useFocusTrap — T-40 spec (T-40 fix: initialFocusRef parametresi).
 *
 * Klavye-only kullanıcı için dialog/drawer içinde focus boundary kurar.
 *
 * Davranış:
 * - `isOpen=true` mount → initial focus uygulanır:
 *     · `initialFocusRef.current` mevcutsa → o element focus alır
 *     · yoksa → ref içindeki ilk focusable element focus alır
 * - Tab → focusable elementler arasında dolaşır, son element'ten sonra ilk
 *   element'e wrap
 * - Shift+Tab → ters yön, ilk element'ten önce son element'e wrap
 * - `isOpen=false` → cleanup, focus trap deaktif
 *
 * Sınır:
 * - Hook YALNIZCA Tab boundary + initial focus üstlenir.
 * - Escape, backdrop click, role="dialog" gibi davranışlar tüketici taraf
 *   sorumluluğundadır (T-37 paterni; bkz. trend-cluster-drawer.tsx).
 *
 * `initialFocusRef` parametresi tek-doğru-kaynak ilkesini sağlar: tüketici
 * tarafta ikinci bir `useEffect(() => ref.current?.focus(), [])` çağrısı
 * yapılmamalıdır. Aksi halde effect sıralama race condition'ı oluşur ve
 * hook çağrısının yeri değiştiğinde initial focus kırılır.
 *
 * Yasaklar (kilitli — docs/design/implementation-notes/cp9-stabilization-wave.md):
 * - focus-trap-react veya benzeri library import YASAK.
 * - Inert attribute polyfill YASAK.
 * - Programmatic tabindex=-1 atomu YASAK; yalnızca preventDefault + manuel
 *   focus yönlendirme.
 */
const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

function getFocusable(container: HTMLElement): HTMLElement[] {
  const nodes = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
  return Array.from(nodes).filter((el) => {
    if (el.hasAttribute("disabled")) return false;
    if (el.getAttribute("aria-hidden") === "true") return false;
    return true;
  });
}

export function useFocusTrap(
  ref: RefObject<HTMLElement | null>,
  isOpen: boolean,
  initialFocusRef?: RefObject<HTMLElement | null>,
): void {
  // Initial focus: isOpen true olduğunda
  // - initialFocusRef.current varsa o element odaklanır,
  // - yoksa ref içindeki ilk focusable element odaklanır.
  useEffect(() => {
    if (!isOpen) return;
    const explicit = initialFocusRef?.current ?? null;
    if (explicit) {
      explicit.focus();
      return;
    }
    const container = ref.current;
    if (!container) return;
    const focusable = getFocusable(container);
    focusable[0]?.focus();
  }, [isOpen, ref, initialFocusRef]);

  // Tab boundary: isOpen iken Tab/Shift+Tab focusable list içinde wraps.
  // Tarayıcı/jsdom paritesi için her Tab event'inde manuel ilerleme: bu
  // sayede jsdom'un Tab'ı simüle etmemesi durumu da deterministik kalır.
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const container = ref.current;
      if (!container) return;
      const focusable = getFocusable(container);
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement as HTMLElement | null;
      const idx = active ? focusable.indexOf(active) : -1;

      if (event.shiftKey) {
        // Shift+Tab — geri yön
        event.preventDefault();
        if (idx <= 0) {
          last.focus();
        } else {
          focusable[idx - 1]!.focus();
        }
      } else {
        // Tab — ileri yön
        event.preventDefault();
        if (idx === -1 || idx === focusable.length - 1) {
          first.focus();
        } else {
          focusable[idx + 1]!.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, ref]);
}
