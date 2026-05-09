import { redirect } from "next/navigation";
import type { MJReviewDecision, MJVariantKind } from "@prisma/client";
import { auth } from "@/server/auth";
import {
  listLibraryAssets,
  getLibrarySummary,
} from "@/server/services/midjourney/library";
import { LibraryClient } from "@/features/library/components/LibraryClient";
import { KivasyMark } from "@/components/ui/KivasyMark";

/**
 * /library — Kivasy A1 Library (rollout-2 implementation).
 *
 * Source: docs/design-system/kivasy/ui_kits/kivasy/v4/screens-a1-a2.jsx →
 * A1Library. Service layer reused from legacy /admin/midjourney/library —
 * `listLibraryAssets` + `getLibrarySummary` are user-scoped and stable.
 *
 * URL contract carried over (legacy compat):
 *   ?days=recent|7d|30d|all
 *   ?variantKind=GRID|UPSCALE|VARIATION|DESCRIBE
 *   ?reviewDecision=KEPT|UNDECIDED|REJECTED
 *   ?q=...   ?batchId=...   ?templateId=...   ?parentAssetId=...
 *   ?cursorId=...   (load more)
 *
 * Surface boundary (docs/IMPLEMENTATION_HANDOFF.md §5):
 *   Library = produced asset truth-source. NO selection set CRUD here.
 *   "Add to Selection" is a handoff CTA wired in rollout-4.
 */

type SearchParams = {
  variantKind?: string;
  batchId?: string;
  templateId?: string;
  parentAssetId?: string;
  reviewDecision?: string;
  days?: string;
  q?: string;
  cursorId?: string;
};

const VALID_VARIANTS: ReadonlyArray<MJVariantKind> = [
  "GRID",
  "UPSCALE",
  "VARIATION",
  "DESCRIBE",
];

const VALID_DAYS: ReadonlyArray<"recent" | "7d" | "30d" | "all"> = [
  "recent",
  "7d",
  "30d",
  "all",
];

function parseVariant(v: string | undefined): MJVariantKind | undefined {
  if (!v) return undefined;
  return (VALID_VARIANTS as ReadonlyArray<string>).includes(v)
    ? (v as MJVariantKind)
    : undefined;
}

function parseDays(d: string | undefined): "recent" | "7d" | "30d" | "all" {
  if (!d) return "recent";
  return (VALID_DAYS as ReadonlyArray<string>).includes(d)
    ? (d as "recent" | "7d" | "30d" | "all")
    : "recent";
}

function parseDecision(d: string | undefined): MJReviewDecision | undefined {
  if (!d) return undefined;
  if (d === "UNDECIDED" || d === "KEPT" || d === "REJECTED") {
    return d as MJReviewDecision;
  }
  return undefined;
}

export const metadata = { title: "Library · Kivasy" };

export default async function LibraryPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = session.user.id;

  const variantKind = parseVariant(searchParams?.variantKind);
  const reviewDecision = parseDecision(searchParams?.reviewDecision);
  const dayFilter = parseDays(searchParams?.days);
  const search = (searchParams?.q ?? "").trim() || undefined;
  const batchId = (searchParams?.batchId ?? "").trim() || undefined;
  const templateId = (searchParams?.templateId ?? "").trim() || undefined;
  const parentAssetId =
    (searchParams?.parentAssetId ?? "").trim() || undefined;
  const cursorId = (searchParams?.cursorId ?? "").trim() || undefined;

  const [page, summary] = await Promise.all([
    listLibraryAssets(userId, {
      variantKind,
      batchId,
      templateId,
      parentAssetId,
      reviewDecision,
      dayFilter,
      search,
      cursorId,
    }),
    getLibrarySummary(userId),
  ]);

  // Build "load more" URL — preserve filters, set new cursor.
  const sp = new URLSearchParams();
  if (variantKind) sp.set("variantKind", variantKind);
  if (reviewDecision) sp.set("reviewDecision", reviewDecision);
  if (batchId) sp.set("batchId", batchId);
  if (templateId) sp.set("templateId", templateId);
  if (parentAssetId) sp.set("parentAssetId", parentAssetId);
  if (dayFilter !== "recent") sp.set("days", dayFilter);
  if (search) sp.set("q", search);
  if (page.nextCursor) sp.set("cursorId", page.nextCursor);
  const loadMoreHref = page.nextCursor ? `/library?${sp.toString()}` : null;

  const totalLabel =
    page.totalCount === -1
      ? "1000+ items"
      : `${page.totalCount.toLocaleString("tr-TR")} items`;

  const isFiltered =
    !!batchId ||
    !!templateId ||
    !!parentAssetId ||
    !!search ||
    !!variantKind ||
    !!reviewDecision ||
    dayFilter !== "recent";

  const emptyState =
    page.cards.length === 0
      ? {
          title: isFiltered
            ? "No assets match these filters"
            : "Library is empty",
          hint: isFiltered
            ? "Clear filters or expand the date range to see more."
            : "Run your first variation batch — assets land here as soon as items succeed.",
        }
      : null;

  return (
    <div className="-m-6 flex h-screen flex-col" data-testid="library-page">
      <header className="flex items-center gap-4 border-b border-line bg-bg px-6 py-4">
        <KivasyMark size={20} idSuffix="library-header" />
        <div className="flex-1">
          <h1 className="k-display text-lg font-semibold tracking-tight text-ink">Library</h1>
          <p className="mt-0.5 font-mono text-xs uppercase tracking-meta text-ink-3">
            {summary.recent7d} added last 7 days · {totalLabel}
          </p>
        </div>
      </header>

      <LibraryClient
        cards={page.cards}
        totalLabel={totalLabel}
        emptyState={emptyState}
        loadMoreHref={loadMoreHref}
      />
    </div>
  );
}
