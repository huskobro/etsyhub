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
  /* Phase 65 — Ownership scope filter ("Admin templates" / "My templates"). */
  const [ownershipFilter, setOwnershipFilter] = useState<
    "all" | "global" | "own"
  >("all");

  // Min/max enforcement toast state (3sn auto-clear)
  const [showMaxWarning, setShowMaxWarning] = useState(false);

  /* Phase 65 — Ownership counts for tab badges. */
  const ownershipCounts = useMemo(() => {
    let global = 0;
    let own = 0;
    for (const t of templates) {
      if (t.ownership === "own") own++;
      else global++;
    }
    return { global, own, all: templates.length };
  }, [templates]);

  // Filter logic (Spec §5.3 line 1208: filter chip'ler client-side query)
  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      if (
        ownershipFilter === "global" && t.ownership !== "global"
      ) {
        return false;
      }
      if (ownershipFilter === "own" && t.ownership !== "own") {
        return false;
      }
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
  }, [templates, ownershipFilter, vibeFilter, roomFilter, aspectFilter]);

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
              Template library
            </Dialog.Title>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Close"
              className="text-lg font-bold text-text-muted hover:text-text"
            >
              ×
            </button>
          </div>

          {/* Phase 65 — Ownership tab strip (Admin / My / All).
           *   Templated.io ürün modeli: operatör admin catalog ile kendi
           *   library'sini ayrı görsün. Counts badge ile kaç template
           *   olduğu net. CLAUDE.md "USER_TEMPLATE" sözleşmesinin
           *   ürün surface'i. */}
          <div
            className="flex gap-1 border-b border-border bg-bg px-6 py-2"
            role="tablist"
            aria-label="Template ownership scope"
            data-testid="template-library-ownership-tabs"
          >
            {(
              [
                { id: "all", label: "All", count: ownershipCounts.all },
                {
                  id: "global",
                  label: "Admin templates",
                  count: ownershipCounts.global,
                },
                {
                  id: "own",
                  label: "My templates",
                  count: ownershipCounts.own,
                },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={ownershipFilter === tab.id}
                onClick={() => setOwnershipFilter(tab.id)}
                className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  ownershipFilter === tab.id
                    ? "bg-accent text-accent-foreground"
                    : "text-text-muted hover:bg-surface-2 hover:text-text"
                }`}
                data-testid="template-library-ownership-tab"
                data-ownership={tab.id}
              >
                {tab.label}
                <span
                  className={`font-mono text-[10px] tabular-nums ${
                    ownershipFilter === tab.id ? "opacity-80" : "opacity-60"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
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

          {/* Phase 65 — Empty state for ownership scope (esp. "My templates"
           *   first-upload prompt). When operator selects "My templates" tab
           *   and own catalog is empty, show actionable hint pointing to
           *   the user-scope create endpoint (POST /api/mockup-templates).
           *   The full upload UI editor is Phase 66 candidate. */}
          {filteredTemplates.length === 0 ? (
            <div
              className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center"
              data-testid="template-library-empty-state"
              data-scope={ownershipFilter}
            >
              {ownershipFilter === "own" ? (
                <>
                  <div className="text-base font-semibold text-text">
                    No templates of your own yet
                  </div>
                  <p className="mt-2 max-w-xs text-xs text-text-muted">
                    Templated.io-style: create your own mockup template
                    and reuse it across selections. Self-hosted (no API
                    calls) — your library, your library limit.
                  </p>
                  <div className="mt-4 flex flex-col items-center gap-2">
                    {/* Phase 66 — First create CTA. Lands at user-facing
                     *   create form (/templates/mockups/new). */}
                    <a
                      href="/templates/mockups/new"
                      className="inline-flex items-center gap-1 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground hover:opacity-90"
                      data-testid="template-library-empty-create-cta"
                    >
                      + Create your first template
                    </a>
                    <button
                      type="button"
                      onClick={() => setOwnershipFilter("global")}
                      className="rounded-md border border-border bg-white px-3 py-1.5 text-xs font-medium text-text hover:bg-surface-2"
                      data-testid="template-library-empty-switch-admin"
                    >
                      Or browse admin templates →
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-sm font-semibold text-text">
                    No templates match
                  </div>
                  <p className="mt-1 text-xs text-text-muted">
                    Clear filters or switch tab.
                  </p>
                </>
              )}
            </div>
          ) : null}

          {/* Grid (Spec §5.3 satır 1193-1201: 8 template grid) */}
          <div className="grid grid-cols-2 gap-4 overflow-auto px-6 py-4 sm:grid-cols-3">
            {filteredTemplates.map((template) => (
              /* Phase 70 — Card is a relative wrapper so we can layer an
                 absolute "Edit" link for own templates without nesting buttons. */
              <div key={template.id} className="relative">
                <button
                  type="button"
                  onClick={() => onOpenTemplateModal(template.id)}
                  className="relative w-full rounded-md border border-border p-2 hover:bg-surface-2 text-left transition-colors"
                  aria-label={`${template.name} detayını aç`}
                  data-testid="template-card"
                  data-ownership={template.ownership}
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

                {/* Phase 70 — Edit entry for user-owned templates only.
                    Layered as overlay link to avoid nested button semantics.
                    Discoverable: visible by default, hover emphasizes. */}
                {template.ownership === "own" ? (
                  <a
                    href={`/templates/mockups/${template.id}/edit`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenChange(false);
                    }}
                    className="absolute left-2 top-2 z-10 inline-flex h-6 items-center gap-1 rounded-md border border-line bg-paper px-2 font-mono text-[10px] font-semibold uppercase tracking-meta text-ink-2 shadow-sm hover:border-k-orange hover:text-k-orange-ink"
                    title="Edit this template"
                    aria-label={`Edit ${template.name}`}
                    data-testid="template-card-edit-link"
                  >
                    Edit
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
