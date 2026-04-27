"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useScanFolders() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/local-library/scan", { method: "POST" });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error ?? "Tarama başarısız");
      }
      return r.json();
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["local-library"] }),
  });
}
