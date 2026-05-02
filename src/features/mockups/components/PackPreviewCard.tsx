// Phase 8 Task 25 — Pack Önizleme kartı (Quick/Custom karar yüzeyi).
//
// Spec §5.2.2: Quick Pack badge, template grid, uyumluluk uyarıları,
// yan taşma/özelleştir drawer linki, "Bu pack'ı özelleştir" aksiyonu.
//
// Props: isQuickPack, selectedTemplateIds, templates, incompatibleTemplateIds, onOpenCustomize
// Bağlantılar: useMockupPackState → packState.isCustom
// Alt componentler: TemplateChip, EmptyPackState, IncompatibleSetBand

import { memo } from "react";
import { TemplateChip } from "./TemplateChip";
import { EmptyPackState } from "./EmptyPackState";
import { IncompatibleSetBand } from "./IncompatibleSetBand";

interface PackPreviewCardProps {
  isQuickPack?: boolean;
  selectedTemplateIds?: string[];
  templates?: {
    id: string;
    name: string;
    category?: string;
    assetCompatible?: boolean;
  }[];
  incompatibleTemplateIds?: string[];
  incompatibleReason?: string;
  onOpenCustomize?: () => void;
  onTemplateSelect?: (templateId: string, selected: boolean) => void;
}

function PackPreviewCardComponent({
  isQuickPack = true,
  selectedTemplateIds = [],
  templates = [],
  incompatibleTemplateIds = [],
  incompatibleReason,
  onOpenCustomize,
  onTemplateSelect,
}: PackPreviewCardProps) {
  const isEmpty = selectedTemplateIds.length === 0;
  const hasIncompatible = incompatibleTemplateIds.length > 0;

  return (
    <section
      aria-label="Pack önizleme"
      className="rounded-md border border-border p-4"
      data-testid="pack-preview-card"
    >
      {/* Başlık: Quick/Custom Pack badge + özet */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <span
            data-testid="pack-badge"
            className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-900"
          >
            {isQuickPack ? "★ Quick Pack" : "⚙ Custom Pack"}
          </span>
          <span className="text-sm text-text">
            • {selectedTemplateIds.length} şablon seçildi
          </span>
        </div>

        {/* Özelleştir butonu (Custom Pack'i aç drawer'da) */}
        {onOpenCustomize && (
          <button
            type="button"
            onClick={onOpenCustomize}
            className="text-xs font-medium text-orange-600 hover:text-orange-700 hover:underline"
            data-testid="open-customize-button"
          >
            Düzenleme
          </button>
        )}
      </div>

      {/* Template grid veya Empty state */}
      <div className="mt-4">
        {isEmpty ? (
          <EmptyPackState onOpenTemplates={onOpenCustomize} />
        ) : (
          <>
            {/* Uyumsuzluk uyarısı (varsa) */}
            {hasIncompatible && incompatibleReason && (
              <div className="mb-3">
                <IncompatibleSetBand
                  reason={incompatibleReason}
                  affectedCount={incompatibleTemplateIds.length}
                />
              </div>
            )}

            {/* Seçili şablonlar grid (yalnızca seçili olanları göster) */}
            <div className="flex flex-wrap gap-2">
              {templates.map((template) => {
                const isSelected = selectedTemplateIds.includes(template.id);
                const isIncompatible = incompatibleTemplateIds.includes(
                  template.id
                );

                // Seçili veya uyumsuz olanları göster; diğerlerini gizle (custom pack kolayı)
                if (!isSelected && !isIncompatible) return null;

                return (
                  <TemplateChip
                    key={template.id}
                    templateId={template.id}
                    name={template.name}
                    category={template.category}
                    selected={isSelected}
                    incompatibleReason={
                      isIncompatible ? "Bu şablon set ile uyumlu değil" : undefined
                    }
                    onSelect={onTemplateSelect}
                  />
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Alt metin: tamamlanan görseller sayısı veya uyarı */}
      <p className="mt-3 text-xs text-text-muted">
        {isEmpty
          ? "Render et butonunu etkinleştirmek için şablon seçin"
          : `${selectedTemplateIds.length} şablon × ayarlar = ${
              selectedTemplateIds.length * 4
            } render işi (tahmini)`}
      </p>
    </section>
  );
}

export const PackPreviewCard = memo(PackPreviewCardComponent);
