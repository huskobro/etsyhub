"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { mockupJobQueryKey, type MockupRenderView } from "@/features/mockups/hooks/useMockupJob";
import { Button } from "@/components/ui/Button";
import { ChevronUp, RotateCcw, Maximize2 } from "lucide-react";

export type PerRenderActionsProps = {
  render: MockupRenderView;
  jobId: string;
  isCover?: boolean;
  onCoverSwapClick?: () => void;
};

export function PerRenderActions({
  render,
  jobId,
  isCover = false,
  onCoverSwapClick,
}: PerRenderActionsProps) {
  const queryClient = useQueryClient();
  const [isRetrying, setIsRetrying] = useState(false);

  const isSuccess = render.status === "SUCCESS";
  const isFailed = render.status === "FAILED";

  const handleRetry = async () => {
    if (isFailed) {
      setIsRetrying(true);
      try {
        const res = await fetch(`/api/mockup/renders/${render.id}/retry`, {
          method: "POST",
        });

        if (res.ok) {
          await queryClient.refetchQueries({
            queryKey: mockupJobQueryKey(jobId),
          });
        }
      } catch (err) {
        console.error("Retry error:", err);
      } finally {
        setIsRetrying(false);
      }
    }
  };

  const handleSwap = async () => {
    if (isFailed) {
      // V1'de swap endpoint'i submit yok; Phase 9'da eklenecek
      console.log("TODO V2: swap endpoint");
    }
  };

  return (
    <div className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 transition-opacity rounded flex items-end p-2">
      {isSuccess && !isCover && onCoverSwapClick && (
        <Button
          size="sm"
          variant="secondary"
          onClick={onCoverSwapClick}
          className="w-full"
        >
          <ChevronUp className="w-4 h-4 mr-1" />
          Cover Yap
        </Button>
      )}

      {isSuccess && (
        <Button
          size="sm"
          variant="secondary"
          disabled
          title="Phase 9'da per-render download eklenecek"
          className="w-full"
        >
          <Maximize2 className="w-4 h-4 mr-1" />
          Büyüt
        </Button>
      )}

      {isFailed && (
        <div className="flex gap-1 w-full">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleRetry}
            disabled={isRetrying}
            className="flex-1"
          >
            <RotateCcw className="w-4 h-4 mr-1" />
            Retry
          </Button>
          {/* TODO V2: per-render swap endpoint */}
        </div>
      )}
    </div>
  );
}
