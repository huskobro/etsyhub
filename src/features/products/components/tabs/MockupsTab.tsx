/* eslint-disable no-restricted-syntax */
// MockupsTab — Kivasy v4 A5 mockup section grid; v4 sabit boyutlar:
//  · text-[15px] section title + text-[10.5px] mono caption (A5 canon)
// Whitelisted in scripts/check-tokens.ts.
"use client";

import Link from "next/link";
import { ArrowRight, ImageOff, Plus, Star } from "lucide-react";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/Badge";
import { useProductSourceSelection } from "@/features/products/hooks/useProductSourceSelection";
import type {
  ListingDraftView,
  ListingImageOrderEntry,
} from "@/features/listings/types";

/**
 * MockupsTab — A5 Mockups tab, orchestration view.
 *
 * Source: docs/design-system/kivasy/ui_kits/kivasy/v4/screens-a5.jsx →
 * A5ProductDetail mockups tab.
 *
 * R5 surface (orchestration shell + working binding):
 *   - Section ayrımı: Lifestyle Mockups / Bundle Preview Sheets /
 *     My Templates (3 sınıf, mockup model spec). V1 V1: section
 *     classification listing.imageOrder template name'inden derive
 *     edilir; gerçekten section ayrımı için MockupTemplate.kind enum
 *     gerekir (CLAUDE.md §6 Mockup model). R5'te section ayrımı
 *     "best-effort" — template name'de "lifestyle"/"bundle"/"sheet"
 *     keyword'ü varsa ilgili section'a, yoksa "Lifestyle" varsayılan.
 *   - Per-render kart: thumb + template name + position + isCover
 *     primary badge.
 *   - Cover swap orchestration için cross-link (Phase 8 Mockup Studio
 *     cover.service zaten var; UI burada sadece "Open cover swap"
 *     bağlantısı gösterir — A6 R5'te modal bağlanmaz, deferred).
 *
 * Boundary discipline (Phase 78 final ürün kararıyla netleşti):
 *   Mockup/frame authoring burada DEĞİL — canonical surface
 *   /selection/sets/[id]/mockup/studio (Phase 77 dark Studio shell).
 *   Apply route quick pack render orchestrator olarak kalır. Bu tab
 *   ürünün hâlâ yöneteceği render bant'ı + Studio'ya geri-link.
 */

interface MockupsTabProps {
  listing: ListingDraftView;
}

/* Phase 100 — Frame bucket eklendi (sözleşme #11 + #13.F).
 *
 * Frame export entry'leri (`kind: "frame-export"`) ayrı "frame"
 * bucket'ına düşer; operator için "presentation listing hero +
 * social card" başlığı altında gruplanır. Phase 9 baseline
 * mockup-render bucket'ları (lifestyle / bundle / user) korunur. */
type MockupSection = "lifestyle" | "bundle" | "user" | "frame";

const SECTION_LABEL: Record<MockupSection, string> = {
  lifestyle: "Lifestyle Mockups",
  bundle: "Bundle Preview Sheets",
  user: "My Templates",
  frame: "Frame Exports",
};

function classifySection(entry: ListingImageOrderEntry): MockupSection {
  // Phase 100 — Frame export kind discriminator ilk önce kontrol edilir
  if (entry.kind === "frame-export") return "frame";
  const n = entry.templateName.toLowerCase();
  if (n.includes("bundle") || n.includes("sheet") || n.includes("preview")) {
    return "bundle";
  }
  if (
    n.includes("custom") ||
    n.includes("user") ||
    n.includes("psd") ||
    n.includes("template ")
  ) {
    return "user";
  }
  return "lifestyle";
}

function groupByMockupSection(
  imageOrder: ListingImageOrderEntry[],
): Record<MockupSection, ListingImageOrderEntry[]> {
  const groups: Record<MockupSection, ListingImageOrderEntry[]> = {
    lifestyle: [],
    bundle: [],
    user: [],
    frame: [],
  };
  for (const it of imageOrder) {
    const sec = classifySection(it);
    groups[sec].push(it);
  }
  return groups;
}

export function MockupsTab({ listing }: MockupsTabProps) {
  const groups = groupByMockupSection(listing.imageOrder);
  // Phase 100 — Frame bucket ürün hiyerarşisinde ilk önce (operator
  // için "Frame export = listing hero" sinyali güçlü).
  const sectionOrder: MockupSection[] = ["frame", "lifestyle", "bundle", "user"];

  const totalApplied = listing.imageOrder.length;

  // R5 — Selection lineage: listing.mockupJobId → MockupJob.setId. Ayrı
  // /api/products/[id]/source-selection endpoint'i (ListingDraftView shape'ine
  // dokunmadan). Set bulunamazsa cross-link gösterilmez.
  const { data: sourceSelection } = useProductSourceSelection(listing.id);

  return (
    <div
      className="flex-1 overflow-y-auto bg-bg px-8 py-8"
      data-testid="product-mockups-tab"
    >
      <div className="mb-6 flex items-start justify-between">
        <div>
          <p className="font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
            {totalApplied} mockups applied ·{" "}
            {listing.coverRenderId ? "cover set" : "no cover yet"}
          </p>
          {sourceSelection ? (
            <p className="mt-1 text-sm text-ink-2">
              Source selection:{" "}
              <Link
                href={`/selections/${sourceSelection.setId}`}
                className="font-medium text-info underline-offset-2 hover:underline"
                data-testid="product-mockups-source-selection"
              >
                {sourceSelection.setName}
              </Link>
              . Open the Studio to add more mockup / frame renders to this
              product (Phase 78 — Studio is the canonical authoring surface).
            </p>
          ) : (
            <p className="mt-1 text-sm text-text-muted">
              Mockups are produced from a Selection&apos;s Mockup Studio.
              Open a Selection set, finalize it, then open the Studio to
              package this product.
            </p>
          )}
        </div>
        {sourceSelection ? (
          /* Phase 78 — Studio canonical entry from Product detail.
             Önceden "Apply more mockups" → /selections/[id] (set
             detail'a iniyordu). Final ürün kararıyla operatör doğrudan
             Studio'ya çıkar (mockup + frame authoring tek yerde). */
          <Link
            href={`/selection/sets/${sourceSelection.setId}/mockup/studio`}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-paper px-3 text-xs font-medium text-ink-2 hover:border-line-strong hover:text-ink"
            data-testid="product-mockups-back-to-selection"
          >
            <Plus className="h-3 w-3" aria-hidden />
            Open in Studio
          </Link>
        ) : (
          <Link
            href="/selections"
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-paper px-3 text-xs font-medium text-ink-2 hover:border-line-strong hover:text-ink"
            data-testid="product-mockups-back-to-selection"
          >
            <Plus className="h-3 w-3" aria-hidden />
            Pick a Selection
          </Link>
        )}
      </div>

      {totalApplied === 0 ? (
        <div className="rounded-md border border-dashed border-line bg-paper px-6 py-10 text-center">
          <ImageOff
            className="mx-auto mb-2 h-6 w-6 text-ink-3"
            aria-hidden
          />
          <h3 className="text-base font-semibold text-ink">
            No mockups applied yet
          </h3>
          <p className="mt-1 text-sm text-text-muted">
            Open a Selection in Mockup Studio to package this product
            (Studio is the canonical authoring surface — Phase 78).
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {sectionOrder.map((sec) => {
            const items = groups[sec];
            return (
              <section key={sec} aria-labelledby={`mockups-${sec}`}>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3
                      id={`mockups-${sec}`}
                      className="text-[15px] font-semibold text-ink"
                    >
                      {SECTION_LABEL[sec]}
                    </h3>
                    <div className="mt-0.5 font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
                      {items.length} applied
                    </div>
                  </div>
                  {items.length === 0 ? null : sourceSelection ? (
                    <Link
                      href={`/selections/${sourceSelection.setId}`}
                      className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-ink-2 hover:text-ink"
                    >
                      View source selection
                      <ArrowRight className="h-3 w-3" aria-hidden />
                    </Link>
                  ) : null}
                </div>

                {items.length === 0 ? (
                  <div className="rounded-md border border-dashed border-line bg-paper px-4 py-6 text-center">
                    <p className="text-xs text-text-muted">
                      No {SECTION_LABEL[sec]} in this product yet.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
                    {items.map((it) => {
                      // Phase 100 — entry id (mockup-render renderId veya
                      // frame-export frameExportId; backward-compat
                      // legacy entry'lerde renderId).
                      const entryId =
                        it.kind === "frame-export"
                          ? it.frameExportId
                          : it.renderId;
                      // Phase 101 — Frame export PNG (16:9 / 4:5 / 9:16 /
                      // 1:1 / 3:4) aspect-square `object-cover` ile merkez
                      // kırpılıyordu (operator için cascade'in üst/alt
                      // kenarı kaybolabiliyordu). Frame export entry'lerinde
                      // tile host `aspect-[4/3]` + image `object-contain`
                      // ile dürüstçe gerçek aspect'i koru — bg-stage tone
                      // letterbox padding'i (Studio preview parity hissi).
                      // Mockup-render entry'leri Phase 8 baseline davranışı
                      // ile aynı (aspect-square + object-cover).
                      const isFrameExport = it.kind === "frame-export";
                      return (
                      <div
                        key={entryId}
                        className={cn(
                          "k-card relative overflow-hidden",
                          it.isCover && "ring-2 ring-k-orange",
                        )}
                        data-testid="product-mockup-tile"
                        data-render-id={entryId}
                        data-entry-kind={it.kind ?? "mockup-render"}
                        data-is-cover={it.isCover ? "true" : undefined}
                      >
                        <div
                          className={cn(
                            "overflow-hidden",
                            isFrameExport
                              ? "aspect-[4/3] bg-ink"
                              : "aspect-square bg-k-bg-2",
                          )}
                        >
                          {it.signedUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={it.signedUrl}
                              alt={it.templateName}
                              className={cn(
                                "h-full w-full",
                                isFrameExport
                                  ? "object-contain"
                                  : "object-cover",
                              )}
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-ink-3">
                              <ImageOff className="h-6 w-6" aria-hidden />
                            </div>
                          )}
                        </div>
                        {it.isCover ? (
                          <div className="absolute right-2 top-2">
                            <Badge tone="accent" dot>
                              <Star className="h-2.5 w-2.5" aria-hidden /> Primary
                            </Badge>
                          </div>
                        ) : null}
                        <div className="p-3">
                          <div className="truncate text-sm font-medium text-ink">
                            {it.templateName}
                          </div>
                          <div className="mt-0.5 font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
                            Pack #{it.packPosition.toString().padStart(2, "0")}
                          </div>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
