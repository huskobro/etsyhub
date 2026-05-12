"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useUpdateListingDraft } from "../hooks/useUpdateListingDraft";
import type { ListingDraftView } from "../types";

/**
 * PricingSection — Edit price & materials.
 *
 * Spec §9.3:
 * - Price in USD (string input, convert to cents on save)
 * - Materials (comma-separated or textarea)
 * - Save button
 * - Inline error alert
 *
 * @param listing ListingDraft
 */
export function PricingSection({ listing }: { listing: ListingDraftView }) {
  const mutation = useUpdateListingDraft(listing.id);

  const [priceDollars, setPriceDollars] = useState(
    listing.priceCents != null
      ? (listing.priceCents / 100).toFixed(2)
      : "",
  );
  const [materials, setMaterials] = useState(
    Array.isArray(listing.materials) ? listing.materials.join(", ") : "",
  );

  const handleSave = () => {
    const dollars = parseFloat(priceDollars);

    if (Number.isNaN(dollars) || dollars <= 0) {
      // Validation error: let mutation error handle, or show inline
      return;
    }

    const priceCents = Math.round(dollars * 100);

    mutation.mutate({
      priceCents,
      materials: materials
        .split(",")
        .map((m) => m.trim())
        .filter((m) => m.length > 0),
    });
  };

  const hasChanges =
    priceDollars !== (listing.priceCents != null ? (listing.priceCents / 100).toFixed(2) : "") ||
    materials !== (Array.isArray(listing.materials) ? listing.materials.join(", ") : "");

  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold mb-4">Price & Materials</h2>

      <div className="space-y-4">
        {/* Price */}
        <div>
          <label htmlFor="listing-price" className="block text-sm font-medium mb-2">
            Price (USD)
          </label>
          <div className="flex items-center gap-2">
            <span className="text-gray-600">$</span>
            <input
              id="listing-price"
              type="number"
              step="0.01"
              min="0"
              value={priceDollars}
              onChange={(e) => setPriceDollars(e.target.value)}
              placeholder="5.99"
              className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Etsy sale price (excluding discounts and taxes)
          </p>
        </div>

        {/* Materials */}
        <div>
          <label htmlFor="listing-materials" className="block text-sm font-medium mb-2">
            Materials
          </label>
          <textarea
            id="listing-materials"
            value={materials}
            onChange={(e) => setMaterials(e.target.value)}
            placeholder="e.g. Digital download, PNG, Transparent background"
            rows={3}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Product composition and presentation
          </p>
        </div>

        {/* Error Alert */}
        {mutation.error && (
          <p role="alert" className="text-sm text-red-600">
            Save failed: {mutation.error.message}
          </p>
        )}

        {/* Save Button */}
        <div className="pt-4">
          <Button
            onClick={handleSave}
            disabled={mutation.isPending || !hasChanges}
          >
            {mutation.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
