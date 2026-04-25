import { db } from "@/server/db";
import { requireUser } from "@/server/session";
import { DashboardQuickActions } from "@/features/dashboard/components/dashboard-quick-actions";
import { DashboardStatRow } from "@/features/dashboard/components/stat-row";
import { RecentJobsCard } from "@/features/dashboard/components/recent-jobs-card";
import {
  RecentReferencesCard,
  type DashboardReference,
} from "@/features/dashboard/components/recent-references-card";
import { RecentCollectionsGrid } from "@/features/dashboard/components/recent-collections-grid";

/**
 * Dashboard server page — T-31.
 *
 * Widget seti `docs/design/implementation-notes/dashboard-widgets.md`
 * tarafından kilitlenmiştir. CP-7 wave kuralı: mikro grafik / sparkline /
 * progress bar YASAK; sadece sayı + badge.
 *
 * Yerleşim:
 *   1. <h1> Hoş geldin + alt açıklama
 *   2. DashboardStatRow (4 kart: Bookmark / Referans / Koleksiyon / Aktif job)
 *   3. DashboardQuickActions
 *   4. İki kolon (1.4fr / 1fr): RecentJobsCard | RecentReferencesCard
 *   5. RecentCollectionsGrid (4 kart grid)
 *
 * API / prisma / server query'leri T-31 kapsamında DOKUNULMADI.
 */

export default async function DashboardPage() {
  const user = await requireUser();

  const [
    bookmarkCount,
    referenceCount,
    collectionCount,
    recentReferences,
    recentCollections,
    recentJobs,
  ] = await Promise.all([
    db.bookmark.count({ where: { userId: user.id, deletedAt: null } }),
    db.reference.count({ where: { userId: user.id, deletedAt: null } }),
    db.collection.count({ where: { userId: user.id, deletedAt: null } }),
    db.reference.findMany({
      where: { userId: user.id, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        notes: true,
        createdAt: true,
        productType: { select: { displayName: true } },
        bookmark: { select: { title: true, sourceUrl: true } },
      },
    }),
    db.collection.findMany({
      where: { userId: user.id, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        name: true,
        kind: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { bookmarks: true, references: true } },
      },
    }),
    db.job.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        type: true,
        status: true,
        createdAt: true,
      },
    }),
  ]);

  // "Aktif job" stat sayımı: QUEUED + RUNNING (FAILED/SUCCESS/CANCELLED hariç).
  // Mevcut recentJobs (take: 5) üzerinden filtre — dashboard-widgets.md kararı.
  const activeJobCount = recentJobs.filter(
    (j) => j.status === "QUEUED" || j.status === "RUNNING",
  ).length;

  const referencesForCard: DashboardReference[] = recentReferences.map((ref) => ({
    id: ref.id,
    title:
      ref.bookmark?.title ??
      ref.bookmark?.sourceUrl ??
      ref.notes?.slice(0, 60) ??
      "Referans",
    // Asset URL doğrudan elde değil — placeholder fallback (title initial).
    // Carry-forward: thumbnailAssetIds aggregate'i ile asset URL'i Phase 6+'da.
    thumbnailUrl: null,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Hoş geldin</h1>
        <p className="text-sm text-text-muted">
          Çalışma alanının güncel durumu. Phase 1 iskeleti — üretim akışı Phase 5+&apos;da
          açılacak.
        </p>
      </div>

      <DashboardStatRow
        bookmarkCount={bookmarkCount}
        referenceCount={referenceCount}
        collectionCount={collectionCount}
        activeJobCount={activeJobCount}
      />

      <DashboardQuickActions />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <RecentJobsCard
          jobs={recentJobs.map((j) => ({
            id: j.id,
            type: j.type,
            status: j.status,
            createdAt: j.createdAt,
          }))}
        />
        <RecentReferencesCard references={referencesForCard} />
      </div>

      <RecentCollectionsGrid
        collections={recentCollections.map((c) => ({
          id: c.id,
          name: c.name,
          kind: c.kind,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
          _count: c._count,
        }))}
      />
    </div>
  );
}
