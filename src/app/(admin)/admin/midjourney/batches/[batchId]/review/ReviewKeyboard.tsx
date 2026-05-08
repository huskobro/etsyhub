"use client";

// Pass 89 — Batch Review Studio V1: Global keyboard shortcuts.
//
// Mouse hover'da olan card'a 1/2/3 tuşları → Tut/Reddet/Sıfırla.
// document.activeElement / hover detection için card'ın mouseover state'ine
// güveniyoruz (mouseenter/leave). Tek bir kartı bir anda "active" tutar.

import { useEffect } from "react";

export function ReviewKeyboard() {
  useEffect(() => {
    let activeCard: HTMLElement | null = null;

    const onMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const card = target.closest<HTMLElement>("[data-testid='mj-review-card']");
      if (card) {
        activeCard = card;
      }
    };

    const onMouseOut = (e: MouseEvent) => {
      const related = e.relatedTarget as HTMLElement | null;
      if (
        activeCard &&
        related &&
        !activeCard.contains(related)
      ) {
        // hâlâ activeCard'ın içindeyse koru
        return;
      }
    };

    const onKey = (e: KeyboardEvent) => {
      // Sadece ana içerikte; input içindeyse bypass.
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (!activeCard) return;
      let testId: string | null = null;
      if (e.key === "1") testId = "mj-review-keep";
      else if (e.key === "2") testId = "mj-review-reject";
      else if (e.key === "3") testId = "mj-review-reset";
      if (!testId) return;
      const btn = activeCard.querySelector<HTMLButtonElement>(
        `[data-testid='${testId}']`,
      );
      if (btn && !btn.disabled) {
        e.preventDefault();
        btn.click();
      }
    };

    document.addEventListener("mouseover", onMouseOver);
    document.addEventListener("mouseout", onMouseOut);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mouseover", onMouseOver);
      document.removeEventListener("mouseout", onMouseOut);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return null;
}
