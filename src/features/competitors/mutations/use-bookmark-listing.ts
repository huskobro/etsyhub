"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

type JobStatus = "QUEUED" | "RUNNING" | "SUCCESS" | "FAILED" | string;
type JobResponse = {
  job: {
    id: string;
    status: JobStatus;
    progress: number;
    error: string | null;
    metadata: { assetId?: string; title?: string | null } | null;
  };
};

export type BookmarkListingInput = {
  sourceUrl: string;
  title?: string | null;
  thumbnailUrl?: string | null;
};

type BookmarkListingResult = {
  bookmarkId: string;
  assetId: string | null;
};

async function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function pollJob(jobId: string, maxMs = 60_000): Promise<JobResponse["job"]> {
  const started = Date.now();
  // İlk tick 500ms, sonra 1000ms'e geçer (asset-ingest kısa jobs).
  let delay = 500;
  while (Date.now() - started < maxMs) {
    const res = await fetch(`/api/jobs/${jobId}`, { cache: "no-store" });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? "Job durumu alınamadı");
    }
    const data = (await res.json()) as JobResponse;
    if (data.job.status === "SUCCESS" || data.job.status === "FAILED") {
      return data.job;
    }
    await wait(delay);
    delay = Math.min(delay + 500, 1500);
  }
  throw new Error("Bookmark görseli çekilirken zaman aşımı oldu");
}

/**
 * Rakip listing'ini Phase 2 bookmark stack'ine aktaran helper mutation.
 *
 * Akış:
 *  1) `POST /api/assets/import-url` → asset-ingest job başlatır.
 *  2) Job SUCCESS olana kadar `GET /api/jobs/[id]` polling.
 *  3) `POST /api/bookmarks` ile bookmark yaratır (assetId + title + sourceUrl).
 *
 * Başarı: bookmarks query invalidate — /bookmarks sayfası otomatik refresh.
 */
export function useBookmarkListing() {
  const qc = useQueryClient();
  return useMutation<BookmarkListingResult, Error, BookmarkListingInput>({
    mutationFn: async (input) => {
      // 1) import-url job başlat
      const ingestRes = await fetch("/api/assets/import-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceUrl: input.sourceUrl }),
      });
      if (!ingestRes.ok) {
        const body = (await ingestRes.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? "Görsel indirme job'ı başlatılamadı");
      }
      const { jobId } = (await ingestRes.json()) as { jobId: string };

      // 2) poll
      const job = await pollJob(jobId);
      if (job.status === "FAILED") {
        throw new Error(job.error ?? "Görsel indirme başarısız");
      }
      const assetId = job.metadata?.assetId ?? null;

      // 3) bookmark yarat
      const bookmarkRes = await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sourceUrl: input.sourceUrl,
          title: input.title ?? job.metadata?.title ?? undefined,
          assetId: assetId ?? undefined,
        }),
      });
      if (!bookmarkRes.ok) {
        const body = (await bookmarkRes.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? "Bookmark oluşturulamadı");
      }
      const { bookmark } = (await bookmarkRes.json()) as {
        bookmark: { id: string };
      };
      return { bookmarkId: bookmark.id, assetId };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookmarks"] });
    },
  });
}
