"use client";

/**
 * Phase 43 — Batch compose surface scaffold.
 *
 * v7 d2a/d2b A6 modal'ının page-form factor equivalent'i. Bu turun
 * vertical slice scope'u:
 *   - Source reference rail (items grid) — operatör hangi reference'ın
 *     batch'e dahil olduğunu görür
 *   - Compose form scaffold (Provider · Aspect · Quality · Count ·
 *     Style note) — placeholder; Phase 44'te legacy
 *     /references/[id]/variations form'unun gerçek mutation'ı buraya
 *     taşınır
 *   - Footer: Cancel + primary "Launch Batch" (Phase 44 placeholder)
 *
 * Kivasy DS: paper bg, k-card recipe, font-mono caption, k-btn--primary.
 * Yeni recipe icat edilmez.
 */

import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { AssetImage } from "@/components/ui/asset-image";

type BatchComposeData = {
  id: string;
  label: string | null;
  state: string;
  items: {
    id: string;
    position: number;
    reference: {
      id: string;
      asset: { id: string } | null;
      productType: { id: string; displayName: string } | null;
      bookmark: { title: string | null } | null;
    };
  }[];
};

export function BatchComposeClient({ batch }: { batch: BatchComposeData }) {
  return (
    <div
      className="flex h-full flex-col bg-paper"
      data-testid="batch-compose"
      data-batch-id={batch.id}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-line bg-paper px-6 py-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/batches"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-k-bg hover:text-ink"
            aria-label="Back to Batches"
            data-testid="batch-compose-back"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
          </Link>
          <div className="min-w-0">
            <h1
              className="truncate text-[16px] font-semibold text-ink"
              data-testid="batch-compose-title"
            >
              {batch.label ?? "Untitled batch"}
            </h1>
            <div className="mt-0.5 flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
              <span data-testid="batch-compose-state">{batch.state}</span>
              <span aria-hidden>·</span>
              <span>BATCH {batch.id.slice(0, 8).toUpperCase()}</span>
              <span aria-hidden>·</span>
              <span data-testid="batch-compose-item-count">
                {batch.items.length} reference
                {batch.items.length === 1 ? "" : "s"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Body — two-column split */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Source reference rail */}
        <aside
          className="w-72 flex-shrink-0 overflow-y-auto border-r border-line-soft bg-k-bg-2/30 p-4"
          data-testid="batch-compose-rail"
        >
          <div className="mb-3 font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
            Source references
          </div>
          {batch.items.length === 0 ? (
            <div className="rounded-md border border-line-soft bg-paper px-3 py-4 text-[12px] text-ink-3">
              No references in this batch yet. Go back to References and
              click <span className="font-medium text-ink">New Batch</span>{" "}
              on a card to add the first reference.
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {batch.items.map((item) => (
                <li
                  key={item.id}
                  className="k-card overflow-hidden"
                  data-testid="batch-compose-rail-item"
                >
                  <div className="flex items-center gap-2 p-2">
                    <div className="k-thumb !w-12 !aspect-square flex-shrink-0">
                      {item.reference.asset ? (
                        <AssetImage
                          assetId={item.reference.asset.id}
                          alt={item.reference.bookmark?.title ?? "Reference"}
                          frame={false}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] text-ink-3">
                          No image
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12.5px] font-medium leading-tight text-ink">
                        {item.reference.bookmark?.title ?? "Untitled"}
                      </div>
                      {item.reference.productType ? (
                        <div className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-meta text-ink-3">
                          {item.reference.productType.displayName}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* Right: Compose form */}
        <main className="flex-1 overflow-y-auto px-8 py-6">
          <div className="mx-auto max-w-[640px]">
            <div className="mb-1 text-[18px] font-semibold text-ink">
              Compose this batch
            </div>
            <p className="mb-6 text-[13px] text-ink-2">
              Set the variation parameters that apply to every reference in
              this batch. The launch step is coming in Phase 44 — for now
              this page persists the draft and shows the source rail.
            </p>

            {/* Phase 43 — Form scaffold. Phase 44'te legacy
             * /references/[id]/variations form'unun gerçek mutation'ı
             * (useCreateVariations + cost confirm + partial failure)
             * buraya taşınır. Şu an placeholder kontrolleri DS-tone
             * render eder ama submit YOK. */}
            <div
              className="flex flex-col gap-6"
              data-testid="batch-compose-form-scaffold"
            >
              <Section label="Aspect ratio">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Square", sub: "1:1", active: true },
                    { label: "Landscape", sub: "3:2", active: false },
                    { label: "Portrait", sub: "2:3", active: false },
                  ].map((r) => (
                    <div
                      key={r.label}
                      className={
                        "flex flex-col items-center justify-center gap-1.5 rounded-md border-2 px-2 py-4 " +
                        (r.active
                          ? "border-k-orange bg-k-orange-soft/30"
                          : "border-line bg-paper")
                      }
                    >
                      <div className="text-[12.5px] font-semibold text-ink">
                        {r.label}
                      </div>
                      <div className="font-mono text-[10.5px] text-ink-3">
                        {r.sub}
                      </div>
                    </div>
                  ))}
                </div>
              </Section>

              <Section label="Variation count">
                <div className="flex">
                  {[4, 6, 8, 12].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={
                        "-ml-px h-10 flex-1 border border-line text-[13px] font-semibold first:ml-0 first:rounded-l-md last:rounded-r-md " +
                        (n === 8
                          ? "z-10 relative border-k-orange bg-k-orange-soft text-k-orange-ink"
                          : "bg-paper text-ink-2")
                      }
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </Section>

              <Section label="Prompt template" hint="Optional · advanced">
                <div className="flex items-center gap-3 rounded-md border border-line bg-paper px-3 py-2.5 text-[13px] text-ink-3">
                  <span className="flex-1">
                    No template selected · prompt will follow batch defaults
                  </span>
                </div>
              </Section>
            </div>
          </div>
        </main>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 border-t border-line bg-paper px-6 py-3.5">
        <Link
          href="/batches"
          className="k-btn k-btn--ghost"
          data-size="sm"
          data-testid="batch-compose-cancel"
        >
          Cancel
        </Link>
        <button
          type="button"
          className="k-btn k-btn--primary"
          data-size="sm"
          disabled
          title="Launch is wired in Phase 44. Compose parameters scaffold above."
          data-testid="batch-compose-launch"
        >
          <Sparkles className="h-3 w-3" aria-hidden />
          Launch Batch · coming Phase 44
        </button>
      </div>
    </div>
  );
}

function Section({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2.5 flex items-baseline justify-between">
        <label className="text-[13px] font-semibold text-ink">{label}</label>
        {hint ? (
          <span className="font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
            {hint}
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}
