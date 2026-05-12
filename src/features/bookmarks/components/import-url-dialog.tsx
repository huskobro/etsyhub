"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

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

  const jobStatus = useQuery({
    queryKey: ["job", jobId],
    queryFn: async () => {
      if (!jobId) return null;
      const res = await fetch(`/api/jobs/${jobId}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch job");
      return res.json() as Promise<{
        job: {
          id: string;
          status: string;
          progress: number;
          error: string | null;
          metadata: { assetId?: string; title?: string | null } | null;
        };
      }>;
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
      setMessage("Bookmark created.");
      onCreated?.();
      setTimeout(() => onClose(), 800);
    },
  });

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

  const job = jobStatus.data?.job;
  const success = job?.status === "SUCCESS";
  const failed = job?.status === "FAILED";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 p-4">
      <div className="w-full max-w-md rounded-md border border-border bg-surface p-5 shadow-popover">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">URL&apos;den bookmark ekle</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-text-muted hover:text-text"
          >
            Kapat
          </button>
        </div>

        <input
          type="url"
          placeholder="https://…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={!!jobId}
          className="h-10 w-full rounded-md border border-border bg-bg px-3 text-sm text-text disabled:opacity-60"
        />

        {job ? (
          <div className="mt-3 flex flex-col gap-2 rounded-md bg-surface-muted p-3 text-xs">
            <span className="text-text-muted">
              Job {job.id.slice(0, 10)}… · {job.status} · {job.progress}%
            </span>
            {failed ? (
              <span className="text-danger">Hata: {job.error ?? "-"}</span>
            ) : null}
            {success ? (
              <span className="text-success">
                Asset ready: {job.metadata?.assetId?.slice(0, 10) ?? "-"}…
              </span>
            ) : null}
          </div>
        ) : null}

        {message ? <p className="mt-3 text-xs text-text-muted">{message}</p> : null}

        <div className="mt-4 flex justify-end gap-2">
          {success ? (
            <button
              type="button"
              disabled={createMutation.isPending}
              onClick={() => createMutation.mutate()}
              className="rounded-md bg-accent px-3 py-2 text-sm text-accent-foreground disabled:opacity-50"
            >
              {createMutation.isPending
                ? "Creating…"
                : "Bookmark olarak kaydet"}
            </button>
          ) : (
            <button
              type="button"
              disabled={busy || !!jobId || !url}
              onClick={onStart}
              className="rounded-md bg-accent px-3 py-2 text-sm text-accent-foreground disabled:opacity-50"
            >
              {busy ? "Starting…" : jobId ? "In progress…" : "Start"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
