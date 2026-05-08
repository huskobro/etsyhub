// Pass 89 — Batch Review Studio V1: Sayfa.
//
// Sözleşme:
//   /admin/midjourney/batches/[batchId]/review?decision=...&variantKind=...&cursorId=...
//
// IA:
//   - Header: batch ID + batch counts (Bekliyor/Tutuldu/Reddedildi)
//             + progress bar (kept+rejected / total)
//             + breadcrumb (← Batch detail)
//   - ReviewFilters (decision chips + variant chips + bulk reset)
//   - ReviewKeyboard (global 1/2/3 shortcuts)
//   - Grid: ReviewCard'lar
//   - Footer: load-more

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  MJReviewDecision,
  MJVariantKind,
  type Prisma,
} from "@prisma/client";
import { auth } from "@/server/auth";
import { Button } from "@/components/ui/Button";
import {
  getBatchReviewSummary,
  listBatchReviewItems,
} from "@/server/services/midjourney/review";
import { ReviewCard } from "./ReviewCard";
import { ReviewFilters } from "./ReviewFilters";
import { ReviewKeyboard } from "./ReviewKeyboard";

type SearchParams = {
  decision?: string;
  variantKind?: string;
  cursorId?: string;
};

function parseDecision(d: string | undefined): MJReviewDecision[] {
  if (!d || d === "undecided") return [MJReviewDecision.UNDECIDED];
  if (d === "kept") return [MJReviewDecision.KEPT];
  if (d === "rejected") return [MJReviewDecision.REJECTED];
  if (d === "all")
    return [
      MJReviewDecision.UNDECIDED,
      MJReviewDecision.KEPT,
      MJReviewDecision.REJECTED,
    ];
  return [MJReviewDecision.UNDECIDED];
}

function parseVariant(v: string | undefined): MJVariantKind | undefined {
  if (!v || v === "all") return undefined;
  if (v === "GRID" || v === "UPSCALE" || v === "VARIATION" || v === "DESCRIBE") {
    return v as MJVariantKind;
  }
  return undefined;
}

export default async function BatchReviewPage({
  params,
  searchParams,
}: {
  params: { batchId: string };
  searchParams?: SearchParams;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = session.user.id;

  const batchId = params.batchId;
  const decisions = parseDecision(searchParams?.decision);
  const variantKind = parseVariant(searchParams?.variantKind);
  const cursorId = (searchParams?.cursorId ?? "").trim() || undefined;

  const [summary, page] = await Promise.all([
    getBatchReviewSummary(batchId, userId),
    listBatchReviewItems(batchId, userId, {
      decisions,
      variantKind,
      cursorId,
      limit: 60,
    }),
  ]);

  if (!summary) {
    notFound();
  }

  // Build "load more" URL
  const sp = new URLSearchParams();
  if (searchParams?.decision && searchParams.decision !== "undecided") {
    sp.set("decision", searchParams.decision);
  }
  if (variantKind) sp.set("variantKind", variantKind);
  if (page.nextCursor) sp.set("cursorId", page.nextCursor);
  const nextHref = page.nextCursor
    ? `/admin/midjourney/batches/${batchId}/review?${sp.toString()}`
    : null;

  const total = summary.total;
  const decided = summary.counts.kept + summary.counts.rejected;
  const progressPct = total > 0 ? Math.round((decided / total) * 100) : 0;
  const resetableCount = summary.counts.kept + summary.counts.rejected;

  // Decision chip için aktif label (current state)
  const currentDecisionKey = searchParams?.decision ?? "undecided";

  return (
    <main
      className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4"
      data-testid="mj-review-page"
    >
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
          <Link
            href={`/admin/midjourney/batches/${batchId}`}
            className="hover:text-text"
          >
            ← Batch detail
          </Link>
          <span>·</span>
          <Link href="/admin/midjourney" className="hover:text-text">
            Control Center
          </Link>
          <span>·</span>
          <Link href="/admin/midjourney/library" className="hover:text-accent">
            🖼 Library
          </Link>
        </div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-base font-semibold">Batch Review Studio</h1>
            <p className="mt-1 text-xs text-text-muted">
              Batch{" "}
              <code className="rounded bg-surface-2 px-1 py-0.5 font-mono">
                {batchId.slice(0, 12)}…
              </code>
              {summary.promptTemplate ? (
                <>
                  {" "}
                  ·{" "}
                  <span title={summary.promptTemplate}>
                    {summary.promptTemplate.slice(0, 60)}
                    {summary.promptTemplate.length > 60 ? "…" : ""}
                  </span>
                </>
              ) : null}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            {summary.templateId ? (
              <Link
                href={`/admin/midjourney/templates/${summary.templateId}`}
              >
                <Button variant="ghost" size="sm">
                  Template →
                </Button>
              </Link>
            ) : null}
            {/* Pass 90 — Kept Workspace entry: bu batch'in kept'leri */}
            {summary.counts.kept > 0 ? (
              <Link
                href={`/admin/midjourney/kept?batchId=${batchId}`}
              >
                <Button variant="primary" size="sm">
                  ✓ Handoff ({summary.counts.kept}) →
                </Button>
              </Link>
            ) : null}
            <Link
              href={`/admin/midjourney/library?batchId=${batchId}&days=all`}
            >
              <Button variant="ghost" size="sm">
                Library&apos;de aç →
              </Button>
            </Link>
          </div>
        </div>

        {/* Progress + counts */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span
              className="rounded bg-surface-2 px-2 py-1 font-mono"
              data-testid="mj-review-count-undecided"
            >
              Bekliyor:{" "}
              <strong className="text-text">{summary.counts.undecided}</strong>
            </span>
            <span
              className="rounded bg-success-soft px-2 py-1 font-mono text-success"
              data-testid="mj-review-count-kept"
            >
              Tutuldu: <strong>{summary.counts.kept}</strong>
            </span>
            <span
              className="rounded bg-danger-soft px-2 py-1 font-mono text-danger"
              data-testid="mj-review-count-rejected"
            >
              Reddedildi: <strong>{summary.counts.rejected}</strong>
            </span>
            <span className="rounded bg-surface-2 px-2 py-1 font-mono text-text-muted">
              Toplam: <strong className="text-text">{total}</strong>
            </span>
            <span
              className="ml-auto text-text-muted"
              data-testid="mj-review-progress"
            >
              {decided}/{total} karar verildi · %{progressPct}
            </span>
          </div>
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2"
            role="progressbar"
            aria-valuenow={progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Review progress"
          >
            {/* Tailwind arbitrary value `w-[X%]` yasak; dinamik progress
                için kasıtlı inline-style escape hatch (RolloutBar
                pattern'i, Pass 89 2. tüketici). 3. tüketici gelirse
                progress-bar primitive'i `src/components/ui/`'a terfi
                edilir; sözleşme: percent (0-100). */}
            <div
              className="h-full bg-accent transition-all"
              // eslint-disable-next-line no-restricted-syntax
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </header>

      <ReviewFilters batchId={batchId} resetableCount={resetableCount} />
      <ReviewKeyboard />

      <section
        className="flex flex-col gap-3"
        data-testid="mj-review-results"
      >
        {page.items.length === 0 ? (
          <div
            className="rounded-md border border-dashed border-border bg-surface-2 p-8 text-center text-sm text-text-muted"
            data-testid="mj-review-empty"
          >
            {currentDecisionKey === "undecided"
              ? "🎉 Bu batch'te bekleyen karar kalmadı. Filtreleri değiştirip diğer kararlara bakabilirsin."
              : "Bu filtrelerle eşleşen asset bulunamadı."}
          </div>
        ) : (
          <div
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
            data-testid="mj-review-grid"
          >
            {page.items.map((item) => (
              <ReviewCard key={item.midjourneyAssetId} item={item} />
            ))}
          </div>
        )}

        {nextHref ? (
          <div className="flex justify-center pt-2">
            <Link
              href={nextHref}
              className="rounded-md border border-border bg-bg px-4 py-2 text-xs text-text-muted transition hover:border-accent hover:text-accent"
              data-testid="mj-review-next-page"
            >
              Daha fazla yükle →
            </Link>
          </div>
        ) : null}
      </section>
    </main>
  );
}
