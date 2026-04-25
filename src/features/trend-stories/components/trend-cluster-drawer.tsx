"use client";

import { useState } from "react";
import {
  useClusterDetail,
  type ClusterMember,
} from "../queries/use-cluster-detail";
import { SeasonalBadge } from "./seasonal-badge";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { StateMessage } from "@/components/ui/StateMessage";

type Props = {
  clusterId: string;
  onClose: () => void;
};

/**
 * Seçili küme için modal-drawer. Plain modal pattern (PromoteDialog gibi).
 * - Cluster başlık + stats
 * - Üye listesi (thumbnail + başlık + mağaza + yorum + firstSeenAt)
 * - "Daha fazla yükle" ile cursor bazlı sayfalama (backend 30/sayfa)
 * - Silinmiş üyeler gri placeholder + "Kaynak artık mevcut değil" pill
 *
 * T-37 spec — docs/design/implementation-notes/trend-stories-screens.md
 *
 * KORUNUR (dokunulmaz):
 * - role="dialog" + aria-modal + aria-label="Trend kümesi detayı"
 * - DrawerContent + DrawerPages + DrawerPage cursor sayfalama yapısı
 * - ClusterHeader yapısı (label + SeasonalBadge + 3 stat grid)
 * - StatCard inline yapı (3 kolon grid; primitive granularity uymaz)
 * - MemberRow yapısı (thumb + title + meta)
 * - SeasonalBadge yerel pill (carry-forward)
 *
 * Sınırlı dokunuşlar:
 * - Kapat / "Daha fazla yükle" → Button variant=ghost
 * - Loading / error → StateMessage primitive
 * - ClusterHeader productType pill → Badge tone=accent
 * - MemberRow "Kaynak artık mevcut değil" → Badge tone=danger
 * - "Kaynağı Aç" anchor styled korunur (T-33 paterni)
 */
export function TrendClusterDrawer({ clusterId, onClose }: Props) {
  // Sayfa zincirleme cursor'ları: her "Daha fazla yükle" tıklamasıyla
  // yeni bir sayfa çekilir ve liste accumulate edilir.
  const [cursors, setCursors] = useState<(string | null)[]>([null]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-bg/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Trend kümesi detayı"
    >
      <div className="my-auto flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-md border border-border bg-surface shadow-popover">
        <DrawerContent
          clusterId={clusterId}
          cursors={cursors}
          onLoadMore={(next) => setCursors((prev) => [...prev, next])}
          onClose={onClose}
        />
      </div>
    </div>
  );
}

function DrawerContent({
  clusterId,
  cursors,
  onLoadMore,
  onClose,
}: {
  clusterId: string;
  cursors: (string | null)[];
  onLoadMore: (cursor: string) => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="flex items-start justify-between gap-3 border-b border-border p-5">
        <h2 className="text-lg font-semibold text-text">Trend Kümesi</h2>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Kapat
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        <DrawerPages clusterId={clusterId} cursors={cursors} onLoadMore={onLoadMore} />
      </div>
    </>
  );
}

function DrawerPages({
  clusterId,
  cursors,
  onLoadMore,
}: {
  clusterId: string;
  cursors: (string | null)[];
  onLoadMore: (cursor: string) => void;
}) {
  // Her cursor için ayrı bir query hook. React Query her birini cache'ler.
  return (
    <div className="flex flex-col gap-4">
      {cursors.map((cursor, idx) => (
        <DrawerPage
          key={`${clusterId}-${idx}`}
          clusterId={clusterId}
          cursor={cursor}
          showHeader={idx === 0}
          isLastPage={idx === cursors.length - 1}
          onLoadMore={onLoadMore}
        />
      ))}
    </div>
  );
}

function DrawerPage({
  clusterId,
  cursor,
  showHeader,
  isLastPage,
  onLoadMore,
}: {
  clusterId: string;
  cursor: string | null;
  showHeader: boolean;
  isLastPage: boolean;
  onLoadMore: (cursor: string) => void;
}) {
  const query = useClusterDetail(clusterId, cursor);

  if (query.isLoading) {
    return <StateMessage tone="neutral" title="Küme yükleniyor…" />;
  }
  if (query.isError) {
    return (
      <StateMessage
        tone="error"
        title="Küme yüklenemedi"
        body={(query.error as Error).message}
      />
    );
  }
  if (!query.data) return null;

  const { cluster, members, nextCursor } = query.data;

  return (
    <div className="flex flex-col gap-4">
      {showHeader ? <ClusterHeader cluster={cluster} /> : null}

      {members.length === 0 ? (
        <p className="text-sm text-text-muted">Bu kümede listing yok.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {members.map((m) => (
            <MemberRow key={m.listingId} member={m} />
          ))}
        </ul>
      )}

      {isLastPage && nextCursor ? (
        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onLoadMore(nextCursor)}
          >
            Daha fazla yükle
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function ClusterHeader({
  cluster,
}: {
  cluster: NonNullable<
    ReturnType<typeof useClusterDetail>["data"]
  >["cluster"];
}) {
  return (
    <header className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="text-xl font-semibold text-text">{cluster.label}</h3>
          <div className="flex flex-wrap items-center gap-1.5">
            <SeasonalBadge seasonalTag={cluster.seasonalTag} />
            {cluster.productType ? (
              <Badge tone="accent">{cluster.productType.displayName}</Badge>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Mağaza" value={cluster.storeCount} />
        <StatCard label="Ürün" value={cluster.memberCount} />
        <StatCard label="Toplam yorum" value={cluster.totalReviewCount} />
      </div>
    </header>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border bg-surface-2 p-3">
      <span className="text-xs text-text-muted">{label}</span>
      <span className="text-lg font-semibold text-text">{value}</span>
    </div>
  );
}

function MemberRow({ member }: { member: ClusterMember }) {
  const dateLabel = new Date(member.firstSeenAt).toLocaleDateString("tr-TR");

  return (
    <li className="flex items-start gap-3 rounded-md border border-border bg-surface p-3">
      {member.thumbnailUrl && !member.deleted ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={member.thumbnailUrl}
          alt={member.title}
          loading="lazy"
          className="h-16 w-16 shrink-0 rounded-md bg-surface-2 object-cover"
        />
      ) : (
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-surface-2 text-xs text-text-muted">
          Görsel yok
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h4
          className="line-clamp-2 text-sm font-medium text-text"
          title={member.title}
        >
          {member.title}
        </h4>
        <p className="truncate text-xs text-text-muted">
          {member.competitorStoreName} · {member.reviewCount} yorum · {dateLabel}
        </p>

        <div className="flex flex-wrap items-center gap-1.5">
          {member.deleted ? (
            <Badge tone="danger">Kaynak artık mevcut değil</Badge>
          ) : (
            <a
              href={member.sourceUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="rounded-md border border-border px-2 py-0.5 text-xs text-text hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Kaynağı Aç
            </a>
          )}
        </div>
      </div>
    </li>
  );
}
