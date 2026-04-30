"use client";

// Phase 7 Task 26 — Selection Studio sol canvas üst kartı (aktif preview).
//
// Spec Section 3.2 (Studio canvas — sol bölge): Card içinde aktif varyant
// preview'i. Mockup B.13 (`screens-b.jsx:862`):
//   - Üst satır: "Varyant 03 / 12" (Badge tone="accent" dot) + boyut bilgisi
//     (mono, muted; Phase 7 v1 yok → "—" placeholder).
//   - Orta: thumb preview (aspect-portrait wrapper, signed URL ile gerçek
//     görsel — `AssetImage` reuse).
//   - Alt: prev/next nav (Önceki/Sonraki + ortada "X / N" mono indicator).
//
// Aktif görüntü kuralı (spec Section 4):
//   - `editedAssetId ?? sourceAssetId` — edit op uygulandıysa son edited
//     varyantın asset'i, yoksa orijinal source asset.
//
// Default active item:
//   - `activeItemId === null` + items.length > 0 → ilk item gösterilir
//     (görsel olarak; store reset davranışını bozmamak için store'a yazmaz).
//   - StudioShell tarafında ayrı bir useEffect `setActiveItemId(items[0].id)`
//     diye senkronize eder ki Filmstrip'te border accent doğru render olsun.
//
// Phase 6 disiplini: tüm görsel değerler token üzerinden; thumb için
// `AssetImage` (Phase 5 emsal) reuse edilir, raw `<img>` kullanılmaz.

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AssetImage } from "@/components/ui/asset-image";
import { useStudioStore } from "@/features/selection/stores/studio-store";
import type { SelectionItemView } from "@/features/selection/queries";

export type PreviewCardProps = {
  /** Set'in items array'i (position asc sıralı; backend mapper). */
  items: SelectionItemView[];
};

/** Aktif görüntü asset id'si: edited varsa o, yoksa source. */
function getActiveAssetId(item: SelectionItemView): string {
  return item.editedAssetId ?? item.sourceAssetId;
}

/** İki haneli sıfırla padded sayı: 3 → "03". Mockup'la birebir. */
function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function PreviewCard({ items }: PreviewCardProps) {
  const activeItemId = useStudioStore((s) => s.activeItemId);
  const setActiveItemId = useStudioStore((s) => s.setActiveItemId);

  if (items.length === 0) {
    return (
      <Card className="flex min-h-0 flex-1 flex-col items-center justify-center bg-surface-2 p-8">
        <p className="text-sm text-text-muted">Henüz varyant yok</p>
      </Card>
    );
  }

  // activeItemId null veya geçersiz → ilk item (görsel default).
  const explicitIdx = activeItemId
    ? items.findIndex((i) => i.id === activeItemId)
    : -1;
  const activeIdx = explicitIdx >= 0 ? explicitIdx : 0;
  const activeItem = items[activeIdx]!;

  const isFirst = activeIdx <= 0;
  const isLast = activeIdx >= items.length - 1;

  const handlePrev = () => {
    if (isFirst) return;
    const target = items[activeIdx - 1];
    if (target) setActiveItemId(target.id);
  };

  const handleNext = () => {
    if (isLast) return;
    const target = items[activeIdx + 1];
    if (target) setActiveItemId(target.id);
  };

  const positionLabel = `${pad2(activeIdx + 1)} / ${pad2(items.length)}`;

  return (
    <Card className="flex min-h-0 flex-1 flex-col items-center bg-surface-2 p-4">
      <div className="flex w-full max-w-content flex-col">
        <div className="mb-2 flex items-center justify-between">
          <Badge tone="accent" dot>
            Varyant {positionLabel}
          </Badge>
          {/* Boyut metadata Phase 7 v1'de Asset row'a inmedi → placeholder.
              İleride asset.metadata.width × height + DPI eklenecek. */}
          <span className="font-mono text-xs text-text-muted">—</span>
        </div>

        <div className="overflow-hidden rounded-md border border-border bg-surface">
          <AssetImage
            assetId={getActiveAssetId(activeItem)}
            alt={`Varyant ${pad2(activeIdx + 1)}`}
          />
        </div>

        <div className="mt-3 flex items-center justify-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            icon={<ChevronLeft className="h-4 w-4" aria-hidden />}
            onClick={handlePrev}
            disabled={isFirst}
          >
            Önceki
          </Button>
          <span className="font-mono text-xs text-text-muted">
            {positionLabel}
          </span>
          <Button
            variant="ghost"
            size="sm"
            iconRight={<ChevronRight className="h-4 w-4" aria-hidden />}
            onClick={handleNext}
            disabled={isLast}
          >
            Sonraki
          </Button>
        </div>
      </div>
    </Card>
  );
}
