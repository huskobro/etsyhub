import { Bookmark, Image as ImageIcon, FolderOpen } from "lucide-react";
import Link from "next/link";
import { db } from "@/server/db";
import { requireUser } from "@/server/session";
import { DashboardQuickActions } from "@/features/dashboard/components/dashboard-quick-actions";

const kindLabels: Record<string, string> = {
  MIXED: "Karma",
  BOOKMARK: "Bookmark",
  REFERENCE: "Reference",
};

const jobStatusClass: Record<string, string> = {
  QUEUED: "text-text-muted",
  RUNNING: "text-accent",
  SUCCESS: "text-success",
  FAILED: "text-danger",
  CANCELLED: "text-text-muted",
};

function relativeTime(date: Date) {
  const diff = Date.now() - date.getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "az önce";
  if (minutes < 60) return `${minutes} dk önce`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} sa önce`;
  const days = Math.round(hours / 24);
  return `${days} gün önce`;
}

export default async function DashboardPage() {
  const user = await requireUser();

  const [
    bookmarkCount,
    referenceCount,
    collectionCount,
    recentBookmarks,
    recentReferences,
    recentCollections,
    recentJobs,
  ] = await Promise.all([
    db.bookmark.count({ where: { userId: user.id, deletedAt: null } }),
    db.reference.count({ where: { userId: user.id, deletedAt: null } }),
    db.collection.count({ where: { userId: user.id, deletedAt: null } }),
    db.bookmark.findMany({
      where: { userId: user.id, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        title: true,
        sourceUrl: true,
        status: true,
        createdAt: true,
      },
    }),
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
        progress: true,
        error: true,
        createdAt: true,
      },
    }),
  ]);

  const cards = [
    {
      label: "Bookmark",
      value: bookmarkCount,
      icon: Bookmark,
      href: "/bookmarks",
    },
    {
      label: "Referans",
      value: referenceCount,
      icon: ImageIcon,
      href: "/references",
    },
    {
      label: "Koleksiyon",
      value: collectionCount,
      icon: FolderOpen,
      href: "/collections",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Hoş geldin</h1>
        <p className="text-sm text-text-muted">
          Çalışma alanının güncel durumu. Phase 1 iskeleti — üretim akışı Phase 5+&apos;da
          açılacak.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.label}
              href={card.href}
              className="flex flex-col gap-3 rounded-md border border-border bg-surface p-5 shadow-card hover:bg-surface-muted"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-muted">{card.label}</span>
                <Icon
                  className="h-4 w-4 text-text-muted"
                  aria-hidden
                />
              </div>
              <span className="text-3xl font-semibold text-text">{card.value}</span>
            </Link>
          );
        })}
      </div>

      <DashboardQuickActions />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="flex flex-col gap-3 rounded-md border border-border bg-surface p-5 shadow-card">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text">Son Bookmark&apos;lar</h2>
            <Link href="/bookmarks" className="text-xs text-accent hover:underline">
              Tümü
            </Link>
          </div>
          {recentBookmarks.length === 0 ? (
            <p className="text-sm text-text-muted">
              Henüz bookmark yok. Yukarıdaki hızlı aksiyondan başla.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {recentBookmarks.map((bm) => (
                <li
                  key={bm.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-border bg-bg px-3 py-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-text">
                      {bm.title ?? bm.sourceUrl ?? "(başlıksız)"}
                    </p>
                    <p className="text-xs text-text-muted">
                      {bm.status} · {relativeTime(bm.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-3 rounded-md border border-border bg-surface p-5 shadow-card">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text">Son Referanslar</h2>
            <Link href="/references" className="text-xs text-accent hover:underline">
              Tümü
            </Link>
          </div>
          {recentReferences.length === 0 ? (
            <p className="text-sm text-text-muted">
              Henüz referans yok. Bookmark&apos;tan &quot;Referansa Taşı&quot; ile üret.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {recentReferences.map((ref) => (
                <li
                  key={ref.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-border bg-bg px-3 py-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-text">
                      {ref.bookmark?.title ??
                        ref.bookmark?.sourceUrl ??
                        ref.notes?.slice(0, 60) ??
                        "Referans"}
                    </p>
                    <p className="text-xs text-text-muted">
                      {ref.productType?.displayName ?? "–"} ·{" "}
                      {relativeTime(ref.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-3 rounded-md border border-border bg-surface p-5 shadow-card">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text">Son Koleksiyonlar</h2>
            <Link
              href="/collections"
              className="text-xs text-accent hover:underline"
            >
              Tümü
            </Link>
          </div>
          {recentCollections.length === 0 ? (
            <p className="text-sm text-text-muted">Koleksiyon henüz yok.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {recentCollections.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-border bg-bg px-3 py-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-text">{c.name}</p>
                    <p className="text-xs text-text-muted">
                      {kindLabels[c.kind] ?? c.kind} · {c._count.bookmarks} bookmark ·{" "}
                      {c._count.references} referans
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-3 rounded-md border border-border bg-surface p-5 shadow-card">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text">Son İşler</h2>
          </div>
          {recentJobs.length === 0 ? (
            <p className="text-sm text-text-muted">Henüz job çalışmadı.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {recentJobs.map((j) => (
                <li
                  key={j.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-border bg-bg px-3 py-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-text">{j.type}</p>
                    <p className="text-xs text-text-muted">
                      <span className={jobStatusClass[j.status] ?? "text-text-muted"}>
                        {j.status}
                      </span>
                      {" · "}
                      {j.progress}% · {relativeTime(j.createdAt)}
                      {j.error ? ` · ${j.error.slice(0, 40)}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
