import { db } from "@/server/db";
import { requireUser } from "@/server/session";
import { getStorage } from "@/providers/storage";
import { logger } from "@/lib/logger";
import { DashboardQuickActions } from "@/features/dashboard/components/dashboard-quick-actions";
import { DashboardStatRow } from "@/features/dashboard/components/stat-row";
import { RecentJobsCard } from "@/features/dashboard/components/recent-jobs-card";
import {
  RecentReferencesCard,
  type DashboardReference,
} from "@/features/dashboard/components/recent-references-card";
import { RecentCollectionsGrid } from "@/features/dashboard/components/recent-collections-grid";

// Pass 37 — Dashboard recent references thumbnail TTL. Server component
// her render'da yeniden hesaplar (Next.js dynamic rendering). 1h TTL —
// tek dashboard ziyareti için fazlasıyla yeterli.
const DASHBOARD_THUMBNAIL_TTL_SECONDS = 3600;

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
        // Pass 37 — Reference asset storageKey thumbnail için. Reference.assetId
        // zorunlu; storageKey ile signed URL hesaplanır.
        asset: { select: { id: true, storageKey: true } },
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

  // Pass 37 — Reference asset signed URL'i paralel batch (Promise.all).
  // Pre-Pass 37: thumbnailUrl: null hard-coded → harf placeholder. Dashboard'un
  // tek görsel kör noktasıydı. Storage fail bireysel reference'ta thumbnailUrl: null
  // bırakır; UI fallback (RecentReferencesCard) ilk harf placeholder gösterir.
  const storage = getStorage();
  const referencesForCard: DashboardReference[] = await Promise.all(
    recentReferences.map(async (ref) => {
      const title =
        ref.bookmark?.title ??
        ref.bookmark?.sourceUrl ??
        ref.notes?.slice(0, 60) ??
        "Referans";
      let thumbnailUrl: string | null = null;
      if (ref.asset?.storageKey) {
        try {
          thumbnailUrl = await storage.signedUrl(
            ref.asset.storageKey,
            DASHBOARD_THUMBNAIL_TTL_SECONDS,
          );
        } catch (err) {
          logger.warn(
            {
              referenceId: ref.id,
              assetId: ref.asset.id,
              err: err instanceof Error ? err.message : String(err),
            },
            "dashboard recent reference signed URL failed",
          );
        }
      }
      return { id: ref.id, title, thumbnailUrl };
    }),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Hoş geldin</h1>
        {/* Pass 34 — Subtitle güncellendi. Pre-Pass 34: "Phase 1 iskeleti
            — üretim akışı Phase 5+'da açılacak" Phase 1'den kalma metindi
            (Phase 9 V1'deyiz, üretim akışı + Magic Eraser hattı çalışıyor).
            Şimdi gerçek özellik haritası: bookmark → referans → üret →
            karar → seçim → mockup → listing. */}
        <p className="text-sm text-text-muted">
          Çalışma alanının güncel durumu. Bookmark topla, referansa taşı,
          AI veya local kütüphaneden üret, karar atölyesinde onayla, Selection
          Studio&apos;da düzenle ve listing&apos;e dönüştür.
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
