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
      className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
        isSelected
          ? "bg-accent text-white"
          : "bg-surface border border-border text-text hover:bg-surface-2"
      } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
    >
      {isSelected && <span>✓</span>}
      <span className="line-clamp-1">{template.name}</span>
    </button>
  );
}
