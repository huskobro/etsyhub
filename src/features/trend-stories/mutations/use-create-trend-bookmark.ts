"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

export type CreateTrendBookmarkInput = {
  sourceUrl: string;
  title?: string | null;
  trendClusterId?: string | null;
};

type CreateTrendBookmarkResult = {
  bookmarkId: string;
};

/**
 * Trend Stories feed'inden hafif bookmark oluşturur.
 *
 * Bu mutation asset ingest akışı başlatmaz (Phase 3 ile kıyaslanınca daha ince).
 * Sadece `/api/bookmarks` POST — `sourceUrl` + opsiyonel `title` +
 * `trendClusterId` — backend cluster snapshot'ını (label + windowDays)
 * otomatik yazar.
 */
export function useCreateTrendBookmark() {
  const qc = useQueryClient();
  return useMutation<
    CreateTrendBookmarkResult,
    Error,
    CreateTrendBookmarkInput
  >({
    mutationFn: async (input) => {
      const res = await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sourceUrl: input.sourceUrl,
          title: input.title ?? undefined,
          trendClusterId: input.trendClusterId ?? undefined,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? "Bookmark oluşturulamadı");
      }
      const { bookmark } = (await res.json()) as {
        bookmark: { id: string };
      };
      return { bookmarkId: bookmark.id };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookmarks"] });
    },
  });
}
