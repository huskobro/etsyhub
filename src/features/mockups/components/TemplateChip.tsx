"use client";

// Phase 8 Task 25 — TemplateChip.
//
// Spec §5.2 — Mockup template seçim çipi.
// PackPreviewCard + CustomPackDrawer içinde:
// - isSelected state badge
// - toggle aksiyonu
// - visual feedback

import { type MockupTemplateView } from "@/features/mockups/hooks/useMockupTemplates";

export interface TemplateChipProps {
  template: MockupTemplateView;
  isSelected: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

/**
 * Spec §5.2 Template seçim çipi.
 *
 * Quick Pack: read-only display
 * Custom Pack: interaktif toggle (Spec §6.1)
 */
export function TemplateChip({
  template,
  isSelected,
  onToggle,
  disabled = false,
}: TemplateChipProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      data-testid="mockup-template-chip"
      data-selected={isSelected || undefined}
      className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
        isSelected
          ? "border-k-orange bg-k-orange text-white"
          : "border-line bg-paper text-ink-2 hover:border-line-strong hover:bg-k-bg-2"
      } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
    >
      {isSelected && <span aria-hidden>✓</span>}
      <span className="line-clamp-1">{template.name}</span>
    </button>
  );
}
