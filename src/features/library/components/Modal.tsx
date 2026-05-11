/* eslint-disable no-restricted-syntax */
// Modal — Kivasy v4 `.k-modal` recipe. Canonical max-width sabitleri
// (sm 420 / md 720 / lg 1100), max-h-[88vh] viewport limit, dark variant'ın
// `#1F1C18` / `#16130F` surface'leri ve split-modal `min-h-[480px]
// grid-cols-[340px_1fr]` layout sözleşmesi token'larla ifade edilemez.
// Whitelisted in scripts/check-tokens.ts.
"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Kivasy Modal — `.k-overlay` + `.k-modal` recipe.
 *
 * Source: docs/design-system/kivasy/ui_kits/kivasy/v4/tokens.css → .k-overlay
 * + .k-modal. Used by Batch Review help (rollout-3), A6 Create Variations
 * (rollout-3), A7 Apply Mockups (rollout-5), B5 Add Reference (rollout-6),
 * B6 Generate Listing (rollout-5).
 *
 * Sizes:
 *  - sm  ~420px confirm / simple form
 *  - md  ~720px shortcut help, multi-field form
 *  - lg  ~1100px split modal (Create Variations / Apply Mockups)
 *
 * The split-modal layout (left rail / right body / footer) is composed at
 * the call site using `<ModalSplit>` slot helpers exported below.
 */

interface ModalProps {
  title: string;
  onClose: () => void;
  size?: "sm" | "md" | "lg";
  /** Dark variant (used by Review workspace help). */
  dark?: boolean;
  className?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function Modal({
  title,
  onClose,
  size = "md",
  dark = false,
  className,
  children,
  footer,
}: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Close on overlay click
  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const widthClass =
    size === "lg"
      ? "max-w-[1100px]"
      : size === "md"
        ? "max-w-[720px]"
        : "max-w-[420px]";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/45 p-4"
      onClick={handleOverlayClick}
    >
      <div
        ref={ref}
        className={cn(
          "flex max-h-[88vh] w-full flex-col overflow-hidden rounded-2xl border shadow-popover",
          widthClass,
          dark
            ? "border-white/10 bg-[#1F1C18] text-white/85"
            : "border-line bg-bg",
          className,
        )}
      >
        <header
          className={cn(
            "flex items-center gap-3 border-b px-5 py-4",
            dark ? "border-white/10 bg-[#16130F]" : "border-line bg-paper",
          )}
        >
          <h2 className="flex-1 text-base font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-md border",
              dark
                ? "border-white/10 text-white/70 hover:border-white/20 hover:text-white"
                : "border-line text-ink-2 hover:border-line-strong hover:text-ink",
            )}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer ? (
          <div
            className={cn(
              "flex items-center gap-3 border-t px-5 py-3",
              dark
                ? "border-white/10 bg-[#16130F]"
                : "border-line bg-paper",
            )}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Split-modal body layout (sticky left rail + scrollable right). */
export function ModalSplit({
  rail,
  children,
  className,
}: {
  rail: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "-mx-5 -my-5 grid min-h-[480px] grid-cols-[340px_1fr]",
        className,
      )}
    >
      <aside className="overflow-y-auto border-r border-line bg-k-bg-2 p-5">
        {rail}
      </aside>
      <section className="overflow-y-auto bg-paper p-5">{children}</section>
    </div>
  );
}
