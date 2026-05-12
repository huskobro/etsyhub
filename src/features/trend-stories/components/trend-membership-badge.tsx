"use client";

/**
 * Feed kartındaki listing'in hangi trend kümesine ait olduğunu gösteren
 * pill. Tıklandığında üst state'teki `onOpenCluster(clusterId)` çağrısı ile
 * ilgili küme drawer'ı açılır.
 */

type Props = {
  label: string;
  clusterId: string;
  onOpenCluster: (clusterId: string) => void;
};

export function TrendMembershipBadge({
  label,
  clusterId,
  onOpenCluster,
}: Props) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpenCluster(clusterId);
      }}
      className="inline-flex items-center gap-1 rounded-md bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent hover:bg-accent/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      title="Open trend cluster"
    >
      <span aria-hidden>✦</span>
      <span className="max-w-40 truncate">Trend: {label}</span>
    </button>
  );
}
