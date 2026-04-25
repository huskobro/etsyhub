import Link from "next/link";
import { Card } from "@/components/ui/Card";

/**
 * RecentReferencesCard — T-31.
 *
 * Sağ kolon: 4 thumb grid. Asset URL kolay erişilebilir değilse placeholder
 * (title ilk harfi). 5'ten az ise eksik thumb yer tutucu (skeleton div).
 * Footer CTA: "Referans havuzuna git" → /references.
 */

export interface DashboardReference {
  id: string;
  title: string;
  thumbnailUrl?: string | null;
}

const SLOT_COUNT = 4;

export function RecentReferencesCard({
  references,
}: {
  references: DashboardReference[];
}) {
  const top = references.slice(0, SLOT_COUNT);
  const placeholders = Math.max(0, SLOT_COUNT - top.length);

  return (
    <Card
      variant="list"
      className="flex flex-col items-stretch gap-3 p-5"
      data-testid="recent-references-card"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text">Son referanslar</h2>
        <Link href="/references" className="text-xs text-accent hover:underline">
          Tümü
        </Link>
      </div>
      {top.length === 0 && placeholders === SLOT_COUNT ? (
        <p className="text-sm text-text-muted">Henüz referans yok.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {top.map((ref) => {
            const initial = ref.title.trim().charAt(0).toUpperCase() || "·";
            return (
              <div
                key={ref.id}
                className="aspect-square overflow-hidden rounded-md border border-border bg-surface-muted"
                data-testid="recent-references-thumb"
                title={ref.title}
              >
                {ref.thumbnailUrl ? (
                  // Next/Image yerine basit img — primitive disiplini, ekstra
                  // optimize edilmez (anlık dashboard preview).
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={ref.thumbnailUrl}
                    alt={ref.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center font-mono text-xs text-text-muted">
                    {initial}
                  </div>
                )}
              </div>
            );
          })}
          {Array.from({ length: placeholders }).map((_, idx) => (
            <div
              key={`placeholder-${idx}`}
              className="aspect-square rounded-md bg-surface-muted"
              data-testid="recent-references-placeholder"
              aria-hidden
            />
          ))}
        </div>
      )}
      <div className="pt-1">
        <Link
          href="/references"
          className="text-xs font-medium text-accent hover:underline"
        >
          Referans havuzuna git
        </Link>
      </div>
    </Card>
  );
}
