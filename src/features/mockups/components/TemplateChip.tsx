// Phase 8 Task 25 — Template seçim çipi (Quick/Custom pack içinde).
//
// Spec §5.2.2b: Şablonun adı, kategori, seçim durumu, hover
// tooltip (uyumluluk, asset count), template özelleştir linki.
//
// Props: templateId, name, category, selected, incompatibleReason?, assetCount, onSelect
// Aksiyonlar: click seçim toggle, tooltip uyumluluk

import { memo } from "react";

interface TemplateChipProps {
  templateId: string;
  name: string;
  category?: string;
  selected?: boolean;
  incompatibleReason?: string;
  assetCount?: number;
  onSelect?: (templateId: string, selected: boolean) => void;
}

function TemplateChipComponent({
  templateId,
  name,
  category = "generic",
  selected = false,
  incompatibleReason,
  assetCount = 1,
  onSelect,
}: TemplateChipProps) {
  const isDisabled = !!incompatibleReason;

  const handleClick = () => {
    if (!isDisabled && onSelect) {
      onSelect(templateId, !selected);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isDisabled}
      title={
        incompatibleReason
          ? `Uyumsuz: ${incompatibleReason}`
          : `${name} (${assetCount} sayıda)`
      }
      data-testid={`template-chip-${templateId}`}
      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition ${
        isDisabled
          ? "cursor-not-allowed bg-zinc-100 text-zinc-400 opacity-50"
          : selected
            ? "bg-orange-600 text-white"
            : "border border-border bg-surface hover:bg-surface-2"
      }`}
    >
      {/* Seçim göstergesi */}
      {selected && (
        <span aria-label="seçili">✓</span>
      )}

      {/* İsim + kategori */}
      <span className="flex flex-col gap-0.5 text-left">
        <span>{name}</span>
        {category && (
          <span
            className={`text-xs ${
              isDisabled
                ? "text-zinc-400"
                : selected
                  ? "text-orange-100"
                  : "text-text-muted"
            }`}
          >
            {category}
          </span>
        )}
      </span>

      {/* Asset count badge */}
      {assetCount > 0 && (
        <span
          className={`ml-auto text-xs ${
            isDisabled
              ? "text-zinc-400"
              : selected
                ? "bg-orange-500 text-white"
                : "bg-zinc-200 text-zinc-700"
          } rounded px-1`}
        >
          {assetCount}
        </span>
      )}
    </button>
  );
}

export const TemplateChip = memo(TemplateChipComponent);
