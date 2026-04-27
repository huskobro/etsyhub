"use client";

// Phase 5 Task 15 — settings consume tarafı (qualityThresholds için).
// LocalAssetCard hardcoded 75/40 magic number'larını bu hook'tan okur.
// 5dk staleTime — settings sık değişmez; her render'da yeniden çekmek gereksiz.

import { useQuery } from "@tanstack/react-query";

export type LocalLibrarySettingsView = {
  rootFolderPath: string | null;
  targetResolution: { width: number; height: number };
  targetDpi: number;
  qualityThresholds: { ok: number; warn: number };
};

export function useLocalLibrarySettings() {
  return useQuery({
    queryKey: ["settings", "local-library"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<{ settings: LocalLibrarySettingsView }> => {
      const r = await fetch("/api/settings/local-library");
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error ?? "Ayarlar yüklenemedi");
      }
      return r.json();
    },
  });
}
