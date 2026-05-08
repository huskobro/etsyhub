"use client";

// Pass 91 — Selection Index için kompakt MJ origin badge.
//
// SelectionSet kartlarında inline rozet (Studio'daki büyük bar değil).
// "↗ MJ · N kept · K batch" kısa özet.

import { Badge } from "@/components/ui/Badge";

type Props = {
  sourceMetadata: unknown;
};

export function MjOriginInlineBadge({ sourceMetadata }: Props) {
  const origin = parseMjOrigin(sourceMetadata);
  if (!origin) return null;

  const batchCount = origin.batchIds.length;
  return (
    <Badge tone="info" data-testid="mj-origin-inline-badge">
      <span aria-hidden>↗</span> MJ · {origin.keptAssetCount} kept
      {batchCount > 0 ? (
        <>
          {" · "}
          {batchCount} batch
        </>
      ) : null}
    </Badge>
  );
}

type ParsedMjOrigin = {
  batchIds: string[];
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
  return {
    batchIds,
    keptAssetCount:
      typeof o["keptAssetCount"] === "number"
        ? (o["keptAssetCount"] as number)
        : 0,
  };
}
