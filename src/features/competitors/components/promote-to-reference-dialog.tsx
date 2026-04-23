"use client";

import { useState } from "react";
import type { CompetitorListing } from "../queries/use-competitor";

type ProductTypeOption = { id: string; displayName: string };

export function PromoteToReferenceDialog({
  listing,
  productTypes,
  isPending,
  onClose,
  onSubmit,
}: {
  listing: CompetitorListing;
  productTypes: ProductTypeOption[];
  isPending: boolean;
  onClose: () => void;
  onSubmit: (productTypeId: string) => void;
}) {
  const firstId = productTypes[0]?.id ?? "";
  const [productTypeId, setProductTypeId] = useState(firstId);
  const hasProductTypes = productTypes.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="promote-listing-title"
    >
      <div className="w-full max-w-md rounded-md border border-border bg-surface p-5 shadow-popover">
        <div className="mb-3 flex items-center justify-between">
          <h2
            id="promote-listing-title"
            className="text-lg font-semibold text-text"
          >
            Referans&apos;a Taşı
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-text-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Kapat
          </button>
        </div>

        <p className="mb-3 text-xs text-text-muted">
          &quot;{listing.title}&quot; bookmark olarak alınacak ve seçtiğin ürün
          tipi ile Referans Havuzu&apos;na taşınacak.
        </p>

        {hasProductTypes ? (
          <label
            htmlFor="promote-producttype"
            className="flex flex-col gap-1 text-sm text-text"
          >
            Ürün tipi
            <select
              id="promote-producttype"
              value={productTypeId}
              onChange={(e) => setProductTypeId(e.target.value)}
              disabled={isPending}
              className="h-10 rounded-md border border-border bg-bg px-3 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
            >
              {productTypes.map((pt) => (
                <option key={pt.id} value={pt.id}>
                  {pt.displayName}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="text-xs text-danger">
            Henüz tanımlı ürün tipi yok. Admin panelinden ürün tipi ekle.
          </p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-md border border-border px-3 py-2 text-sm text-text hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
          >
            Vazgeç
          </button>
          <button
            type="button"
            disabled={!hasProductTypes || !productTypeId || isPending}
            onClick={() => onSubmit(productTypeId)}
            className="rounded-md bg-accent px-3 py-2 text-sm text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
          >
            {isPending ? "Taşınıyor…" : "Referansa Taşı"}
          </button>
        </div>
      </div>
    </div>
  );
}
