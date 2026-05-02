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

  return (
    <div className="fixed inset-0 bg-text/40 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-bg rounded-lg shadow-lg max-w-sm w-full mx-4 p-6">
        <h2 className="text-lg font-semibold mb-4">Cover Görselini Değiştir</h2>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Alternatif görsellerden birini seç
          </p>

          {alternatives.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Başka başarılı render yok.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto">
              {alternatives.map((render) => (
                <button
                  key={render.id}
                  onClick={() => setSelectedRenderId(render.id)}
                  className={`relative p-2 rounded border-2 transition ${
                    selectedRenderId === render.id
                      ? "border-accent bg-accent/10"
                      : "border-border hover:border-border-strong"
                  }`}
                >
                  {render.thumbnailKey ? (
                    <img
                      src={render.thumbnailKey}
                      alt="thumbnail"
                      className="w-full aspect-square object-cover rounded"
                    />
                  ) : (
                    <div className="w-full aspect-square bg-surface-2 rounded flex items-center justify-center text-xs text-muted-foreground">
                      Thumbnail yok
                    </div>
                  )}
                  <p className="text-xs mt-1 text-center truncate">
                    {render.variantId.substring(0, 8)}
                  </p>
                </button>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              İptal
            </Button>
            <Button
              onClick={handleSwap}
              disabled={!selectedRenderId || isSubmitting}
            >
              {isSubmitting ? "Değiştiriliyor…" : "Cover Olarak Ayarla"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
