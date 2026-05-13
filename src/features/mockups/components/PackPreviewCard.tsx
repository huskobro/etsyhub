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

  /* Phase 56 — EN parity + Kivasy DS migration:
   *   - border-border → border-line bg-paper
   *   - bg-amber-50 text-amber-900 quick-pack badge → bg-k-orange-soft +
   *     border-k-orange/40 + text-k-orange-ink mono uppercase recipe
   *     (Phase 51 status badge family parity)
   *   - bg-blue-100 text-blue-700 Customized chip → bg-k-bg-2 +
   *     border-line-soft + text-ink-2 mono recipe
   *   - text-text / text-text-muted → text-ink / text-ink-3
   *   - "Seçili Şablonlar" → "Selected templates" (mono uppercase)
   *   - "Şablonları Özelleştir" → "Customize templates"
   *   - Customize button raw `bg-white border border-border` →
   *     k-btn k-btn--secondary recipe */
  return (
    <section
      aria-label="Pack preview"
      data-testid="mockup-pack-preview-card"
      className="space-y-4 rounded-lg border border-line bg-paper p-4"
    >
      {/* Header: pack type + count */}
      <div className="flex flex-wrap items-center gap-2">
        <span
          data-testid="pack-badge"
          className="inline-flex items-center rounded-md border border-k-orange/40 bg-k-orange-soft px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-meta text-k-orange-ink shadow-sm"
        >
          {isQuickPack ? "★ Quick pack" : "Custom pack"}
        </span>
        <span className="text-sm text-ink">
          · {selectedTemplateIds.length} image{selectedTemplateIds.length === 1 ? "" : "s"} to render
        </span>
        {isDirty && (
          <span
            className="ml-auto inline-flex items-center rounded-md border border-line-soft bg-k-bg-2 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-meta text-ink-2"
            title="Different from the default Quick pack"
          >
            Customized
          </span>
        )}
      </div>

      {/* Incompatible warning */}
      {hasIncompatibleWarning && <IncompatibleSetBand />}

      {/* Template grid / empty state */}
      {selectedTemplateIds.length === 0 ? (
        <EmptyPackState onCustomizeClick={onCustomizeClick} />
      ) : (
        <div className="space-y-3">
          <p className="font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
            Selected templates
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
          className="k-btn k-btn--secondary w-full"
          data-size="sm"
          data-testid="mockup-pack-customize"
        >
          Customize templates
        </button>
      )}
    </section>
  );
}
