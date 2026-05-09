"use client";

import Link from "next/link";
import { ArrowRight, ImageOff } from "lucide-react";
import type { SelectionStage } from "@/features/selections/state-helpers";

/**
 * MockupsTab — B3 Mockups tab, read-only preview.
 *
 * Source: docs/design-system/kivasy/ui_kits/kivasy/v5/screens-b2-b3.jsx →
 * B3Mockups.
 *
 * Boundary (docs/IMPLEMENTATION_HANDOFF.md §5):
 *   Selections Mockups tab is READ-ONLY. Full management lives in
 *   Products/[id]/Mockups (R5). Cross-link CTA "View in Product" is the
 *   only navigation out — no mockup CRUD here.
 *
 * 3 sections preserved (per Section 6 mockup model):
 *   - Lifestyle Mockups (lifestyle context shots)
 *   - Bundle Preview Sheets ("what you'll get" composite)
 *   - My Templates (user-uploaded PSD / smart-object templates)
 *
 * R4 surface: empty-state + section headers + section grids stub. Mockup
 * data isn't yet joined here (Products schema lands in R5); we render
 * three deterministic empty cards per section so the layout — and the
 * "Read-only preview · full management in Product detail" caption —
 * matches the v5 reference.
 */

interface MockupsTabProps {
  setId: string;
  stage: SelectionStage;
}

interface Section {
  id: string;
  label: string;
  hint: string;
  count: number;
}

const SECTIONS: Section[] = [
  {
    id: "lifestyle",
    label: "Lifestyle Mockups",
    hint: "Living room · Desk surface · Nursery scene",
    count: 0,
  },
  {
    id: "bundle",
    label: "Bundle Preview Sheets",
    hint: "Sheet layout · Composite 3-up",
    count: 0,
  },
  {
    id: "user",
    label: "My Templates",
    hint: "User-uploaded PSD / smart-object templates",
    count: 0,
  },
];

export function MockupsTab({ setId, stage }: MockupsTabProps) {
  // R5 — Apply Mockups çalıştırıldıktan sonra (her stage'de) Products cross-
  // link aktiftir; Products index `?fromSelection=setId` ile filtrelenmiş
  // listing kayıtlarını gösterir. Set finalize edilmediyse (Curating/Edits)
  // henüz mockup uygulanmamıştır → link disabled tutulur.
  const productLink =
    stage === "Sent" || stage === "Mockup ready"
      ? `/products?fromSelection=${setId}`
      : null;

  return (
    <div
      className="flex-1 overflow-y-auto px-6 py-5"
      data-testid="selection-mockups-tab"
      data-set-id={setId}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="font-mono text-xs uppercase tracking-meta text-ink-3">
          Read-only preview · full management in Product detail
        </div>
        {productLink ? (
          <Link
            href={productLink}
            className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium text-ink-2 hover:text-ink"
            data-testid="selection-mockups-view-in-product"
          >
            View in Product
            <ArrowRight className="h-3 w-3" aria-hidden />
          </Link>
        ) : (
          <button
            type="button"
            disabled
            className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium text-ink-3 disabled:opacity-50"
            title="Apply Mockups first to package the set into a Product"
          >
            View in Product
            <ArrowRight className="h-3 w-3" aria-hidden />
          </button>
        )}
      </div>

      {SECTIONS.map((section) => (
        <div key={section.id} className="mb-6">
          <div className="mb-3 flex items-center gap-2">
            <h3 className="text-sm font-semibold text-ink">{section.label}</h3>
            <span className="font-mono text-xs tracking-wider text-ink-3">
              {section.count}
            </span>
          </div>
          {section.count === 0 ? (
            <div className="rounded-md border border-dashed border-line bg-paper px-6 py-8 text-center">
              <div className="mx-auto mb-2 inline-flex h-8 w-8 items-center justify-center rounded-md border border-line text-ink-3">
                <ImageOff className="h-4 w-4" aria-hidden />
              </div>
              <p className="text-sm text-text-muted">{section.hint}</p>
              <p className="mt-1 font-mono text-xs uppercase tracking-meta text-ink-3">
                Mockups appear here once applied via Product detail
              </p>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
