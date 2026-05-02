"use client";

// Phase 8 Task 23 — S3 Apply view (4-zone iskelet).
//
// Spec §5.2: Sticky header + Set Özeti + Pack Önizleme + Sticky karar bandı.
// Task 24: SetSummaryCard entegre
// Task 25: PackPreviewCard + DecisionBand + TemplateChip + EmptyPackState + IncompatibleSetBand
//
// Hook bağlama:
//   - useSelectionSet (Phase 7) — set veri kaynağı
//   - useMockupTemplates (Task 22) — template katalog
//   - useMockupPackState (Task 14) — selected templates + dirty state
//   - useMockupOverlayState (Task 15) — drawer/modal URL state

import { useState } from "react";
import { useSelectionSet } from "@/features/selection/queries";
import { useMockupTemplates } from "@/features/mockups/hooks/useMockupTemplates";
import { useMockupPackState } from "@/features/mockups/hooks/useMockupPackState";
import { useMockupOverlayState } from "@/features/mockups/hooks/useMockupOverlayState";
import { SetSummaryCard } from "./SetSummaryCard";
import { PackPreviewCard } from "./PackPreviewCard";
import { DecisionBand } from "./DecisionBand";

export function S3ApplyView({ setId }: { setId: string }) {
  const { data: set, isLoading: setLoading } = useSelectionSet(setId);
  const { data: templates = [], isLoading: templatesLoading } =
    useMockupTemplates({ categoryId: "canvas" });
  const packState = useMockupPackState(setId);
  const overlayState = useMockupOverlayState();

  // Render durumu (Task 25: 9-state coverage)
  const [renderState, setRenderState] = useState<
    "empty" | "incompatible" | "rendering" | "error" | "success" | "locked" | "retry" | "override" | "ready"
  >("ready");
  const [errorMessage, setErrorMessage] = useState<string>();
  const [isRendering, setIsRendering] = useState(false);

  if (setLoading || templatesLoading) {
    return <div className="p-6 text-sm text-text-muted">Yükleniyor…</div>;
  }

  const isQuickPack = !packState.isCustom;
  const actualPackSize = packState.selectedTemplateIds.length;
  const hasIncompatible = (packState.incompatibleTemplateIds?.length ?? 0) > 0;

  // Durum belirle
  let decidedState = renderState;
  if (actualPackSize === 0) decidedState = "empty";
  else if (hasIncompatible) decidedState = "incompatible";

  const handleRender = async () => {
    setRenderState("rendering");
    setIsRendering(true);
    setErrorMessage(undefined);

    try {
      // Simule: gerçek API çağrısı Task 25'te bağlanacak
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setRenderState("success");
    } catch (err) {
      setRenderState("error");
      setErrorMessage((err as Error)?.message || "Render başarısız");
    } finally {
      setIsRendering(false);
    }
  };

  const handleOpenCustomize = () => {
    // Task 25: drawer açma (customize-pack drawer'ı)
    overlayState.openCustomizeDrawer();
  };

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
            {set?.name ?? "Set"}
          </a>
          <span className="mx-1.5">/</span>
          <span className="font-medium text-text">Mockup Studio</span>
        </nav>
      </header>

      {/* Body: scrollable */}
      <div className="flex-1 space-y-6 px-6 py-6">
        {/* Zone 2: Set Özeti (Task 24) */}
        <SetSummaryCard
          setId={setId}
          setName={set?.name}
          assetCount={(set as any)?.assetCount ?? 0}
          avgQualityScore={(set as any)?.avgQualityScore ?? 0}
          collections={(set as any)?.collections ?? []}
        />

        {/* Zone 3: Pack Önizleme (Task 25) */}
        <PackPreviewCard
          isQuickPack={isQuickPack}
          selectedTemplateIds={packState.selectedTemplateIds}
          templates={templates}
          incompatibleTemplateIds={packState.incompatibleTemplateIds}
          incompatibleReason={packState.incompatibleReason}
          onOpenCustomize={handleOpenCustomize}
          onTemplateSelect={(templateId, selected) => {
            // Task 25: template seçim toggle (packState'de tutulacak)
            packState.toggleTemplate(templateId);
          }}
        />
      </div>

      {/* Zone 4: Sticky karar bandı (Task 25) */}
      <DecisionBand
        state={decidedState}
        isQuickPack={isQuickPack}
        packSize={actualPackSize}
        estimatedSeconds={30}
        errorMessage={errorMessage}
        isDisabled={false}
        isDirty={packState.isDirty}
        onRender={handleRender}
        onCancel={() => {
          setRenderState("ready");
          setIsRendering(false);
        }}
      />
    </main>
  );
}
