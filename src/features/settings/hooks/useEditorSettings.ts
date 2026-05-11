"use client";

import { useQuery } from "@tanstack/react-query";

/**
 * R9 — Edit modal'larında getEditorSettings okuma hook'u.
 *
 * `/api/settings/editor` zaten R8'de live. Bu hook UI ortak kullanımı için
 * şekillendirir; ilk yüklemede default'lar gelene kadar `null` döner —
 * caller `defaultValue ?? hook.data?.brushSize ?? 24` paterni kullanır.
 */

export interface EditorSettingsView {
  brushSize: number;
  maskComposite: "multiply" | "overlay" | "soft-light";
  magicEraserStrength: "light" | "medium" | "aggressive";
  upscaleModel: "realesrgan-v3" | "swinir" | "esrgan";
  eraserFillMode: "context" | "transparent";
  cropSnapToAspect: boolean;
}

export const editorSettingsQueryKey = ["settings", "editor"] as const;

export function useEditorSettings() {
  return useQuery<{ settings: EditorSettingsView }>({
    queryKey: editorSettingsQueryKey,
    queryFn: async () => {
      const r = await fetch("/api/settings/editor");
      if (!r.ok) throw new Error("Editor settings yüklenemedi");
      return r.json();
    },
    // Settings nadiren değişir; cache 5dk + window focus refetch yok.
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
