"use client";

// Phase 8 Task 25 — PackPreviewCard.
//
// Spec §5.2 Zone 3: Pack önizleme kartı.
//
// Gösterilenler:
//   - Pack türü badge (★ Quick Pack | Custom Pack)
//   - Seçili template say
//   - Template grid / kart listesi (thumbnail, name, aspect ratio)
//   - Özelleştir butonu (Task 15 drawer link'e bağlanır)
//   - Uyumsuzluk uyarısı (gerekiyorsa)
//   - Boş durumu (seçilmiş yok)
//
// Kullanım:
//   S3ApplyView Zone 3 placeholder replace (§5.2)

import { type SelectionSetDetailView } from "@/features/selection/queries";
import { type MockupTemplateView } from "@/features/mockups/hooks/useMockupTemplates";
import { TemplateChip } from "./TemplateChip";
import { EmptyPackState } from "./EmptyPackState";
import { IncompatibleSetBand } from "./IncompatibleSetBand";

export interface PackPreviewCardProps {
  set: SelectionSetDetailView;
  isQuickPack: boolean;
  selectedTemplateIds: string[];
  allTemplates: MockupTemplateView[];
  isDirty: boolean;
  onCustomizeClick: () => void;
  onToggleTemplate: (templateId: string) => void;
}

/**
 * Spec §5.2 Zone 3 — Pack önizleme kartı.
 *
 * İçerik:
 * - Pack türü + sayı
 * - Template grid
 * - Customize buton (drawer link)
 * - Empty/incompatible state'ler
 */
export function PackPreviewCard({
  set,
  isQuickPack,
  selectedTemplateIds,
  allTemplates,
  isDirty,
  onCustomizeClick,
  onToggleTemplate,
}: PackPreviewCardProps) {
  // Seçili template'leri bul
  const selectedTemplates = allTemplates.filter((t) =>
    selectedTemplateIds.includes(t.id),
  );

  // Uyumsuzluk uyarısı: set boş ve custom pack seçilmişse göster
  const hasIncompatibleWarning =
    selectedTemplateIds.length === 0 && !isQuickPack;

  return (
    <section
      aria-label="Pack preview"
      className="space-y-4 rounded-md border border-border p-4"
    >
      {/* Header: pack type + count */}
      <div className="flex items-center gap-2">
        <span
          data-testid="pack-badge"
          className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-900"
        >
          {isQuickPack ? "★ Quick pack" : "Custom pack"}
        </span>
        <span className="text-sm text-text">
          • {selectedTemplateIds.length} image{selectedTemplateIds.length === 1 ? "" : "s"} to render
        </span>
        {isDirty && (
          <span
            className="ml-auto inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700"
            title="Different from the default Quick pack"
          >
            Customized
          </span>
        )}
      </div>

      {/* Uyumsuzluk uyarısı */}
      {hasIncompatibleWarning && <IncompatibleSetBand />}

      {/* Template grid / empty state */}
      {selectedTemplateIds.length === 0 ? (
        <EmptyPackState onCustomizeClick={onCustomizeClick} />
      ) : (
        <div className="space-y-3">
          <p className="text-xs font-medium text-text-muted">
            Seçili Şablonlar
          </p>
          <div className="flex flex-wrap gap-2">
            {selectedTemplates.map((template) => (
              <TemplateChip
                key={template.id}
                template={template}
                isSelected={true}
                onToggle={() => onToggleTemplate(template.id)}
                disabled={isQuickPack}
              />
            ))}
          </div>
        </div>
      )}

      {/* Customize button (drawer trigger) */}
      {!isQuickPack && (
        <button
          type="button"
          onClick={onCustomizeClick}
          className="mt-4 block w-full rounded-md border border-border bg-white px-3 py-2 text-sm font-medium text-text hover:bg-surface"
        >
          Şablonları Özelleştir
        </button>
      )}
    </section>
  );
}
