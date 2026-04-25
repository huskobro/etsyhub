import Link from "next/link";
import { Bookmark, Image as ImageIcon, FolderOpen, Activity } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

/**
 * Dashboard Stat Row — T-31.
 *
 * 4 kart: Bookmark / Referans / Koleksiyon / Aktif job.
 * Aktif job tonu accent (text-accent), diğerleri text-text.
 * Mikro grafik / sparkline / progress bar / trend badge YASAK
 * (CP-7 wave kuralı, dashboard-widgets.md kararı).
 *
 * Stat kartları `Card` primitive tüketir; yeni primitive yok.
 */

export interface DashboardStatRowProps {
  bookmarkCount: number;
  referenceCount: number;
  collectionCount: number;
  activeJobCount: number;
}

interface StatItem {
  label: string;
  value: number;
  href: string;
  icon: typeof Bookmark;
  accent?: boolean;
}

export function DashboardStatRow({
  bookmarkCount,
  referenceCount,
  collectionCount,
  activeJobCount,
}: DashboardStatRowProps) {
  const items: StatItem[] = [
    { label: "Bookmark", value: bookmarkCount, href: "/bookmarks", icon: Bookmark },
    { label: "Referans", value: referenceCount, href: "/references", icon: ImageIcon },
    {
      label: "Koleksiyon",
      value: collectionCount,
      href: "/collections",
      icon: FolderOpen,
    },
    {
      label: "Aktif job",
      value: activeJobCount,
      href: "/dashboard",
      icon: Activity,
      accent: true,
    },
  ];

  return (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      data-testid="dashboard-stat-row"
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.label}
            href={item.href}
            className="block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            data-testid={`stat-card-${item.label}`}
          >
            <Card interactive className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs tracking-meta text-text-muted">
                  {item.label}
                </span>
                <Icon className="h-4 w-4 text-text-muted" aria-hidden />
              </div>
              <span
                className={cn(
                  "text-3xl font-semibold",
                  item.accent ? "text-accent" : "text-text",
                )}
                data-testid={`stat-value-${item.label}`}
              >
                {item.value}
              </span>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
