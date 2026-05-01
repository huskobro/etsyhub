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

import { useEffect, useState } from "react";
import { Download, MoreVertical } from "lucide-react";
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

  // Task 33 — Bulk hard delete pending state. Task 34'te
  // TypingConfirmation modal'ı bu state'e bağlanacak; şu an callback yalnız
  // state'i tutuyor (UI etki yok). `setHardDeletePendingIds` parent
  // sözleşmesi: SelectionBulkBar `onHardDeleteRequest(ids)` çağrısı → state
  // güncelleme → Task 34 modal `hardDeletePendingIds.length > 0` ile açılır.
  const [, setHardDeletePendingIds] = useState<string[]>([]);

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

  return (
    <div className="flex h-full flex-col gap-4">
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
            {set.items.length} varyant · {selectedCount} seçili
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            icon={<Download className="h-4 w-4" aria-hidden />}
            disabled={isReadOnly}
            onClick={() => {
              // Task 36 ExportButton (queue başlatma + activeExport state) bağlayacak
            }}
          >
            İndir (ZIP)
          </Button>
          <Button
            variant="primary"
            disabled={isReadOnly}
            onClick={() => {
              // Task 35 FinalizeModal trigger
            }}
          >
            Set&apos;i finalize et
          </Button>
          <button
            type="button"
            aria-label="Set seçenekleri"
            className="grid h-control-md w-control-md place-items-center rounded-md border border-border bg-surface text-text-muted transition-colors duration-fast ease-out hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => {
              // Task 37 ArchiveAction (DropdownMenu trigger)
            }}
          >
            <MoreVertical className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      {isReadOnly && (
        <div
          role="note"
          className="rounded-md border border-border bg-surface-2 px-4 py-3 text-sm text-text-muted"
        >
          Bu set finalize edildi — Phase 8 Mockup Studio&apos;da işlenecek.
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
      aria-label="Set yükleniyor"
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
        title="Set yüklenemedi"
        body="Set bilgisi alınamadı veya bulunamadı. Sayfayı yenileyin ya da seçim listesine dönün."
      />
    </Card>
  );
}
