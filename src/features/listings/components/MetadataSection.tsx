"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Wand2 } from "lucide-react";
import { useUpdateListingDraft } from "../hooks/useUpdateListingDraft";
import type { ListingDraftView } from "../types";

/**
 * MetadataSection — Edit title, description, tags.
 *
 * Spec §9.2:
 * - Title (text input)
 * - Description (textarea)
 * - 13 tags (comma-separated input)
 * - Save button + AI button placeholder
 * - Inline error alert
 *
 * @param listing ListingDraft
 */
export function MetadataSection({ listing }: { listing: ListingDraftView }) {
  const mutation = useUpdateListingDraft(listing.id);

  const [title, setTitle] = useState(listing.title || "");
  const [description, setDescription] = useState(listing.description || "");
  const [tagsInput, setTagsInput] = useState(listing.tags.join(", "));

  const handleSave = () => {
    const newTags = tagsInput
      .split(",")
      .map((t: string) => t.trim())
      .filter((t: string) => t.length > 0);

    if (newTags.length > 13) {
      // Validation
      return;
    }

    mutation.mutate({
      title: title || undefined,
      description: description || undefined,
      tags: newTags,
    });
  };

  const hasChanges =
    title !== listing.title ||
    description !== listing.description ||
    tagsInput !== listing.tags.join(", ");

  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold mb-4">Başlık & Açıklama</h2>

      <div className="space-y-4">
        {/* Title */}
        <div>
          <label htmlFor="listing-title" className="block text-sm font-medium mb-2">
            Başlık
          </label>
          <input
            id="listing-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Listing başlığı girin"
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Etsy'de gözükecek ana başlık (140 karaktere kadar)
          </p>
        </div>

        {/* Description */}
        <div>
          <label htmlFor="listing-desc" className="block text-sm font-medium mb-2">
            Açıklama
          </label>
          <textarea
            id="listing-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Listing açıklaması girin"
            rows={6}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Ürün detayları ve özellikleri
          </p>
        </div>

        {/* Tags */}
        <div>
          <label htmlFor="listing-tags" className="block text-sm font-medium mb-2">
            Etiketler (maksimum 13)
          </label>
          <input
            id="listing-tags"
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="Virgülle ayırılmış etiketler girin: ürün1, ürün2, ürün3"
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Güncel: {tagsInput.split(",").filter((t: string) => t.trim()).length}/13 etiket
          </p>
        </div>

        {/* Error Alert */}
        {mutation.error && (
          <p role="alert" className="text-sm text-red-600">
            Kaydetme başarısız: {mutation.error.message}
          </p>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <Button
            onClick={handleSave}
            disabled={mutation.isPending || !hasChanges}
          >
            {mutation.isPending ? "Kaydediliyor…" : "Kaydet"}
          </Button>
          <Button
            variant="secondary"
            disabled
            title="Task 21'de AI listing generation eklenecek"
            aria-label="AI başlık üretimi şu an kullanılamaz (sonraki aşamada aktif)"
            className="inline-flex items-center gap-2"
          >
            <Wand2 className="w-4 h-4" />
            AI Oluştur
          </Button>
        </div>
      </div>
    </div>
  );
}
