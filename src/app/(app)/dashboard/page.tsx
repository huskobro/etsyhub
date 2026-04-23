import { Bookmark, Image as ImageIcon, FolderOpen } from "lucide-react";
import { db } from "@/server/db";
import { requireUser } from "@/server/session";

export default async function DashboardPage() {
  const user = await requireUser();

  const [bookmarkCount, referenceCount, collectionCount] = await Promise.all([
    db.bookmark.count({ where: { userId: user.id, deletedAt: null } }),
    db.reference.count({ where: { userId: user.id, deletedAt: null } }),
    db.collection.count({ where: { userId: user.id, deletedAt: null } }),
  ]);

  const cards = [
    { label: "Bookmark", value: bookmarkCount, icon: Bookmark, href: "/bookmarks" },
    { label: "Referans", value: referenceCount, icon: ImageIcon, href: "/references" },
    { label: "Koleksiyon", value: collectionCount, icon: FolderOpen, href: "/collections" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Hoş geldin</h1>
          <p className="text-sm text-text-muted">
            Çalışma alanının güncel durumu. Phase 1 iskeleti — üretim akışı Phase 5+&apos;da açılacak.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <a
              key={card.label}
              href={card.href}
              className="flex flex-col gap-3 rounded-md border border-border bg-surface p-5 shadow-card hover:bg-surface-muted"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-muted">{card.label}</span>
                <Icon className="h-4 w-4 text-text-muted" aria-hidden />
              </div>
              <span className="text-3xl font-semibold text-text">{card.value}</span>
            </a>
          );
        })}
      </div>
    </div>
  );
}
