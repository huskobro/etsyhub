"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { mockupJobQueryKey, type MockupRenderView } from "@/features/mockups/hooks/useMockupJob";
import { Button } from "@/components/ui/Button";
import { ChevronUp, RotateCcw, Download, Repeat } from "lucide-react";

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
      setActionError(err instanceof Error ? err.message : "Retry failed");
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
      setActionError(err instanceof Error ? err.message : "Swap failed");
    } finally {
      setIsSwapping(false);
    }
  };

  return (
    <div className="absolute inset-0 flex flex-col items-stretch justify-end gap-1 rounded bg-ink/60 p-2 opacity-0 transition-opacity hover:opacity-100">
      {isSuccess && !isCover && onCoverSwapClick && (
        <Button
          size="sm"
          variant="secondary"
          onClick={onCoverSwapClick}
          className="w-full"
        >
          <ChevronUp className="w-4 h-4 mr-1" />
          Set as cover
        </Button>
      )}

      {isSuccess && (
        <a
          href={`/api/mockup/jobs/${jobId}/renders/${render.id}/download`}
          className="w-full"
          download
        >
          <Button
            size="sm"
            variant="secondary"
            className="w-full"
          >
            <Download className="w-4 h-4 mr-1" />
            Download
          </Button>
        </a>
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
          className="rounded-md bg-danger/80 px-2 py-1 font-mono text-[10.5px] tracking-meta text-white"
        >
          {actionError}
        </p>
      )}
    </div>
  );
}
