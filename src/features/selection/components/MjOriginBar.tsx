"use client";

// Pass 91 — Selection Workspace V1: MJ Origin Bar.
//
// Handoff sonrası bağlam çubuğu. SelectionSet.sourceMetadata.mjOrigin
// var ise üst kısımda render edilir; kullanıcı:
//   - "MJ Kept handoff'tan geldi" sezgisini alır
//   - origin batch chip'lerine tıklayıp Review Studio / Kept Workspace'e
//     dönebilir
//   - asset count + variantKind dağılımını görür
//
// Pass 90'dan önce yaratılmış set'lerde mjOrigin yok → bar görünmez.

import Link from "next/link";

type MjOriginBarProps = {
  /** SelectionSet.sourceMetadata payload (Json). */
  sourceMetadata: unknown;
};

export function MjOriginBar({ sourceMetadata }: MjOriginBarProps) {
  const origin = parseMjOrigin(sourceMetadata);
  if (!origin) return null;

  const variantText = formatVariantKindCounts(origin.variantKindCounts);
  const handedOff = formatRelativeTime(origin.handedOffAt);

  return (
    <div
      className="flex flex-wrap items-center gap-3 rounded-md border border-accent bg-accent-soft px-3 py-2 text-xs"
      data-testid="mj-origin-bar"
    >
      <span className="flex items-center gap-1 font-semibold text-accent-text">
        <span aria-hidden>↗</span>
        Midjourney Kept handoff
      </span>

      <span className="text-text-muted">·</span>

      <span className="text-text" data-testid="mj-origin-count">
        <strong>{origin.keptAssetCount}</strong> kept asset
        {variantText ? <> ({variantText})</> : null}
      </span>

      {origin.batchIds.length > 0 ? (
        <>
          <span className="text-text-muted">·</span>
          <span className="flex flex-wrap items-center gap-1">
            <span className="text-text-muted">batch:</span>
            {origin.batchIds.slice(0, 3).map((bid) => (
              <Link
                key={bid}
                href={`/admin/midjourney/batches/${bid}`}
                className="rounded bg-surface px-1.5 py-0.5 font-mono text-text-muted hover:text-accent"
                title={`Batch ${bid}`}
              >
                {bid.slice(0, 8)}
              </Link>
            ))}
            {origin.batchIds.length > 3 ? (
              <span className="text-text-muted">
                +{origin.batchIds.length - 3}
              </span>
            ) : null}
          </span>
        </>
      ) : null}

      {/* Geri linkler — MJ omurgasına dönüş */}
      <span className="ml-auto flex items-center gap-2">
        {origin.batchIds.length === 1 ? (
          <Link
            href={`/admin/midjourney/batches/${origin.batchIds[0]}/review?decision=kept`}
            className="text-accent underline hover:no-underline"
            data-testid="mj-origin-back-review"
          >
            Review Studio
          </Link>
        ) : null}
        <Link
          href="/admin/midjourney/kept"
          className="text-accent underline hover:no-underline"
          data-testid="mj-origin-back-kept"
        >
          ✓ Kept Workspace
        </Link>
        <Link
          href="/admin/midjourney/library"
          className="text-text-muted underline hover:text-accent"
          data-testid="mj-origin-back-library"
        >
          🖼 Library
        </Link>
        {handedOff ? (
          <span
            className="text-text-subtle"
            title={origin.handedOffAt ?? undefined}
          >
            · {handedOff}
          </span>
        ) : null}
      </span>
    </div>
  );
}

type ParsedMjOrigin = {
  kindFamily: string;
  batchIds: string[];
  templateIds: string[];
  variantKindCounts: Record<string, number>;
  referenceId: string | null;
  productTypeId: string | null;
  handedOffAt: string | null;
  keptAssetCount: number;
};

function parseMjOrigin(meta: unknown): ParsedMjOrigin | null {
  if (!meta || typeof meta !== "object") return null;
  const root = meta as Record<string, unknown>;
  const raw = root["mjOrigin"];
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o["kindFamily"] !== "midjourney_kept") return null;

  const batchIds = Array.isArray(o["batchIds"])
    ? (o["batchIds"] as unknown[]).filter(
        (x): x is string => typeof x === "string",
      )
    : [];
  const templateIds = Array.isArray(o["templateIds"])
    ? (o["templateIds"] as unknown[]).filter(
        (x): x is string => typeof x === "string",
      )
    : [];
  const variantKindCounts =
    o["variantKindCounts"] && typeof o["variantKindCounts"] === "object"
      ? (o["variantKindCounts"] as Record<string, number>)
      : {};

  return {
    kindFamily: "midjourney_kept",
    batchIds,
    templateIds,
    variantKindCounts,
    referenceId:
      typeof o["referenceId"] === "string"
        ? (o["referenceId"] as string)
        : null,
    productTypeId:
      typeof o["productTypeId"] === "string"
        ? (o["productTypeId"] as string)
        : null,
    handedOffAt:
      typeof o["handedOffAt"] === "string"
        ? (o["handedOffAt"] as string)
        : null,
    keptAssetCount:
      typeof o["keptAssetCount"] === "number"
        ? (o["keptAssetCount"] as number)
        : 0,
  };
}

function formatVariantKindCounts(counts: Record<string, number>): string {
  const order = ["GRID", "UPSCALE", "VARIATION", "DESCRIBE"] as const;
  const parts: string[] = [];
  for (const k of order) {
    const c = counts[k];
    if (typeof c === "number" && c > 0) {
      parts.push(`${labelOf(k)} ${c}`);
    }
  }
  return parts.join(" · ");
}

function labelOf(k: string): string {
  if (k === "GRID") return "Grid";
  if (k === "UPSCALE") return "Upscale";
  if (k === "VARIATION") return "Variation";
  if (k === "DESCRIBE") return "Describe";
  return k;
}

function formatRelativeTime(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}d ago`;
}
