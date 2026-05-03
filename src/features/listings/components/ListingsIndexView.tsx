"use client";

// Phase 9 V1 — /listings index view.
//
// Spec §6.2 GET /api/listings — kullanıcının listing'lerini grid'de göster.
//   - useListings({ status }) tüketimi (Phase 9 hook foundation)
//   - URL query param sync (?status=DRAFT)
//   - Loading / error / empty states (Phase 8 emsali S3ApplyView)
//   - Card click → /listings/draft/[id] (K4 lock flat path)
//
// V1 status enum (Phase 9 lock K3):
//   DRAFT, SCHEDULED, PUBLISHED, FAILED, REJECTED, NEEDS_REVIEW
// V1'de gerçekten kullanılan: DRAFT (handoff), FAILED (Etsy submit hata),
// PUBLISHED (Etsy success). Diğerleri legacy enum (forward-compatible).

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { useListings } from "@/features/listings/hooks/useListings";
import type { ListingStatusValue } from "@/features/listings/types";
import {
  LISTING_STATUS_LABELS,
  LISTING_STATUS_BADGE_CLASS,
} from "@/features/listings/ui/status-labels";

const STATUS_FILTERS: Array<{ value: ListingStatusValue | "all"; label: string }> = [
  { value: "all", label: "Tümü" },
  { value: "DRAFT", label: "Taslak" },
  { value: "PUBLISHED", label: "Yayınlanmış" },
  { value: "FAILED", label: "Başarısız" },
];

export function ListingsIndexView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const statusParam = searchParams.get("status");
  const activeStatus = (statusParam &&
    Object.keys(LISTING_STATUS_LABELS).includes(statusParam)
    ? (statusParam as ListingStatusValue)
    : null) as ListingStatusValue | null;

  const { data: listings, isLoading, error } = useListings(
    activeStatus ? { status: activeStatus } : undefined,
  );

  const setFilter = (value: ListingStatusValue | "all") => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete("status");
    } else {
      params.set("status", value);
    }
    const qs = params.toString();
    router.push(qs ? `/listings?${qs}` : "/listings", { scroll: false });
  };

  const currentFilter: ListingStatusValue | "all" = activeStatus ?? "all";

  return (
    <main className="flex min-h-screen flex-col bg-white">
      <header className="border-b border-border px-6 py-4">
        <h1 className="text-xl font-semibold text-text">Listingler</h1>
        <p className="mt-1 text-sm text-text-muted">
          Mockup pack'lerinden oluşturulan listing draft'ları ve Etsy gönderim
          durumları.
        </p>
      </header>

      {/* Filter chips */}
      <nav
        aria-label="Status filtre"
        className="flex gap-2 border-b border-border px-6 py-3"
      >
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            aria-pressed={currentFilter === f.value}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              currentFilter === f.value
                ? "bg-text text-bg"
                : "bg-surface-2 text-text-muted hover:bg-surface-3"
            }`}
          >
            {f.label}
          </button>
        ))}
      </nav>

      <div className="flex-1 px-6 py-6">
        {isLoading && (
          <div
            role="status"
            aria-live="polite"
            className="text-sm text-text-muted"
          >
            Yükleniyor…
          </div>
        )}

        {error && !isLoading && (
          <div role="alert" className="text-sm text-red-600">
            Listingler yüklenemedi: {(error as Error).message}
          </div>
        )}

        {!isLoading && !error && listings && listings.length === 0 && (
          <div className="rounded-md border border-border bg-surface-2 p-6 text-center">
            <p className="text-sm text-text-muted">
              {activeStatus
                ? `${LISTING_STATUS_LABELS[activeStatus]} durumda listing yok.`
                : "Henüz listing yok."}
            </p>
            {!activeStatus && (
              <p className="mt-2 text-xs text-text-subtle">
                Listing draft'ı oluşturmak için Mockup Studio'dan bir pack tamamla.
              </p>
            )}
          </div>
        )}

        {!isLoading && !error && listings && listings.length > 0 && (
          <ul
            aria-label="Listing kartları"
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {listings.map((listing) => (
              <li
                key={listing.id}
                className="rounded-md border border-border bg-white p-4 transition hover:border-text"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-sm font-medium text-text">
                    <Link
                      href={`/listings/draft/${listing.id}`}
                      className="hover:underline"
                    >
                      {listing.title ?? "İsimsiz draft"}
                    </Link>
                  </h2>
                  <span
                    data-testid={`listing-status-${listing.id}`}
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      LISTING_STATUS_BADGE_CLASS[listing.status]
                    }`}
                  >
                    {LISTING_STATUS_LABELS[listing.status]}
                  </span>
                </div>

                {listing.priceCents != null && (
                  <p className="mt-2 text-xs text-text-muted">
                    ${(listing.priceCents / 100).toFixed(2)}
                  </p>
                )}

                <p className="mt-3 text-xs text-text-muted">
                  Güncellendi:{" "}
                  {new Date(listing.updatedAt).toLocaleDateString("tr-TR")}
                </p>

                {/* Phase 9 V1 — PUBLISHED listing'lerde Etsy admin URL'ine
                    direkt deep-link. Outer Link kaldırıldı (nested <a>
                    HTML invalid), başlık linkine ek olarak ayrı render. */}
                {listing.status === "PUBLISHED" && listing.etsyListingId && (
                  <a
                    href={`https://www.etsy.com/your/shops/me/tools/listings/${listing.etsyListingId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs text-green-700 hover:underline"
                  >
                    Etsy'de Aç
                    <ExternalLink className="h-3 w-3" aria-hidden />
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
