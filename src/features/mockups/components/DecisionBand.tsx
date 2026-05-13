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
        error instanceof Error ? error.message : "Unexpected error",
      );
    }
  };

  return (
    /* Phase 56 — DS migration + EN parity.
     *   - border-border bg-white → border-line bg-paper
     *   - bg-red-50 text-red-700 → border-danger/40 bg-danger/5 text-danger
     *   - text-text-muted → text-ink-3 (mono cap)
     *   - text-accent → text-k-orange-ink
     *   - bg-zinc-900/200 → k-btn k-btn--primary recipe (canonical DS)
     *   - text-amber-700 → text-warning + warning-soft container
     *   - "Bilinmeyen bir hata oluştu" → "Unexpected error"
     *   - "Seçilmiş şablon yok. Lütfen en az bir şablon seçiniz." →
     *     "No templates selected. Pick at least one template to render."
     */
    <footer
      className="sticky bottom-0 border-t border-line bg-paper px-6 py-3"
      data-testid="mockup-decision-band"
    >
      <div className="space-y-3">
        {/* Error message (if any) */}
        {submitError && (
          <div
            role="alert"
            className="rounded-md border border-danger/40 bg-danger/5 px-3 py-2"
          >
            <p className="text-xs font-medium text-danger">{submitError}</p>
          </div>
        )}

        {/* Controls row */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
              Estimated time · {estimatedLabel}
            </p>
            {isDirty && (
              <button
                type="button"
                onClick={onReset}
                className="font-mono text-[10.5px] uppercase tracking-meta text-k-orange-ink hover:underline"
              >
                Reset to Quick pack
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isDisabled}
            className="k-btn k-btn--primary"
            data-size="sm"
            data-testid="mockup-decision-band-render"
          >
            {isSubmitting && (
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-r-transparent" />
            )}
            <span>
              Render ({isQuickPack ? "Quick pack" : "Custom pack"})
            </span>
          </button>
        </div>

        {/* Warning: no selection */}
        {noValidSelection && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning-soft/40 px-3 py-2"
          >
            <span
              className="mt-1 inline-flex h-1.5 w-1.5 flex-shrink-0 rounded-full bg-warning"
              aria-hidden
            />
            <p className="text-xs text-ink-2">
              No templates selected. Pick at least one template to render.
            </p>
          </div>
        )}
      </div>
    </footer>
  );
}
