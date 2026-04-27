"use client";

import { useQuery } from "@tanstack/react-query";

export type FolderRow = { name: string; path: string; fileCount: number };

export function useLocalFolders() {
  return useQuery({
    queryKey: ["local-library", "folders"],
    queryFn: async (): Promise<{ folders: FolderRow[] }> => {
      const r = await fetch("/api/local-library/folders");
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error ?? "Klasörler yüklenemedi");
      }
      return r.json();
    },
  });
}
