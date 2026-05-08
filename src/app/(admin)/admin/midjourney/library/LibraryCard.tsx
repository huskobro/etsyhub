"use client";

// Pass 88 — Asset Library V1: Card komponenti.
//
// Sözleşme:
//   - Server'dan gelen LibraryCard data'sını render eder.
//   - Görseli AssetThumb (Pass 52) reuse eder — signed URL fetch'i kendi yapıyor.
//   - Hover state'te badge'ler + prompt preview görünür.
//   - Footer: variantKind badge, batch/template/parent rozetleri.
//   - Tıklanabilir alanlar:
//       1. Görsel + ana satır → /admin/midjourney/[midjourneyJobId]
//       2. Batch rozeti → /admin/midjourney?batchId=...
//       3. Template rozeti → /admin/midjourney/templates/[id]
//       4. Parent rozeti → /admin/midjourney/library?parentAssetId=...
//          (parent filter UI tarafından handle edilir; route param)

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { AssetThumb } from "../AssetThumb";
import { VARIANT_KIND_META } from "./variantKindHelper";
import type { MJReviewDecision, MJVariantKind } from "@prisma/client";

type LibraryCardProps = {
  card: {
    midjourneyAssetId: string;
    assetId: string;
    gridIndex: number;
    variantKind: MJVariantKind;
    mjActionLabel: string | null;
    parentAssetId: string | null;
    midjourneyJobId: string;
    jobKind: string;
    prompt: string;
    batchId: string | null;
    templateId: string | null;
    expandedPrompt: string | null;
    reviewDecision: MJReviewDecision;
  };
};

export function LibraryCard({ card }: LibraryCardProps) {
  const variantMeta = VARIANT_KIND_META[card.variantKind];
  const previewPrompt = (card.expandedPrompt ?? card.prompt).trim();
  const promptPreview =
    previewPrompt.length > 120
      ? `${previewPrompt.slice(0, 120)}…`
      : previewPrompt;

  return (
    <article
      className="group flex flex-col gap-1 rounded-md border border-border bg-surface p-1.5 transition hover:border-border-strong"
      data-testid="mj-library-card"
      data-mj-asset-id={card.midjourneyAssetId}
    >
      <Link
        href={`/admin/midjourney/${card.midjourneyJobId}`}
        className="block"
        title={previewPrompt}
      >
        <AssetThumb assetId={card.assetId} alt={`${variantMeta.label} grid ${card.gridIndex}`} />
      </Link>

      <div className="flex flex-wrap items-center gap-1">
        <Badge tone={variantMeta.tone} title={variantMeta.hint}>
          {variantMeta.label}
          {card.mjActionLabel ? ` ${card.mjActionLabel}` : ""}
        </Badge>
        {/* Pass 89 — Review decision rozeti (sadece UNDECIDED değilse) */}
        {card.reviewDecision === "KEPT" ? (
          <Badge tone="success" title="Batch Review'da tutuldu">
            ✓
          </Badge>
        ) : card.reviewDecision === "REJECTED" ? (
          <Badge tone="danger" title="Batch Review'da reddedildi">
            ✕
          </Badge>
        ) : null}
        {card.parentAssetId ? (
          <Link
            href={`/admin/midjourney/library?parentAssetId=${card.parentAssetId}`}
            className="text-xs text-text-muted underline hover:text-accent"
            title="Parent asset filter"
          >
            ↑ parent
          </Link>
        ) : null}
      </div>

      <p className="line-clamp-2 text-xs text-text-muted" title={previewPrompt}>
        {promptPreview || <span className="italic">(boş prompt)</span>}
      </p>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {card.batchId ? (
          <>
            <Link
              href={`/admin/midjourney/batches/${card.batchId}`}
              className="text-text-muted underline hover:text-accent"
              title={`Batch ${card.batchId}`}
            >
              batch {card.batchId.slice(0, 6)}
            </Link>
            {/* Pass 89 — Review Studio quick-jump */}
            <Link
              href={`/admin/midjourney/batches/${card.batchId}/review`}
              className="text-text-muted underline hover:text-accent"
              title="Batch Review Studio"
            >
              review
            </Link>
          </>
        ) : null}
        {card.templateId ? (
          <Link
            href={`/admin/midjourney/templates/${card.templateId}`}
            className="text-text-muted underline hover:text-accent"
            title="Template"
          >
            tmpl
          </Link>
        ) : null}
      </div>
    </article>
  );
}
