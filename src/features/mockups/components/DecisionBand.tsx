"use client";

// Phase 8 Task 25 — DecisionBand.
//
// Spec §5.2 Zone 4: Sticky karar bandı.
//
// Gösterilenler:
//   - Tahmini süre (selectedTemplateIds.length * 5s uydu)
//   - Render et CTA (Pack türüne göre label)
//   - disabled durumları:
//     * noValidSelection: selectedTemplateIds.length === 0
//     * isSubmitting: render job submit sırasında
//   - Loading state (spinner)
//   - Reset link (isDirty ise; Quick Pack'e dön)
//
// Kullanım:
//   S3ApplyView Zone 4 placeholder replace (§5.2)

import { useState } from "react";

export interface DecisionBandProps {
  isQuickPack: boolean;
  selectedCount: number;
  isDirty: boolean;
  isSubmitting?: boolean;
  onSubmit: () => Promise<void>;
  onReset: () => void;
}

/**
 * Spec §5.2 Zone 4 — Sticky karar bandı.
 *
 * ETA: selectedCount * 5 saniye uydusu
 * Submit state: 3 state (enabled | loading | disabled-empty)
 */
export function DecisionBand({
  isQuickPack,
  selectedCount,
  isDirty,
  isSubmitting = false,
  onSubmit,
  onReset,
}: DecisionBandProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);

  const estimatedMs = selectedCount * 5000;
  const estimatedSec = Math.ceil(estimatedMs / 1000);
  const estimatedLabel =
    estimatedSec < 60
      ? `~${estimatedSec} saniye`
      : `~${Math.ceil(estimatedSec / 60)} dakika`;

  const noValidSelection = selectedCount === 0;
  const isDisabled = noValidSelection || isSubmitting;

  const handleSubmit = async () => {
    try {
      setSubmitError(null);
      await onSubmit();
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Bilinmeyen bir hata oluştu",
      );
    }
  };

  return (
    <footer className="sticky bottom-0 border-t border-border bg-white px-6 py-3">
      <div className="space-y-3">
        {/* Error message (if any) */}
        {submitError && (
          <div className="rounded-md bg-red-50 px-3 py-2">
            <p className="text-xs font-medium text-red-700">{submitError}</p>
          </div>
        )}

        {/* Controls row */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-text-muted">
              Estimated time: {estimatedLabel}
            </p>
            {isDirty && (
              <button
                type="button"
                onClick={onReset}
                className="text-xs text-accent hover:underline"
              >
                Reset to Quick pack
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isDisabled}
            className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              isDisabled
                ? "cursor-not-allowed bg-zinc-200 text-zinc-500"
                : "bg-zinc-900 text-white hover:bg-zinc-800"
            }`}
          >
            {isSubmitting && (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
            )}
            <span>
              Render ({isQuickPack ? "Quick pack" : "Custom pack"})
            </span>
          </button>
        </div>

        {/* Warning: no selection */}
        {noValidSelection && (
          <p className="text-xs text-amber-700">
            Seçilmiş şablon yok. Lütfen en az bir şablon seçiniz.
          </p>
        )}
      </div>
    </footer>
  );
}
