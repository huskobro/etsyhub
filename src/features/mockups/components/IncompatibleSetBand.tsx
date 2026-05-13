"use client";

// Phase 8 Task 25 — IncompatibleSetBand.
// Phase 55 — EN parity + Kivasy DS migration.
//
// Spec §5.2 — Uyumsuzluk uyarı bandı.
// Set'in aspectRatio'su hiçbir template ile match etmiyorsa gösterilir.
//
// Kullanım:
// - PackPreviewCard'ın üstünde, warning durumunda
// - k-amber warning tone

import { AlertTriangle } from "lucide-react";

export function IncompatibleSetBand() {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning-soft/40 px-4 py-3"
      data-testid="mockup-incompatible-set-band"
    >
      <AlertTriangle
        className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning"
        aria-hidden
      />
      <div className="flex-1 text-sm text-ink">
        <p className="font-medium leading-tight">
          No compatible mockup templates for this set
        </p>
        <p className="mt-1 font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
          Use Custom Selection to pick a template manually.
        </p>
      </div>
    </div>
  );
}
