import Link from "next/link";
import { CollectionCard } from "@/features/collections/components/collection-card";

/**
 * RecentCollectionsGrid — T-31.
 *
 * Alt blok: Son koleksiyonlar (4 kart grid). CollectionCard primitive
 * tüketilir (T-16'da migre edildi); yeni primitive yazılmaz.
 *
 * Carry-forward not: TrendCluster modeli + scraper job geldiğinde Yükselen
 * Trendler bu yerleşime taşınır; CollectionCard yerine TrendCard varyantı
 * yazılır. (dashboard-widgets.md kararı)
 */

export interface DashboardCollection {
  id: string;
  name: string;
  kind: "BOOKMARK" | "REFERENCE" | "MIXED";
  createdAt: Date;
  updatedAt?: Date;
  _count: { bookmarks: number; references: number };
  thumbnailAssetIds?: string[];
}

const SLOT_COUNT = 4;

export function RecentCollectionsGrid({
  collections,
}: {
  collections: DashboardCollection[];
}) {
  const top = collections.slice(0, SLOT_COUNT);

  return (
    <section
      className="flex flex-col gap-3"
      data-testid="recent-collections-grid"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text">Son koleksiyonlar</h2>
        <Link href="/collections" className="text-xs text-accent hover:underline">
          Tümü
        </Link>
      </div>
      {top.length === 0 ? (
        <p className="text-sm text-text-muted">Koleksiyon henüz yok.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {top.map((collection) => (
            <CollectionCard
              key={collection.id}
              collection={{
                id: collection.id,
                name: collection.name,
                kind: collection.kind,
                createdAt: collection.createdAt.toISOString(),
                updatedAt: collection.updatedAt?.toISOString(),
                _count: collection._count,
                thumbnailAssetIds: collection.thumbnailAssetIds,
              }}
            />
          ))}
        </div>
      )}
    </section>
  );
}
