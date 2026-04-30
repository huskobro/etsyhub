"use client";

// Phase 7 Task 27 — Selection Studio sağ panel (RightPanel).
//
// Spec Section 3.2 + mockup B.13 (`screens-b.jsx:862`):
//   - Header: "Edit" + "Varyant N düzenleniyor" (border-bottom).
//   - AI Kalite bölümü (AiQualityPanel) — review var/yok her halde render.
//   - Hızlı işlem placeholder — Task 28 dolduracak (yer tutucu OK; panel
//     yapısı baştan netleşsin).
//   - Edit prompt → Phase 7'de KOMPLE GİZLİ (mockup'ta var, spec gereği
//     burada YOK; honesty kuralı, fake capability vermez).
//   - Edit history placeholder — Task 30 dolduracak.
//   - Bottom action'lar: "Reddet" + "Seçime ekle" (Task 20 status mutation).
//   - Read-only set (status !== "draft") → bottom action'lar render edilmez.
//
// Bottom action UX kararı (toggle):
//   Mockup'ta toggle yok (her zaman "Reddet" / "Seçime ekle"); fakat Section
//   4.4 state machine 6 yön geçişi tanımlıyor. Final ürün hissi için toggle
//   tercih edildi: selected'e "Seçimden çıkar", rejected'a "Reddi geri al".
//   Pragmatik improvement — kullanıcı bilinçli pending'e dönebilir, mockup
//   tonu bozulmadı (renk + konum aynı; yalnız label değişir).
//
// Mutation: PATCH /api/selection/sets/[setId]/items/[itemId] (Task 20).
// Başarı sonrası selection set query invalidate → liste fresh fetch.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useStudioStore } from "../stores/studio-store";
import {
  selectionSetQueryKey,
  type SelectionItemView,
  type SelectionSetStatus,
} from "../queries";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { AiQualityPanel } from "./AiQualityPanel";
import { QuickActions } from "./QuickActions";

export type RightPanelProps = {
  setId: string;
  items: SelectionItemView[];
  setStatus: SelectionSetStatus;
};

type ItemStatus = SelectionItemView["status"];

const SECTION_LABEL_CLASS =
  "font-mono text-xs uppercase tracking-meta text-text-muted";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function RightPanel({ setId, items, setStatus }: RightPanelProps) {
  const activeItemId = useStudioStore((s) => s.activeItemId);
  const queryClient = useQueryClient();

  // Aktif item resolve: store id varsa onu, yoksa items[0] (default).
  // Filmstrip border-accent ve PreviewCard ile aynı sözleşme.
  const activeItem: SelectionItemView | null = activeItemId
    ? (items.find((i) => i.id === activeItemId) ?? items[0] ?? null)
    : (items[0] ?? null);

  const isReadOnly = setStatus !== "draft";

  const statusMutation = useMutation({
    mutationFn: async ({
      itemId,
      status,
    }: {
      itemId: string;
      status: ItemStatus;
    }) => {
      const res = await fetch(
        `/api/selection/sets/${setId}/items/${itemId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );
      if (!res.ok) {
        let detail = "";
        try {
          const body = (await res.json()) as { error?: string };
          detail = typeof body.error === "string" ? body.error : "";
        } catch {
          // ignore
        }
        throw new Error(
          detail
            ? `Durum güncellenemedi (${res.status}): ${detail}`
            : `Durum güncellenemedi (${res.status})`,
        );
      }
      return (await res.json()) as { item: SelectionItemView };
    },
    onSuccess: () => {
      // Set detay query'sini invalidate → items[] fresh fetch.
      queryClient.invalidateQueries({ queryKey: selectionSetQueryKey(setId) });
    },
  });

  // Boş items → "Varyant seçilmedi" (header subtitle değişir, bottom yok).
  if (activeItem === null) {
    return (
      <Card className="flex flex-col overflow-hidden p-0">
        <div className="border-b border-border-subtle px-4 py-3">
          <div className="text-md font-semibold text-text">Edit</div>
          <div className="mt-1 text-xs text-text-muted">Varyant seçilmedi</div>
        </div>
        <div className="p-4 text-sm text-text-muted">
          Filmstrip&apos;ten bir varyant seçin.
        </div>
      </Card>
    );
  }

  // 1-based padded variant numarası (filmstrip ile tutarlı).
  const activeIdx = items.findIndex((i) => i.id === activeItem.id);
  const variantNumber = activeIdx >= 0 ? pad2(activeIdx + 1) : "—";

  const handleSelectClick = () => {
    if (isReadOnly || statusMutation.isPending) return;
    const next: ItemStatus =
      activeItem.status === "selected" ? "pending" : "selected";
    statusMutation.mutate({ itemId: activeItem.id, status: next });
  };

  const handleRejectClick = () => {
    if (isReadOnly || statusMutation.isPending) return;
    const next: ItemStatus =
      activeItem.status === "rejected" ? "pending" : "rejected";
    statusMutation.mutate({ itemId: activeItem.id, status: next });
  };

  // Bottom action label + variant — toggle UX (yukarıdaki açıklama).
  const rejectLabel =
    activeItem.status === "rejected" ? "Reddi geri al" : "Reddet";
  const selectLabel =
    activeItem.status === "selected" ? "Seçimden çıkar" : "Seçime ekle";
  const rejectVariant =
    activeItem.status === "rejected" ? "primary" : "secondary";
  const selectVariant =
    activeItem.status === "selected" ? "primary" : "secondary";

  return (
    <Card className="flex flex-col overflow-hidden p-0">
      {/* Header */}
      <div className="border-b border-border-subtle px-4 py-3">
        <div className="text-md font-semibold text-text">Edit</div>
        <div className="mt-1 text-xs text-text-muted">
          Varyant {variantNumber} düzenleniyor
        </div>
      </div>

      {/* AI Kalite */}
      <AiQualityPanel item={activeItem} />

      {/* Hızlı işlem (Task 28: QuickActions) */}
      <QuickActions setId={setId} item={activeItem} setStatus={setStatus} />

      {/* Edit history placeholder (Task 30: UndoResetBar + history) */}
      <div className="flex-1 px-4 py-3">
        <div className={SECTION_LABEL_CLASS}>İşlem geçmişi</div>
        <p className="mt-2 text-xs text-text-muted">
          Geçmiş ve geri al/sıfırla Task 30&apos;da eklenecek.
        </p>
      </div>

      {/* Bottom actions — yalnız draft set'te */}
      {!isReadOnly ? (
        <div className="flex gap-2 border-t border-border-subtle px-4 py-3">
          <Button
            variant={rejectVariant}
            size="sm"
            className="flex-1"
            onClick={handleRejectClick}
            disabled={statusMutation.isPending}
          >
            {rejectLabel}
          </Button>
          <Button
            variant={selectVariant}
            size="sm"
            className="flex-1"
            onClick={handleSelectClick}
            disabled={statusMutation.isPending}
          >
            {selectLabel}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
