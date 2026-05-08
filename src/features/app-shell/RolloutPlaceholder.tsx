import { Construction } from "lucide-react";
import Link from "next/link";

/**
 * Rollout-1 placeholder for surfaces that ship in later rollouts.
 *
 * The sidebar already lists all 8 IA items so operators see the final shape;
 * routes that haven't been ported yet render this calm placeholder with a
 * pointer to the implementation handoff doc.
 *
 * Replace per-rollout: rollout-2 fills /library, rollout-3 fills /batches,
 * rollout-4 fills /selections, rollout-5 fills /products, rollout-6 fills
 * /references, rollout-7 fills /templates + /settings, rollout-8 fills
 * /overview.
 */
export function RolloutPlaceholder({
  title,
  rollout,
  blurb,
}: {
  title: string;
  rollout: number;
  blurb?: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-md border border-line bg-paper text-ink-3">
        <Construction className="h-5 w-5" aria-hidden />
      </div>
      <h1 className="k-display text-2xl font-semibold text-ink">{title}</h1>
      <p className="mt-3 max-w-state-body text-sm text-text-muted">
        {blurb ??
          `This surface is part of the Kivasy production omurgası and lands in implementation rollout ${rollout}. The shell, tokens, and navigation are already wired up.`}
      </p>
      {/* eslint-disable-next-line no-restricted-syntax */}
      <div className="mt-6 font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
        Implementation rollout · R{rollout}
      </div>
      <Link
        href="/overview"
        className="mt-8 font-mono text-xs text-k-orange-ink hover:underline"
      >
        ← back to overview
      </Link>
    </div>
  );
}
