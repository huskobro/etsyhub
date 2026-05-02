"use client";

import { useMutation } from "@tanstack/react-query";
import type { GenerateListingMetaInput } from "../schemas";

export type GenerateListingMetaResult = {
  output: {
    title: string;
    description: string;
    tags: string[];
  };
  providerSnapshot: string;
  promptVersion: string;
};

/**
 * POST /api/listings/draft/[id]/generate-meta mutation hook.
 *
 * Phase 9 V1 Task 16 — AI listing metadata generation.
 *
 * Auto-save YOK: caller success'te output'u form alanlarına basar; kullanıcı
 * mevcut "Kaydet" ile PATCH'i tetikler. Cache invalidation YOK — listing
 * draft state'i değişmedi (sadece form pre-fill).
 *
 * Error mesaj policy: HTTP 400 (NOT_CONFIGURED) için kullanıcı dostu Türkçe;
 * 502 (provider) için "AI servis hatası, daha sonra tekrar deneyin" tonu.
 */
export function useGenerateListingMeta(id: string) {
  return useMutation<GenerateListingMetaResult, Error, GenerateListingMetaInput | undefined>({
    mutationFn: async (input) => {
      const res = await fetch(`/api/listings/draft/${id}/generate-meta`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input ?? {}),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const message = body?.error ?? `HTTP ${res.status}`;
        throw new Error(message);
      }
      return (await res.json()) as GenerateListingMetaResult;
    },
  });
}
