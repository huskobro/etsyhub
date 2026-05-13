"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { mockupJobQueryKey, type MockupRenderView } from "@/features/mockups/hooks/useMockupJob";
import { Button } from "@/components/ui/Button";

export type CoverSwapModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  currentCoverRenderId: string;
  alternatives: MockupRenderView[]; // success renders excluding current cover, max 9
};

export function CoverSwapModal({
  open,
  onOpenChange,
  jobId,
  currentCoverRenderId,
  alternatives,
}: CoverSwapModalProps) {
  const queryClient = useQueryClient();
  const [selectedRenderId, setSelectedRenderId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSwap = async () => {
    if (!selectedRenderId) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/mockup/jobs/${jobId}/cover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ renderId: selectedRenderId }),
      });

      if (res.ok) {
        // Refetch job query — cover render update olacak
        await queryClient.refetchQueries({
          queryKey: mockupJobQueryKey(jobId),
        });
        onOpenChange(false);
        setSelectedRenderId(null);
      } else {
        console.error("Cover swap failed:", res.status);
      }
    } catch (err) {
      console.error("Cover swap error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  /* Phase 55 — EN parity + Kivasy DS migration:
   *   - "Cover Görselini Değiştir" → "Swap cover image"
   *   - "Alternatif görsellerden birini seç" → "Pick an alternative render"
   *   - "Başka başarılı render yok." → "No other successful renders."
   *   - "Thumbnail yok" → "No thumbnail"
   *   - "İptal" → "Cancel"
   *   - "Cover Olarak Ayarla" / "Değiştiriliyor…" → "Set as cover" / "Swapping…"
   *   - Legacy tokens: bg-text/40, bg-bg, border-accent, bg-accent/10,
   *     border-border-strong, text-muted-foreground, bg-surface-2 →
   *     ink/40 backdrop, paper bg, k-orange + k-orange-soft, line/line-strong,
   *     ink-3, k-bg-2 */
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm"
      data-testid="cover-swap-modal"
    >
      <div className="mx-4 w-full max-w-sm rounded-lg border border-line bg-paper p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold text-ink">Swap cover image</h2>

        <div className="space-y-4">
          <p className="text-sm text-ink-3">Pick an alternative render</p>

          {alternatives.length === 0 ? (
            <p className="text-sm text-ink-3">No other successful renders.</p>
          ) : (
            <div className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto">
              {alternatives.map((render) => (
                <button
                  key={render.id}
                  onClick={() => setSelectedRenderId(render.id)}
                  className={`relative rounded-md border-2 p-2 transition ${
                    selectedRenderId === render.id
                      ? "border-k-orange bg-k-orange-soft"
                      : "border-line hover:border-line-strong"
                  }`}
                >
                  {/* Pass 16 fix — render.thumbnailKey storage path olarak
                      `<img src>`'e doğrudan yapıştırılıyordu (bug); download
                      endpoint stream'i thumbnail için kullan. */}
                  {render.outputKey ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/mockup/jobs/${jobId}/renders/${render.id}/download`}
                      alt="thumbnail"
                      className="aspect-square w-full rounded object-cover"
                    />
                  ) : (
                    <div className="flex aspect-square w-full items-center justify-center rounded bg-k-bg-2 text-xs text-ink-3">
                      No thumbnail
                    </div>
                  )}
                  <p className="mt-1 truncate text-center font-mono text-[10.5px] tracking-meta text-ink-2">
                    {render.variantId.substring(0, 8)}
                  </p>
                </button>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Button
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSwap}
              disabled={!selectedRenderId || isSubmitting}
            >
              {isSubmitting ? "Swapping…" : "Set as cover"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
