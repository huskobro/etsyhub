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

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AssetImage } from "@/components/ui/asset-image";
import { useStudioStore } from "@/features/selection/stores/studio-store";
import type { SelectionItemView } from "@/features/selection/queries";
import { MjItemOriginBadges } from "./MjItemOriginBadges";

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

/** Pass 33 — Asset boyut etiketi (örn "1024×1024" veya "—"). */
function formatDimensions(w: number | null, h: number | null): string {
  if (w == null || h == null) return "—";
  return `${w}×${h}`;
}

// Pass 33 — Compare mode: edit yapılmış item'larda PreviewCard görünür alan
// tek modu olmaktan çıktı. "edited" (default; edit aktif), "original"
// (sourceAsset ile karşılaştırma) — kullanıcı düzenlemenin etkisini güvenle
// görüyor. Edit yoksa toggle render edilmez.
type CompareMode = "edited" | "original";

export function PreviewCard({ items }: PreviewCardProps) {
  const activeItemId = useStudioStore((s) => s.activeItemId);
  const setActiveItemId = useStudioStore((s) => s.setActiveItemId);

  // Compare mode state — item değişiminde "edited"a sıfırla; aksi halde
  // bir item için "original" seçildiyse bir sonraki item'da yanlış kalır.
  const [compareMode, setCompareMode] = useState<CompareMode>("edited");

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

  // Pass 33 — Compare derived state.
  const hasEdited = activeItem.editedAssetId !== null;
  const showOriginal = hasEdited && compareMode === "original";
  const displayedAssetId = showOriginal
    ? activeItem.sourceAssetId
    : getActiveAssetId(activeItem);
  const displayedAsset = showOriginal
    ? activeItem.sourceAsset
    : (activeItem.editedAsset ?? activeItem.sourceAsset);
  const dimensionLabel = formatDimensions(
    displayedAsset?.width ?? null,
    displayedAsset?.height ?? null,
  );

  return (
    <Card className="flex min-h-0 flex-1 flex-col items-center bg-surface-2 p-4">
      <div className="flex w-full max-w-content flex-col">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="accent" dot>
              Varyant {positionLabel}
            </Badge>
            {/* Pass 33 — edit yapılmış item'da "Düzenlenmiş" rozeti.
                Mod "original" iken rozet gizli (kullanıcı orijinali
                görüyor; rozet kafa karıştırırdı). */}
            {hasEdited && !showOriginal ? (
              <Badge tone="success" data-testid="edited-badge">
                Düzenlenmiş
              </Badge>
            ) : null}
            {showOriginal ? (
              <Badge tone="neutral" data-testid="original-badge">
                Orijinal
              </Badge>
            ) : null}
            {/* Pass 91 — MJ origin badges (variant kind + batch link + job
                link). mjOrigin null ise sessiz. */}
            <MjItemOriginBadges origin={activeItem.mjOrigin} />
          </div>
          {/* Pass 33 — Boyut metadata: asset.width × asset.height (DB'den).
              Pre-Pass 33 placeholder "—" idi; gerçek değer artık görünür. */}
          <span
            className="font-mono text-xs text-text-muted"
            data-testid="preview-dimensions"
          >
            {dimensionLabel}
          </span>
        </div>

        <div className="overflow-hidden rounded-md border border-border bg-surface">
          <AssetImage
            assetId={displayedAssetId}
            alt={
              showOriginal
                ? `Varyant ${pad2(activeIdx + 1)} — orijinal`
                : `Varyant ${pad2(activeIdx + 1)}`
            }
          />
        </div>

        {/* Pass 33 — Önce / Sonra toggle. Sadece edit yapılmış item'da
            görünür. Değişim anında DB roundtrip yok; sadece local state
            (signed URL cache zaten useQuery üzerinden). */}
        {hasEdited ? (
          <CompareToggle
            mode={compareMode}
            onChange={setCompareMode}
            itemId={activeItem.id}
          />
        ) : null}

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

// ────────────────────────────────────────────────────────────
// CompareToggle — Pass 33 inline subcomponent
// ────────────────────────────────────────────────────────────
//
// Edit yapılmış item'da "Düzenlenmiş ↔ Orijinal" toggle. Item değişiminde
// (itemId prop'u ile) "edited"a sıfırlar — bir item'da "original" bırakıp
// sonraki item'a geçince yanlış kalmaz.
//
// Aksesibilite: role="radiogroup" + aria-checked, klavye tab ile geçiş.

type CompareToggleProps = {
  mode: CompareMode;
  onChange: (mode: CompareMode) => void;
  itemId: string;
};

function CompareToggle({ mode, onChange, itemId }: CompareToggleProps) {
  // Item değişiminde "edited" reset — useEffect ile.
  useEffect(() => {
    onChange("edited");
    // itemId değişiminde reset; onChange stable; sadece itemId watch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  return (
    <div
      role="radiogroup"
      aria-label="Düzenlenmiş ya da orijinal görseli göster"
      className="mt-2 inline-flex self-center rounded-md border border-border bg-surface p-0.5"
      data-testid="compare-toggle"
    >
      <button
        type="button"
        role="radio"
        aria-checked={mode === "edited"}
        onClick={() => onChange("edited")}
        className={`rounded-sm px-3 py-1 text-xs transition-colors ${
          mode === "edited"
            ? "bg-accent text-accent-foreground"
            : "text-text-muted hover:text-text"
        }`}
        data-testid="compare-toggle-edited"
      >
        Düzenlenmiş
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={mode === "original"}
        onClick={() => onChange("original")}
        className={`rounded-sm px-3 py-1 text-xs transition-colors ${
          mode === "original"
            ? "bg-accent text-accent-foreground"
            : "text-text-muted hover:text-text"
        }`}
        data-testid="compare-toggle-original"
      >
        Orijinal
      </button>
    </div>
  );
}
