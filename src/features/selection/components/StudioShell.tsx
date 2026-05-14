"use client";

// Phase 7 Task 25 + Task 26 — Selection Studio shell.
//
// Spec Section 3.2 (Studio canvas — üç bölgeli layout):
//   - Üst bar: set adı + status badge + "İndir (ZIP)" + "Set'i finalize et"
//     + kebap menü (Archive). Aksiyonlar bu task'te STUB onClick — Task
//     35-37'de bağlanır (FinalizeModal, ExportButton, ArchiveAction).
//   - Layout: grid 1fr 320px (sol canvas + filmstrip; sağ panel).
//   - Sol bölge: PreviewCard + Filmstrip (Task 26).
//   - Sağ panel: header + içerik placeholder (Task 27-30 doldurur).
//   - Read-only banner: status !== "draft" → finalize sonrası uyarı banner'ı
//     ("Phase 8 Mockup Studio'da işlenecek").
//   - Aksiyon disabled: read-only durumda Finalize ve İndir disabled
//     (Task 36'da export gerçek logic; v1 stub disabled — placeholder).
//
// Store etkileşimi:
//   - `useEffect` ile `setCurrentSetId(setId)` çağrılır → set değişimi
//     state reset tetikler.
//   - `activeItemId === null` + items boş değilse ilk item'a senkronize edilir
//     (Filmstrip border accent + PreviewCard tutarlılığı). Task 26.
//
// Phase 6 paterni: page.tsx server component → client component mount;
// veri TanStack Query üzerinden client'ta (`useSelectionSet`).

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { StateMessage } from "@/components/ui/StateMessage";
import { Skeleton } from "@/components/ui/Skeleton";
import { useSelectionSet } from "@/features/selection/queries";
import { useStudioStore } from "@/features/selection/stores/studio-store";
import { PreviewCard } from "./PreviewCard";
import { Filmstrip } from "./Filmstrip";
import { RightPanel } from "./RightPanel";
import { SelectionBulkBar } from "./SelectionBulkBar";
import { BulkHardDeleteDialog } from "./BulkHardDeleteDialog";
import { FinalizeModal } from "./FinalizeModal";
import { ExportButton } from "./ExportButton";
import { ArchiveAction } from "./ArchiveAction";
import { StudioToastSlot } from "./StudioToastSlot";
import { MjOriginBar } from "./MjOriginBar";
import type { SelectionSet } from "@prisma/client";

export type StudioShellProps = {
  setId: string;
};

/** Status → badge tone + display label (title-case kilidi: Badge primitive
 *  upper/lower-case transform yapmaz, biz literal stringi geçeriz). */
const STATUS_LABEL: Record<SelectionSet["status"], string> = {
  draft: "Draft",
  ready: "Ready",
  archived: "Archived",
};

const STATUS_TONE: Record<SelectionSet["status"], BadgeTone> = {
  draft: "accent",
  ready: "success",
  archived: "neutral",
};

export function StudioShell({ setId }: StudioShellProps) {
  const setCurrentSetId = useStudioStore((s) => s.setCurrentSetId);
  const activeItemId = useStudioStore((s) => s.activeItemId);
  const setActiveItemId = useStudioStore((s) => s.setActiveItemId);
  const { data: set, isLoading, error } = useSelectionSet(setId);

  // Task 33 + Task 34 — Bulk hard delete pending state.
  // SelectionBulkBar `onHardDeleteRequest(ids)` → state güncelleme →
  // BulkHardDeleteDialog `hardDeletePendingIds.length > 0` ile açılır.
  // Modal kapanırsa (success / cancel / error close) state sıfırlanır →
  // dialog `open=false` ile unmount edilir.
  const [hardDeletePendingIds, setHardDeletePendingIds] = useState<string[]>(
    [],
  );

  // Task 35 — FinalizeModal open/close state. Üst bar Finalize butonu
  // setFinalizeOpen(true) ile modal'ı açar. Modal `selected ≥ 1` gate'ini
  // server-side endpoint öncesi UI'da gösterir.
  const [finalizeOpen, setFinalizeOpen] = useState(false);

  // Set değişince store reset (yeni setId → activeItemId/multiSelect/filter
  // sıfırlanır). Store içi guard aynı setId'de no-op.
  useEffect(() => {
    setCurrentSetId(setId);
  }, [setId, setCurrentSetId]);

  // Default active item: data load sonrası activeItemId hâlâ null ise ilk
  // item'a senkronize et — Filmstrip border accent ve PreviewCard preview
  // tutarlılığı için (PreviewCard görsel default veriyor ama store yazımı
  // burada yapılır ki diğer UI parçaları da aynı state'i görsün).
  useEffect(() => {
    if (!set) return;
    if (activeItemId === null && set.items.length > 0) {
      setActiveItemId(set.items[0]!.id);
    }
  }, [set, activeItemId, setActiveItemId]);

  if (isLoading) {
    return <StudioShellLoading />;
  }
  if (error || !set) {
    return <StudioShellError />;
  }

  const isReadOnly = set.status !== "draft";
  const statusLabel = STATUS_LABEL[set.status];
  const statusTone = STATUS_TONE[set.status];

  // Selected count: status === "selected" item sayısı (multi-select state'i
  // değil — multi-select bulk action içindir, "seçili" status'un kendisi).
  const selectedCount = set.items.filter((i) => i.status === "selected").length;

  // Task 35 — Finalize gate UX (StudioShell tarafı).
  //
  // İki kademeli savunma:
  //   1) StudioShell üst bar butonu: 0 selected → disabled + native title
  //      tooltip ("En az 1 'Seçime ekle' yapılmış varyant gerekli"). Modal
  //      hiç açılmaz; kullanıcı yanlış aksiyona girmez.
  //   2) FinalizeModal kendisi: items prop'u değişebilir (modal açıkken
  //      başka bir tab/window'da değişiklik). Modal içinde de gate uyarısı
  //      görünür + Finalize buton disabled.
  //   3) Server-side: POST /finalize endpoint (Task 22) FinalizeGateError
  //      409 fırlatır — defense in depth.
  //
  // Read-only durumda (status !== "draft") buton zaten disabled. Tooltip
  // sadece draft + 0 selected durumunda gösterilir.
  const finalizeDisabled = isReadOnly || selectedCount === 0;
  const finalizeTooltip =
    !isReadOnly && selectedCount === 0
      ? "Mark at least 1 variant as selected before finalizing"
      : undefined;

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Pass 91 — MJ Origin Bar (handoff sonrası bağlam çubuğu).
          sourceMetadata.mjOrigin yoksa null döner; legacy/manual set'lerde
          görünmez. */}
      <MjOriginBar sourceMetadata={set.sourceMetadata} />

      {/* Üst bar */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-lg font-semibold text-text">
              {set.name}
            </h1>
            <Badge tone={statusTone}>{statusLabel}</Badge>
          </div>
          <p className="text-sm text-text-muted">
            {set.items.length} variant{set.items.length === 1 ? "" : "s"} ·{" "}
            {selectedCount} selected
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ExportButton
            setId={setId}
            itemCount={set.items.length}
            activeExport={set.activeExport}
          />
          <Button
            variant="primary"
            disabled={finalizeDisabled}
            onClick={() => setFinalizeOpen(true)}
            title={finalizeTooltip}
          >
            Finalize selection
          </Button>
          {/* Task 37 — ArchiveAction (set kebap menü minimal). Archived set'te
              ArchiveAction null döner; spec Section 4.3 (archived → archived
              geçişi yok). */}
          <ArchiveAction setId={setId} setStatus={set.status} />
        </div>
      </div>

      {isReadOnly && (
        <div
          role="note"
          data-testid="selection-handoff-banner"
          className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface-2 px-4 py-3 text-sm text-text-muted"
        >
          <span>
            Selection finalized — next step is applying mockups to prepare a
            product listing.
          </span>
          {set.status === "ready" && (
            /* Phase 78 — legacy /selection/sets/[id] StudioShell
                (Phase 7 baseline selection studio, ayrı route ailesi)
                handoff banner artık mockup studio'ya çıkar (canonical
                final ürün entry). */
            <Link
              href={`/selection/sets/${setId}/mockup/studio`}
              data-testid="selection-handoff-apply-mockups"
              className="shrink-0 rounded-md bg-text px-3 py-1.5 text-xs font-medium text-bg hover:opacity-90"
            >
              Open in Studio →
            </Link>
          )}
        </div>
      )}

      {/* Üç bölgeli layout */}
      <div className="grid flex-1 gap-4 overflow-hidden lg:grid-cols-[1fr_20rem]">
        {/* Sol: aktif preview + filmstrip (Task 26) */}
        <div className="flex flex-col gap-3 overflow-hidden">
          <PreviewCard items={set.items} />
          <Filmstrip setId={setId} items={set.items} setStatus={set.status} />
        </div>

        {/* Sağ panel: Edit header + AI Kalite + bottom actions (Task 27).
            Hızlı işlem (Task 28) ve Edit history (Task 30) placeholder
            tutucular RightPanel içinde. Edit prompt Phase 7'de YOK. */}
        <RightPanel setId={setId} items={set.items} setStatus={set.status} />
      </div>

      {/* Task 33 — Multi-select sticky bottom bar. Bar `multiSelectIds.size > 0`
          + `!isReadOnly` durumunda görünür; aksi halde null döner (DOM yok). */}
      <SelectionBulkBar
        setId={setId}
        isReadOnly={isReadOnly}
        onHardDeleteRequest={setHardDeletePendingIds}
      />

      {/* Task 34 — Hard delete TypingConfirmation modal. Modal kapanırsa
          (success / cancel) state sıfırlanır → dialog unmount. */}
      <BulkHardDeleteDialog
        setId={setId}
        itemIds={hardDeletePendingIds}
        open={hardDeletePendingIds.length > 0}
        onOpenChange={(next) => {
          if (!next) setHardDeletePendingIds([]);
        }}
      />

      {/* Task 35 — FinalizeModal. Üst bar Finalize butonu açar; gate
          UI'da görünür (selected ≥ 1) + dürüst breakdown + 409 error
          handling. Success → invalidate → modal close. */}
      <FinalizeModal
        setId={setId}
        items={set.items}
        open={finalizeOpen}
        onOpenChange={setFinalizeOpen}
      />

      {/* Task 39 — page-level Toast slot. Heavy edit + export
          completion/failure event'leri inline UI'ya ek olarak burada
          görünür. Mikro state için notification yok. */}
      <StudioToastSlot />
    </div>
  );
}

/**
 * Loading iskeleti — `role="status"` wrapper Phase 6 paterniyle.
 * Atomic Skeleton primitive `aria-hidden`; shell wrapper'a status rolü verir.
 */
function StudioShellLoading() {
  return (
    <div
      role="status"
      aria-label="Loading set"
      className="flex h-full flex-col gap-4"
    >
      <Skeleton className="h-12 w-full" />
      <div className="grid flex-1 gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-3">
          <Skeleton shape="rect" className="h-64" />
          <Skeleton shape="rect" className="h-32" />
        </div>
        <Skeleton shape="rect" className="h-full" />
      </div>
    </div>
  );
}

function StudioShellError() {
  return (
    <Card>
      <StateMessage
        tone="error"
        title="Set failed to load"
        body="The set data is unavailable or not found. Reload the page or return to the selection list."
      />
    </Card>
  );
}
