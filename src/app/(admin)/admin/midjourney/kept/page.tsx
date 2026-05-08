// Pass 90 — Kept Assets Workspace / Handoff Studio V1 — Sayfa.
//
// Sözleşme:
//   /admin/midjourney/kept?batchId=...&templateId=...&variantKind=...
//      &q=...&cursorId=...
//
// IA:
//   - Header: breadcrumb (← Control Center · 🖼 Library · Review)
//   - Summary: total kept + already promoted + batch group chip'leri
//             (her batch chip'i `?batchId=X` filter'a tıklanabilir)
//   - KeptFilters: variant chips + search + scope
//   - KeptWorkspace: toolbar + grid + sticky HandoffPanel
//   - Footer: load-more

import Link from "next/link";
import { redirect } from "next/navigation";
import type { MJVariantKind } from "@prisma/client";
import { auth } from "@/server/auth";
import {
  listKeptAssets,
  getKeptWorkspaceSummary,
} from "@/server/services/midjourney/kept";
import { KeptFilters } from "./KeptFilters";
import { KeptWorkspace } from "./KeptWorkspace";

type SearchParams = {
  batchId?: string;
  templateId?: string;
  variantKind?: string;
  q?: string;
  cursorId?: string;
};

const VALID_VARIANTS: ReadonlyArray<MJVariantKind> = [
  "GRID",
  "UPSCALE",
  "VARIATION",
  "DESCRIBE",
];

function parseVariant(v: string | undefined): MJVariantKind | undefined {
  if (!v || v === "all") return undefined;
  return (VALID_VARIANTS as ReadonlyArray<string>).includes(v)
    ? (v as MJVariantKind)
    : undefined;
}

export default async function KeptWorkspacePage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = session.user.id;

  const variantKind = parseVariant(searchParams?.variantKind);
  const batchId = (searchParams?.batchId ?? "").trim() || undefined;
  const templateId = (searchParams?.templateId ?? "").trim() || undefined;
  const search = (searchParams?.q ?? "").trim() || undefined;
  const cursorId = (searchParams?.cursorId ?? "").trim() || undefined;

  const [page, summary] = await Promise.all([
    listKeptAssets(userId, {
      batchId,
      templateId,
      variantKind,
      search,
      cursorId,
    }),
    getKeptWorkspaceSummary(userId),
  ]);

  // Build "load more" URL
  const sp = new URLSearchParams();
  if (batchId) sp.set("batchId", batchId);
  if (templateId) sp.set("templateId", templateId);
  if (variantKind) sp.set("variantKind", variantKind);
  if (search) sp.set("q", search);
  if (page.nextCursor) sp.set("cursorId", page.nextCursor);
  const nextHref = page.nextCursor
    ? `/admin/midjourney/kept?${sp.toString()}`
    : null;

  const isFirstPage = !cursorId;

  return (
    <main
      className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4"
      data-testid="mj-kept-page"
    >
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3 text-xs text-text-muted">
          <Link href="/admin/midjourney" className="hover:text-text">
            ← Control Center
          </Link>
          <span>·</span>
          <Link href="/admin/midjourney/library" className="hover:text-text">
            🖼 Library
          </Link>
          <span>·</span>
          <Link href="/admin/midjourney/batches" className="hover:text-text">
            📦 Batches
          </Link>
        </div>

        <div>
          <h1 className="text-base font-semibold">
            Kept Assets — Handoff Studio
          </h1>
          <p className="mt-1 text-xs text-text-muted">
            Batch Review&apos;da Tutuldu kararı verilen asset&apos;ler. Toplu
            seç, Reference + ProductType ile SelectionSet&apos;e gönder.
            Sonraki adım Mockup ve Listing.
          </p>
        </div>

        {/* Summary chip'leri */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span
            className="rounded bg-surface-2 px-2 py-1 font-mono text-text-muted"
            data-testid="mj-kept-summary-total"
          >
            Toplam Kept:{" "}
            <strong className="text-text">{summary.totalKept}</strong>
          </span>
          {summary.totalAlreadyPromoted > 0 ? (
            <span
              className="rounded bg-info-soft px-2 py-1 font-mono text-info"
              data-testid="mj-kept-summary-promoted"
              title="GeneratedDesign'a daha önce promote edilmiş"
            >
              ↗ Promote edilmiş:{" "}
              <strong>{summary.totalAlreadyPromoted}</strong>
            </span>
          ) : null}
        </div>

        {/* Batch group chip'leri — her biri filter link'i */}
        {summary.byBatch.length > 0 ? (
          <div
            className="flex flex-col gap-1.5 rounded-md border border-border bg-surface p-3"
            data-testid="mj-kept-batches"
          >
            <span className="text-xs font-semibold text-text-muted">
              Batch dağılımı ({summary.byBatch.length} batch&apos;ten gelmiş)
            </span>
            <div className="flex flex-wrap gap-2">
              {summary.byBatch.slice(0, 12).map((b) => {
                const active = batchId === b.batchId;
                return (
                  <Link
                    key={b.batchId}
                    href={
                      active
                        ? "/admin/midjourney/kept"
                        : `/admin/midjourney/kept?batchId=${b.batchId}`
                    }
                    className={
                      "flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs transition " +
                      (active
                        ? "border-accent bg-accent text-on-accent font-semibold"
                        : "border-border bg-bg text-text-muted hover:border-border-strong hover:text-text")
                    }
                    data-testid={`mj-kept-batch-chip-${b.batchId.slice(0, 8)}`}
                    title={b.promptTemplatePreview ?? "(inline)"}
                  >
                    <span className="font-mono">
                      {b.batchId.slice(0, 8)}
                    </span>
                    <span className="font-semibold">·</span>
                    <span>{b.count}</span>
                    {active ? <span>✕</span> : null}
                  </Link>
                );
              })}
              {summary.byBatch.length > 12 ? (
                <span className="text-xs text-text-muted">
                  …ve {summary.byBatch.length - 12} batch daha
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
      </header>

      <KeptFilters />

      <section
        className="flex flex-col gap-3"
        data-testid="mj-kept-results"
      >
        <div className="flex items-center justify-between text-xs text-text-muted">
          <span>
            Sayfa: <strong className="text-text">{page.cards.length}</strong>{" "}
            asset
            {!isFirstPage ? " · sonraki sayfa" : ""}
          </span>
          {!isFirstPage ? (
            <Link
              href={`/admin/midjourney/kept?${(() => {
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
            data-testid="mj-kept-empty"
          >
            {summary.totalKept === 0 ? (
              <>
                Henüz Tutuldu kararı verilmiş asset yok.{" "}
                <Link
                  href="/admin/midjourney/batches"
                  className="text-accent underline"
                >
                  Bir batch&apos;i review et
                </Link>{" "}
                ve KEPT kararı ver.
              </>
            ) : (
              <>
                Bu filtrelerle eşleşen asset bulunamadı. Filtreleri değiştir
                veya scope chip&apos;ini temizle.
              </>
            )}
          </div>
        ) : (
          <KeptWorkspace cards={page.cards} />
        )}

        {nextHref ? (
          <div className="flex justify-center pt-2">
            <Link
              href={nextHref}
              className="rounded-md border border-border bg-bg px-4 py-2 text-xs text-text-muted transition hover:border-accent hover:text-accent"
              data-testid="mj-kept-next-page"
            >
              Daha fazla yükle →
            </Link>
          </div>
        ) : null}
      </section>
    </main>
  );
}
