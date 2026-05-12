"use client";

// ImportUrlDialog — Inbox `Add from URL` modal.
//
// Phase 22 → topbar action slot pattern modal'ı operatör akışına bağladı
// (`/bookmarks?add=url`). Phase 24 → modal yüzeyini visible EN parity'ye
// ve Kivasy DS recipe tonuna taşıyor:
//
//   * Tüm görünür string'ler EN (önceden 4 TR sızıntı vardı: "URL'den
//     bookmark ekle", "Kapat", "Hata:", "Bookmark olarak kaydet").
//   * a11y sözleşmesi: role="dialog" + aria-modal + aria-labelledby +
//     useFocusTrap + Escape + backdrop click (PromoteDialog T-39 parity).
//   * DS recipe parity: `k-input` for URL field, `k-btn k-btn--primary` /
//     `k-btn k-btn--ghost` for actions (önceden legacy `bg-accent
//     rounded-md` primitive).
//   * Operatör için anlamlı status panel: teknik job ID + raw %
//     gizlendi; sadece "fetching → ready → error" üç durum görünür.
//   * Helper line: "We'll fetch the image and preview it before saving"
//     — operatör başlamadan önce ne olacağını biliyor.
//   * Primary CTA wording: "Start" → "Fetch image" (eylem netleşti);
//     success state'de "Save bookmark" (önceden "Bookmark olarak kaydet").
//   * Footer iki yollu close: header X (icon) + footer "Cancel" — modal
//     hapsetmez.

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useFocusTrap } from "@/components/ui/use-focus-trap";
import { cn } from "@/lib/cn";

type JobShape = {
  id: string;
  status: string;
  progress: number;
  error: string | null;
  metadata: { assetId?: string; title?: string | null } | null;
};

export function ImportUrlDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated?: () => void;
}) {
  const [url, setUrl] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const urlInputRef = useRef<HTMLInputElement | null>(null);
  useFocusTrap(dialogRef, true, urlInputRef);

  const jobStatus = useQuery({
    queryKey: ["job", jobId],
    queryFn: async () => {
      if (!jobId) return null;
      const res = await fetch(`/api/jobs/${jobId}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch job");
      return res.json() as Promise<{ job: JobShape }>;
    },
    enabled: !!jobId,
    refetchInterval: (q) => {
      const s = q.state.data?.job.status;
      return s === "SUCCESS" || s === "FAILED" ? false : 1500;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sourceUrl: url,
          title: jobStatus.data?.job.metadata?.title ?? undefined,
          assetId: jobStatus.data?.job.metadata?.assetId,
        }),
      });
      if (!res.ok)
        throw new Error((await res.json()).error ?? "Failed to create bookmark");
      return res.json();
    },
    onSuccess: () => {
      setMessage("Bookmark saved.");
      onCreated?.();
      setTimeout(() => onClose(), 800);
    },
    onError: (err: Error) => {
      setMessage(err.message);
    },
  });

  const closeIfIdle = () => {
    if (busy || createMutation.isPending) return;
    onClose();
  };

  // a11y: Escape → close (busy iken iptal edilmez).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeIfIdle();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, createMutation.isPending]);

  async function onStart() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/assets/import-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceUrl: url }),
      });
      if (!res.ok) {
        throw new Error((await res.json()).error ?? "Failed to start job");
      }
      const data = (await res.json()) as { jobId: string };
      setJobId(data.jobId);
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // a11y: backdrop click → close (target === currentTarget guard).
  const onBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    closeIfIdle();
  };

  const job = jobStatus.data?.job;
  const isFetching = !!jobId && job?.status !== "SUCCESS" && job?.status !== "FAILED";
  const success = job?.status === "SUCCESS";
  const failed = job?.status === "FAILED";
  const fetchDisabled = busy || isFetching || !url.trim();

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-url-dialog-title"
      onClick={onBackdropClick}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-lg border border-line bg-paper shadow-popover"
        data-testid="import-url-dialog"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line bg-paper px-5 py-4">
          <h2
            id="import-url-dialog-title"
            className="text-[15px] font-semibold text-ink"
          >
            Add bookmark from URL
          </h2>
          <button
            type="button"
            onClick={closeIfIdle}
            disabled={busy || createMutation.isPending}
            aria-label="Close"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-k-bg hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-k-orange disabled:opacity-50"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-3 px-5 py-4">
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
              Source URL
            </span>
            <input
              ref={urlInputRef}
              type="url"
              placeholder="https://…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={!!jobId}
              className="k-input"
              data-testid="import-url-input"
              aria-describedby="import-url-helper"
            />
            <span
              id="import-url-helper"
              className="text-[12px] text-ink-3"
            >
              Paste any image or listing URL — Etsy, Pinterest, Amazon or a
              direct image link. We&apos;ll fetch the image and preview it
              before saving.
            </span>
          </label>

          {/* Status panel — operatöre teknik job ID gösterilmez */}
          {job ? (
            <div
              className={cn(
                "rounded-md border px-3 py-2.5 text-[12.5px]",
                failed
                  ? "border-danger/40 bg-danger/5"
                  : success
                    ? "border-success/40 bg-success/5"
                    : "border-line-soft bg-k-bg-2/50",
              )}
              role="status"
              aria-live="polite"
              data-testid="import-url-status"
            >
              {isFetching ? (
                <span className="flex items-center gap-2 text-ink-2">
                  <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-k-orange" />
                  Fetching image… {job.progress > 0 ? `${job.progress}%` : null}
                </span>
              ) : null}
              {success ? (
                <span className="flex flex-col gap-0.5">
                  <span className="text-ink">Image fetched.</span>
                  <span className="text-ink-3 text-[11.5px]">
                    Ready to save as a bookmark.
                  </span>
                </span>
              ) : null}
              {failed ? (
                <span className="flex flex-col gap-0.5">
                  <span className="text-danger">Couldn&apos;t fetch image</span>
                  <span className="text-ink-3 text-[11.5px]">
                    {job.error?.trim() ||
                      "The URL didn't return a usable image. Try a direct image link."}
                  </span>
                </span>
              ) : null}
            </div>
          ) : null}

          {/* Non-job message (start error / save success) */}
          {message ? (
            <p
              className={cn(
                "text-[12px]",
                message === "Bookmark saved." ? "text-success" : "text-danger",
              )}
              data-testid="import-url-message"
            >
              {message}
            </p>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-line bg-paper px-5 py-3">
          <button
            type="button"
            data-size="sm"
            className="k-btn k-btn--ghost"
            onClick={closeIfIdle}
            disabled={busy || createMutation.isPending}
          >
            Cancel
          </button>
          {success ? (
            <button
              type="button"
              data-size="sm"
              className="k-btn k-btn--primary"
              disabled={createMutation.isPending}
              onClick={() => createMutation.mutate()}
              data-testid="import-url-save"
            >
              {createMutation.isPending ? "Saving…" : "Save bookmark"}
            </button>
          ) : (
            <button
              type="button"
              data-size="sm"
              className="k-btn k-btn--primary"
              disabled={fetchDisabled}
              onClick={onStart}
              data-testid="import-url-fetch"
            >
              {busy ? "Starting…" : isFetching ? "Fetching…" : "Fetch image"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
