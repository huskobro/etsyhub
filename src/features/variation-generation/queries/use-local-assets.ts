"use client";

import { useQuery } from "@tanstack/react-query";
import type { LocalLibraryAsset } from "@prisma/client";

export function useLocalAssets(folder: string | null, negativesOnly: boolean) {
  return useQuery({
    queryKey: ["local-library", "assets", folder, negativesOnly],
    enabled: folder != null,
    queryFn: async (): Promise<{ assets: LocalLibraryAsset[] }> => {
      const url = new URL("/api/local-library/assets", window.location.origin);
      if (folder) url.searchParams.set("folder", folder);
      if (negativesOnly) url.searchParams.set("negativesOnly", "true");
      const r = await fetch(url.toString());
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error ?? "Görseller yüklenemedi");
      }
      return r.json();
    },
  });
}
