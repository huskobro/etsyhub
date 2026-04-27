"use client";

import { useQuery } from "@tanstack/react-query";
import type { Asset, ProductType, Reference } from "@prisma/client";

// Phase 5 Gap A — schema gerçeği: Reference.imageUrl YOK; URL truth
// Reference.asset.sourceUrl. Form productType'ı reference.productType.key
// üzerinden okur (TODO sabit "wall-art" fallback temizlenir).
export type ReferenceWithRelations = Reference & {
  asset: Asset;
  productType: ProductType | null;
};

export function useReference(id: string) {
  return useQuery({
    queryKey: ["reference", id],
    queryFn: async (): Promise<{ reference: ReferenceWithRelations }> => {
      const r = await fetch(`/api/references/${id}`);
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error ?? "Reference yüklenemedi");
      }
      return r.json();
    },
  });
}
