// Pass 88 — Asset Library V1: Sayfa.
//
// Operatör tüm üretilmiş görselleri tek bir yerden bulur, filtreler ve
// gezinir. Her card'dan job/batch/template/parent lineage'a geçiş var.
//
// Sözleşme:
//   /admin/midjourney/library?variantKind=...&batchId=...&templateId=...
//      &parentAssetId=...&days=...&q=...&cursorId=...
//
// Server component (auth'lı; user-scope listLibraryAssets içinde).
//
// IA:
//   - Header: Library başlığı + summary chip'leri (recent7d + variantKind
//     breakdown)
//   - LibraryFilters (chip'ler + search)
//   - LibraryGrid (card'lar)
//   - Pagination footer (load more / önceki sayfa link'i)

import Link from "next/link";
import { redirect } from "next/navigation";
import type { MJVariantKind } from "@prisma/client";
import { auth } from "@/server/auth";
import {
  listLibraryAssets,
  getLibrarySummary,
} from "@/server/services/midjourney/library";
import { LibraryFilters } from "./LibraryFilters";
import { LibraryCard } from "./LibraryCard";
import { VARIANT_KIND_META } from "./variantKindHelper";

type SearchParams = {
  variantKind?: string;
  batchId?: string;
  templateId?: string;
  parentAssetId?: string;
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

export default async function AdminMidjourneyLibraryPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = session.user.id;

  const variantKind = parseVariant(searchParams?.variantKind);
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
      dayFilter,
      search,
      cursorId,
    }),
    getLibrarySummary(userId),
  ]);

  // Build "load more" URL — preserve filters, set new cursor.
  const sp = new URLSearchParams();
  if (variantKind) sp.set("variantKind", variantKind);
  if (batchId) sp.set("batchId", batchId);
  if (templateId) sp.set("templateId", templateId);
  if (parentAssetId) sp.set("parentAssetId", parentAssetId);
  if (dayFilter !== "recent") sp.set("days", dayFilter);
  if (search) sp.set("q", search);
  if (page.nextCursor) sp.set("cursorId", page.nextCursor);
  const nextHref = page.nextCursor
    ? `/admin/midjourney/library?${sp.toString()}`
    : null;

  const isFirstPage = !cursorId;
  const totalLabel =
    page.totalCount === -1
      ? "1000+"
      : page.totalCount.toLocaleString("tr-TR");

  return (
    <main
      className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4"
      data-testid="mj-library-page"
    >
      <header className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h1 className="text-base font-semibold">Asset Library</h1>
          <Link
            href="/admin/midjourney"
            className="text-xs text-text-muted underline hover:text-accent"
          >
            ← Control Center
          </Link>
        </div>
        <p className="text-xs text-text-muted">
          Üretilen tüm görseller. Tür/tarih/batch/template/parent ile filtrele,
          card&apos;dan job/batch/template/lineage&apos;a geç.
        </p>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span
            className="rounded bg-surface-2 px-2 py-1 font-mono text-text-muted"
            data-testid="mj-library-summary-recent"
          >
            Son 7 gün: <strong className="text-text">{summary.recent7d}</strong>
          </span>
          {(["GRID", "UPSCALE", "VARIATION", "DESCRIBE"] as MJVariantKind[]).map(
            (k) => {
              const meta = VARIANT_KIND_META[k];
              const count = summary.byVariantKind[k];
              if (count === 0) return null;
              return (
                <span
                  key={k}
                  className="rounded bg-surface-2 px-2 py-1 font-mono text-text-muted"
                  data-testid={`mj-library-summary-${k.toLowerCase()}`}
                  title={meta.hint}
                >
                  {meta.label}: <strong className="text-text">{count}</strong>
                </span>
              );
            },
          )}
        </div>
      </header>

      <LibraryFilters />

      <section
        className="flex flex-col gap-3"
        data-testid="mj-library-results"
      >
        <div className="flex items-center justify-between text-xs text-text-muted">
          <span>
            Sonuç: <strong className="text-text">{totalLabel}</strong>
            {!isFirstPage ? " · sonraki sayfa" : ""}
          </span>
          {!isFirstPage ? (
            <Link
              href={`/admin/midjourney/library?${(() => {
                const back = new URLSearchParams(sp.toString());
                back.delete("cursorId");
                return back.toString();
              })()}`}
              className="text-xs text-accent underline hover:no-underline"
            >
              ← İlk sayfaya dön
            </Link>
          ) : null}
        </div>

        {page.cards.length === 0 ? (
          <div
            className="rounded-md border border-dashed border-border bg-surface-2 p-8 text-center text-sm text-text-muted"
            data-testid="mj-library-empty"
          >
            {batchId || templateId || parentAssetId || search || variantKind
              ? "Bu filtrelerle eşleşen asset bulunamadı. Filtreleri temizleyin veya tarih aralığını genişletin."
              : "Henüz Library&apos;de asset yok. İlk batch&apos;i çalıştırdığınızda burada görünür."}
          </div>
        ) : (
          <div
            className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
            data-testid="mj-library-grid"
          >
            {page.cards.map((card) => (
              <LibraryCard key={card.midjourneyAssetId} card={card} />
            ))}
          </div>
        )}

        {nextHref ? (
          <div className="flex justify-center pt-2">
            <Link
              href={nextHref}
              className="rounded-md border border-border bg-bg px-4 py-2 text-xs text-text-muted transition hover:border-accent hover:text-accent"
              data-testid="mj-library-next-page"
            >
              Daha fazla yükle →
            </Link>
          </div>
        ) : null}
      </section>
    </main>
  );
}
