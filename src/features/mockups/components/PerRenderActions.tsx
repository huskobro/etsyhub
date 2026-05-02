"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { mockupJobQueryKey, type MockupRenderView } from "@/features/mockups/hooks/useMockupJob";
import { Button } from "@/components/ui/Button";
import { ChevronUp, RotateCcw, Maximize2, Repeat } from "lucide-react";

// 5-class hata × eylem önerisi (Spec §5.6 satır 1422-1428).
const RETRYABLE_ERROR_CLASSES = new Set([
  "RENDER_TIMEOUT",
  "PROVIDER_DOWN",
] as const);

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
  const [isSwapping, setIsSwapping] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const isSuccess = render.status === "SUCCESS";
  const isFailed = render.status === "FAILED";
  const canRetry =
    isFailed &&
    render.errorClass !== null &&
    RETRYABLE_ERROR_CLASSES.has(
      render.errorClass as "RENDER_TIMEOUT" | "PROVIDER_DOWN",
    );

  const handleRetry = async () => {
    if (!canRetry) return;
    setIsRetrying(true);
    setActionError(null);
    try {
      // Spec §4.5: nested path /jobs/[jobId]/renders/[renderId]/retry
      const res = await fetch(
        `/api/mockup/jobs/${jobId}/renders/${render.id}/retry`,
        { method: "POST" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      await queryClient.refetchQueries({
        queryKey: mockupJobQueryKey(jobId),
      });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Retry başarısız");
    } finally {
      setIsRetrying(false);
    }
  };

  const handleSwap = async () => {
    if (!isFailed) return;
    setIsSwapping(true);
    setActionError(null);
    try {
      // Spec §4.4: nested path /jobs/[jobId]/renders/[renderId]/swap
      const res = await fetch(
        `/api/mockup/jobs/${jobId}/renders/${render.id}/swap`,
        { method: "POST" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      await queryClient.refetchQueries({
        queryKey: mockupJobQueryKey(jobId),
      });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Swap başarısız");
    } finally {
      setIsSwapping(false);
    }
  };

  return (
    <div className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 transition-opacity rounded flex flex-col items-stretch justify-end gap-1 p-2">
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
          {canRetry && (
            <Button
              size="sm"
              variant="secondary"
              onClick={handleRetry}
              disabled={isRetrying || isSwapping}
              className="flex-1"
            >
              <RotateCcw className="w-4 h-4 mr-1" />
              {isRetrying ? "..." : "Retry"}
            </Button>
          )}
          <Button
            size="sm"
            variant="secondary"
            onClick={handleSwap}
            disabled={isRetrying || isSwapping}
            className="flex-1"
          >
            <Repeat className="w-4 h-4 mr-1" />
            {isSwapping ? "..." : "Swap"}
          </Button>
        </div>
      )}

      {actionError && (
        <p
          role="alert"
          className="text-xs text-red-200 bg-red-900/60 px-2 py-1 rounded"
        >
          {actionError}
        </p>
      )}
    </div>
  );
}
