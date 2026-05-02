"use client";

// Phase 8 Task 26 — S1 Browse Drawer (Customize Workflow Step 1)
//
// Spec §5.3 verbatim: Sağdan slide-in drawer, template kütüphanesi.
// 8-template grid (quick pack default'dan gelmiş). Vibe/room/aspect filtreleri.
// Min/max enforcement (1-8 template).
//
// Pattern: Phase 7 AddVariantsDrawer (Radix Dialog sağdan slide-in fixed panel).
// Hook kontratları: useMockupTemplates (Task 22), useMockupPackState (Task 14).

import { useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import type { MockupTemplateView } from "@/features/mockups/hooks/useMockupTemplates";

export type S1BrowseDrawerProps = {
  /** Drawer açık mı? (?customize=1 query'den gelir) */
  open: boolean;
  /** Drawer state değişimi. Route update hook tarafından tutulur. */
  onOpenChange: (open: boolean) => void;
  /** Template katalog (useMockupTemplates'ten gelmiş 8 template). */
  templates: MockupTemplateView[];
  /** Seçili template ID'leri (useMockupPackState'ten gelmiş). */
  selectedTemplateIds: string[];
  /** Toggle callback (Template ekle/çıkar — URL'yi günceller). */
  onToggleTemplate: (id: string) => void;
  /** Modal aç callback (template detayı göster — ?templateId= set eder). */
  onOpenTemplateModal: (templateId: string) => void;
  /**
   * Opsiyonel: Set'in aspect ratio'ları (aspect filter default'ı).
   * Spec §5.3 line 1209: aspect filter default = set'in aspect'leri ile uyumlu olanlar.
   * Yoksa boş array → aspect filter All gösterir.
   */
  setAspectRatios?: string[];
};

/**
 * Vibe, room, aspect filter tarafı. Spec §5.3 §5.3 satır 1213-1215.
 */
const FILTER_VIBES = [
  "Modern",
  "Scandinavian",
  "Boho",
  "Minimalist",
  "Vintage",
  "Playful",
];
const FILTER_ROOMS = [
  "Living Room",
  "Bedroom",
  "Office",
  "Nursery",
  "Hallway",
  "Dining",
];
const FILTER_ASPECTS = ["1:1", "2:3", "3:4"];

export function S1BrowseDrawer({
  open,
  onOpenChange,
  templates,
  selectedTemplateIds,
  onToggleTemplate,
  onOpenTemplateModal,
  setAspectRatios,
}: S1BrowseDrawerProps) {
  // Local filter state (client-side, memoized filtreleme)
  const [vibeFilter, setVibeFilter] = useState("");
  const [roomFilter, setRoomFilter] = useState("");
  const [aspectFilter, setAspectFilter] = useState(
    // Default: set'in ilk aspect'i, yoksa boş (All)
    () => setAspectRatios?.[0] ?? ""
  );

  // Min/max enforcement toast state (3sn auto-clear)
  const [showMaxWarning, setShowMaxWarning] = useState(false);

  // Filter logic (Spec §5.3 line 1208: filter chip'ler client-side query)
  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      if (vibeFilter && !t.tags.some((tag) => tag.includes(vibeFilter))) {
        return false;
      }
      if (roomFilter && !t.tags.some((tag) => tag.includes(roomFilter))) {
        return false;
      }
      if (aspectFilter && !t.aspectRatios.includes(aspectFilter)) {
        return false;
      }
      return true;
    });
  }, [templates, vibeFilter, roomFilter, aspectFilter]);

  // Handle template toggle (Spec §5.3 line 1217-1218 max enforcement)
  const handleToggleTemplate = (templateId: string) => {
    const isCurrentlySelected = selectedTemplateIds.includes(templateId);

    // Max enforcement: ekleme denemesi ama dolu → warning
    if (!isCurrentlySelected && selectedTemplateIds.length >= 8) {
      setShowMaxWarning(true);
      setTimeout(() => setShowMaxWarning(false), 3000);
      return;
    }

    // Gerçek toggle
    onToggleTemplate(templateId);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-text/40" />
        <Dialog.Content
          className="fixed inset-y-0 right-0 flex h-full w-full max-w-md flex-col border-l border-border bg-white shadow-popover outline-none"
          aria-label="Template kütüphanesi"
        >
          {/* Header (Spec §5.3 satır 1187) */}
          <div className="flex items-center justify-between border-b border-border px-6 py-3">
            <Dialog.Title className="text-base font-semibold">
              Template Kütüphanesi
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

          {/* Filter chips (Spec §5.3 satır 1189) */}
          <div className="flex gap-2 border-b border-border px-6 py-3">
            <select
              value={vibeFilter}
              onChange={(e) => setVibeFilter(e.target.value)}
              aria-label="Vibe filtresi"
              className="rounded-md border border-border bg-white px-3 py-2 text-sm"
            >
              <option value="">Tüm vibe&apos;lar</option>
              {FILTER_VIBES.map((vibe) => (
                <option key={vibe} value={vibe}>
                  {vibe}
                </option>
              ))}
            </select>

            <select
              value={roomFilter}
              onChange={(e) => setRoomFilter(e.target.value)}
              aria-label="Oda filtresi"
              className="rounded-md border border-border bg-white px-3 py-2 text-sm"
            >
              <option value="">Tüm odalar</option>
              {FILTER_ROOMS.map((room) => (
                <option key={room} value={room}>
                  {room}
                </option>
              ))}
            </select>

            <select
              value={aspectFilter}
              onChange={(e) => setAspectFilter(e.target.value)}
              aria-label="Aspect filtresi"
              className="rounded-md border border-border bg-white px-3 py-2 text-sm"
            >
              <option value="">Tümü</option>
              {FILTER_ASPECTS.map((aspect) => (
                <option key={aspect} value={aspect}>
                  {aspect}
                </option>
              ))}
            </select>
          </div>

          {/* Pakette bilgisi (Spec §5.3 satır 1191) */}
          <div className="px-6 py-2 text-sm text-text-muted">
            Pakette: {selectedTemplateIds.length} template
          </div>

          {/* Min enforcement: 0 seçiliyse uyarı */}
          {selectedTemplateIds.length === 0 && (
            <div
              role="alert"
              className="mx-6 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700"
            >
              En az 1 template seç
            </div>
          )}

          {/* Max enforcement: 8 seçiliyse ve ekleme denemesi yapılmışsa uyarı */}
          {showMaxWarning && (
            <div
              role="alert"
              aria-live="polite"
              className="mx-6 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700"
            >
              En fazla 8 template ekleyebilirsin
            </div>
          )}

          {/* Grid (Spec §5.3 satır 1193-1201: 8 template grid) */}
          <div className="grid grid-cols-2 gap-4 overflow-auto px-6 py-4 sm:grid-cols-3">
            {filteredTemplates.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => onOpenTemplateModal(template.id)}
                className="relative rounded-md border border-border p-2 hover:bg-surface-2 text-left transition-colors"
                aria-label={`${template.name} detayını aç`}
              >
                {/* Thumbnail placeholder (V1: gerçek render YOK, Spec §5.4 satır 1247) */}
                <div
                  className="h-24 w-full rounded bg-zinc-100"
                  aria-hidden
                />

                {/* Template adı */}
                <div className="mt-2 text-sm font-medium">{template.name}</div>

                {/* Seçili badge (Spec §5.3 satır 1205) */}
                {selectedTemplateIds.includes(template.id) && (
                  <span
                    className="absolute right-2 top-2 rounded-full bg-amber-50 px-1.5 py-0.5 text-xs text-amber-900"
                    aria-label="Pakette"
                  >
                    ✓
                  </span>
                )}
              </button>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
