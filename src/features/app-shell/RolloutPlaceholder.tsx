import { Construction } from "lucide-react";
import Link from "next/link";

/**
 * Placeholder shell for surfaces deferred to post-MVP enrichment.
 *
 * MVP omurgası (Library / Batches / Selections / Products / Templates /
 * Settings) canlıdır; bu placeholder yalnızca Overview C3 rework'u ve
 * benzeri post-MVP surface'lar için kullanılır. `rollout` prop'u
 * geriye dönük uyumluluk için kalır ama UI'da görünmez.
 */
export function RolloutPlaceholder({
  title,
  rollout: _rollout,
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
          `This surface lands in post-MVP enrichment. The shell, tokens, and navigation are wired up; the data view will replace this placeholder.`}
      </p>
      {/* eslint-disable-next-line no-restricted-syntax */}
      <div className="mt-6 font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
        Post-MVP enrichment
      </div>
      <Link
        href="/library"
        className="mt-8 font-mono text-xs text-k-orange-ink hover:underline"
      >
        ← Library
      </Link>
    </div>
  );
}
