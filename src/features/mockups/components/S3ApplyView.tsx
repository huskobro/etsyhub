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

import { useCallback, useState } from "react";
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

export function S3ApplyView({ setId }: { setId: string }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: set, isLoading: setLoading } = useSelectionSet(setId);
  const { data: templates = [], isLoading: templatesLoading } =
    useMockupTemplates({ categoryId: "canvas" });
  const packState = useMockupPackState(setId);
  const overlayState = useMockupOverlayState();

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/mockup/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setId,
          categoryId: "canvas",
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
  }, [setId, packState.selectedTemplateIds, router]);

  if (setLoading || templatesLoading) {
    return <div className="p-6 text-sm text-text-muted">Yükleniyor…</div>;
  }

  if (!set) {
    return <div className="p-6 text-sm text-text-muted">Set bulunamadı.</div>;
  }

  const isQuickPack = !packState.isCustom;
  const actualPackSize = packState.selectedTemplateIds.length;

  return (
    <main className="flex min-h-screen flex-col bg-white">
      {/* Zone 1: Sticky üst bar */}
      <header className="sticky top-0 z-10 border-b border-border bg-white px-6 py-3">
        <nav className="text-sm text-text-muted">
          <span>← </span>
          <a href="/selection" className="hover:text-text">
            Selection
          </a>
          <span className="mx-1.5">/</span>
          <a href={`/selection/sets/${setId}`} className="hover:text-text">
            {set.name}
          </a>
          <span className="mx-1.5">/</span>
          <span className="font-medium text-text">Mockup Studio</span>
        </nav>
      </header>

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
