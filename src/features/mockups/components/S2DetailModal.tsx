"use client";

// Phase 8 Task 27 — S2 Detail Modal (Customize Workflow Step 2)
//
// Spec §5.4 verbatim: Center modal, template detay preview (static, V1'de
// gerçek render YOK). Meta (aspect/vibe/room/composition + render time).
// Ekle/Çıkar CTA, min/max enforcement (1-8 template).
//
// Pattern: Phase 7 CreateSetModal (Radix Dialog center modal + Dialog.Title/Description).
// Hook kontratları: useMockupOverlayState (Task 15), useMockupPackState (Task 14).

import * as Dialog from "@radix-ui/react-dialog";
import type { MockupTemplateView } from "@/features/mockups/hooks/useMockupTemplates";

export type S2DetailModalProps = {
  /** Modal açık mı? (?templateId= query'den gelir) */
  open: boolean;
  /** Modal state değişimi. Route update hook tarafından tutulur. */
  onOpenChange: (open: boolean) => void;
  /** Template detay (useMockupTemplates'ten gelmiş, Spec §5.4). */
  template: MockupTemplateView | null;
  /** Şu anki template pakette seçili mi? */
  isSelected: boolean;
  /** Toggle callback (Ekle/Çıkar — URL'yi günceller). */
  onToggleTemplate: (id: string) => void;
  /** Paket toplam seçili sayısı (max enforcement için, 8 cap). */
  selectedCount: number;
};

export function S2DetailModal({
  open,
  onOpenChange,
  template,
  isSelected,
  onToggleTemplate,
  selectedCount,
}: S2DetailModalProps) {
  // Handle CTA click (Ekle/Çıkar)
  const handleToggle = () => {
    if (template) {
      onToggleTemplate(template.id);
    }
  };

  // CTA disable condition: ekleme denemesi ama 8 dolu (Spec §5.4 line 1252)
  const isCtaDisabled = !isSelected && selectedCount >= 8;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-text/60 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-white p-6 shadow-popover outline-none"
          aria-label={`${template?.name ?? "Template"} detayı`}
        >
          {template && (
            <>
              {/* Header */}
              <div className="flex items-center justify-between">
                <Dialog.Title className="text-lg font-semibold">
                  {template.name}
                </Dialog.Title>
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  aria-label="Kapat"
                  className="text-lg font-bold text-text-muted hover:text-text"
                >
                  ×
                </button>
              </div>

              {/* Static preview placeholder (Spec §5.4 line 1247-1249: V1'de preview = static) */}
              <div
                className="mt-4 aspect-video rounded-md bg-zinc-100"
                aria-label="Template önizleme"
              />

              {/* Meta fields (Spec §5.4 satır 1238-1241) */}
              <div className="mt-4 space-y-1 text-sm text-text-muted">
                <div>
                  <strong>Aspect:</strong> {template.aspectRatios.join(", ")}
                </div>
                <div>
                  <strong>Tags:</strong> {template.tags.join(", ")}
                </div>
                <div>
                  <strong>Tahmini render süresi:</strong>{" "}
                  ~{Math.ceil(template.estimatedRenderMs / 1000)} saniye
                </div>
              </div>

              {/* CTA (Spec §5.4 satır 1243: Ekle/Çıkar toggle) */}
              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={handleToggle}
                  disabled={isCtaDisabled}
                  className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {isSelected
                    ? "✓ Pakette • Çıkar"
                    : "+ Pakete ekle"}
                </button>
              </div>

              {/* Max enforcement warning (Spec §5.4 line 1252-1254) */}
              {isCtaDisabled && (
                <p
                  role="alert"
                  className="mt-2 text-xs text-amber-700"
                >
                  En fazla 8 template ekleyebilirsin
                </p>
              )}
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
