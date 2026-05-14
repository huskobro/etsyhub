"use client";

// Phase 8 Task 23 — S3 Apply view (4-zone iskelet).
// Phase 8 Task 24-25 — Gerçek component'ler + submit logic.
//
// Spec §5.2: Sticky header + Set Özeti + Pack Önizleme + Sticky karar bandı.
//
// Hook bağlama:
//   - useSelectionSet (Phase 7) — set veri kaynağı
//   - useMockupTemplates (Task 22) — template katalog
//   - useMockupPackState (Task 14) — selected templates + dirty state
//   - useMockupOverlayState (Task 15) — drawer/modal URL state

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSelectionSet } from "@/features/selection/queries";
import { useMockupTemplates } from "@/features/mockups/hooks/useMockupTemplates";
import { useMockupPackState } from "@/features/mockups/hooks/useMockupPackState";
import { useMockupOverlayState } from "@/features/mockups/hooks/useMockupOverlayState";
import { SetSummaryCard } from "./SetSummaryCard";
import { PackPreviewCard } from "./PackPreviewCard";
import { DecisionBand } from "./DecisionBand";
import { S1BrowseDrawer } from "./S1BrowseDrawer";
import { S2DetailModal } from "./S2DetailModal";
import {
  SlotAssignmentPanel,
  type SlotAssignmentKeptItem,
  type SlotAssignmentMap,
} from "./SlotAssignmentPanel";

export function S3ApplyView({ setId }: { setId: string }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: set, isLoading: setLoading } = useSelectionSet(setId);
  // V2 multi-category (HEAD `5eabffc`+): categoryId set'in items[0].
  // productTypeKey'inden derive edilir; V1 hardcoded "canvas" fallback.
  // Bu sayede sticker/wall_art/poster vb. ProductType'lı set'ler
  // hardcoded canvas template havuzuna düşmez.
  const setItems = (set as { items?: Array<{ productTypeKey?: string | null }> } | undefined)?.items;
  const categoryId = setItems?.[0]?.productTypeKey ?? "canvas";
  const { data: templates = [], isLoading: templatesLoading } =
    useMockupTemplates({ categoryId });
  const packState = useMockupPackState(setId);
  const overlayState = useMockupOverlayState();

  /* Phase 76 — Multi-slot template detection + slot assignment state.
   * Multi-slot template seçildiğinde panel açılır; operator slot başına
   * farklı kept item atayabilir. Tek-slot template'lerde panel render
   * edilmez (mevcut Phase 8 fanout akışı intakt).
   *
   * State client-side; Phase 77 render execution wiring sırası bu
   * mapping job submit body'sine slotDesigns olarak iletilebilir
   * (mevcut createMockupJob shape genişletilirse). Phase 76 scope:
   * UI + persistence client memory + preview confidence.
   */
  const multiSlotTemplate = useMemo(() => {
    if (packState.selectedTemplateIds.length === 0) return null;
    // Birden fazla seçili template varsa: en yüksek slotCount'lu olanı
    // panel başlığında göster (operator hangi template'i multi-slot
    // edited tek bakışta görmeli). Operator UI ileride per-template
    // slot mapping yapabilir; Phase 76 scope = yalnız ilk multi-slot
    // template.
    let best: (typeof templates)[number] | null = null;
    for (const t of templates) {
      if (!packState.selectedTemplateIds.includes(t.id)) continue;
      if (t.slotCount > 1 && (!best || t.slotCount > best.slotCount)) {
        best = t;
      }
    }
    return best;
  }, [packState.selectedTemplateIds, templates]);

  const keptItemsForPanel: SlotAssignmentKeptItem[] = useMemo(() => {
    const items =
      (set as { items?: Array<{ id: string; position: number }> } | undefined)
        ?.items ?? [];
    return items
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((it, idx) => ({
        id: it.id,
        label: `Item ${idx + 1}`,
        // Phase 76 scope — full thumbnail wiring Phase 77 ile birlikte
        // (selection asset meta'ya thumbnail URL eklenince). Şu an
        // operator slot'ları label ile ayırt ediyor; thumbnail null fallback
        // panel'de "—" placeholder gösteriyor.
        thumbnailUrl: null,
      }));
  }, [set]);

  const [slotAssignments, setSlotAssignments] = useState<SlotAssignmentMap>({});

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/mockup/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setId,
          categoryId,
          templateIds: packState.selectedTemplateIds,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const message =
          body?.error ?? body?.message ?? `HTTP ${res.status}`;
        throw new Error(message);
      }
      const { jobId } = await res.json();
      // S7 Job sayfası: src/app/(app)/selection/sets/[setId]/mockup/jobs/[jobId]/page.tsx (Task 28)
      router.push(`/selection/sets/${setId}/mockup/jobs/${jobId}`);
    } finally {
      setIsSubmitting(false);
    }
  }, [setId, categoryId, packState.selectedTemplateIds, router]);

  if (setLoading || templatesLoading) {
    return <div className="p-6 text-sm text-text-muted">Loading…</div>;
  }

  if (!set) {
    return <div className="p-6 text-sm text-text-muted">Set not found.</div>;
  }

  const isQuickPack = !packState.isCustom;
  const actualPackSize = packState.selectedTemplateIds.length;

  return (
    <main className="flex min-h-screen flex-col bg-white">
      {/* Zone 1: Sticky üst bar */}
      <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-border bg-white px-6 py-3">
        <nav className="text-sm text-text-muted">
          <span>← </span>
          <a href="/selections" className="hover:text-text">
            Selections
          </a>
          <span className="mx-1.5">/</span>
          <a href={`/selections/${setId}`} className="hover:text-text">
            {set.name}
          </a>
          <span className="mx-1.5">/</span>
          <span
            className="font-medium text-text"
            data-testid="apply-view-role-label"
          >
            Quick pack render
          </span>
        </nav>
        {/* Phase 78 — Final ürün kararı: Mockup Studio Kivasy'nin nihai
            mockup çalışma yüzeyidir. Apply route artık "Quick pack render
            orchestrator" olarak konumlanır (mevcut Phase 8 fan-out pipeline
            + S7/S8 result view'a verir). Operatör mockup/frame authoring
            için Studio'ya çıkar — primary CTA topbar'da kalıcı entry. */}
        <a
          href={`/selection/sets/${setId}/mockup/studio`}
          className="k-btn k-btn--primary"
          data-size="sm"
          data-testid="apply-view-studio-link"
        >
          Open in Studio →
        </a>
      </header>

      {/* Phase 78 — Studio canonical handoff banner. Apply view'a düşen
          operatöre net ürün dili: tam authoring (slot map, mode switch,
          frame output, preset rail) Studio'da; Apply Quick pack hızlı
          render orchestrator olarak yaşar. */}
      <div
        className="flex items-start gap-3 border-b border-k-orange/40 bg-k-orange-soft/40 px-6 py-3 text-[12.5px] text-ink"
        data-testid="apply-view-studio-banner"
        role="status"
      >
        <span
          className="mt-0.5 inline-flex h-2 w-2 flex-shrink-0 rounded-full bg-k-orange"
          aria-hidden
        />
        <div className="flex flex-1 flex-wrap items-center gap-x-4 gap-y-1.5">
          <div className="font-medium leading-tight text-ink">
            Open in Studio for the full authoring experience
            <span className="ml-1 font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
              Mockup + Frame modes · slot assignment · preset rail · export
            </span>
          </div>
          <span className="ml-auto font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
            This view stays for Quick pack render
          </span>
        </div>
      </div>

      {/* Body: scrollable */}
      <div className="flex-1 space-y-6 px-6 py-6">
        {/* Zone 2: Set Özeti (Task 24) */}
        <SetSummaryCard
          set={set}
          isQuickPack={isQuickPack}
          selectedCount={actualPackSize}
        />

        {/* Zone 3: Pack Önizleme (Task 25) */}
        <PackPreviewCard
          set={set}
          isQuickPack={isQuickPack}
          selectedTemplateIds={packState.selectedTemplateIds}
          allTemplates={templates}
          isDirty={packState.isDirty}
          onCustomizeClick={overlayState.openCustomizeDrawer}
          onToggleTemplate={packState.toggleTemplate}
        />

        {/* Phase 76 — Multi-slot template seçildiğinde slot assignment panel.
         * Phase 80 demote: Studio (`/mockup/studio`) artık canonical
         * slot-aware authoring yüzeyi (sidebar slot footer + inline
         * picker + slot-mapped render dispatch). Apply view "Quick pack
         * render orchestrator" rolüne çekildi — operatöre dürüst
         * handoff: multi-slot edit istiyorsan Studio'ya çık. Panel
         * hâlâ visible (Quick pack tek-tıkla render path fanout fallback),
         * ama üstte Studio handoff hint banner ile rol netleştirilmiş. */}
        {multiSlotTemplate ? (
          <>
            <div
              className="flex flex-wrap items-center gap-2 rounded-md border border-k-orange/30 bg-k-orange-soft/40 px-4 py-2.5 text-[12px] text-ink"
              data-testid="apply-view-multi-slot-demote-hint"
              role="note"
            >
              <span className="font-mono text-[10.5px] uppercase tracking-meta text-k-orange-ink">
                Multi-slot template
              </span>
              <span className="text-ink-2">
                Advanced slot-mapped authoring (per-slot picker, sticky
                state, dispatch body) lives in
              </span>
              <a
                href={`/selection/sets/${setId}/mockup/studio`}
                className="font-mono text-[11px] font-semibold tracking-meta text-k-orange-ink hover:text-k-orange"
                data-testid="apply-view-multi-slot-studio-link"
              >
                Mockup Studio →
              </a>
              <span className="ml-auto font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
                Quick pack here uses fanout fallback
              </span>
            </div>
            <SlotAssignmentPanel
              slotCount={multiSlotTemplate.slotCount}
              templateName={multiSlotTemplate.name}
              keptItems={keptItemsForPanel}
              assignments={slotAssignments}
              onChange={setSlotAssignments}
              onOpenPsdImport={undefined /* Phase 77 — PSDImportDialog wire */}
            />
          </>
        ) : null}
      </div>

      {/* Zone 4: Sticky karar bandı (Task 25) */}
      <DecisionBand
        isQuickPack={isQuickPack}
        selectedCount={actualPackSize}
        isDirty={packState.isDirty}
        isSubmitting={isSubmitting}
        onSubmit={handleSubmit}
        onReset={packState.resetToQuickPack}
      />

      {/* Task 26 + 27: Customize Drawer + Detail Modal */}
      <S1BrowseDrawer
        open={overlayState.isCustomizeOpen}
        onOpenChange={(open) =>
          open
            ? overlayState.openCustomizeDrawer()
            : overlayState.closeCustomize()
        }
        templates={templates}
        selectedTemplateIds={packState.selectedTemplateIds}
        onToggleTemplate={packState.toggleTemplate}
        onOpenTemplateModal={overlayState.openTemplateModal}
      />

      <S2DetailModal
        open={overlayState.modalTemplateId !== null}
        onOpenChange={(open) => {
          if (!open) overlayState.closeTemplateModal();
        }}
        template={
          overlayState.modalTemplateId
            ? templates.find((t) => t.id === overlayState.modalTemplateId) ?? null
            : null
        }
        isSelected={
          overlayState.modalTemplateId
            ? packState.selectedTemplateIds.includes(overlayState.modalTemplateId)
            : false
        }
        onToggleTemplate={packState.toggleTemplate}
        selectedCount={packState.selectedTemplateIds.length}
      />
    </main>
  );
}
