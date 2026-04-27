"use client";

import { useQuery } from "@tanstack/react-query";

export type UrlCheckResult = {
  ok: boolean;
  status?: number;
  reason?: string;
};

export function useUrlPublicCheck(url: string | null | undefined) {
  return useQuery({
    queryKey: ["url-check", url],
    enabled: !!url,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<UrlCheckResult> => {
      const r = await fetch("/api/local-library/url-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error ?? "URL kontrolü başarısız");
      }
      return r.json();
    },
  });
}
