"use client";

// Pass 86 — Retry Failed Only CTA (client component).
//
// Batch detail page header'ında. failedCount=0 ise disabled. Click →
// confirm prompt → POST /api/admin/midjourney/batches/[batchId]/retry-failed
// → response.newBatchId → router.push detail page.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type RetryFailedButtonProps = {
  batchId: string;
  failedCount: number;
};

export function RetryFailedButton({
  batchId,
  failedCount,
}: RetryFailedButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const disabled = failedCount === 0 || pending;

  function handleClick() {
    if (disabled) return;
    setError(null);
    const ok = window.confirm(
      `${failedCount} fail eden job için yeni bir batch oluşturulacak. Devam edilsin mi?`,
    );
    if (!ok) return;
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/admin/midjourney/batches/${batchId}/retry-failed`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            // V1: aspect/strategy override yok; default 1:1 + auto
            body: JSON.stringify({}),
          },
        );
        const json: unknown = await res.json().catch(() => null);
        if (!res.ok) {
          let msg = `HTTP ${res.status}`;
          if (
            json &&
            typeof json === "object" &&
            "error" in json &&
            typeof (json as { error: unknown }).error === "string"
          ) {
            msg = (json as { error: string }).error;
          }
          setError(msg);
          return;
        }
        const data = json as { newBatchId?: string };
        if (data.newBatchId) {
          router.push(`/admin/midjourney/batches/${data.newBatchId}`);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Bilinmeyen hata");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        className="rounded-md border border-warning bg-warning-soft px-3 py-1.5 text-sm font-medium text-warning-text transition hover:opacity-90 disabled:opacity-40"
        data-testid={`mj-batch-retry-failed-${batchId}`}
        title={
          failedCount === 0
            ? "Bu batch'te FAILED job yok"
            : `${failedCount} fail eden job retry edilecek (yeni batch)`
        }
      >
        {pending
          ? "Retry tetikleniyor…"
          : `↻ Failed'leri Retry Et${
              failedCount > 0 ? ` (${failedCount})` : ""
            }`}
      </button>
      {error ? (
        <p
          className="text-xs text-danger"
          data-testid={`mj-batch-retry-error-${batchId}`}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
