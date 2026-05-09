"use client";

import { useEffect, useState } from "react";
import { Layers, ArrowRight } from "lucide-react";
import { Modal } from "@/features/library/components/Modal";
import { useSelectionSets } from "@/features/selection/queries";

/**
 * AddToSelectionModal — Library → Selection handoff entry point.
 *
 * Source: docs/IMPLEMENTATION_HANDOFF.md §5 (Library/Selections boundary).
 *
 * Library ekranı bulk-bar veya detail-panel "Add to Selection" CTA'sı bu
 * modal'ı açar. Modal, kullanıcının mevcut draft set'lerini listeler;
 * bir set seçilince yeni endpoint'e POST atar (`/api/selection/sets/[setId]
 * /items/from-library`). R4'te endpoint sözleşmesi:
 *
 *   POST /api/selection/sets/[setId]/items/from-library
 *   body: { midjourneyAssetIds: string[] }
 *   200:  { itemsAdded: number, itemsAlreadyInSet: number,
 *           promotedCreated: number, promotedAlready: number }
 *   409:  set ready/archived (READ-ONLY).
 *   422:  set'in sourceMetadata reference/productType yoksa hand-off
 *         desteklenmiyor → operatöre legacy quick-start önerilir.
 *
 * Boundary discipline:
 *   - Yeni set yaratma R4'te scope dışı; "Pick existing draft" tek yol.
 *     Yeni set'i operatör legacy `/selection` üzerinden quick-start ile
 *     açar; bu kısıtlama R5'te `Pick a reference + product type` adımıyla
 *     gevşer.
 */

interface AddToSelectionModalProps {
  midjourneyAssetIds: string[];
  /** Modal kapanırken çağrılır (success/cancel). */
  onClose: () => void;
  /** Success callback — bulk-bar / detail-panel state'i temizleyebilir. */
  onSuccess?: (result: HandoffResult) => void;
}

interface HandoffResult {
  setId: string;
  itemsAdded: number;
  itemsAlreadyInSet: number;
  promotedCreated: number;
  promotedAlready: number;
}

export function AddToSelectionModal({
  midjourneyAssetIds,
  onClose,
  onSuccess,
}: AddToSelectionModalProps) {
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Yalnız draft setler hand-off hedefi (ready/archived read-only).
  const { data: draftSets, isLoading } = useSelectionSets("draft");

  useEffect(() => {
    // Auto-pick: tek draft set varsa direkt highlight.
    if (!pickedId && draftSets && draftSets.length === 1) {
      const only = draftSets[0];
      if (only) setPickedId(only.id);
    }
  }, [draftSets, pickedId]);

  async function handleConfirm() {
    if (!pickedId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/selection/sets/${pickedId}/items/from-library`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ midjourneyAssetIds }),
        },
      );
      if (!res.ok) {
        const detail = await res
          .json()
          .catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(
          (detail as { error?: string }).error ??
            `Hand-off başarısız (${res.status})`,
        );
      }
      const data = (await res.json()) as HandoffResult;
      onSuccess?.(data);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hand-off başarısız");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Add to Selection"
      onClose={onClose}
      size="md"
      footer={
        <>
          <span className="text-xs text-text-muted">
            {midjourneyAssetIds.length} asset(s) selected
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-paper px-3 text-xs font-medium text-ink-2 hover:border-line-strong hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!pickedId || busy}
              data-size="sm"
              className="k-btn k-btn--primary"
              data-testid="add-to-selection-confirm"
            >
              <ArrowRight className="h-3 w-3" aria-hidden />
              {busy ? "Adding…" : "Add to Selection"}
            </button>
          </div>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-text-muted">
          Pick an existing draft selection. Hand-off promotes Midjourney
          assets into the set&apos;s reference + product type. Already-promoted
          assets are skipped.
        </p>

        {isLoading ? (
          <div className="rounded-md border border-dashed border-line bg-paper px-4 py-6 text-center text-sm text-text-muted">
            Loading drafts…
          </div>
        ) : !draftSets || draftSets.length === 0 ? (
          <div className="rounded-md border border-dashed border-line bg-paper px-4 py-6 text-center">
            <h3 className="text-sm font-semibold text-ink">
              No draft selection
            </h3>
            <p className="mt-1 text-xs text-text-muted">
              Hand-off requires a draft set with a reference + product type.
              Create a draft set via{" "}
              <a
                href="/selection"
                className="text-info underline-offset-2 hover:underline"
              >
                Selection Studio (legacy)
              </a>
              . The in-modal &ldquo;New Selection&rdquo; flow lands post-MVP.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border border-line">
            {draftSets.map((s, idx) => {
              const isPicked = s.id === pickedId;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setPickedId(s.id)}
                  className={
                    "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors " +
                    (isPicked
                      ? "bg-k-orange-soft"
                      : "bg-paper hover:bg-k-bg-2") +
                    (idx < draftSets.length - 1
                      ? " border-b border-line-soft"
                      : "")
                  }
                  data-testid="add-to-selection-pick"
                  data-set-id={s.id}
                  data-picked={isPicked ? "true" : undefined}
                >
                  <Layers
                    className={
                      "h-4 w-4 " +
                      (isPicked ? "text-k-orange" : "text-ink-3")
                    }
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-ink">
                      {s.name}
                    </div>
                    <div className="mt-0.5 font-mono text-xs tracking-wider text-ink-3">
                      {s.itemCount} items · updated{" "}
                      {new Date(s.updatedAt).toLocaleDateString("tr-TR")}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {error ? (
          <div
            className="rounded-md border border-danger bg-danger-soft px-3 py-2 text-sm text-danger"
            role="alert"
          >
            {error}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
