"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

export type PromoteListingInput = {
  bookmarkId: string;
  productTypeId: string;
};

/**
 * Var olan bookmark'ı referansa promote eder.
 *
 * Detay sayfasındaki "Referans'a Taşı" aksiyonu için:
 *  - önce `useBookmarkListing` ile bookmark + asset yaratılır,
 *  - dönen `bookmarkId` bu mutation'a ürün tipi ile birlikte verilir.
 */
export function usePromoteListingToReference() {
  const qc = useQueryClient();
  return useMutation<{ reference: { id: string } }, Error, PromoteListingInput>({
    mutationFn: async (input) => {
      const res = await fetch("/api/references/promote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? "Referans'a taşıma başarısız");
      }
      return (await res.json()) as { reference: { id: string } };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookmarks"] });
      qc.invalidateQueries({ queryKey: ["references"] });
    },
  });
}
